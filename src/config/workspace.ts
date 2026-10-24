// KS_STAFF_DIRECTORY_v1 - which brokerage's Keystone server the iPad app talks to.
//
// The web portal is served by each brokerage at its own address, so its server is fixed at build time
// (src/config/licensee.ts). The iPad app is one App Store app for every brokerage: on its sign-in screen staff type
// their work email or mobile number, Keystone operations (KS-Ops) answers which brokerage(s) that person works for,
// and the chosen server is kept on the device. "Enter company code instead" stays as a hidden fallback.
//
//   POST {KS_OPS_URL}/api/staff-directory/lookup { identifier } -> { matches: [{ name, server_url }] }
//   GET  {KS_OPS_URL}/api/directory/{code}                      -> { company_name, server_url, ... } | 404
//
// The chosen server is read synchronously when the app starts (licensee.ts), so changing it reloads the app.
export type Workspace = { name: string; server_url: string };

export const WORKSPACE_KEY = "ks.workspace.v1";
export const PREFILL_PHONE_KEY = "ks.workspace.prefillPhone";
const DEFAULT_OPS_URL = "https://ks-ops-dev.azurewebsites.net";

/** True inside the iPad (Capacitor) app. Read from the bridge Capacitor injects before the page scripts run. */
export function isNativeApp(win: unknown = typeof window !== "undefined" ? window : undefined): boolean {
  try {
    const cap = (win as { Capacitor?: { isNativePlatform?: () => boolean } } | undefined)?.Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

export function opsUrl(): string {
  const v = String(import.meta.env.VITE_KS_OPS_URL ?? "").trim().replace(/\/+$/, "");
  return /^https:\/\/[^\s/]+/i.test(v) ? v : DEFAULT_OPS_URL;
}

function httpsServer(raw: unknown): string | null {
  try {
    const u = new URL(String(raw ?? "").trim());
    if (u.protocol !== "https:" || !u.host) return null;
    return `${u.origin}${u.pathname.replace(/\/+$/, "").replace(/\/api$/, "")}`;
  } catch {
    return null;
  }
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The workspace chosen on this device, or null. */
export function storedWorkspace(): Workspace | null {
  try {
    const raw = storage()?.getItem(WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Workspace>;
    const server = httpsServer(parsed.server_url);
    if (!server) return null;
    return { name: String(parsed.name ?? "").trim() || new URL(server).host, server_url: server };
  } catch {
    return null;
  }
}

/** The server the iPad app should use: the chosen workspace, or null (web builds always return null). */
export function nativeWorkspaceServer(win?: unknown): string | null {
  if (!isNativeApp(win)) return null;
  return storedWorkspace()?.server_url ?? null;
}

/** The iPad app has no workspace yet, so the sign-in screen asks for an email or mobile number first. */
export function needsWorkspace(win?: unknown): boolean {
  return isNativeApp(win) && !storedWorkspace();
}

/** Keeps the choice and restarts the app on the sign-in screen against that server. */
export function chooseWorkspace(w: Workspace, opts: { prefillPhone?: string | null; reload?: (path: string) => void } = {}): void {
  const server = httpsServer(w.server_url);
  if (!server) throw new Error("invalid_server");
  const s = storage();
  s?.setItem(WORKSPACE_KEY, JSON.stringify({ name: w.name, server_url: server }));
  try {
    if (opts.prefillPhone) window.sessionStorage.setItem(PREFILL_PHONE_KEY, opts.prefillPhone);
  } catch {
    /* the phone just is not filled in */
  }
  (opts.reload ?? ((p: string) => window.location.replace(p)))("/login");
}

/** Forgets the choice (the "Change" link on the sign-in screen) and restarts the app. */
export function clearWorkspace(reload: (path: string) => void = (p) => window.location.replace(p)): void {
  storage()?.removeItem(WORKSPACE_KEY);
  reload("/login");
}

/** The phone number typed on the email-or-mobile screen, once. */
export function takePrefillPhone(): string {
  try {
    const v = window.sessionStorage.getItem(PREFILL_PHONE_KEY) ?? "";
    window.sessionStorage.removeItem(PREFILL_PHONE_KEY);
    return v;
  } catch {
    return "";
  }
}

/** "+1 (403) 555-0199" -> "+14035550199"; null unless a North American number. */
export function phoneFrom(raw: string): string | null {
  const s = raw.trim();
  if (!s || s.includes("@") || /[^0-9+().\s-]/.test(s)) return null;
  const d = s.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

export function looksLikeIdentifier(raw: string): boolean {
  const s = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || phoneFrom(s) !== null;
}

export class DirectoryError extends Error {
  constructor(public readonly kind: "rate_limited" | "unavailable") {
    super(kind);
  }
}

type FetchLike = typeof fetch;

/** The brokerages this email or mobile number belongs to (name and server address only). */
export async function findWorkspaces(identifier: string, fetchImpl: FetchLike = fetch): Promise<Workspace[]> {
  let res: Response;
  try {
    res = await fetchImpl(`${opsUrl()}/api/staff-directory/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ identifier: identifier.trim() }),
    });
  } catch {
    throw new DirectoryError("unavailable");
  }
  if (res.status === 429) throw new DirectoryError("rate_limited");
  if (!res.ok) throw new DirectoryError("unavailable");
  const body = (await res.json().catch(() => null)) as { matches?: Array<{ name?: unknown; server_url?: unknown }> } | null;
  const out: Workspace[] = [];
  for (const m of body?.matches ?? []) {
    const server = httpsServer(m?.server_url);
    if (server) out.push({ name: String(m?.name ?? "").trim() || new URL(server).host, server_url: server });
  }
  return out;
}

/** The hidden fallback: a company code. null when the code is unknown. */
export async function findByCompanyCode(code: string, fetchImpl: FetchLike = fetch): Promise<Workspace | null> {
  const c = code.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,32}$/.test(c)) return null;
  let res: Response;
  try {
    res = await fetchImpl(`${opsUrl()}/api/directory/${encodeURIComponent(c)}`, { headers: { Accept: "application/json" } });
  } catch {
    throw new DirectoryError("unavailable");
  }
  if (res.status === 404) return null;
  if (res.status === 429) throw new DirectoryError("rate_limited");
  if (!res.ok) throw new DirectoryError("unavailable");
  const body = (await res.json().catch(() => null)) as { company_name?: unknown; server_url?: unknown } | null;
  const server = httpsServer(body?.server_url);
  return server ? { name: String(body?.company_name ?? "").trim() || new URL(server).host, server_url: server } : null;
}
