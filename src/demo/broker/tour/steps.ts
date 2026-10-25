// KS_PORTAL_v11_LIVE_DEMO - the broker tour: what each pop-up says, what it points at, and what Next does. The
// screens are the portal's own; Next presses their buttons (open the card, accept documents, submit the credit
// summary, tick lenders and Send), and every one of those also works with a real click.
import { APP_ID, BUSINESS, CALL_SUMMARY, DOCS, FINANCIALS, STATEMENTS, DOCTORED, dscr, matchLenders, money } from "../fixture";
import { getState } from "../state";
import { buttonsLabelled, elementWithText, press, reveal, sleep, waitFor } from "./dom";

export type TourCtx = {
  navigate: (to: string) => void;
  setStatus: (text: string | null) => void;
  /** Point the spotlight at something else for a moment (null: back to the step's target). */
  setFocus: (el: Element | null) => void;
};

export type ActionResult = "advance" | "stay";

export type TourStep = {
  key: string;
  /** The demo server's step name for click analytics. */
  track: "application" | "documents" | "financials" | "credit_summary" | "call" | "lenders" | "submit";
  route: string;
  title: string;
  body: string;
  /** What the spotlight shows; several elements are lit as one box (KS_PORTAL_v12_CARD_PLACEMENT). */
  target?: () => Element | Element[] | null;
  placement?: "auto" | "bottom-left";
  nextLabel?: string;
  action?: (ctx: TourCtx) => Promise<ActionResult>;
};

/** The prospect picks 1 to MAX_PICK lenders themselves on the Lenders tab before Submit. */
export const MAX_PICK = 3;

export const appTab = (tab: string) => `/applications/${APP_ID}/${tab}`;

const growthPct = () => {
  const [cur, prev] = FINANCIALS.years;
  return Math.round(((cur.revenue - prev.revenue) / prev.revenue) * 100);
};

/** Average monthly deposits as the bank summary reads them (September as printed). */
export function averageDeposits(): number {
  const total = STATEMENTS.reduce((sum, st) => sum + st.tx.reduce((a, t) => {
    const v = st.month === DOCTORED.month && t.date === DOCTORED.date ? DOCTORED.shown : t.amount;
    return v > 0 ? a + v : a;
  }, 0), 0);
  return Math.round(total / STATEMENTS.length);
}

export const strongLenders = () => matchLenders().filter((m) => m.fit === "strong").map((m) => m.lender);

/** The pipeline card of the sample file (its draggable wrapper). */
export function sampleCard(): HTMLElement | null {
  const name = elementWithText(BUSINESS.legal_name, document, "div");
  return (name?.closest("[draggable]") as HTMLElement | null) ?? null;
}

function documentsRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="documents-drop-target"]');
}

/** The Accept buttons of documents still waiting for a decision (not the one inside the naming dialog). */
function pendingAcceptButtons(): HTMLButtonElement[] {
  const root = documentsRoot();
  if (!root) return [];
  return buttonsLabelled("Accept", root).filter((b) => !b.disabled && !b.closest('[data-testid="accept-name-dialog"]'));
}

/**
 * KS_PORTAL_v12_DEMO_FIXES - how long the auto-played steps pause so a person can follow them. Tests set `scale` to 0.
 */
export const tourPace = { scale: 1 };
const pause = (ms: number) => sleep(Math.round(ms * tourPace.scale));

/**
 * KS_PORTAL_v12_DEMO_FIXES - Next on the documents step plays the acceptance one document at a time, at reading pace:
 * the row scrolls into view and is spotlit, the naming dialog shows the tidy name it will get (held ~1.5 s), and the
 * accepted row with its new name stays lit a moment before the next one. The card counts "2 of 6" as it goes and
 * Next stays disabled until the last one is done.
 */
