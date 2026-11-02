// KS_PORTAL_v3_PLANS - the three plans and the features each one adds. The server (GET /api/plan) is the source of
// truth for what this licensee has; this file only supplies labels, plain-language descriptions and the comparison
// table, and answers "which plan includes X" when the server did not say.
export type PlanKey = "starter" | "growth" | "pro";

export const PLAN_ORDER: PlanKey[] = ["starter", "growth", "pro"];

export const PLAN_LABEL: Record<PlanKey, string> = { starter: "Starter", growth: "Growth", pro: "Pro" };

export type FeatureInfo = { key: string; label: string; plan: PlanKey; description: string };

export const FEATURES: FeatureInfo[] = [
  // KS_PORTAL_v9_PORTAL_PLANS - lender portal on every plan; broker portal growth and up (Todd, Oct 22).
  // KS_PORTAL_PLAN_FIXES - lenders do not review files in the portal: the lender package goes to each lender by email
  // or API. Lenders use the portal to keep their details and products current and to send you deals.
  { key: "lender_portal", plan: "starter", label: "Lender portal (lenders keep their details and products current and send you deals they can't place)", description: "The lender package goes to each lender by email or API. Lenders sign in to the portal to keep their contact details and products current, and to send you deals they can't place themselves." },
  // KS_PORTAL_v9_PGI - every plan.
  // KS_PORTAL_MARKETING_ADDON - every plan markets to its own client list; Google Ads and LinkedIn Ads results everywhere.
  { key: "marketing", plan: "starter", label: "Marketing to your own client list: email and text campaigns, sequences, templates and a website lead form", description: "Email and text campaigns, drip sequences, campaign templates, a lead form for your website and a campaign report, within your plan's monthly limits." },
  { key: "ads_results", plan: "starter", label: "Google Ads and LinkedIn Ads results, Google Analytics connection", description: "See what your Google Ads and LinkedIn Ads spend and bring in, and connect Google Analytics." },
  { key: "pgi_referrals", plan: "starter", label: "Personal Guarantee Insurance referrals (20% referral fee)", description: "Clients can add Personal Guarantee Insurance; the file goes to our insurance partner and you earn 20% of the partner's commission on every bound policy." },
  // KS_PORTAL_v20_CRM_FIELDS - every plan.
  { key: "custom_fields", plan: "starter", label: "Custom fields", description: "Add your own fields to contacts, companies and deals (licence numbers, renewal dates, equipment type), with lists, filters, exports and imports." },
  // KS_PORTAL_PLAN_FIXES - the iPad staff portal app on every plan; calls recorded on every plan, playback growth and up.
  { key: "ipad_app", plan: "starter", label: "iPad staff portal app", description: "Run the full staff portal as an app on iPad." },
  { key: "office_sync", plan: "starter", label: "Email sync: Outlook (Microsoft 365) inbox sync; Gmail sends only for now", description: "Outlook (Microsoft 365) mail is read into each contact's timeline. Gmail can send email now; reading a Gmail inbox comes later." },
  { key: "call_recording", plan: "starter", label: "Call recording on every plan (playback on Growth and Pro)", description: "Every call is recorded on every plan. Playing recordings back from the contact's timeline is on Growth and Pro." },
  // KS_BROKER_TOOLS - deal tools for equipment and asset finance brokers: 1-3 every plan, 4, 5, 7, 8 growth+, 9 pro.
  { key: "funding_conditions", plan: "starter", label: "Funding conditions checklist", description: "Track every lender condition between Accepted and Funded: owner, due date, status and document. A file funds only when all are cleared or waived, and clients see what they must supply in the client app." },
  { key: "sales_tax", plan: "starter", label: "Canadian sales tax in quotes and calculators", description: "GST, HST, PST and QST by province, applied to the equipment cost or to each lease payment, on quotes and calculators. Rates are kept in a table you can edit." },
  { key: "invoice_reading", plan: "starter", label: "Vendor invoice reading", description: "The AI reads the vendor's invoice into the deal: vendor, invoice number, date, line items, taxes, total and each piece of equipment with its serial number or VIN. Staff check and confirm; the equipment goes onto the Active Contract too." },
  { key: "call_recording_playback", plan: "growth", label: "Call recording playback", description: "Play recorded calls back from the contact's timeline." },
  // KS_PORTAL_v20_TEAMS - growth and up.
  { key: "teams", plan: "growth", label: "Teams and record visibility", description: "Put people on teams and choose who sees all records, their team's records or only their own." },
  { key: "call_summaries", plan: "growth", label: "Call summaries", description: "The assistant writes a short summary and transcript of every recorded call." },
  { key: "voicemail_transcription", plan: "growth", label: "Voicemail transcription", description: "Voicemails turned into text you can read at a glance." },
  { key: "watch_app", plan: "growth", label: "Apple Watch app", description: "Take and place calls on Apple Watch." },
  // KS_PORTAL_PLAN_FIXES - templates and snippets (one store) and automations are growth and up.
  { key: "templates", plan: "growth", label: "Templates and snippets", description: "Reusable email and text templates, and #shortcut snippets your whole team can drop into any message." },
  { key: "automations", plan: "growth", label: "Automations", description: "Workflows that send messages, create tasks and move deals when something happens." },
  { key: "referrer_portal", plan: "growth", label: "Referrer portal", description: "Give referral partners their own portal to send you deals and follow their progress." },
  { key: "broker_portal", plan: "growth", label: "Broker portal", description: "Partner brokers sign up, sign your broker agreement, upload client files and agree the commission split with you." },
  { key: "full_reports", plan: "growth", label: "Reports", description: "The Reports page: pipeline, team, money and marketing reports, goals and commission tracking. Starter keeps a basic dashboard." }, // KS_PORTAL_v5_NO_REPORTS_ON_STARTER
  // KS_PORTAL_MARKETING_ADDON - visitor tracking on every plan (history by plan, full with the Marketing add-on); session
  // replay Growth and up (and with the add-on).
  { key: "visitor_tracking", plan: "starter", label: "Website visitor tracking (30 days on Starter, 90 days on Growth, 12 months on Pro)", description: "See which website pages a lead visited, and where they dropped off, before they applied." },
  { key: "session_replay", plan: "growth", label: "Session replay of website visits", description: "Watch a recording of a visitor's time on your website (Microsoft Clarity). Also comes with the Marketing add-on." },
  { key: "toll_free_number", plan: "growth", label: "Toll-free number", description: "A toll-free main number for your business." },
  // KS_PORTAL_SETTINGS_PACK_v1_NPS
  // KS_HUBSPOT_GAPS_1_PAYMENTS - growth and up.
  { key: "payment_links", plan: "growth", label: "Payment links and bank debit for fees (your own Stripe account)", description: "Send clients a link to pay a fee by card or Canadian pre-authorized debit. Money goes to your own Stripe account; paid fees are marked on the deal and in QuickBooks." },
  // KS_HUBSPOT_GAPS_1_CALL_SCRIPTS - growth and up.
  { key: "call_scripts", plan: "growth", label: "Call scripts (playbooks)", description: "Scripts with talking points and questions beside the dialler and on records; answers go on the timeline and into your custom fields." },
  // KS_HUBSPOT_GAPS_1_PIPELINES - growth (3 pipelines in all) and pro (unlimited).
  { key: "custom_pipelines", plan: "growth", label: "Extra pipelines with custom stages (Growth 3, Pro unlimited)", description: "Add pipelines such as Renewals or Equipment with their own stages, colours and win probability. Lending keeps its built-in stages." },
  // KS_PORTAL_ACTIVE_CONTRACTS - same key as KS-server, ks-ops and KS-Website.
  { key: "active_contracts", plan: "growth", label: "Active contracts: renewals, re-engagement queues and commission tracking", description: "Every funded facility kept as a contract on the client, renewal dates found automatically from each lender product's rules, re-engagement queues, and commission expected vs received." },
  { key: "nps_survey", plan: "growth", label: "Post-funding survey and review requests", description: "After a deal funds, clients get a one-question survey; happy clients are offered your Google review link." },
  // KS_PORTAL_v22_KYC - growth and up; some checks included each month, the rest billed per check.
  { key: "id_verification", plan: "growth", label: "ID and selfie verification of applicants and guarantors (some checks included each month)", description: "Applicants and guarantors verify with a photo of their government ID and a selfie in the client app; results land on the file and feed the fraud checks." },
  // KS_PORTAL_v23_QUOTES / KS_PORTAL_v23_FORECAST - growth and up.
  { key: "quotes", plan: "growth", label: "Quotes: compare lender offers for the client, branded PDF and acceptance in the client app", description: "Turn the lender offers on a file into one branded quote with payments, fees and total cost of borrowing; the client accepts in the client app." },
  { key: "forecasting", plan: "growth", label: "Revenue forecast: weighted pipeline, commit and best case per rep and team, against goals", description: "Commission forecast per person and team by month or quarter, from each file's stage and expected close date, next to everyone's goals." },
  // KS_PORTAL_LENDER_API - growth and up.
  { key: "lender_api", plan: "growth", label: "Lender API connections", description: "Send the lender package through a lender's broker API and pull status, offers, conditions and document requests back into the file automatically. Email stays the fallback." },
  { key: "credit_lines", plan: "growth", label: "Approved credit lines per client", description: "Keep each client's approved lines: lender, limit, used, available, expiry and conditions. Draws reduce what is available, a funded deal draws on its line automatically, and a reminder task goes out before a line expires." },
  { key: "rate_cards", plan: "growth", label: "Rate cards and deal structuring", description: "Load each lender's rate card by CSV (term, amount, credit tier, fees, residuals) and compare payment options across every lender that takes the deal, side by side, with GST, HST, PST or QST applied." },
  { key: "credit_scorecards", plan: "growth", label: "Credit scorecards and pre-decision rules", description: "Weight the factors that matter to you (time in business, revenue, deposits, balances, NSFs, credit score) and set rules to refer or decline. Every deal gets a grade, the rules it hits and a ranking of the lenders it fits - signals only, you decide." },
  { key: "contract_templates", plan: "growth", label: "Contracts from Word templates", description: "Upload your own Word contracts with merge fields. On a deal, the client, equipment, invoice and chosen payment fill in; you get the Word file and a PDF, sent for e-signature, and the signed copy is filed on the deal." },
  { key: "multiple_lines", plan: "pro", label: "Multiple business lines and direct lines", description: "More business lines, and each person on your team gets their own direct phone number." },
  // KS_PORTAL_MARKETING_ADDON - Starter and Growth see Google Ads results; the full tools are Pro (or the add-on).
  { key: "ad_attribution", plan: "pro", label: "Google Ads tools: attribution, ad-waste report, Customer Match, Monday ads email and AI ads suggestions", description: "See which ads and keywords brought in each lead and funded deal, find wasted spend, send your client list to Google, and get a Monday ads email and suggestions. Also comes with the Marketing add-on." },
  { key: "api_access", plan: "pro", label: "API access", description: "Connect your own tools to the system with API keys." },
  { key: "sso", plan: "pro", label: "Single sign-on", description: "Your team signs in with your company's Microsoft or Google account." },
  // KS_PORTAL_v20_WEBHOOKS - pro.
  // KS_HUBSPOT_GAPS_1_CALL_QUEUES - pro.
  { key: "call_queues", plan: "pro", label: "Call queues", description: "Callers to your main line or a menu option wait in line with hold music and their place in line, and ring the person who has been free longest. Live queue panel for Admins." },
  { key: "vendor_portal", plan: "pro", label: "Vendor and dealer portal", description: "Equipment vendors and dealers quote your financing at the point of sale from your rate cards (with sales tax), send customers an apply link that names them, follow each deal, upload invoices, and see the fees they earn. They sign your vendor agreement online." },
  { key: "webhooks", plan: "pro", label: "Webhooks and Zapier", description: "Send contacts, deals, stage changes, documents and notes to your other tools the moment they happen, signed and retried." },
  // KS_PORTAL_CUSTOM_ROLES - pro.
  { key: "custom_roles", plan: "pro", label: "Custom roles and permissions", description: "Build your own roles: choose what each role can view, create, edit, delete and export in every area, and whether it sees all records, its team's or only its own." },
  // KS_PORTAL_v7_FRAUD - fraud protection (Todd, Oct 23): starter 1, 2, 4, 5; growth adds 6, 7, 8; pro has the rest.
  // KS_PORTAL_BANK_CONNECT_ADDON - bank connect and fraud_3 (statement vs live bank data) are not plan features: they
  // are the hidden bank_connect add-on operations switches on per licensee (planStore hasAddon). Never listed here.
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
// KS_PORTAL_MARKETING_ADDON - each signing over the 4 included; campaign emails over the allowance with the add-on.
export const OVERAGE_PRICE = { minutes: 0.04, texts: 0.03, signings: 2.5, campaignEmailBlock: 10 } as const;

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
