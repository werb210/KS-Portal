// KS_PORTAL_v13_PHONE_DEMO - /demo on a phone. No phone-in-a-phone: the client app fills the screen the way a real
// client sees it, and the guidance sits in a bottom sheet (at the side in landscape) that the app is laid out above, so
// it never covers what it talks about. The client app is the same /tour as on a computer, in its side-panel mode: it
// posts each step here and takes Next / Back from here.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { clientTourUrl, demoClientOrigin } from "../config";
import { parseClientMessage, sendClientCommand, type ClientCommand, type ClientMessage } from "../clientMessages";
import { getKeeper, subscribeKeeper } from "../demoApi";
import { goBroker } from "../nav";
import { exitLiveDemo } from "../broker/session";
import PhoneSheet, { type SheetAction } from "./PhoneSheet";
import EmailLinkButton from "./EmailLinkButton";
import { useViewport } from "./useViewport";

const STARTED_KEY = "ks_live_demo_phone_started";

function readStarted(): boolean {
  try {
    return window.sessionStorage.getItem(STARTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function PhoneStart({ onStart }: { onStart: () => void }) {
  const keeper = useSyncExternalStore(subscribeKeeper, getKeeper, getKeeper);
  const name = keeper.session?.name?.trim().split(/\s+/)[0] ?? "";
  const company = keeper.session?.company?.trim() || "";
  return (
    <div className="ksld-ph-start" data-testid="live-demo-phone-start">
      <div className="ksld-ph-start-card">
        <div className="ksld-brand ksld-ph-start-brand">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M9 4h14l-3 11h-8z" fill="#f59e0b" />
            <path d="M4 10l6 2 2 18H5zM28 10l-6 2-2 18h7z" fill="#93c5fd" />
            <path d="M12.5 17h7l1.5 13h-10z" fill="#e2e8f0" />
          </svg>
          <span>Keystone</span>
        </div>
        <h1 className="ksld-ph-start-title">{name ? `Hi ${name}` : "Your Keystone demo"}</h1>
        <p className="ksld-ph-start-text">
          See a real deal from both sides: first as the client on their phone, then as the broker{company ? ` at ${company}` : ""}. It takes about ten minutes - just press Next.
        </p>
        <button type="button" className="ksld-ph-btn ksld-ph-btn--primary ksld-ph-btn--block" onClick={onStart} data-testid="live-demo-phone-begin">
          Start on this phone
        </button>
        <p className="ksld-ph-start-note">The broker side is a desktop screen, so it's easier on a computer. We can send the link there:</p>
        <EmailLinkButton variant="button" />
      </div>
    </div>
  );
}

export default function PhoneClient() {
  const [started, setStarted] = useState(readStarted);
  const [step, setStep] = useState<Extract<ClientMessage, { event: "step" }> | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const clientOrigin = useMemo(() => demoClientOrigin(), []);
  const src = useMemo(() => clientTourUrl(window.location.origin, true), []);
  const vp = useViewport();
  const landscape = vp.w > vp.h;
  const send = (command: ClientCommand) => sendClientCommand(iframeRef.current?.contentWindow, clientOrigin, command);

  const onMessage = useCallback((e: MessageEvent) => {
    const m = parseClientMessage(e, clientOrigin, iframeRef.current?.contentWindow ?? null);
    if (!m) return;
    if (m.event === "client-done") goBroker();
    else setStep(m);
  }, [clientOrigin]);

  useEffect(() => {
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onMessage]);

  const start = () => {
    try {
      window.sessionStorage.setItem(STARTED_KEY, "1");
    } catch {
      /* this tab only */
    }
    setStarted(true);
  };

  const actions: SheetAction[] = [];
  if (step?.canBack) actions.push({ label: "Back", kind: "ghost", onClick: () => send("back"), disabled: step.busy, testId: "live-demo-side-back" });
  if (step?.final) actions.push({ label: "Show me the broker side", onClick: goBroker, testId: "live-demo-side-broker" });
  else actions.push({ label: step?.busy ? "One moment…" : "Next", onClick: () => send("next"), disabled: !step || step.busy, testId: "live-demo-side-next" });

  const count = step?.number && step.total && !step.final ? `You are the client · ${step.number} of ${step.total}` : step?.final ? "Client side done" : "You are the client";

  return (
    <div className={`ksld-ph${landscape ? " ksld-ph--landscape" : ""}`} data-testid="live-demo-phone" data-orientation={landscape ? "landscape" : "portrait"}>
      <div className="ksld-ph-stage ksld-ph-stage--client" data-testid="live-demo-stage">
        <iframe ref={iframeRef} className="ksld-ph-client-iframe" title="The client app" src={src} data-testid="live-demo-client-frame" />
      </div>
      <PhoneSheet
        count={count}
        title={step?.title ?? "Opening the client app…"}
        body={step?.text ? <p className="ksld-ph-text">{step.text}</p> : null}
        actions={actions}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        onExit={() => exitLiveDemo("/demo")}
      />
      {!started ? <PhoneStart onStart={start} /> : null}
    </div>
  );
}
