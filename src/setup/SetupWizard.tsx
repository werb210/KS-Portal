// KS_SETUP_WIZARD - the set-up wizard window. A guide, not a form: each step is a card that sends the person to the
// page that already does the job ("Do it now"), opens the help article in place ("Help"), and, where the portal
// cannot tell by itself, lets them "Mark done". Any step can be skipped. The server ticks steps off from the data.
// Readable on the light and dark themes: dark text on pale chips, body text in the theme's text colours.
import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "@/components/ui/Modal";
import { primaryButton, secondaryButton } from "@/plans/ui";
import { HelpArticle } from "@/pages/help/HelpCenter";
import { setupError, type SetupRole, type SetupStep, type StepStatus } from "./setupApi";
import { useSetupStore } from "./setupStore";

const HEADING: Record<SetupRole, string> = {
  admin: "Set up your brokerage",
  broker: "Get set up as a broker",
  marketing: "Get set up for marketing",
};
const INTRO: Record<SetupRole, string> = {
  admin: "A few steps to get your brokerage ready. Each one opens the page where you do it. Steps tick themselves off when they are done.",
  broker: "A few steps to get you ready to work with clients. Each one opens the page where you do it.",
  marketing: "A few steps to get your marketing ready. Each one opens the page where you do it.",
};

const CHIP: Record<StepStatus, { label: string; style: CSSProperties }> = {
  done: { label: "Done", style: { background: "#dcfce7", color: "#14532d", borderColor: "#86efac" } },
  todo: { label: "To do", style: { background: "#dbeafe", color: "#1e3a8a", borderColor: "#93c5fd" } },
  skipped: { label: "Skipped", style: { background: "#f1f5f9", color: "#334155", borderColor: "#cbd5e1" } },
};

const chipBase: CSSProperties = { display: "inline-block", border: "1px solid", borderRadius: 999, padding: "2px 10px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" };
const optionalChip: CSSProperties = { ...chipBase, background: "#fef3c7", color: "#78350f", borderColor: "#fcd34d", fontWeight: 600 };
const button: CSSProperties = { minHeight: 40, fontSize: 14 };
const primary: CSSProperties = { ...primaryButton, ...button };
const secondary: CSSProperties = { ...secondaryButton, ...button };
const quiet: CSSProperties = { ...secondary, background: "transparent" };
const card = (status: StepStatus): CSSProperties => ({
  border: "1px solid var(--ui-border)",
  borderLeft: `4px solid ${status === "done" ? "#16a34a" : status === "skipped" ? "#94a3b8" : "#2563eb"}`,
  borderRadius: 12,
  background: "var(--ui-surface-strong)",
  color: "var(--ui-text)",
  padding: "14px 16px",
  marginBottom: 12,
});
const why: CSSProperties = { margin: "4px 0 10px", fontSize: 14, lineHeight: 1.5, color: "var(--ui-text-muted)" };
const errorBox: CSSProperties = { background: "#fef2f2", color: "#7f1d1d", border: "1px solid #fca5a5", borderRadius: 8, padding: "6px 10px", fontSize: 14, marginTop: 8 };

export function StatusChip({ status }: { status: StepStatus }) {
  const c = CHIP[status];
  return <span style={{ ...chipBase, ...c.style }} data-testid="setup-status">{c.label}</span>;
}

