// KS_WHATSAPP_v1 - above the reply box on a client conversation: send as a text or on WhatsApp. WhatsApp allows a
// free message only within 24 hours of the client's last WhatsApp message; outside that, staff pick an approved template.
import { useEffect, useState, type CSSProperties } from "react";
import { api } from "@/api";
import { safeGet } from "./safeGet";

export type Channel = "sms" | "whatsapp";
type Status = { configured: boolean; open: boolean; closesAt: string | null };
type Template = { sid: string; name: string; language: string; body: string; variables: string[] };
const unwrap = <T,>(r: unknown): T => ((r as { data?: T })?.data ?? r) as T;

const seg = (on: boolean): CSSProperties => ({
  padding: "4px 12px", border: "1px solid var(--ui-border)", background: on ? "#1d4ed8" : "var(--ui-surface-strong)",
  color: on ? "#fff" : "var(--ui-text)", fontSize: 12, fontWeight: 600, cursor: "pointer",
});

export function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => values[k] || `{{${k}}}`);
}

export default function WhatsAppBar({ phone, contactId, channel, onChannel, onSent }: {
  phone: string | null; contactId: string | null; channel: Channel; onChannel: (c: Channel) => void; onSent: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [pick, setPick] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStatus(null); setMsg(null);
    if (!phone) return;
    let alive = true;
    void safeGet(`/api/communications/whatsapp/status?phone=${encodeURIComponent(phone)}`)
      .then((r) => { if (alive) setStatus(r ? unwrap<Status>(r) : null); }).catch(() => { if (alive) setStatus(null); });
    return () => { alive = false; };
  }, [phone]);

  useEffect(() => {
    if (channel !== "whatsapp" || !status || status.open || templates) return;
    void safeGet("/api/communications/whatsapp/templates").then((r) => setTemplates(unwrap<{ templates: Template[] }>(r).templates ?? [])).catch(() => setTemplates([]));
  }, [channel, status, templates]);

  if (!status?.configured) return null;
  const t = templates?.find((x) => x.sid === pick);
  const sendTemplate = async () => {
    if (!t || !phone) return;
    setBusy(true); setMsg(null);
    try {
      await api.post("/api/communications/whatsapp", { to: phone, contactId, contentSid: t.sid, contentVariables: vars, body: fillTemplate(t.body, vars) });
      setMsg({ ok: true, text: "Template sent. When the client replies you can write freely for 24 hours." });
      setPick(""); setVars({}); onSent();
    } catch (e) {
      const d: any = (e as { details?: any })?.details;
      setMsg({ ok: false, text: d?.error?.message ?? "The WhatsApp template could not be sent." });
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="whatsapp-bar" style={{ padding: "6px 16px", borderTop: "1px solid var(--ui-surface-muted)", fontSize: 12, color: "var(--ui-text)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span role="group" aria-label="Send as" style={{ display: "inline-flex" }}>
          <button type="button" aria-pressed={channel === "sms"} style={{ ...seg(channel === "sms"), borderRadius: "8px 0 0 8px" }} onClick={() => onChannel("sms")}>Text</button>
          <button type="button" aria-pressed={channel === "whatsapp"} style={{ ...seg(channel === "whatsapp"), borderRadius: "0 8px 8px 0", borderLeft: "none" }} onClick={() => onChannel("whatsapp")}>WhatsApp</button>
        </span>
        {channel === "whatsapp" && (status.open
          ? <span style={{ color: "var(--ui-text-muted)" }}>You can reply freely until {new Date(status.closesAt!).toLocaleString("en-CA", { weekday: "short", hour: "numeric", minute: "2-digit" })}.</span>
          : <span style={{ color: "#78350f" }}>The client has not written on WhatsApp in the last 24 hours, so start with an approved template.</span>)}
      </div>
      {channel === "whatsapp" && !status.open && (
        <div style={{ marginTop: 6, display: "grid", gap: 6, maxWidth: 560 }}>
          {templates && templates.length === 0 && <span style={{ color: "var(--ui-text-muted)" }}>No approved templates yet. Templates are made and approved in Twilio (Content Template Builder).</span>}
          {templates && templates.length > 0 && (
            <select aria-label="WhatsApp template" value={pick} onChange={(e) => { setPick(e.target.value); setVars({}); }}
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface)", color: "var(--ui-text)" }}>
              <option value="">Choose a template</option>
              {templates.map((x) => <option key={x.sid} value={x.sid}>{x.name}{x.language ? ` (${x.language})` : ""}</option>)}
            </select>
          )}
          {t && (
            <>
              {t.variables.map((v) => (
                <input key={v} aria-label={`Template value ${v}`} placeholder={`Value for {{${v}}}`} value={vars[v] ?? ""}
                  onChange={(e) => setVars({ ...vars, [v]: e.target.value })}
                  style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface)", color: "var(--ui-text)" }} />
              ))}
              <div style={{ padding: 8, borderRadius: 8, background: "var(--ui-surface)", border: "1px solid var(--ui-border)", whiteSpace: "pre-wrap" }}>{fillTemplate(t.body, vars)}</div>
              <div><button type="button" disabled={busy} onClick={() => void sendTemplate()} style={{ ...seg(true), borderRadius: 8 }}>Send template</button></div>
            </>
          )}
        </div>
      )}
      {msg && <div role={msg.ok ? "status" : "alert"} style={{ marginTop: 6, color: msg.ok ? "#064e3b" : "#7f1d1d" }}>{msg.text}</div>}
    </div>
  );
}
