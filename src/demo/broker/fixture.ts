// KS_PORTAL_v11_LIVE_DEMO - the sample file, in the shapes the portal's own screens read. It reproduces KS-server's
// src/demo/fixture.ts (business, applicant, request, documents, financials, statements, lenders, call) and its
// lenders.ts scoring, so the portal shows exactly what the demo server builds the lender package from.
// Everything is fictional; phone numbers use the 555-01xx range set aside for fiction.

export const APP_ID = "4f6c2a1e-7b3d-4c8e-9a15-6d2e8b0c3f71";

export const BUSINESS = {
  legal_name: "Juniper Hollow Millwork Ltd.",
  operating_name: "Juniper Hollow Millwork",
  industry: "Manufacturing - custom millwork and cabinetry",
  naics: "337110",
  years_in_business: 7,
  started: "2019-04-01",
  employees: 18,
  street: "123 Example Street",
  city: "Edmonton",
  province: "AB",
  postal: "T5J 0A1",
  address: "123 Example Street, Edmonton, AB T5J 0A1",
  phone: "(780) 555-0100",
  website: "juniperhollow.example",
  annual_revenue: 2_140_000,
};

export const CONTACT = {
  first_name: "Sam",
  last_name: "Carter",
  name: "Sam Carter",
  title: "Owner and President",
  email: "sam@juniperhollow.example",
  phone: "(780) 555-0142",
  ownership_pct: 100,
  home: { street: "45 Sample Crescent", city: "Edmonton", province: "AB", postal: "T6X 0A1" },
  dob: "1981-05-14",
};

export const REQUEST = {
  amount: 250_000,
  product: "Equipment financing",
  product_category: "equipment_financing",
  purpose: "A new 5x10 CNC router and dust collection, to bring cabinet-door work in-house.",
  term_months: 60,
  equipment_cost: 268_000,
  down_payment: 18_000,
};

export type FinancialYear = {
  year: number; revenue: number; cogs: number; gross_profit: number; operating_expenses: number; ebitda: number;
  depreciation: number; interest: number; net_income: number; total_assets: number; total_liabilities: number;
  equity: number; current_assets: number; current_liabilities: number; existing_debt_service: number;
};

export const FINANCIALS: { years: [FinancialYear, FinancialYear]; prepared_by: string; basis: string } = {
  prepared_by: "Sample accounting firm (fictional)",
  basis: "Review engagement",
  years: [
    {
      year: 2025, revenue: 2_140_000, cogs: 1_305_000, gross_profit: 835_000, operating_expenses: 523_000, ebitda: 312_000,
      depreciation: 61_000, interest: 22_000, net_income: 168_000, total_assets: 1_180_000, total_liabilities: 610_000,
      equity: 570_000, current_assets: 520_000, current_liabilities: 290_000, existing_debt_service: 64_800,
    },
    {
      year: 2024, revenue: 1_860_000, cogs: 1_150_000, gross_profit: 710_000, operating_expenses: 459_000, ebitda: 251_000,
      depreciation: 57_000, interest: 25_000, net_income: 121_000, total_assets: 1_040_000, total_liabilities: 590_000,
      equity: 450_000, current_assets: 455_000, current_liabilities: 275_000, existing_debt_service: 64_800,
    },
  ],
};

/** Monthly payment on an amortising loan. */
export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - (1 + r) ** -months);
}

export const ASSUMED_RATE_PCT = 9.0;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function dscr(): number {
  const cur = FINANCIALS.years[0];
  const pay = monthlyPayment(REQUEST.amount, ASSUMED_RATE_PCT, REQUEST.term_months) * 12;
  return r2(cur.ebitda / (cur.existing_debt_service + pay));
}

export const BANK = "Prairie Hollow Credit Union";

export type SampleTx = { date: string; description: string; amount: number };
export type SampleStatement = { month: string; label: string; opening: number; tx: SampleTx[] };
const tx = (date: string, description: string, amount: number): SampleTx => ({ date, description, amount });

