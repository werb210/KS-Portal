// KS_PORTAL_v13_QUICKBOOKS - Settings -> Company -> QuickBooks Online (Admins). Connect / Disconnect the licensee's
// own QuickBooks company, show the status, and pick the tax code for fee invoice lines. Greyed out, with the reason,
// when the server has no QBO_* settings. Signed media fee agreements then become QuickBooks invoices, marked paid at
// funding (see KS-server docs/QUICKBOOKS.md).
import { useEffect, useState, type CSSProperties } from "react";
import { quickbooksApi, type QuickBooksStatus, type TaxCode } from "@/api/quickbooks";
import { primaryButton } from "@/plans/ui";

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16 };
const muted: CSSProperties = { color: "var(--ui-text-muted)", fontSize: 13, margin: "4px 0 0" };
const secondary: CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface-strong)", color: "var(--ui-text)", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const disabled: CSSProperties = { ...primaryButton, background: "#cbd5e1", borderColor: "#cbd5e1", color: "#1e293b", cursor: "not-allowed" };
// Dark text on a light tint: readable on the light and dark portal themes.
const errorBox: CSSProperties = { background: "#fef2f2", color: "#7f1d1d", border: "1px solid #fca5a5", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 8 };
const okBox: CSSProperties = { background: "#ecfdf5", color: "#064e3b", border: "1px solid #6ee7b7", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 8 };
const select: CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface-input, var(--ui-surface))", color: "var(--ui-text)", fontSize: 14, minWidth: 220 };

/** The ?quickbooks=connected|error&reason=... the server's callback sends the admin back with. */
export function callbackMessage(search: string): { ok: boolean; text: string } | null {
  const q = new URLSearchParams(search);
  const outcome = q.get("quickbooks");
  if (outcome === "connected") return { ok: true, text: "QuickBooks is connected." };
  if (outcome === "error") {
    const reason = q.get("reason") ?? "";
    const why = reason === "state" ? "the sign-in link expired or was already used. Try again." : reason === "exchange" ? "QuickBooks did not accept the sign-in. Try again." : reason === "access_denied" ? "access was not allowed in QuickBooks." : reason || "unknown error.";
    return { ok: false, text: "QuickBooks was not connected: " + why };
  }
  return null;
}

export default function QuickBooksCard() {
  const [status, setStatus] = useState<QuickBooksStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(() => (typeof window !== "undefined" ? callbackMessage(window.location.search) : null));
  const [taxCodes, setTaxCodes] = useState<TaxCode[] | null>(null);

  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => quickbooksApi.status()).then((s) => {
      if (!live) return;
      if (!s || typeof s !== "object" || typeof s.configured !== "boolean") { setFailed(true); return; }
      setStatus(s);
      if (s.connected) Promise.resolve().then(() => quickbooksApi.taxCodes()).then((t) => live && setTaxCodes(Array.isArray(t?.taxCodes) ? t.taxCodes : [])).catch(() => live && setTaxCodes([]));
    }).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  if (failed) return null; // an older server without QuickBooks: the card does not show
  if (!status) return <p role="status" style={{ color: "var(--ui-text)" }}>Loading QuickBooks…</p>;

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await quickbooksApi.connect();
      if (r?.url) window.location.assign(r.url);
      else setMessage({ ok: false, text: "The server did not return a QuickBooks sign-in link." });
    } catch (err) {
      setMessage({ ok: false, text: "Could not start the QuickBooks sign-in: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect QuickBooks? New fee invoices stop until it is connected again.")) return;
    setBusy(true);
    try {
      await quickbooksApi.disconnect();
      setStatus({ ...status, connected: false, status: null, companyName: null, realmId: null, connectedAt: null, taxCodeId: null, taxCodeName: null });
      setTaxCodes(null);
      setMessage({ ok: true, text: "QuickBooks is disconnected." });
    } catch (err) {
      setMessage({ ok: false, text: "Could not disconnect: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  };

  const saveTaxCode = async (id: string) => {
    const code = taxCodes?.find((t) => t.id === id) ?? null;
    setBusy(true);
    try {
      const s = await quickbooksApi.saveSettings(id || null, code?.name ?? null);
      if (s && typeof s === "object") setStatus(s);
      setMessage({ ok: true, text: id ? `Fee lines use the tax code ${code?.name ?? id}.` : "Fee lines use no tax code." });
    } catch (err) {
      setMessage({ ok: false, text: "Could not save the tax code: " + (err instanceof Error ? err.message : String(err)) });
    } finally {
      setBusy(false);
    }
  };

  const off = !status.configured;
  const needsReconnect = status.status === "reauth_required";
  return (
    <section style={{ ...card, opacity: off ? 0.75 : 1 }} data-testid="quickbooks-card" aria-disabled={off || undefined}>
      <h3 style={{ margin: 0, fontSize: 16, color: "var(--ui-text)" }}>QuickBooks Online</h3>
      <p style={muted}>
        When a client signs the media fee agreement, an invoice for the fee is created in your QuickBooks. When the deal
        is funded, the invoice moves to the funded amount and is marked paid.
      </p>
      {off ? (
        <>
          <p style={{ ...muted, color: "var(--ui-text)" }} data-testid="quickbooks-off-reason">{status.reason ?? "QuickBooks is not set up on this server yet."}</p>
          <button type="button" style={{ ...disabled, marginTop: 10 }} disabled>Connect QuickBooks</button>
        </>
      ) : status.connected ? (
        <>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--ui-text)" }}>
            Connected to <strong>{status.companyName ?? `company ${status.realmId}`}</strong>
            {status.environment === "sandbox" ? " (sandbox)" : ""}
            {status.connectedAt ? ` since ${new Date(status.connectedAt).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}` : ""}.
          </p>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--ui-text)" }}>
            Tax code on fee lines (optional)
            <select style={select} value={status.taxCodeId ?? ""} disabled={busy || !taxCodes} onChange={(e) => void saveTaxCode(e.target.value)} aria-label="Tax code on fee lines">
              <option value="">None</option>
              {(taxCodes ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              {status.taxCodeId && !(taxCodes ?? []).some((t) => t.id === status.taxCodeId) && <option value={status.taxCodeId}>{status.taxCodeName ?? status.taxCodeId}</option>}
            </select>
          </label>
          <div style={{ marginTop: 12 }}><button type="button" style={secondary} disabled={busy} onClick={() => void disconnect()}>Disconnect</button></div>
        </>
      ) : (
        <>
          {needsReconnect && <div role="alert" style={errorBox}>{status.lastError ?? "QuickBooks needs to be connected again."}</div>}
          <button type="button" style={{ ...primaryButton, marginTop: 10 }} disabled={busy} onClick={() => void connect()}>
            {needsReconnect ? "Reconnect QuickBooks" : "Connect QuickBooks"}
          </button>
        </>
      )}
      {message && <div role={message.ok ? "status" : "alert"} style={message.ok ? okBox : errorBox}>{message.text}</div>}
    </section>
  );
}
