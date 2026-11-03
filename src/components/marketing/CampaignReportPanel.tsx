// KS_PORTAL_MARKETING_ADDON - Marketing > Campaign report: every email and text campaign with sent, opened, clicked and
// unsubscribed (every plan); with the Marketing add-on, the applications started and deals funded by the people each
// campaign reached within 90 days, and the amount funded. A/B tests show both subject lines and the winner.
import { useEffect, useState } from "react";
import { api } from "@/api";
import { AddonLocked, MARKETING_SEATS, useMarketingTool } from "@/plans/marketing";

type Ab = { subjectB?: string; winner?: "A" | "B"; results?: Record<"A" | "B", { sent: number; opened: number; clicked: number }>; phase?: string };
export type CampaignRow = {
  id: string; channel: "email" | "sms"; name: string; status: string; sent_at: string; sent: number;
  opened: number | null; clicked: number | null; unsubscribed: number | null; open_rate: number | null; click_rate: number | null;
  ab?: Ab | null; send_time?: string | null; fallback_emails?: number;
  applications?: number; funded?: number; funded_amount?: number;
  /** BF-Server v885: false for email campaigns sent before per-campaign tracking started (their "-" means unknown). */
  tracked?: boolean;
};
type Report = { days: number; attribution_days: number; funded_included: boolean; tracking_note?: string | null; totals?: { sent: number; applications: number; funded: number; funded_amount: number }; campaigns: CampaignRow[] };

const cell = { padding: "6px 8px", borderTop: "1px solid var(--ui-border)", textAlign: "left" as const, color: "var(--ui-text)", fontSize: 13 };
const pct = (v: number | null) => (v === null ? "" : ` (${v}%)`);
const n = (v: number | null | undefined) => (v === null || v === undefined ? "-" : v.toLocaleString());
const money = (v: number) => v.toLocaleString(undefined, { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export function abSummary(ab: Ab | null | undefined): string | null {
  if (!ab?.subjectB) return null;
  if (!ab.winner) return `A/B test running: "${ab.subjectB}" is subject B. The winner goes to everyone else when the test ends.`;
  const r = ab.results;
  const rate = (v: "A" | "B") => (r && r[v].sent ? `${Math.round((r[v].opened / r[v].sent) * 100)}% opened` : "no opens yet");
  return `A/B test: subject ${ab.winner} won (A ${rate("A")}, B ${rate("B")}).`;
}

export default function CampaignReportPanel() {
  const [days, setDays] = useState(90);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    api.get<Report | { data?: Report }>(`/api/marketing/campaign-report?days=${days}`)
      .then((res) => { if (!cancelled) setReport(((res as { data?: Report })?.data ?? res) as Report); })
      .catch(() => { if (!cancelled) setError("The campaign report could not be loaded. Please try again."); });
    return () => { cancelled = true; };
  }, [days]);
  const funded = report?.funded_included === true;
  const brokerageHasIt = useMarketingTool("funded_report");
  return (
    <section className="drawer-section" data-testid="campaign-report">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <div className="drawer-section__title">Campaign report</div>
        <label className="text-sm" style={{ color: "var(--ui-text)" }}>
          Period{" "}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="border rounded px-2 py-1 text-sm" style={{ color: "var(--ui-text)", background: "var(--ui-surface-strong)", borderColor: "var(--ui-border)" }}>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
        </label>
      </div>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {!report && !error && <p style={{ color: "var(--ui-text-muted)" }}>Loading…</p>}
      {report && report.campaigns.length === 0 && <p style={{ color: "var(--ui-text-muted)" }}>No campaigns in this period yet.</p>}
      {report && report.campaigns.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                {["Campaign", "Type", "Sent", "Opened", "Clicked", "Unsubscribed", ...(funded ? ["Applications", "Funded deals", "Funded"] : [])].map((h) => (
                  <th key={h} style={{ ...cell, borderTop: "none", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.campaigns.map((c) => (
                <tr key={`${c.channel}-${c.id}`} data-testid={`campaign-${c.id}`}>
                  <td style={cell}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ color: "var(--ui-text-muted)", fontSize: 12 }}>
                      {new Date(c.sent_at).toLocaleDateString()}{c.status !== "done" ? ` · ${c.status}` : ""}{c.send_time === "best" ? " · each person's best time" : ""}
                    </div>
                    {abSummary(c.ab) && <div style={{ fontSize: 12, color: "var(--ui-text)" }}>{abSummary(c.ab)}</div>}
                    {c.tracked === false && <div data-testid={`campaign-${c.id}-untracked`} style={{ fontSize: 12, color: "var(--ui-text)" }}>Sent before opens and clicks were tracked per campaign, so those columns show "-".</div>}
                  </td>
                  <td style={cell}>{c.channel === "email" ? "Email" : "Text"}</td>
                  <td style={cell}>{n(c.sent)}</td>
                  <td style={cell}>{c.channel === "sms" ? "-" : `${n(c.opened)}${pct(c.open_rate)}`}</td>
                  <td style={cell}>{`${n(c.clicked)}${pct(c.click_rate)}`}</td>
                  <td style={cell}>{n(c.unsubscribed)}</td>
                  {funded && (
                    <>
                      <td style={cell}>{n(c.applications)}</td>
                      <td style={cell}>{n(c.funded)}</td>
                      <td style={cell}>{money(c.funded_amount ?? 0)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {report.tracking_note ? <p data-testid="campaign-tracking-note" style={{ color: "var(--ui-text)", fontSize: 13, marginTop: 8 }}>{report.tracking_note}</p> : null}
          <p style={{ color: "var(--ui-text-muted)", fontSize: 12, marginTop: 8 }}>
            {funded
              ? `Applications and funded deals: started by people a campaign reached, within ${report.attribution_days} days of the send. Someone reached by two campaigns counts for both.`
              : "Opens and clicks are counted for campaigns sent from now on."}
          </p>
        </div>
      )}
      {report && !funded && !brokerageHasIt && <div style={{ marginTop: 12 }}><AddonLocked tool="funded_report" compact /></div>}
      {report && !funded && brokerageHasIt && (
        <p style={{ marginTop: 12, fontSize: 13, color: "var(--ui-text)" }}>
          Applications and funded deals by campaign are shown to Admins and up to {MARKETING_SEATS} people with the Marketing role.
        </p>
      )}
    </section>
  );
}
