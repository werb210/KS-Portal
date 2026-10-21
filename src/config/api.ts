// BF_PORTAL_BLOCK_v86_ROUTING_DRAWER_CATEGORIES_TOPBAR_v1
// Reverts BI_HARD_ISOLATION_v59 (silo-based routing). Architecture:
// BF-Server is the shared backend for BF/BI/SLF silos with ?silo= query
// param. Only paths under /api/v1/bi/* or /api/v1/pgi/* go to BI-Server.
// The previous "send everything to BI-Server when in BI silo" change
// broke auth, CRM, users, telephony, lender management for any user
// switching to BI silo because BI-Server doesn't mount those routes
// (only /api/v1/*). iPad screenshot evidence:
//   FetchEvent.respondWith received an error: no-response ::
//   https://bi-server.../api/crm/contacts?silo=bi
import { getActiveBusinessUnit } from "@/context/BusinessUnitContext";

import { SERVER_URL } from "@/config/licensee";

// KS_PORTAL_v1_NO_BI - Keystone has one server (its own KS-server); there is no BI-Server or slf-server.
const BF_SERVER_URL = SERVER_URL;
const BI_SERVER_URL = SERVER_URL;
const SLF_SERVER_URL = SERVER_URL;

/**
 * Resolve the server base URL for a given path.
 * - /api/v1/bi/* | /api/v1/pgi/* | /api/v1/bi-* → BI-Server
 * - anything else → BF-Server (regardless of active silo)
 */
export function resolveApiBase(_path?: string): string {
  return BF_SERVER_URL;
}

/** @deprecated retained for legacy callers without a path. */
export function getApiBase(): string {
  return BF_SERVER_URL;
}

export function getActiveSilo(): string {
  return getActiveBusinessUnit() ?? "BF";
}

/** @deprecated retained for legacy callers; prefer resolveApiBase(). */
export const API_BASE = BF_SERVER_URL;

export const buildApiUrl = (path: string): string => {
  if (!path.startsWith("/")) {
    throw new Error(`Invalid API path: "${path}" — must start with /`);
  }
  return `${resolveApiBase(path)}${path}`;
};

export const __apiBaseUrls = {
  bf: BF_SERVER_URL,
  bi: BI_SERVER_URL,
  slf: SLF_SERVER_URL,
};
