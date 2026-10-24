// KS_PORTAL_v11_LIVE_DEMO - the in-browser server for the broker side of the live demo. window.fetch is wrapped:
// every call to the portal's API (the configured server, or a same-origin /api/...) is answered here from the sample
// file and the demo state; nothing reaches a real server. Two calls leave the browser on purpose, to the demo server
// of the prospect's session: the sample PDFs for document previews and, on Send, the guided submit that emails the
// prospect the real lender package. Anything not listed is answered 404 and recorded in `unhandled` (tests assert
// a full tour leaves it empty).
import { DEMO_STAFF_ID } from "../mode";
import { fetchSamplePdf, guidedSubmit, type DemoSessionInfo } from "../demoApi";
import {
  APP_ID, BANK, BUSINESS, CALL_SUMMARY, CONTACT, DOCS, FINANCIALS, OTHER_CARDS, REQUEST, SEPTEMBER_FINDINGS, STATEMENTS, ASSUMED_RATE_PCT,
  DOCTORED, docById, dscr, lenderIdForMatch, matchIdFor, matchLenders, money, monthlyPayment,
} from "./fixture";
import { getState, keysWith, updateState, type BrokerDemoState } from "./state";
import { samplePdfFor } from "./samplePdf";

export type Prospect = { name: string; company: string };

export type ShimOptions = {
  /** The browser's own fetch, for the demo server. */
  realFetch: typeof fetch;
  /** Origin of the portal's API server (SERVER_URL). */
  serverOrigin: string;
  prospect: () => Prospect;
  session: () => DemoSessionInfo | null;
  /** Waits for (and retries opening) the session; throws when it cannot. */
  waitForSession: () => Promise<DemoSessionInfo>;
  /** Simulated server time per request, so "Accepting..." states are visible. 0 in tests. */
  latencyMs?: number;
  now?: () => Date;
  onSubmitted?: (r: { emailed_to: string | null; lenders: string[] }) => void;
};

type Req = { method: string; path: string; query: URLSearchParams; body: any; url: string };
type Out = { status?: number; json?: unknown; bytes?: Uint8Array; response?: Response };
type Handler = (req: Req, m: RegExpExecArray) => Out | Promise<Out>;

const ok = (data: unknown): Out => ({ json: { success: true, ok: true, data } });
const raw = (json: unknown, status = 200): Out => ({ json, status });
const notFound = (message = "Not part of the demo."): Out => ({ status: 404, json: { success: false, error: "not_in_demo", message } });

const ID = "([^/?#]+)";
const isMain = (id: string) => decodeURIComponent(id) === APP_ID;

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  return { first: parts[0] ?? "Demo", last: parts.slice(1).join(" ") || "Broker" };
}

