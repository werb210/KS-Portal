#!/usr/bin/env node
// KS_SHARED_HOSTING_v1 - publishes one brokerage's web build to the shared web host's storage.
//
// Keystone serves every brokerage's KS-Portal and KS-Client from one web app (ks-shared-web, code in KS-Ops
// web-host/), which streams files from the blob container `sites` at <code>/<app>/<path>. This script uploads a built
// dist/ there and removes the files the previous build left behind. The same file is kept in KS-Portal and KS-Client.
//
//   node deploy/publish-site.mjs <portal|client> <code> <dist dir> [--dry-run]
//
// Needs the Azure CLI (`az`) and AZURE_STORAGE_CONNECTION_STRING (the deploy passes the secret
// KS_SITES_STORAGE_CONNECTION_STRING in it). --dry-run prints the plan and touches nothing.
//
// Order, so a visitor never gets an index.html whose files are missing:
//   1. every file except the root index.html, with an explicit content type, grouped by type and cache policy
//      (assets/* are hashed: cached for a year; everything else: no-cache);
//   2. index.html (no-cache);
//   3. blobs under <code>/<app>/ that are not in this build are deleted.
// The build must contain index.html and staticwebapp.config.json (the web host applies its headers, e.g. the CSP).
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CONTAINER = "sites";
export const SITE_APPS = ["portal", "client"];
// Same rule as deploy/licensee-matrix.mjs and the ks_tenants.code check in KS-Ops.
const CODE_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export const IMMUTABLE = "public, max-age=31536000, immutable";
export const NO_CACHE = "no-cache";

const TYPES = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  cjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  config: "application/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  wasm: "application/wasm",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
};

/** The blob folder of one brokerage's app: "<code>/<app>/" in the container `sites`. */
export function blobPrefix(code, app) {
  if (!SITE_APPS.includes(app)) throw new Error(`Unknown app "${app}" (expected ${SITE_APPS.join(" or ")})`);
  // KS_SHARED_APP_BUILD_v1 - "_shared" is the one build every brokerage without its own gets.
  if (code !== "_shared" && (!CODE_RE.test(String(code)) || String(code).includes("--"))) {
    throw new Error(`Brokerage code "${code}" must be 3-32 lowercase letters, numbers or single hyphens`);
  }
  return `${code}/${app}/`;
}

/** Content type for a file of the build (path relative to dist/, forward slashes). */
export function contentTypeFor(rel) {
  const name = rel.split("/").pop() ?? "";
  // apple-app-site-association has no extension and must be served as JSON.
  if (rel.startsWith(".well-known/") && !name.includes(".")) return TYPES.json;
  const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  return TYPES[ext] ?? "application/octet-stream";
}

/** Cache policy: Vite's hashed files under assets/ never change; everything else is revalidated. */
export function cacheControlFor(rel) {
  return rel.startsWith("assets/") ? IMMUTABLE : NO_CACHE;
}

