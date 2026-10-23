#!/usr/bin/env node
// KS_LICENSEE_DEPLOY_v1 - lets a licensee's portal reach its own KS-server. The committed staticwebapp.config.json
// allows the Keystone development server in its Content-Security-Policy. After `vite build`, wherever a directive
// allows the development server (https:// or wss://), the server from VITE_API_URL / VITE_API_BASE_URL (environment
// or .env) is added next to it, in the repo copy the deploy reads and in dist/. Nothing changes when the build's
// server is the development server or none is set, so the development copy's files stay exactly as committed.
//
//   node scripts/server-csp.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readDotEnv } from "./demo-csp.mjs";

/** The Keystone development server the committed policy allows. */
export const DEV_SERVER_HOST = "ks-server-dev-chb5htbwaue2hygk.canadacentral-01.azurewebsites.net";

/** The host of the build's server (VITE_API_URL, else VITE_API_BASE_URL) when it is https and not the dev server. */
export function serverHost(env) {
  for (const key of ["VITE_API_URL", "VITE_API_BASE_URL"]) {
    const raw = String(env[key] ?? "").trim();
    if (!raw) continue;
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:") return "";
      return url.host === DEV_SERVER_HOST ? "" : url.host;
    } catch {
      return "";
    }
  }
  return "";
}

/** The policy with https://host and wss://host added to every directive that allows the development server. */
export function addServer(csp, host) {
  const parts = String(csp).split(";").map((p) => p.trim()).filter(Boolean);
  const next = parts.map((part) => {
    const tokens = part.split(/\s+/);
    for (const scheme of ["https", "wss"]) {
      const dev = `${scheme}://${DEV_SERVER_HOST}`;
      const add = `${scheme}://${host}`;
      const i = tokens.indexOf(dev);
      if (i >= 0 && !tokens.includes(add)) tokens.splice(i + 1, 0, add);
    }
    return tokens.join(" ");
  });
  return next.join("; ") + (String(csp).trim().endsWith(";") ? ";" : "");
}

/** The new file text, or null when no policy in it changes (so the file is left exactly as it is). */
export function patchServerIfChanged(json, host) {
  if (!host) return null;
  const cfg = JSON.parse(json);
  let changed = false;
  const visit = (headers) => {
    if (!headers || typeof headers["Content-Security-Policy"] !== "string") return;
    const before = headers["Content-Security-Policy"];
    const after = addServer(before, host);
    if (after !== before) {
      headers["Content-Security-Policy"] = after;
      changed = true;
    }
  };
  visit(cfg.globalHeaders);
  for (const route of Array.isArray(cfg.routes) ? cfg.routes : []) visit(route && route.headers);
  return changed ? JSON.stringify(cfg, null, 2) + "\n" : null;
}

function main() {
  const env = { ...(existsSync(".env") ? readDotEnv(readFileSync(".env", "utf8")) : {}), ...process.env };
  const host = serverHost(env);
  for (const file of ["staticwebapp.config.json", "dist/staticwebapp.config.json"]) {
    if (!existsSync(file)) continue;
    const next = patchServerIfChanged(readFileSync(file, "utf8"), host);
    if (next === null) {
      console.log(`[server-csp] ${file}: unchanged${host ? "" : " (development server)"}`);
      continue;
    }
    writeFileSync(file, next);
    console.log(`[server-csp] ${file}: allows ${host}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
