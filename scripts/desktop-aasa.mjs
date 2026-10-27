#!/usr/bin/env node
// KS_NATIVE_DESKTOP_v1 - the portal serves /.well-known/apple-app-site-association so the native Mac app may use this
// origin's passkeys and the "From Messages" code AutoFill (Associated Domains: webcredentials). The committed
// public/ copy lists no apps. After `vite build`, when APPLE_TEAM_ID is set (environment or .env), dist/ gets the
// file naming TEAMID.<bundle id> for each id in DESKTOP_BUNDLE_IDS (default: the Keystone desktop app). The content
// type and "no rewrite to index.html" come from staticwebapp.config.json.
//
//   node scripts/desktop-aasa.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readDotEnv } from "./demo-csp.mjs";
import { appleAppSiteAssociation } from "../desktop/native/brand-lib.mjs";

export const DEFAULT_DESKTOP_BUNDLE_IDS = "financial.boreal.keystone.desktop";

/** "TEAMID.bundle" ids for the file, from APPLE_TEAM_ID and DESKTOP_BUNDLE_IDS. Empty without a valid Team ID. */
export function desktopAppIds(env) {
  const team = String(env.APPLE_TEAM_ID ?? "").trim();
  if (!/^[A-Z0-9]{10}$/.test(team)) return [];
  const ids = String(env.DESKTOP_BUNDLE_IDS || DEFAULT_DESKTOP_BUNDLE_IDS)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(ids)].map((id) => `${team}.${id}`);
}

export function aasaJson(env) {
  return `${JSON.stringify(appleAppSiteAssociation(desktopAppIds(env)), null, 2)}\n`;
}

function main() {
  const env = { ...(existsSync(".env") ? readDotEnv(readFileSync(".env", "utf8")) : {}), ...process.env };
  const ids = desktopAppIds(env);
  if (!existsSync("dist")) {
    console.log("[desktop-aasa] no dist/ - nothing to do");
    return;
  }
  mkdirSync("dist/.well-known", { recursive: true });
  writeFileSync("dist/.well-known/apple-app-site-association", aasaJson(env));
  console.log(`[desktop-aasa] apple-app-site-association: ${ids.length ? ids.join(", ") : "no apps (APPLE_TEAM_ID not set)"}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
