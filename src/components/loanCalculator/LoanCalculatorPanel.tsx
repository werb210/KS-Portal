// KS_PORTAL_v13_LOAN_CALCULATOR - the loan amortization calculator panel (opened from the application card).
// Inputs: amount (pre-filled from the requested amount), annual rate, term in months, frequency, optional down
// payment and balloon. Outputs: payment, number of payments, total interest, total cost and the full schedule.
// Actions: Download PDF, Download spreadsheet, and Save to file (adds a note to the application).
import { useMemo, useState, type CSSProperties } from "react";
import Modal from "@/components/ui/Modal";
import {
  FREQUENCIES, amortize, isoDay, money, summaryText, validateLoan, type Frequency, type LoanInput,
} from "@/lib/loanCalculator/amortization";
import { downloadFile, scheduleCsv, schedulePdf } from "@/lib/loanCalculator/exports";

type Props = {
  onClose: () => void;
  initialAmount?: number | null;
  /** Names the file in the PDF heading, e.g. the business name. */
  subtitle?: string | null;
  /** When given, "Save to file" adds the summary as a note. */
  onSaveNote?: (body: string) => Promise<unknown>;
};

const label: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: "var(--ui-text-soft)" };
const input: CSSProperties = {
  border: "1px solid var(--ui-border)", borderRadius: 8, padding: "8px 10px", fontSize: 14,
  background: "var(--ui-surface-input)", color: "var(--ui-text-soft)", fontFamily: "inherit",
};
const button: CSSProperties = { border: "1px solid var(--ui-border)", borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", background: "var(--ui-surface-strong)", color: "var(--ui-text-soft)" };
const primary: CSSProperties = { ...button, background: "#0B1F3A", color: "#ffffff", border: "1px solid #0B1F3A" };
const cell: CSSProperties = { padding: "4px 8px", textAlign: "right", whiteSpace: "nowrap", color: "var(--ui-text-soft)" };

const num = (s: string): number => Number(String(s).replace(/[^0-9.-]/g, ""));
const fileStem = (s: string | null | undefined) => (s ?? "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export default function LoanCalculatorPanel({ onClose, initialAmount, subtitle, onSaveNote }: Props) {
  const [amount, setAmount] = useState(initialAmount && initialAmount > 0 ? String(Math.round(initialAmount * 100) / 100) : "");
  const [rate, setRate] = useState("10");
  const [term, setTerm] = useState("60");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [down, setDown] = useState("");
  const [balloon, setBalloon] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const loan: LoanInput = useMemo(() => ({
    amount: num(amount), annualRatePercent: num(rate), termMonths: num(term), frequency,
    downPayment: down.trim() ? num(down) : null, balloon: balloon.trim() ? num(balloon) : null, startDate: new Date(),
  }), [amount, rate, term, frequency, down, balloon]);
  const errors = useMemo(() => validateLoan(loan), [loan]);
  const result = useMemo(() => (errors.length ? null : amortize(loan)), [errors, loan]);
  const stem = "loan-schedule" + (fileStem(subtitle) ? "-" + fileStem(subtitle) : "");

  async function save() {
    if (!result || !onSaveNote) return;
    setSaving(true);
    setMessage(null);
    try {
      await onSaveNote(summaryText(loan, result));
      setMessage({ ok: true, text: "Saved to the file's notes." });
    } catch (err) {
      setMessage({ ok: false, text: "Could not save the note: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Loan calculator" onClose={onClose}>
      <div data-testid="loan-calculator" style={{ display: "flex", flexDirection: "column", gap: 14, color: "var(--ui-text-soft)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          <label style={label}>Amount ($)<input style={input} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" /></label>
          <label style={label}>Annual rate (%)<input style={input} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Annual rate" /></label>
          <label style={label}>Term (months)<input style={input} inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Term in months" /></label>
          <label style={label}>Frequency
            <select style={input} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} aria-label="Frequency">
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label style={label}>Down payment ($, optional)<input style={input} inputMode="decimal" value={down} onChange={(e) => setDown(e.target.value)} aria-label="Down payment" /></label>
          <label style={label}>Balloon / residual ($, optional)<input style={input} inputMode="decimal" value={balloon} onChange={(e) => setBalloon(e.target.value)} aria-label="Balloon" /></label>
        </div>

        {errors.length > 0 && (
          <ul role="alert" style={{ margin: 0, padding: "8px 12px 8px 28px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", fontSize: 13 }}>
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}

        {result && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }} data-testid="loan-calculator-summary">
              {[
                ["Payment per period", money(result.payment)],
                ["Number of payments", String(result.numberOfPayments)],
                ["Total interest", money(result.totalInterest)],
                ["Total cost", money(result.totalCost)],
              ].map(([k, v]) => (
                <div key={k} style={{ border: "1px solid var(--ui-border)", borderRadius: 10, padding: "10px 12px", background: "var(--ui-surface-input)" }}>
                  <div style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>{k}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ui-text-soft)" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>
              Amount financed {money(result.financed)}. Total of payments {money(result.totalOfPayments)}
              {result.downPayment ? `, plus the ${money(result.downPayment)} down payment` : ""}.
              {result.balloon ? ` The last payment includes the ${money(result.balloon)} balloon.` : ""}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button type="button" style={button} onClick={() => downloadFile(schedulePdf(loan, result, { subtitle }), stem + ".pdf", "application/pdf")}>Download PDF</button>
              <button type="button" style={button} onClick={() => downloadFile(scheduleCsv(loan, result), stem + ".csv", "text/csv;charset=utf-8")}>Download spreadsheet</button>
              {onSaveNote && <button type="button" style={primary} disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save to file"}</button>}
            </div>
            {message && <div role="status" style={{ fontSize: 13, color: message.ok ? "var(--ui-text-success)" : "var(--ui-text-danger)" }}>{message.text}</div>}

            <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid var(--ui-border)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }} data-testid="loan-calculator-schedule">
                <thead style={{ position: "sticky", top: 0, background: "var(--ui-surface-strong)" }}>
                  <tr>{["#", "Date", "Payment", "Principal", "Interest", "Balance"].map((h) => <th key={h} style={{ ...cell, fontWeight: 700, borderBottom: "1px solid var(--ui-border)" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {result.schedule.map((s) => (
                    <tr key={s.number}>
                      <td style={cell}>{s.number}</td>
                      <td style={cell}>{isoDay(s.date)}</td>
                      <td style={cell}>{money(s.payment)}</td>
                      <td style={cell}>{money(s.principal)}</td>
                      <td style={cell}>{money(s.interest)}</td>
                      <td style={cell}>{money(s.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
