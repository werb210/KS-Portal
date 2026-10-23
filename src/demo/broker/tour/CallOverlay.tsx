// KS_PORTAL_v11_LIVE_DEMO - the broker's iPhone and Apple Watch while Sam calls: drawn in CSS and inline SVG (no
// pictures from the internet). Ringing shows who is calling and what about; answered shows the conversation as it
// happens; then "Call ended" with the AI call note.
import { useEffect, useState } from "react";
import type { CallLine } from "../fixture";
import type { CallPhase } from "./callSim";
import StatusBar from "../../StatusBar";

type Props = {
  phase: CallPhase;
  lines: CallLine[];
  startedAt: number | null;
  caller: { name: string; company: string; deal: string; phone: string };
  facts: string[];
  flag: string;
  onAnswer: () => void;
  onDecline: () => void;
};

const PhoneGlyph = ({ size = 26, down = false }: { size?: number; down?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={down ? { transform: "rotate(135deg)" } : undefined}>
    <path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
  </svg>
);

function useElapsed(startedAt: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (!startedAt) return "0:00";
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const initials = (name: string) => name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();

export default function CallOverlay({ phase, lines, startedAt, caller, facts, flag, onAnswer, onDecline }: Props) {
  const elapsed = useElapsed(phase === "connected" ? startedAt : null);
  const [transcriptEl, setTranscriptEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (transcriptEl) transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }, [lines.length, transcriptEl]);
  if (phase === "idle") return null;
  const ringing = phase === "ringing";

  return (
    <div className="ksld-call" data-testid="live-demo-call" data-phase={phase} aria-live="polite">
      {/* iPhone */}
      <div className="ksld-iphone ksld-iphone--call" role="img" aria-label={ringing ? `iPhone: incoming call from ${caller.name}` : `iPhone: call with ${caller.name}`}>
        <div className="ksld-iphone-button ksld-iphone-button--action" />
        <div className="ksld-iphone-button ksld-iphone-button--up" />
        <div className="ksld-iphone-button ksld-iphone-button--down" />
        <div className="ksld-iphone-button ksld-iphone-button--power" />
        <div className={`ksld-iphone-screen ksld-callscreen ksld-callscreen--${phase}`}>
          <div className="ksld-island" />
          <StatusBar />
          <div className="ksld-callscreen-head">
            <div className="ksld-callscreen-sub">{ringing ? "mobile" : phase === "connected" ? elapsed : phase === "declined" ? "Declined" : "Call ended"}</div>
            <div className="ksld-callscreen-name">{caller.name}</div>
            <div className="ksld-callscreen-sub">{caller.company}</div>
          </div>
          {ringing && (
            <div className="ksld-callcard">
              <div className="ksld-callcard-title">{caller.deal}</div>
              {facts.map((f) => <div key={f} className="ksld-callcard-line">{f}</div>)}
              <div className="ksld-callcard-flag">{flag}</div>
            </div>
          )}
          {!ringing && (
            <div className="ksld-transcript" ref={setTranscriptEl} data-testid="live-demo-transcript">
              {lines.length === 0 && phase === "connected" && <div className="ksld-transcript-wait">Connected - listening…</div>}
              {lines.map((l) => (
                <div key={l.at} className={`ksld-bubble ksld-bubble--${l.speaker}`}>
                  <span className="ksld-bubble-who">{l.speaker === "broker" ? "You" : "Sam"}</span>
                  {l.text}
                </div>
              ))}
              {phase === "ended" && <div className="ksld-transcript-done">AI call note added to the file</div>}
            </div>
          )}
          {ringing ? (
            <div className="ksld-callbuttons">
              <button type="button" className="ksld-roundbtn ksld-roundbtn--decline" onClick={onDecline} aria-label="Decline on the iPhone">
                <PhoneGlyph down />
                <span>Decline</span>
              </button>
              <button type="button" className="ksld-roundbtn ksld-roundbtn--accept" onClick={onAnswer} aria-label="Accept on the iPhone">
                <PhoneGlyph />
                <span>Accept</span>
              </button>
            </div>
          ) : phase === "connected" ? (
            <div className="ksld-callbuttons ksld-callbuttons--live">
              <div className="ksld-roundbtn ksld-roundbtn--end" aria-hidden="true"><PhoneGlyph down /></div>
            </div>
          ) : null}
          <div className="ksld-homebar" />
        </div>
      </div>

      {/* Apple Watch */}
      <div className="ksld-watch" role="img" aria-label={ringing ? `Apple Watch: ${caller.name} calling` : "Apple Watch"}>
        <div className="ksld-watch-band ksld-watch-band--top" />
        <div className="ksld-watch-case">
          <div className="ksld-watch-crown" />
          <div className="ksld-watch-side" />
          <div className={`ksld-watch-screen${ringing ? " ksld-watch-screen--ringing" : ""}`}>
            <div className="ksld-watch-time">9:41</div>
            <div className="ksld-watch-avatar">{initials(caller.name)}</div>
            <div className="ksld-watch-name">{caller.name}</div>
            <div className="ksld-watch-sub">{ringing ? caller.company : phase === "connected" ? elapsed : "Call ended"}</div>
            {ringing ? (
              <div className="ksld-watch-buttons" aria-hidden="true">
                <span className="ksld-watch-btn ksld-watch-btn--decline"><PhoneGlyph size={16} down /></span>
                <span className="ksld-watch-btn ksld-watch-btn--accept"><PhoneGlyph size={16} /></span>
              </div>
            ) : phase === "connected" ? (
              <div className="ksld-watch-wave" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}</div>
            ) : null}
          </div>
        </div>
        <div className="ksld-watch-band ksld-watch-band--bottom" />
      </div>
    </div>
  );
}