async function acceptEveryDocument(ctx: TourCtx): Promise<ActionResult> {
  const pendingLeft = () => DOCS.filter((d) => getState().docs[d.id]?.status === "pending").length;
  const total = DOCS.length;
  for (let i = 0; i < total + 2 && pendingLeft() > 0; i++) {
    const n = total - pendingLeft() + 1;
    // The list reloads after every decision; wait for it to come back with a pending row.
    const btn = await waitFor(() => pendingAcceptButtons()[0], 10_000);
    const row = btn.closest("div[style]")?.parentElement ?? btn;
    const name = (row.querySelector("span")?.textContent ?? "document").trim();
    reveal(row, "center");
    ctx.setFocus(row);
    ctx.setStatus(`Accepting ${n} of ${total}: ${name}`);
    await pause(900);
    press(btn);
    const dialog = await waitFor(() => document.querySelector<HTMLElement>('[data-testid="accept-name-dialog"]'));
    const preview = await waitFor(() => dialog.querySelector<HTMLElement>('[data-testid="accept-name-preview"]') ?? (dialog.textContent?.includes("Preparing") ? null : dialog), 6000).catch(() => dialog);
    const newName = preview && preview !== dialog ? (preview.textContent ?? "").trim() : "";
    ctx.setFocus(dialog);
    ctx.setStatus(newName ? `Renamed to: ${newName}` : `Accepting ${n} of ${total}…`);
    await pause(1600);
    const confirm = await waitFor(() => buttonsLabelled("Accept", dialog).find((b) => !b.disabled));
    press(confirm);
    await waitFor(() => !document.querySelector('[data-testid="accept-name-dialog"]'), 10_000);
    // The accepted row, with its new name and badge.
    const accepted = newName ? await waitFor(() => elementWithText(newName, documentsRoot() ?? document, "span,div")?.closest("div[style]")?.parentElement ?? null, 4000).catch(() => null) : null;
    if (accepted) {
      reveal(accepted, "center");
      ctx.setFocus(accepted);
    }
    ctx.setStatus(`${n} of ${total} accepted${newName ? ` - ${newName}` : ""}`);
    await pause(900);
  }
  await waitFor(() => documentsRoot() && pendingAcceptButtons().length === 0, 10_000);
  ctx.setFocus(null);
  ctx.setStatus(`All ${total} documents accepted and named.`);
  await pause(1200);
  ctx.setStatus(null);
  return "advance";
}

async function submitCreditSummary(ctx: TourCtx): Promise<ActionResult> {
  const submitted = () => document.querySelector('[data-testid="cs2-status"]')?.textContent?.includes("Submitted by");
  if (!submitted()) {
    const btn = await waitFor(() => document.querySelector<HTMLButtonElement>('[data-testid="cs2-submit"]'));
    ctx.setStatus("Submitting the credit summary…");
    press(btn); // window.confirm is answered "yes" in the demo
    await waitFor(() => submitted(), 8000);
  }
  ctx.setStatus("Submitted - signed with your name.");
  await pause(1800);
  ctx.setStatus(null);
  return "advance";
}

