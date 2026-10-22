// KS_PORTAL_v8_DEMO - the portal screens the demo walks through: pipeline, file overview, documents with the fraud
// check, financials, credit summary, and the lender match list with submit. Data comes from the demo server only.
import { useEffect, useRef, useState } from "react";
import { chipStyle } from "@/fraud/status";
import type { DemoClient, DemoDocument, DemoState, LenderMatch } from "./demoApi";

const money = (n: number | null | undefined) => (n == null ? "-" : `$${Math.round(n).toLocaleString("en-CA")}`);

export function Chip({ status, label }: { status: string; label?: string }) {
  const s = chipStyle(status);
  return <span className="ksd-chip" data-status={status} style={{ background: s.bg, color: s.fg, borderColor: s.border }}>{label ?? s.label}</span>;
}

const FIT: Record<LenderMatch["fit"], [string, string]> = { strong: ["green", "Strong fit"], possible: ["amber", "Possible"], poor: ["red", "Poor fit"] };
const DECISION: Record<string, [string, string]> = { pending: ["not_applicable", "Waiting for you"], accepted: ["green", "Accepted"], rejected: ["red", "Rejected"] };

export function PipelinePanel({ state, onOpen }: { state: DemoState; onOpen: () => void }) {
  const app = state.application;
  const status = !app || app.status === "draft" ? null : app.submitted_at ? "lenders" : "review";
  const prev = useRef(state.documents.length);
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (state.documents.length > prev.current) {
      setFresh(true);
      const t = window.setTimeout(() => setFresh(false), 4000);
      prev.current = state.documents.length;
      return () => window.clearTimeout(t);
    }
    prev.current = state.documents.length;
    return undefined;
  }, [state.documents.length]);
  const red = state.documents.some((d) => d.fraud_status === "red");
  const card = app && (
    <button type="button" className="ksd-appcard" onClick={onOpen} data-testid="pipeline-card">
      <div className="ksd-row" style={{ justifyContent: "space-between" }}>
        <strong>{app.business.legal_name}</strong>
        {fresh && <span className="ksd-live">LIVE</span>}
      </div>
      <div className="ksd-small ksd-muted">{money(app.request.amount)} {String(app.request.product).toLowerCase()}</div>
      <div className="ksd-row ksd-small" style={{ marginTop: 6 }}>
        <span>{state.documents.length}/{state.expected_documents.length} documents</span>
        {red && <Chip status="red" label="Fraud flag" />}
      </div>
    </button>
  );
  return (
    <div>
      <h2 style={{ fontSize: 20 }}>Pipeline</h2>
      <div className="ksd-board">
        <div className="ksd-col"><h3>New</h3>{!status && <p className="ksd-small ksd-muted">Waiting for your borrower to send their first document...</p>}</div>
        <div className="ksd-col"><h3>In review</h3>{status === "review" && card}</div>
        <div className="ksd-col"><h3>With lenders</h3>{status === "lenders" && card}</div>
      </div>
    </div>
  );
}

export function OverviewPanel({ state }: { state: DemoState }) {
  const app = state.application;
  if (!app) return null;
  return (
    <div>
      <h2 style={{ fontSize: 20 }}>{app.business.legal_name} <span className="ksd-small ksd-muted">(sample)</span></h2>
      <div className="ksd-grid2" style={{ marginBottom: 14 }}>
        <div className="ksd-stat"><span className="ksd-small ksd-muted">Request</span><b>{money(app.request.amount)}</b><span className="ksd-small">{app.request.product}, {app.request.term_months} months</span></div>
        <div className="ksd-stat"><span className="ksd-small ksd-muted">Owner</span><b style={{ fontSize: 16 }}>{app.contact.name}</b><span className="ksd-small">{app.contact.phone} · {app.contact.email}</span></div>
        <div className="ksd-stat"><span className="ksd-small ksd-muted">Business</span><b style={{ fontSize: 16 }}>{app.business.years_in_business} years</b><span className="ksd-small">{app.business.industry}, {app.business.city} {app.business.province}</span></div>
      </div>
      <p className="ksd-small">{app.request.purpose}</p>
      <h3 style={{ marginTop: 14 }}>Notes</h3>
      {app.notes.length === 0 ? <p className="ksd-small ksd-muted">No notes yet. Call notes appear here automatically.</p> : app.notes.map((n, i) => (
        <div key={i} className="ksd-doc" data-testid="file-note">
          <div className="ksd-row" style={{ justifyContent: "space-between" }}><strong>{n.author}</strong><span className="ksd-small ksd-muted">{new Date(n.at).toLocaleString()}</span></div>
          <p style={{ margin: "4px 0" }}>{n.body}</p>
          {n.points && <ul className="ksd-reasons">{n.points.map((p) => <li key={p}>{p}</li>)}</ul>}
          {n.follow_up && <p className="ksd-small" style={{ marginTop: 6, fontWeight: 600 }}>{n.follow_up}</p>}
        </div>
      ))}
    </div>
  );
}

