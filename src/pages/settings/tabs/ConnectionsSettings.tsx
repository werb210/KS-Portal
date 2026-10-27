// KS_PORTAL_M365_ONE_CLICK - Settings > Connections (Admins). Microsoft 365 is connected once for the whole company:
// a Microsoft 365 administrator clicks Connect and approves Keystone; the server saves the company's tenant itself.
// Nobody registers an app or types a tenant id. A Keystone admin who is not a Microsoft 365 admin gets a link to send
// to theirs. Google Workspace needs no company step: each person connects in My Profile. Plain-English status, which
// permissions, the last successful sync, and the fix for anything wrong.
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { primaryButton } from "@/plans/ui";
import {
  consentOutcome, disconnectMicrosoft, fetchConnections, formatWhen, makeMicrosoftAdminLink, saveSharedMailbox, startMicrosoftConsent,
  type Connections, type GoogleConnection, type MicrosoftConnection,
} from "@/lib/connections";

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16 };
const h3: CSSProperties = { margin: "0 0 4px", fontSize: 17, color: "var(--ui-text)" };
const muted: CSSProperties = { color: "var(--ui-text-muted)", fontSize: 13, margin: "4px 0 0" };
const secondary: CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface-strong)", color: "var(--ui-text)", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const dangerButton: CSSProperties = { ...secondary, color: "#991b1b", borderColor: "#fca5a5" };
const input: CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface-input, var(--ui-surface))", color: "var(--ui-text)", fontSize: 14, minWidth: 260, maxWidth: "100%" };
// Dark text on light tints: at least 7:1 on both portal themes.
const okBox: CSSProperties = { background: "#ecfdf5", color: "#064e3b", border: "1px solid #6ee7b7", borderRadius: 8, padding: "8px 12px", fontSize: 14, marginTop: 10 };
const warnBox: CSSProperties = { background: "#fffbeb", color: "#78350f", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 12px", fontSize: 14, marginTop: 10 };
const errorBox: CSSProperties = { background: "#fef2f2", color: "#7f1d1d", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 14, marginTop: 10 };
const pill = (bg: string, fg: string): CSSProperties => ({ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: bg, color: fg, marginLeft: 8, verticalAlign: "middle" });
const dl: CSSProperties = { display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 14px", margin: "12px 0 0", fontSize: 14 };
const dt: CSSProperties = { color: "var(--ui-text-muted)" };
const dd: CSSProperties = { margin: 0, overflowWrap: "anywhere" };
const row: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 };

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message && e.message !== "API_ERROR" ? e.message : fallback);

function StatePill({ state }: { state: string }) {
  if (state === "connected") return <span style={pill("#d1fae5", "#064e3b")}>Connected</span>;
  if (state === "not_connected") return <span style={pill("#e2e8f0", "#1e293b")}>Not connected</span>;
  if (state === "not_available") return <span style={pill("#e2e8f0", "#1e293b")}>Not available yet</span>;
  if (state === "partial" || state === "needs_reconnect" || state === "unreachable") return <span style={pill("#fef3c7", "#78350f")}>Needs attention</span>;
  return <span style={pill("#fee2e2", "#7f1d1d")}>Not working</span>;
}

function Details({ children }: { children: ReactNode }) {
  return <dl style={dl}>{children}</dl>;
}

/** The link for the company's Microsoft 365 admin: made on request, shown in a box they can copy from. */
function AdminLink({ onError }: { onError: (text: string) => void }) {
  const [link, setLink] = useState<{ url: string; expires_at: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true);
    try { setLink(await makeMicrosoftAdminLink()); setCopied(false); } catch (e) { onError(errText(e, "Could not make the link.")); } finally { setBusy(false); }
  };
  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link.url); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <div data-testid="m365-admin-link" style={{ marginTop: 12 }}>
      {!link ? (
        <button type="button" style={secondary} onClick={() => void make()} disabled={busy}>
          {busy ? "Making the link…" : "Not a Microsoft 365 admin? Get a link for your admin"}
        </button>
      ) : (
        <>
          <label htmlFor="m365-admin-link-url" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
            Send this link to your Microsoft 365 admin. It works once, in any browser, until {formatWhen(link.expires_at)}.
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input id="m365-admin-link-url" readOnly value={link.url} style={{ ...input, flex: "1 1 320px" }} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" style={secondary} onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</button>
          </div>
        </>
      )}
    </div>
  );
}

