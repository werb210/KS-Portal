#!/usr/bin/env node
// KS_PORTAL_v8_DEMO - lets the /demo page reach KS-Ops and the demo server. After `vite build`, adds the origins of
// VITE_KS_OPS_URL and VITE_DEMO_SERVER_URL (from the environment or .env) to connect-src in the Content-Security-Policy
// of staticwebapp.config.json (the repo copy the deploy reads, and dist/). Does nothing when neither is set.
// KS_PORTAL_v11_LIVE_DEMO - and lets /demo show the client app in its phone frame: the origin of VITE_CLIENT_URL
// (default: the Keystone development client app) is added to frame-src. A file is only rewritten when its policy
// actually changes, so a build with the defaults leaves the committed copies untouched.
//
//   node scripts/demo-csp.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Values from a .env file (KEY=value lines). */
export function readDotEnv(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** https origins (scheme + host + port) of the given URLs; anything else is dropped. */
export function originsOf(urls) {
  const out = [];
  for (const u of urls) {
    try {
      const url = new URL(String(u ?? "").trim());
      if (url.protocol === "https:" && !out.includes(url.origin)) out.push(url.origin);
    } catch {
      /* not a URL */
    }
  }
  return out;
}

/** KS_PORTAL_v11_LIVE_DEMO - the client app the /demo phone frame shows when VITE_CLIENT_URL is not set. */
export const DEFAULT_CLIENT_URL = "https://wonderful-island-0b68ae310.5.azurestaticapps.net";

/** The policy with the origins added to `directive` (created when missing, starting from 'self'). */
export function addSources(csp, directive, origins) {
  const parts = String(csp).split(";").map((p) => p.trim()).filter(Boolean);
  const i = parts.findIndex((p) => p.split(/\s+/)[0] === directive);
  const current = i >= 0 ? parts[i].split(/\s+/) : [directive, "'self'"];
  for (const o of origins) if (!current.includes(o)) current.push(o);
  if (i >= 0) parts[i] = current.join(" ");
  else parts.push(current.join(" "));
  return parts.join("; ") + ";";
}

/** The policy with the origins added to connect-src (created when missing). */
export function addConnectSrc(csp, origins) {
  return addSources(csp, "connect-src", origins);
}

/**
 * The config with the demo origins added. `origins` is either a list (connect-src only, as before) or
 * { connect: [...], frame: [...] }.
 */
export function patchConfig(json, origins) {
  const want = Array.isArray(origins) ? { connect: origins, frame: [] } : { connect: origins.connect ?? [], frame: origins.frame ?? [] };
  const cfg = JSON.parse(json);
  const headers = (cfg.globalHeaders ??= {});
  let csp = headers["Content-Security-Policy"] ?? "default-src 'self'";
  if (want.connect.length) csp = addSources(csp, "connect-src", want.connect);
  if (want.frame.length) csp = addSources(csp, "frame-src", want.frame);
  headers["Content-Security-Policy"] = csp;
  return JSON.stringify(cfg, null, 2) + "\n";
}

/** The origins the demo needs, from the build environment. */
export function demoOrigins(env) {
  return {
    connect: originsOf([env.VITE_KS_OPS_URL, env.VITE_DEMO_SERVER_URL]),
    frame: originsOf([env.VITE_CLIENT_URL || DEFAULT_CLIENT_URL]),
  };
}

/** The new file text, or null when the policy would not change (so the file is left exactly as it is). */
export function patchIfChanged(json, origins) {
  const before = JSON.parse(json)?.globalHeaders?.["Content-Security-Policy"] ?? null;
  const next = patchConfig(json, origins);
  return JSON.parse(next).globalHeaders["Content-Security-Policy"] === before ? null : next;
}

function main() {
  const env = { ...(existsSync(".env") ? readDotEnv(readFileSync(".env", "utf8")) : {}), ...process.env };
  const origins = demoOrigins(env);
  for (const file of ["staticwebapp.config.json", "dist/staticwebapp.config.json"]) {
    if (!existsSync(file)) continue;
    const next = patchIfChanged(readFileSync(file, "utf8"), origins);
    if (next === null) {
      console.log(`[demo-csp] ${file}: Content-Security-Policy already allows the demo`);
      continue;
    }
    writeFileSync(file, next);
    console.log(`[demo-csp] ${file}: connect-src ${origins.connect.join(", ") || "(unchanged)"}; frame-src ${origins.frame.join(", ")}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
