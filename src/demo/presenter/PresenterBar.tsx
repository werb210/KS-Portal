// KS_PORTAL_v12_PRESENTER - the presenter's controls over the real portal (no tour, no pop-ups). A small dark panel
// docked in the empty lower part of the sidebar, so it never covers the screen being shown:
//   - switch between the client's phone (the real client app, no tour, in a phone frame) and the broker portal
//   - jump to the key screens of the sample file
//   - ring the client's incoming call (answer, decline, end - the AI call note lands on Notes)
//   - submit to lenders (ticks the strong fits if none are ticked, then the real Send)
//   - reset the sample file, or end the demo (back to the start page for the next prospect)
// Collapses to a single "Presenter" button.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { declineIncoming } from "@/dialer/actions";
import { demoClientOrigin, demoClientUrl } from "../config";
import { BUSINESS } from "../broker/fixture";
import { getState, resetState } from "../broker/state";
import { exitLiveDemo } from "../broker/session";
import CallOverlay from "../broker/tour/CallOverlay";
import { CALLER, answer, getCall, resetCall, ring, skipAhead, subscribeCall } from "../broker/tour/callSim";
import { sleep, waitFor } from "../broker/tour/dom";
import { MAX_PICK, appTab, pickedLenders, strongLenders, tickAndSend, type TourCtx } from "../broker/tour/steps";
import StatusBar from "../StatusBar";
import { presenterNav } from "./PresenterStart";

export const PRESENTER_JUMPS: Array<{ key: string; label: string; route: string }> = [
  { key: "pipeline", label: "Pipeline", route: "/pipeline" },
  { key: "documents", label: "Documents", route: appTab("documents") },
  { key: "financials", label: "Financials", route: appTab("financials") },
  { key: "banking", label: "Bank summary", route: appTab("banking-analysis") },
  { key: "credit", label: "Credit summary", route: appTab("credit-summary") },
  { key: "fraud", label: "Fraud", route: appTab("fraud") },
  { key: "lenders", label: "Lenders", route: appTab("lenders") },
  { key: "notes", label: "Notes", route: appTab("notes") },
];

const UI_KEY = "ks_live_demo_presenter_ui_v1";
const FRAME = { w: 390, h: 844, bezel: 14 };

/** The client app with no tour, framed by this page (KS-Client ?present=1). */
export function presenterClientUrl(parentOrigin: string): string {
  return `${demoClientUrl()}/tour?embed=1&present=1&parent=${encodeURIComponent(parentOrigin)}`;
}

function readCollapsed(): boolean {
  try {
    return window.sessionStorage.getItem(UI_KEY) === "collapsed";
  } catch {
    return false;
  }
}

/** Fresh sample file, same prospect: everything back to how the application first arrives. */
export function resetPresenterDemo(): void {
  resetCall();
  resetState();
  try {
    window.sessionStorage.removeItem("ks_live_demo_tour_v1");
  } catch {
    /* ignore */
  }
  presenterNav.assign("/pipeline");
}