function MicrosoftCard({ ms, onChanged, initialMessage }: { ms: MicrosoftConnection; onChanged: () => Promise<void>; initialMessage: { ok: boolean; kind: string; text: string } | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [sendAs, setSendAs] = useState(ms.send_as ?? "");
  useEffect(() => { setSendAs(ms.send_as ?? ""); }, [ms.send_as]);

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    try { window.location.assign(await startMicrosoftConsent()); } catch (e) { setMessage({ ok: false, kind: "error", text: errText(e, "Could not open Microsoft's approval page.") }); setBusy(false); }
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect Microsoft 365 for the whole company? Everyone is signed out of Microsoft 365 in Keystone; mail and calendar stop until it is connected again.")) return;
    setBusy(true);
    try {
      const r = await disconnectMicrosoft();
      setMessage({ ok: true, kind: "disconnected", text: `Microsoft 365 is disconnected. ${r.users_signed_out} ${r.users_signed_out === 1 ? "person was" : "people were"} signed out. To remove Keystone from Microsoft completely, delete it under Enterprise applications in Microsoft Entra.` });
      await onChanged();
    } catch (e) { setMessage({ ok: false, kind: "error", text: errText(e, "Could not disconnect Microsoft 365.") }); } finally { setBusy(false); }
  };
  const saveMailbox = async () => {
    setBusy(true);
    try { await saveSharedMailbox(sendAs); setMessage({ ok: true, kind: "saved", text: sendAs.trim() ? `Lender packages and notices will go out from ${sendAs.trim()}.` : "Shared mailbox cleared." }); await onChanged(); }
    catch (e) { setMessage({ ok: false, kind: "error", text: errText(e, "Could not save the shared mailbox.") }); } finally { setBusy(false); }
  };

  const connected = ms.state === "connected" || ms.state === "partial" || ms.state === "unreachable" || ms.state === "app_key";
  const needsReconnect = ms.state === "revoked" || ms.state === "partial";
  const missing = ms.permissions.application.filter((p) => p.granted === false);

  return (
    <section style={card} data-testid="connections-microsoft" aria-label="Microsoft 365">
      <h3 style={h3}>Microsoft 365 <StatePill state={ms.state} /></h3>
      <p style={{ margin: "6px 0 0", fontSize: 15 }} data-testid="m365-headline">{ms.headline}</p>
      {ms.fix && <div role="alert" style={ms.state === "revoked" ? errorBox : warnBox} data-testid="m365-fix">{ms.fix}</div>}

      {ms.state === "not_connected" && (
        <p style={muted}>
          One click connects your company&rsquo;s mail, calendar, Teams and shared mailboxes. Microsoft asks a Microsoft 365 administrator to
          approve Keystone once; after that each person clicks Connect Microsoft 365 in My Profile. Nothing to register or type.
        </p>
      )}

      {connected && (
        <Details>
          <dt style={dt}>Organisation</dt><dd style={dd}>{ms.domain ?? ms.tenant_id}{ms.tenant_source === "server_settings" ? " (set by this server's settings)" : ""}</dd>
          {ms.connected_by && (<><dt style={dt}>Connected by</dt><dd style={dd}>{ms.connected_by}{ms.via === "link" ? " (with the admin link)" : ""}</dd></>)}
          {ms.connected_at && (<><dt style={dt}>Connected on</dt><dd style={dd}>{formatWhen(ms.connected_at)}</dd></>)}
          <dt style={dt}>Staff signed in</dt><dd style={dd}>{ms.staff_connected}</dd>
          <dt style={dt}>Last successful sync</dt><dd style={dd}>{formatWhen(ms.last_sync_at)}</dd>
          <dt style={dt}>Last checked</dt><dd style={dd}>{formatWhen(ms.checked_at)}</dd>
        </Details>
      )}

      {ms.state !== "not_available" && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Which permissions Keystone asks for</summary>
          <p style={muted}>For each person who connects (their own mailbox and anything shared with them):</p>
          <ul style={{ margin: "4px 0 0 18px", fontSize: 14 }}>
            {ms.permissions.delegated.map((p) => <li key={p.name}>{p.label} <span style={{ color: "var(--ui-text-muted)" }}>({p.name})</span></li>)}
          </ul>
          <p style={muted}>For the company, without anyone signed in:</p>
          <ul style={{ margin: "4px 0 0 18px", fontSize: 14 }} data-testid="m365-app-permissions">
            {ms.permissions.application.map((p) => (
              <li key={p.name}>
                {p.why} <span style={{ color: "var(--ui-text-muted)" }}>({p.name})</span>
                {p.granted === true ? " - granted" : p.granted === false ? " - not granted" : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      {missing.length > 0 && <p style={muted}>Not granted: {missing.map((p) => p.name).join(", ")}.</p>}

      {message && <div role={message.ok ? "status" : "alert"} style={message.ok ? okBox : errorBox} data-testid="m365-message">{message.text}</div>}

      {ms.available && (
        <div style={row}>
          {!connected || needsReconnect ? (
            <button type="button" style={primaryButton} onClick={() => void connect()} disabled={busy} data-testid="m365-connect">
              {busy ? "Opening Microsoft…" : needsReconnect ? "Reconnect Microsoft 365" : "Connect Microsoft 365"}
            </button>
          ) : (
            <button type="button" style={secondary} onClick={() => void onChanged()} disabled={busy}>Check again</button>
          )}
          {connected && ms.tenant_source === "connected" && (
            <button type="button" style={dangerButton} onClick={() => void disconnect()} disabled={busy} data-testid="m365-disconnect">Disconnect</button>
          )}
        </div>
      )}
      {ms.available && (!connected || needsReconnect || message?.kind === "needs_admin") && (
        <AdminLink onError={(text) => setMessage({ ok: false, kind: "error", text })} />
      )}

      {connected && (
        <div style={{ marginTop: 16 }}>
          <label htmlFor="m365-send-as" style={{ display: "block", fontSize: 14, fontWeight: 600 }}>Shared mailbox for lender packages and notices</label>
          <p style={muted}>The address Keystone sends lender packages and client notices from, for example submissions@yourcompany.com. Leave empty to send only from each person&rsquo;s own mailbox.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            <input id="m365-send-as" type="email" value={sendAs} onChange={(e) => setSendAs(e.target.value)} placeholder="submissions@yourcompany.com" style={input} />
            <button type="button" style={secondary} onClick={() => void saveMailbox()} disabled={busy}>Save mailbox</button>
          </div>
        </div>
      )}
    </section>
  );
}

function GoogleCard({ g }: { g: GoogleConnection }) {
  return (
    <section style={card} data-testid="connections-google" aria-label="Google Workspace">
      <h3 style={h3}>Google Workspace <StatePill state={g.state} /></h3>
      <p style={{ margin: "6px 0 0", fontSize: 15 }} data-testid="google-headline">{g.headline}</p>
      {g.fix && <div role={g.state === "needs_reconnect" ? "alert" : "status"} style={g.state === "needs_reconnect" ? warnBox : { ...muted, marginTop: 8 }}>{g.fix}</div>}
      {g.state !== "not_available" && (
        <Details>
          <dt style={dt}>People connected</dt><dd style={dd}>{g.staff_connected}{g.staff_needing_reconnect ? ` (${g.staff_needing_reconnect} need to reconnect)` : ""}</dd>
          {g.first_connected_at && (<><dt style={dt}>First connected</dt><dd style={dd}>{formatWhen(g.first_connected_at)}</dd></>)}
          <dt style={dt}>Last successful sync</dt><dd style={dd}>{formatWhen(g.last_sync_at)}</dd>
          <dt style={dt}>Permissions</dt><dd style={dd}>{g.permissions.map((p) => p.label).join(", ")}</dd>
          <dt style={dt}>Reading Gmail</dt><dd style={dd}>{g.gmail_reading ? "On" : "Off (Keystone sends from Gmail but does not read the inbox yet)"}</dd>
        </Details>
      )}
    </section>
  );
}

export default function ConnectionsSettings() {
  const [data, setData] = useState<Connections | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [outcome] = useState(() => {
    if (typeof window === "undefined") return null;
    const o = consentOutcome(window.location.search);
    if (o) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("m365");
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      } catch { /* the message still shows */ }
    }
    return o;
  });

  const load = useCallback(async (refresh = false) => {
    try { setData(await fetchConnections(refresh)); setFailed(null); } catch (e) { setFailed(errText(e, "Could not load the connections.")); }
  }, []);
  useEffect(() => { void load(outcome?.kind === "connected"); }, [load, outcome]);

  if (failed) return <div role="alert" style={errorBox}>{failed}</div>;
  if (!data) return <p role="status" style={{ color: "var(--ui-text)" }}>Loading connections…</p>;
  return (
    <div data-testid="connections-settings">
      <p style={{ ...muted, fontSize: 14, margin: "0 0 14px" }}>
        Email, calendar, tasks and files. Microsoft 365 is connected once for the whole company; Google is connected by each person in My Profile.
      </p>
      <MicrosoftCard ms={data.microsoft} onChanged={() => load(true)} initialMessage={outcome} />
      <GoogleCard g={data.google} />
    </div>
  );
}
