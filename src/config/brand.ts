// KS_PORTAL_v2_BRANDING - the licensee's name, assistant name, logo and colours, shown wherever the portal used to
// say "Boreal". The details come from the Keystone server (GET /api/licensee, public). The store starts from the
// last copy saved in this browser (or build-time defaults) so the first paint already has a name, and main.tsx waits
// for loadBrand() before rendering. Nothing here ever throws.
import { useSyncExternalStore } from "react";
import { SERVER_URL } from "@/config/licensee";

export type Brand = {
  company_name: string;
  legal_name: string;
  assistant_name: string;
  support_email: string;
  support_phone: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  time_zone: string;
  country: string;
  urls: { server: string; portal: string; client: string; website: string };
};

const CACHE_KEY = "ks_brand_v1";

const env = (key: string): string => {
  try {
    return String((import.meta.env as Record<string, unknown>)[key] ?? "").trim();
  } catch {
    return "";
  }
};

export function defaultBrand(): Brand {
  return {
    company_name: env("VITE_COMPANY_NAME") || "Keystone",
    legal_name: "",
    assistant_name: env("VITE_ASSISTANT_NAME") || "Assistant",
    support_email: "",
    support_phone: "",
    logo_url: "",
    primary_color: "#1e3a8a",
    accent_color: "#f59e0b",
    time_zone: "",
    country: "",
    urls: { server: "", portal: "", client: "", website: "" },
  };
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const isColor = (v: string): boolean => /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgb|hsl)a?\([^)]*\)$/i.test(v);

/** Merge a server/cached licensee object over the defaults; blank or malformed fields keep the default. */
function normalize(raw: unknown): Brand {
  const d = defaultBrand();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const urls = (r.urls && typeof r.urls === "object" ? r.urls : {}) as Record<string, unknown>;
  const logo = str(r.logo_url);
  const primary = str(r.primary_color);
  const accent = str(r.accent_color);
  return {
    company_name: str(r.company_name) || d.company_name,
    legal_name: str(r.legal_name),
    assistant_name: str(r.assistant_name) || d.assistant_name,
    support_email: str(r.support_email),
    support_phone: str(r.support_phone),
    logo_url: /^(https?:\/\/|data:image\/|\/)/i.test(logo) ? logo : "",
    primary_color: isColor(primary) ? primary : d.primary_color,
    accent_color: isColor(accent) ? accent : d.accent_color,
    time_zone: str(r.time_zone),
    country: str(r.country),
    urls: { server: str(urls.server), portal: str(urls.portal), client: str(urls.client), website: str(urls.website) },
  };
}

function readCache(): Brand | null {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(b: Brand): void {
  try {
    globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(b));
  } catch {
    /* private mode / storage blocked - the in-memory copy still works */
  }
}

let current: Brand = readCache() ?? defaultBrand();
const listeners = new Set<() => void>();

function setBrand(next: Brand): void {
  current = next;
  for (const l of listeners) {
    try { l(); } catch { /* a listener's failure must not stop the others */ }
  }
}

export function getBrand(): Brand { return current; }
/** The licensee's trading name, e.g. "Keystone Demo Brokerage". */
export function brandName(): string { return current.company_name; }
/** The legal name when the licensee set one, otherwise the trading name. */
export function legalName(): string { return current.legal_name || current.company_name; }
/** The AI assistant's display name (BF-portal called it "Maya"). */
export function assistantName(): string { return current.assistant_name; }
export function brandInitial(): string { return (current.company_name.match(/[A-Za-z0-9]/)?.[0] ?? "K").toUpperCase(); }
/** Window title: "<Company> Portal". */
export function portalTitle(): string { return `${current.company_name} Portal`; }

function applyDocumentTitle(): void {
  try {
    if (typeof document !== "undefined") document.title = portalTitle();
  } catch { /* no DOM */ }
}

/** Fetch the licensee from the server, update the store and the cache. Resolves false (keeping what it had) on any failure. */
export async function loadBrand(timeoutMs = 2500): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    timer = setTimeout(() => ctrl?.abort(), timeoutMs);
    const res = await fetch(`${SERVER_URL}/api/licensee`, { signal: ctrl?.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean; licensee?: unknown };
    if (!body || !body.licensee || typeof body.licensee !== "object") return false;
    const next = normalize(body.licensee);
    writeCache(next);
    setBrand(next);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
    applyDocumentTitle();
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React hook: the current brand; re-renders when loadBrand() brings the server's copy. */
export function useBrand(): Brand {
  return useSyncExternalStore(subscribe, getBrand, getBrand);
}

/** Tests only: reset to the cached/default brand. */
export function __resetBrandForTests(): void {
  setBrand(readCache() ?? defaultBrand());
}
