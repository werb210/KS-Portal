// KS_PORTAL_v11_LIVE_DEMO - the borrower's call, played through the portal's real dialer store: setIncoming() shows
// the real IncomingCallToast (and its ring); Answer - on the toast or in the tour - goes through the real
// answerIncoming(), which accepts the "pending call" below instead of a Twilio call (no Device, no microphone). The
// script's lines then land in the dialer's transcript and on the iPhone overlay; hanging up adds the AI call note.
import { answerIncoming, hangup } from "@/dialer/actions";
import { useDialer } from "@/dialer/store";
import { APP_ID, BUSINESS, CALL_DURATION_SECONDS, CALL_SCRIPT, CONTACT, REQUEST, callNoteBody, money, type CallLine } from "../fixture";
import { updateState } from "../state";

export type CallPhase = "idle" | "ringing" | "connected" | "ended" | "declined";
export type CallSimState = { phase: CallPhase; lines: CallLine[]; startedAt: number | null };

type Listener = (s: CallSimState) => void;
let state: CallSimState = { phase: "idle", lines: [], startedAt: null };
const listeners = new Set<Listener>();
let timers: Array<ReturnType<typeof setTimeout>> = [];

function set(patch: Partial<CallSimState>): void {
  state = { ...state, ...patch };
  for (const l of listeners) l(state);
}

export const getCall = (): CallSimState => state;
export function subscribeCall(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function clearTimers(): void {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

export const CALLER = {
  name: CONTACT.name,
  company: BUSINESS.operating_name,
  deal: `${money(REQUEST.amount)} equipment`,
  phone: CONTACT.phone,
};

function pushLine(line: CallLine): void {
  if (state.lines.includes(line)) return;
  set({ lines: [...state.lines, line] });
  useDialer.getState().appendTranscript({ pid: line.speaker, text: `${line.speaker === "broker" ? "You" : "Sam"}: ${line.text}`, final: true, ts: new Date().toISOString() });
}

function makePendingCall() {
  const handlers: Record<string, Array<() => void>> = {};
  return {
    parameters: { From: CONTACT.phone },
    customParameters: new Map<string, string>(),
    accept: () => onConnected(),
    reject: () => onDeclined(),
    ignore: () => onDeclined(),
    disconnect: () => {
      for (const fn of handlers.disconnect ?? []) fn();
      onEnded();
    },
    on: (event: string, fn: () => void) => {
      (handlers[event] ??= []).push(fn);
    },
    mute: () => undefined,
    isMuted: () => false,
    sendDigits: () => undefined,
    status: () => (state.phase === "connected" ? "open" : "pending"),
  };
}

/** Sam calls: the portal's own incoming-call toast rings, and the overlay shows the iPhone and the watch. */
export function ring(): void {
  if (state.phase === "ringing" || state.phase === "connected") return;
  clearTimers();
  set({ phase: "ringing", lines: [], startedAt: null });
  const d = useDialer.getState();
  d.clearTranscript();
  d.setCtx({ contactName: CONTACT.name, applicationName: `${BUSINESS.operating_name} - ${money(REQUEST.amount)} equipment`, applicationId: APP_ID, phone: CONTACT.phone, contactId: null });
  d.setIncoming({
    conferenceFriendly: "live-demo",
    fromDisplay: CONTACT.name,
    companyName: BUSINESS.legal_name,
    applicationName: `${money(REQUEST.amount)} equipment financing`,
    applicationId: APP_ID,
    contactId: null,
    phone: null,
    pendingCall: makePendingCall(),
  });
}

/** The tour's Answer: the same path as the toast's Answer button. */
export async function answer(): Promise<void> {
  if (state.phase !== "ringing") return;
  await answerIncoming();
}

function onConnected(): void {
  const startedAt = Date.now();
  set({ phase: "connected", startedAt, lines: [] });
  updateState((s) => {
    s.callAnswered = true;
  });
  const d = useDialer.getState();
  d.setCtx({ contactName: CONTACT.name, applicationName: `${BUSINESS.operating_name} - ${money(REQUEST.amount)} equipment`, applicationId: APP_ID, phone: CONTACT.phone, contactId: null });
  for (const line of CALL_SCRIPT) timers.push(setTimeout(() => pushLine(line), line.at * 1000 + 600));
  timers.push(setTimeout(() => void finish(), CALL_DURATION_SECONDS * 1000));
}

function onDeclined(): void {
  clearTimers();
  useDialer.getState().setIncoming(null);
  set({ phase: "declined" });
}

/** Next while the call runs: the rest of the conversation at once, then hang up. */
export async function skipAhead(): Promise<void> {
  if (state.phase !== "connected") return;
  clearTimers();
  for (const line of CALL_SCRIPT) pushLine(line);
  await finish();
}

async function finish(): Promise<void> {
  if (state.phase !== "connected") return;
  clearTimers();
  await hangup();
  onEnded();
}

function onEnded(): void {
  if (state.phase === "ended") return;
  clearTimers();
  set({ phase: "ended" });
  updateState((s) => {
    s.callDone = true;
    if (!s.notes.some((n) => n.id === "ai-call-note")) {
      s.notes.push({ id: "ai-call-note", body: callNoteBody(), owner_name: "AI call note", created_at: new Date().toISOString() });
    }
  });
  const d = useDialer.getState();
  d.close();
}

/** Back out of the call step (or leave the tour): silence everything. */
export function resetCall(): void {
  clearTimers();
  const d = useDialer.getState();
  if (d.incoming) d.setIncoming(null);
  if (state.phase === "connected") {
    try {
      void hangup();
    } catch {
      /* ignore */
    }
  }
  set({ phase: "idle", lines: [], startedAt: null });
}