export function createShim(opts: ShimOptions) {
  const now = () => (opts.now ? opts.now() : new Date());
  const ago = (minutes: number) => new Date(now().getTime() - minutes * 60_000).toISOString();
  const unhandled: string[] = [];
  const handled: string[] = [];
  const state = (): BrokerDemoState => getState();
  const prospect = () => opts.prospect();

  // ---------------------------------------------------------------- shapes
  const docProgress = () => {
    const s = state();
    const vals = DOCS.map((d) => s.docs[d.id]?.status ?? "pending");
    return { accepted: vals.filter((v) => v === "accepted").length, rejected: vals.filter((v) => v === "rejected").length, pending: vals.filter((v) => v === "pending").length, total: vals.length };
  };

  const mainCard = () => {
    const p = splitName(prospect().name);
    return {
      id: APP_ID, name: BUSINESS.legal_name, business_legal_name: BUSINESS.legal_name, pipeline_state: state().stage,
      requested_amount: REQUEST.amount, created_at: state().startedAt, submitted_at: state().startedAt, stage_entered_at: state().startedAt,
      owner_user_id: DEMO_STAFF_ID, owner_first_name: p.first, owner_last_name: p.last, contact_name: CONTACT.name, contact_id: null,
      phone: CONTACT.phone, doc_progress: docProgress(), product_category: REQUEST.product_category,
    };
  };

  const otherCards = () => OTHER_CARDS.map((c) => ({
    id: c.id, name: c.name, business_legal_name: c.name, pipeline_state: c.stage, requested_amount: c.amount,
    created_at: ago(c.ageDays * 24 * 60 + 90), submitted_at: ago(c.ageDays * 24 * 60 + 90), stage_entered_at: ago(c.ageDays * 24 * 60),
    owner_user_id: null, contact_name: c.contact, contact_id: null, doc_progress: { accepted: c.docs[0], rejected: 0, pending: c.docs[1] - c.docs[0], total: c.docs[1] },
    product_category: c.product,
  }));

  const nameOf = (id: string) => (isMain(id) ? BUSINESS.legal_name : OTHER_CARDS.find((c) => c.id === decodeURIComponent(id))?.name ?? "Sample application");

  const docRow = (d: (typeof DOCS)[number]) => {
    const dec = state().docs[d.id];
    const red = d.fraud === "red";
    return {
      documentId: d.id, category: d.category, title: d.label, filename: d.filename, mimeType: "application/pdf", size: d.size,
      storageKey: null, createdAt: ago(18), status: dec?.status ?? "pending", rejectionReason: dec?.reason ?? null, ocrStatus: "completed",
      displayName: dec?.displayName ?? null,
      tamperLevel: red ? "high" : "clean",
      tamperSignals: red ? [SEPTEMBER_FINDINGS.tamper, SEPTEMBER_FINDINGS.math] : [],
    };
  };

  const applicationRecord = (id: string) => {
    const main = isMain(id);
    const card = main ? mainCard() : otherCards().find((c) => c.id === decodeURIComponent(id));
    return {
      application: {
        id: decodeURIComponent(id), name: nameOf(id), pipelineState: card?.pipeline_state ?? "In Review", parkedPreviousStage: null, parkedReason: null,
        productCategory: card?.product_category ?? null, product_category: card?.product_category ?? null, metadata: {},
      },
      product_category: card?.product_category ?? null,
      documents: main ? DOCS.map(docRow) : [],
      bankCoverage: main ? { requiredMonths: 3, missingMonths: [], undatedStatements: 0, statements: 3, summary: "3 of 3 months on file (Jul - Sep 2026)" } : undefined,
    };
  };

  const details = (id: string) => {
    if (!isMain(id)) return { id: decodeURIComponent(id), stage: "In Review", businessDetails: { legalName: nameOf(id) }, applicantDetails: {}, overview: {}, owners: [], rawPayload: {} };
    return {
      id: APP_ID, stage: state().stage, status: state().stage, submittedAt: state().startedAt, productCategory: REQUEST.product_category,
      overview: { requestedAmount: REQUEST.amount, productCategory: REQUEST.product_category },
      fundingRequest: { amount: REQUEST.amount, purpose: REQUEST.purpose },
      businessDetails: {
        legalName: BUSINESS.legal_name, operatingName: BUSINESS.operating_name, address: BUSINESS.street, city: BUSINESS.city, province: BUSINESS.province,
        postalCode: BUSINESS.postal, phone: BUSINESS.phone, website: `https://${BUSINESS.website}`, industry: BUSINESS.industry, businessStructure: "corporation",
        startDate: BUSINESS.started, timeInBusiness: `${BUSINESS.years_in_business} years`, numberOfEmployees: BUSINESS.employees,
        annualRevenue: BUSINESS.annual_revenue, monthlyRevenue: Math.round(BUSINESS.annual_revenue / 12),
      },
      applicantDetails: {
        firstName: CONTACT.first_name, lastName: CONTACT.last_name, title: CONTACT.title, phone: CONTACT.phone, email: CONTACT.email,
        dateOfBirth: CONTACT.dob, sin: "000000000", street: CONTACT.home.street, city: CONTACT.home.city, province: CONTACT.home.province,
        postalCode: CONTACT.home.postal, ownership: CONTACT.ownership_pct,
      },
      financialProfile: {
        annualRevenue: BUSINESS.annual_revenue, monthlyRevenue: Math.round(BUSINESS.annual_revenue / 12), yearsInBusiness: BUSINESS.years_in_business,
        purposeOfFunds: REQUEST.purpose, fundingAmount: REQUEST.amount, industry: BUSINESS.industry, fixedAssets: FINANCIALS.years[0].total_assets - FINANCIALS.years[0].current_assets,
        businessLocation: `${BUSINESS.city}, ${BUSINESS.province}`,
      },
      owners: [],
      rawPayload: { product_category: REQUEST.product_category, purposeOfFunds: REQUEST.purpose },
    };
  };

  const financials = (id: string) => {
    if (!isMain(id)) return { documents: [], fields: [] };
    const fin = DOCS.find((d) => d.key === "financials_2025")!;
    const [cur, prev] = FINANCIALS.years;
    const f = (label: string, value: number, confidence = 0.97) => ({ documentId: fin.id, sourceDocumentType: "financial_statements", fieldKey: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"), displayLabel: label, value: money(value), confidence });
    return {
      documents: [{ documentId: fin.id, category: fin.category, filename: state().docs[fin.id]?.displayName ?? fin.filename, status: state().docs[fin.id]?.status ?? "pending", ocrStatus: "completed", uploadedAt: ago(18) }],
      fields: [
        f("Revenue", cur.revenue), f(`Revenue (FY${prev.year})`, prev.revenue, 0.95), f("Cost of sales", cur.cogs), f("Gross profit", cur.gross_profit),
        f("EBITDA", cur.ebitda), f(`EBITDA (FY${prev.year})`, prev.ebitda, 0.95), f("Net income", cur.net_income), f(`Net income (FY${prev.year})`, prev.net_income, 0.95),
        f("Total assets", cur.total_assets), f("Total liabilities", cur.total_liabilities), f("Equity", cur.equity),
      ],
    };
  };

  const banking = (id: string) => {
    if (!isMain(id)) return { status: "no_bank_statements", monthGroups: [], documentsAnalyzed: 0 };
    let bal = STATEMENTS[0]!.opening;
    let lowest = bal;
    const months = STATEMENTS.map((st) => {
      // The September statement is read as printed: the doctored deposit counts at the amount shown.
      const amounts = st.tx.map((t) => (st.month === DOCTORED.month && t.date === DOCTORED.date ? DOCTORED.shown : t.amount));
      const deposits = amounts.filter((a) => a > 0).reduce((a, b) => a + b, 0);
      const withdrawals = -amounts.filter((a) => a < 0).reduce((a, b) => a + b, 0);
      bal = st.opening + st.tx.reduce((a, t) => a + t.amount, 0);
      for (let i = 0, run = st.opening; i < st.tx.length; i++) {
        run += st.tx[i]!.amount;
        lowest = Math.min(lowest, run);
      }
      return { month: `${st.month}-01`, deposits: Math.round(deposits), withdrawals: Math.round(withdrawals), net: Math.round(deposits - withdrawals), endingBalance: Math.round(bal), nsfCount: 0 };
    });
    const totalDeposits = months.reduce((a, m) => a + m.deposits, 0);
    const totalWithdrawals = months.reduce((a, m) => a + m.withdrawals, 0);
    const vendors = new Map<string, number>();
    for (const st of STATEMENTS) for (const t of st.tx) if (t.amount < 0) vendors.set(t.description, (vendors.get(t.description) ?? 0) + -t.amount);
    return {
      applicationId: APP_ID, status: "analysis_complete", bankCount: 1, documentsAnalyzed: 3, currency: "CAD",
      dateRange: { start: "2026-07-01", end: "2026-09-30" },
      monthGroups: months,
      inflows: { totalDeposits, averageMonthlyDeposits: Math.round(totalDeposits / 3) },
      outflows: { totalWithdrawals },
      cashFlow: { currentMonthNet: months[2]!.net, monthsProfitableNumerator: months.filter((m) => m.net > 0).length, monthsProfitableDenominator: 3 },
      balances: { averageDailyBalance: Math.round(STATEMENTS.reduce((a, s) => a + s.opening, 0) / 3 + 4_100), negativeBalanceDays: 0, lowestBalance: Math.round(lowest) },
      riskFlags: {
        averageMonthlyNsfs: 0, daysWithInsufficientFunds: 0,
        unusualTransactions: [{ date: DOCTORED.date, amount: DOCTORED.shown, description: "Customer payment - Lakeside Builders (balance does not reconcile)", type: "Check" }],
      },
      accountBalances: [{ accountLabel: `${BANK} - business chequing`, averageDailyBalance: Math.round(STATEMENTS.reduce((a, s) => a + s.opening, 0) / 3 + 4_100), negativeBalanceDays: 0, days: 92 }],
      documents: DOCS.filter((d) => d.key.startsWith("bank_")).map((d) => ({ document_id: d.id, filename: state().docs[d.id]?.displayName ?? d.filename, transaction_count: 12, usable_count: 12, pages: 2 })),
      topVendors: [...vendors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([vendor, total]) => ({ vendor, total: Math.round(total) })),
    };
  };

  const creditSummary = (id: string) => {
    if (!isMain(id)) return { summary: null };
    const [cur, prev] = FINANCIALS.years;
    const pay = monthlyPayment(REQUEST.amount, ASSUMED_RATE_PCT, REQUEST.term_months);
    const ratio = dscr();
    const growth = Math.round(((cur.revenue - prev.revenue) / prev.revenue) * 1000) / 10;
    const deposits = (banking(id) as { inflows: { averageMonthlyDeposits: number } }).inflows.averageMonthlyDeposits;
    const cs = state().creditSummary;
    const debtService = (y: typeof cur) => Math.round(y.existing_debt_service + pay * 12);
    const doc = {
      dealType: "equipment",
      overview: {
        applicant_name: BUSINESS.legal_name, address: BUSINESS.address, principals: `${CONTACT.name}, ${CONTACT.title} (${CONTACT.ownership_pct}%)`,
        assets: "CNC router and dust collection (new)", transaction: `${money(REQUEST.amount)} equipment financing`, structure: `${REQUEST.term_months}-month amortising loan, ${money(REQUEST.down_payment)} down`,
        asset_value: money(REQUEST.equipment_cost), facility_request: money(REQUEST.amount), term: `${REQUEST.term_months} months`, industry: `${BUSINESS.industry} (NAICS ${BUSINESS.naics})`,
        ltv: `${Math.round((REQUEST.amount / REQUEST.equipment_cost) * 100)}%`, additional_security: "General security agreement; personal guarantee from the owner", website: BUSINESS.website,
      },
      financials: {
        periods: [{ label: `FY${prev.year}`, kind: "annual" }, { label: `FY${cur.year}`, kind: "annual" }],
        rows: [
          { item: "revenue", values: [prev.revenue, cur.revenue] },
          { item: "ebitda", values: [prev.ebitda, cur.ebitda] },
          { item: "net_income", values: [prev.net_income, cur.net_income] },
          { item: "total_debt_service", values: [debtService(prev), debtService(cur)] },
          { item: "dscr", values: [Math.round((prev.ebitda / debtService(prev)) * 100) / 100, ratio] },
          { item: "current_assets", values: [prev.current_assets, cur.current_assets] },
          { item: "current_liabilities", values: [prev.current_liabilities, cur.current_liabilities] },
          { item: "current_ratio", values: [Math.round((prev.current_assets / prev.current_liabilities) * 100) / 100, Math.round((cur.current_assets / cur.current_liabilities) * 100) / 100] },
          { item: "equity", values: [prev.equity, cur.equity] },
          { item: "debt_to_equity", values: [Math.round((prev.total_liabilities / prev.equity) * 100) / 100, Math.round((cur.total_liabilities / cur.equity) * 100) / 100] },
        ],
      },
      equipment: { items: [{ year: 2026, make: "Sample", model: "5x10 CNC router with dust collection", hours: "New", price: REQUEST.equipment_cost }], total: REQUEST.equipment_cost },
      receivables: null,
      sections: [
        { key: "transaction", title: "Transaction", text: `${BUSINESS.legal_name} requests ${money(REQUEST.amount)} of equipment financing over ${REQUEST.term_months} months for ${REQUEST.purpose.charAt(0).toLowerCase()}${REQUEST.purpose.slice(1)} The equipment costs ${money(REQUEST.equipment_cost)}; the owner puts ${money(REQUEST.down_payment)} down.` },
        { key: "overview", title: "Company overview", text: `${BUSINESS.operating_name} builds custom millwork and cabinetry in ${BUSINESS.city}, ${BUSINESS.province}. It started in ${BUSINESS.started.slice(0, 4)}, has ${BUSINESS.employees} employees and is 100% owned by ${CONTACT.name}.` },
        { key: "deal_section", title: "Use of funds", text: "Bringing cabinet-door work in-house removes an outside supplier and shortens lead times. The supplier is holding the router until the end of next month." },
        { key: "financial_commentary", title: "Financial commentary", text: `Revenue grew ${growth}% to ${money(cur.revenue)} in FY${cur.year}; EBITDA was ${money(cur.ebitda)}. At an assumed ${ASSUMED_RATE_PCT}% the new payment is about ${money(pay)} a month, and EBITDA covers all debt service ${ratio.toFixed(2)} times. Bank deposits average ${money(deposits)} a month over three statements.` },
        { key: "rationale", title: "Why we support this request", text: "", bullets: [
          `${BUSINESS.years_in_business} years in business with revenue up ${growth}%.`,
          `Debt service coverage of ${ratio.toFixed(2)}x including the new loan.`,
          `${Math.round((REQUEST.down_payment / REQUEST.equipment_cost) * 100)}% owner equity in the equipment; the asset is new and saleable.`,
        ] },
        { key: "risks", title: "Risks and mitigants", text: "", risks: [
          { risk: "September 2026 bank statement failed the fraud checks (edited after creation; balances do not reconcile).", mitigant: "The borrower confirmed the bookkeeper prepared it; the original is requested from the credit union before funding." },
          { risk: "Single new machine concentrates the equipment risk.", mitigant: "Standard CNC equipment with an active resale market; general security agreement." },
        ] },
      ],
      missing: [],
      warnings: [`September 2026 statement: ${SEPTEMBER_FINDINGS.math.detail}`],
      unverifiedResearch: [],
      generatedAt: ago(2),
    };
    return { summary: { doc, status: cs.status, submitted_by_name: cs.submitted_by_name, submitted_at: cs.submitted_at } };
  };

  const fraudOverview = (id: string) => {
    const main = isMain(id);
    const docs = main ? DOCS.map((d) => {
      const red = d.fraud === "red";
      const at = ago(17);
      const tamper = red
        ? { status: "red", reasons: [{ code: SEPTEMBER_FINDINGS.tamper.code, severity: "red", text: `${SEPTEMBER_FINDINGS.tamper.label}: ${SEPTEMBER_FINDINGS.tamper.detail}` }], checked_at: at }
        : { status: "green", reasons: [{ code: "clean", severity: "info", text: "No signs of editing found." }], checked_at: at };
      const math = d.key.startsWith("bank_")
        ? red
          ? { status: "red", reasons: [{ code: SEPTEMBER_FINDINGS.math.code, severity: "red", text: `Statement arithmetic doesn't reconcile: ${SEPTEMBER_FINDINGS.math.detail}` }], checked_at: at }
          : { status: "green", reasons: [{ code: "balanced", severity: "info", text: "All 12 running balances and the closing balance add up." }], checked_at: at }
        : null;
      return { document_id: d.id, filename: state().docs[d.id]?.displayName ?? d.filename, category: d.category, tamper, statement_math: math };
    }) : [];
    const check = (key: string, label: string, plan: string, status: string, description: string, reasons: Array<{ code: string; severity: string; text: string }> = []) =>
      ({ key, label, plan, description, scope: "application", locked: false, status, reasons, checked_at: ago(17), provider: null });
    const g = (text: string) => [{ code: "ok", severity: "info", text }];
    const checks = main ? [
      check("fraud_1", "Document tamper scan", "starter", "per_document", "Every upload is checked for signs of editing."),
      check("fraud_2", "Bank statement math check", "starter", "per_document", "Every transaction on each bank statement is re-added and the balances checked."),
      check("fraud_4", "Duplicate document check", "starter", "green", "Spots the same file, ID or void cheque on another application.", g("No copies of these files on any other application.")),
      check("fraud_5", "Revenue vs bank deposits", "starter", "green", "Compares reported revenue with the money actually deposited.", g("Deposits annualise to about $2.2M against $2.14M reported revenue.")),
      check("fraud_6", "Business reality check", "growth", "green", "Registration, director, address and web presence.", g("Registered in Alberta since 2019; Sam Carter is the sole director.")),
      check("fraud_7", "Phone and email risk", "growth", "green", "VoIP lines, throwaway email addresses and new domains.", g("Mobile line; the business email domain is established.")),
      check("fraud_8", "ID checks", "growth", "green", "Name and date of birth on the ID against the applicant.", g("Name and date of birth match the application.")),
      check("fraud_9", "Device and location check", "pro", "green", "VPNs, shared devices, out-of-region applications.", g("Applied from a phone in Edmonton, no VPN.")),
      check("fraud_10", "Application behaviour signals", "pro", "green", "Pasted numbers, impossibly fast applications, copied answers.", g("Normal typing pace; nothing pasted.")),
      check("fraud_11", "Loan stacking detector", "pro", "green", "Recent advances and lender debits that were not mentioned.", g("Only the disclosed equipment loan ($5,400 a month).")),
      check("fraud_12", "Fraud network map", "pro", "green", "Links applications that share contact details, devices or directors.", g("No links to other applications.")),
      check("fraud_13", "Shared fraud watchlist", "pro", "green", "Confirmed fraud reported by other brokerages.", g("Not on the watchlist.")),
      check("fraud_14", "Inside-job alerts", "pro", "green", "Staff changing banking details or approving their own file.", g("No staff changes to this file.")),
      check("fraud_15", "Call voice check", "pro", state().callDone ? "green" : "not_applicable", "Recorded calls are checked for synthetic or cloned voices.", state().callDone ? g("The call with Sam sounds like a real person.") : []),
      check("fraud_16", "Fraud score and lender pre-screen", "pro", "red", "One 0-100 score with plain-English reasons."),
    ] : [];
    const score = main ? {
      score: 72, band: "high",
      reasons: [
        { check: "fraud_2", label: "Bank statement math check", severity: "red", text: "September 2026: the balances don't reconcile around a $48,450.00 deposit." },
        { check: "fraud_1", label: "Document tamper scan", severity: "red", text: "September 2026: the PDF was edited after the bank created it." },
      ],
      covered: checks.filter((c) => c.key !== "fraud_16" && c.status !== "not_applicable").map((c) => ({ check: c.key, label: c.label, status: c.status === "per_document" ? "red" : c.status })),
      not_covered: [],
    } : null;
    return { application_id: decodeURIComponent(id), checks, documents: docs, score, include_prescreen_in_package: true, queue: { queued: false, done_at: ago(17), last_error: null } };
  };

  const envelope = (id: string) => {
    if (!isMain(id)) return { status: "locked", outstanding: ["bank_statements"], computed_at: null, matches: [] };
    return {
      status: "ready", outstanding: [], computed_at: ago(3), inputs: { productCategory: "Equipment" },
      matches: matchLenders().map(({ lender, score }) => ({
        id: matchIdFor(lender.id), lenderId: lender.id, lenderName: lender.name, productName: `${lender.product} · ${lender.rate} · ${lender.term}`,
        productCategory: lender.category, amountMin: lender.min_amount, amountMax: lender.max_amount, matchPercent: score, files: [],
      })),
    };
  };

  const notes = (id: string) => (isMain(id) ? state().notes.map((n) => ({ ...n, application_id: APP_ID, silo: "BF", owner_id: null, mentions: [], updated_at: n.created_at })).reverse() : []);

  async function samplePdfResponse(docId: string): Promise<Out> {
    const doc = docById(docId);
    const s = opts.session();
    if (doc && s) {
      try {
        const blob = await fetchSamplePdf(s, doc.key, opts.realFetch);
        return { response: new Response(blob, { status: 200, headers: { "content-type": "application/pdf" } }) };
      } catch {
        /* fall back to the in-browser copy */
      }
    }
    if (!doc) return notFound();
    const blob = samplePdfFor(docId);
    return { response: new Response(blob, { status: 200, headers: { "content-type": "application/pdf" } }) };
  }

  async function submitToLenders(body: { applicationId?: string; lenderProductIds?: string[] }): Promise<Out> {
    if (!isMain(String(body?.applicationId ?? ""))) return raw({ success: false, error: "not_in_demo", message: "Only the sample file can be sent in the demo." }, 409);
    const lenders = (body.lenderProductIds ?? []).map(lenderIdForMatch);
    let session: DemoSessionInfo;
    try {
      session = await opts.waitForSession();
    } catch (e) {
      return raw({ success: false, error: "demo_unavailable", message: e instanceof Error ? e.message : "The demo server did not answer." }, 503);
    }
    try {
      const r = await guidedSubmit(session, { accepted: keysWith("accepted"), rejected: keysWith("rejected"), lenders, call_answered: getState().callAnswered }, opts.realFetch);
      const at = now().toISOString();
      updateState((s) => {
        s.submission = r;
        s.stage = "Off to Lender";
        for (const l of lenders) if (!s.sent.some((x) => x.lenderId === l)) s.sent.push({ lenderId: l, sentAt: at });
      });
      opts.onSubmitted?.({ emailed_to: r.emailed_to, lenders });
      return ok({
        submissions: lenders.map((l) => ({ id: `sub-${l}`, lenderId: l, status: "sent" })),
        sent: lenders.map((l) => ({ lenderId: l, sentAt: at })),
        orchestrator: { stageA: { fired: false, reason: "already_signed" }, stageB: { fired: true, reason: "dispatched" } },
        emailed_to: r.emailed_to,
      });
    } catch (e) {
      return raw({ success: false, error: "demo_submit_failed", message: e instanceof Error ? e.message : "The demo server could not build the package." }, 502);
    }
  }

  // ---------------------------------------------------------------- routes
  const routes: Array<[string, RegExp, Handler]> = [
    // the licensee (brand) and the signed-in user
    ["GET", /^\/api\/licensee$/, () => raw({ ok: true, licensee: { company_name: prospect().company || "Keystone", assistant_name: "Assistant", support_email: "", primary_color: "#1e3a8a", accent_color: "#f59e0b", country: "CA", time_zone: "America/Edmonton" } })],
    ["GET", /^\/api\/auth\/me$/, () => {
      const p = splitName(prospect().name);
      const user = { id: DEMO_STAFF_ID, role: "Staff", silo: "BF", phone: null, first_name: p.first, last_name: p.last, name: prospect().name, email: null, silos: ["BF"] };
      return raw({ success: true, ok: true, data: { user }, userId: DEMO_STAFF_ID, role: "Staff", silo: "BF", user });
    }],
    ["POST", /^\/api\/auth\/url-ticket$/, () => ok({ ticket: "live-demo" })],
    ["GET", /^\/api\/plan$/, () => notFound("No plan in the demo: everything is switched on.")],

    // pipeline
    ["GET", /^\/api\/portal\/applications$/, () => ok({ items: [mainCard(), ...otherCards()] })],
    ["POST", new RegExp(`^/api/portal/applications/${ID}/open$`), (_r, m) => {
      if (isMain(m[1]!)) updateState((s) => { if (s.stage === "Received") s.stage = "In Review"; });
      return ok({ opened: true });
    }],
    ["PATCH", new RegExp(`^/api/portal/applications/${ID}/status$`), (r, m) => {
      if (isMain(m[1]!) && typeof r.body?.status === "string") updateState((s) => { s.stage = r.body.status; });
      return ok({ ok: true });
    }],

    // the application
    ["GET", new RegExp(`^/api/applications/${ID}/details$`), (_r, m) => ok(details(m[1]!))],
    ["GET", new RegExp(`^/api/application-origin/${ID}$`), () => ok({ origin: null })],
    ["GET", new RegExp(`^/api/portal/applications/${ID}$`), (_r, m) => ok(applicationRecord(m[1]!))],
    ["GET", new RegExp(`^/api/documents/${ID}/duplicates$`), () => ok({ groups: [] })],
    ["POST", new RegExp(`^/api/portal/applications/${ID}/reocr$`), () => ok({ totalDocs: DOCS.length, enqueued: DOCS.length, failed: 0 })],
    ["GET", new RegExp(`^/api/portal/documents/${ID}/suggested-name$`), (_r, m) => {
      const d = docById(decodeURIComponent(m[1]!));
      if (!d) return notFound();
      return ok({ parts: { businessName: BUSINESS.operating_name, documentType: d.documentType, period: d.period, extension: ".pdf" }, currentName: state().docs[d.id]?.displayName ?? null });
    }],
    ["POST", new RegExp(`^/api/portal/documents/${ID}/accept$`), (r, m) => {
      const d = docById(decodeURIComponent(m[1]!));
      if (!d) return notFound();
      const name = typeof r.body?.displayName === "string" && r.body.displayName.trim() ? r.body.displayName.trim() : `${BUSINESS.operating_name} - ${d.documentType}${d.period ? ` - ${d.period}` : ""}.pdf`;
      updateState((s) => { s.docs[d.id] = { status: "accepted", displayName: name, reason: null, decidedAt: now().toISOString() }; });
      return ok({ document: docRow(d) });
    }],
    ["POST", new RegExp(`^/api/portal/documents/${ID}/reject$`), (r, m) => {
      const d = docById(decodeURIComponent(m[1]!));
      if (!d) return notFound();
      updateState((s) => { s.docs[d.id] = { status: "rejected", displayName: s.docs[d.id]?.displayName ?? null, reason: String(r.body?.reason ?? "Rejected"), decidedAt: now().toISOString() }; });
      return ok({ document: docRow(d) });
    }],
    ["POST", new RegExp(`^/api/portal/documents/${ID}/fraud-scan$`), (_r, m) => {
      const d = docById(decodeURIComponent(m[1]!));
      if (d?.fraud === "red") {
        return ok({ level: "high", kind: "bank_statement", note: "Signals for review only.", signals: [
          { code: SEPTEMBER_FINDINGS.tamper.code, label: SEPTEMBER_FINDINGS.tamper.label, severity: "high", detail: SEPTEMBER_FINDINGS.tamper.detail },
          { code: SEPTEMBER_FINDINGS.math.code, label: SEPTEMBER_FINDINGS.math.label, severity: "high", detail: SEPTEMBER_FINDINGS.math.detail },
        ] });
      }
      return ok({ level: "clean", signals: [], note: null });
    }],
    ["GET", new RegExp(`^/api/portal/documents/${ID}/file$`), (_r, m) => samplePdfResponse(decodeURIComponent(m[1]!))],
    ["POST", new RegExp(`^/api/documents/${ID}/category$`), () => ok({ ok: true })],
    ["GET", new RegExp(`^/api/portal/applications/${ID}/financials$`), (_r, m) => ok(financials(m[1]!))],
    ["GET", new RegExp(`^/api/applications/${ID}/banking-analysis$`), (_r, m) => ok(banking(m[1]!))],
    ["POST", new RegExp(`^/api/applications/${ID}/banking-analysis/retry$`), () => ok({ queued: true })],
    ["GET", new RegExp(`^/api/portal/applications/${ID}/ocr-diagnostic$`), () => ok({ diagnosis: "No bank statements on this sample file." })],

    // credit summary
    ["GET", new RegExp(`^/api/credit-summary-v2/${ID}$`), (_r, m) => ok(creditSummary(m[1]!))],
    ["POST", new RegExp(`^/api/credit-summary-v2/${ID}/generate$`), (_r, m) => ok(creditSummary(m[1]!))],
    ["PUT", new RegExp(`^/api/credit-summary-v2/${ID}/sections/[^/]+$`), (_r, m) => ok(creditSummary(m[1]!))],
    ["POST", new RegExp(`^/api/credit-summary-v2/${ID}/submit$`), (_r, m) => {
      if (isMain(m[1]!)) updateState((s) => { s.creditSummary = { status: "submitted", submitted_at: now().toISOString(), submitted_by_name: prospect().name }; });
      return ok(creditSummary(m[1]!));
    }],
    ["GET", new RegExp(`^/api/credit-summary-v2/${ID}/export\\.(pdf|docx)$`), () => raw({ success: false, error: "not_in_demo", message: "Downloads are switched off in the demo - the package arrives by email when you send it." }, 403)],
    ["POST", new RegExp(`^/api/credit-financials/${ID}/extract$`), () => ok({ documents: 1, skipped: [] })],
    ["POST", new RegExp(`^/api/credit-collateral/${ID}/extract$`), () => ok({ documents: 0, skipped: [] })],
    ["POST", new RegExp(`^/api/credit-research/${ID}/refresh$`), () => ok({ found: 0, facts: [], notes: ["Research is switched off in the demo."] })],

    // fraud
    ["GET", new RegExp(`^/api/fraud/applications/${ID}$`), (_r, m) => ok(fraudOverview(m[1]!))],
    ["POST", new RegExp(`^/api/fraud/applications/${ID}/run$`), () => ok({ ok: true, queued: false })],
    ["GET", new RegExp(`^/api/fraud/applications/${ID}/network$`), () => ok({ ok: true, network: {
      nodes: [
        { id: "app", type: "application", label: BUSINESS.legal_name, current: true },
        { id: "phone", type: "phone", label: CONTACT.phone },
        { id: "email", type: "email", label: CONTACT.email },
        { id: "addr", type: "address", label: BUSINESS.address },
        { id: "bank", type: "bank_account", label: `${BANK} ...0417` },
      ],
      edges: [{ from: "app", to: "phone" }, { from: "app", to: "email" }, { from: "app", to: "addr" }, { from: "app", to: "bank" }],
    } })],
    ["GET", new RegExp(`^/api/fraud/applications/${ID}/prescreen$`), () => ok({ ok: true, include_in_package: true, score: fraudOverview(APP_ID).score, lines: [
      `Fraud pre-screen - ${BUSINESS.legal_name}`,
      "Score 72/100 (high): the September 2026 bank statement failed two checks.",
      "All other documents and checks: no concerns.",
      "The borrower is replacing the statement with the bank's original.",
    ] })],
    ["PUT", new RegExp(`^/api/fraud/applications/${ID}/prescreen$`), (r) => ok({ ok: true, include_in_package: Boolean(r.body?.include_in_package) })],

    // KS_PORTAL_v13_QUICKBOOKS - QuickBooks is not part of the demo: no invoice on the card, the Settings card greyed out.
    ["GET", new RegExp(`^/api/quickbooks/applications/${ID}/invoice$`), () => raw({ configured: false, connected: false, invoice: null })],
    ["GET", /^\/api\/quickbooks\/status$/, () => raw({ configured: false, reason: "QuickBooks is not part of the demo.", environment: "sandbox", connected: false, status: null, companyName: null, realmId: null, connectedAt: null, lastError: null, taxCodeId: null, taxCodeName: null })],

    // notes
    ["GET", new RegExp(`^/api/applications/${ID}/notes$`), (_r, m) => ok({ ok: true, items: notes(m[1]!) })],
    ["POST", new RegExp(`^/api/applications/${ID}/notes$`), (r, m) => {
      const note = { id: `note-${Date.now()}`, body: String(r.body?.body ?? ""), owner_name: prospect().name, created_at: now().toISOString() };
      if (isMain(m[1]!)) updateState((s) => { s.notes.push(note); });
      return ok({ ...note, application_id: APP_ID, silo: "BF", owner_id: DEMO_STAFF_ID, mentions: [], updated_at: note.created_at });
    }],
    ["PATCH", new RegExp(`^/api/applications/${ID}/notes/${ID}$`), (r, m) => {
      updateState((s) => { const n = s.notes.find((x) => x.id === decodeURIComponent(m[2]!)); if (n) n.body = String(r.body?.body ?? n.body); });
      return ok({ ok: true });
    }],
    ["DELETE", new RegExp(`^/api/applications/${ID}/notes/${ID}$`), (_r, m) => {
      updateState((s) => { s.notes = s.notes.filter((x) => x.id !== decodeURIComponent(m[2]!)); });
      return ok({ ok: true, id: decodeURIComponent(m[2]!) });
    }],

    // lenders
    ["GET", new RegExp(`^/api/applications/${ID}/lenders/envelope$`), (_r, m) => ok(envelope(m[1]!))],
    ["POST", new RegExp(`^/api/applications/${ID}/lenders/recalculate$`), (_r, m) => ok(envelope(m[1]!))],
    ["GET", new RegExp(`^/api/applications/${ID}/signing-readiness$`), () => ok({ snapshot: { collateralRequired: false }, collateralApplies: false })],
    ["GET", new RegExp(`^/api/applications/${ID}/signing-sms$`), () => ok({ name: CONTACT.name, sms: null })],
    ["GET", new RegExp(`^/api/applications/${ID}/sent-lenders$`), (_r, m) => ok({ sent: isMain(m[1]!) ? state().sent.map((x) => ({ lenderId: x.lenderId, sentAt: x.sentAt })) : [] })],
    ["GET", new RegExp(`^/api/applications/${ID}/lender-responses$`), () => ok({ responses: [] })],
    ["GET", new RegExp(`^/api/portal/applications/${ID}/fee-agreement$`), () => ok({ required: false })],
    ["POST", /^\/api\/portal\/lender-submissions$/, (r) => submitToLenders(r.body ?? {})],
    ["POST", new RegExp(`^/api/applications/${ID}/product-category$`), () => ok({ ok: true })],

    // the Application tab (the card opens on it first)
    ["GET", new RegExp(`^/api/applications/${ID}/product-questions$`), () => ok({ set: null, questions: [], missing: [] })],
    ["GET", new RegExp(`^/api/applications/${ID}/task-status$`), (_r, m) => ok({
      applicationId: decodeURIComponent(m[1]!),
      tasks: [{ key: "documents", label: "Upload documents", complete: true }, { key: "signature", label: "Sign the application", complete: true }],
      summary: { total: 2, complete: 2, outstanding: 0, allComplete: true },
    })],
    ["GET", new RegExp(`^/api/applications/${ID}/contacts$`), () => ok([])],

    // the shell around every page: team chat, presence, message and notification badges, referral issues
    ["GET", /^\/api\/team\/channels$/, () => ok({ channels: [] })],
    ["GET", /^\/api\/team\/users$/, () => ok({ users: [] })],
    ["GET", /^\/api\/team\/statuses$/, () => ok({ statuses: [] })],
    ["PUT", /^\/api\/team\/status$/, () => ok({ ok: true })],
    ["POST", /^\/api\/telephony\/presence$/, () => ok({ ok: true })],
    ["POST", /^\/api\/telephony\/presence\/heartbeat$/, () => ok({ onCall: false })],
    ["GET", /^\/api\/communications\/messages-list$/, () => ok({ conversations: [] })],
    ["GET", /^\/api\/notifications$/, () => ok({ items: [] })],
    ["POST", /^\/api\/notifications\/read-all$/, () => ok({ ok: true })],
    ["GET", /^\/api\/lender-referrals$/, () => ok({ referrals: [] })],
    ["POST", /^\/api\/client\/issues$/, () => ok({ ok: true })],
  ];

  async function answer(req: Req): Promise<Out> {
    for (const [method, re, fn] of routes) {
      if (method !== req.method) continue;
      const m = re.exec(req.path);
      if (m) {
        handled.push(`${req.method} ${req.path}`);
        return fn(req, m);
      }
    }
    unhandled.push(`${req.method} ${req.path}`);
    if (typeof console !== "undefined") console.debug("[live-demo] not in the demo:", req.method, req.path);
    return notFound();
  }

  /** True for the portal's API calls (the configured server, or a same-origin /api/...). */
  function isApiCall(url: URL): boolean {
    if (url.origin === opts.serverOrigin) return true;
    return typeof window !== "undefined" && url.origin === window.location.origin && url.pathname.startsWith("/api/");
  }

  async function shimFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    let url: URL;
    try {
      url = new URL(href, typeof window !== "undefined" ? window.location.href : "http://localhost/");
    } catch {
      return opts.realFetch(input as RequestInfo, init);
    }
    if (!isApiCall(url)) return opts.realFetch(input as RequestInfo, init);
    const method = String(init?.method ?? (typeof input === "object" && "method" in input ? (input as Request).method : "GET")).toUpperCase();
    let body: any = init?.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { /* keep the text */ }
    }
    if (opts.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs));
    const out = await answer({ method, path: url.pathname, query: url.searchParams, body, url: url.href });
    if (out.response) return out.response;
    if (out.bytes) return new Response(out.bytes.buffer as ArrayBuffer, { status: out.status ?? 200, headers: { "content-type": "application/pdf" } });
    return new Response(JSON.stringify(out.json ?? {}), { status: out.status ?? 200, headers: { "content-type": "application/json" } });
  }

  return { fetch: shimFetch, unhandled, handled, answer };
}

export type Shim = ReturnType<typeof createShim>;

/** The call summary as the tour shows it (kept here so the note text and the pop-up agree). */
export const CALL_NOTE_SUMMARY = CALL_SUMMARY;
