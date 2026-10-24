// KS_PORTAL_v12_PRESENTER - the staff presenter link. KS-Ops signs it for a signed-in Keystone operations user
// (POST /api/ops/demo/presenter-link, from the staff portal's "Start sales demo"), and it opens
// {portal}/demo/present#p=<token>. This page checks it with KS-Ops before anything starts:
//   POST {VITE_KS_OPS_URL}/api/public/demo/presenter/verify { token } -> 200 { ok, presenter: { name }, expires_at } | 401
// The token arrives in the fragment (never sent to a server by the browser) and is stripped from the address at once.
import { opsUrl } from "../demoApi";

export type PresenterCheck =
  | { ok: true; presenterName: string | null; expiresAt: string }
  | { ok: false; reason: "invalid" | "not_configured" | "unreachable"; message: string };

/** The token from "#p=<token>", or null. */
export function presenterTokenFromHash(hash: string): string | null {
  const t = new URLSearchParams(String(hash ?? "").replace(/^#/, "")).get("p") ?? "";
  return t.length >= 20 && t.length <= 4096 ? t : null;
}

export async function checkPresenterToken(token: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<PresenterCheck> {
  const base = opsUrl();
  if (!base) return { ok: false, reason: "not_configured", message: "The demo is not set up on this site yet (no KS-Ops address)." };
  let r: Response;
  try {
    r = await fetchImpl(`${base}/api/public/demo/presenter/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch {
    return { ok: false, reason: "unreachable", message: "Could not check your presenter link just now. Check the connection and try again." };
  }
  if (r.status === 401 || r.status === 400) {
    return { ok: false, reason: "invalid", message: "This presenter link is not valid or has expired. Open a new one from the staff portal." };
  }
  if (!r.ok) return { ok: false, reason: "unreachable", message: "Could not check your presenter link just now. Please try again." };
  let body: { presenter?: { name?: string | null }; expires_at?: string } = {};
  try {
    body = await r.json();
  } catch {
    /* treated as unreachable below */
  }
  if (!body.expires_at) return { ok: false, reason: "unreachable", message: "Could not check your presenter link just now. Please try again." };
  return { ok: true, presenterName: body.presenter?.name ?? null, expiresAt: body.expires_at };
}
