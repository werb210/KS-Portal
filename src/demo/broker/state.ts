// KS_PORTAL_v11_LIVE_DEMO - what the prospect has done on the broker side (documents accepted, credit summary
// submitted, the call, notes, lenders sent). The fetch shim reads and writes it; it is kept in sessionStorage so a
// reload carries on where it was.
import { DOCS } from "./fixture";

export type DocDecision = { status: "pending" | "accepted" | "rejected"; displayName: string | null; reason: string | null; decidedAt: string | null };
export type DemoNote = { id: string; body: string; owner_name: string; created_at: string };
export type Submission = { submitted_at: string | null; emailed_to: string | null; lenders: string[]; already?: boolean };

export type BrokerDemoState = {
  startedAt: string;
  stage: string;
  docs: Record<string, DocDecision>;
  creditSummary: { status: "draft" | "submitted"; submitted_at: string | null; submitted_by_name: string | null };
  callAnswered: boolean;
  callDone: boolean;
  notes: DemoNote[];
  sent: Array<{ lenderId: string; sentAt: string }>;
  submission: Submission | null;
};

const KEY = "ks_live_demo_state_v1";

export function freshState(now = new Date()): BrokerDemoState {
  const docs: Record<string, DocDecision> = {};
  for (const d of DOCS) docs[d.id] = { status: "pending", displayName: null, reason: null, decidedAt: null };
  return {
    startedAt: now.toISOString(),
    stage: "Received",
    docs,
    creditSummary: { status: "draft", submitted_at: null, submitted_by_name: null },
    callAnswered: false,
    callDone: false,
    notes: [],
    sent: [],
    submission: null,
  };
}

let state: BrokerDemoState | null = null;

function load(): BrokerDemoState {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as BrokerDemoState;
      if (v && v.docs && typeof v.stage === "string") return { ...freshState(), ...v };
    }
  } catch {
    /* start fresh */
  }
  return freshState();
}

export function getState(): BrokerDemoState {
  state ??= load();
  return state;
}

export function updateState(fn: (s: BrokerDemoState) => void): BrokerDemoState {
  const s = getState();
  fn(s);
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* memory only */
  }
  return s;
}

export function resetState(): void {
  state = freshState();
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Sample keys of the documents with the given decision. */
export function keysWith(status: DocDecision["status"]): string[] {
  const s = getState();
  return DOCS.filter((d) => s.docs[d.id]?.status === status).map((d) => d.key);
}
