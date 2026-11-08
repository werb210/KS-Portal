#!/usr/bin/env node
// KS_SHARED_APP_BUILD_v1 - the shared portal build serves every brokerage, so its Content-Security-Policy allows any
// brokerage's KS-server (https/wss://*.api.<domain>) and client app (frames: https://*.app.<domain>) instead of one.
//   node scripts/shared-csp.mjs <dist dir> <domain>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addServer } from "./server-csp.mjs";
import { addSources } from "./demo-csp.mjs";

export function sharedPolicy(csp, domain) {
  return addSources(addServer(csp, `*.api.${domain}`), "frame-src", [`https://*.app.${domain}`]);
}

export function patchSharedConfig(json, domain) {
  const cfg = JSON.parse(json);
  const fix = (h) => {
    if (h && typeof h["Content-Security-Policy"] === "string") h["Content-Security-Policy"] = sharedPolicy(h["Content-Security-Policy"], domain);
  };
  fix(cfg.globalHeaders);
  for (const r of cfg.routes ?? []) fix(r.headers);
  return JSON.stringify(cfg, null, 2) + "\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [dist, domain] = process.argv.slice(2);
  if (!dist || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(String(domain))) {
    console.error("usage: node scripts/shared-csp.mjs <dist dir> <domain>");
    process.exit(1);
  }
  const file = path.join(dist, "staticwebapp.config.json");
  writeFileSync(file, patchSharedConfig(readFileSync(file, "utf8"), domain));
  console.log(`[shared-csp] ${file}: allows *.api.${domain} and *.app.${domain}`);
}
