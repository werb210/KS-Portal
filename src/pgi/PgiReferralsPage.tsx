// KS_PORTAL_v9_PGI - "PGI referrals": every application referred to the insurance partner, with its status, the
// documents still missing, unread partner messages and the referral fee once a policy binds.
import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { pgiApi, money, statusStyle, type PgiListRow } from "@/pgi/pgiApi";
import { Chip } from "@/pgi/PgiTab";
import { PGI_PARTNER_NAME, PGI_REFERRAL_FEE_PERCENT } from "@/pgi/partner";

const th: CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "var(--ui-text-muted)", borderBottom: "1px solid var(--ui-border)", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "10px", fontSize: 14, color: "var(--ui-text)", borderBottom: "1px solid var(--ui-border)", verticalAlign: "top" };

export default function PgiReferralsPage() {
  const [rows, setRows] = useState<PgiListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pgiApi.list()
      .then((r) => setRows(r.referrals ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Could not load PGI referrals."));
  }, []);

  const earned = (rows ?? []).filter((r) => r.referral_fee_amount != null);
  const total = earned.reduce((n, r) => n + Number(r.referral_fee_amount ?? 0), 0);

  return (
    <div style={{ padding: 24, color: "var(--ui-text)", maxWidth: 1100 }} data-testid="pgi-referrals-page">
      <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>PGI referrals</h1>
      <p style={{ fontSize: 14, color: "var(--ui-text-muted)", margin: "0 0 16px" }}>
        Personal Guarantee Insurance is placed by our insurance partner, {PGI_PARTNER_NAME}. You earn {PGI_REFERRAL_FEE_PERCENT}% of the partner's commission on every policy that binds.
        {earned.length > 0 && <> Referral fees recorded so far: <strong data-testid="pgi-fee-total">{money(total, earned[0]?.referral_fee_currency ?? "CAD")}</strong>.</>}
      </p>
      {error && <p role="alert">{error}</p>}
      {rows === null && !error && <p>Loading...</p>}
      {rows !== null && rows.length === 0 && <p data-testid="pgi-empty">No PGI referrals yet. They appear here when a client ticks PGI or you refer a file from its PGI insurance tab.</p>}
      {rows !== null && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Application</th>
                <th style={th}>Status</th>
                <th style={th}>Documents missing</th>
                <th style={th}>Messages</th>
                <th style={th}>Referral fee</th>
                <th style={th}>Referred by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.application_id} data-testid={`pgi-row-${r.application_id}`}>
                  <td style={td}>
                    <Link to={`/applications/${r.application_id}/pgi`} style={{ color: "var(--ui-text)", fontWeight: 600 }}>{r.application_name || "Untitled application"}</Link>
                    {r.bi_application_code && <div style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>Ref {r.bi_application_code}</div>}
                  </td>
                  <td style={td}><Chip {...statusStyle(r.status)} /></td>
                  <td style={td}>{r.missing_count > 0 ? r.missing_count : "None"}</td>
                  <td style={td}>{r.unread_count > 0 ? <strong>{r.unread_count} new</strong> : "-"}</td>
                  <td style={td}>{r.referral_fee_amount != null ? money(r.referral_fee_amount, r.referral_fee_currency ?? "CAD") : "-"}</td>
                  <td style={td}>{r.referring_user_name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
