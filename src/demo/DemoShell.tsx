// KS_PORTAL_v11_LIVE_DEMO - /demo, phase 1: the prospect plays the client. A Keystone page greets them and shows the
// real client app (its /tour, pre-filled, Next-Next-Next) inside an iPhone-style frame, with a side panel mirroring
// the app's pop-ups. When the client tour finishes (postMessage "client-done", or /demo?broker=1) the tab switches
// to the broker side: the real portal on the same sample file. The demo session opens in the background meanwhile;
// nothing here waits for it.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { clientTourUrl, demoClientOrigin, demoWebsiteUrl } from "./config";
import { parseClientMessage, sendClientCommand, type ClientCommand, type ClientMessage } from "./clientMessages";
import { ensureSession, getKeeper, initKeeper, subscribeKeeper } from "./demoApi";
import StatusBar from "./StatusBar";
import { goBroker, shellNav } from "./nav";
import { isPhoneViewport } from "./phone/phone";
import PhoneClient from "./phone/PhoneClient";

export { shellNav };

const FRAME = { w: 390, h: 844, bezel: 14 };

export function KeystoneMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 4h14l-3 11h-8z" fill="#f59e0b" />
      <path d="M4 10l6 2 2 18H5zM28 10l-6 2-2 18h7z" fill="#93c5fd" />
      <path d="M12.5 17h7l1.5 13h-10z" fill="#e2e8f0" />
    </svg>
  );
}

export function NoDemoLink({ website }: { website: string }) {
  return (
    <div className="ksld-shell ksld-shell--empty" data-testid="live-demo-no-link">
      <div className="ksld-empty-card">
        <div className="ksld-brand"><KeystoneMark /><span>Keystone</span></div>
        <h1>Your demo link is missing</h1>
        <p>Open your demo from the text or email we sent, or start one at <a href={`${website}/try`}>{website.replace(/^https?:\/\//, "")}/try</a>.</p>
      </div>
    </div>
  );
}

export default function DemoShell() {
  const keeper = useSyncExternalStore(subscribeKeeper, getKeeper, getKeeper);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Extract<ClientMessage, { event: "step" }> | null>(null);
  // Decided once when the page opens: a computer shows the phone frame with the pop-up text and buttons beside it; a
  // phone shows the client app full screen with its own pop-ups.
  const [sidePanel] = useState(() => window.innerWidth >= 700);
  // KS_PORTAL_v13_PHONE_DEMO - a phone (narrow, or a touch screen held sideways) gets the full-screen client app with a
  // bottom sheet instead (src/demo/phone/PhoneClient.tsx). Decided once, like the side panel.
  const [phone] = useState(() => isPhoneViewport());
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const clientOrigin = useMemo(() => demoClientOrigin(), []);
  const src = useMemo(() => clientTourUrl(window.location.origin, sidePanel), [sidePanel]);
  const send = (command: ClientCommand) => sendClientCommand(iframeRef.current?.contentWindow, clientOrigin, command);
  const website = demoWebsiteUrl();

  useEffect(() => {
    const k = initKeeper(window.location);
    setReady(true);
    const wantsBroker = new URLSearchParams(window.location.search).get("broker") === "1";
    if (wantsBroker && (k.link || k.session)) {
      goBroker();
      return;
    }
    if (k.link || k.session) void ensureSession();
  }, []);

  const onMessage = useCallback((e: MessageEvent) => {
    if (phone) return; // PhoneClient listens for itself
    const m = parseClientMessage(e, clientOrigin, iframeRef.current?.contentWindow ?? null);
    if (!m) return;
    if (m.event === "client-done") goBroker();
    else setStep(m);
  }, [clientOrigin, phone]);

  useEffect(() => {
    window.addEventListener("message", onMessage);
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("resize", onResize);
    };
  }, [onMessage]);

  useEffect(() => {
    document.title = "Keystone demo";
  }, []);

  if (!ready) return null;
  if (!keeper.link && !keeper.session) return <NoDemoLink website={website} />;
  if (phone) return <PhoneClient />;

  const narrow = !sidePanel;
  const iframe = (
    <iframe
      ref={iframeRef}
      className="ksld-client-iframe"
      title="The client app"
      src={src}
      data-testid="live-demo-client-frame"
    />
  );
  if (narrow) return <div className="ksld-shell ksld-shell--narrow">{iframe}</div>;

  const name = keeper.session?.name?.trim().split(/\s+/)[0] ?? "";
  const company = keeper.session?.company?.trim() || "";
  const scale = Math.min(1, Math.max(0.5, (viewport.h - 120) / (FRAME.h + FRAME.bezel * 2)));
  const outerW = (FRAME.w + FRAME.bezel * 2) * scale;
  const outerH = (FRAME.h + FRAME.bezel * 2) * scale;
  const opening = keeper.status === "opening" || keeper.status === "waking";

  return (
    <div className="ksld-shell" data-testid="live-demo-shell">
      <header className="ksld-shell-header">
        <div className="ksld-brand"><KeystoneMark /><span>Keystone</span></div>
        <p className="ksld-greeting">
          {name ? `Hi ${name}` : "Hi"} - this is what {company ? `${company}'s` : "your"} clients and brokers would use.
        </p>
        {opening && <span className="ksld-chip" role="status">Preparing your demo…</span>}
      </header>
      <main className="ksld-shell-main">
        <div className="ksld-phone-slot" style={{ width: outerW, height: outerH }}>
          <div className="ksld-iphone ksld-iphone--frame" style={{ width: FRAME.w + FRAME.bezel * 2, height: FRAME.h + FRAME.bezel * 2, transform: `scale(${scale})` }}>
            <div className="ksld-iphone-button ksld-iphone-button--action" />
            <div className="ksld-iphone-button ksld-iphone-button--up" />
            <div className="ksld-iphone-button ksld-iphone-button--down" />
            <div className="ksld-iphone-button ksld-iphone-button--power" />
            <div className="ksld-iphone-screen ksld-iphone-screen--app">
              <div className="ksld-island" />
              <StatusBar dark={false} />
              {iframe}
              <div className="ksld-homebar ksld-homebar--dark" />
            </div>
          </div>
        </div>
        <aside className="ksld-side" aria-live="polite">
          <div className="ksld-eyebrow">You are the client</div>
          <h1 className="ksld-side-title">Sam Carter applies from his phone</h1>
          <p className="ksld-side-text">Sam owns Juniper Hollow Millwork and needs $250,000 for a new CNC router. Everything is filled in - just press Next.</p>
          <div className="ksld-side-step" data-testid="live-demo-step">
            {step?.number && step.total && !step.final ? <div className="ksld-side-step-count">Step {step.number} of {step.total}</div> : null}
            <div className="ksld-side-step-title">{step?.title ?? "Opening the client app…"}</div>
            {step?.text ? <div className="ksld-side-step-text">{step.text}</div> : null}
            {step ? (
              <div className="ksld-side-actions">
                {step.canBack ? (
                  <button type="button" className="ksld-btn ksld-btn--ghost" onClick={() => send("back")} disabled={step.busy} data-testid="live-demo-side-back">Back</button>
                ) : null}
                {step.final ? (
                  <button type="button" className="ksld-btn ksld-btn--primary" onClick={goBroker} data-testid="live-demo-side-broker">Show me the broker side</button>
                ) : (
                  <button type="button" className="ksld-btn ksld-btn--primary" onClick={() => send("next")} disabled={step.busy} data-testid="live-demo-side-next">
                    {step.busy ? "One moment…" : "Next"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </aside>
      </main>
    </div>
  );
}
