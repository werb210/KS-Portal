// KS_PORTAL_v9_PGI - the application's "PGI insurance" tab. Personal Guarantee Insurance is placed by the insurance
// partner; this brokerage refers the file and earns a referral fee (20% of the partner's commission) when the policy
// binds. The tab shows: the referral status, the insurer's document checklist mapped onto this file (with an upload
// button per missing item), the fields the insurer still needs, the message thread with the partner, and the fee.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { pgiApi, SLOT_STATE_STYLE, money, statusStyle, type ChecklistRow, type PgiMessage, type PgiSlot, type PgiView } from "@/pgi/pgiApi";
import { PGI_PARTNER_NAME, PGI_REFERRAL_FEE_PERCENT } from "@/pgi/partner";

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16 };
const h3: CSSProperties = { margin: "0 0 8px", fontSize: 16, color: "var(--ui-text)" };
const muted: CSSProperties = { fontSize: 13, color: "var(--ui-text-muted)", margin: "4px 0 0" };
const button: CSSProperties = { padding: "7px 14px", borderRadius: 8, border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#ffffff", fontWeight: 600, cursor: "pointer", fontSize: 13 };
const secondary: CSSProperties = { ...button, background: "transparent", color: "var(--ui-text)", border: "1px solid var(--ui-border)" };
const input: CSSProperties = { padding: "6px 8px", borderRadius: 6, border: "1px solid var(--ui-border)", background: "var(--ui-surface)", color: "var(--ui-text)", fontSize: 13, minWidth: 200 };

export function Chip({ label, bg, fg, border, testId }: { label: string; bg: string; fg: string; border: string; testId?: string }) {
  return (
    <span data-testid={testId} style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700, lineHeight: "18px", background: bg, color: fg, border: `1px solid ${border}`, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

const ERROR_TEXT: Record<string, string> = {
  insurance_partner_not_linked: "This company is not linked to the insurance partner yet. Keystone operations sets this up; the referral is sent automatically once it is.",
  quebec_not_eligible: "The insurer does not currently write Personal Guarantee Insurance in Quebec.",
  business_legal_name_required: "Add the business legal name below, then it is sent again.",
  guarantor_name_required: "Add the director's full name below, then it is sent again.",
  guarantor_phone_required: "Add the director's mobile phone below (the client signs in to the insurer's form with it).",
};

const FIELD_INPUTS: Record<string, { type: "text" | "date" | "number" | "select"; options?: string[] }> = {
  guarantor_name: { type: "text" },
  guarantor_phone: { type: "text" },
  guarantor_dob: { type: "date" },
  residential_address: { type: "text" },
  business_legal_name: { type: "text" },
  naics_code: { type: "text" },
  formation_date: { type: "date" },
  operating_address: { type: "text" },
  business_address: { type: "text" },
  loan_type: { type: "select", options: ["Commercial Mortgage", "Other Secured Loan"] },
  q_ca_loan_type: { type: "select", options: ["Commercial Mortgage", "Other Secured Loan"] },
  loan_amount: { type: "number" },
  pgi_limit: { type: "number" },
};
// The partner's field keys -> the keys this server stores.
const FIELD_KEY: Record<string, string> = { business_name: "business_legal_name", business_address: "operating_address", guarantor_address: "residential_address", q_ca_loan_type: "loan_type" };

function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.";
}

function ChecklistCard({ rows, startup, onUpload, busySlot }: { rows: ChecklistRow[]; startup: boolean; onUpload: (slot: PgiSlot, file: File) => void; busySlot: string | null }) {
  return (
    <section style={card} data-testid="pgi-checklist">
      <h3 style={h3}>Documents the insurer needs</h3>
      <p style={muted}>
        {startup ? "This business is under three years old, so founder CVs and a financial forecast are needed too. " : ""}
        Accepted documents in these categories are sent automatically. Government ID goes to the insurance partner for identity checks only.
      </p>
      <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
        {rows.map((r) => {
          const s = SLOT_STATE_STYLE[r.state];
          const canUpload = r.state === "missing" || r.state === "rejected" || r.state === "awaiting_review";
          return (
            <li key={r.slot} data-testid={`pgi-slot-${r.slot}`} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "9px 0", borderTop: "1px solid var(--ui-border)" }}>
              <span style={{ flex: 1, minWidth: 200, fontSize: 14 }}>
                {r.label}
                {r.detail ? <span style={{ display: "block", fontSize: 12, color: "var(--ui-text-muted)" }}>Reason: {r.detail}</span> : null}
              </span>
              <Chip {...s} testId={`pgi-slot-state-${r.slot}`} />
              {canUpload && (
                <label style={{ ...secondary, display: "inline-block" }}>
                  {busySlot === r.slot ? "Uploading..." : "Upload"}
                  <input
                    type="file"
                    aria-label={`Upload ${r.label}`}
                    data-testid={`pgi-upload-${r.slot}`}
                    style={{ display: "none" }}
                    disabled={busySlot !== null}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(r.slot, f); e.target.value = ""; }}
                  />
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FieldsCard({ view, onSave }: { view: PgiView; onSave: (fields: Record<string, string>) => Promise<void> }) {
  const broker = view.missing_fields.filter((f) => (f.completed_by ?? "broker") === "broker");
  const client = view.missing_fields.filter((f) => f.completed_by === "client");
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  if (!broker.length && !client.length) return null;
  return (
    <section style={card} data-testid="pgi-fields">
      <h3 style={h3}>Details the insurer still needs</h3>
      {broker.length > 0 && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fields = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== ""));
            if (!Object.keys(fields).length) return;
            setSaving(true);
            try { await onSave(fields); setValues({}); } finally { setSaving(false); }
          }}
        >
          {broker.map((f) => {
            const key = FIELD_KEY[f.key] ?? f.key;
            const spec = FIELD_INPUTS[f.key] ?? FIELD_INPUTS[key] ?? { type: "text" as const };
            return (
              <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "6px 0", fontSize: 14 }}>
                <span style={{ minWidth: 260 }}>{f.label}</span>
                {spec.type === "select" ? (
                  <select style={input} value={values[key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} data-testid={`pgi-field-${key}`}>
                    <option value="">Choose...</option>
                    {spec.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input style={input} type={spec.type} value={values[key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} data-testid={`pgi-field-${key}`} />
                )}
              </label>
            );
          })}
          <button type="submit" style={{ ...button, marginTop: 8 }} disabled={saving} data-testid="pgi-fields-save">{saving ? "Saving..." : "Save and send"}</button>
        </form>
      )}
      {client.length > 0 && (
        <p style={{ ...muted, marginTop: 10 }}>
          Your client answers these on {PGI_PARTNER_NAME}'s form (the link is in their portal): {client.map((f) => f.label).join(", ")}.
          {view.referral.completion_url ? <> <a href={view.referral.completion_url} target="_blank" rel="noreferrer" style={{ color: "var(--ui-text)", fontWeight: 600 }}>Open the client's form</a>.</> : null}
        </p>
      )}
    </section>
  );
}

function Thread({ messages, partner, onSend }: { messages: PgiMessage[]; partner: string; onSend: (body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <section style={card} data-testid="pgi-thread">
      <h3 style={h3}>Messages with {partner}</h3>
      {messages.length === 0 ? <p style={muted}>No messages yet.</p> : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {messages.map((m) => {
            const mine = m.direction === "to_partner";
            const tag = m.kind === "doc_request" ? "Document request" : m.kind === "reminder" ? "Reminder" : m.kind === "status" ? "Status update" : null;
            return (
              <li key={m.id} data-testid={`pgi-message-${m.id}`} style={{ padding: "10px 12px", margin: "8px 0", borderRadius: 10, border: "1px solid var(--ui-border)", background: mine ? "var(--ui-surface)" : "var(--ui-surface-strong)", marginLeft: mine ? 40 : 0, marginRight: mine ? 0 : 40 }}>
                <div style={{ fontSize: 12, color: "var(--ui-text-muted)", marginBottom: 4 }}>
                  <strong style={{ color: "var(--ui-text)" }}>{mine ? (m.author_name ?? "You") : (m.author_name ?? partner)}</strong>
                  {tag ? ` - ${tag}` : ""} - {new Date(m.created_at).toLocaleString()}
                  {mine && !m.sent_at ? " - not sent yet (retrying)" : ""}
                </div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "var(--ui-text)" }}>{m.body}</div>
              </li>
            );
          })}
        </ul>
      )}
      <form
        style={{ marginTop: 10 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!body.trim()) return;
          setSending(true);
          try { await onSend(body.trim()); setBody(""); } finally { setSending(false); }
        }}
      >
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }} htmlFor="pgi-reply">Reply to {partner}</label>
        <textarea id="pgi-reply" data-testid="pgi-reply" value={body} onChange={(e) => setBody(e.target.value)} rows={3} style={{ ...input, width: "100%", boxSizing: "border-box" }} />
        <button type="submit" style={{ ...button, marginTop: 8 }} disabled={sending || !body.trim()} data-testid="pgi-send">{sending ? "Sending..." : "Send"}</button>
      </form>
    </section>
  );
}

