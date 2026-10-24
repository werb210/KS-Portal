// KS_PORTAL_v13 - the strip on the application card under "Back to pipeline":
//   - Calculator: the loan amortization calculator, amount pre-filled from the requested amount; Save to file adds
//     the result as a note on the application (the existing notes API; the Notes tab reloads when opened).
//   - QuickBooks: the fee invoice's number, amount and status, with Retry when the last sync failed. Shows only when
//     QuickBooks is set up on the server and this application has an invoice row.
import { useEffect, useState, type CSSProperties } from "react";
import LoanCalculatorPanel from "@/components/loanCalculator/LoanCalculatorPanel";
import { createApplicationNote } from "@/api/applicationNotes";
import { invoiceLine, quickbooksApi, type InvoiceView } from "@/api/quickbooks";

const btn: CSSProperties = {
  border: "1px solid var(--ui-border)", borderRadius: 8, padding: "5px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  background: "var(--ui-surface-strong)", color: "var(--ui-text-soft)", fontFamily: "inherit",
};
// Dark text on a light tint: readable on the light and dark portal themes.
const okChip: CSSProperties = { background: "#ecfdf5", color: "#064e3b", border: "1px solid #6ee7b7", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 };
const badChip: CSSProperties = { background: "#fef2f2", color: "#7f1d1d", border: "1px solid #fca5a5", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 };

export function requestedAmountOf(application: Record<string, any> | null | undefined): number | null {
  if (!application) return null;
  const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" ? (v as Record<string, any>) : {});
  const candidates = [
    obj(application.overview).requestedAmount, obj(application.fundingRequest).amount, obj(application.financialProfile ?? application.kyc).fundingAmount,
    application.requested_amount, application.requestedAmount,
  ];
  for (const c of candidates) {
    const n = Number(String(c ?? "").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function businessNameOf(application: Record<string, any> | null | undefined): string | null {
  const b = (application?.businessDetails ?? application?.business ?? {}) as Record<string, any>;
  const name = b.legalName ?? b.name ?? b.companyName ?? null;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

export function QuickBooksInvoiceStatus({ applicationId }: { applicationId: string }) {
  const [view, setView] = useState<InvoiceView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setView(null);
    // A server without QuickBooks, or a failed read, simply shows nothing.
    Promise.resolve().then(() => quickbooksApi.invoice(applicationId)).then((v) => { if (live && v && typeof v === "object") setView(v); }).catch(() => undefined);
    return () => { live = false; };
  }, [applicationId]);

  if (!view?.configured || !view.invoice) return null;
  const inv = view.invoice;
  const failed = inv.syncStatus === "failed" || inv.syncStatus === "retrying";

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const r = await quickbooksApi.retry(applicationId);
      if (r && typeof r === "object") setView({ configured: r.configured, connected: r.connected, invoice: r.invoice });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span data-testid="quickbooks-invoice" style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={failed ? badChip : okChip} title={inv.lastError ?? undefined}>QuickBooks: {invoiceLine(inv)}</span>
      {failed && inv.lastError && <span style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>{inv.lastError}</span>}
      {inv.canRetry && <button type="button" style={btn} disabled={busy} onClick={() => void retry()}>{busy ? "Retrying..." : "Retry"}</button>}
      {error && <span role="alert" style={badChip}>{error}</span>}
    </span>
  );
}

export default function ApplicationCardActions({ applicationId, application }: { applicationId: string; application: Record<string, any> | null }) {
  const [open, setOpen] = useState(false);
  if (!applicationId) return null;
  return (
    <>
      <button type="button" style={btn} onClick={() => setOpen(true)} data-testid="open-loan-calculator">Calculator</button>
      <QuickBooksInvoiceStatus applicationId={applicationId} />
      {open && (
        <LoanCalculatorPanel
          onClose={() => setOpen(false)}
          initialAmount={requestedAmountOf(application)}
          subtitle={businessNameOf(application)}
          onSaveNote={(body) => createApplicationNote(applicationId, body)}
        />
      )}
    </>
  );
}
