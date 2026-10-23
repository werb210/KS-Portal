// KS_PORTAL_v8_DEMO - talking to the demo. The magic link (#d=<id>&t=<token>) is exchanged at KS-Ops for a session on
// the shared demo server; after that every call goes to that server with the demo staff token. The session is kept in
// this browser (localStorage) so the prospect can come back to /demo and carry on until it expires.

export type DemoSessionInfo = {
  server_url: string;
  staff_token: string;
  client_url: string | null;
  expires_at: string;
  name: string;
  company: string;
};

export type Reason = { code: string; severity: "info" | "amber" | "red"; text: string };
export type CheckResult = { status: string; reasons: Reason[]; totals?: { deposits: number; withdrawals: number; transactions: number } | null };
export type DemoDocument = {
  id: string; sample_key: string; label: string; category: string; filename: string; size_bytes: number; uploaded_via: string;
  status: "pending" | "accepted" | "rejected"; reject_reason: string | null; fraud_status: string | null;
  tamper: CheckResult | null; statement_math: CheckResult | null; uploaded_at: string; decided_at: string | null;
};
export type LenderMatch = { id: string; name: string; product: string; rate: string; term: string; note: string; score: number; fit: "strong" | "possible" | "poor"; reasons: string[]; blockers: string[] };
export type FinancialYear = {
  year: number; revenue: number; cogs: number; gross_profit: number; operating_expenses: number; ebitda: number; depreciation: number;
  interest: number; net_income: number; total_assets: number; total_liabilities: number; equity: number; current_assets: number;
  current_liabilities: number; existing_debt_service: number;
};
export type CallLine = { at: number; speaker: "borrower" | "broker"; text: string };
export type CreditSummary = {
  built_at: string; headline: string;
  borrower: { legal_name: string; industry: string; years_in_business: number; location: string; owner: string };
  request: { amount: number; product: string; purpose: string; term_months: number };
  financial_snapshot: { year: number; revenue: number; revenue_growth_pct: number; ebitda: number; ebitda_margin_pct: number; net_income: number; current_ratio: number; debt_to_equity: number; assumed_rate_pct: number; proposed_payment_monthly: number; annual_debt_service_total: number; dscr: number };
  banking: { statements_used: string[]; avg_monthly_deposits: number | null; revenue_check: string };
  documents: { accepted: number; rejected: number; pending: number; missing: string[]; flagged: Array<{ label: string; status: string; decision: string; reasons: string[] }> };
  strengths: string[]; risks: string[]; conditions: string[]; recommendation: string;
};
export type Walkthrough = { current: string; completed: string[]; skipped: string[]; tour_skipped: boolean };

export type DemoState = {
  session: { name: string; company: string; email: string; created_at: string; expires_at: string; client_code: string; client_url: string | null; used_phone: boolean; used_screen: boolean; walkthrough: Walkthrough; completed_at: string | null };
  steps: Array<{ key: string; label: string }>;
  application: {
    id: string; status: string; business: Record<string, any>; contact: Record<string, any>; request: Record<string, any>;
    financials: { years: FinancialYear[]; prepared_by: string; basis: string }; financials_reviewed_at: string | null;
    credit_summary: CreditSummary | null; selected_lenders: string[];
    call: { status?: string; summary?: { headline: string; points: string[]; follow_up: string; sentiment: string }; transcript?: CallLine[]; completed_at?: string } | null;
    notes: Array<{ kind: string; at: string; author: string; body: string; points?: string[]; follow_up?: string }>;
    borrower_submitted_at: string | null; submitted_at: string | null; has_package: boolean;
  } | null;
  documents: DemoDocument[];
  expected_documents: Array<{ key: string; label: string }>;
  lenders: LenderMatch[];
  messages: Array<{ role: string; body: string; at: string }>;
  call_script: { lines: CallLine[]; duration_seconds: number };
  version: string;
};

const STORE_KEY = "ks_demo_session_v1";

export class DemoApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function opsUrl(): string {
  return String(import.meta.env.VITE_KS_OPS_URL ?? "").trim().replace(/\/+$/, "");
}

/** d and t from "#d=<id>&t=<token>" (the magic link), or null. */
export function parseMagicLink(hash: string): { demoId: string; token: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const demoId = params.get("d") ?? "";
  const token = params.get("t") ?? "";
  return demoId && token ? { demoId, token } : null;
}

export function loadStoredSession(now = Date.now()): DemoSessionInfo | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as DemoSessionInfo;
    if (!s?.staff_token || !s?.server_url || new Date(s.expires_at).getTime() <= now) return null;
    return s;
  } catch {
    return null;
  }
}

export function storeSession(s: DemoSessionInfo | null): void {
  try {
    if (s) window.localStorage.setItem(STORE_KEY, JSON.stringify(s));
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode: the session lasts as long as this tab */
  }
}

async function readError(r: Response): Promise<DemoApiError> {
  let body: { error?: string; message?: string } = {};
  try { body = await r.json(); } catch { /* not JSON */ }
  return new DemoApiError(r.status, body.error ?? `status_${r.status}`, body.message ?? "Something went wrong. Please try again.");
}

