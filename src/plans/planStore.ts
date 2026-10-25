// KS_PORTAL_v3_PLANS - which plan this licensee is on, its 14-day trial, and which features are switched on.
// Loaded from GET /api/plan after sign-in, refreshed when the window regains focus and after a trial starts.
// Same pattern as src/config/brand.ts: a small store read through useSyncExternalStore.
//
// Safety rule: until the server answers - and whenever it answers 404 or cannot be reached - the portal behaves as
// Pro with no trial, so nothing is ever locked by mistake. Nothing here throws.
import { useEffect, useSyncExternalStore } from "react";
import { api } from "@/api";
import { FEATURES, featureInfo, isPlanKey, planRank, type PlanKey } from "@/plans/catalogue";

export type TrialStatus = "available" | "active" | "used" | "not_offered";

export type PlanState = {
  /** "server" once GET /api/plan answered; "fallback" before that or when it is unavailable (everything unlocked). */
  source: "server" | "fallback";
  plan: PlanKey;
  effective_plan: PlanKey;
  trial: { status: TrialStatus; started_at: string | null; ends_at: string | null; days_left: number | null };
  features: Record<string, boolean>;
  catalogue: Array<{ key: string; label: string; plan: PlanKey }>;
  allowances: {
    minutes_per_seat: number | null;
    texts_per_seat: number | null;
    assistant_chats: number | null;
    trial_bonus_minutes: number;
    trial_bonus_texts: number;
    /** KS_PORTAL_v3_STORAGE - document storage per seat, pooled across the brokerage. null = not reported. */
    storage_gb_per_seat: number | null;
  };
  trial_usage: Record<string, number>;
  /** KS_PORTAL_v3_STORAGE - pooled document storage; null when the server does not report it (then nothing is shown). */
  storage: { used_bytes: number; allowance_bytes: number; extra_blocks: number; seats: number | null; percent: number } | null;
  /** KS_PORTAL_v6_USAGE - this month's pooled usage; null when the server does not report it (then the card is hidden). */
  usage: PlanUsage | null;
  /** KS_PORTAL_BANK_CONNECT_ADDON - add-ons Keystone operations switched on for this licensee (only true ones).
   *  Not plan features: an add-on that is off is never shown, locked or offered. Empty in the fallback. */
  addons: Record<string, true>;
};

export type PlanUsage = {
  period: string;
  minutes: number;
  texts: number;
  assistant_chats: number;
  storage_bytes: number;
  /** Pooled totals for the period; null = unlimited (or not reported). */
  allowances: { minutes: number | null; texts: number | null; assistant_chats: number | null; storage_bytes: number | null };
  overage: { minutes: number; texts: number };
};

export function fallbackPlan(): PlanState {
  return {
    source: "fallback",
    plan: "pro",
    effective_plan: "pro",
    trial: { status: "not_offered", started_at: null, ends_at: null, days_left: null },
    features: {},
    catalogue: FEATURES.map(({ key, label, plan }) => ({ key, label, plan })),
    allowances: { minutes_per_seat: null, texts_per_seat: null, assistant_chats: null, trial_bonus_minutes: 0, trial_bonus_texts: 0, storage_gb_per_seat: null },
    trial_usage: {},
    storage: null,
    usage: null,
    addons: {},
  };
}

const TRIAL_STATUSES: TrialStatus[] = ["available", "active", "used", "not_offered"];
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Turn a GET /api/plan body into a PlanState. Returns null when the body is not a plan at all. */
export function normalizePlan(raw: unknown): PlanState | null {
  const r = obj(raw);
  if (r.ok === false || !isPlanKey(r.plan)) return null;
  const plan = r.plan;
  const effective = isPlanKey(r.effective_plan) ? r.effective_plan : plan;
  const t = obj(r.trial);
  const status = TRIAL_STATUSES.includes(t.status as TrialStatus) ? (t.status as TrialStatus) : "not_offered";
  const features: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(obj(r.features))) if (typeof v === "boolean") features[k] = v;
  const fromServer = Array.isArray(r.catalogue)
    ? (r.catalogue as unknown[])
        .map(obj)
        .filter((c) => typeof c.key === "string" && isPlanKey(c.plan))
        .map((c) => ({ key: String(c.key), label: str(c.label) ?? featureInfo(String(c.key))?.label ?? String(c.key), plan: c.plan as PlanKey }))
    : [];
  const known = new Set(fromServer.map((c) => c.key));
  const catalogue = [...fromServer, ...FEATURES.filter((f) => !known.has(f.key)).map(({ key, label, plan: p }) => ({ key, label, plan: p }))];
  const a = obj(r.allowances);
  const usage: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(r.trial_usage))) {
    const n = num(v);
    if (n !== null && n > 0) usage[k] = n;
  }
  return {
    source: "server",
    plan,
    effective_plan: effective,
    trial: { status, started_at: str(t.started_at), ends_at: str(t.ends_at), days_left: num(t.days_left) },
    features,
    catalogue,
    allowances: {
      minutes_per_seat: num(a.minutes_per_seat),
      texts_per_seat: num(a.texts_per_seat),
      assistant_chats: num(a.assistant_chats),
      trial_bonus_minutes: num(a.trial_bonus_minutes) ?? 0,
      trial_bonus_texts: num(a.trial_bonus_texts) ?? 0,
      storage_gb_per_seat: num(a.storage_gb_per_seat),
    },
    trial_usage: usage,
    storage: normalizeStorage(r.storage),
    usage: normalizeUsage(r.usage),
    addons: normalizeAddons(r.addons),
  };
}

