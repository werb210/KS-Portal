// KS_PORTAL_v3_PLANS - the three plans and the features each one adds. The server (GET /api/plan) is the source of
// truth for what this licensee has; this file only supplies labels, plain-language descriptions and the comparison
// table, and answers "which plan includes X" when the server did not say.
export type PlanKey = "starter" | "growth" | "pro";

export const PLAN_ORDER: PlanKey[] = ["starter", "growth", "pro"];

export const PLAN_LABEL: Record<PlanKey, string> = { starter: "Starter", growth: "Growth", pro: "Pro" };

export type FeatureInfo = { key: string; label: string; plan: PlanKey; description: string };

export const FEATURES: FeatureInfo[] = [
  // KS_PORTAL_v9_PORTAL_PLANS - lender portal on every plan; broker portal growth and up (Todd, Oct 22).
  { key: "lender_portal", plan: "starter", label: "Lender portal (lenders can send you deals they can't place)", description: "Lenders sign in to see the files you send them, post their decisions, and send you deals they can't place themselves." },
  // KS_PORTAL_v9_PGI - every plan.
  { key: "pgi_referrals", plan: "starter", label: "Personal Guarantee Insurance referrals (20% referral fee)", description: "Clients can add Personal Guarantee Insurance; the file goes to our insurance partner and you earn 20% of the partner's commission on every bound policy." },
  { key: "call_recording", plan: "growth", label: "Call recording", description: "Record calls and play them back from the contact's timeline." },
  { key: "call_summaries", plan: "growth", label: "Call summaries", description: "The assistant writes a short summary and transcript of every recorded call." },
  { key: "voicemail_transcription", plan: "growth", label: "Voicemail transcription", description: "Voicemails turned into text you can read at a glance." },
  { key: "watch_ipad_apps", plan: "growth", label: "Apple Watch and iPad apps", description: "Take calls on Apple Watch and run the portal as an iPad app." },
  { key: "templates", plan: "growth", label: "Templates", description: "Reusable email and text templates your whole team can send from." },
  { key: "referrer_portal", plan: "growth", label: "Referrer portal", description: "Give referral partners their own portal to send you deals and follow their progress." },
  { key: "broker_portal", plan: "growth", label: "Broker portal", description: "Partner brokers sign up, sign your broker agreement, upload client files and agree the commission split with you." },
  { key: "full_reports", plan: "growth", label: "Reports", description: "The Reports page: pipeline, team, money and marketing reports, goals and commission tracking. Starter keeps a basic dashboard." }, // KS_PORTAL_v5_NO_REPORTS_ON_STARTER
  { key: "visitor_tracking", plan: "growth", label: "Website visitor tracking", description: "See which website pages a lead visited, and where they dropped off, before they applied." },
  { key: "toll_free_number", plan: "growth", label: "Toll-free number", description: "A toll-free main number for your business." },
  { key: "multiple_lines", plan: "pro", label: "Multiple phone lines", description: "Give each person on your team their own direct phone number." },
  { key: "ad_attribution", plan: "pro", label: "Ad attribution", description: "See which ads and campaigns brought in each lead and each funded deal." },
  { key: "api_access", plan: "pro", label: "API access", description: "Connect your own tools to the system with API keys." },
  { key: "sso", plan: "pro", label: "Single sign-on", description: "Your team signs in with your company's Microsoft or Google account." },
  // KS_PORTAL_v7_FRAUD - fraud protection (Todd, Oct 23): starter 1, 2, 4, 5; growth adds 6, 7, 8; pro has all 15
  // (fraud_3 "statement vs live bank data" retired with bank connect - KS_PORTAL_NO_BANK_CONNECT; keys not renumbered).
  { key: "fraud_1", plan: "starter", label: "Document tamper scan", description: "Every upload is checked for signs of editing: editing software, re-saves, mixed fonts, text pasted over a scan, re-compressed pages." },
  { key: "fraud_2", plan: "starter", label: "Bank statement math check", description: "Every transaction on each bank statement is re-added and the running and closing balances checked." },
  { key: "fraud_4", plan: "starter", label: "Duplicate document check", description: "Spots the same file, ID or void cheque (exact copy or near-identical picture) on another application." },
  { key: "fraud_5", plan: "starter", label: "Revenue vs bank deposits", description: "Compares the revenue on tax returns, financials and the application with the money actually deposited." },
  { key: "fraud_6", plan: "growth", label: "Business reality check", description: "Checks the business is registered, the applicant is a director, the address is not a mail drop, and the website and phone look established." },
  { key: "fraud_7", plan: "growth", label: "Phone and email risk", description: "Flags internet (VoIP) phone lines, throwaway email addresses, brand-new email domains and names that do not match the email." },
  { key: "fraud_8", plan: "growth", label: "ID checks", description: "Matches the name and date of birth on the ID to the applicant, and spots screenshots and ID pictures used before." },
  { key: "fraud_9", plan: "pro", label: "Device and location check", description: "Notices VPNs, several businesses applying from one device or connection, and applications from outside your region." },
  { key: "fraud_10", plan: "pro", label: "Application behaviour signals", description: "Notices pasted bank and ID numbers, impossibly fast applications and answers identical to another application. No keystrokes are kept." },
  { key: "fraud_11", plan: "pro", label: "Loan stacking detector", description: "Finds recent advances and daily or weekly debits from other lenders that the applicant did not mention." },
  { key: "fraud_12", plan: "pro", label: "Fraud network map", description: "Links applications that share a phone, email, address, bank account, device or director, and shows the network." },
  { key: "fraud_13", plan: "pro", label: "Shared fraud watchlist", description: "Checks applicants against confirmed fraud reported by other brokerages. Only scrambled codes are shared, never personal details." },
  { key: "fraud_14", plan: "pro", label: "Inside-job alerts", description: "Alerts Admins when staff change banking details on a file, export in bulk, approve their own file or work at unusual hours." },
  { key: "fraud_15", plan: "pro", label: "Call voice check", description: "Recorded calls with the applicant are checked for synthetic or cloned voices (needs a voice-analysis service)." },
  { key: "fraud_16", plan: "pro", label: "Fraud score and lender pre-screen", description: "One 0-100 score with plain-English reasons, and a pre-screen summary you can add to the lender package." },
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
// KS_PORTAL_v6_USAGE - overage prices (never blocked, billed): per extra call minute and per extra text.
export const OVERAGE_PRICE = { minutes: 0.04, texts: 0.03 } as const;

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
