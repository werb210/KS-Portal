// KS_PORTAL_v12_GOOGLE_WORKSPACE - "Connect Google" next to "Connect Microsoft 365" in My Profile.
// The server runs the OAuth flow (authorization code + PKCE, offline access) and keeps the tokens encrypted;
// this card starts it, shows the connected address, and disconnects (the server revokes the grant at Google).
// When Google is not set up on the server the button is disabled with a short explanation; nothing else changes.
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import { disconnectGoogle, fetchGoogleStatus, showsGoogle, showsMicrosoft, startGoogleConnect, useWorkspaceMode, type GoogleStatus } from "@/lib/workspace";

// Dark text on light tints: at least 7:1 on both portal themes' card backgrounds.
const note: CSSProperties = { fontSize: 13, color: "var(--ui-text-muted)", margin: "6px 0 0" };
const okBox: CSSProperties = { background: "#ecfdf5", color: "#064e3b", border: "1px solid #6ee7b7", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 8 };
const warnBox: CSSProperties = { background: "#fffbeb", color: "#78350f", border: "1px solid #fcd34d", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 8 };
const errorBox: CSSProperties = { background: "#fef2f2", color: "#7f1d1d", border: "1px solid #fca5a5", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 8 };

/** Reads (and removes) ?google=connected|error&reason=... that the server's callback appends. */
function takeReturnOutcome(): { outcome: "connected" | "error" | null; reason: string | null } {
  try {
    const url = new URL(window.location.href);
    const outcome = url.searchParams.get("google");
    const reason = url.searchParams.get("reason");
    if (outcome !== "connected" && outcome !== "error") return { outcome: null, reason: null };
    url.searchParams.delete("google");
    url.searchParams.delete("reason");
    window.history.replaceState(window.history.state, "", url.pathname + (url.search ? url.search : "") + url.hash);
    return { outcome, reason };
  } catch {
    return { outcome: null, reason: null };
  }
}

const REASONS: Record<string, string> = {
  access_denied: "You cancelled the Google sign-in.",
  state: "The sign-in link expired or was opened in another browser. Please try again.",
  exchange: "Google did not accept the sign-in. Please try again.",
};

export default function GoogleWorkspaceConnect() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => setStatus(await fetchGoogleStatus()), []);

  useEffect(() => {
    const back = takeReturnOutcome();
    if (back.outcome === "connected") setNotice("Google account connected.");
    if (back.outcome === "error") setError(REASONS[back.reason ?? ""] ?? "Google sign-in did not finish. Please try again.");
    void load();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      window.location.href = await startGoogleConnect();
    } catch {
      setError("Could not start the Google connection.");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await disconnectGoogle();
      setNotice("Google account disconnected.");
      await load();
    } catch {
      setError("Could not disconnect Google.");
    } finally {
      setBusy(false);
    }
  };

  const configured = status?.configured === true;
  const connected = status?.connected === true;
  const needsReconnect = status?.status === "reauth_required";
  const label = connected ? `✓ Connected: ${status?.email ?? "Google"}` : needsReconnect ? "Reconnect Google" : "Connect Google";

  return (
    <div data-testid="google-connect" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void connect()}
          disabled={!status || !configured || busy || connected}
          title={!configured ? status?.configProblem ?? "Google Workspace is not set up on this server yet." : undefined}
          data-testid="google-connect-button"
        >
          {busy && !connected ? "Connecting…" : label}
        </Button>
        {connected && (
          <Button type="button" variant="ghost" onClick={() => void disconnect()} disabled={busy} data-testid="google-disconnect-button">
            Disconnect Google
          </Button>
        )}
      </div>
      {status && !configured && (
        <p style={note} data-testid="google-not-configured">
          Google Workspace is not set up on this server yet. Ask your administrator to add the Google sign-in settings.
        </p>
      )}
      {configured && !connected && !needsReconnect && (
        <p style={note}>Send email from Gmail and use Google Calendar, Google Tasks and Google Drive from the portal.</p>
      )}
      {needsReconnect && (
        <div role="alert" style={warnBox} data-testid="google-reconnect">Google stopped accepting this connection (the access was removed or expired). Connect again to keep using Gmail and Google Calendar.</div>
      )}
      {notice && <div role="status" style={okBox}>{notice}</div>}
      {error && <div role="alert" style={errorBox}>{error}</div>}
    </div>
  );
}

/**
 * The Connect buttons the company setting allows: Microsoft 365 (m365, the default), Google (google) or both.
 * A Microsoft connection made before the company switched to Google stays visible so it can be disconnected.
 */
export function WorkspaceConnections({ microsoft, microsoftConnected }: { microsoft: ReactNode; microsoftConnected: boolean }) {
  const mode = useWorkspaceMode();
  return (
    <>
      {(showsMicrosoft(mode) || microsoftConnected) && microsoft}
      {showsGoogle(mode) && (
        <div style={{ marginTop: 12 }}>
          <GoogleWorkspaceConnect />
        </div>
      )}
    </>
  );
}
