// KS_PORTAL_v13_PHONE_DEMO - /demo/broker: the broker side on a phone. The REAL portal runs in a frame laid out at a
// desktop width (1280px, so it looks the way a broker sees it at their desk), and this page moves a "camera" over it:
// for each step it zooms and pans so the highlighted part fills the phone's width at a readable size, and it follows
// the auto-played steps (the documents being accepted one by one). The person can pan, pinch, see the whole page and
// tap "Re-centre" to come back. The tour's words and buttons are in the bottom sheet; the call is the phone's own call
// screen. CSS transforms keep taps where they look (a tap on a zoomed checkbox ticks that checkbox).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { demoWebsiteUrl } from "../config";
import { initKeeper } from "../demoApi";
import { hasStoredDemo } from "../mode";
import { exitLiveDemo, requestBrokerMode } from "../broker/session";
import { bridgeOf, type TourBridge, type TourSnapshot } from "../broker/tour/bridge";
import { NoDemoLink } from "../DemoShell";
import { shellNav } from "../nav";
import PhoneSheet, { type SheetAction } from "./PhoneSheet";
import PhoneCall from "./PhoneCall";
import { useViewport } from "./useViewport";
import {
  LAYOUT_W, MAX_SCALE, clampPan, frameRegion, isPhoneViewport, layoutHeight, overviewScale, tween, typicalFontPx, type Camera,
} from "./phone";

const ANIM_MS = 380;

