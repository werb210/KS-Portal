#!/usr/bin/env node
// KS_PORTAL_v8_DEMO - lets the /demo page reach KS-Ops and the demo server. After `vite build`, adds the origins of
// VITE_KS_OPS_URL and VITE_DEMO_SERVER_URL (from the environment or .env) to connect-src in the Content-Security-Policy
// of staticwebapp.config.json (the repo copy the deploy reads, and dist/). Does nothing when neither is set.
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

/** The policy with the origins added to connect-src (created when missing). */
export function addConnectSrc(csp, origins) {
  const parts = String(csp).split(";").map((p) => p.trim()).filter(Boolean);
  const i = parts.findIndex((p) => p.split(/\s+/)[0] === "connect-src");
  const current = i >= 0 ? parts[i].split(/\s+/) : ["connect-src", "'self'"];
  for (const o of origins) if (!current.includes(o)) current.push(o);
  if (i >= 0) parts[i] = current.join(" ");
  else parts.push(current.join(" "));
  return parts.join("; ") + ";";
}

export function patchConfig(json, origins) {
  const cfg = JSON.parse(json);
  const headers = (cfg.globalHeaders ??= {});
  headers["Content-Security-Policy"] = addConnectSrc(headers["Content-Security-Policy"] ?? "default-src 'self'", origins);
  return JSON.stringify(cfg, null, 2) + "\n";
}

function main() {
  const env = { ...(existsSync(".env") ? readDotEnv(readFileSync(".env", "utf8")) : {}), ...process.env };
  const origins = originsOf([env.VITE_KS_OPS_URL, env.VITE_DEMO_SERVER_URL]);
  if (!origins.length) {
    console.log("[demo-csp] VITE_KS_OPS_URL / VITE_DEMO_SERVER_URL not set: Content-Security-Policy left as it is");
    return;
  }
  for (const file of ["staticwebapp.config.json", "dist/staticwebapp.config.json"]) {
    if (!existsSync(file)) continue;
    writeFileSync(file, patchConfig(readFileSync(file, "utf8"), origins));
    console.log(`[demo-csp] ${file}: connect-src now allows ${origins.join(", ")}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
