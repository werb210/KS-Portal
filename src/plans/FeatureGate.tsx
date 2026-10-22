// KS_PORTAL_v3_PLANS - <FeatureGate feature="call_summaries">...</FeatureGate> shows its children when the licensee's
// plan (or trial) includes the feature, and a friendly locked card otherwise: what the feature does, which plans
// include it, and - for an Admin while the trial is available - a button that starts the 14-day trial of everything.
// While the plan is unknown (not loaded, 404, offline) everything is allowed, so nothing is locked by mistake.
import { useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { featureInfo, includedInText, PLAN_LABEL, type PlanKey } from "@/plans/catalogue";
import { trialOfferText, featureLabel, hasFeature, requestUpgrade, requiredPlan, startTrial, usePlan } from "@/plans/planStore";
import { PlanBadge, PlanLink, primaryButton, secondaryButton, useIsAdmin } from "@/plans/ui";

export const TRIAL_CTA = "Try every feature free for 14 days";

/** Locked-feature body, shared by FeatureGate, the 402 upsell dialog and compact gates. */
export function LockedFeature({ feature, compact = false, planOverride, trialAvailableOverride, onDone }: {
  feature: string;
  compact?: boolean;
  planOverride?: PlanKey | null;
  trialAvailableOverride?: boolean;
  onDone?: () => void;
}) {
  const state = usePlan();
  const isAdmin = useIsAdmin();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const plan = planOverride ?? requiredPlan(feature, state);
  const label = featureLabel(feature, state);
  const description = featureInfo(feature)?.description ?? "";
  const trialAvailable = state.trial.status === "available" || (trialAvailableOverride === true && state.trial.status !== "used" && state.trial.status !== "active");
  const trialUsed = state.trial.status === "used";

  const onTrial = async () => {
    setBusy(true);
    setMsg(null);
    const r = await startTrial();
    setBusy(false);
    if (r.ok) {
      try { toast.success("Your 14-day trial has started. Every feature is on."); } catch { /* no toaster */ }
      onDone?.();
    } else {
      setMsg(r.error ?? "Could not start the trial.");
    }
  };
  const onUpgrade = async () => {
    setBusy(true);
    setMsg(null);
    const r = await requestUpgrade(plan);
    setBusy(false);
    setMsg(r.ok ? `Upgrade to ${PLAN_LABEL[plan]} requested. We will be in touch to switch your plan.` : (r.error ?? "Could not send the request."));
  };

  const actions = isAdmin ? (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {trialAvailable ? (
        <button type="button" style={compact ? { ...primaryButton, padding: "4px 10px", fontSize: 12 } : primaryButton} disabled={busy} onClick={() => void onTrial()}>
          {busy ? "Starting…" : TRIAL_CTA}
        </button>
      ) : (
        <button type="button" style={compact ? { ...secondaryButton, padding: "4px 10px", fontSize: 12 } : secondaryButton} disabled={busy} onClick={() => void onUpgrade()}>
          {`Request ${PLAN_LABEL[plan]}`}
        </button>
      )}
      <PlanLink onClick={onDone} style={{ fontSize: compact ? 12 : 13 }}>See plans</PlanLink>
    </div>
  ) : (
    <div style={{ fontSize: compact ? 12 : 13, color: "var(--ui-text)" }}>Ask your administrator to turn this on.</div>
  );

  if (compact) {
    return (
      <div data-testid={`feature-locked-${feature}`} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 6, padding: "6px 10px", border: "1px dashed var(--ui-border)", borderRadius: 8, fontSize: 12, color: "var(--ui-text)" }}>
        <span><strong>{label}</strong><PlanBadge plan={plan} /> <span style={{ color: "var(--ui-text-muted)" }}>{includedInText(plan)}.</span></span>
        {actions}
        {msg && <span role="status" style={{ color: "var(--ui-text)" }}>{msg}</span>}
      </div>
    );
  }

  return (
    <section
      data-testid={`feature-locked-${feature}`}
      style={{ maxWidth: 620, padding: 20, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)" }}
    >
      <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ui-text)" }}>
        {label}<PlanBadge plan={plan} />
      </h3>
      {description && <p style={{ margin: "0 0 8px", fontSize: 14, lineHeight: 1.5, color: "var(--ui-text)" }}>{description}</p>}
      <p style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, color: "var(--ui-text)" }}>{includedInText(plan)}.</p>
      {trialAvailable && isAdmin && (
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ui-text)" }}>
          {trialOfferText(state)} No card needed.
        </p>
      )}
      {trialUsed && isAdmin && <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ui-text)" }}>Your free trial has been used.</p>}
      {actions}
      {msg && <p role="status" style={{ margin: "10px 0 0", fontSize: 13, color: "var(--ui-text)" }}>{msg}</p>}
    </section>
  );
}

export default function FeatureGate({ feature, children, compact = false, fallback }: {
  feature: string;
  children: ReactNode;
  /** One-line locked note for small spots (a timeline card) instead of the full card. */
  compact?: boolean;
  /** Render this instead of the locked card. */
  fallback?: ReactNode;
}) {
  const state = usePlan();
  if (hasFeature(feature, state)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return <LockedFeature feature={feature} compact={compact} />;
}

/** The badge to show next to a tab or nav item for a feature this licensee does not have (null when it has it). */
export function useLockedBadgePlan(feature: string): PlanKey | null {
  const state = usePlan();
  return hasFeature(feature, state) ? null : requiredPlan(feature, state);
}

/** Badge element for a tab/nav label; nothing when the feature is included. */
export function LockedBadge({ feature }: { feature: string }) {
  const plan = useLockedBadgePlan(feature);
  return plan ? <PlanBadge plan={plan} /> : null;
}
