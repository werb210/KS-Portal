// KS_PORTAL_v11_LIVE_DEMO - which demo experience this tab runs. main.tsx reads this before anything boots:
//   /demo (and /demo/...)                      -> the phase-1 shell (phone frame + the client app's /tour)
//   any other path with the broker mode set    -> the REAL portal on sample data (src/demo/broker/bootBroker.tsx)
//   otherwise                                  -> the normal portal
// Kept tiny on purpose: main.tsx imports it statically.

export const LIVE_DEMO_MODE_KEY = "ks_live_demo_mode";
export const LIVE_DEMO_STORE_KEY = "ks_live_demo_v1";
/** The fixed staff id inside the fake (unsigned) demo token. Never a real user. */
export const DEMO_STAFF_ID = "6b1d5c3e-2f4a-4e8b-9c7d-0a1b2c3d4e5f";

export function isDemoPath(pathname: string): boolean {
  return pathname === "/demo" || pathname.startsWith("/demo/");
}

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

/** The tab asked for the broker side of the demo (set when the client tour finishes). */
export function brokerModeRequested(): boolean {
  return read(() => window.sessionStorage, LIVE_DEMO_MODE_KEY) === "broker";
}

/** A demo link or opened session is stored in this browser (the broker side needs one to send the package). */
export function hasStoredDemo(): boolean {
  for (const raw of [read(() => window.sessionStorage, LIVE_DEMO_STORE_KEY), read(() => window.localStorage, LIVE_DEMO_STORE_KEY)]) {
    if (!raw) continue;
    try {
      const v = JSON.parse(raw) as { link?: { demoId?: string; token?: string } | null; session?: { staff_token?: string } | null };
      if ((v?.link?.demoId && v.link.token) || v?.session?.staff_token) return true;
    } catch {
      /* ignore a damaged copy */
    }
  }
  return false;
}

/** True while the broker side of the live demo is running in this page (set by bootBroker before the first render). */
export function isLiveDemo(): boolean {
  return (globalThis as { __KS_LIVE_DEMO__?: boolean }).__KS_LIVE_DEMO__ === true;
}

export function markLiveDemo(on: boolean): void {
  (globalThis as { __KS_LIVE_DEMO__?: boolean }).__KS_LIVE_DEMO__ = on;
}

/** The sub of a JWT-shaped token, or null. */
export function tokenSubject(token: string | null | undefined): string | null {
  try {
    const part = String(token ?? "").split(".")[1];
    if (!part) return null;
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json?.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

export function isDemoStaffToken(token: string | null | undefined): boolean {
  return tokenSubject(token) === DEMO_STAFF_ID;
}
