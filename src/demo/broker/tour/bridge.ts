// KS_PORTAL_v13_PHONE_DEMO - on a phone the broker side runs the REAL portal at a desktop width inside a frame that the
// phone page (/demo/broker) zooms and pans like a camera. The tour still runs here, next to the portal, but its card is
// drawn by the phone page as a bottom sheet. This is the hand-over: the tour publishes what its card would say and where
// its highlight is, and the phone page presses Next / Back / Accept through it. Both pages are the portal's own origin,
// so the phone page reads `window.__KSLD_BRIDGE__` of the frame directly; nothing crosses origins.
import type { CallLine } from "../fixture";
import type { CallPhase } from "./callSim";

export type BodyPart = { text: string; strong?: boolean; testId?: string };
export type Rect = { top: number; left: number; width: number; height: number };

export type TourSnapshot = {
  key: string;
  index: number;
  total: number;
  title: string;
  body: BodyPart[];
  status: string | null;
  hint: string | null;
  error: string | null;
  nextLabel: string;
  nextDisabled: boolean;
  backDisabled: boolean;
  busy: boolean;
  done: boolean;
  signupHref: string;
  contactHref: string;
  /** The highlight, in the frame's own pixels (the portal's layout), or null. */
  rect: Rect | null;
  /** What is highlighted (the phone page reads its text size to zoom far enough). */
  els: Element[];
  call: {
    phase: CallPhase;
    lines: CallLine[];
    startedAt: number | null;
    caller: { name: string; company: string; deal: string };
    facts: string[];
    flag: string;
  };
};

export type TourBridge = {
  get: () => TourSnapshot | null;
  subscribe: (fn: (s: TourSnapshot) => void) => () => void;
  next: () => void;
  back: () => void;
  answer: () => void;
  decline: () => void;
};

type Handlers = Pick<TourBridge, "next" | "back" | "answer" | "decline">;

const KEY = "__KSLD_BRIDGE__";

let snapshot: TourSnapshot | null = null;
const listeners = new Set<(s: TourSnapshot) => void>();
let handlers: Handlers = { next: () => undefined, back: () => undefined, answer: () => undefined, decline: () => undefined };

const bridge: TourBridge = {
  get: () => snapshot,
  subscribe: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  next: () => handlers.next(),
  back: () => handlers.back(),
  answer: () => handlers.answer(),
  decline: () => handlers.decline(),
};

/** True while this portal runs inside the phone page's camera (set by bootBroker before the first render). */
export function isCameraDemo(): boolean {
  return (globalThis as { __KS_CAMERA_DEMO__?: boolean }).__KS_CAMERA_DEMO__ === true;
}

export function markCameraDemo(on: boolean, win: Window = window): void {
  (globalThis as { __KS_CAMERA_DEMO__?: boolean }).__KS_CAMERA_DEMO__ = on;
  const w = win as unknown as Record<string, unknown>;
  if (on) w[KEY] = bridge;
  else delete w[KEY];
}

export function setBridgeHandlers(h: Handlers): void {
  handlers = h;
}

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1);

function same(a: TourSnapshot | null, b: TourSnapshot): boolean {
  if (!a) return false;
  return (
    a.key === b.key && a.index === b.index && a.title === b.title && a.status === b.status && a.hint === b.hint && a.error === b.error &&
    a.nextLabel === b.nextLabel && a.nextDisabled === b.nextDisabled && a.backDisabled === b.backDisabled && a.busy === b.busy &&
    a.signupHref === b.signupHref && sameRect(a.rect, b.rect) && a.els.length === b.els.length && a.els.every((e, i) => e === b.els[i]) &&
    a.call.phase === b.call.phase && a.call.lines.length === b.call.lines.length && a.call.startedAt === b.call.startedAt &&
    a.body.length === b.body.length && a.body.every((p, i) => p.text === b.body[i]!.text && p.strong === b.body[i]!.strong)
  );
}

export function publishSnapshot(next: TourSnapshot): void {
  if (same(snapshot, next)) return;
  snapshot = next;
  for (const fn of listeners) fn(next);
}

/** The bridge of the portal inside `frame`, once it has started (null before, or for another origin). */
export function bridgeOf(frame: HTMLIFrameElement | null): TourBridge | null {
  try {
    const w = frame?.contentWindow as unknown as Record<string, unknown> | null;
    return (w?.[KEY] as TourBridge | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Tests only. */
export function __resetBridge(): void {
  snapshot = null;
  listeners.clear();
  handlers = { next: () => undefined, back: () => undefined, answer: () => undefined, decline: () => undefined };
}