export const STATEMENTS: SampleStatement[] = [
  {
    month: "2026-07", label: "July 2026", opening: 84_216.42,
    tx: [
      tx("2026-07-02", "Customer payment - Westfield Homes", 42_300.0),
      tx("2026-07-03", "Payroll", -31_884.12),
      tx("2026-07-07", "Lumber supplier - Aurora Wood Supply", -24_610.55),
      tx("2026-07-09", "Customer payment - Lakeside Builders", 27_950.0),
      tx("2026-07-12", "Equipment loan payment", -5_400.0),
      tx("2026-07-15", "Customer payment - Riverbend Interiors", 36_480.0),
      tx("2026-07-17", "Payroll", -31_902.4),
      tx("2026-07-21", "Hardware and finishes - Northline Supply", -12_288.3),
      tx("2026-07-24", "Customer payment - Westfield Homes", 39_125.0),
      tx("2026-07-28", "Shop rent", -9_500.0),
      tx("2026-07-30", "Customer payment - Kestrel Developments", 31_770.0),
      tx("2026-07-31", "Payroll", -15_960.2),
    ],
  },
  {
    month: "2026-08", label: "August 2026", opening: 0,
    tx: [
      tx("2026-08-04", "Customer payment - Lakeside Builders", 33_640.0),
      tx("2026-08-05", "Payroll", -31_745.18),
      tx("2026-08-08", "Lumber supplier - Aurora Wood Supply", -27_104.9),
      tx("2026-08-11", "Customer payment - Riverbend Interiors", 41_215.0),
      tx("2026-08-12", "Equipment loan payment", -5_400.0),
      tx("2026-08-14", "Customer payment - Westfield Homes", 28_860.0),
      tx("2026-08-19", "Payroll", -31_990.06),
      tx("2026-08-21", "Utilities", -3_412.77),
      tx("2026-08-25", "Customer payment - Kestrel Developments", 44_380.0),
      tx("2026-08-27", "Shop rent", -9_500.0),
      tx("2026-08-29", "Customer payment - Lakeside Builders", 22_910.0),
      tx("2026-08-31", "Payroll", -16_022.5),
    ],
  },
  {
    month: "2026-09", label: "September 2026", opening: 0,
    tx: [
      tx("2026-09-02", "Customer payment - Westfield Homes", 37_420.0),
      tx("2026-09-03", "Payroll", -31_812.33),
      tx("2026-09-08", "Lumber supplier - Aurora Wood Supply", -25_870.12),
      tx("2026-09-10", "Customer payment - Lakeside Builders", 18_450.0),
      tx("2026-09-12", "Equipment loan payment", -5_400.0),
      tx("2026-09-15", "Customer payment - Riverbend Interiors", 39_905.0),
      tx("2026-09-16", "Payroll", -31_876.9),
      tx("2026-09-22", "Hardware and finishes - Northline Supply", -11_940.48),
      tx("2026-09-24", "Customer payment - Kestrel Developments", 35_660.0),
      tx("2026-09-28", "Shop rent", -9_500.0),
      tx("2026-09-29", "Customer payment - Westfield Homes", 29_315.0),
      tx("2026-09-30", "Payroll", -16_011.75),
    ],
  },
];
for (let i = 1; i < STATEMENTS.length; i++) {
  const prev = STATEMENTS[i - 1]!;
  STATEMENTS[i]!.opening = r2(prev.opening + prev.tx.reduce((a, t) => a + t.amount, 0));
}

/** The doctored line on the September statement: printed 48,450.00, really 18,450.00. */
export const DOCTORED = { month: "2026-09", date: "2026-09-10", real: 18_450.0, shown: 48_450.0 };

export type SampleDoc = {
  key: string;
  id: string;
  label: string;
  /** The portal's staff category label (groups the Documents tab the way real uploads are grouped). */
  category: string;
  filename: string;
  documentType: string;
  period: string | null;
  size: number;
  fraud: "green" | "red";
};

export const DOCS: SampleDoc[] = [
  { key: "bank_2026_07", id: "8c2f0d1a-1b7e-4a52-9f60-1d0c5b7a3e01", label: "Bank statement - July 2026", category: "6 months business banking statements", filename: "Bank-Statement-2026-07-SAMPLE.pdf", documentType: "Bank Statement", period: "July 2026", size: 48_312, fraud: "green" },
  { key: "bank_2026_08", id: "8c2f0d1a-1b7e-4a52-9f60-1d0c5b7a3e02", label: "Bank statement - August 2026", category: "6 months business banking statements", filename: "Bank-Statement-2026-08-SAMPLE.pdf", documentType: "Bank Statement", period: "August 2026", size: 47_904, fraud: "green" },
  { key: "bank_2026_09", id: "8c2f0d1a-1b7e-4a52-9f60-1d0c5b7a3e03", label: "Bank statement - September 2026", category: "6 months business banking statements", filename: "Bank-Statement-2026-09-SAMPLE.pdf", documentType: "Bank Statement", period: "September 2026", size: 51_086, fraud: "red" },
  { key: "financials_2025", id: "8c2f0d1a-1b7e-4a52-9f60-1d0c5b7a3e04", label: "Financial statements - FY2025", category: "3 years accountant prepared financials", filename: "Financials-FY2025-SAMPLE.pdf", documentType: "Financial Statements", period: "FY2025", size: 112_640, fraud: "green" },
  { key: "void_cheque", id: "8c2f0d1a-1b7e-4a52-9f60-1d0c5b7a3e05", label: "Void cheque", category: "VOID cheque or PAD", filename: "Void-Cheque-SAMPLE.pdf", documentType: "Void Cheque", period: null, size: 21_455, fraud: "green" },
  { key: "photo_id", id: "8c2f0d1a-1b7e-4a52-9f60-1d0c5b7a3e06", label: "Photo ID (placeholder)", category: "2 pieces of Government Issued ID", filename: "Photo-ID-PLACEHOLDER-SAMPLE.pdf", documentType: "Photo ID", period: null, size: 18_220, fraud: "green" },
];

