// KS_PORTAL_GMAIL_INBOX - Communications > Gmail: a Google user's own inbox, read-only, like the Outlook inbox. Threads
// on the left, the open thread on the right with its attachments, "Save to CRM" for attachments, and "Sync now".
// Mail from CRM contacts already reaches their timeline on its own; this view is for reading the rest. Shown only when
// Gmail inbox reading is switched on (after Google's CASA review) and the person connected Google.
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { getAuthToken } from "@/lib/authToken";
import { resolveApiBase } from "@/config/api";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import {
  fileGmailToCrm, getGmailStatus, getGmailThread, gmailAttachmentPath, listGmailThreads, syncGmailNow,
  type GmailStatus, type GmailThreadRow, type GmailThreadView,
} from "./gmailApi";

const pane: CSSProperties = { overflowY: "auto", color: "var(--ui-text)" };
const btn: CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface-strong)", color: "var(--ui-text)", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const primaryBtn: CSSProperties = { ...btn, background: "#1d4ed8", border: "1px solid #1d4ed8", color: "#ffffff" };
const note: CSSProperties = { margin: 12, padding: "10px 12px", borderRadius: 8, background: "#fef3c7", color: "#78350f", fontSize: 13 };
const okNote: CSSProperties = { ...note, background: "#dcfce7", color: "#14532d" };
const muted: CSSProperties = { color: "var(--ui-text-muted)", fontSize: 12 };
const errText = (e: unknown, fallback: string) => {
  const d = (e as { details?: { message?: string } } | null)?.details;
  return d?.message || (e instanceof Error && e.message ? e.message : fallback);
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "");

