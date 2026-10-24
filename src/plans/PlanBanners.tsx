// KS_PORTAL_v3_PLANS - the bars across the top of the portal:
//  - "Pro trial: N days left" for Admins and Staff while the trial runs (amber in the last 3 days);
//  - after the trial, a dismissible recap for Admins of what the team used, with "Keep these features";
//  - KS_PORTAL_v3_STORAGE: an Admin note when document storage is 80% used or more (uploads are never blocked).
import { useState, type CSSProperties } from "react";
import { PLAN_LABEL, planRank, type PlanKey } from "@/plans/catalogue";
import { featureLabel, requestUpgrade, requiredPlan, usePlan, type PlanState } from "@/plans/planStore";
import { PlanLink, primaryButton, secondaryButton } from "@/plans/ui";

// The role comes from the caller (AppLayout already has the signed-in user) rather than from AuthContext here.
type RoleProp = { role: string | null | undefined };
const isAdminRole = (role: string | null | undefined): boolean => String(role ?? "").toLowerCase() === "admin";

const bar = (bg: string, fg: string, border: string): CSSProperties => ({
  display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "8px 14px", marginBottom: 12,
  borderRadius: 8, background: bg, color: fg, border: `1px solid ${border}`, fontSize: 13,
});
// Dark text on light tints (contrast well above 4.5:1).
const BLUE = bar("#e0e7ff", "#1e1b4b", "#a5b4fc");
const AMBER = bar("#fef3c7", "#78350f", "#f59e0b");
const RED = bar("#fee2e2", "#7f1d1d", "#f87171");

export function daysLeftText(days: number | null): string {
  if (days === null) return "Pro trial active";
  if (days <= 0) return "Pro trial: ends today";
  return `Pro trial: ${days} ${days === 1 ? "day" : "days"} left`;
}

export function TrialBanner({ role: rawRole }: RoleProp) {
  const state = usePlan();
  const role = String(rawRole ?? "").toLowerCase();
  if (state.source !== "server" || state.trial.status !== "active") return null;
  if (role !== "admin" && role !== "staff") return null;
  const days = state.trial.days_left;
  const urgent = days !== null && days <= 3;
  return (
    <div role="status" data-testid="trial-banner" data-urgent={urgent ? "true" : "false"} style={urgent ? AMBER : BLUE}>
      <strong>{daysLeftText(days)}</strong>
      <span>{state.plan === "growth" ? "Every Pro feature is on." : "Every Growth and Pro feature is on, plus bonus minutes and texts."}</span>
      <PlanLink>See your plan</PlanLink>
    </div>
  );
}

const RECAP_KEY = "ks_trial_recap_dismissed_v1";
const readDismissed = (): string | null => { try { return globalThis.localStorage?.getItem(RECAP_KEY) ?? null; } catch { return null; } };
const writeDismissed = (v: string): void => { try { globalThis.localStorage?.setItem(RECAP_KEY, v); } catch { /* storage blocked */ } };

/** "Call summaries 12×, Templates 4×" from trial_usage, most used first. */
export function usageLine(state: PlanState): string {
  return Object.entries(state.trial_usage)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${featureLabel(k, state)} ${n}×`)
    .join(", ");
}

/** Growth when everything used is in Growth, otherwise Pro. */
export function suggestedPlan(state: PlanState): PlanKey {
  const needsPro = Object.keys(state.trial_usage).some((k) => requiredPlan(k, state) === "pro");
  return needsPro ? "pro" : "growth";
}

export function TrialRecap({ role }: RoleProp) {
  const state = usePlan();
  const isAdmin = isAdminRole(role);
  const marker = state.trial.started_at ?? state.trial.ends_at ?? "trial";
  const [dismissed, setDismissed] = useState<string | null>(() => readDismissed());
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!isAdmin || state.source !== "server" || state.trial.status !== "used") return null;
  if (Object.keys(state.trial_usage).length === 0 || dismissed === marker) return null;
  if (state.effective_plan === "pro") return null;
  const suggested = suggestedPlan(state);
  const choices: PlanKey[] = (["growth", "pro"] as PlanKey[]).filter((p) => planRank(p) > planRank(state.plan));
  const dismiss = () => { writeDismissed(marker); setDismissed(marker); };
  const ask = async (plan: PlanKey) => {
    setBusy(true);
    const r = await requestUpgrade(plan);
    setBusy(false);
    setMsg(r.ok ? `Upgrade to ${PLAN_LABEL[plan]} requested. We will be in touch to switch your plan.` : (r.error ?? "Could not send the request."));
    if (r.ok) setChoosing(false);
  };
  return (
    <div role="region" aria-label="Trial recap" data-testid="trial-recap" style={BLUE}>
      <span style={{ flex: "1 1 260px" }}>
        <strong>Your trial has ended.</strong> During your trial your team used: {usageLine(state)}.
      </span>
      {!choosing && !msg && choices.length > 0 && (
        <button type="button" style={primaryButton} onClick={() => setChoosing(true)}>Keep these features</button>
      )}
      {choosing && choices.map((p) => (
        <button key={p} type="button" disabled={busy} style={p === suggested ? primaryButton : secondaryButton} onClick={() => void ask(p)}>
          {`Choose ${PLAN_LABEL[p]}`}{p === suggested ? " (covers everything you used)" : ""}
        </button>
      ))}
      {msg && <span role="status">{msg}</span>}
      <button type="button" aria-label="Dismiss" onClick={dismiss} style={{ marginLeft: "auto", border: "none", background: "transparent", color: "inherit", fontSize: 18, cursor: "pointer" }}>×</button>
    </div>
  );
}

export function StorageBanner({ role }: RoleProp) {
  const state = usePlan();
  const isAdmin = isAdminRole(role);
  const s = state.storage;
  if (!isAdmin || !s || s.percent < 80) return null;
  const full = s.percent >= 100;
  return (
    <div role="status" data-testid="storage-banner" style={full ? RED : AMBER}>
      <strong>{full ? "Document storage is full." : `Document storage is ${Math.floor(s.percent)}% used.`}</strong>
      <span>Uploads keep working. Add more storage from your plan.</span>
      <PlanLink>Manage storage</PlanLink>
    </div>
  );
}

export default function PlanBanners({ role }: RoleProp) {
  return (
    <>
      <TrialBanner role={role} />
      <TrialRecap role={role} />
      <StorageBanner role={role} />
    </>
  );
}