function DocumentRow({ d, api, onChanged }: { d: DemoDocument; api: DemoClient; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("Edited copy - please send the original statement downloaded from your bank.");
  const reasons = [...(d.tamper?.reasons ?? []), ...(d.statement_math?.reasons ?? [])];
  const flagged = reasons.filter((r) => r.severity !== "info");
  const shown = flagged.length ? flagged : reasons.slice(0, 1);
  const decide = async (decision: "accepted" | "rejected") => {
    setBusy(true);
    try { await api.decide(d.id, decision, decision === "rejected" ? reason : undefined); onChanged(); setRejecting(false); } finally { setBusy(false); }
  };
  const preview = async () => {
    void api.track("opened_document_preview", "documents");
    const blob = await api.documentFile(d.id);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const [decStatus, decLabel] = DECISION[d.status] ?? DECISION.pending!;
  return (
    <div className={`ksd-doc ${d.fraud_status === "red" ? "ksd-doc-red" : ""}`} data-testid={`doc-${d.sample_key}`}>
      <div className="ksd-row" style={{ justifyContent: "space-between" }}>
        <strong>{d.label}</strong>
        <div className="ksd-row">
          <span className="ksd-small ksd-muted">Fraud check:</span> <Chip status={d.fraud_status ?? "not_applicable"} />
          <Chip status={decStatus} label={decLabel} />
        </div>
      </div>
      <div className="ksd-small ksd-muted">From the {d.uploaded_via === "screen" ? "borrower (on screen)" : "borrower's phone"} · {Math.round(d.size_bytes / 1024)} KB</div>
      {shown.length > 0 && (
        <ul className="ksd-reasons">
          {shown.map((r, i) => <li key={i} style={{ fontWeight: r.severity === "red" ? 700 : 400 }}>{r.severity === "red" ? "Concern: " : r.severity === "amber" ? "Check: " : ""}{r.text}</li>)}
        </ul>
      )}
      {d.reject_reason && <p className="ksd-small" style={{ marginTop: 6 }}>Rejected: {d.reject_reason}</p>}
      <div className="ksd-row" style={{ marginTop: 8 }}>
        <button type="button" className="ksd-btn" onClick={() => void preview()}>Preview</button>
        {d.status !== "accepted" && <button type="button" className="ksd-btn ksd-btn-success" disabled={busy} onClick={() => void decide("accepted")}>Accept</button>}
        {d.status !== "rejected" && !rejecting && <button type="button" className="ksd-btn ksd-btn-danger" disabled={busy} onClick={() => setRejecting(true)}>Reject</button>}
      </div>
      {rejecting && (
        <form className="ksd-row" style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); void decide("rejected"); }}>
          <label className="ksd-small" htmlFor={`rr-${d.id}`} style={{ width: "100%" }}>Reason the borrower will see</label>
          <input id={`rr-${d.id}`} className="ksd-input" style={{ flex: 1, minWidth: 200 }} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          <button type="submit" className="ksd-btn ksd-btn-danger" disabled={busy}>Reject</button>
          <button type="button" className="ksd-btn" onClick={() => setRejecting(false)}>Cancel</button>
        </form>
      )}
    </div>
  );
}

export function DocumentsPanel({ state, api, onChanged }: { state: DemoState; api: DemoClient; onChanged: () => void }) {
  const got = new Set(state.documents.map((d) => d.sample_key));
  const missing = state.expected_documents.filter((e) => !got.has(e.key));
  return (
    <div>
      <h2 style={{ fontSize: 20 }}>Documents</h2>
      <p className="ksd-small ksd-muted">Every file is scanned as it arrives: metadata and editing software, fonts, page images, and for bank statements every running balance and the opening-to-closing total. Results are hints for you to review, never a verdict.</p>
      {state.documents.length === 0 && <p className="ksd-muted">No documents yet - upload them as the borrower first.</p>}
      {state.documents.map((d) => <DocumentRow key={d.id} d={d} api={api} onChanged={onChanged} />)}
      {missing.length > 0 && state.documents.length > 0 && <p className="ksd-small ksd-muted">Still to come: {missing.map((m) => m.label).join(", ")}.</p>}
    </div>
  );
}

