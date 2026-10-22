// KS_PORTAL_v8_DEMO - the simulated dialler: an iPhone and an Apple Watch beside the portal. The "client" calls; the
// phone shows who is calling with their file (amount, documents, the fraud flag) and the watch taps (a pulse). The
// prospect answers and a short scripted call plays with captions, read aloud by the browser's built-in synthetic voices
// when sound is on (never a real person's voice). When it ends, the AI call summary is written onto the file.
import { useCallback, useEffect, useRef, useState } from "react";
import type { CallLine, DemoClient, DemoState } from "./demoApi";

type Phase = "idle" | "ringing" | "in_call" | "done" | "declined";

export function callContext(state: DemoState): string[] {
  const app = state.application;
  const out: string[] = [];
  if (app) out.push(`$${Number(app.request.amount).toLocaleString("en-CA")} ${String(app.request.product).toLowerCase()}`);
  out.push(`${state.documents.length} of ${state.expected_documents.length} documents received`);
  const red = state.documents.filter((d) => d.fraud_status === "red");
  if (red.length) out.push(`Fraud flag: ${red.map((d) => d.label.replace("Bank statement - ", "")).join(", ")} statement`);
  if (app?.status) out.push(`Stage: ${app.status === "in_review" ? "In review" : app.status === "submitted_to_lenders" ? "With lenders" : "New"}`);
  return out;
}

function speak(line: CallLine, voices: SpeechSynthesisVoice[]) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(line.text);
    const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
    const pick = en.length > 1 ? en[line.speaker === "borrower" ? 1 : 0] : en[0];
    if (pick) u.voice = pick;
    u.rate = 1.05;
    u.pitch = line.speaker === "borrower" ? 0.9 : 1.1;
    synth.speak(u);
  } catch {
    /* no speech in this browser: captions carry the call */
  }
}