export async function openDemo(link: { demoId: string; token: string }, fetchImpl: typeof fetch = fetch): Promise<DemoSessionInfo> {
  const base = opsUrl();
  if (!base) throw new DemoApiError(503, "demo_not_configured", "The demo is not set up on this site yet.");
  const r = await fetchImpl(`${base}/api/public/demo/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ demo_id: link.demoId, token: link.token }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!r.ok) throw await readError(r);
  return (await r.json()) as DemoSessionInfo;
}

/** Worth trying again: the demo server is starting up (KS-Ops answers 503/502/504) or the request timed out. */
export function isRetryable(err: unknown): boolean {
  if (!(err instanceof DemoApiError)) return true; // network error or timeout
  return [502, 503, 504].includes(err.status) && err.code !== "demo_not_configured";
}

/**
 * openDemo, tried again while the demo server wakes up (a cold start takes a minute or two). onWaiting is called
 * before each retry so the page can say what is happening. Gives up after `attempts` tries.
 */
export async function openDemoWithRetry(
  link: { demoId: string; token: string },
  opts: { fetchImpl?: typeof fetch; attempts?: number; delayMs?: number; onWaiting?: (attempt: number) => void; sleep?: (ms: number) => Promise<void> } = {},
): Promise<DemoSessionInfo> {
  const attempts = opts.attempts ?? 6;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await openDemo(link, opts.fetchImpl ?? fetch);
    } catch (err) {
      last = err;
      if (!isRetryable(err) || i === attempts) break;
      opts.onWaiting?.(i);
      await sleep(opts.delayMs ?? 10_000);
    }
  }
  throw last;
}

export type DemoClient = ReturnType<typeof demoClient>;

/** Calls to the demo server for one session. */
export function demoClient(s: Pick<DemoSessionInfo, "server_url" | "staff_token">, fetchImpl: typeof fetch = fetch) {
  const base = s.server_url.replace(/\/+$/, "");
  const call = async <T>(path: string, init: RequestInit = {}, token = s.staff_token): Promise<T> => {
    const r = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: { ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    if (!r.ok) throw await readError(r);
    if (r.status === 204) return undefined as T;
    const type = r.headers.get("content-type") ?? "";
    return (type.includes("application/json") ? await r.json() : await r.blob()) as T;
  };
  const post = <T>(path: string, body: unknown = {}) => call<T>(path, { method: "POST", body: JSON.stringify(body) });
  return {
    state: () => call<DemoState>("/api/demo/staff/state"),
    opened: () => post<void>("/api/demo/staff/opened", { viewport: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : null }),
    walkthrough: (action: string, step?: string) => post<{ walkthrough: Walkthrough }>("/api/demo/staff/walkthrough", { action, step }),
    borrowerToken: () => post<{ client_token: string }>("/api/demo/staff/borrower-token"),
    decide: (id: string, decision: "accepted" | "rejected", reason?: string) => post<{ document: DemoDocument }>(`/api/demo/staff/documents/${encodeURIComponent(id)}/decision`, { decision, reason }),
    documentFile: (id: string) => call<Blob>(`/api/demo/staff/documents/${encodeURIComponent(id)}/file`),
    callAction: (action: "ring" | "answer" | "decline" | "complete") => post<{ call: unknown; script?: CallLine[] }>("/api/demo/staff/call", { action }),
    reviewFinancials: () => post<{ ok: boolean }>("/api/demo/staff/financials/review"),
    buildCreditSummary: () => post<{ credit_summary: CreditSummary }>("/api/demo/staff/credit-summary"),
    selectLenders: (ids: string[]) => post<{ selected_lenders: string[] }>("/api/demo/staff/lenders", { lender_ids: ids }),
    submit: () => post<{ submitted_at: string; emailed_to: string; lenders: string[] }>("/api/demo/staff/submit"),
    packagePdf: () => call<Blob>("/api/demo/staff/package"),
    track: (name: string, step?: string) => post<void>("/api/demo/staff/track", { name, step }).catch(() => undefined),
    heartbeat: (seconds: number) => post<void>("/api/demo/staff/heartbeat", { seconds }).catch(() => undefined),
    // The borrower, played on this screen (same calls the phone makes, with a borrower token).
    client: (clientToken: string) => ({
      state: () => call<BorrowerState>("/api/demo/client/state", {}, clientToken),
      sample: (key: string) => call<Blob>(`/api/demo/client/samples/${encodeURIComponent(key)}`, {}, clientToken),
      upload: (key: string, file: Blob, filename: string) => {
        const fd = new FormData();
        fd.set("sample_key", key);
        fd.set("via", "screen");
        fd.set("file", file, filename);
        return call<{ document: DemoDocument }>("/api/demo/client/documents", { method: "POST", body: fd }, clientToken);
      },
      submit: () => call<BorrowerState>("/api/demo/client/submit", { method: "POST", body: "{}" }, clientToken),
      ask: (message: string) => call<{ reply: string; messages: BorrowerState["messages"] }>("/api/demo/client/assistant", { method: "POST", body: JSON.stringify({ message }) }, clientToken),
    }),
  };
}

export type BorrowerState = {
  business: { name: string; industry: string }; contact: { name: string }; request: Record<string, any> | null;
  broker: { company: string; name: string };
  samples: Array<{ key: string; label: string; hint: string; filename: string; uploaded: boolean; status: string | null }>;
  messages: Array<{ role: string; body: string; at: string }>;
  assistant_remaining: number; borrower_submitted_at: string | null; lender_submitted_at: string | null;
};
