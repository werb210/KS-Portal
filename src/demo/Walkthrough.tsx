// KS_PORTAL_v8_DEMO - the guided walkthrough card: step N of 9 with a progress bar, what to do, Next / Skip / Back,
// hide the tour (and bring it back), and the list of steps with done / skipped marks. Progress is saved on the demo
// server, so the prospect resumes where they left off.
import type { DemoState } from "./demoApi";
import { STEPS, stepDone, stepIndex, tourFinished, type StepKey } from "./steps";

type Props = {
  state: DemoState;
  busy: boolean;
  onAction: (action: "view" | "complete" | "skip" | "skip_tour" | "resume_tour", step?: StepKey) => void;
};

export default function Walkthrough({ state, busy, onAction }: Props) {
  const w = state.session.walkthrough;
  const finished = tourFinished(state);
  if (w.tour_skipped) {
    return (
      <section className="ksd-tour" aria-label="Guided tour (hidden)">
        <p className="ksd-small" style={{ margin: 0 }}>The guided tour is hidden. Explore on your own, or pick up where you left off.</p>
        <div className="ksd-row" style={{ marginTop: 10 }}>
          <button type="button" className="ksd-btn ksd-btn-primary" disabled={busy} onClick={() => onAction("resume_tour")}>Resume the tour</button>
        </div>
      </section>
    );
  }
  const idx = stepIndex(w.current);
  const step = STEPS[idx]!;
  const done = stepDone(step.key, state);
  const doneCount = STEPS.filter((s) => w.completed.includes(s.key)).length;
  const pct = finished ? 100 : Math.round((doneCount / STEPS.length) * 100);

  if (finished) {
    return (
      <section className="ksd-tour" aria-label="Guided tour" data-testid="tour-finished">
        <div className="ksd-tour-step">Done</div>
        <div className="ksd-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100} aria-label="Tour progress"><div style={{ width: "100%" }} /></div>
        <h2>That's Keystone.</h2>
        <p>You took a file from the borrower's phone to lenders: live documents, a fraud check that caught an edited statement, the client's call written up for you, a credit summary and a lender package. The package is on its way to {state.session.email}.</p>
        <p className="ksd-small">Want to see it with your own lenders and team? Reply to that email and we'll set up a call.</p>
        <StepList state={state} onView={(k) => onAction("view", k)} />
      </section>
    );
  }

  return (
    <section className="ksd-tour" aria-label="Guided tour" aria-live="polite" data-testid="tour">
      <div className="ksd-tour-step">Step {idx + 1} of {STEPS.length}</div>
      <div className="ksd-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Tour progress"><div style={{ width: `${pct}%` }} /></div>
      <h2>{step.title}</h2>
      <p>{step.body(state)}</p>
      {step.todo && !done && <div className="ksd-todo">To do: {step.todo}</div>}
      <div className="ksd-row">
        {idx > 0 && <button type="button" className="ksd-btn" disabled={busy} onClick={() => onAction("view", STEPS[idx - 1]!.key)}>Back</button>}
        {done ? (
          <button type="button" className="ksd-btn ksd-btn-primary" disabled={busy} onClick={() => onAction("complete", step.key)}>
            {idx === STEPS.length - 1 ? "Finish" : "Next"}
          </button>
        ) : (
          <button type="button" className="ksd-btn" disabled={busy} onClick={() => onAction("skip", step.key)}>Skip this step</button>
        )}
        <button type="button" className="ksd-btn ksd-btn-link" disabled={busy} onClick={() => onAction("skip_tour")}>Hide the tour</button>
      </div>
      <StepList state={state} onView={(k) => onAction("view", k)} />
    </section>
  );
}

function StepList({ state, onView }: { state: DemoState; onView: (k: StepKey) => void }) {
  const w = state.session.walkthrough;
  return (
    <ol className="ksd-steplist" aria-label="All steps">
      {STEPS.map((s, i) => {
        const isDone = w.completed.includes(s.key);
        const isSkipped = !isDone && w.skipped.includes(s.key);
        const now = w.current === s.key;
        return (
          <li key={s.key}>
            <span className={`ksd-dot ${isDone ? "ksd-dot-done" : isSkipped ? "ksd-dot-skip" : now ? "ksd-dot-now" : ""}`} aria-hidden="true">{isDone ? "✓" : isSkipped ? "–" : i + 1}</span>
            <button type="button" className="ksd-btn ksd-btn-link" style={{ textDecoration: now ? "underline" : "none", fontWeight: now ? 800 : 500, color: "inherit" }} onClick={() => onView(s.key)}>
              {s.title}
            </button>
            <span className="ksd-small ksd-muted">{isDone ? "done" : isSkipped ? "skipped" : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