export function FinancialsPanel({ state, api, onChanged }: { state: DemoState; api: DemoClient; onChanged: () => void }) {
  const app = state.application;
  const [busy, setBusy] = useState(false);
  if (!app) return null;
  const [cur, prev] = app.financials.years;
  if (!cur || !prev) return null;
  const rows: Array<[string, keyof typeof cur, boolean?]> = [
    ["Revenue", "revenue"], ["Cost of goods sold", "cogs"], ["Gross profit", "gross_profit", true], ["Operating expenses", "operating_expenses"],
    ["EBITDA", "ebitda", true], ["Net income before tax", "net_income", true], ["Current assets", "current_assets"], ["Current liabilities", "current_liabilities"],
    ["Total assets", "total_assets"], ["Total liabilities", "total_liabilities"], ["Shareholder equity", "equity", true], ["Existing debt payments (yearly)", "existing_debt_service"],
  ];
  const pct = (a: number, b: number) => `${((a / b) * 100).toFixed(1)}%`;
  return (
    <div>
      <h2 style={{ fontSize: 20 }}>Financials</h2>
      <p className="ksd-small ksd-muted">{app.financials.basis}, {app.financials.prepared_by}.</p>
      <div style={{ overflowX: "auto" }}>
        <table className="ksd-table">
          <thead><tr><th>Line</th><th className="ksd-num">FY{cur.year}</th><th className="ksd-num">FY{prev.year}</th><th className="ksd-num">Change</th></tr></thead>
          <tbody>
            {rows.map(([label, key, strong]) => {
              const a = Number(cur[key]), b = Number(prev[key]);
              return (
                <tr key={label} style={{ fontWeight: strong ? 700 : 400 }}>
                  <td>{label}</td><td className="ksd-num">{money(a)}</td><td className="ksd-num">{money(b)}</td>
                  <td className="ksd-num">{b ? `${a >= b ? "+" : ""}${pct(a - b, b)}` : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="ksd-grid2" style={{ marginTop: 14 }}>
        <div className="ksd-stat"><span className="ksd-small ksd-muted">Gross margin</span><b>{pct(cur.gross_profit, cur.revenue)}</b></div>
        <div className="ksd-stat"><span className="ksd-small ksd-muted">EBITDA margin</span><b>{pct(cur.ebitda, cur.revenue)}</b></div>
        <div className="ksd-stat"><span className="ksd-small ksd-muted">Current ratio</span><b>{(cur.current_assets / cur.current_liabilities).toFixed(2)}</b></div>
        <div className="ksd-stat"><span className="ksd-small ksd-muted">Debt to equity</span><b>{(cur.total_liabilities / cur.equity).toFixed(2)}</b></div>
      </div>
      <div className="ksd-row" style={{ marginTop: 14 }}>
        {app.financials_reviewed_at ? <Chip status="green" label="Reviewed" /> : (
          <button type="button" className="ksd-btn ksd-btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { await api.reviewFinancials(); onChanged(); } finally { setBusy(false); } }}>Mark financials reviewed</button>
        )}
      </div>
    </div>
  );
}

export function CreditPanel({ state, api, onChanged }: { state: DemoState; api: DemoClient; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const cs = state.application?.credit_summary;
  const build = async () => { setBusy(true); try { await api.buildCreditSummary(); onChanged(); } finally { setBusy(false); } };
  return (
    <div>
      <div className="ksd-row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>Credit summary</h2>
        {!state.application?.submitted_at && <button type="button" className="ksd-btn ksd-btn-primary" disabled={busy} onClick={() => void build()}>{cs ? "Rebuild" : "Build credit summary"}</button>}
      </div>
      {!cs ? <p className="ksd-muted" style={{ marginTop: 12 }}>Not built yet. It uses the documents you accepted, the fraud findings and the call note - so decide on the documents first.</p> : (
        <div style={{ marginTop: 12 }} data-testid="credit-summary">
          <p style={{ fontWeight: 700 }}>{cs.headline}</p>
          <div className="ksd-grid2">
            <div className="ksd-stat"><span className="ksd-small ksd-muted">Debt service coverage</span><b>{cs.financial_snapshot.dscr.toFixed(2)}x</b></div>
            <div className="ksd-stat"><span className="ksd-small ksd-muted">New payment (est.)</span><b>{money(cs.financial_snapshot.proposed_payment_monthly)}/mo</b><span className="ksd-small">at {cs.financial_snapshot.assumed_rate_pct}%</span></div>
            <div className="ksd-stat"><span className="ksd-small ksd-muted">Revenue growth</span><b>{cs.financial_snapshot.revenue_growth_pct}%</b></div>
            <div className="ksd-stat"><span className="ksd-small ksd-muted">Avg monthly deposits</span><b>{money(cs.banking.avg_monthly_deposits)}</b></div>
          </div>
          <p className="ksd-small" style={{ marginTop: 10 }}>{cs.banking.revenue_check}</p>
          <h3 style={{ marginTop: 12 }}>Strengths</h3><ul className="ksd-reasons">{cs.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
          {cs.risks.length > 0 && (<><h3 style={{ marginTop: 12 }}>Risks</h3><ul className="ksd-reasons">{cs.risks.map((s) => <li key={s}>{s}</li>)}</ul></>)}
          <h3 style={{ marginTop: 12 }}>Conditions</h3><ul className="ksd-reasons">{cs.conditions.map((s) => <li key={s}>{s}</li>)}</ul>
          <p style={{ marginTop: 12, fontWeight: 700 }}>Recommendation: {cs.recommendation}</p>
        </div>
      )}
    </div>
  );
}

export function LendersPanel({ state, api, onChanged }: { state: DemoState; api: DemoClient; onChanged: () => void }) {
  const app = state.application;
  const submitted = Boolean(app?.submitted_at);
  const [picked, setPicked] = useState<string[]>(app?.selected_lenders ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ emailed_to: string; lenders: string[] } | null>(null);
  useEffect(() => { setPicked(app?.selected_lenders ?? []); }, [app?.selected_lenders]);
  const toggle = async (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    if (next.length > 4) { setError("Pick up to four lenders."); return; }
    setError(null);
    setPicked(next);
    try { await api.selectLenders(next); onChanged(); } catch (err) { setError(err instanceof Error ? err.message : "Could not save."); }
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try { setResult(await api.submit()); onChanged(); } catch (err) { setError(err instanceof Error ? err.message : "Could not submit."); } finally { setBusy(false); }
  };
  const download = async () => {
    void api.track("downloaded_package", "submit");
    const blob = await api.packagePdf();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Lender-Submission-Package-SAMPLE.pdf";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  return (
    <div>
      <h2 style={{ fontSize: 20 }}>Lender match</h2>
      <p className="ksd-small ksd-muted">Every lender scored against this file. These lenders are fictional.</p>
      {state.lenders.map((l) => {
        const [fitStatus, fitLabel] = FIT[l.fit];
        return (
          <div key={l.id} className="ksd-doc" data-testid={`lender-${l.id}`}>
            <label className="ksd-check">
              <input type="checkbox" checked={picked.includes(l.id)} disabled={submitted} onChange={() => void toggle(l.id)} aria-label={`Send to ${l.name}`} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="ksd-row" style={{ justifyContent: "space-between" }}>
                  <strong>{l.name}</strong>
                  <span className="ksd-row"><span className="ksd-score" aria-hidden="true"><span style={{ width: `${l.score}%` }} /></span><span className="ksd-small">{l.score}/100</span><Chip status={fitStatus} label={fitLabel} /></span>
                </span>
                <span className="ksd-small ksd-muted" style={{ display: "block" }}>{l.product} · {l.rate} · {l.term} · {l.note}</span>
                <ul className="ksd-reasons">
                  {l.blockers.map((b) => <li key={b} style={{ fontWeight: 700 }}>Does not fit: {b}</li>)}
                  {l.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}
                </ul>
              </span>
            </label>
          </div>
        );
      })}
      {error && <p role="alert" style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</p>}
      <div className="ksd-card" style={{ marginTop: 12 }}>
        {submitted ? (
          <div data-testid="submitted">
            <h3>Sent to {(result?.lenders ?? state.lenders.filter((l) => app?.selected_lenders.includes(l.id)).map((l) => l.name)).join(", ")}</h3>
            <p>The lender package is on its way to <strong>{result?.emailed_to ?? state.session.email}</strong>. In a live file, each lender gets it with a secure link and you see when they open it.</p>
            {app?.has_package && <button type="button" className="ksd-btn" onClick={() => void download()}>Download the package</button>}
          </div>
        ) : (
          <>
            <h3>Submit to lenders</h3>
            <p className="ksd-small">{picked.length ? `${picked.length} lender${picked.length === 1 ? "" : "s"} picked.` : "Pick at least one lender above."} Keystone builds the package from the credit summary, the call note and the documents you accepted.</p>
            <button type="button" className="ksd-btn ksd-btn-primary" disabled={busy || picked.length === 0} onClick={() => void submit()}>{busy ? "Building the package..." : `Submit to ${picked.length || ""} lender${picked.length === 1 ? "" : "s"}`.replace("  ", " ")}</button>
          </>
        )}
      </div>
    </div>
  );
}