export function SetupProgress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ margin: "4px 0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, color: "var(--ui-text)", marginBottom: 6 }}>
        <span>{done} of {total} done</span>
        <span>{pct}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Set-up progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} steps done`}
        style={{ height: 10, borderRadius: 999, background: "var(--ui-surface-muted, #e2e8f0)", border: "1px solid var(--ui-border)", overflow: "hidden" }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: "#2563eb", borderRadius: 999, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

export function StepCard({ step, number, onDo, onHelp, onStatus, busy }: {
  step: SetupStep;
  number: number;
  onDo: (step: SetupStep) => void;
  onHelp: (slug: string) => void;
  onStatus: (step: SetupStep, status: StepStatus) => void;
  busy: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const titleId = `setup-step-${step.key}`;
  const primaryLabel = step.external_url ? "Open your client app" : step.link ? "Do it now" : "Show me how";
  const copy = () => {
    if (!step.external_url) return;
    void navigator.clipboard?.writeText(step.external_url).then(() => setCopied(true)).catch(() => setCopied(false));
  };
  return (
    <li style={card(step.status)} data-testid={`setup-step-${step.key}`} aria-labelledby={titleId}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h4 id={titleId} style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ui-text)", lineHeight: 1.35, flex: "1 1 220px" }}>
          <span aria-hidden="true" style={{ color: "var(--ui-text-muted)", marginRight: 6 }}>{number}.</span>
          {step.title}
        </h4>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {step.optional && <span style={optionalChip}>Optional</span>}
          <StatusChip status={step.status} />
        </span>
      </div>
      <p style={why}>{step.why}</p>
      {step.external_url && (
        <p style={{ ...why, marginTop: -4, color: "var(--ui-text)", overflowWrap: "anywhere" }}>
          Your client app: <strong>{step.external_url}</strong>
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={step.status === "done" ? secondary : primary} onClick={() => onDo(step)}>{step.status === "done" && step.link && !step.external_url ? "Open" : primaryLabel}</button>
        {step.external_url && <button type="button" style={secondary} onClick={copy}>{copied ? "Link copied" : "Copy the link"}</button>}
        {step.help_slug && (step.link || step.external_url) && <button type="button" style={secondary} onClick={() => onHelp(step.help_slug)}>Help</button>}
        {step.status === "todo" && step.can_mark_done && (
          <button type="button" style={secondary} disabled={busy} onClick={() => onStatus(step, "done")}>Mark done</button>
        )}
        {step.status === "todo" && <button type="button" style={quiet} disabled={busy} onClick={() => onStatus(step, "skipped")}>Skip</button>}
        {step.status === "skipped" && <button type="button" style={quiet} disabled={busy} onClick={() => onStatus(step, "todo")}>Put back on my list</button>}
        {step.status === "done" && step.can_mark_done && !step.auto && (
          <button type="button" style={quiet} disabled={busy} onClick={() => onStatus(step, "todo")}>Not done yet</button>
        )}
      </div>
    </li>
  );
}

export default function SetupWizard() {
  const navigate = useNavigate();
  const { wizard, open, setOpen, setStatus, dismiss } = useSetupStore();
  const [helpSlug, setHelpSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open || !wizard) return null;

  const close = () => { setHelpSlug(null); setError(null); setOpen(false); };
  const onDo = (step: SetupStep) => {
    if (step.external_url) {
      window.open(step.external_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!step.link) {
      setHelpSlug(step.help_slug);
      return;
    }
    close();
    navigate(step.link);
  };
  const onStatus = async (step: SetupStep, status: StepStatus) => {
    setBusy(true);
    setError(null);
    try {
      await setStatus(step.key, status);
    } catch (e) {
      setError(setupError(e, "Could not save that. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  const onDismiss = async () => {
    setError(null);
    try {
      await dismiss();
      setHelpSlug(null);
    } catch (e) {
      setError(setupError(e, "Could not save that. Please try again."));
    }
  };

  return (
    <Modal title={HEADING[wizard.role]} onClose={close}>
      <div data-testid="setup-wizard" style={{ color: "var(--ui-text)" }}>
        {helpSlug ? (
          <HelpArticle slug={helpSlug} onBack={() => setHelpSlug(null)} backLabel="Back to set-up" />
        ) : (
          <>
            <p style={{ margin: "8px 0 12px", fontSize: 15, lineHeight: 1.5, color: "var(--ui-text)" }}>{INTRO[wizard.role]}</p>
            <SetupProgress done={wizard.done} total={wizard.total} />
            {wizard.complete && (
              <p role="status" style={{ background: "#dcfce7", color: "#14532d", border: "1px solid #86efac", borderRadius: 8, padding: "8px 12px", fontSize: 14, fontWeight: 600 }}>
                You are all set. You can come back here any time from Set-up in the menu.
              </p>
            )}
            {error && <div role="alert" style={errorBox}>{error}</div>}
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Set-up steps">
              {wizard.steps.map((s, i) => (
                <StepCard key={s.key} step={s} number={i + 1} busy={busy} onDo={onDo} onHelp={setHelpSlug} onStatus={(st, v) => void onStatus(st, v)} />
              ))}
            </ol>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {!wizard.dismissed && !wizard.complete
                ? <button type="button" style={quiet} onClick={() => void onDismiss()}>Don&apos;t show this again</button>
                : <span />}
              <button type="button" style={secondary} onClick={close}>{wizard.complete ? "Close" : "I'll finish later"}</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