/** KS_PORTAL_BANK_CONNECT_ADDON - GET /api/plan `addons`: keep only the keys that are exactly true. */
export function normalizeAddons(raw: unknown): Record<string, true> {
  const out: Record<string, true> = {};
  for (const [k, v] of Object.entries(obj(raw))) if (v === true) out[k] = true;
  return out;
}

/** KS_PORTAL_BANK_CONNECT_ADDON - is this add-on switched on? Off (and unknown, and the fallback) means hidden. */
export function hasAddon(key: string, state: PlanState = current): boolean {
  return state.source === "server" && state.addons?.[key] === true;
}

/** KS_PORTAL_v6_USAGE - GET /api/plan `usage`; null unless the used counts are numbers. */
export function normalizeUsage(raw: unknown): PlanUsage | null {
  const u = obj(raw);
  const minutes = num(u.minutes), texts = num(u.texts), chats = num(u.assistant_chats), storage = num(u.storage_bytes);
  if (minutes === null && texts === null && chats === null && storage === null) return null;
  const a = obj(u.allowances);
  const o = obj(u.overage);
  const nn = (v: number | null) => Math.max(0, v ?? 0);
  const allowance = (v: unknown) => { const x = num(v); return x === null || x < 0 ? null : x; };
  const al = { minutes: allowance(a.minutes), texts: allowance(a.texts), assistant_chats: allowance(a.assistant_chats), storage_bytes: allowance(a.storage_bytes) };
  const over = (used: number, server: number | null, cap: number | null) => Math.max(0, server ?? (cap === null ? 0 : used - cap));
  return {
    period: str(u.period) ?? "",
    minutes: nn(minutes),
    texts: nn(texts),
    assistant_chats: nn(chats),
    storage_bytes: nn(storage),
    allowances: al,
    overage: { minutes: over(nn(minutes), num(o.minutes), al.minutes), texts: over(nn(texts), num(o.texts), al.texts) },
  };
}

function normalizeStorage(raw: unknown): PlanState["storage"] {
  const s = obj(raw);
  const used = num(s.used_bytes);
  const allowance = num(s.allowance_bytes);
  if (used === null || allowance === null || allowance <= 0) return null;
  const pct = num(s.percent) ?? (used / allowance) * 100;
  return { used_bytes: Math.max(0, used), allowance_bytes: allowance, extra_blocks: Math.max(0, num(s.extra_blocks) ?? 0), seats: num(s.seats), percent: Math.max(0, pct) };
}

let current: PlanState = fallbackPlan();
const listeners = new Set<() => void>();

function setPlan(next: PlanState): void {
  current = next;
  for (const l of listeners) {
    try { l(); } catch { /* a listener's failure must not stop the others */ }
  }
}

export function getPlan(): PlanState { return current; }

/** The cheapest plan that includes a feature (server catalogue first, then the built-in one; unknown keys: starter). */
export function requiredPlan(key: string, state: PlanState = current): PlanKey {
  return state.catalogue.find((c) => c.key === key)?.plan ?? featureInfo(key)?.plan ?? "starter";
}

/** Whether this licensee can use a feature right now (trial included). Unknown keys and the fallback are allowed. */
export function hasFeature(key: string, state: PlanState = current): boolean {
  if (state.source !== "server") return true;
  const explicit = state.features[key];
  if (typeof explicit === "boolean") return explicit;
  return planRank(state.effective_plan) >= planRank(requiredPlan(key, state));
}

