// KS_PORTAL_v6_SUPPORT - "Get help": Admins and Staff send a request to the software vendor's support team
// (POST /api/support/tickets) and see their company's requests with their status. Replies go out by email.
// Reached from the sidebar ("Get help") and Settings -> Help. A 404 from the server hides the request list.
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createTicket, listTickets, type Ticket, type TicketPriority } from "@/support/supportApi";
import { primaryButton, useRole } from "@/plans/ui";
import MovingToKeystone from "@/import/MovingToKeystone"; // KS_PORTAL_v14_DATA_IMPORT

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16 };
const h3: CSSProperties = { margin: "0 0 4px", fontSize: 16, color: "var(--ui-text)" };
const muted: CSSProperties = { color: "var(--ui-text-muted)", fontSize: 13, margin: "0 0 12px" };
const labelStyle: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ui-text)", marginBottom: 4 };
const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--ui-border)",
  background: "var(--ui-surface-input, var(--ui-surface))", color: "var(--ui-text)", fontSize: 14,
};
// Dark text on light tints: readable on the light and dark portal themes.
const errorBox: CSSProperties = { background: "#fef2f2", color: "#7f1d1d", border: "1px solid #fca5a5", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 8 };
const okBox: CSSProperties = { background: "#ecfdf5", color: "#064e3b", border: "1px solid #6ee7b7", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 8 };

const STATUS_STYLE: Record<string, CSSProperties> = {
  open: { background: "#dbeafe", color: "#1e3a8a" },
  pending: { background: "#fef3c7", color: "#78350f" },
  waiting: { background: "#fef3c7", color: "#78350f" },
  resolved: { background: "#dcfce7", color: "#14532d" },
  closed: { background: "#e2e8f0", color: "#1e293b" },
};

export function statusLabel(status: string): string {
  const s = status.replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Open";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function HelpPage() {
  const role = String(useRole() ?? "").toLowerCase();
  const canUse = role === "admin" || role === "staff";
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("normal");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [listAvailable, setListAvailable] = useState(false);
  const [supportText, setSupportText] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const r = await listTickets();
    setTickets(r.tickets);
    setListAvailable(r.available);
    setSupportText(r.supportText);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (canUse) void refresh();
  }, [canUse, refresh]);

  if (!canUse) {
    return <p role="status" style={{ color: "var(--ui-text)" }}>Ask your administrator for help with the portal.</p>;
  }

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    setSent(null);
    const s = subject.trim();
    const b = body.trim();
    if (!s || !b) {
      setError("Please add a subject and describe what you need help with.");
      return;
    }
    setSending(true);
    const r = await createTicket({ subject: s, body: b, priority });
    setSending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setSubject("");
    setBody("");
    setPriority("normal");
    setSent("Thanks - your request has been sent. We'll reply by email.");
    if (r.ticket) setTickets((prev) => [r.ticket!, ...prev.filter((t) => t.id !== r.ticket!.id)]);
    void refresh();
  };

  return (
    <div style={{ maxWidth: 860, color: "var(--ui-text)" }} data-testid="help-page">
      <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>Get help</h2>

      <section style={card}>
        <h3 style={h3}>Ask our support team</h3>
        <p style={muted}>Tell us what is happening and we'll reply by email to the address on your account.</p>
        {supportText.length > 0 && (
          <div data-testid="support-info" style={{ fontSize: 13, marginBottom: 12 }}>
            {supportText.map((line) => <div key={line}>{line}</div>)}
          </div>
        )}
        <form onSubmit={(e) => void onSubmit(e)} noValidate>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="help-subject" style={labelStyle}>Subject</label>
            <input id="help-subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="help-body" style={labelStyle}>What do you need help with?</label>
            <textarea id="help-body" value={body} rows={6} maxLength={5000} onChange={(e) => setBody(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <fieldset style={{ border: "none", padding: 0, margin: "0 0 12px" }}>
            <legend style={labelStyle}>How urgent is it?</legend>
            <label style={{ marginRight: 16, fontSize: 14 }}>
              <input type="radio" name="help-priority" value="normal" checked={priority === "normal"} onChange={() => setPriority("normal")} /> Normal
            </label>
            <label style={{ fontSize: 14 }}>
              <input type="radio" name="help-priority" value="urgent" checked={priority === "urgent"} onChange={() => setPriority("urgent")} /> Urgent - work is stopped
            </label>
          </fieldset>
          <button type="submit" style={primaryButton} disabled={sending}>{sending ? "Sending…" : "Send request"}</button>
          {error && <div role="alert" style={errorBox}>{error}</div>}
          {sent && <div role="status" style={okBox}>{sent}</div>}
        </form>
      </section>

      {/* KS_PORTAL_v14_DATA_IMPORT - how to bring records over; the importer itself is Settings > Import data (Admins). */}
      {role === "admin" && <MovingToKeystone />}

      {loaded && listAvailable && (
        <section style={card} data-testid="help-tickets">
          <h3 style={h3}>Your company's requests</h3>
          {tickets.length === 0 ? (
            <p style={{ ...muted, margin: 0 }}>No requests yet.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {tickets.map((t) => (
                <li key={t.id} data-testid={`ticket-${t.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid var(--ui-border)" }}>
                  <span>
                    <strong>{t.subject}</strong>
                    {t.priority === "urgent" && <span style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#fee2e2", color: "#7f1d1d" }}>Urgent</span>}
                    {formatDate(t.created_at) && <span style={{ marginLeft: 8, fontSize: 13, color: "var(--ui-text-muted)" }}>{formatDate(t.created_at)}</span>}
                  </span>
                  <span style={{ padding: "1px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700, ...(STATUS_STYLE[t.status.toLowerCase()] ?? STATUS_STYLE.open) }}>
                    {statusLabel(t.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
