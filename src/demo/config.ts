// KS_PORTAL_v11_LIVE_DEMO - where the live demo's other halves live. Each comes from the build (deploy.yml sets them,
// with these defaults); a missing or malformed value falls back to the Keystone development copy.
const DEFAULTS = {
  client: "https://wonderful-island-0b68ae310.5.azurestaticapps.net",
  website: "https://nice-field-065dae410.1.azurestaticapps.net",
};

const env = (key: string): string => {
  try {
    return String((import.meta.env as Record<string, unknown>)[key] ?? "").trim();
  } catch {
    return "";
  }
};

const clean = (v: string): string => (/^https?:\/\/[^\s/]+/i.test(v) ? v.replace(/\/+$/, "") : "");

/** The client app (KS-Client) that serves /tour. */
export function demoClientUrl(): string {
  return clean(env("VITE_CLIENT_URL")) || clean(env("VITE_CLIENT_APP_URL")) || DEFAULTS.client;
}

/** The only origin whose postMessage events the demo page listens to. */
export function demoClientOrigin(): string {
  try {
    return new URL(demoClientUrl()).origin;
  } catch {
    return new URL(DEFAULTS.client).origin;
  }
}

/** The marketing website (sign-up page at /signup, demo request at /try). */
export function demoWebsiteUrl(): string {
  return clean(env("VITE_WEBSITE_URL")) || DEFAULTS.website;
}

/** The client app's guided tour, embedded: it posts its pop-ups and "client-done" back to `parentOrigin`. */
export function clientTourUrl(parentOrigin: string): string {
  return `${demoClientUrl()}/tour?embed=1&parent=${encodeURIComponent(parentOrigin)}`;
}

/** Where "Talk to us" on the last pop-up writes to (Keystone sales). */
export const DEMO_CONTACT_EMAIL = "keystone@boreal.financial";
