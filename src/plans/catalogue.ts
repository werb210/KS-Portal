// KS_PORTAL_v3_PLANS - the three plans and the features each one adds. The server (GET /api/plan) is the source of
// truth for what this licensee has; this file only supplies labels, plain-language descriptions and the comparison
// table, and answers "which plan includes X" when the server did not say.
export type PlanKey = "starter" | "growth" | "pro";

export const PLAN_ORDER: PlanKey[] = ["starter", "growth", "pro"];

export const PLAN_LABEL: Record<PlanKey, string> = { starter: "Starter", growth: "Growth", pro: "Pro" };

export type FeatureInfo = { key: string; label: string; plan: PlanKey; description: string };

export const FEATURES: FeatureInfo[] = [
  { key: "call_recording", plan: "growth", label: "Call recording", description: "Record calls and play them back from the contact's timeline." },
  { key: "call_summaries", plan: "growth", label: "Call summaries", description: "The assistant writes a short summary and transcript of every recorded call." },
  { key: "voicemail_transcription", plan: "growth", label: "Voicemail transcription", description: "Voicemails turned into text you can read at a glance." },
  { key: "watch_ipad_apps", plan: "growth", label: "Apple Watch and iPad apps", description: "Take calls on Apple Watch and run the portal as an iPad app." },
  { key: "templates", plan: "growth", label: "Templates", description: "Reusable email and text templates your whole team can send from." },
  { key: "referrer_portal", plan: "growth", label: "Referrer portal", description: "Give referral partners their own portal to send you deals and follow their progress." },
  { key: "full_reports", plan: "growth", label: "Full reports", description: "Money and marketing reports on top of the basic operations reports." },
  { key: "visitor_tracking", plan: "growth", label: "Website visitor tracking", description: "See which website pages a lead visited, and where they dropped off, before they applied." },
  { key: "toll_free_number", plan: "growth", label: "Toll-free number", description: "A toll-free main number for your business." },
  { key: "multiple_lines", plan: "pro", label: "Multiple phone lines", description: "Give each person on your team their own direct phone number." },
  { key: "lender_portal", plan: "pro", label: "Lender portal", description: "Lenders sign in to see the files you send them and post their decisions." },
  { key: "bank_connect", plan: "pro", label: "Bank connect", description: "Ask clients to connect their bank account (view-only) instead of uploading statements." },
  { key: "ad_attribution", plan: "pro", label: "Ad attribution", description: "See which ads and campaigns brought in each lead and each funded deal." },
  { key: "api_access", plan: "pro", label: "API access", description: "Connect your own tools to the system with API keys." },
  { key: "sso", plan: "pro", label: "Single sign-on", description: "Your team signs in with your company's Microsoft or Google account." },
];

const BY_KEY = new Map(FEATURES.map((f) => [f.key, f]));

export function featureInfo(key: string): FeatureInfo | undefined {
  return BY_KEY.get(key);
}

/** Everything in Starter - not feature keys (every plan has them), shown on the comparison table. */
export const STARTER_BASICS: string[] = [
  "Contacts",
  "Pipeline",
  "Client portal",
  "Application wizard",
  "iPhone dialler",
  "Calendar sync",
  "Basic reports",
  "AI assistant",
];

/** Per-plan allowances for the comparison table (the current plan's own numbers come from the server). */
// KS_PORTAL_v3_STORAGE - storage is pooled across the brokerage; extra storage is sold in 50 GB blocks at $10/month.
export const PLAN_ALLOWANCES: Record<PlanKey, { minutes: number; texts: number; chats: number | null; storageGb: number }> = {
  starter: { minutes: 50, texts: 100, chats: 200, storageGb: 10 },
  growth: { minutes: 500, texts: 500, chats: 1000, storageGb: 25 },
  pro: { minutes: 1500, texts: 1500, chats: null, storageGb: 50 },
};

export const STORAGE_BLOCK_GB = 50;
export const STORAGE_BLOCK_PRICE_TEXT = "$10/month";

/** 1536 -> "1.5 KB", 12.3e9 -> "12.3 GB" (decimal units, as storage is sold). */
export function formatBytes(bytes: number): string {
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let v = Math.max(0, bytes);
  let i = 0;
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
  return i === 0 ? `${Math.round(v)} bytes` : `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10} ${units[i]}`;
}

export function planRank(p: PlanKey): number {
  return PLAN_ORDER.indexOf(p);
}

export function isPlanKey(v: unknown): v is PlanKey {
  return v === "starter" || v === "growth" || v === "pro";
}

/** "Included in Growth and Pro" / "Included in Pro". */
export function includedInText(plan: PlanKey): string {
  const names = PLAN_ORDER.filter((p) => planRank(p) >= planRank(plan)).map((p) => PLAN_LABEL[p]);
  return names.length === PLAN_ORDER.length ? "Included in every plan" : `Included in ${names.join(" and ")}`;
}
