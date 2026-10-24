// KS_PORTAL_BETA_v1 - beta features (Labs). Keystone operations decides which betas exist and who is in them; the
// licensee's server keeps its own list and answers GET /api/beta/features. Same pattern as plans/planStore.ts: a
// small store read through useSyncExternalStore.
//
// Gate a code path with useBetaFlag("ai_call_notes") (or isBetaEnabled outside React). Until the server answers, and
// whenever it cannot be reached or does not know about betas yet (404), every beta is OFF. Nothing here throws.
import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/api";

export type BetaStatus = "private_beta" | "public_beta" | "ga";

export type BetaFeature = {
  key: string;
  name: string;
  description: string;
  status: BetaStatus;
  enabled: boolean;
  enrolled: boolean;
  can_join: boolean;
  can_leave: boolean;
  feedback_url: string | null;
  docs_url: string | null;
};

export type BetaState = { source: "server" | "fallback"; features: BetaFeature[] };

export const BETA_STATUS_LABEL: Record<BetaStatus, string> = {
  private_beta: "Private beta",
  public_beta: "Public beta",
  ga: "Now available",
};

const STATUSES: BetaStatus[] = ["private_beta", "public_beta", "ga"];
const KEY_RE = /^[a-z][a-z0-9_]{1,62}$/;
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const link = (v: unknown): string | null => (typeof v === "string" && /^https:\/\/\S+$/i.test(v) ? v : null);

/** GET /api/beta/features (or a join/leave answer) as a clean list. Unknown or retired items are dropped. */
export function normalizeBeta(raw: unknown): BetaFeature[] {
  const list = obj(raw).features;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: BetaFeature[] = [];
  for (const item of list) {
    const r = obj(item);
    const key = text(r.key, 63);
    if (!KEY_RE.test(key) || seen.has(key) || !STATUSES.includes(r.status as BetaStatus)) continue;
    seen.add(key);
    out.push({
      key,
      name: text(r.name, 120) || key,
      description: text(r.description, 2000),
      status: r.status as BetaStatus,
      enabled: r.enabled === true,
      enrolled: r.enrolled === true,
      can_join: r.can_join === true,
      can_leave: r.can_leave === true,
      feedback_url: link(r.feedback_url),
      docs_url: link(r.docs_url),
    });
  }
  return out;
}

const fallback = (): BetaState => ({ source: "fallback", features: [] });
let current: BetaState = fallback();
const listeners = new Set<() => void>();

function setBeta(next: BetaState): void {
  current = next;
  for (const l of listeners) {
    try { l(); } catch { /* a listener's failure must not stop the others */ }
  }
}

export function getBeta(): BetaState { return current; }

/** Is this beta on for the licensee? Off until the server says so. */
export function isBetaEnabled(key: string, state: BetaState = current): boolean {
  return state.features.some((f) => f.key === key && f.enabled);
}

const statusOf = (e: unknown): number | null => {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : null;
};

const errorText = (e: unknown, fallbackText: string): string => {
  const d = obj((e as { details?: unknown } | null)?.details);
  const msg = typeof d.message === "string" && d.message.trim() ? d.message : "";
  return msg && !/^[a-z_]+$/.test(msg) ? msg : fallbackText;
};

let inFlight: Promise<BetaState> | null = null;
let loadedOnce = false;

/** Fetch GET /api/beta/features. 404 -> off. Other failures keep a server copy we already have. */
export function loadBeta(): Promise<BetaState> {
  if (inFlight) return inFlight;
  loadedOnce = true;
  inFlight = (async () => {
    try {
      const body = await api.get<unknown>("/api/beta/features");
      setBeta({ source: "server", features: normalizeBeta(body) });
    } catch (e) {
      if (statusOf(e) === 404 || current.source !== "server") setBeta(fallback());
    } finally {
      inFlight = null;
    }
    return current;
  })();
  return inFlight;
}

export type BetaActionResult = { ok: true; status: string; message?: string } | { ok: false; error: string };

async function change(key: string, action: "join" | "leave"): Promise<BetaActionResult> {
  try {
    const body = await api.post<unknown>(`/api/beta/features/${encodeURIComponent(key)}/${action}`, {});
    setBeta({ source: "server", features: normalizeBeta(body) });
    const b = obj(body);
    return { ok: true, status: text(b.status, 40) || (action === "join" ? "joined" : "left"), message: text(b.message, 300) || undefined };
  } catch (e) {
    void loadBeta();
    if (statusOf(e) === 403) return { ok: false, error: "Only an administrator can change beta features." };
    return { ok: false, error: errorText(e, action === "join" ? "Could not join this beta. Please try again." : "Could not leave this beta. Please try again.") };
  }
}

/** POST /api/beta/features/:key/join (Admin). */
export const joinBeta = (key: string) => change(key, "join");
/** POST /api/beta/features/:key/leave (Admin). */
export const leaveBeta = (key: string) => change(key, "leave");

/** POST /api/beta/features/:key/feedback - sent to Keystone operations. */
export async function sendBetaFeedback(key: string, message: string, rating?: number | null): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.post(`/api/beta/features/${encodeURIComponent(key)}/feedback`, rating ? { message, rating } : { message });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorText(e, "Your feedback could not be sent. Please try again.") };
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React hook: the licensee's beta features; loads them the first time it is used. */
export function useBeta(): BetaState {
  const state = useSyncExternalStore(subscribe, getBeta, getBeta);
  useEffect(() => {
    if (!loadedOnce) void loadBeta();
  }, []);
  return state;
}

/** React hook: true only while this beta is on for the licensee. */
export function useBetaFlag(key: string): boolean {
  return isBetaEnabled(key, useBeta());
}

/** Tests only. */
export function __setBetaForTests(next: BetaState | null, markLoaded = true): void {
  inFlight = null;
  loadedOnce = markLoaded;
  setBeta(next ?? fallback());
}
