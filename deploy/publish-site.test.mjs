// KS_SHARED_HOSTING_v1 - deploy/publish-site.mjs (node --test deploy/*.test.mjs). Same file in KS-Portal and KS-Client.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  IMMUTABLE,
  NO_CACHE,
  blobPrefix,
  cacheControlFor,
  contentTypeFor,
  listFiles,
  planUpload,
  publish,
  staleBlobs,
} from "./publish-site.mjs";

test("blob folder is <code>/<app>/ and refuses anything else", () => {
  assert.equal(blobPrefix("northwind", "portal"), "northwind/portal/");
  assert.equal(blobPrefix("north-wind", "client"), "north-wind/client/");
  assert.throws(() => blobPrefix("northwind", "server"), /Unknown app/);
  for (const bad of ["", "ab", "North", "../x", "a--b", "northwind/", "-abc"]) {
    assert.throws(() => blobPrefix(bad, "portal"), /Brokerage code/, bad);
  }
});

test("content types are explicit, including the files a guess gets wrong", () => {
  assert.equal(contentTypeFor("index.html"), "text/html; charset=utf-8");
  assert.equal(contentTypeFor("assets/index-abc123.js"), "text/javascript; charset=utf-8");
  assert.equal(contentTypeFor("assets/pdf.worker-x.mjs"), "text/javascript; charset=utf-8");
  assert.equal(contentTypeFor("assets/index-abc123.css"), "text/css; charset=utf-8");
  assert.equal(contentTypeFor("manifest.webmanifest"), "application/manifest+json; charset=utf-8");
  assert.equal(contentTypeFor("staticwebapp.config.json"), "application/json; charset=utf-8");
  assert.equal(contentTypeFor(".well-known/apple-app-site-association"), "application/json; charset=utf-8");
  assert.equal(contentTypeFor(".well-known/assetlinks.json"), "application/json; charset=utf-8");
  assert.equal(contentTypeFor("assets/font-x.woff2"), "font/woff2");
  assert.equal(contentTypeFor("icons/ICON.PNG"), "image/png");
  assert.equal(contentTypeFor("logo.svg"), "image/svg+xml");
  assert.equal(contentTypeFor("LICENSE"), "application/octet-stream");
});

test("hashed assets are cached for a year, everything else is revalidated", () => {
  assert.equal(cacheControlFor("assets/index-abc123.js"), IMMUTABLE);
  assert.equal(cacheControlFor("index.html"), NO_CACHE);
  assert.equal(cacheControlFor("sw.js"), NO_CACHE);
  assert.equal(cacheControlFor("icons/icon-192.png"), NO_CACHE);
});

test("the plan uploads index.html last and needs staticwebapp.config.json", () => {
  const files = ["assets/a-1.js", "assets/b-2.js", "assets/c-3.css", "index.html", "offline.html", "staticwebapp.config.json", "sw.js"];
  const plan = planUpload(files);
  assert.deepEqual(plan.last, { file: "index.html", contentType: "text/html; charset=utf-8", cacheControl: NO_CACHE });
  const planned = plan.groups.flatMap((g) => g.files).sort();
  assert.deepEqual(planned, files.filter((f) => f !== "index.html"));
  const js = plan.groups.find((g) => g.contentType.startsWith("text/javascript") && g.cacheControl === IMMUTABLE);
  assert.deepEqual(js.files, ["assets/a-1.js", "assets/b-2.js"]);
  const sw = plan.groups.find((g) => g.files.includes("sw.js"));
  assert.equal(sw.cacheControl, NO_CACHE);
  assert.throws(() => planUpload(["index.html"]), /staticwebapp\.config\.json/);
  assert.throws(() => planUpload(["staticwebapp.config.json"]), /index\.html/);
});

test("only blobs of this app that the build no longer has are removed", () => {
  const remote = [
    "northwind/portal/index.html",
    "northwind/portal/assets/old-1.js",
    "northwind/portal/assets/a-1.js",
    "northwind/client/assets/old-9.js",
    "northwind-two/portal/assets/x.js",
  ];
  assert.deepEqual(staleBlobs(remote, ["index.html", "assets/a-1.js"], "northwind/portal/"), ["northwind/portal/assets/old-1.js"]);
  assert.deepEqual(staleBlobs([], ["index.html"], "northwind/portal/"), []);
});

test("a dry run reads the real build folder (dotfiles included) and touches nothing", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "ks-publish-test-"));
  try {
    mkdirSync(path.join(dir, "assets"));
    mkdirSync(path.join(dir, ".well-known"));
    for (const f of ["index.html", "staticwebapp.config.json", "assets/a-1.js", ".well-known/apple-app-site-association"]) {
      writeFileSync(path.join(dir, f), "x");
    }
    assert.deepEqual(listFiles(dir), [".well-known/apple-app-site-association", "assets/a-1.js", "index.html", "staticwebapp.config.json"]);
    const lines = [];
    const out = await publish({ app: "portal", code: "northwind", dist: dir, dryRun: true, log: (l) => lines.push(l) });
    assert.equal(out.prefix, "northwind/portal/");
    assert.deepEqual(out.deleted, []);
    assert.match(lines.join("\n"), /Dry run/);
    await assert.rejects(publish({ app: "portal", code: "northwind", dist: path.join(dir, "nope"), dryRun: true, log: () => {} }), /not a folder/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
