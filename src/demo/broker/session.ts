// KS_PORTAL_v11_LIVE_DEMO - entering and leaving the broker side. The portal signs in with a fake staff token
// (unsigned; a fixed demo id that no real server accepts) that only the in-browser shim ever sees. A real staff
// token already in this browser is put aside and restored on exit, so trying the demo never signs a staffer out.
import { AUTH_STORAGE_KEY } from "@/lib/authToken";
import { DEMO_STAFF_ID, LIVE_DEMO_MODE_KEY, isDemoStaffToken } from "../mode";

const SAVED_AUTH_KEY = "ks_live_demo_saved_auth";
const BRAND_CACHE_KEY = "ks_brand_v1";
const STATE_KEYS = ["ks_live_demo_state_v1", "ks_live_demo_tour_v1"];

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/=+$/, "");

/** The fake staff JWT: role Staff, silo BF, expires in 2100. Its signature is not valid on purpose. */
export function fakeStaffToken(name: string): string {
  const header = b64(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64(JSON.stringify({ sub: DEMO_STAFF_ID, role: "Staff", name: name || "Demo broker", silo: "BF", silos: ["BF"], live_demo: true, exp: 4_102_444_800 }));
  return `${header}.${payload}.live-demo`;
}

function local(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function enterBrokerAuth(name: string): void {
  const ls = local();
  if (!ls) return;
  const current = ls.getItem(AUTH_STORAGE_KEY);
  if (current && !isDemoStaffToken(current) && !ls.getItem(SAVED_AUTH_KEY)) ls.setItem(SAVED_AUTH_KEY, current);
  ls.setItem(AUTH_STORAGE_KEY, fakeStaffToken(name));
  try {
    window.sessionStorage.setItem("staff-portal.business-unit", "BF");
    window.sessionStorage.setItem("staff-portal.silo", "BF");
  } catch {
    /* defaults to BF anyway */
  }
}

/** Put back whatever token the browser had before the demo (or nothing). */
export function restoreRealAuth(): void {
  const ls = local();
  if (!ls) return;
  const saved = ls.getItem(SAVED_AUTH_KEY);
  if (isDemoStaffToken(ls.getItem(AUTH_STORAGE_KEY))) ls.removeItem(AUTH_STORAGE_KEY);
  if (saved) ls.setItem(AUTH_STORAGE_KEY, saved);
  ls.removeItem(SAVED_AUTH_KEY);
}

/** Normal portal boot: a demo token left behind (tab closed mid-demo) is never used against the real server. */
export function clearLeftoverDemoAuth(): void {
  const ls = local();
  if (!ls || !isDemoStaffToken(ls.getItem(AUTH_STORAGE_KEY))) return;
  restoreRealAuth();
  ls.removeItem(BRAND_CACHE_KEY);
}

export function requestBrokerMode(): void {
  try {
    window.sessionStorage.setItem(LIVE_DEMO_MODE_KEY, "broker");
  } catch {
    /* the shell falls back to a full navigation with ?broker=1 */
  }
}

/** Leave the demo: back to the real sign-in state, and a fresh broker tour next time. */
export function exitLiveDemo(to = "/demo"): void {
  try {
    window.sessionStorage.removeItem(LIVE_DEMO_MODE_KEY);
    for (const k of STATE_KEYS) window.sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
  restoreRealAuth();
  local()?.removeItem(BRAND_CACHE_KEY);
  window.location.assign(to);
}
