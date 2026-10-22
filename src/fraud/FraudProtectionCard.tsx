// KS_PORTAL_v7_FRAUD - Settings -> Company -> Fraud protection (Admins): the shared-watchlist opt-in (pro), whether
// the pre-screen page goes into lender packages by default (pro), which outside services are set up, and recent
// inside-job alerts (pro). Each switch saves on its own.
import { useEffect, useState, type CSSProperties } from "react";
import toast from "react-hot-toast";
import { fraudApi, type FraudSettingsView, type StaffAlert } from "@/fraud/fraudApi";
import { LockedFeature } from "@/plans/FeatureGate";
import { StatusChip } from "@/fraud/FraudTab";
import { useAddon } from "@/plans/planStore";

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16 };
const muted: CSSProperties = { color: "var(--ui-text-muted)", fontSize: 13, margin: "4px 0 0" };
const row: CSSProperties = { display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderTop: "1px solid var(--ui-border)" };

const ALERT_TEXT: Record<string, string> = {
  banking_details_changed: "changed the banking details on a file",
  approved_own_file: "moved a file they own to Accepted",
  bulk_export: "exported data in bulk",
  off_hours: "changed several files during the night",
  high_volume: "opened an unusual number of files in an hour",
};

export default function FraudProtectionCard() {
  const bankConnect = useAddon("bank_connect"); // KS_PORTAL_BANK_CONNECT_ADDON - the Flinks row only with the add-on
  const [view, setView] = useState<FraudSettingsView | null>(null);
  const [alerts, setAlerts] = useState<StaffAlert[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    // Promise.resolve: a stubbed or very old api layer that returns nothing just hides the card.
    Promise.resolve().then(() => fraudApi.settings()).then((v) => {
      if (!live) return;
      if (!v || !Array.isArray(v.allowed) || !v.settings || !Array.isArray(v.services)) { setFailed(true); return; }
      setView(v);
      if (v.allowed.includes("fraud_14")) Promise.resolve().then(() => fraudApi.staffAlerts()).then((a) => live && setAlerts(Array.isArray(a?.alerts) ? a.alerts : [])).catch(() => live && setAlerts([]));
    }).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  if (failed) return null; // older servers without the fraud suite: the card simply does not show
  if (!view) return <p role="status" style={{ color: "var(--ui-text)" }}>Loading fraud protection…</p>;
  const has = (k: string) => view.allowed.includes(k);

  const save = async (patch: { watchlist_opt_in?: boolean; include_prescreen_in_package?: boolean }) => {
    setSaving(true);
    try {
      const r = await fraudApi.saveSettings(patch);
      setView({ ...view, settings: r.settings });
      const note = r.ops && !r.ops.told && patch.watchlist_opt_in !== undefined ? " Keystone operations will be told when the link is set up." : "";
      try { toast.success(`Fraud protection saved.${note}`); } catch { /* no toaster */ }
    } catch (e) {
      try { toast.error((e as Error)?.message || "Could not save."); } catch { /* no toaster */ }
    } finally { setSaving(false); }
  };

  return (
    <section style={card} data-testid="company-section-fraud">
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--ui-text)" }}>Fraud protection</h3>
      <p style={{ ...muted, margin: "0 0 8px" }}>Every application is checked automatically. Results appear on each application's Fraud check tab.</p>

      <div style={row}>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 14 }}>Share confirmed fraud with other Keystone brokerages</strong>
          <p style={muted}>When you mark a file as fraud, scrambled codes of its phone, email, business number, address and bank account are shared - never the details themselves. New applicants are checked against what other brokerages reported. Turning this off removes everything you shared.</p>
          {!has("fraud_13") && <LockedFeature feature="fraud_13" compact />}
          {has("fraud_13") && !view.watchlist.ready && <p style={{ ...muted, color: "#78350f" }}>Not connected yet: Keystone operations still needs to set up the shared watchlist on your server.</p>}
        </div>
        {has("fraud_13") && (
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, whiteSpace: "nowrap" }}>
            <input type="checkbox" data-testid="watchlist-opt-in" checked={view.settings.watchlist_opt_in} disabled={saving} onChange={(e) => void save({ watchlist_opt_in: e.target.checked })} />
            {view.settings.watchlist_opt_in ? "On" : "Off"}
          </label>
        )}
      </div>

      <div style={row}>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 14 }}>Add the fraud pre-screen page to lender packages</strong>
          <p style={muted}>The default for new files. Staff can still change it on each application.</p>
          {!has("fraud_16") && <LockedFeature feature="fraud_16" compact />}
        </div>
        {has("fraud_16") && (
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, whiteSpace: "nowrap" }}>
            <input type="checkbox" data-testid="prescreen-default" checked={view.settings.include_prescreen_in_package} disabled={saving} onChange={(e) => void save({ include_prescreen_in_package: e.target.checked })} />
            {view.settings.include_prescreen_in_package ? "On" : "Off"}
          </label>
        )}
      </div>

      <details style={{ borderTop: "1px solid var(--ui-border)", paddingTop: 10 }}>
        <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, color: "var(--ui-text)" }}>Outside services the checks use</summary>
        <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }} data-testid="fraud-services">
          {view.services.filter((s) => bankConnect || s.key !== "bank").map((s) => (
            <li key={s.key} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "4px 0", fontSize: 13 }}>
              <StatusChip status={s.configured ? "green" : "not_configured"} />
              <span style={{ color: "var(--ui-text)" }}>{s.label}</span>
              {!s.configured && <span style={{ color: "var(--ui-text-muted)" }}>({s.setting})</span>}
            </li>
          ))}
        </ul>
        <p style={muted}>A check whose service is not set up says so on the application; it never counts as a pass.</p>
      </details>

      {has("fraud_14") && (
        <div style={{ borderTop: "1px solid var(--ui-border)", paddingTop: 10, marginTop: 10 }} data-testid="staff-alerts">
          <strong style={{ fontSize: 14 }}>Staff activity to review</strong>
          {alerts === null ? <p style={muted}>Loading…</p> : alerts.length === 0 ? <p style={muted}>Nothing unusual recorded.</p> : (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
              {alerts.slice(0, 10).map((a) => (
                <li key={a.id} style={{ color: "var(--ui-text)" }}>
                  {new Date(a.created_at).toLocaleString()} - {a.staff_name ?? "A staff member"} {ALERT_TEXT[a.kind] ?? a.kind.replace(/_/g, " ")}
                  {a.application_id && <> (<a href={`/applications/${a.application_id}/fraud`} style={{ color: "inherit", fontWeight: 700 }}>open file</a>)</>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!has("fraud_14") && <div style={{ borderTop: "1px solid var(--ui-border)", paddingTop: 10, marginTop: 10 }}><LockedFeature feature="fraud_14" compact /></div>}
    </section>
  );
}
