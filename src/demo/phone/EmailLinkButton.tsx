// KS_PORTAL_v13_PHONE_DEMO - "Email me the link for my computer": KS-Ops re-sends the demo link to the address the demo
// was asked for (rate-limited there) and the screen confirms where it went ("Sent to t***@example.com"). The person can
// carry on on the phone either way.
import { useEffect, useState } from "react";
import { DemoApiError, emailDemoLink } from "../demoApi";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; to: string } | { kind: "error"; message: string };

/** One state for the whole page, so the start screen and the sheet agree once it has been sent. */
let shared: State = { kind: "idle" };
const subs = new Set<(s: State) => void>();
function setShared(s: State): void {
  shared = s;
  for (const fn of subs) fn(s);
}

/** Tests only. */
export function __resetEmailLink(): void {
  shared = { kind: "idle" };
}

export default function EmailLinkButton({ variant }: { variant: "button" | "link" }) {
  const [state, setState] = useState<State>(shared);
  // Follow the shared state (another copy of this button may send it).
  useEffect(() => {
    const fn = (s: State) => setState(s);
    subs.add(fn);
    setState(shared);
    return () => {
      subs.delete(fn);
    };
  }, []);

  const send = async () => {
    if (shared.kind === "sending") return;
    setShared({ kind: "sending" });
    try {
      const r = await emailDemoLink();
      setShared({ kind: "sent", to: r.sentTo });
    } catch (e) {
      setShared({ kind: "error", message: e instanceof DemoApiError || e instanceof Error ? e.message : "We couldn't send it just now." });
    }
  };

  if (state.kind === "sent") {
    return (
      <p className={`ksld-ph-emailed ksld-ph-emailed--${variant}`} role="status" data-testid="live-demo-email-sent">
        Sent to {state.to}. Open it on your computer, or carry on here.
      </p>
    );
  }
  const label = state.kind === "sending" ? "Sending…" : "Email me the link for my computer";
  return (
    <div className={`ksld-ph-email ksld-ph-email--${variant}`}>
      <button
        type="button"
        className={variant === "button" ? "ksld-ph-btn ksld-ph-btn--ghost ksld-ph-btn--block" : "ksld-ph-link"}
        onClick={() => void send()}
        disabled={state.kind === "sending"}
        data-testid="live-demo-email-link"
      >
        {label}
      </button>
      {state.kind === "error" ? <p className="ksld-ph-email-error" role="alert">{state.message}</p> : null}
    </div>
  );
}
