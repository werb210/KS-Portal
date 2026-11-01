// KS_HUBSPOT_GAPS_1_MEETING_NOTES - Settings > Meeting notes (everyone; every plan with office sync): connect your own
// Zoom, see whether Google Meet notes are on for your Google connection, bring transcripts in now, and file meetings
// that did not match a contact. KS-server /api/meeting-notes.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/api";
import { crmApi, type ContactRow } from "@/api/crm";
import { Notice, Section, button, cell, danger, errText, input, muted, quiet, when } from "@/settingsPack/ui";

type Status = {
  zoom: { problem: string | null; connected: boolean; status: string; email: string | null; last_synced_at: string | null; last_error: string | null };
  google_meet: { enabled: boolean; problem: string | null; connected: boolean; email?: string | null; has_scope: boolean; last_synced_at?: string | null; last_error?: string | null };
};
type Meeting = { id: string; provider: string; provider_label: string; subject: string | null; started_at: string | null; contact_id: string | null; contact_name: string | null; maya_summary: string | null; recording_url: string | null };

const RETURN_TEXT: { [k: string]: { ok?: string; error?: string } } = {
  connected: { ok: "Zoom is connected. Transcripts of your cloud recordings will appear on your contacts' timelines." },
  declined: { error: "Zoom was not connected (the request was cancelled in Zoom)." },
  expired: { error: "That connect link expired. Press Connect Zoom again." },
  error: { error: "Zoom could not be connected. Please try again." },
};

function ContactPicker({ onPick }: { onPick: (c: ContactRow) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ContactRow[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); return; }
    const t = setTimeout(() => { void crmApi.listContacts({ q: q.trim(), limit: 8 }).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([])); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div>
      <input aria-label="Find a contact" placeholder="Find a contact" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...input, maxWidth: 260 }} />
      {rows.map((c) => <div key={c.id}><button type="button" style={{ ...quiet, marginTop: 4 }} onClick={() => onPick(c)}>{c.name}{c.email ? ` (${c.email})` : ""}</button></div>)}
    </div>
  );
}

export default function MeetingNotesSettings() {
  const [params] = useSearchParams();
  const backText = RETURN_TEXT[params.get("zoom") ?? ""] ?? {};
  const [s, setS] = useState<Status | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filing, setFiling] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(backText.error ?? null);
  const [ok, setOk] = useState<string | null>(backText.ok ?? null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setS(await api.get<Status>("/api/meeting-notes/status"));
      setMeetings((await api.get<{ meetings: Meeting[] }>("/api/meeting-notes/meetings")).meetings);
    } catch (e) { setErr(errText(e, "Could not load meeting notes.")); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const connect = async () => {
    setErr(null);
    try { const r = await api.post<{ url: string }>("/api/meeting-notes/zoom/connect", {}); window.location.assign(r.url); } catch (e) { setErr(errText(e, "Could not start connecting Zoom.")); }
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect Zoom? Meetings already brought in stay on the timeline.")) return;
    try { await api.post("/api/meeting-notes/zoom/disconnect", {}); setOk("Zoom disconnected."); await load(); } catch (e) { setErr(errText(e, "Could not disconnect Zoom.")); }
  };
  const sync = async () => {
    setBusy(true); setErr(null); setOk(null);
    try {
      const r = await api.post<{ imported: { zoom: number; google_meet: number } }>("/api/meeting-notes/sync", {});
      const n = r.imported.zoom + r.imported.google_meet;
      setOk(n ? `${n} new meeting${n === 1 ? "" : "s"} brought in. Summaries appear in a few minutes.` : "No new transcripts yet. Zoom and Google take a little while after a meeting ends.");
      await load();
    } catch (e) { setErr(errText(e, "Could not check for new meetings.")); } finally { setBusy(false); }
  };
  const file = async (m: Meeting, c: ContactRow) => {
    try { await api.put(`/api/meeting-notes/meetings/${m.id}/contact`, { contact_id: c.id }); setFiling(null); setOk(`Filed under ${c.name}.`); await load(); } catch (e) { setErr(errText(e, "Could not file the meeting.")); }
  };

  const gm = s?.google_meet;
  return (
    <div data-testid="meeting-notes-settings">
      <Section id="meeting-notes" title="Meeting notes" intro="Transcripts of your Zoom and Google Meet meetings are summarised by the assistant and put on the timeline of the contact you met, with follow-up tasks, like Teams meetings.">
        <Notice error={err} ok={ok} />
        <h4 style={{ margin: "8px 0 4px", fontSize: 14, color: "var(--ui-text)" }}>Zoom</h4>
        {s?.zoom.problem && <p style={muted}>{s.zoom.problem}</p>}
        {s && !s.zoom.problem && !s.zoom.connected && <>
          <p style={muted}>{s.zoom.status === "reauth_required" ? "Zoom needs to be connected again." : "Connect your own Zoom account. Turn on cloud recording with audio transcripts in Zoom so there is a transcript to bring in."}</p>
          <button type="button" style={button} onClick={() => void connect()}>Connect Zoom</button>
        </>}
        {s?.zoom.connected && <>
          <p style={muted} data-testid="zoom-status">Connected as {s.zoom.email ?? "your Zoom account"}{s.zoom.last_synced_at ? `; last checked ${when(s.zoom.last_synced_at)}` : ""}.{s.zoom.last_error ? ` Last problem: ${s.zoom.last_error}` : ""}</p>
          <button type="button" style={danger} onClick={() => void disconnect()}>Disconnect Zoom</button>
        </>}
        <h4 style={{ margin: "14px 0 4px", fontSize: 14, color: "var(--ui-text)" }}>Google Meet</h4>
        <p style={muted} data-testid="meet-status">
          {!gm ? "" : !gm.enabled ? "Google Meet notes are not switched on for this system yet."
            : gm.problem ? gm.problem
            : !gm.connected ? "Connect Google in My Profile to bring in Google Meet transcripts."
            : !gm.has_scope ? "Reconnect Google in My Profile and allow access to your Meet conferences."
            : `On for ${gm.email ?? "your Google account"}. Turn on transcripts in your Google Meet meetings.${gm.last_synced_at ? ` Last checked ${when(gm.last_synced_at)}.` : ""}`}
        </p>
        <button type="button" style={quiet} disabled={busy} onClick={() => void sync()}>Check for new meetings now</button>
      </Section>
      <Section id="my-meetings" title="My Zoom and Google Meet meetings" intro="Meetings that did not match a contact by email wait here for you to file them.">
        {meetings.length === 0 && <p style={muted}>No meetings brought in yet.</p>}
        {meetings.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id} data-testid={`meeting-${m.id}`}>
                  <td style={cell}><strong>{m.subject ?? "Meeting"}</strong><div style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>{m.provider_label} - {when(m.started_at)}</div>
                    {m.maya_summary && <div style={{ fontSize: 13, marginTop: 4 }}>{m.maya_summary}</div>}</td>
                  <td style={cell}>
                    {m.contact_id ? <a href={`/crm/contacts/${m.contact_id}`} style={{ color: "var(--ui-text)" }}>{m.contact_name ?? "Contact"}</a>
                      : filing === m.id ? <ContactPicker onPick={(c) => void file(m, c)} />
                      : <button type="button" style={quiet} onClick={() => setFiling(m.id)}>File under a contact</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
