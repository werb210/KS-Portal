// KS_PORTAL_v1_LICENSEE - the web addresses of this copy of Keystone.
// KS-Portal was copied from BF-portal, which wrote Boreal's addresses (server/client/www.boreal.financial) into the
// code. Each Keystone copy sets its own at build time (VITE_API_URL, VITE_CLIENT_APP_URL, VITE_WEBSITE_URL); when one
// is missing, the Keystone development copy's address is used - never Boreal's.
import { nativeWorkspaceServer } from "./workspace";

const DEV = {
  server: "https://ks-server-dev-chb5htbwaue2hygk.canadacentral-01.azurewebsites.net",
  client: "https://wonderful-island-0b68ae310.5.azurestaticapps.net",
};

const clean = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return /^https?:\/\/[^\s/]+/i.test(s) ? s.replace(/\/+$/, "") : "";
};

// KS_SHARED_APP_BUILD_v1 - one build serves every brokerage. The shared web host answers /ks-config.js (loaded by
// index.html before the app) with this brokerage's addresses; without it, a <code>.portal.<domain> address implies
// <code>.api.<domain> and <code>.app.<domain>. A build's own VITE_* settings come after both.
type RuntimeConfig = { code?: string; server_url?: string; portal_url?: string; client_url?: string };

export function runtimeConfig(w: unknown = typeof window === "undefined" ? undefined : window): RuntimeConfig {
  const c = (w as { __KS_CONFIG__?: unknown } | undefined)?.__KS_CONFIG__;
  return c && typeof c === "object" ? (c as RuntimeConfig) : {};
}

export function addressesFromHost(host: string | undefined): { server: string; client: string } | null {
  const m = /^([a-z0-9-]+)\.portal\.([a-z0-9.-]+\.[a-z]{2,})$/i.exec(String(host ?? "").toLowerCase());
  return m ? { server: `https://${m[1]}.api.${m[2]}`, client: `https://${m[1]}.app.${m[2]}` } : null;
}

const RT = runtimeConfig();
const FROM_HOST = addressesFromHost(typeof window === "undefined" ? undefined : window.location?.hostname);

// KS_STAFF_DIRECTORY_v1 - the iPad app uses the brokerage chosen on its sign-in screen (see ./workspace.ts); the web
// portal and an iPad app with no choice yet use the brokerage of this address, then the build's server.
export const SERVER_URL: string =
  nativeWorkspaceServer() || clean(RT.server_url) || FROM_HOST?.server || clean(import.meta.env.VITE_API_URL) || clean(import.meta.env.VITE_API_BASE_URL) || clean(import.meta.env.VITE_BF_API_URL) || DEV.server;

export const CLIENT_URL: string = clean(RT.client_url) || FROM_HOST?.client || clean(import.meta.env.VITE_CLIENT_APP_URL) || DEV.client;

export const WEBSITE_URL: string = clean(import.meta.env.VITE_WEBSITE_URL) || CLIENT_URL;

// Where clients, referrers and lenders write for help. Each copy sets VITE_SUPPORT_EMAIL; the development copy uses
// the Keystone operations mailbox.
export const SUPPORT_EMAIL: string = String(import.meta.env.VITE_SUPPORT_EMAIL ?? "").trim() || "support@keystonecrm.online";

/** Host name only, e.g. for "sign in at <host>". */
export const hostOf = (url: string): string => url.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
