// KS_PORTAL_v12_GOOGLE_WORKSPACE - Microsoft 365 and/or Google Workspace.
// The company setting (Settings -> Company, licensee workspace_provider) decides which Connect buttons staff see:
//   m365 (default, today's behaviour) | google | both.
// The server picks the provider per user: Microsoft 365 when connected, else Google. GET /api/google/status says
// whether Google is set up on this server and whether this user is connected.
import { useEffect, useState } from "react";
import { api } from "@/api";
import { useBrand } from "@/config/brand";

export type WorkspaceMode = "m365" | "google" | "both";

export function normalizeWorkspaceMode(v: unknown): WorkspaceMode {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "google" || s === "both" ? s : "m365";
}

export const showsMicrosoft = (mode: WorkspaceMode): boolean => mode !== "google";
export const showsGoogle = (mode: WorkspaceMode): boolean => mode !== "m365";

export const WORKSPACE_MODE_LABEL: Record<WorkspaceMode, string> = {
  m365: "Microsoft 365",
  google: "Google Workspace",
  both: "Both (each person chooses)",
};

/** The company's choice, from the brand store (GET /api/licensee). */
export function useWorkspaceMode(): WorkspaceMode {
  return normalizeWorkspaceMode(useBrand().workspace_provider);
}

export type GoogleStatus = {
  configured: boolean;
  configProblem: string | null;
  gmailReadEnabled: boolean;
  connected: boolean;
  status: "connected" | "reauth_required" | "not_connected";
  email: string | null;
  scopes: string[];
};

export const GOOGLE_NOT_CONFIGURED: GoogleStatus = {
  configured: false,
  configProblem: "Google Workspace is not set up on this server yet.",
  gmailReadEnabled: false,
  connected: false,
  status: "not_connected",
  email: null,
  scopes: [],
};

export async function fetchGoogleStatus(): Promise<GoogleStatus> {
  try {
    const r = await api.get<Partial<GoogleStatus>>("/api/google/status");
    if (!r || typeof r !== "object") return GOOGLE_NOT_CONFIGURED;
    return {
      configured: r.configured === true,
      configProblem: typeof r.configProblem === "string" ? r.configProblem : null,
      gmailReadEnabled: r.gmailReadEnabled === true,
      connected: r.connected === true,
      status: r.status === "connected" || r.status === "reauth_required" ? r.status : "not_connected",
      email: typeof r.email === "string" ? r.email : null,
      scopes: Array.isArray(r.scopes) ? r.scopes.map(String) : [],
    };
  } catch {
    // An older server without /api/google answers 404: treat Google as not set up.
    return GOOGLE_NOT_CONFIGURED;
  }
}

/** Starts the server-side OAuth flow: the server answers with Google's consent URL. */
export async function startGoogleConnect(): Promise<string> {
  const r = await api.get<{ url?: string }>("/api/google/oauth/start");
  if (!r?.url) throw new Error("Could not start the Google connection.");
  return r.url;
}

export async function disconnectGoogle(): Promise<void> {
  await api.post("/api/google/oauth/disconnect", {});
}

/**
 * True when this user's mail goes through Google: Google connected and Microsoft 365 not (the server prefers
 * Microsoft 365 when both are connected). Checked while `active` (e.g. the composer is open).
 */
export function useGoogleMailOnly(active: boolean): boolean {
  const [googleOnly, setGoogleOnly] = useState(false);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    void (async () => {
      const google = await fetchGoogleStatus();
      if (!google.connected) { if (alive) setGoogleOnly(false); return; }
      let microsoft = false;
      try {
        const s = await api.get<{ connected?: boolean }>("/api/users/me/o365-status");
        microsoft = s?.connected === true;
      } catch {
        microsoft = false;
      }
      if (alive) setGoogleOnly(!microsoft);
    })();
    return () => { alive = false; };
  }, [active]);
  return googleOnly;
}
