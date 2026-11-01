#!/usr/bin/env node
// KS_ANDROID_STAFF_v1 - the brand the Android staff app is built with (android/brand.properties, read by
// android/app/build.gradle): application id, the two launcher names (the portal and its "Phone" icon), the brand
// colour and the text colour that reads on it, and the version.
//
//   node scripts/android-brand.mjs            write android/brand.properties from the environment
//   node scripts/android-brand.mjs --check    exit 1 if the committed file is not what a no-settings run writes
//
// No settings = the Keystone app (one Google Play app for every brokerage; staff find their company by work email or
// mobile number, like the iPad app). A licensee build (Actions > "Android staff apps" with a licensee code) takes its
// settings from the licensee's GitHub environment ks-<code>, like the desktop and client apps:
//   ANDROID_APPLICATION_ID   default financial.boreal.keystone.<code>.portal (hyphens become underscores)
//   ANDROID_APP_NAME         default "<VITE_COMPANY_NAME> Staff Portal" (the desktop app's rule)
//   ANDROID_PHONE_NAME       default "<VITE_COMPANY_NAME> Phone"
//   ANDROID_BRAND_COLOR      #RRGGBB, default Keystone blue; text on it is white or near-black, whichever reads
// Inside GitHub Actions the resolved values are also written to $GITHUB_OUTPUT.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appNameFor } from "../desktop/native/brand-lib.mjs";

export const DEFAULT_APPLICATION_ID = "financial.boreal.keystone.portal";
export const DEFAULT_APP_NAME = "Keystone Staff Portal";
export const DEFAULT_PHONE_NAME = "Keystone Phone";
export const DEFAULT_BRAND_COLOR = "#1E3A8A";
export const DEFAULT_VERSION = "2.0.0";
export const APPLICATION_ID_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/;
const CODE_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 .,()-]{0,38}[A-Za-z0-9.)]$/;

/** A licensee code as one Java package segment: "north-wind" -> "north_wind", "7seas" -> "k7seas". */
export function packageSegment(code) {
  const s = String(code ?? "").trim().toLowerCase().replace(/-/g, "_");
  return /^[a-z]/.test(s) ? s : `k${s}`;
}

/** WCAG relative luminance of #RRGGBB. */
export function luminance(hex) {
  const v = String(hex).replace("#", "");
  const ch = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White text on the brand colour when it reads (4.5:1), otherwise near-black, otherwise black. */
export function onBrandColor(brand) {
  for (const text of ["#FFFFFF", "#111827"]) if (contrast(brand, text) >= 4.5) return text;
  return "#000000";
}

/** The brand in force for these settings. Throws with every problem found. */
export function resolveAndroidBrand(env = {}) {
  const pick = (name) => String(env[name] ?? "").trim();
  const code = pick("ANDROID_LICENSEE");
  const company = pick("VITE_COMPANY_NAME");
  const errors = [];
  if (code && !CODE_RE.test(code)) errors.push(`licensee code "${code}" must be 3-32 lowercase letters, numbers or hyphens`);
  const brand = {
    licensee: code,
    application_id: pick("ANDROID_APPLICATION_ID") || (code ? `financial.boreal.keystone.${packageSegment(code)}.portal` : DEFAULT_APPLICATION_ID),
    app_name: pick("ANDROID_APP_NAME") || (code && company ? appNameFor(company) : DEFAULT_APP_NAME),
    phone_name: pick("ANDROID_PHONE_NAME") || (code && company ? `${appNameFor(company).replace(/ Staff Portal$/, "")} Phone` : DEFAULT_PHONE_NAME),
    brand_color: (pick("ANDROID_BRAND_COLOR") || DEFAULT_BRAND_COLOR).toUpperCase(),
    version_name: pick("ANDROID_VERSION_NAME") || DEFAULT_VERSION,
  };
  if (!APPLICATION_ID_RE.test(brand.application_id)) errors.push(`application id "${brand.application_id}" must look like com.example.portal (lowercase letters, digits, underscores)`);
  if (!NAME_RE.test(brand.app_name)) errors.push(`app name "${brand.app_name}" may use letters, digits, spaces and . , ( ) - (2-40 characters)`);
  if (!NAME_RE.test(brand.phone_name)) errors.push(`phone name "${brand.phone_name}" may use letters, digits, spaces and . , ( ) - (2-40 characters)`);
  if (!/^#[0-9A-F]{6}$/.test(brand.brand_color)) errors.push(`brand colour "${brand.brand_color}" must be #RRGGBB`);
  else if (contrast(brand.brand_color, onBrandColor(brand.brand_color)) < 4.5) errors.push(`brand colour "${brand.brand_color}" is too close to mid-grey: no text colour reads on it (4.5:1); pick a darker or lighter colour`);
  if (!/^\d+\.\d+\.\d+$/.test(brand.version_name)) errors.push(`version "${brand.version_name}" must be x.y.z`);
  if (errors.length) throw new Error(`Android brand problems:\n  - ${errors.join("\n  - ")}`);
  return { ...brand, on_brand_color: onBrandColor(brand.brand_color) };
}

/** android/brand.properties. Values are plain ASCII (the name rule above), so no escaping is needed. */
export function brandProperties(brand) {
  return [
    "# KS_ANDROID_STAFF_v1 - written by scripts/android-brand.mjs; the committed copy is the Keystone app.",
    `applicationId=${brand.application_id}`,
    `appName=${brand.app_name}`,
    `phoneName=${brand.phone_name}`,
    `brandColor=${brand.brand_color}`,
    `onBrandColor=${brand.on_brand_color}`,
    `versionName=${brand.version_name}`,
    "",
  ].join("\n");
}

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROPERTIES_FILE = path.join(here, "..", "android", "brand.properties");

function main(argv) {
  if (argv[0] === "--check") {
    const want = brandProperties(resolveAndroidBrand({}));
    const have = readFileSync(PROPERTIES_FILE, "utf8");
    if (have !== want) {
      console.error("::error::android/brand.properties is not the Keystone default. Run: node scripts/android-brand.mjs (with no ANDROID_* settings)");
      process.exit(1);
    }
    console.log("android/brand.properties: Keystone default");
    return;
  }
  const brand = resolveAndroidBrand(process.env);
  writeFileSync(PROPERTIES_FILE, brandProperties(brand));
  console.log(`Android brand: ${brand.app_name} / ${brand.phone_name} (${brand.application_id}) ${brand.brand_color} on ${brand.on_brand_color} v${brand.version_name}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(brand).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    console.error(`::error::${String(err.message).replace(/\n/g, "%0A")}`);
    process.exit(1);
  }
}
