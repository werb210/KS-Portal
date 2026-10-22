// KS_PORTAL_v8_DEMO - the guided walkthrough: what each step says, which part of the portal it shows, and when it is
// done. A step can always be skipped; "Next" is offered once the step's action has been done.
import type { DemoState } from "./demoApi";

export type StepKey = "welcome" | "borrower" | "application" | "documents" | "call" | "financials" | "credit_summary" | "lenders" | "submit";
export type Tab = "pipeline" | "overview" | "documents" | "financials" | "credit" | "lenders";

export type StepDef = { key: StepKey; title: string; tab: Tab; body: (s: DemoState) => string; todo: string };

const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const money = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

export const STEPS: StepDef[] = [
  {
    key: "welcome", tab: "pipeline", title: "Welcome",
    body: (s) => `Hi ${first(s.session.name)} - this is your private Keystone portal for ${s.session.company}. In about ten minutes you'll take one file from the borrower's phone all the way to lenders. Everything here is sample data.`,
    todo: "",
  },
  {
    key: "borrower", tab: "pipeline", title: "You're the borrower now",
    body: () => "Scan the code with your phone. It opens the client app as the owner of Juniper Hollow Millwork. Tap to upload the sample documents and ask the assistant a question - then come back here.",
    todo: "Upload at least one document from the phone (or on this screen).",
  },
  {
    key: "application", tab: "pipeline", title: "The file arrives live",
    body: (s) => `There it is: ${s.application?.business?.legal_name ?? "the application"} landed in your pipeline the moment the first document arrived - no refresh, no email to forward. Every document is checked for fraud as it lands.`,
    todo: "",
  },
  {
    key: "documents", tab: "documents", title: "Review documents - one was doctored",
    body: () => "Accept or reject each document. One bank statement was edited after the bank issued it. The fraud check scanned every file and re-did every statement's math - find the one it flagged and read why.",
    todo: "Decide on every document.",
  },
  {
    key: "call", tab: "overview", title: "Your client is calling",
    body: () => "Your phone and watch ring with the caller's file - amount, documents, the fraud flag - before you answer. Answer to listen in; the AI writes the call note onto the file for you.",
    todo: "Answer the call and let it finish (or skip to the summary).",
  },
  {
    key: "financials", tab: "financials", title: "Review the financials",
    body: (s) => {
      const y = s.application?.financials?.years?.[0];
      return y ? `FY${y.year} revenue is ${money(y.revenue)} with EBITDA of ${money(y.ebitda)}. Spreads are read from the accountant's statements, side by side with last year.` : "Spreads are read from the accountant's statements, side by side with last year.";
    },
    todo: "Mark the financials as reviewed.",
  },
  {
    key: "credit_summary", tab: "credit", title: "Build the credit summary",
    body: () => "One click writes the credit summary from what you just did: ratios and debt service coverage, deposits from the statements you accepted, the fraud findings and the call note.",
    todo: "Build the credit summary.",
  },
  {
    key: "lenders", tab: "lenders", title: "Pick lenders",
    body: () => "Keystone scores every lender against the file and says why each fits or does not. Pick up to four. (These lenders are fictional.)",
    todo: "Pick at least one lender.",
  },
  {
    key: "submit", tab: "lenders", title: "Submit to lenders",
    body: (s) => `Submit and Keystone builds the lender package. We'll email the sample package to ${s.session.email} so you can see exactly what a lender receives.`,
    todo: "Submit the file.",
  },
];

export function stepIndex(key: string): number {
  const i = STEPS.findIndex((s) => s.key === key);
  return i < 0 ? 0 : i;
}

/** Whether the step's action has been done (so "Next" is offered instead of only "Skip"). */
export function stepDone(key: StepKey, s: DemoState): boolean {
  const app = s.application;
  switch (key) {
    case "welcome":
    case "application":
      return true;
    case "borrower":
      return s.documents.length > 0 || Boolean(app?.borrower_submitted_at);
    case "documents":
      return s.documents.length > 0 && s.documents.every((d) => d.status !== "pending");
    case "call":
      return app?.call?.status === "completed";
    case "financials":
      return Boolean(app?.financials_reviewed_at);
    case "credit_summary":
      return Boolean(app?.credit_summary);
    case "lenders":
      return (app?.selected_lenders ?? []).length > 0;
    case "submit":
      return Boolean(app?.submitted_at);
    default:
      return false;
  }
}

/** The tour is finished once the file has been submitted. */
export function tourFinished(s: DemoState): boolean {
  return Boolean(s.application?.submitted_at);
}