export default function CallSimulator({ state, api, active, onChanged }: { state: DemoState; api: DemoClient; active: boolean; onChanged: () => void }) {
  const call = state.application?.call;
  const completed = call?.status === "completed";
  const [phase, setPhase] = useState<Phase>(completed ? "done" : "idle");
  const [shown, setShown] = useState<CallLine[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [sound, setSound] = useState(true);
  const timers = useRef<number[]>([]);
  const lines = state.call_script.lines;
  const contact = state.application?.contact ?? {};
  const business = state.application?.business ?? {};

  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  useEffect(() => () => { clear(); try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }, []);
  useEffect(() => { if (completed) setPhase("done"); }, [completed]);

  // The client calls a moment after the call step opens.
  useEffect(() => {
    if (!active || completed || phase !== "idle") return;
    const t = window.setTimeout(() => { setPhase("ringing"); void api.callAction("ring").catch(() => undefined); }, 1500);
    return () => window.clearTimeout(t);
  }, [active, completed, phase, api]);

  const finish = useCallback(async () => {
    clear();
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    setShown(lines);
    await api.callAction("complete");
    setPhase("done");
    onChanged();
  }, [api, lines, onChanged]);

  const answer = async () => {
    setPhase("in_call");
    setShown([]);
    await api.callAction("answer").catch(() => undefined);
    const voices = (() => { try { return window.speechSynthesis?.getVoices() ?? []; } catch { return []; } })();
    lines.forEach((line) => {
      timers.current.push(window.setTimeout(() => {
        setShown((cur) => [...cur, line]);
        if (sound) speak(line, voices);
      }, line.at * 1000));
    });
    for (let s = 1; s <= state.call_script.duration_seconds; s++) timers.current.push(window.setTimeout(() => setElapsed(s), s * 1000));
    timers.current.push(window.setTimeout(() => { void finish(); }, (state.call_script.duration_seconds + 1) * 1000));
  };

  const decline = async () => {
    setPhase("declined");
    await api.callAction("decline").catch(() => undefined);
    onChanged();
  };

  const name = String(contact.name ?? "Your client");
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <section className="ksd-card" aria-label="Simulated phone and watch">
      <div className="ksd-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Your dialler</h3>
        <button type="button" className="ksd-btn" aria-pressed={sound} onClick={() => { setSound(!sound); if (sound) { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } } void api.track("sound_toggled", "call"); }}>
          {sound ? "Sound on" : "Sound off"}
        </button>
      </div>
      <div className="ksd-devices">
        <div className={`ksd-phone ${phase === "ringing" ? "ksd-ring" : ""}`} data-testid="demo-iphone">
          <div className="ksd-phone-island" />
          <div className="ksd-phone-screen">
            <div className="ksd-phone-body" aria-live="polite">
              {phase === "idle" && <p className="ksd-phone-muted" style={{ textAlign: "center", marginTop: 120 }}>{active ? "Waiting for a call..." : "Calls ring here during the tour."}</p>}
              {(phase === "ringing" || phase === "declined") && (
                <>
                  <p className="ksd-phone-muted" style={{ textAlign: "center", fontSize: 12 }}>{phase === "ringing" ? "Incoming call" : "Missed call"}</p>
                  <div className="ksd-call-name">{name}</div>
                  <p className="ksd-phone-muted" style={{ textAlign: "center", fontSize: 13 }}>{String(business.legal_name ?? "")}<br />{String(contact.phone ?? "")}</p>
                  {callContext(state).map((c) => <div key={c} className="ksd-call-ctx">{c}</div>)}
                </>
              )}
              {(phase === "in_call" || phase === "done") && (
                <>
                  <p className="ksd-phone-muted" style={{ textAlign: "center", fontSize: 12 }}>{phase === "done" ? "Call ended" : `On call · ${mmss}`}</p>
                  <div className="ksd-call-name" style={{ fontSize: 18 }}>{name}</div>
                  {shown.map((l, i) => (
                    <div key={i} className="ksd-caption"><b>{l.speaker === "borrower" ? `${name.split(" ")[0]}:` : "You:"}</b> {l.text}</div>
                  ))}
                </>
              )}
            </div>
            {phase === "ringing" && (
              <div className="ksd-call-btns">
                <button type="button" className="ksd-round ksd-btn-danger" onClick={() => void decline()} aria-label="Decline the call">Decline</button>
                <button type="button" className="ksd-round ksd-btn-success" onClick={() => void answer()} aria-label="Answer the call">Answer</button>
              </div>
            )}
            {phase === "in_call" && (
              <div className="ksd-call-btns">
                <button type="button" className="ksd-btn" style={{ background: "#1f2937", color: "#f9fafb", borderColor: "#374151" }} onClick={() => void finish()}>Skip to the summary</button>
              </div>
            )}
            {phase === "declined" && (
              <div className="ksd-call-btns">
                <button type="button" className="ksd-btn ksd-btn-success" onClick={() => void answer()}>Call back</button>
              </div>
            )}
          </div>
        </div>
        <div className={`ksd-watch ${phase === "ringing" ? "ksd-pulse" : ""}`} data-testid="demo-watch" aria-label={phase === "ringing" ? `Watch: ${name} calling` : "Watch"}>
          <div className="ksd-watch-crown" />
          <div className="ksd-watch-screen">
            {phase === "ringing" ? (<><strong>{name}</strong><span className="ksd-phone-muted">calling</span><span className="ksd-phone-muted" style={{ fontSize: 10 }}>{callContext(state)[0]}</span></>)
              : phase === "in_call" ? (<><strong>{mmss}</strong><span className="ksd-phone-muted">{name.split(" ")[0]}</span></>)
              : (<span className="ksd-phone-muted">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>)}
          </div>
        </div>
      </div>
      {phase === "done" && call?.summary && (
        <div style={{ marginTop: 12 }} data-testid="call-summary">
          <h4>AI call summary - added to the file</h4>
          <p style={{ fontWeight: 600 }}>{call.summary.headline}</p>
          <ul className="ksd-reasons">{call.summary.points.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="ksd-small" style={{ marginTop: 6 }}>{call.summary.follow_up}</p>
        </div>
      )}
    </section>
  );
}