export default function PresenterBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const call = useSyncExternalStore(subscribeCall, getCall, getCall);
  const [view, setView] = useState<"portal" | "client">("portal");
  const [clientMounted, setClientMounted] = useState(false);
  const [clientKey, setClientKey] = useState(0);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [busy, setBusy] = useState<null | "submit" | "call">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const clientSrc = useMemo(() => presenterClientUrl(window.location.origin), []);
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  useEffect(() => {
    document.title = "Keystone - presenter demo";
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(UI_KEY, collapsed ? "collapsed" : "open");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // The call ended: the AI call note is on the file's Notes tab.
  const lastPhase = useRef(call.phase);
  useEffect(() => {
    if (lastPhase.current !== "ended" && call.phase === "ended") {
      setView("portal");
      navigate(appTab("notes"));
      setStatus("Call ended - the AI call note is on the Notes tab.");
    }
    lastPhase.current = call.phase;
  }, [call.phase, navigate]);

  const go = useCallback((route: string) => {
    setError(null);
    setView("portal");
    if (pathRef.current !== route) navigate(route);
  }, [navigate]);

  const showClient = () => {
    setError(null);
    setClientMounted(true);
    setView("client");
  };

  const ringNow = () => {
    setError(null);
    setStatus(null);
    if (call.phase === "ringing" || call.phase === "connected") return;
    setView("portal"); // the broker takes the call
    resetCall();
    ring();
  };

  const endCall = async () => {
    setBusy("call");
    try {
      await skipAhead();
    } finally {
      setBusy(null);
    }
  };

  const ctx: TourCtx = { navigate, setStatus, setFocus: () => undefined };

  const submit = async () => {
    setError(null);
    setView("portal");
    const sent = getState().submission;
    if (sent) {
      go(appTab("lenders"));
      setStatus(`Already sent to ${sent.lenders.length} lender${sent.lenders.length === 1 ? "" : "s"}. Reset to send again.`);
      return;
    }
    setBusy("submit");
    try {
      if (pathRef.current !== appTab("lenders")) {
        navigate(appTab("lenders"));
        await sleep(300);
      }
      const tab = await waitFor(() => document.querySelector<HTMLElement>('[data-testid="lenders-tab"] table'), 15_000);
      if (pickedLenders() === 0) {
        setStatus("Ticking the strong fits…");
        for (const l of strongLenders().slice(0, MAX_PICK)) {
          const box = tab.querySelector<HTMLInputElement>(`input[aria-label="Send to ${l.name}"]`);
          if (box && !box.checked) box.click();
        }
        await waitFor(() => pickedLenders() > 0, 5000);
      }
      if (pickedLenders() > MAX_PICK) {
        setError(`Tick at most ${MAX_PICK} lenders, then press Submit to lenders again.`);
        return;
      }
      const r = await tickAndSend(ctx, 30_000);
      if (r.ok) setStatus(r.message);
      else setError(r.message || "The file was not sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The file was not sent.");
    } finally {
      setBusy(null);
    }
  };

  const showCall = call.phase === "ringing" || call.phase === "connected";
  const scale = Math.min(1, Math.max(0.5, (viewport.h - 90) / (FRAME.h + FRAME.bezel * 2)));
  const outerW = (FRAME.w + FRAME.bezel * 2) * scale;
  const outerH = (FRAME.h + FRAME.bezel * 2) * scale;

  return (
    <>
      {clientMounted && (
        <div className="ksld-present-client" data-testid="presenter-client" hidden={view !== "client"} aria-hidden={view !== "client"}>
          <div className="ksld-present-client-head">
            <span>The client's phone - {BUSINESS.operating_name} applying. Tap through it freely.</span>
            <button type="button" className="ksld-btn ksld-btn--ghost" onClick={() => setClientKey((k) => k + 1)}>Restart the client app</button>
          </div>
          <div className="ksld-phone-slot" style={{ width: outerW, height: outerH }}>
            <div className="ksld-iphone ksld-iphone--frame" style={{ width: FRAME.w + FRAME.bezel * 2, height: FRAME.h + FRAME.bezel * 2, transform: `scale(${scale})` }}>
              <div className="ksld-iphone-button ksld-iphone-button--action" />
              <div className="ksld-iphone-button ksld-iphone-button--up" />
              <div className="ksld-iphone-button ksld-iphone-button--down" />
              <div className="ksld-iphone-button ksld-iphone-button--power" />
              <div className="ksld-iphone-screen ksld-iphone-screen--app">
                <div className="ksld-island" />
                <StatusBar dark={false} />
                <iframe key={clientKey} className="ksld-client-iframe" title="The client app" src={clientSrc} data-testid="presenter-client-frame" data-origin={demoClientOrigin()} />
                <div className="ksld-homebar ksld-homebar--dark" />
              </div>
            </div>
          </div>
        </div>
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

      {collapsed ? (
        <button type="button" className="ksld-present-pill" onClick={() => setCollapsed(false)} data-testid="presenter-expand">Presenter</button>
      ) : (
        <div className="ksld-present-bar" role="region" aria-label="Presenter controls" data-testid="presenter-bar">
          <div className="ksld-present-row ksld-present-row--head">
            <span className="ksld-present-title">Presenter</span>
            <button type="button" className="ksld-present-link" onClick={() => setCollapsed(true)}>Hide</button>
          </div>
          <div className="ksld-present-row">
            <button type="button" className={`ksld-present-btn${view === "client" ? " is-on" : ""}`} aria-pressed={view === "client"} onClick={showClient} data-testid="presenter-view-client">Client phone</button>
            <button type="button" className={`ksld-present-btn${view === "portal" ? " is-on" : ""}`} aria-pressed={view === "portal"} onClick={() => setView("portal")} data-testid="presenter-view-portal">Broker portal</button>
          </div>
          <div className="ksld-present-label-sm">Jump to</div>
          <div className="ksld-present-grid">
            {PRESENTER_JUMPS.map((j) => (
              <button
                key={j.key}
                type="button"
                className={`ksld-present-btn${view === "portal" && location.pathname === j.route ? " is-on" : ""}`}
                onClick={() => go(j.route)}
                data-testid={`presenter-jump-${j.key}`}
              >
                {j.label}
              </button>
            ))}
          </div>
          <div className="ksld-present-label-sm">Actions</div>
          <div className="ksld-present-row">
            {call.phase === "ringing" ? (
              <>
                <button type="button" className="ksld-present-btn ksld-present-btn--go" onClick={() => void answer()} data-testid="presenter-call-answer">Answer</button>
                <button type="button" className="ksld-present-btn" onClick={() => declineIncoming()} data-testid="presenter-call-decline">Decline</button>
              </>
            ) : call.phase === "connected" ? (
              <button type="button" className="ksld-present-btn ksld-present-btn--stop ksld-present-btn--wide" onClick={() => void endCall()} disabled={busy === "call"} data-testid="presenter-call-end">End the call</button>
            ) : (
              <button type="button" className="ksld-present-btn ksld-present-btn--wide" onClick={ringNow} data-testid="presenter-call">Incoming client call</button>
            )}
          </div>
          <div className="ksld-present-row">
            <button type="button" className="ksld-present-btn ksld-present-btn--primary ksld-present-btn--wide" onClick={() => void submit()} disabled={busy === "submit"} data-testid="presenter-submit">
              {busy === "submit" ? "Sending…" : "Submit to lenders"}
            </button>
          </div>
          {(status || error) && (
            <div className={error ? "ksld-present-msg ksld-present-msg--error" : "ksld-present-msg"} role={error ? "alert" : "status"} data-testid="presenter-status">{error ?? status}</div>
          )}
          <div className="ksld-present-row">
            <button type="button" className="ksld-present-btn" onClick={resetPresenterDemo} data-testid="presenter-reset">Reset demo</button>
            <button type="button" className="ksld-present-btn" onClick={() => exitLiveDemo("/demo/present")} data-testid="presenter-end">End demo</button>
          </div>
        </div>
      )}
    </>
  );
}