export const STEPS: TourStep[] = [
  {
    key: "pipeline",
    track: "application",
    route: "/pipeline",
    title: "A new application just arrived",
    body: "Sam applied from his phone a minute ago. The file lands in Received with every document attached - nobody re-typed anything. Next opens it.",
    target: sampleCard,
    nextLabel: "Open the file",
    action: async () => {
      const card = await waitFor(() => sampleCard());
      press(elementWithText(BUSINESS.legal_name, card, "div") ?? card);
      await pause(250);
      return "advance";
    },
  },
  {
    key: "documents",
    track: "documents",
    route: appTab("documents"),
    title: "Everything Sam sent is here",
    body: "Everything Sam sent from the phone is here, sorted by type. Next accepts them one at a time - watch each one get a tidy name. It takes about 20 seconds.",
    target: () => documentsRoot()?.querySelector("header") ?? null,
    nextLabel: "Accept the documents",
    action: acceptEveryDocument,
  },
  {
    key: "documents_flag",
    track: "documents",
    route: appTab("documents"),
    title: "One statement needs a closer look",
    body: "The September statement is flagged red: it was edited after the bank created it, and its balances don't add up. We'll look at that in the fraud report.",
    target: () => {
      const badge = document.querySelector('[data-testid="tamper-badge"]');
      return badge?.parentElement?.parentElement?.parentElement ?? badge;
    },
  },
  {
    key: "financials",
    track: "financials",
    route: appTab("financials"),
    title: "The financials, read for you",
    body: `The accountant's statements were read automatically: revenue ${money(FINANCIALS.years[0].revenue)} (up ${growthPct()}%), EBITDA ${money(FINANCIALS.years[0].ebitda)}, net income ${money(FINANCIALS.years[0].net_income)} - with last year beside them.`,
    target: () => document.querySelector("main table"),
  },
  {
    key: "banking",
    track: "financials",
    route: appTab("banking-analysis"),
    title: "The bank summary",
    body: `Three months of statements in one view: deposits of about ${money(averageDeposits())} a month, no NSFs and no days below zero. The chart shows the cash flow month by month.`,
    target: () => elementWithText("3-Month Trend")?.parentElement ?? null,
  },
  {
    key: "credit",
    track: "credit_summary",
    route: appTab("credit-summary"),
    title: "A credit summary, drafted",
    body: `Built from the file: the financials, the bank deposits, the fraud findings and a debt service coverage of ${dscr().toFixed(2)}x. Next submits it, signed with your name.`,
    target: () => document.querySelector('[data-testid="cs2-submit"]') ?? document.querySelector('[data-testid="cs2-status"]'),
    nextLabel: "Submit it",
    action: submitCreditSummary,
  },
  {
    key: "fraud",
    track: "documents",
    route: appTab("fraud"),
    title: "The fraud report",
    body: "Every check in one place. The September statement is red: its arithmetic doesn't reconcile, and the PDF was edited after it was created. Everything else is green.",
    target: () => document.querySelector('[data-testid="fraud-score"]'),
  },
  {
    key: "call",
    track: "call",
    route: appTab("fraud"),
    title: "Client intake call: Sam is calling",
    body: "Your iPhone, your watch and the portal ring together - with the file in front of you: who it is, the deal, 6 of 6 documents and the fraud flag.",
    placement: "bottom-left",
    nextLabel: "Answer",
  },
  {
    key: "lenders",
    track: "lenders",
    route: appTab("lenders"),
    title: "Pick your lenders",
    body: `Every lender is scored against this file - ${strongLenders().map((l) => l.name).join(", ").replace(/, ([^,]*)$/, " and $1")} are strong fits. Tick 1 to ${MAX_PICK} lenders in the list, then Submit.`,
    // KS_PORTAL_v12_CARD_PLACEMENT - the header and the top three matches (the strong fits), not the whole table, so
    // the card has room beside it on an iPad too.
    target: () => {
      const table = document.querySelector('[data-testid="lenders-tab"] table');
      if (!table) return null;
      const rows = Array.from(table.querySelectorAll("tbody tr")).slice(0, 3);
      const head = table.querySelector("thead");
      return rows.length ? [...(head ? [head] : []), ...rows] : table;
    },
    nextLabel: "Submit",
  },
  {
    key: "done",
    track: "submit",
    route: appTab("lenders"),
    title: "That's how to efficiently supply all requirements to your lenders and get your clients funded",
    body: "",
    target: () => document.querySelector('[data-testid="lenders-send-footer"]'),
  },
];

export const CALL_TEXT = {
  connected: { title: "Live call", body: "The call is transcribed as you talk, on the phone and in the portal's dialer. Next skips ahead.", next: "Skip ahead" },
  ended: { title: "AI call note added to the file", body: CALL_SUMMARY.headline, follow: `${CALL_SUMMARY.follow_up} It's on the file's Notes tab, ready for whoever picks it up.`, next: "Next" },
  declined: { title: "Call declined", body: "No problem - Sam can leave a voicemail and the file keeps moving. Next goes to the lenders.", next: "Next" },
};

/** How many lenders are ticked on the Lenders tab right now. */
export function pickedLenders(): number {
  const tab = document.querySelector<HTMLElement>('[data-testid="lenders-tab"]');
  return tab ? tab.querySelectorAll<HTMLInputElement>('input[aria-label^="Send to "]:checked').length : 0;
}

/** Press the real Send button for the lenders the prospect ticked. Resolves when the Lenders tab shows the outcome. */
export async function tickAndSend(ctx: TourCtx, timeoutMs = 120_000): Promise<{ ok: boolean; message: string }> {
  await waitFor(() => document.querySelector<HTMLElement>('[data-testid="lenders-tab"]'));
  const footer = await waitFor(() => document.querySelector<HTMLElement>('[data-testid="lenders-send-footer"]'));
  const send = await waitFor(() => Array.from(footer.querySelectorAll("button")).find((b) => /^Send \(\d+\)$/.test((b.textContent ?? "").trim()) && !b.disabled));
  ctx.setStatus("Sending the package…");
  press(send);
  const feedback = () => (document.querySelector('[data-testid="lenders-send-feedback"]')?.textContent ?? "").trim();
  const sending = () => Array.from(footer.querySelectorAll("button")).some((b) => (b.textContent ?? "").includes("Sending"));
  await waitFor(() => !sending() && feedback(), timeoutMs, 200);
  const msg = feedback();
  ctx.setStatus(null);
  return { ok: /^Sent to /.test(msg), message: msg };
}

export { buttonsLabelled };