export const docById = (id: string): SampleDoc | undefined => DOCS.find((d) => d.id === id);

/** The September statement's two findings (tamper scan + statement math), in the words the portal shows. */
export const SEPTEMBER_FINDINGS = {
  tamper: { code: "edited_after_creation", label: "Edited after it was created", severity: "high", detail: "The PDF was changed with editing software 3 days after the bank produced it." },
  math: { code: "balance_mismatch", label: "Balances don't add up", severity: "high", detail: "The Sep 10 deposit from Lakeside Builders is printed as $48,450.00, but the running balance only moves by $18,450.00." },
};

// ---------------------------------------------------------------- lenders (KS-server src/demo/lenders.ts)

export type DemoLender = {
  id: string; name: string; product: string; category: string; min_amount: number; max_amount: number; min_years: number;
  min_revenue: number; provinces: string[] | "all"; equipment: boolean; rate: string; term: string;
  preferred_industries: string[]; note: string;
};

export const LENDERS: DemoLender[] = [
  { id: "aspen-ridge", name: "Aspen Ridge Capital", product: "Equipment finance", category: "Equipment", min_amount: 50_000, max_amount: 1_500_000, min_years: 2, min_revenue: 500_000, provinces: "all", equipment: true, rate: "7.9% - 11.5%", term: "24 - 72 months", preferred_industries: ["manufacturing", "construction", "transportation"], note: "Fast credit decisions on new equipment." },
  { id: "northgate", name: "Northgate Equipment Finance", product: "Equipment lease", category: "Equipment", min_amount: 25_000, max_amount: 500_000, min_years: 1, min_revenue: 250_000, provinces: "all", equipment: true, rate: "8.5% - 13.0%", term: "24 - 60 months", preferred_industries: ["manufacturing", "woodworking"], note: "Specialises in shop machinery." },
  { id: "granite-peak", name: "Granite Peak Credit Union", product: "Term and equipment loans", category: "Equipment", min_amount: 50_000, max_amount: 750_000, min_years: 2, min_revenue: 750_000, provinces: ["AB", "BC", "SK"], equipment: true, rate: "7.2% - 9.9%", term: "36 - 84 months", preferred_industries: [], note: "Western Canada only; likes owner-operated firms." },
  { id: "silverline", name: "Silverline Commercial Lending", product: "Senior term loan", category: "Term Loan", min_amount: 100_000, max_amount: 5_000_000, min_years: 3, min_revenue: 1_000_000, provinces: "all", equipment: false, rate: "6.9% - 9.5%", term: "36 - 120 months", preferred_industries: [], note: "Wants a debt service coverage of 1.25 or better." },
  { id: "cobalt-bay", name: "Cobalt Bay Funding", product: "Revenue-based advance", category: "Working Capital", min_amount: 10_000, max_amount: 300_000, min_years: 0.5, min_revenue: 120_000, provinces: "all", equipment: false, rate: "Factor 1.25 - 1.45", term: "6 - 18 months", preferred_industries: [], note: "Short-term working capital, not equipment." },
  { id: "harbourline", name: "Harbourline Asset Finance", product: "Large-ticket equipment", category: "Equipment", min_amount: 250_000, max_amount: 10_000_000, min_years: 5, min_revenue: 5_000_000, provinces: "all", equipment: true, rate: "6.5% - 8.9%", term: "36 - 96 months", preferred_industries: [], note: "Mid-market and larger companies." },
];

export type LenderScore = { lender: DemoLender; score: number; fit: "strong" | "possible" | "poor" };

