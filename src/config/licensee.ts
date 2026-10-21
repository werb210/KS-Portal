// KS_PORTAL_v1_LICENSEE - the web addresses of this copy of Keystone.
// KS-Portal was copied from BF-portal, which wrote Boreal's addresses (server/client/www.boreal.financial) into the
// code. Each Keystone copy sets its own at build time (VITE_API_URL, VITE_CLIENT_APP_URL, VITE_WEBSITE_URL); when one
// is missing, the Keystone development copy's address is used - never Boreal's.
const DEV = {
  server: "https://ks-server-dev-chb5htbwaue2hygk.canadacentral-01.azurewebsites.net",
  client: "https://wonderful-island-0b68ae310.5.azurestaticapps.net",
};

const clean = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return /^https?:\/\/[^\s/]+/i.test(s) ? s.replace(/\/+$/, "") : "";
};

export const SERVER_URL: string =
  clean(import.meta.env.VITE_API_URL) || clean(import.meta.env.VITE_API_BASE_URL) || clean(import.meta.env.VITE_BF_API_URL) || DEV.server;

export const CLIENT_URL: string = clean(import.meta.env.VITE_CLIENT_APP_URL) || DEV.client;

export const WEBSITE_URL: string = clean(import.meta.env.VITE_WEBSITE_URL) || CLIENT_URL;

// Where clients, referrers and lenders write for help. Each copy sets VITE_SUPPORT_EMAIL; the development copy uses
// the Keystone operations mailbox.
export const SUPPORT_EMAIL: string = String(import.meta.env.VITE_SUPPORT_EMAIL ?? "").trim() || "keystone@boreal.financial";

/** Host name only, e.g. for "sign in at <host>". */
export const hostOf = (url: string): string => url.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
