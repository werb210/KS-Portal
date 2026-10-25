// KS_PORTAL_v11_LIVE_DEMO - the pop-ups over the real portal: a spotlight on what is being explained and a small card
// (title, one or two sentences, Back / Next, "Step 3 of 10", Exit demo). Next performs the step's action, then moves
// on; the page underneath stays fully clickable. The step is kept in sessionStorage so a reload resumes it.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { declineIncoming } from "@/dialer/actions";
import { getKeeper, subscribeKeeper } from "../../demoApi";
import { BUSINESS, REQUEST, money } from "../fixture";
import { getState } from "../state";
import { exitLiveDemo } from "../session";
import CallOverlay from "./CallOverlay";
import { placeCard } from "./placement";
import { CALLER, answer, getCall, resetCall, ring, skipAhead, subscribeCall } from "./callSim";
import { reveal, sleep } from "./dom";
import { CALL_TEXT, MAX_PICK, STEPS, appTab, pickedLenders, tickAndSend, type TourCtx, type TourStep } from "./steps";

const TOUR_KEY = "ks_live_demo_tour_v1";

/**
 * KS_PORTAL_v12_DEMO_FIXES - "Sign up" opens the website's sign-up pre-filled with this person's details. KS-Ops
 * answers the demo's open with signup_url ({site}/signup#demo=<id>&k=<key>): the demo id and an HMAC key in the
 * #fragment, no name or email, and the website swaps them for the details (POST /api/public/demo/prefill). Without it
 * (an older session, or KS-Ops without the site address) the plain sign-up page.
 */
export function signupUrl(websiteUrl: string, fromOps: string | null | undefined): string {
  const plain = `${websiteUrl}/signup`;
  const raw = String(fromOps ?? "").trim();
  if (!raw) return plain;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) return plain;
    if (!/\/signup\/?$/.test(u.pathname) || u.search) return plain;
    return u.href;
  } catch {
    return plain;
  }
}

function readIndex(max: number): number {
  try {
    const n = Number(JSON.parse(window.sessionStorage.getItem(TOUR_KEY) ?? "{}")?.index ?? 0);
    return Number.isInteger(n) && n >= 0 && n < max ? n : 0;
  } catch {
    return 0;
  }
}

function writeIndex(index: number): void {
  try {
    window.sessionStorage.setItem(TOUR_KEY, JSON.stringify({ index }));
  } catch {
    /* memory only */
  }
}

type Rect = { top: number; left: number; width: number; height: number };
const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && Math.abs(a.top - b.top) < 1 && Math.abs(a.left - b.left) < 1 && Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1);

/** One box around all of them (null when none can be seen). */
export function unionRect(list: Array<{ top: number; left: number; width: number; height: number } | null>): Rect | null {
  const rs = list.filter((r): r is NonNullable<typeof r> => Boolean(r && r.width > 0 && r.height > 0));
  if (!rs.length) return null;
  const top = Math.min(...rs.map((r) => r.top));
  const left = Math.min(...rs.map((r) => r.left));
  const bottom = Math.max(...rs.map((r) => r.top + r.height));
  const right = Math.max(...rs.map((r) => r.left + r.width));
  return { top, left, width: right - left, height: bottom - top };
}

/** The part of `el` that can be seen: clipped by every scrolling ancestor and the window. */
export function visibleRect(el: Element): Rect | null {
  const r = el.getBoundingClientRect();
  let top = r.top, left = r.left, bottom = r.bottom, right = r.right;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = window.getComputedStyle(p);
    if (/(auto|scroll|hidden)/.test(`${cs.overflowY}${cs.overflowX}`)) {
      const pr = p.getBoundingClientRect();
      top = Math.max(top, pr.top);
      left = Math.max(left, pr.left);
      bottom = Math.min(bottom, pr.bottom);
      right = Math.min(right, pr.right);
    }
  }
  top = Math.max(top, 0);
  left = Math.max(left, 0);
  bottom = Math.min(bottom, window.innerHeight);
  right = Math.min(right, window.innerWidth);
  return right - left > 4 && bottom - top > 4 ? { top, left, width: right - left, height: bottom - top } : null;
}

export type BrokerTourProps = {
  steps?: TourStep[];
  websiteUrl: string;
  supportEmail: string;
  onTrack?: (name: string, step: string) => void;
};

