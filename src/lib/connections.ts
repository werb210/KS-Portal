// KS_PORTAL_M365_ONE_CLICK - Settings > Connections: Microsoft 365 for the whole company (one click by an admin) and
// Google Workspace (each person connects in My Profile). The server does the work; this file only talks to it.
//   GET  /api/connections/status                    both providers in plain English (?refresh=1 re-checks Microsoft)
//   GET  /api/o365-oauth/admin-consent/start        { url } of Microsoft's approval page
//   POST /api/o365-oauth/admin-consent/link         { url, expires_at }: a link for the company's Microsoft 365 admin
//   POST /api/o365-oauth/admin-consent/disconnect   forget the company's Microsoft 365 and sign everyone out of it
//   PUT  /api/licensee { office365_send_as }        the shared mailbox lender packages and notices go out from
import { api } from "@/api";

export type AppPermission = { name: string; why: string; granted: boolean | null };

export type MicrosoftConnection = {
  available: boolean;
  app: "keystone" | "own" | null;
  state: "not_available" | "not_connected" | "connected" | "partial" | "revoked" | "app_key" | "unreachable";
  headline: string;
  fix: string | null;
  tenant_id: string | null;
  tenant_source: "connected" | "server_settings" | "none";
  domain: string | null;
  connected_by: string | null;
  connected_at: string | null;
  via: "button" | "link" | null;
  permissions: { application: AppPermission[]; delegated: Array<{ name: string; label: string }> };
  staff_connected: number;
  send_as: string | null;
  last_sync_at: string | null;
  checked_at: string | null;
};

export type GoogleConnection = {
  available: boolean;
  app: "keystone" | "own" | null;
  state: "not_available" | "not_connected" | "connected" | "needs_reconnect";
  headline: string;
  fix: string | null;
  domains: string[];
  staff_connected: number;
  staff_needing_reconnect: number;
  first_connected_at: string | null;
  permissions: Array<{ name: string; label: string }>;
  gmail_reading: boolean;
  last_sync_at: string | null;
};

export type Connections = { microsoft: MicrosoftConnection; google: GoogleConnection; broker: boolean };

export function fetchConnections(refresh = false): Promise<Connections> {
  return api.get<Connections>(`/api/connections/status${refresh ? "?refresh=1" : ""}`);
}

export async function startMicrosoftConsent(): Promise<string> {
  const r = await api.get<{ url?: string }>("/api/o365-oauth/admin-consent/start");
  if (!r?.url) throw new Error("The server did not return Microsoft's approval page.");
  return r.url;
}

export async function makeMicrosoftAdminLink(): Promise<{ url: string; expires_at: string }> {
  const r = await api.post<{ url?: string; expires_at?: string }>("/api/o365-oauth/admin-consent/link", {});
  if (!r?.url) throw new Error("The server did not return a link.");
  return { url: r.url, expires_at: String(r.expires_at ?? "") };
}

export async function disconnectMicrosoft(): Promise<{ users_signed_out: number }> {
  const r = await api.post<{ users_signed_out?: number }>("/api/o365-oauth/admin-consent/disconnect", {});
  return { users_signed_out: Number(r?.users_signed_out ?? 0) };
}

export async function saveSharedMailbox(address: string): Promise<void> {
  await api.put("/api/licensee", { office365_send_as: address.trim() });
}

/** What the server's consent callback put in the address (?m365=...), as a message. Null when nothing. */
export function consentOutcome(search: string): { ok: boolean; kind: string; text: string } | null {
  const v = new URLSearchParams(search).get("m365");
  switch (v) {
    case "connected": return { ok: true, kind: v, text: "Microsoft 365 is connected for your company. Each person can now click Connect Microsoft 365 in My Profile." };
    case "declined": return { ok: false, kind: v, text: "Microsoft 365 was not connected: the approval was cancelled. Click Connect Microsoft 365 to try again." };
    case "needs_admin": return { ok: false, kind: v, text: "Only a Microsoft 365 administrator can approve Keystone for your company. Ask your Microsoft 365 admin: copy the link below and send it to them." };
    case "state": return { ok: false, kind: v, text: "That approval link expired or was already used. Click Connect Microsoft 365 (or make a new link) and try again." };
    case "error": return { ok: false, kind: v, text: "Microsoft did not finish the approval. Please try again." };
    default: return null;
  }
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "never" : d.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}