function reducedMotion(): boolean {
  try {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

/** Debug and tests: the camera's state, read by the Playwright checks. */
export type CameraProbe = { scale: number; x: number; y: number; manual: boolean; font: number; stage: { w: number; h: number } };

export default function PhoneBroker() {
  const website = demoWebsiteUrl();
  const [hasDemo] = useState(() => {
    initKeeper(window.location);
    const ok = hasStoredDemo();
    if (ok) requestBrokerMode(); // the frame below boots the broker side
    return ok;
  });
  const [desktop] = useState(() => !isPhoneViewport());
  useEffect(() => {
    // Opened on a computer or an iPad: the normal broker side.
    if (desktop && hasDemo) shellNav.assign("/pipeline");
  }, [desktop, hasDemo]);

  const vp = useViewport();
  const landscape = vp.w > vp.h;
  // The portal's layout height follows the phone's shape; it changes on rotation only (not with the Safari toolbar).
  const layout = useMemo(() => ({ w: LAYOUT_W, h: layoutHeight(window.innerWidth, window.innerHeight) }), [landscape]); // eslint-disable-line react-hooks/exhaustive-deps

  const stageRef = useRef<HTMLDivElement | null>(null);
  const sizerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeRef = useRef<TourBridge | null>(null);
  const [snap, setSnap] = useState<TourSnapshot | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [manual, setManualState] = useState(false);
  const manualRef = useRef(false);
  const cam = useRef<Camera>({ scale: 0.3, x: 0, y: 0 });
  const anim = useRef(0);
  const fontRef = useRef(14);
  const setScroll = useRef({ x: 0, y: 0 });
  // When the person last touched, scrolled or clicked: only then is a scroll of the stage theirs. The portal's own
  // scrollIntoView (it brings rows into view inside the frame) also scrolls the stage around it; that is put back.
  const lastInput = useRef(0);

  const setManual = useCallback((on: boolean) => {
    manualRef.current = on;
    setManualState(on);
  }, []);

  const stageSize = () => ({ w: stageRef.current?.clientWidth || window.innerWidth, h: stageRef.current?.clientHeight || window.innerHeight });

  const apply = useCallback((c: Camera) => {
    cam.current = c;
    const sizer = sizerRef.current;
    const frame = iframeRef.current;
    const stage = stageRef.current;
    if (sizer) {
      sizer.style.width = `${Math.ceil(layout.w * c.scale)}px`;
      sizer.style.height = `${Math.ceil(layout.h * c.scale)}px`;
    }
    if (frame) frame.style.transform = `scale(${c.scale})`;
    if (stage) {
      stage.scrollLeft = c.x;
      stage.scrollTop = c.y;
      // What the stage actually took (the browser rounds and clamps): a scroll event that still matches it is ours.
      setScroll.current = { x: stage.scrollLeft, y: stage.scrollTop };
    }
    (window as unknown as { __ksldCamera?: CameraProbe }).__ksldCamera = { ...c, manual: manualRef.current, font: fontRef.current, stage: stageSize() };
  }, [layout]);

  const moveTo = useCallback((to: Camera) => {
    window.cancelAnimationFrame(anim.current);
    const from = { ...cam.current };
    const close = Math.abs(from.scale - to.scale) < 0.002 && Math.abs(from.x - to.x) < 1 && Math.abs(from.y - to.y) < 1;
    if (close || reducedMotion()) {
      apply(to);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ANIM_MS);
      apply(tween(from, to, t));
      if (t < 1) anim.current = window.requestAnimationFrame(step);
    };
    anim.current = window.requestAnimationFrame(step);
  }, [apply]);

  /** Frame the step's highlight (or the whole page when there is none). */
  const frame = useCallback(() => {
    const s = bridgeRef.current?.get() ?? null;
    let font = 14;
    try {
      const w = iframeRef.current?.contentWindow;
      if (w && s?.els.length) font = typicalFontPx(s.els, w);
    } catch {
      font = 14;
    }
    fontRef.current = font;
    moveTo(frameRegion(s?.rect ?? null, stageSize(), layout, font));
  }, [layout, moveTo]);

  // Find the tour inside the frame (it starts a moment after the frame loads, and again after a reload).
  useEffect(() => {
    let unsub: (() => void) | null = null;
    const look = () => {
      const b = bridgeOf(iframeRef.current);
      if (!b || b === bridgeRef.current) return;
      unsub?.();
      bridgeRef.current = b;
      unsub = b.subscribe((s) => setSnap(s));
      setSnap(b.get());
      installTouch();
    };
    const timer = window.setInterval(look, 200);
    look();
    return () => {
      window.clearInterval(timer);
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- installTouch reads refs only
  }, []);

  // A new step, or Next pressed: the camera follows again.
  const stepKey = snap?.key;
  useEffect(() => {
    setManual(false);
  }, [stepKey, setManual]);

  // Follow the highlight as it moves (auto-play, scrolling inside the portal, the sheet opening or closing).
  const rect = snap?.rect;
  const rectKey = rect ? `${Math.round(rect.top)}:${Math.round(rect.left)}:${Math.round(rect.width)}:${Math.round(rect.height)}` : "none";
  const elsKey = snap?.els.length ?? 0;
  const hadRect = useRef(false);
  useLayoutEffect(() => {
    if (manualRef.current) return undefined;
    // Between two auto-played rows the highlight is briefly gone: hold the shot rather than zoom out and back in.
    if (rectKey === "none" && hadRect.current) {
      const t = window.setTimeout(() => {
        hadRect.current = false;
        if (!manualRef.current) frame();
      }, 900);
      return () => window.clearTimeout(t);
    }
    hadRect.current = rectKey !== "none";
    frame();
    return undefined;
  }, [rectKey, elsKey, stepKey, collapsed, landscape, vp.w, vp.h, frame]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => {
      if (!manualRef.current) frame();
      else apply(clampPan(cam.current, stageSize(), layout));
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, [frame, apply, layout]);

  // The person scrolled the stage themselves: stop following until Re-centre (or the next step).
  const onScroll = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const moved = Math.abs(stage.scrollLeft - setScroll.current.x) > 2 || Math.abs(stage.scrollTop - setScroll.current.y) > 2;
    if (!moved) return;
    if (performance.now() - lastInput.current > 1000) {
      stage.scrollLeft = setScroll.current.x;
      stage.scrollTop = setScroll.current.y;
      return;
    }
    window.cancelAnimationFrame(anim.current);
    cam.current = { ...cam.current, x: stage.scrollLeft, y: stage.scrollTop };
    setScroll.current = { x: stage.scrollLeft, y: stage.scrollTop };
    if (!manualRef.current) setManual(true);
  };

  // Pinch to zoom, on the stage and inside the frame (touches there land in the frame's document).
  const pinch = useRef<{ d0: number; s0: number; ax: number; ay: number } | null>(null);
  const toStage = (t: Touch, inFrame: boolean) => {
    if (inFrame) return { x: t.clientX * cam.current.scale - cam.current.x, y: t.clientY * cam.current.scale - cam.current.y };
    const r = stageRef.current?.getBoundingClientRect();
    return { x: t.clientX - (r?.left ?? 0), y: t.clientY - (r?.top ?? 0) };
  };
  const touchHandlers = (inFrame: boolean) => ({
    start: (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const a = toStage(e.touches[0]!, inFrame);
      const b = toStage(e.touches[1]!, inFrame);
      const c = cam.current;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: c.scale, ax: (mx + c.x) / c.scale, ay: (my + c.y) / c.scale };
      window.cancelAnimationFrame(anim.current);
    },
    move: (e: TouchEvent) => {
      const p = pinch.current;
      if (!p || e.touches.length !== 2) return;
      e.preventDefault();
      const a = toStage(e.touches[0]!, inFrame);
      const b = toStage(e.touches[1]!, inFrame);
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const st = stageSize();
      const scale = Math.min(MAX_SCALE, Math.max(overviewScale(st, layout), (p.s0 * d) / p.d0));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (!manualRef.current) setManual(true);
      apply(clampPan({ scale, x: p.ax * scale - mx, y: p.ay * scale - my }, st, layout));
    },
    end: (e: TouchEvent) => {
      if (e.touches.length < 2) pinch.current = null;
    },
  });
  const installed = useRef<Set<EventTarget>>(new Set());
  function attach(target: EventTarget | null | undefined, inFrame: boolean) {
    if (!target || installed.current.has(target)) return;
    installed.current.add(target);
    const h = touchHandlers(inFrame);
    const mark = () => {
      lastInput.current = performance.now();
    };
    for (const ev of ["touchstart", "touchmove", "wheel", "pointerdown", "keydown"]) target.addEventListener(ev, mark, { passive: true });
    target.addEventListener("touchstart", h.start as EventListener, { passive: true });
    target.addEventListener("touchmove", h.move as EventListener, { passive: false });
    target.addEventListener("touchend", h.end as EventListener, { passive: true });
    target.addEventListener("touchcancel", h.end as EventListener, { passive: true });
  }
  function installTouch() {
    attach(stageRef.current, false);
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc) {
        attach(doc, true);
        // The portal inside: one finger pans, two fingers are ours (no page zoom inside the frame).
        doc.documentElement.style.touchAction = "pan-x pan-y";
      }
    } catch {
      /* not reachable: the camera buttons still work */
    }
  }

  // The call takes the whole screen: the sheet folds to its slim bar (which keeps Answer / Skip ahead) while it rings
  // and while it runs, and opens again for the AI call note.
  const callOnScreen = Boolean(snap && snap.key === "call" && ["ringing", "connected", "declined"].includes(snap.call.phase));
  useEffect(() => {
    setCollapsed(callOnScreen);
  }, [callOnScreen]);

  const wholePage = () => {
    setManual(true);
    const st = stageSize();
    moveTo(clampPan({ scale: overviewScale(st, layout), x: 0, y: 0 }, st, layout));
  };
  const recentre = () => {
    setManual(false);
    frame();
  };

  if (!hasDemo) return <NoDemoLink website={website} />;
  if (desktop) return null;

  const b = () => bridgeRef.current;
  const call = snap?.call;
  const showCall = Boolean(snap && snap.key === "call" && call && (call.phase === "ringing" || call.phase === "connected" || call.phase === "declined"));

  const actions: SheetAction[] = [];
  if (snap) {
    actions.push({ label: "Back", kind: "ghost", onClick: () => { setManual(false); b()?.back(); }, disabled: snap.backDisabled, testId: "live-demo-back" });
    if (snap.done) {
      actions.push({ label: "Talk to us", kind: "ghost", href: snap.contactHref });
      actions.push({ label: "Sign up", href: snap.signupHref, testId: "live-demo-signup" });
    } else {
      actions.push({ label: snap.nextLabel, onClick: () => { setManual(false); b()?.next(); }, disabled: snap.nextDisabled, testId: "live-demo-next" });
    }
  }
  let body: ReactNode = null;
  if (snap?.body.length) {
    body = snap.body.map((p, i) => (
      <p key={i} className={p.strong ? "ksld-ph-text ksld-ph-text--strong" : "ksld-ph-text"} data-testid={p.testId}>{p.text}</p>
    ));
  }
  const notes = snap ? (
    <>
      {snap.status ? <div className="ksld-ph-status" role="status">{snap.status}</div> : null}
      {snap.hint ? <div className="ksld-ph-status" role="status" data-testid="live-demo-pick-hint">{snap.hint}</div> : null}
      {snap.error ? <div className="ksld-ph-error" role="alert">{snap.error}</div> : null}
    </>
  ) : null;

  return (
    <div className={`ksld-ph ksld-ph--broker${landscape ? " ksld-ph--landscape" : ""}`} data-testid="live-demo-phone" data-orientation={landscape ? "landscape" : "portrait"}>
      <div className="ksld-ph-stage" data-testid="live-demo-stage">
        <div className="ksld-ph-scroller" ref={stageRef} onScroll={onScroll} data-testid="live-demo-camera">
          <div className="ksld-ph-sizer" ref={sizerRef}>
            <iframe
              ref={iframeRef}
              className="ksld-ph-portal-iframe"
              title="The broker portal"
              src="/pipeline"
              style={{ width: layout.w, height: layout.h }}
              onLoad={() => installTouch()}
              data-testid="live-demo-portal-frame"
            />
          </div>
        </div>
        {showCall && call ? (
          <PhoneCall call={call} onAccept={() => b()?.answer()} onDecline={() => b()?.decline()} onEnd={() => b()?.next()} />
        ) : null}
        {!snap ? <div className="ksld-ph-loading" role="status">Opening the broker portal…</div> : null}
      </div>
      <PhoneSheet
        count={snap ? `Step ${snap.index + 1} of ${snap.total}` : "The broker side"}
        title={snap?.title ?? "Opening the broker portal…"}
        body={body}
        notes={notes}
        actions={actions}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        onExit={() => exitLiveDemo("/demo")}
        tools={showCall ? null : manual ? (
          <button type="button" className="ksld-ph-chip ksld-ph-chip--primary" onClick={recentre} data-testid="live-demo-recentre">Re-centre</button>
        ) : (
          <button type="button" className="ksld-ph-chip" onClick={wholePage} data-testid="live-demo-whole-page">Whole page</button>
        )}
      />
    </div>
  );
}
