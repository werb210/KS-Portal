// KS_PORTAL_YOUR_LINKS - Settings > Your links. Every brokerage gets its own client application page and its own
// lender, referrer and partner broker portals the moment it is set up: they live at the brokerage's own addresses.
// This page lists those addresses so the owner (or any broker) can copy them and send them out. Nothing to set up.
import { useState } from "react";
import { CLIENT_URL } from "@/config/licensee";
import { hasFeature, requiredPlan } from "@/plans/planStore";

export type ShareLink = { key: string; title: string; who: string; url: string; feature?: string };

const trim = (u: string) => u.replace(/\/+$/, "");
/** The links a brokerage hands out, built from its own portal and client app addresses. */
export function shareLinks(portalOrigin: string, clientUrl: string): ShareLink[] {
  const portal = trim(portalOrigin), client = trim(clientUrl);
  return [
    { key: "client", title: "Client application", who: "Send to a business owner to start an application. Your clients also sign in here to see their file.", url: client },
    { key: "lender", title: "Lender portal", who: "Send to your lenders. They keep their details and products current and can send you deals they cannot place.", url: `${portal}/lender-portal/login`, feature: "lender_portal" },
    { key: "referrer-signup", title: "Referral partner sign-up", who: "Send to someone who will refer business to you. They sign up, then send you deals and follow their progress.", url: `${portal}/referrer/signup`, feature: "referrer_portal" },
    { key: "referrer-login", title: "Referral partner sign-in", who: "For referral partners who have already signed up.", url: `${portal}/referrer/login`, feature: "referrer_portal" },
    { key: "broker", title: "Partner broker portal", who: "Send to another brokerage that places files through you. They sign your broker agreement, upload client files and see each file's stage.", url: `${portal}/broker`, feature: "broker_portal" },
    { key: "staff", title: "Staff sign-in", who: "Send to your own brokers and staff. This is the portal you are in now.", url: `${portal}/login` },
  ];
}
const PLAN_NAME: Record<string, string> = { starter: "Starter", growth: "Growth", pro: "Pro" };

export default function YourLinks() {
  const [copied, setCopied] = useState<string | null>(null);
  const links = shareLinks(window.location.origin, CLIENT_URL);
  async function copy(l: ShareLink) {
    try { await navigator.clipboard.writeText(l.url); setCopied(l.key); window.setTimeout(() => setCopied((c) => (c === l.key ? null : c)), 2500); }
    catch { setCopied(null); }
  }
  return (
    <div data-testid="your-links">
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--ui-text)" }}>These are your brokerage&apos;s own links. They were made when your brokerage was set up; there is nothing to switch on. Copy one and send it by email or text, or put it on your website.</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {links.map((l) => {
          const on = !l.feature || hasFeature(l.feature);
          return (
            <li key={l.key} data-testid={`link-${l.key}`} style={{ border: "1px solid var(--ui-border)", borderRadius: 10, padding: "12px 14px", background: "var(--ui-surface)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 15, color: "var(--ui-text)" }}>{l.title}</strong>
                {on ? null : <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>On the {PLAN_NAME[requiredPlan(l.feature!)] ?? "higher"} plan</span>}
              </div>
              <p style={{ margin: "4px 0 8px", fontSize: 13, color: "var(--ui-text-muted)" }}>{l.who}</p>
              {on ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <code style={{ fontSize: 13, color: "var(--ui-text)", overflowWrap: "anywhere", flex: "1 1 260px" }}>{l.url}</code>
                  <button type="button" onClick={() => void copy(l)} aria-label={`Copy the ${l.title} link`} style={{ padding: "6px 12px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface)", color: "var(--ui-text)", cursor: "pointer" }}>{copied === l.key ? "Copied" : "Copy link"}</button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
