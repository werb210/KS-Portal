// BF_PORTAL_v828_PARTNER_PORTAL_THEME - the header the lender, broker and referrer portals share.
import type { ReactNode } from "react";
import BrandLogo from "@/components/brand/BrandLogo";
import "./partnerPortal.css";

export default function PartnerHeader({ title, welcome, actions }: { title: string; welcome?: string | null; actions?: ReactNode }) {
  return (
    <header className="pp-header">
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flexWrap: "wrap" }}>
        <BrandLogo height={34} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pp-text)" }}>{title}</div>
          {welcome ? <div className="pp-muted" style={{ fontSize: 14 }}>{welcome}</div> : null}
        </div>
      </div>
      {actions ? <div className="pp-row">{actions}</div> : null}
    </header>
  );
}
