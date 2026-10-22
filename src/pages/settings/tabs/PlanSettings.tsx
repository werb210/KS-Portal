// KS_PORTAL_v3_PLANS - Settings -> Plan: the licensee's plan, what it includes, its allowances, a Starter / Growth /
// Pro comparison, the 14-day trial and upgrade requests (Admins). KS_PORTAL_v3_STORAGE adds the pooled document
// storage meter and the "Add 50 GB" request.
import { useState, type CSSProperties } from "react";
import toast from "react-hot-toast";
import {
  FEATURES, PLAN_ALLOWANCES, PLAN_LABEL, PLAN_ORDER, STARTER_BASICS, STORAGE_BLOCK_GB, STORAGE_BLOCK_PRICE_TEXT,
  formatBytes, planRank, type PlanKey,
} from "@/plans/catalogue";
import { trialOfferText, featureLabel, hasFeature, requestUpgrade, startTrial, usePlan, type PlanState } from "@/plans/planStore";
import { TRIAL_CTA } from "@/plans/FeatureGate";
import { daysLeftText } from "@/plans/PlanBanners";
import { PlanBadge, primaryButton, secondaryButton, useIsAdmin } from "@/plans/ui";

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16 };
const h3: CSSProperties = { margin: "0 0 10px", fontSize: 16, color: "var(--ui-text)" };
const muted: CSSProperties = { color: "var(--ui-text-muted)", fontSize: 13 };
const cell: CSSProperties = { padding: "7px 10px", borderTop: "1px solid var(--ui-border)", fontSize: 13, color: "var(--ui-text)", textAlign: "left" };

const fmtDate = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
};
const n = (v: number | null, unit: string): string => (v === null ? "-" : `${v.toLocaleString()} ${unit}`);

/** Amber at 80%, red at 100% (readable dark-on-light labels; the bar itself is a solid colour). */
export function storageTone(percent: number): { bar: string; label: string } {
  if (percent >= 100) return { bar: "#b91c1c", label: "Full" };
  if (percent >= 80) return { bar: "#b45309", label: "Almost full" };
  return { bar: "#1d4ed8", label: "" };
}

function StorageMeter({ state, isAdmin }: { state: PlanState; isAdmin: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const s = state.storage;
  if (!s) return null;
  const tone = storageTone(s.percent);
  const width = Math.min(100, Math.max(0, s.percent));
  const add = async () => {
    setBusy(true);
    const r = await requestUpgrade(state.plan, 1);
    setBusy(false);
    setMsg(r.ok ? `Request sent for ${STORAGE_BLOCK_GB} GB more storage. We will add it and update your bill.` : (r.error ?? "Could not send the request."));
  };
  return (
    <section style={card} data-testid="plan-storage">
      <h3 style={h3}>Document storage</h3>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 14, marginBottom: 6 }}>
        <span><strong>{formatBytes(s.used_bytes)}</strong> of {formatBytes(s.allowance_bytes)} used ({Math.floor(s.percent)}%)</span>
        {tone.label && <strong style={{ color: "var(--ui-text)" }}>{tone.label}</strong>}
      </div>
      <div
        role="meter"
        aria-label="Document storage used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(width)}
        style={{ height: 12, borderRadius: 999, background: "#e2e8f0", overflow: "hidden", border: "1px solid #cbd5e1" }}
      >
        <div data-testid="plan-storage-bar" style={{ width: `${width}%`, height: "100%", background: tone.bar }} />
      </div>
      <p style={{ ...muted, margin: "8px 0 0" }}>
        Storage is shared by your whole team
        {state.allowances.storage_gb_per_seat !== null ? ` (${state.allowances.storage_gb_per_seat} GB per seat${s.seats ? ` × ${s.seats} seats` : ""})` : ""}
        {s.extra_blocks > 0 ? `, plus ${s.extra_blocks * STORAGE_BLOCK_GB} GB extra` : ""}. Uploads are never blocked.
      </p>
      {isAdmin && (
        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" style={secondaryButton} disabled={busy} onClick={() => void add()}>
            {`Add ${STORAGE_BLOCK_GB} GB for ${STORAGE_BLOCK_PRICE_TEXT}`}
          </button>
          {msg && <span role="status" style={{ fontSize: 13 }}>{msg}</span>}
        </div>
      )}
    </section>
  );
}

