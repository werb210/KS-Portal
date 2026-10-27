// KS_PORTAL_SSO_API_KEYS - staff single sign-on (Pro). The sign-in page asks the server which providers this brokerage
// has switched on (GET /api/auth/sso/config, public) and shows a "Sign in with Microsoft / Google" button for each.
// A button is a full-page navigation to the server's /start, which goes to the provider and back to the server's
// callback; the server then returns here with a one-time code in the URL fragment (#sso_code=...), or ?sso_error=...
// The code is exchanged once (POST /api/auth/sso/exchange) for the same staff session token the text-code and passkey
// sign-ins give. These calls run before anyone is signed in, so - like the text-code start on this page - they use
// fetch directly (the api client refuses to send a request without a session).
import { API_BASE } from "@/config/api";
import { setAuthToken } from "@/lib/authToken";
import { captureRefreshToken } from "@/auth/sessionRefresh"; // KS_NATIVE_DESKTOP_v1_SLIDING_REFRESH

export type SsoProvider = "microsoft" | "google";
export type SsoConfig = { microsoft: boolean; google: boolean; require_sso: boolean };

export const SSO_OFF: SsoConfig = { microsoft: false, google: false, require_sso: false };

export const PROVIDER_LABEL: Record<SsoProvider, string> = { microsoft: "Microsoft", google: "Google" };

/** Which buttons to show. Anything other than a clear answer from the server means none (never a broken button). */
export async function fetchSsoConfig(fetchImpl: typeof fetch = fetch): Promise<SsoConfig> {
  try {
    const res = await fetchImpl(`${API_BASE}/api/auth/sso/config`, { headers: { Accept: "application/json" }, credentials: "include" });
    if (!res.ok) return SSO_OFF;
    const body = (await res.json()) as Partial<SsoConfig> | null;
    return { microsoft: body?.microsoft === true, google: body?.google === true, require_sso: body?.require_sso === true };
  } catch {
    return SSO_OFF;
  }
}

export function ssoStartUrl(provider: SsoProvider): string {
  return `${API_BASE}/api/auth/sso/${provider}/start`;
}

/** The one-time code from #sso_code=... and the reason from ?sso_error=..., if the server sent us back with one. */
export function readSsoReturn(loc: { hash: string; search: string }): { code: string | null; error: string | null } {
  const hash = new URLSearchParams(loc.hash.replace(/^#/, ""));
  const search = new URLSearchParams(loc.search);
  return { code: hash.get("sso_code"), error: search.get("sso_error") };
}

const SSO_ERROR_TEXT: Record<string, string> = {
  no_user: "That account isn't set up as a staff member here. Ask an admin to add your work email.",
  not_staff: "That account isn't a staff account. Ask an admin.",
  user_inactive: "This account has been switched off. Ask an admin.",
  ambiguous_email: "More than one staff account uses that email. Ask an admin to fix it.",
  email_not_verified: "Your provider didn't confirm that email address. Ask an admin to check the single sign-on settings.",
  wrong_tenant: "That Microsoft account belongs to a different organisation. Sign in with your work account.",
  wrong_domain: "That Google account isn't on your company's domain. Sign in with your work account.",
  sso_off: "Single sign-on isn't switched on for your company. Use your phone number instead.",
  rate_limited: "Too many sign-in attempts. Wait a few minutes and try again.",
};

export function ssoErrorText(reason: string | null | undefined): string {
  if (!reason) return "";
  return SSO_ERROR_TEXT[reason] ?? "Single sign-on didn't work. Please try again, or use your phone number.";
}

/** Exchanges the one-time code for the session token and stores it. Throws with a readable message when it fails. */
export async function exchangeSsoCode(code: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  let res: Response;
  try {
    res = await fetchImpl(`${API_BASE}/api/auth/sso/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    });
  } catch {
    throw new Error("Couldn't reach the server to finish signing in. Please try again.");
  }
  const body = (await res.json().catch(() => null)) as { data?: { token?: string; refreshToken?: string }; message?: string } | null;
  const token = body?.data?.token;
  if (!res.ok || !token) throw new Error(body?.message || "That sign-in link has expired. Please sign in again.");
  setAuthToken(token);
  captureRefreshToken(body);
}