/** Every file under dir, relative, with forward slashes, sorted. */
export function listFiles(dir) {
  const out = [];
  const walk = (sub) => {
    for (const entry of readdirSync(path.join(dir, sub), { withFileTypes: true })) {
      const rel = sub ? `${sub}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  walk("");
  return out.sort();
}

/**
 * The upload plan for a build's files: groups of files sharing a content type and cache policy (uploaded first), then
 * the root index.html on its own (uploaded last). Throws when the build lacks index.html or staticwebapp.config.json.
 */
export function planUpload(files) {
  const missing = ["index.html", "staticwebapp.config.json"].filter((f) => !files.includes(f));
  if (missing.length) throw new Error(`The build is missing ${missing.join(" and ")} - run the build first`);
  const groups = new Map();
  for (const rel of files) {
    if (rel === "index.html") continue;
    const contentType = contentTypeFor(rel);
    const cacheControl = cacheControlFor(rel);
    const key = `${contentType}|${cacheControl}`;
    if (!groups.has(key)) groups.set(key, { contentType, cacheControl, files: [] });
    groups.get(key).files.push(rel);
  }
  return {
    groups: [...groups.values()],
    last: { file: "index.html", contentType: contentTypeFor("index.html"), cacheControl: NO_CACHE },
  };
}

/** Blob names under prefix that this build no longer has. Never anything outside prefix. */
export function staleBlobs(remoteNames, files, prefix) {
  const keep = new Set(files.map((f) => prefix + f));
  return remoteNames.filter((n) => typeof n === "string" && n.startsWith(prefix) && !keep.has(n)).sort();
}

function az(args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("az", [...args, "--only-show-errors"], { stdio: ["ignore", capture ? "pipe" : "inherit", "inherit"] });
    let out = "";
    if (capture) child.stdout.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("close", (status) => (status === 0 ? resolve(out) : reject(new Error(`az ${args.slice(0, 3).join(" ")} failed (exit ${status})`))));
  });
}

/** Runs fn over items, `limit` at a time; every item is tried, then the first error (if any) is thrown. */
async function eachLimited(items, limit, fn) {
  const errors = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
      } catch (err) {
        errors.push(err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (errors.length) throw new Error(`${errors.length} of ${items.length} failed: ${errors[0].message}`);
}

/** Hard-links (or copies) files into a fresh folder, keeping their paths, so upload-batch sends exactly them. */
function stage(dist, files) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ks-site-"));
  for (const rel of files) {
    const to = path.join(dir, rel);
    mkdirSync(path.dirname(to), { recursive: true });
    try {
      linkSync(path.join(dist, rel), to);
    } catch {
      copyFileSync(path.join(dist, rel), to);
    }
  }
  return dir;
}

export async function publish({ app, code, dist, dryRun = false, log = console.log }) {
  const prefix = blobPrefix(code, app);
  if (!existsSync(dist) || !statSync(dist).isDirectory()) throw new Error(`${dist} is not a folder - run the build first`);
  const files = listFiles(dist);
  const plan = planUpload(files);
  const destPath = prefix.replace(/\/$/, "");
  log(`Publishing ${files.length} file(s) from ${dist} to ${CONTAINER}/${prefix}`);
  for (const g of plan.groups) log(`  ${String(g.files.length).padStart(4)} x ${g.contentType} (${g.cacheControl})`);
  log(`     1 x index.html last`);
  if (dryRun) {
    log("Dry run: nothing uploaded or deleted.");
    return { prefix, plan, deleted: [] };
  }
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set (the deploy passes KS_SITES_STORAGE_CONNECTION_STRING in it)");
  }

  for (const g of plan.groups) {
    const dir = stage(dist, g.files);
    try {
      await az([
        "storage", "blob", "upload-batch",
        "--destination", CONTAINER, "--destination-path", destPath, "--source", dir,
        "--overwrite", "true", "--content-type", g.contentType, "--content-cache-control", g.cacheControl,
        "--max-connections", "8", "--no-progress",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  await az([
    "storage", "blob", "upload",
    "--container-name", CONTAINER, "--name", `${prefix}${plan.last.file}`, "--file", path.join(dist, plan.last.file),
    "--overwrite", "true", "--content-type", plan.last.contentType, "--content-cache-control", plan.last.cacheControl,
    "--no-progress",
  ]);

  const listed = JSON.parse(
    (await az(["storage", "blob", "list", "--container-name", CONTAINER, "--prefix", prefix, "--num-results", "*", "--query", "[].name", "--output", "json"], { capture: true })) || "[]",
  );
  const stale = staleBlobs(listed, files, prefix);
  log(stale.length ? `Removing ${stale.length} file(s) the previous build left behind` : "No old files to remove");
  await eachLimited(stale, 8, (name) => az(["storage", "blob", "delete", "--container-name", CONTAINER, "--name", name]));
  log(`Published ${CONTAINER}/${prefix}`);
  return { prefix, plan, deleted: stale };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const [app, code, dist] = args.filter((a) => a !== "--dry-run");
  publish({ app, code, dist: dist || "dist", dryRun }).catch((err) => {
    console.error(`::error::${String(err.message).replace(/\n/g, "%0A")}`);
    process.exit(1);
  });
}
