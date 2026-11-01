// KS_PORTAL_MARKETING_ADDON - the marketing data shared by the plan store and the marketing UI (no React here, so the
// plan store can import it). See ./marketing.tsx.
export type PlanKey = "starter" | "growth" | "pro";

export type MarketingLimits = {
  campaign_emails: number;
  text_to_many: number;
  sequences: number | null;
  visitor_history_days: number | null;
  lead_forms: number | null;
};

/** Each plan's limits, for the comparison table when the server did not send them. */
export const PLAN_MARKETING_LIMITS: Record<PlanKey, MarketingLimits> = {
  starter: { campaign_emails: 500, text_to_many: 50, sequences: 2, visitor_history_days: 30, lead_forms: 1 },
  growth: { campaign_emails: 1000, text_to_many: 250, sequences: 5, visitor_history_days: 90, lead_forms: 1 },
  pro: { campaign_emails: 2500, text_to_many: 500, sequences: 10, visitor_history_days: 365, lead_forms: 1 },
};

export const MARKETING_ADDON_PRICE = 49;
export const MARKETING_SEATS = 3;
export const SIGNINGS_INCLUDED = 4;
export const SIGNING_PRICE = 2.5;

export const ADDON_ADDS: string[] = [
  "10,000 campaign emails a month on top of your plan's, then $10 per 10,000 on next month's bill",
  "1,000 bonus marketing texts a month",
  "Send one text to up to 1,000 people at a time",
  "Unlimited sequences running at once",
  "Unlimited website lead forms, plus an AI chat widget and tracking script for your own website",
  "Full visitor history and session replay",
  "Full Google Ads tools: attribution, ad-waste report, Customer Match, Monday ads email and AI ads suggestions",
  "Lead scoring",
  "Subject-line A/B test and send-time choice",
  "Campaign report with applications and funded deals by campaign",
];

export const MARKETING_TOOLS = [
  "website_kit", "session_replay", "full_visitor_history", "google_ads_full", "lead_scoring", "ab_test", "send_time", "funded_report",
] as const;
export type MarketingTool = (typeof MARKETING_TOOLS)[number];

export const TOOL_LABELS: Record<MarketingTool, string> = {
  website_kit: "AI chat widget, tracking script and more lead forms for your website",
  session_replay: "Session replay of website visits",
  full_visitor_history: "Full visitor history",
  google_ads_full: "Google Ads tools: attribution, ad-waste report, Customer Match and AI suggestions",
  lead_scoring: "Lead scoring",
  ab_test: "Subject-line A/B test",
  send_time: "Send at each person's best time",
  funded_report: "Applications and funded deals by campaign",
};

export type MarketingState = {
  addon: { active: boolean; purchased: boolean; via: "purchase" | "trial" | null; price: number; adds: string[]; marketing_seats: number };
  limits: MarketingLimits & { addon: boolean; bonus_marketing_texts: number; plan_campaign_emails: number };
  plan_limits: Record<PlanKey, MarketingLimits>;
  tools: Record<MarketingTool, "plan" | "addon" | null>;
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function limitsOf(raw: unknown, fallback: MarketingLimits): MarketingLimits {
  const r = obj(raw);
  const orNull = (k: keyof MarketingLimits) => (r[k] === null ? null : num(r[k]) ?? fallback[k]);
  return {
    campaign_emails: num(r.campaign_emails) ?? fallback.campaign_emails,
    text_to_many: num(r.text_to_many) ?? fallback.text_to_many,
    sequences: orNull("sequences"),
    visitor_history_days: orNull("visitor_history_days"),
    lead_forms: orNull("lead_forms"),
  };
}

/** GET /api/plan `marketing`; null when the server did not send it (then nothing is locked here). */
export function normalizeMarketing(raw: unknown, plan: PlanKey = "pro"): MarketingState | null {
  const r = obj(raw);
  if (!r.addon || !r.limits) return null;
  const a = obj(r.addon);
  const l = obj(r.limits);
  const t = obj(r.tools);
  const pl = obj(r.plan_limits);
  const via = a.via === "purchase" || a.via === "trial" ? a.via : null;
  return {
    addon: {
      active: a.active === true, purchased: a.purchased === true, via,
      price: num(a.price) ?? MARKETING_ADDON_PRICE,
      adds: Array.isArray(a.adds) ? a.adds.map(String) : ADDON_ADDS,
      marketing_seats: num(a.marketing_seats) ?? MARKETING_SEATS,
    },
    limits: {
      ...limitsOf(l, PLAN_MARKETING_LIMITS[plan]), addon: l.addon === true,
      bonus_marketing_texts: num(l.bonus_marketing_texts) ?? 0,
      plan_campaign_emails: num(l.plan_campaign_emails) ?? PLAN_MARKETING_LIMITS[plan].campaign_emails,
    },
    plan_limits: {
      starter: limitsOf(pl.starter, PLAN_MARKETING_LIMITS.starter),
      growth: limitsOf(pl.growth, PLAN_MARKETING_LIMITS.growth),
      pro: limitsOf(pl.pro, PLAN_MARKETING_LIMITS.pro),
    },
    tools: Object.fromEntries(MARKETING_TOOLS.map((k) => [k, t[k] === "plan" || t[k] === "addon" ? t[k] : null])) as MarketingState["tools"],
  };
}

