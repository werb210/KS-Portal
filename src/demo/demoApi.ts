// KS_PORTAL_v8_DEMO / KS_PORTAL_v11_LIVE_DEMO - talking to the demo. The magic link (#d=<id>&t=<token>) is exchanged
// at KS-Ops for a session on the shared demo server (POST /api/public/demo/open). The demo never waits for that: the
// tours run on sample data in the browser, and only the final "Send to lenders" needs the session. The link and the
// session are kept in this browser (sessionStorage + localStorage "ks_live_demo_v1") so the prospect can come back.
import { LIVE_DEMO_STORE_KEY } from "./mode";

export type DemoSessionInfo = {
  server_url: string;
  staff_token: string;
  client_url: string | null;
  expires_at: string;
  name: string;
  company: string;
};

export type DemoLink = { demoId: string; token: string };
export type StoredDemo = { link: DemoLink | null; session: DemoSessionInfo | null };

export class DemoApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function opsUrl(): string {
  return String(import.meta.env.VITE_KS_OPS_URL ?? "").trim().replace(/\/+$/, "");
}

/** d and t from "#d=<id>&t=<token>" (the magic link), or null. */
export function parseMagicLink(hash: string): DemoLink | null {
  const params = new URLSearchParams(String(hash ?? "").replace(/^#/, ""));
  const demoId = params.get("d") ?? "";
  const token = params.get("t") ?? "";
  return demoId && token ? { demoId, token } : null;
}

function validSession(s: unknown, now: number): DemoSessionInfo | null {
  const v = s as DemoSessionInfo | null;
  if (!v?.staff_token || !v?.server_url) return null;
  const exp = new Date(v.expires_at).getTime();
  return Number.isFinite(exp) && exp <= now ? null : v;
}

function validLink(l: unknown): DemoLink | null {
  const v = l as DemoLink | null;
  return v?.demoId && v?.token ? { demoId: String(v.demoId), token: String(v.token) } : null;
}

/** The stored link and session (this tab's copy first, then this browser's). Expired sessions are dropped. */
export function readStored(now = Date.now()): StoredDemo {
  const out: StoredDemo = { link: null, session: null };
  for (const get of [() => window.sessionStorage, () => window.localStorage]) {
    try {
      const raw = get().getItem(LIVE_DEMO_STORE_KEY);
      if (!raw) continue;
      const v = JSON.parse(raw) as Partial<StoredDemo>;
      out.link ??= validLink(v.link);
      out.session ??= validSession(v.session, now);
    } catch {
      /* private mode or a damaged copy */
    }
  }
  return out;
}

export function writeStored(s: StoredDemo): void {
  const raw = JSON.stringify({ link: s.link, session: s.session });
  for (const get of [() => window.sessionStorage, () => window.localStorage]) {
    try {
      get().setItem(LIVE_DEMO_STORE_KEY, raw);
    } catch {
      /* private mode: the copy in memory is enough for this tab */
    }
  }
}

async function readError(r: Response): Promise<DemoApiError> {
  let body: { error?: string; message?: string } = {};
  try {
    body = await r.json();
  } catch {
    /* not JSON */
  }
  return new DemoApiError(r.status, body.error ?? `status_${r.status}`, body.message ?? "Something went wrong. Please try again.");
}

export async function openDemo(link: DemoLink, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<DemoSessionInfo> {
  const base = opsUrl();
  if (!base) throw new DemoApiError(503, "demo_not_configured", "The demo is not set up on this site yet.");
  const r = await fetchImpl(`${base}/api/public/demo/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ demo_id: link.demoId, token: link.token }),
    signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(45_000) : undefined,
  });
  if (!r.ok) throw await readError(r);
  return (await r.json()) as DemoSessionInfo;
}

/** Worth trying again: the demo server is starting up (KS-Ops answers 503/502/504) or the request timed out. */
export function isRetryable(err: unknown): boolean {
  if (!(err instanceof DemoApiError)) return true; // network error or timeout
  return [502, 503, 504].includes(err.status) && err.code !== "demo_not_configured";
}

// ---------------------------------------------------------------- the session keeper
// One per page. The shell starts it in the background; the broker side's Send waits on it (up to ~90 s).

export type KeeperStatus = "no_link" | "idle" | "opening" | "waking" | "ready" | "failed";
export type KeeperState = { status: KeeperStatus; link: DemoLink | null; session: DemoSessionInfo | null; attempt: number; error: string | null };

type KeeperDeps = { fetchImpl: typeof fetch; sleep: (ms: number) => Promise<void>; now: () => number };
const defaultDeps = (): KeeperDeps => ({
  fetchImpl: (...a) => fetch(...a),
  sleep: (ms) => new Promise<void>((r) => setTimeout(r, ms)),
  now: () => Date.now(),
});

let deps: KeeperDeps = defaultDeps();
let state: KeeperState = { status: "idle", link: null, session: null, attempt: 0, error: null };
let inflight: Promise<DemoSessionInfo | null> | null = null;
let inflightDeadline = 0;
const listeners = new Set<(s: KeeperState) => void>();

function set(patch: Partial<KeeperState>): void {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

export function getKeeper(): KeeperState {
  return state;
}

export function subscribeKeeper(fn: (s: KeeperState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Tests only. */
export function __resetKeeper(over: Partial<KeeperDeps> = {}): void {
  deps = { ...defaultDeps(), ...over };
  state = { status: "idle", link: null, session: null, attempt: 0, error: null };
  inflight = null;
  inflightDeadline = 0;
  listeners.clear();
}

/**
 * Load the stored link/session and take a new magic link from the address (it wins over a stored one, then the hash
 * is stripped so the token is not left in the address bar or history).
 */
export function initKeeper(loc: { hash: string; pathname: string; search: string } = window.location): KeeperState {
  const stored = readStored(deps.now());
  const fromHash = parseMagicLink(loc.hash);
  let link = stored.link;
  let session = stored.session;
  if (fromHash) {
    if (!link || link.demoId !== fromHash.demoId || link.token !== fromHash.token) session = null;
    link = fromHash;
    writeStored({ link, session });
    try {
      window.history.replaceState(window.history.state, "", `${loc.pathname}${loc.search}`);
    } catch {
      /* not fatal */
    }
  }
  set({ link, session, status: session ? "ready" : link ? "idle" : "no_link", error: null });
  return state;
}

/**
 * Open the session (KS-Ops /open), retrying while the demo server wakes up, until `deadlineMs` from now. Resolves
 * null when there is no link or it gave up; never throws. A second call while one is running joins it (and extends
 * its deadline).
 */
export function ensureSession(deadlineMs = 180_000): Promise<DemoSessionInfo | null> {
  if (state.session) return Promise.resolve(state.session);
  if (!state.link) {
    set({ status: "no_link" });
    return Promise.resolve(null);
  }
  inflightDeadline = Math.max(inflightDeadline, deps.now() + deadlineMs);
  if (inflight) return inflight;
  const link = state.link;
  inflight = (async () => {
    let attempt = 0;
    set({ status: "opening", error: null });
    for (;;) {
      attempt += 1;
      set({ attempt });
      try {
        const session = await openDemo(link, deps.fetchImpl);
        writeStored({ link, session });
        set({ session, status: "ready", error: null });
        return session;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!isRetryable(err)) {
          set({ status: "failed", error: msg });
          return null;
        }
        if (deps.now() >= inflightDeadline) {
          set({ status: "failed", error: "The demo server did not answer in time." });
          return null;
        }
        set({ status: "waking", error: null });
        await deps.sleep(Math.min(15_000, 4_000 * attempt));
      }
    }
  })().finally(() => {
    inflight = null;
    inflightDeadline = 0;
  });
  return inflight;
}

/** For the final Send: the session, waiting (and retrying) up to `timeoutMs`. Throws a DemoApiError when it cannot. */
export async function waitForSession(timeoutMs = 90_000): Promise<DemoSessionInfo> {
  if (state.session) return state.session;
  if (!state.link) throw new DemoApiError(400, "no_demo_link", "Open your demo from the text or email we sent, then try again.");
  if (state.status === "failed") set({ status: "idle" });
  const s = await ensureSession(timeoutMs);
  if (s) return s;
  throw new DemoApiError(503, "demo_unavailable", state.error ?? "The demo server did not answer in time.");
}

// ---------------------------------------------------------------- the demo server (KS-server in DEMO_MODE)

export type GuidedSubmitBody = { accepted: string[]; rejected: string[]; lenders: string[]; call_answered: boolean };
export type GuidedSubmitResult = { submitted_at: string | null; emailed_to: string | null; lenders: string[]; already?: boolean };

const base = (s: Pick<DemoSessionInfo, "server_url">) => s.server_url.replace(/\/+$/, "");

/** POST /api/demo/staff/guided-submit. 409 (already submitted) counts as success. */
export async function guidedSubmit(s: DemoSessionInfo, body: GuidedSubmitBody, fetchImpl: typeof fetch): Promise<GuidedSubmitResult> {
  const r = await fetchImpl(`${base(s)}/api/demo/staff/guided-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.staff_token}` },
    body: JSON.stringify(body),
  });
  if (r.status === 409) {
    let j: Partial<GuidedSubmitResult> = {};
    try {
      j = await r.json();
    } catch {
      /* no body */
    }
    return { submitted_at: j.submitted_at ?? null, emailed_to: j.emailed_to ?? null, lenders: Array.isArray(j.lenders) ? j.lenders : body.lenders, already: true };
  }
  if (!r.ok) throw await readError(r);
  const j = (await r.json()) as Partial<GuidedSubmitResult>;
  return { submitted_at: j.submitted_at ?? null, emailed_to: j.emailed_to ?? null, lenders: Array.isArray(j.lenders) ? j.lenders : body.lenders };
}

/** GET /api/demo/samples/:key - the deterministic sample PDF (public). */
export async function fetchSamplePdf(s: DemoSessionInfo, key: string, fetchImpl: typeof fetch): Promise<Blob> {
  const r = await fetchImpl(`${base(s)}/api/demo/samples/${encodeURIComponent(key)}`);
  if (!r.ok) throw await readError(r);
  const blob = await r.blob();
  if (blob.size < 64) throw new DemoApiError(502, "empty_sample", "The sample file was empty.");
  return blob;
}

/** POST /api/demo/staff/track - click analytics; never throws. */
export async function trackDemo(s: DemoSessionInfo, name: string, step: string | undefined, fetchImpl: typeof fetch): Promise<void> {
  if (!/^[a-z0-9_]{1,40}$/.test(name)) return;
  try {
    await fetchImpl(`${base(s)}/api/demo/staff/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.staff_token}` },
      body: JSON.stringify(step ? { name, step } : { name }),
    });
  } catch {
    /* analytics only */
  }
}