function ComparisonTable({ state }: { state: PlanState }) {
  const mark = (on: boolean) => (on ? <span aria-label="Included">✓</span> : <span aria-label="Not included" style={{ color: "var(--ui-text-muted)" }}>-</span>);
  const head = (p: PlanKey) => (
    <th key={p} style={{ ...cell, borderTop: "none", fontWeight: 700 }}>
      {PLAN_LABEL[p]}{p === state.plan && state.source === "server" ? " (yours)" : ""}
    </th>
  );
  const chats = (p: PlanKey) => (PLAN_ALLOWANCES[p].chats === null ? "Unlimited" : PLAN_ALLOWANCES[p].chats!.toLocaleString());
  return (
    <section style={card}>
      <h3 style={h3}>Compare plans</h3>
      <div style={{ overflowX: "auto" }}>
        <table data-testid="plan-comparison" style={{ borderCollapse: "collapse", width: "100%", minWidth: 480 }}>
          <thead><tr><th style={{ ...cell, borderTop: "none" }}>Feature</th>{PLAN_ORDER.map(head)}</tr></thead>
          <tbody>
            {STARTER_BASICS.map((b) => (
              <tr key={b}><td style={cell}>{b}</td>{PLAN_ORDER.map((p) => <td key={p} style={cell}>{mark(true)}</td>)}</tr>
            ))}
            {FEATURES.map((f) => (
              <tr key={f.key}>
                <td style={cell}>{featureLabel(f.key, state)}</td>
                {PLAN_ORDER.map((p) => <td key={p} style={cell}>{mark(planRank(p) >= planRank(f.plan))}</td>)}
              </tr>
            ))}
            <tr><td style={cell}>Assistant chats per month</td>{PLAN_ORDER.map((p) => <td key={p} style={cell}>{chats(p)}</td>)}</tr>
            <tr><td style={cell}>Call minutes per seat</td>{PLAN_ORDER.map((p) => <td key={p} style={cell}>{PLAN_ALLOWANCES[p].minutes.toLocaleString()}</td>)}</tr>
            <tr><td style={cell}>Texts per seat</td>{PLAN_ORDER.map((p) => <td key={p} style={cell}>{PLAN_ALLOWANCES[p].texts.toLocaleString()}</td>)}</tr>
            <tr><td style={cell}>Document storage per seat (shared)</td>{PLAN_ORDER.map((p) => <td key={p} style={cell}>{`${PLAN_ALLOWANCES[p].storageGb} GB`}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <p style={{ ...muted, margin: "8px 0 0" }}>{`Extra document storage: ${STORAGE_BLOCK_PRICE_TEXT} per ${STORAGE_BLOCK_GB} GB.`}</p>
    </section>
  );
}

export default function PlanSettings() {
  const state = usePlan();
  const isAdmin = useIsAdmin();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const trialActive = state.trial.status === "active";
  const a = state.allowances;

  const onTrial = async () => {
    setBusy("trial");
    setMsg(null);
    const r = await startTrial();
    setBusy(null);
    if (r.ok) {
      setMsg("Your 14-day trial has started. Every feature is on.");
      try { toast.success("Your 14-day trial has started."); } catch { /* no toaster */ }
    } else setMsg(r.error ?? "Could not start the trial.");
  };
  const onUpgrade = async (p: PlanKey) => {
    setBusy(p);
    setMsg(null);
    const r = await requestUpgrade(p);
    setBusy(null);
    setMsg(r.ok ? `Upgrade to ${PLAN_LABEL[p]} requested. We will be in touch to switch your plan.` : (r.error ?? "Could not send the request."));
  };
  const higher = PLAN_ORDER.filter((p) => planRank(p) > planRank(state.plan));

  return (
    <div style={{ maxWidth: 860, color: "var(--ui-text)" }} data-testid="plan-settings">
      <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>Plan</h2>

      {state.source !== "server" ? (
        <section style={card}>
          <p style={{ margin: 0, fontSize: 14 }}>Plan details are not available right now. Every feature is switched on in the meantime.</p>
        </section>
      ) : (
        <section style={card} data-testid="plan-current">
          <div style={{ fontSize: 15 }}>
            Your plan: <strong>{PLAN_LABEL[state.plan]}</strong><PlanBadge plan={state.plan} />
          </div>
          {trialActive && (
            <p style={{ margin: "8px 0 0", fontSize: 14 }}>
              <strong>{daysLeftText(state.trial.days_left)}</strong>
              {state.trial.ends_at ? ` (ends ${fmtDate(state.trial.ends_at)})` : ""}. You have every Growth and Pro feature until then.
            </p>
          )}
          {state.trial.status === "used" && <p style={{ margin: "8px 0 0", ...muted }}>Your free trial has been used.</p>}

          {isAdmin && state.trial.status === "available" && (
            <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: "#e0e7ff", color: "#1e1b4b", border: "1px solid #a5b4fc" }}>
              <p style={{ margin: "0 0 10px", fontSize: 14 }}>
                {trialOfferText(state)} You can only do this once.
              </p>
              <button type="button" style={primaryButton} disabled={busy !== null} onClick={() => void onTrial()}>
                {busy === "trial" ? "Starting…" : TRIAL_CTA}
              </button>
            </div>
          )}
          {isAdmin && higher.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {higher.map((p) => (
                <button key={p} type="button" style={secondaryButton} disabled={busy !== null} onClick={() => void onUpgrade(p)}>
                  {`Request upgrade to ${PLAN_LABEL[p]}`}
                </button>
              ))}
            </div>
          )}
          {!isAdmin && higher.length > 0 && <p style={{ margin: "10px 0 0", ...muted }}>Ask your administrator about upgrading.</p>}
          {msg && <p role="status" style={{ margin: "10px 0 0", fontSize: 14 }}>{msg}</p>}
        </section>
      )}

      {state.source === "server" && (
        <section style={card} data-testid="plan-allowances">
          <h3 style={h3}>Allowances</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.8 }}>
            <li>
              Call minutes: {n(a.minutes_per_seat, "per seat")}
              {trialActive && a.trial_bonus_minutes > 0 ? ` + ${a.trial_bonus_minutes} trial bonus` : ""}
            </li>
            <li>
              Texts: {n(a.texts_per_seat, "per seat")}
              {trialActive && a.trial_bonus_texts > 0 ? ` + ${a.trial_bonus_texts} trial bonus` : ""}
            </li>
            <li>Assistant chats: {a.assistant_chats === null ? "Unlimited" : `${a.assistant_chats.toLocaleString()} per month`}</li>
            {a.storage_gb_per_seat !== null && <li>Document storage: {a.storage_gb_per_seat} GB per seat, shared by the team</li>}
          </ul>
        </section>
      )}

      <StorageMeter state={state} isAdmin={isAdmin} />

      {state.source === "server" && (
        <section style={card} data-testid="plan-included">
          <h3 style={h3}>What&apos;s included</h3>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", fontSize: 14, lineHeight: 1.9 }}>
            {FEATURES.map((f) => {
              const on = hasFeature(f.key, state);
              return (
                <li key={f.key}>
                  <span aria-hidden="true" style={{ display: "inline-block", width: 20 }}>{on ? "✓" : "–"}</span>
                  {featureLabel(f.key, state)}
                  {!on && <PlanBadge plan={f.plan} />}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ComparisonTable state={state} />
    </div>
  );
}
