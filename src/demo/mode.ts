// KS_PORTAL_v11_LIVE_DEMO - which demo experience this tab runs. main.tsx reads this before anything boots:
//   /demo (and /demo/...)                      -> the phase-1 shell (phone frame + the client app's /tour)
//   any other path with the broker mode set    -> the REAL portal on sample data (src/demo/broker/bootBroker.tsx)
//   otherwise                                  -> the normal portal
// Kept tiny on purpose: main.tsx imports it statically.

export const LIVE_DEMO_MODE_KEY = "ks_live_demo_mode";
export const LIVE_DEMO_STORE_KEY = "ks_live_demo_v1";
/** The fixed staff id inside the fake (unsigned) demo token. Never a real user. */
export const DEMO_STAFF_ID = "6b1d5c3e-2f4a-4e8b-9c7d-0a1b2c3d4e5f";

// KS_PORTAL_v13_PHONE_DEMO - /demo/broker: the broker side on a phone (the real portal zoomed like a camera).
export const PHONE_BROKER_PATH = "/demo/broker";

export function isPhoneBrokerPath(pathname: string): boolean {
  return /^\/demo\/broker\/?$/.test(pathname);
}

/** This page is the portal inside the phone page's camera frame (same origin, framed by /demo/broker). */
export function framedByPhoneBroker(win: Window = window): boolean {
  try {
    if (win.parent === win) return false;
    return win.parent.location.origin === win.location.origin && isPhoneBrokerPath(win.parent.location.pathname);
  } catch {
    return false;
  }
}

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

// ---------------------------------------------------------------- KS_PORTAL_v12_PRESENTER
// /demo/present is the staff "presenter mode" demo: the same sample data and shims with no tour, for a salesperson to
// drive live. It opens only with a presenter link from KS-Ops (checked there); the checked link is kept in this tab.
export const PRESENTER_MODE = "presenter";
export const PRESENTER_STORE_KEY = "ks_live_demo_presenter_v1";

export function isPresenterPath(pathname: string): boolean {
  return /^\/demo\/present\/?$/.test(pathname);
}

/** The tab asked for the presenter-mode portal (set when the presenter presses Start). */
export function presenterModeRequested(): boolean {
  return read(() => window.sessionStorage, LIVE_DEMO_MODE_KEY) === PRESENTER_MODE;
}

export type PresenterStore = {
  token: string;
  expiresAt: string;
  verifiedAt: string | null;
  presenterName: string | null;
  prospect: { name: string; company: string } | null;
};

export function readPresenter(now = Date.now()): PresenterStore | null {
  const raw = read(() => window.sessionStorage, PRESENTER_STORE_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as PresenterStore;
    if (!v?.token || typeof v.token !== "string") return null;
    const exp = new Date(v.expiresAt).getTime();
    if (Number.isFinite(exp) && exp <= now) return null;
    return v;
  } catch {
    return null;
  }
}

export function writePresenter(v: PresenterStore | null): void {
  try {
    if (v) window.sessionStorage.setItem(PRESENTER_STORE_KEY, JSON.stringify(v));
    else window.sessionStorage.removeItem(PRESENTER_STORE_KEY);
  } catch {
    /* private mode: the presenter page asks again */
  }
}

/** A checked, unexpired presenter link with a prospect entered: the presenter portal may boot. */
export function hasPresenterSession(): boolean {
  const v = readPresenter();
  return Boolean(v?.verifiedAt && v.prospect);
}

/** True while the presenter-mode portal runs in this page. */
export function isPresenterDemo(): boolean {
  return (globalThis as { __KS_PRESENTER_DEMO__?: boolean }).__KS_PRESENTER_DEMO__ === true;
}

export function markPresenterDemo(on: boolean): void {
  (globalThis as { __KS_PRESENTER_DEMO__?: boolean }).__KS_PRESENTER_DEMO__ = on;
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