export default function BrokerTour({ steps = STEPS, websiteUrl, supportEmail, onTrack }: BrokerTourProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState(() => readIndex(steps.length));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  // KS_PORTAL_v12_CARD_PLACEMENT - what the card must keep clear of when there is no spotlight (the ringing call).
  const [avoid, setAvoid] = useState<Rect | null>(null);
  const [cardSize, setCardSize] = useState({ w: 360, h: 220 });
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const call = useSyncExternalStore(subscribeCall, getCall, getCall);
  const keeper = useSyncExternalStore(subscribeKeeper, getKeeper, getKeeper);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const step = steps[index] ?? steps[0]!;
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const [focusEl, setFocus] = useState<Element | null>(null);
  // KS_PORTAL_v11_LIVE_DEMO - on the lenders step the prospect ticks 1-3 lenders themselves; Submit waits for that.
  const [picked, setPicked] = useState(0);
  const ctx: TourCtx = { navigate, setStatus, setFocus };

  const go = useCallback((to: number) => {
    const n = Math.max(0, Math.min(steps.length - 1, to));
    writeIndex(n);
    setIndex(n);
  }, [steps.length]);

  // Entering a step: its screen, analytics, and what happens on arrival.
  useEffect(() => {
    setError(null);
    setStatus(null);
    setFocus(null);
    if (pathRef.current !== step.route && !(step.key === "call" && getCall().phase === "ended")) navigate(step.route);
    onTrack?.(`broker_${step.key}`, step.track);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (step.key === "pipeline") {
      t = setTimeout(() => {
        try {
          toast(`New application arrived - ${BUSINESS.operating_name}, ${money(REQUEST.amount)} equipment`, { duration: 6000, id: "live-demo-arrived" });
        } catch {
          /* no toaster */
        }
      }, 500);
    }
    if (step.key === "call" && getCall().phase === "idle") t = setTimeout(() => ring(), 700);
    return () => {
      if (t) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per step
  }, [index]);

  // Leaving the call step while it rings or runs: hang up quietly.
  useEffect(() => {
    if (step.key === "call") return;
    const c = getCall();
    if (c.phase === "ringing" || c.phase === "connected" || c.phase === "declined") resetCall();
  }, [step.key]);

  // The call ended: show the AI note on the Notes tab.
  useEffect(() => {
    if (step.key === "call" && call.phase === "ended") navigate(appTab("notes"));
  }, [call.phase, step.key, navigate]);

  const target = useCallback((): Element | Element[] | null => {
    if (focusEl && focusEl.isConnected) return focusEl;
    if (step.key === "call") return call.phase === "ended" ? document.querySelector('[data-testid="notes-list"]') : null;
    return step.target?.() ?? null;
  }, [step, call.phase, focusEl]);

  // Follow the target as the page renders, scrolls and resizes.
  useEffect(() => {
    let last: Rect | null = null;
    let lastAvoid: Rect | null = null;
    let revealed: Element | null = null;
    const tick = () => {
      const got = target();
      const els = (Array.isArray(got) ? got : got ? [got] : []).filter((e) => e.isConnected);
      const el = els[0] ?? null;
      if (el && revealed !== el) {
        // KS_PORTAL_v12_CARD_PLACEMENT - bring the highlight into view first: centred when it fits, else its top.
        revealed = el;
        const span = unionRect(els.map((e) => e.getBoundingClientRect()));
        reveal(el, span && span.height < window.innerHeight * 0.6 ? "center" : "start");
      }
      const next = unionRect(els.map((e) => visibleRect(e)));
      if (!sameRect(last, next)) {
        last = next;
        setRect(next);
      }
      const callEl = document.querySelector(".ksld-call");
      const nextAvoid = callEl ? visibleRect(callEl) : null;
      if (!sameRect(lastAvoid, nextAvoid)) {
        lastAvoid = nextAvoid;
        setAvoid(nextAvoid);
      }
      const card = cardRef.current;
      if (card) {
        const w = card.offsetWidth || 360;
        const h = card.offsetHeight || 220;
        setCardSize((prev) => (Math.abs(prev.w - w) > 2 || Math.abs(prev.h - h) > 2 ? { w, h } : prev));
      }
    };
    tick();
    const timer = setInterval(tick, 200);
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [target]);

  useEffect(() => {
    if (steps[index]?.key !== "lenders") return;
    const tick = () => setPicked(pickedLenders());
    tick();
    const t = window.setInterval(tick, 250);
    return () => window.clearInterval(t);
  }, [index, steps]);

  const send = async () => {
    if (getState().submission) {
      go(index + 1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (pathRef.current !== step.route) {
        navigate(step.route);
        await sleep(400);
      }
      const r = await tickAndSend(ctx);
      if (r.ok) go(index + 1);
      else setError(r.message || "The package was not sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The package was not sent.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  const next = async () => {
    if (busy) return;
    setError(null);
    if (step.key === "call") {
      if (call.phase === "idle") ring();
      else if (call.phase === "ringing") await answer();
      else if (call.phase === "connected") await skipAhead();
      else go(index + 1);
      return;
    }
    if (step.key === "lenders") return send();
    if (index >= steps.length - 1) return;
    if (step.action) {
      setBusy(true);
      try {
        if (pathRef.current !== step.route) {
          navigate(step.route);
          await sleep(400);
        }
        if ((await step.action(ctx)) === "stay") return;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something did not work - try Next again.");
        return;
      } finally {
        setBusy(false);
        setStatus(null);
      }
    }
    go(index + 1);
  };

  const back = () => {
    if (busy || index === 0) return;
    if (step.key === "call") resetCall();
    go(index - 1);
  };

  // ---------------------------------------------------------------- what the card says
  let title = step.title;
  let body: React.ReactNode = step.body;
  let nextLabel = step.nextLabel ?? "Next";
  if (step.key === "call") {
    const t = call.phase === "connected" ? CALL_TEXT.connected : call.phase === "declined" ? CALL_TEXT.declined : null;
    if (t) {
      title = t.title;
      body = t.body;
      nextLabel = t.next;
    }
    if (call.phase === "ended") {
      title = CALL_TEXT.ended.title;
      nextLabel = CALL_TEXT.ended.next;
      body = (
        <>
          <span className="ksld-card-strong">{CALL_TEXT.ended.body}</span>
          <span>{CALL_TEXT.ended.follow}</span>
        </>
      );
    }
  }
  const pickOk = picked >= 1 && picked <= MAX_PICK;
  if (step.key === "lenders" && !getState().submission && !busy) {
    nextLabel = picked === 0 ? "Submit" : `Submit to ${picked} lender${picked === 1 ? "" : "s"}`;
  }
  const pickHint = step.key === "lenders" && !getState().submission
    ? picked === 0 ? "Tick at least one lender to submit." : picked > MAX_PICK ? `Pick up to ${MAX_PICK} lenders - untick ${picked - MAX_PICK}.` : null
    : null;
  const sub = getState().submission;
  if (step.key === "done") {
    body = (
      <>
        <span className="ksld-card-strong" data-testid="live-demo-sent">Sent - the lender package is on its way to {sub?.emailed_to ?? "your inbox"}.</span>
        <span>It's the same package a lender receives. One phone application, every document named, a doctored statement caught, the client's call on file and {sub?.lenders?.length === 1 ? "one lender" : `${sub?.lenders?.length ?? "your"} lenders`} sent the lot - without re-typing anything.</span>
      </>
    );
  }
  const waking = busy && step.key === "lenders" && (keeper.status === "opening" || keeper.status === "waking");
  const statusLine = waking ? "Sending… the demo server is waking up - this can take up to a minute." : status;

  // ---------------------------------------------------------------- where the card goes
  // KS_PORTAL_v12_CARD_PLACEMENT - beside the highlight on the side with the most room, else the corner that covers it
  // least (src/demo/broker/tour/placement.ts). The spotlight's padding counts as part of the highlight.
  const narrow = viewport.w < 700;
  const pad = 8;
  const keepClear = (rect && !(step.key === "call" && call.phase !== "ended" && call.phase !== "idle"))
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : avoid;
  const placed = placeCard(keepClear, cardSize, viewport);
  const cardStyle: CSSProperties = { top: placed.top, left: placed.left, width: placed.width };
  const showCall = step.key === "call" && call.phase !== "idle" && call.phase !== "ended";

  return (
    <div className="ksld-tour" data-testid="live-demo-tour" data-step={step.key}>
      {rect && !showCall && (
        <div
          className="ksld-spot"
          aria-hidden="true"
          style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      )}
      {showCall && <div className="ksld-dim" aria-hidden="true" />}
      {showCall && (
        <CallOverlay
          phase={call.phase}
          lines={call.lines}
          startedAt={call.startedAt}
          caller={CALLER}
          facts={[BUSINESS.legal_name, "6 of 6 documents received", `Owner, ${BUSINESS.years_in_business} years in business`]}
          flag="Fraud flag: September statement"
          onAnswer={() => void answer()}
          onDecline={() => declineIncoming()}
        />
      )}
      <div ref={cardRef} className={`ksld-card${narrow ? " ksld-card--sheet" : ""}`} style={cardStyle} role="dialog" aria-modal="false" aria-labelledby="ksld-card-title" data-testid="live-demo-card" data-side={placed.side}>
        <div className="ksld-card-top">
          <span className="ksld-card-progress">Step {index + 1} of {steps.length}</span>
          <button type="button" className="ksld-card-exit" onClick={() => exitLiveDemo("/demo")}>Exit demo</button>
        </div>
        <h2 id="ksld-card-title" className="ksld-card-title">{title}</h2>
        <div className="ksld-card-body">{body}</div>
        {statusLine && <div className="ksld-card-status" role="status">{statusLine}</div>}
        {pickHint && !statusLine && <div className="ksld-card-status" role="status" data-testid="live-demo-pick-hint">{pickHint}</div>}
        {error && (
          <div className="ksld-card-error" role="alert">
            {error}
          </div>
        )}
        <div className="ksld-card-actions">
          <button type="button" className="ksld-btn ksld-btn--ghost" onClick={back} disabled={busy || index === 0}>Back</button>
          {step.key === "done" ? (
            <>
              <a className="ksld-btn ksld-btn--ghost" href={`mailto:${supportEmail}?subject=${encodeURIComponent("Keystone demo - let's talk")}`}>Talk to us</a>
              <a className="ksld-btn ksld-btn--primary" href={signupUrl(websiteUrl, keeper.session?.signup_url)} data-testid="live-demo-signup">Sign up</a>
            </>
          ) : (
            <button type="button" className="ksld-btn ksld-btn--primary" onClick={() => void next()} disabled={busy || (step.key === "lenders" && !getState().submission && !pickOk)} data-testid="live-demo-next">
              {busy ? (step.key === "lenders" ? "Sending…" : "Working…") : error && step.key === "lenders" ? "Try again" : nextLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