/** Same rules as KS-server scoreLender(). */
export function scoreLender(l: DemoLender): LenderScore {
  const i = { amount: REQUEST.amount, years: BUSINESS.years_in_business, revenue: BUSINESS.annual_revenue, province: BUSINESS.province, industry: BUSINESS.industry.toLowerCase(), equipment: true, dscr: dscr() };
  let blockers = 0;
  let score = 50;
  if (i.amount < l.min_amount || i.amount > l.max_amount) blockers++;
  else score += 10;
  if (i.years < l.min_years) blockers++;
  else score += 8;
  if (i.revenue < l.min_revenue) blockers++;
  else score += 8;
  if (l.provinces !== "all" && !l.provinces.includes(i.province)) blockers++;
  else if (l.provinces !== "all") score += 4;
  if (i.equipment && l.equipment) score += 10;
  else if (i.equipment && !l.equipment) score -= 15;
  if (l.preferred_industries.some((p) => i.industry.includes(p))) score += 8;
  if (l.id === "silverline") {
    if (i.dscr >= 1.25) score += 4;
    else blockers++;
  }
  if (blockers) score = Math.min(score, 35) - 5 * (blockers - 1);
  score = Math.max(5, Math.min(98, score));
  return { lender: l, score, fit: blockers ? "poor" : score >= 80 ? "strong" : "possible" };
}

export function matchLenders(): LenderScore[] {
  return LENDERS.map(scoreLender).sort((a, b) => b.score - a.score || a.lender.name.localeCompare(b.lender.name));
}

/** The match row id the Lenders tab sends back (lenderProductIds) for a lender. */
export const matchIdFor = (lenderId: string) => `match-${lenderId}`;
export const lenderIdForMatch = (matchId: string) => String(matchId).replace(/^match-/, "");

// ---------------------------------------------------------------- the call

export type CallLine = { at: number; speaker: "borrower" | "broker"; text: string };

export const CALL_SCRIPT: CallLine[] = [
  { at: 0, speaker: "broker", text: "Hi Sam, thanks for calling. I have your file open in front of me." },
  { at: 4, speaker: "borrower", text: "Great. I just sent the bank statements and the financials from my phone. Did they come through?" },
  { at: 10, speaker: "broker", text: "They did. One thing - the September statement doesn't add up on our end. Where did that copy come from?" },
  { at: 17, speaker: "borrower", text: "Oh, my bookkeeper put that one together for me. I can download it straight from the credit union instead." },
  { at: 24, speaker: "broker", text: "Please do - lenders only take the original from the bank. How soon do you need the router?" },
  { at: 30, speaker: "borrower", text: "The supplier is holding it until the end of next month, so a few weeks is fine." },
  { at: 35, speaker: "broker", text: "Perfect. Send the original September statement and I'll get the file to lenders this week." },
];

export const CALL_SUMMARY = {
  headline: "Borrower called about document status; September statement to be replaced with the bank original.",
  points: [
    "Sam confirmed the bank statements and FY2025 financials were sent from the phone.",
    "The September 2026 statement was put together by the bookkeeper, not downloaded from the bank. The fraud check flagged it.",
    "Sam will download the original September statement from the credit union.",
    "Timing: the equipment supplier is holding the CNC router until the end of next month.",
  ],
  follow_up: "Task: request the original September 2026 statement from Sam (due in 2 days).",
  sentiment: "Cooperative",
};

export const CALL_DURATION_SECONDS = 42;

export function callNoteBody(): string {
  return [
    `AI call note - ${CALL_SUMMARY.headline}`,
    "",
    ...CALL_SUMMARY.points.map((p) => `- ${p}`),
    "",
    CALL_SUMMARY.follow_up,
    `Tone: ${CALL_SUMMARY.sentiment}. Call length: ${CALL_DURATION_SECONDS} seconds.`,
  ].join("\n");
}

// ---------------------------------------------------------------- other files on the board (scenery)

export type BoardCard = { id: string; name: string; stage: string; amount: number; product: string; contact: string; ageDays: number; docs: [number, number] };

export const OTHER_CARDS: BoardCard[] = [
  { id: "1a2b3c4d-0000-4000-8000-00000000a001", name: "Prairie Ridge Logistics Inc. (sample)", stage: "In Review", amount: 180_000, product: "working_capital", contact: "Dana Whitfield", ageDays: 2, docs: [4, 6] },
  { id: "1a2b3c4d-0000-4000-8000-00000000a002", name: "Northern Lights Dental Corp. (sample)", stage: "Documents Required", amount: 95_000, product: "equipment_financing", contact: "Priya Mendez", ageDays: 4, docs: [2, 5] },
  { id: "1a2b3c4d-0000-4000-8000-00000000a003", name: "Copperline Electrical Ltd. (sample)", stage: "Off to Lender", amount: 420_000, product: "term_loan", contact: "Marcus Lee", ageDays: 1, docs: [7, 7] },
  { id: "1a2b3c4d-0000-4000-8000-00000000a004", name: "Bluebird Bakery Co. (sample)", stage: "Offer", amount: 60_000, product: "line_of_credit", contact: "Elena Novak", ageDays: 3, docs: [5, 5] },
];

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;