export default function PgiTab({ applicationId }: { applicationId: string }) {
  const [view, setView] = useState<PgiView | null>(null);
  const [state, setState] = useState<"loading" | "none" | "ready" | "error">("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const marked = useRef(false);

  const load = useCallback(async () => {
    try {
      const v = await pgiApi.view(applicationId);
      setView(v);
      setState("ready");
      if (!marked.current && v.referral.unread_count > 0) {
        marked.current = true;
        void pgiApi.markRead(applicationId).catch(() => undefined);
      }
    } catch (e) {
      if ((e as { status?: number })?.status === 404) setState("none");
      else { setState("error"); setNotice(errorMessage(e)); }
    }
  }, [applicationId]);

  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<PgiView | unknown>, done: string) => {
    setNotice(null);
    try {
      const v = await fn();
      if (v && typeof v === "object" && "referral" in (v as PgiView)) setView(v as PgiView);
      else await load();
      setState("ready");
      setNotice(done);
    } catch (e) {
      setNotice(errorMessage(e));
    }
  };

  if (state === "loading") return <p style={muted}>Loading...</p>;
  if (state === "none") {
    return (
      <section style={card} data-testid="pgi-not-referred">
        <h3 style={h3}>Personal Guarantee Insurance</h3>
        <p style={{ fontSize: 14, margin: "4px 0 12px" }}>
          The client did not ask for PGI. If they want it, refer the file to our insurance partner, {PGI_PARTNER_NAME}. You earn a referral fee of {PGI_REFERRAL_FEE_PERCENT}% of the partner's commission when the policy binds.
        </p>
        <button type="button" style={button} data-testid="pgi-refer" onClick={() => run(() => pgiApi.start(applicationId), "Referred to the insurance partner.")}>Refer for PGI</button>
        {notice && <p role="status" style={{ ...muted, color: "var(--ui-text)" }}>{notice}</p>}
      </section>
    );
  }
  if (state === "error" || !view) return <p role="alert" style={{ ...muted, color: "var(--ui-text)" }}>{notice ?? "Could not load the PGI referral."}</p>;

  const r = view.referral;
  const st = statusStyle(r.status);
  return (
    <div data-testid="pgi-tab">
      <section style={card} data-testid="pgi-status">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ ...h3, margin: 0 }}>Personal Guarantee Insurance with {view.partner_name || PGI_PARTNER_NAME}</h3>
          <Chip {...st} testId="pgi-status-chip" />
          {r.application_code && <span style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>Ref {r.application_code}</span>}
          <span style={{ flex: 1 }} />
          <button type="button" style={secondary} data-testid="pgi-refresh" onClick={() => run(() => pgiApi.sync(applicationId), "Up to date.")}>Refresh</button>
        </div>
        {r.last_error && <p style={{ ...muted, color: "var(--ui-text)" }} data-testid="pgi-error">{ERROR_TEXT[r.last_error] ?? `Not sent yet: ${r.last_error}. It is retried automatically.`}</p>}
        {r.referral_fee ? (
          <p style={{ fontSize: 14, margin: "8px 0 0" }} data-testid="pgi-fee">
            Referral fee: <strong>{money(r.referral_fee.amount, r.referral_fee.currency)}</strong>{r.referral_fee.status ? ` (${r.referral_fee.status})` : ""}
          </p>
        ) : (
          <p style={muted}>Referral fee: {PGI_REFERRAL_FEE_PERCENT}% of the partner's commission, recorded when the policy binds.</p>
        )}
        {notice && <p role="status" style={{ ...muted, color: "var(--ui-text)" }}>{notice}</p>}
      </section>
      <ChecklistCard
        rows={view.checklist}
        startup={view.startup}
        busySlot={busySlot}
        onUpload={async (slot, file) => {
          setBusySlot(slot);
          try { await run(() => pgiApi.uploadForSlot(applicationId, slot, file), "Uploaded and sent to the insurance partner."); } finally { setBusySlot(null); }
        }}
      />
      <FieldsCard view={view} onSave={(fields) => run(() => pgiApi.update(applicationId, fields), "Saved and sent.")} />
      <Thread
        messages={view.messages}
        partner={view.partner_name || PGI_PARTNER_NAME}
        onSend={async (body) => {
          setNotice(null);
          try {
            const res = await pgiApi.send(applicationId, body);
            setNotice(res.sent ? "Message sent." : "Saved - it will be sent as soon as the partner can be reached.");
            await load();
          } catch (e) {
            setNotice(errorMessage(e));
          }
        }}
      />
    </div>
  );
}