async function download(messageId: string, index: string, name: string) {
  const base = String(resolveApiBase?.("/api/google/gmail") ?? "").replace(/\/+$/, "");
  const token = getAuthToken();
  const r = await fetch(`${base}${gmailAttachmentPath(messageId, index)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error("Could not download the attachment.");
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function GmailInbox() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [threads, setThreads] = useState<GmailThreadRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [label, setLabel] = useState<"INBOX" | "SENT">("INBOX");
  const [open, setOpen] = useState<GmailThreadView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (pageToken?: string) => {
    setBusy(true);
    try {
      const r = await listGmailThreads({ label, ...(q.trim() ? { q: q.trim() } : {}), ...(pageToken ? { pageToken } : {}) });
      setThreads((prev) => (pageToken ? [...prev, ...(r.threads ?? [])] : r.threads ?? []));
      setNext(r.nextPageToken ?? null);
      setError(null);
    } catch (e) {
      setError(errText(e, "Could not load your Gmail."));
    } finally {
      setBusy(false);
    }
  }, [label, q]);

  useEffect(() => {
    let alive = true;
    void getGmailStatus().then((s) => { if (alive) setStatus(s); }).catch((e) => { if (alive) setError(errText(e, "Could not reach Gmail.")); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (status?.granted) void load(); }, [status?.granted, label]); // eslint-disable-line react-hooks/exhaustive-deps

  const openThread = async (id: string) => {
    try { setOpen(await getGmailThread(id)); setInfo(null); } catch (e) { setError(errText(e, "Could not open that email.")); }
  };
  const search = (e: FormEvent) => { e.preventDefault(); void load(); };
  const sync = async () => {
    setBusy(true);
    try {
      const r = await syncGmailNow();
      setInfo(r.inbound || r.outbound ? `Synced: ${r.inbound} from clients and ${r.outbound} sent to clients added to the CRM.` : "Synced. Nothing new for the CRM.");
    } catch (e) { setError(errText(e, "Could not sync.")); } finally { setBusy(false); }
  };
  const saveToCrm = async (messageId: string, index?: number) => {
    try {
      const r = await fileGmailToCrm(messageId, index);
      setInfo(r.filed > 0 ? `${r.filed} file${r.filed === 1 ? "" : "s"} saved to the contact's documents.` : r.reason === "all_duplicates" ? "Already saved to the CRM." : "Nothing to save.");
    } catch (e) { setError(errText(e, "Could not save to the CRM.")); }
  };

  if (error && !status) return <div role="alert" style={note}>{error}</div>;
  if (!status) return <p role="status" style={{ margin: 16, color: "var(--ui-text)" }}>Loading Gmail…</p>;
  if (!status.granted) return <div role="status" style={note} data-testid="gmail-reconnect">{status.message ?? "Reconnect Google in My Profile to read your inbox here."}</div>;

  return (
    <div style={{ display: "flex", flex: 1, minWidth: 0, flexDirection: "column" }} data-testid="gmail-inbox">
      <form onSubmit={search} style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 10, borderBottom: "1px solid var(--ui-border)", alignItems: "center" }}>
        <select aria-label="Folder" value={label} onChange={(e) => setLabel(e.target.value as "INBOX" | "SENT")} style={btn}>
          <option value="INBOX">Inbox</option>
          <option value="SENT">Sent</option>
        </select>
        <input aria-label="Search Gmail" placeholder="Search Gmail" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...btn, fontWeight: 400, flex: "1 1 160px", minWidth: 0 }} />
        <button type="submit" style={btn} disabled={busy}>Search</button>
        <button type="button" style={primaryBtn} onClick={() => void sync()} disabled={busy}>Sync now</button>
        <span style={muted}>{status.last_synced_at ? `Last synced ${when(status.last_synced_at)}` : "Not synced yet"}</span>
      </form>
      {error && <div role="alert" style={note}>{error}</div>}
      {info && <div role="status" style={okNote}>{info}</div>}
      <div style={{ display: "flex", flex: 1, minHeight: 0, flexWrap: "wrap" }}>
        <ul style={{ ...pane, listStyle: "none", margin: 0, padding: 0, flex: "1 1 280px", maxWidth: "100%", borderRight: "1px solid var(--ui-border)" }} aria-label="Threads">
          {threads.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => void openThread(t.id)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderBottom: "1px solid var(--ui-border)", background: open?.id === t.id ? "var(--ui-surface-strong)" : "transparent", color: "var(--ui-text)", cursor: "pointer" }}
              >
                <div style={{ fontWeight: t.unread ? 700 : 500, fontSize: 14 }}>{t.from || "(unknown sender)"}{t.messages > 1 ? ` (${t.messages})` : ""}</div>
                <div style={{ fontSize: 13, fontWeight: t.unread ? 700 : 400 }}>{t.subject}</div>
                <div style={muted}>{when(t.date)} · {t.snippet.slice(0, 90)}</div>
              </button>
            </li>
          ))}
          {!threads.length && !busy && <li style={{ padding: 12, ...muted }}>No email here.</li>}
          {next && <li style={{ padding: 10 }}><button type="button" style={btn} onClick={() => void load(next)} disabled={busy}>Load more</button></li>}
        </ul>
        <div style={{ ...pane, flex: "2 1 360px", padding: 12, minWidth: 0 }} aria-label="Email">
          {!open ? <p style={muted}>Pick an email to read it.</p> : (
            <>
              {open.contacts.length > 0 && (
                <p style={{ fontSize: 13 }}>In the CRM: {open.contacts.map((c) => <a key={c.id} href={`/crm/contacts/${c.id}`} style={{ color: "#1d4ed8", marginRight: 8 }}>{c.name || c.email}</a>)}</p>
              )}
              {open.messages.map((m) => (
                <article key={m.id} style={{ borderBottom: "1px solid var(--ui-border)", padding: "10px 0" }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{m.subject || "(no subject)"}</h3>
                  <div style={muted}>{m.from} · {when(m.date)}{m.logged ? " · on the CRM timeline" : ""}</div>
                  {/* Sanitized like the Outlook inbox: no scripts, no remote content. */}
                  <div style={{ marginTop: 8, fontSize: 14, background: "#ffffff", color: "#111827", padding: 10, borderRadius: 8, overflowX: "auto" }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.bodyHtml) }} />
                  {m.attachments.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      {m.attachments.map((a) => (
                        <span key={a.id} style={{ display: "inline-flex", gap: 4 }}>
                          <button type="button" style={btn} onClick={() => void download(m.id, a.id, a.name).catch((e) => setError(errText(e, "Could not download.")))}>{a.name}</button>
                          <button type="button" style={btn} aria-label={`Save ${a.name} to the CRM`} onClick={() => void saveToCrm(m.id, Number(a.id))}>Save to CRM</button>
                        </span>
                      ))}
                      {m.attachments.length > 1 && <button type="button" style={primaryBtn} onClick={() => void saveToCrm(m.id)}>Save all to CRM</button>}
                    </div>
                  )}
                </article>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
