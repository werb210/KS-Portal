// KS_PORTAL_v3_PLANS - small shared pieces: the plan badge, the "see plans" link and the signed-in role.
import { useContext, type CSSProperties, type ReactNode } from "react";
import { Link, useInRouterContext } from "react-router-dom";
import { AuthContext } from "@/auth/AuthContext";
import { PLAN_LABEL, type PlanKey } from "@/plans/catalogue";

/** The signed-in role, or null. Reads the context directly so it never throws outside AuthProvider. */
export function useRole(): string | null {
  const ctx = useContext(AuthContext);
  return (ctx?.user?.role as string | undefined) ?? null;
}

export function useIsAdmin(): boolean {
  return String(useRole() ?? "").toLowerCase() === "admin";
}

// Dark text on a light tint: readable on both the light and dark portal themes.
const BADGE: Record<PlanKey, CSSProperties> = {
  starter: { background: "#e2e8f0", color: "#1e293b" },
  growth: { background: "#dbeafe", color: "#1e3a8a" },
  pro: { background: "#ede9fe", color: "#4c1d95" },
};

export function PlanBadge({ plan, style }: { plan: PlanKey; style?: CSSProperties }) {
  return (
    <span
      data-testid={`plan-badge-${plan}`}
      style={{ display: "inline-block", marginLeft: 6, padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, lineHeight: "16px", verticalAlign: "middle", ...BADGE[plan], ...style }}
    >
      {PLAN_LABEL[plan]}
    </span>
  );
}

export const PLAN_TAB_PATH = "/settings/plan";

/** A link to the Plan tab that also works when rendered outside a router (tests, stray mounts). */
export function PlanLink({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  const inRouter = useInRouterContext();
  const s: CSSProperties = { color: "inherit", fontWeight: 700, textDecoration: "underline", ...style };
  return inRouter ? (
    <Link to={PLAN_TAB_PATH} style={s} onClick={onClick}>{children}</Link>
  ) : (
    <a href={PLAN_TAB_PATH} style={s} onClick={onClick}>{children}</a>
  );
}

export const primaryButton: CSSProperties = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid #1e3a8a", background: "#1e3a8a", color: "#ffffff",
  fontSize: 13, fontWeight: 700, cursor: "pointer",
};
export const secondaryButton: CSSProperties = {
  padding: "8px 14px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface-strong)", color: "var(--ui-text)",
  fontSize: 13, fontWeight: 600, cursor: "pointer",
};
