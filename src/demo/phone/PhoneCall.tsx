// KS_PORTAL_v13_PHONE_DEMO - on a phone the client's call is the phone itself ringing: the iPhone call screen fills the
// screen above the guidance sheet (no drawn iPhone, Apple Watch or softphone). Ringing shows who is calling with the file
// card ($250,000 equipment, 6 of 6 documents, the fraud flag) and Accept / Decline; answered shows the conversation as it
// is transcribed. The call itself runs in the portal (callSim); this screen presses its buttons through the bridge.
import { useEffect, useState } from "react";
import type { TourSnapshot } from "../broker/tour/bridge";

const PhoneGlyph = ({ down = false }: { down?: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" style={down ? { transform: "rotate(135deg)" } : undefined}>
    <path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
  </svg>
);

function useElapsed(startedAt: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return "0:00";
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type PhoneCallProps = {
  call: TourSnapshot["call"];
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
};

export default function PhoneCall({ call, onAccept, onDecline, onEnd }: PhoneCallProps) {
  const { phase, lines, caller, facts, flag } = call;
  const elapsed = useElapsed(phase === "connected" ? call.startedAt : null);
  const [transcriptEl, setTranscriptEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (transcriptEl) transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }, [lines.length, transcriptEl]);
  const ringing = phase === "ringing";
  return (
    <div className={`ksld-pc ksld-pc--${phase}`} data-testid="live-demo-phone-call" data-phase={phase} aria-live="polite">
      <div className="ksld-pc-head">
        <div className="ksld-pc-sub">{ringing ? "Incoming call · mobile" : phase === "connected" ? elapsed : phase === "declined" ? "Call declined" : "Call ended"}</div>
        <div className="ksld-pc-name">{caller.name}</div>
        <div className="ksld-pc-sub">{caller.company}</div>
      </div>
      {ringing ? (
        <div className="ksld-pc-card" data-testid="live-demo-call-card">
          <div className="ksld-pc-card-title">{caller.deal}</div>
          {facts.map((f) => <div key={f} className="ksld-pc-card-line">{f}</div>)}
          <div className="ksld-pc-flag">{flag}</div>
          <div className="ksld-pc-also">Also rings on your Apple Watch and in the portal.</div>
        </div>
      ) : (
        <div className="ksld-pc-transcript" ref={setTranscriptEl} data-testid="live-demo-transcript">
          {lines.length === 0 && phase === "connected" ? <div className="ksld-pc-wait">Connected - listening…</div> : null}
          {lines.map((l) => (
            <div key={l.at} className={`ksld-pc-bubble ksld-pc-bubble--${l.speaker}`}>
              <span className="ksld-pc-who">{l.speaker === "broker" ? "You" : "Sam"}</span>
              {l.text}
            </div>
          ))}
          {phase === "declined" ? <div className="ksld-pc-wait">Sam can leave a voicemail - the file keeps moving.</div> : null}
        </div>
      )}
      {ringing ? (
        <div className="ksld-pc-buttons">
          <button type="button" className="ksld-pc-round ksld-pc-round--decline" onClick={onDecline} data-testid="live-demo-call-decline">
            <span className="ksld-pc-disc"><PhoneGlyph down /></span>
            <span>Decline</span>
          </button>
          <button type="button" className="ksld-pc-round ksld-pc-round--accept" onClick={onAccept} data-testid="live-demo-call-accept">
            <span className="ksld-pc-disc"><PhoneGlyph /></span>
            <span>Accept</span>
          </button>
        </div>
      ) : phase === "connected" ? (
        <div className="ksld-pc-buttons ksld-pc-buttons--live">
          <button type="button" className="ksld-pc-round ksld-pc-round--decline" onClick={onEnd} data-testid="live-demo-call-end">
            <span className="ksld-pc-disc"><PhoneGlyph down /></span>
            <span>End call</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
