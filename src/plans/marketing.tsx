// KS_PORTAL_MARKETING_ADDON - every plan markets to its own client list; the Marketing add-on ($49 a month, flat, any
// plan, included in both trials) raises the limits and adds the advanced tools. The server (GET /api/plan, `marketing`)
// is the source of truth; this file reads it, names the tools in plain words, shows the "comes with the add-on" card,
// and asks Keystone for the add-on. While the plan is unknown (not loaded, 404, offline) nothing is locked.
import { useState, type ReactNode } from "react";
import { api } from "@/api";
import { usePlan, type PlanState } from "@/plans/planStore";
import { primaryButton, PlanLink, useIsAdmin } from "@/plans/ui";
import { MARKETING_ADDON_PRICE, MARKETING_SEATS, TOOL_LABELS, type MarketingTool } from "@/plans/marketingData";

export * from "@/plans/marketingData";

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Does this brokerage have the tool (from its plan or the add-on)? Unknown plan state: yes. The server checks the
 *  Marketing seats (Admins plus up to 3 Marketing users) itself. */
export function hasMarketingTool(tool: MarketingTool, state: PlanState): boolean {
  if (state.source !== "server" || !state.marketing) return true;
  return state.marketing.tools[tool] !== null;
}

export function useMarketingTool(tool: MarketingTool): boolean {
  return hasMarketingTool(tool, usePlan());
}

/** The plain-English message a refused request carries ({ message } or { error: { message } }), else the fallback. */
export function serverMessage(e: unknown, fallback: string): string {
  const d = obj((e as { details?: unknown } | null)?.details);
  const inner = obj(d.error);
  const m = typeof d.message === "string" ? d.message : typeof inner.message === "string" ? inner.message : "";
  return m.trim() && !/^[a-z_]+$/.test(m.trim()) ? m.trim() : fallback;
}

/** POST /api/plan/upgrade-request { addon: "marketing" } (Admin): Keystone switches it on and adds it to the bill. */
export async function requestMarketingAddon(): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.post("/api/plan/upgrade-request", { addon: "marketing" });
    return { ok: true };
  } catch (e) {
    const status = (e as { status?: unknown } | null)?.status;
    if (status === 403) return { ok: false, error: "Only an administrator can ask for the Marketing add-on." };
    return { ok: false, error: serverMessage(e, "Could not send the request. Please try again.") };
  }
}

export function AddonRequestButton({ compact = false }: { compact?: boolean }) {
  const isAdmin = useIsAdmin();
  const state = usePlan();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const price = state.marketing?.addon.price ?? MARKETING_ADDON_PRICE;
  if (!isAdmin) return <span style={{ fontSize: 13, color: "var(--ui-text)" }}>Ask your administrator about the Marketing add-on.</span>;
  const go = async () => {
    setBusy(true);
    setMsg(null);
    const r = await requestMarketingAddon();
    setBusy(false);
    setMsg(r.ok ? "Request sent. We will switch the Marketing add-on on and add it to your bill." : r.error ?? "Could not send the request.");
  };
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" style={compact ? { ...primaryButton, padding: "4px 10px", fontSize: 12 } : primaryButton} disabled={busy} onClick={() => void go()}>
        {busy ? "Sending…" : `Ask for the Marketing add-on ($${price} a month)`}
      </button>
      {msg && <span role="status" style={{ fontSize: 13, color: "var(--ui-text)" }}>{msg}</span>}
    </span>
  );
}

/** Tools a higher plan already includes. */
const ALSO_IN: Partial<Record<MarketingTool, string>> = {
  google_ads_full: "Included in Pro.",
  session_replay: "Included in Growth and Pro.",
};

/** The card shown in place of an add-on tool this brokerage does not have. */
export function AddonLocked({ tool, compact = false }: { tool: MarketingTool; compact?: boolean }) {
  const state = usePlan();
  const price = state.marketing?.addon.price ?? MARKETING_ADDON_PRICE;
  if (compact) {
    return (
      <div data-testid={`addon-locked-${tool}`} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "6px 10px", border: "1px dashed var(--ui-border)", borderRadius: 8, fontSize: 12, color: "var(--ui-text)" }}>
        <span><strong>{TOOL_LABELS[tool]}</strong> comes with the Marketing add-on.</span>
        <AddonRequestButton compact />
      </div>
    );
  }
  return (
    <section data-testid={`addon-locked-${tool}`} style={{ maxWidth: 620, padding: 20, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)" }}>
      <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ui-text)" }}>{TOOL_LABELS[tool]}</h3>
      {ALSO_IN[tool] && <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600 }}>{ALSO_IN[tool]}</p>}
      <p style={{ margin: "0 0 10px", fontSize: 14, lineHeight: 1.5 }}>
        This comes with the Marketing add-on: ${price} a month for your whole brokerage, on any plan. It is included in
        both free trials. Admins and up to {state.marketing?.addon.marketing_seats ?? MARKETING_SEATS} people with the
        Marketing role use the advanced tools.
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <AddonRequestButton />
        <PlanLink style={{ fontSize: 13 }}>See what it adds</PlanLink>
      </div>
    </section>
  );
}

/** Shows children when the brokerage has the tool, else the add-on card (or `fallback`). */
export function AddonGate({ tool, children, compact = false, fallback }: { tool: MarketingTool; children: ReactNode; compact?: boolean; fallback?: ReactNode }) {
  const has = useMarketingTool(tool);
  if (has) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;
  return <AddonLocked tool={tool} compact={compact} />;
}

/** A small "Add-on" tag for tabs and options. */
export function AddonBadge({ tool }: { tool: MarketingTool }) {
  const has = useMarketingTool(tool);
  if (has) return null;
  return (
    <span data-testid={`addon-badge-${tool}`} style={{ display: "inline-block", marginLeft: 6, padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, lineHeight: "16px", background: "#fef3c7", color: "#78350f" }}>
      Add-on
    </span>
  );
}
