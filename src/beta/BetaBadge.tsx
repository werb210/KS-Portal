// KS_PORTAL_BETA_v1 - a small "Beta" badge for anywhere a beta feature appears, and a gate that shows its children
// only while the beta is on. Dark text on a light tint, readable on the light and dark portal themes.
import type { CSSProperties, ReactNode } from "react";
import { BETA_STATUS_LABEL, useBetaFlag, type BetaStatus } from "@/beta/betaStore";

const TONE: Record<BetaStatus | "beta", CSSProperties> = {
  beta: { background: "#fef3c7", color: "#78350f", borderColor: "#d97706" },
  private_beta: { background: "#ede9fe", color: "#4c1d95", borderColor: "#7c3aed" },
  public_beta: { background: "#dbeafe", color: "#1e3a8a", borderColor: "#2563eb" },
  ga: { background: "#dcfce7", color: "#14532d", borderColor: "#16a34a" },
};

/** "Beta" by default; pass a status for the Labs page's status badge. */
export function BetaBadge({ status, label, style }: { status?: BetaStatus; label?: string; style?: CSSProperties }) {
  const text = label ?? (status ? BETA_STATUS_LABEL[status] : "Beta");
  return (
    <span
      data-testid="beta-badge"
      style={{
        display: "inline-block", marginLeft: 6, padding: "1px 7px", borderRadius: 999, border: "1px solid",
        fontSize: 11, fontWeight: 700, lineHeight: "16px", verticalAlign: "middle", whiteSpace: "nowrap",
        ...TONE[status ?? "beta"], ...style,
      }}
    >
      {text}
    </span>
  );
}

/** Renders children only while the beta is on (fallback otherwise, default nothing). */
export function BetaGate({ flag, children, fallback = null }: { flag: string; children: ReactNode; fallback?: ReactNode }) {
  return <>{useBetaFlag(flag) ? children : fallback}</>;
}

export default BetaBadge;