export function featureLabel(key: string, state: PlanState = current): string {
  if (!key) return "This feature";
  return state.catalogue.find((c) => c.key === key)?.label ?? featureInfo(key)?.label ?? key.replace(/_/g, " ");
}

const statusOf = (e: unknown): number | null => {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : null;
};

let inFlight: Promise<PlanState> | null = null;

/** Fetch GET /api/plan. 404 (server not updated yet) -> fallback. Other failures keep a server copy we already have. */
export function loadPlan(): Promise<PlanState> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const body = await api.get<unknown>("/api/plan");
      const next = normalizePlan(body);
      setPlan(next ?? fallbackPlan());
    } catch (e) {
      if (statusOf(e) === 404 || current.source !== "server") setPlan(fallbackPlan());
    } finally {
      inFlight = null;
    }
    return current;
  })();
  return inFlight;
}

const errorText = (e: unknown, fallback: string): string => {
  const d = obj((e as { details?: unknown } | null)?.details);
  const msg = str(d.message) ?? str(d.error);
  return msg && !/^[a-z_]+$/.test(msg) ? msg : fallback;
};

/** POST /api/plan/trial (Admin), then reload the plan. */
export async function startTrial(): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.post("/api/plan/trial", {});
    await loadPlan();
    return { ok: true };
  } catch (e) {
    const status = statusOf(e);
    void loadPlan();
    if (status === 409) return { ok: false, error: errorText(e, "The free trial is no longer available for your account.") };
    if (status === 403) return { ok: false, error: "Only an administrator can start the trial." };
    return { ok: false, error: errorText(e, "Could not start the trial. Please try again.") };
  }
}

/** POST /api/plan/upgrade-request (Admin). extraStorageBlocks asks for more 50 GB storage blocks on the same plan. */
export async function requestUpgrade(plan: PlanKey, extraStorageBlocks?: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.post("/api/plan/upgrade-request", extraStorageBlocks ? { plan, extra_storage_blocks: extraStorageBlocks } : { plan });
    return { ok: true };
  } catch (e) {
    if (statusOf(e) === 403) return { ok: false, error: "Only an administrator can request an upgrade." };
    return { ok: false, error: errorText(e, "Could not send the request. Please try again.") };
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React hook: the licensee's plan; re-renders when it loads or changes. */
/** "Growth and Pro feature" on Starter, "Pro feature" on Growth. */
export function trialFeaturesText(state: Pick<PlanState, "plan">): string {
  return state.plan === "growth" ? "Pro feature" : "Growth and Pro feature";
}

/** The trial offer in words, from the server's bonus allowances. */
export function trialOfferText(state: PlanState): string {
  const m = Number(state.allowances?.trial_bonus_minutes ?? 0), t = Number(state.allowances?.trial_bonus_texts ?? 0);
  const parts = [m > 0 ? `${m} bonus minutes` : "", t > 0 ? `${t} bonus texts` : ""].filter(Boolean);
  // KS_PORTAL_v14_TRIAL_GROWTH - the trial is offered on Starter and Growth; a Growth brokerage already has Growth.
  return `Try every ${trialFeaturesText(state)} free for 14 days${parts.length ? `, with ${parts.join(" and ")} per seat` : ""}.`;
}

export function usePlan(): PlanState {
  return useSyncExternalStore(subscribe, getPlan, getPlan);
}

/** KS_PORTAL_BANK_CONNECT_ADDON - React hook: true only while operations has switched the add-on on. */
export function useAddon(key: string): boolean {
  return hasAddon(key, usePlan());
}

const FOCUS_REFRESH_MS = 30_000;

/** Mount once in the signed-in layout: loads the plan, refreshes on window focus, resets on sign-out. */
export function usePlanBootstrap(signedIn: boolean): void {
  useEffect(() => {
    if (!signedIn) {
      if (current.source !== "fallback") setPlan(fallbackPlan());
      return;
    }
    let last = Date.now();
    void loadPlan();
    const onFocus = () => {
      if (Date.now() - last < FOCUS_REFRESH_MS) return;
      last = Date.now();
      void loadPlan();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [signedIn]);
}

/** Tests only. */
export function __setPlanForTests(next: PlanState | null): void {
  inFlight = null;
  setPlan(next ?? fallbackPlan());
}
