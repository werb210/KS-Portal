// KS_PORTAL_v23_QUOTES - the Quotes tab: locked below Growth, start from offers, edit and send, follow-up states.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { planBody } from "@/plans/__tests__/fixtures";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put } }));
vi.mock("@/utils/api", () => ({ apiBlob: vi.fn(async () => new Blob(["%PDF-"])) }));

import QuotesTab from "@/quotes/QuotesTab";
import { QUOTE_STATUS, type Quote } from "@/quotes/quotesApi";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";
import { contrast } from "@/fraud/status";

const setPlan = (on: boolean) => __setPlanForTests(normalizePlan(planBody({ plan: on ? "growth" : "starter", effective_plan: on ? "growth" : "starter", features: { quotes: on }, catalogue: [{ key: "quotes", label: "Quotes", plan: "growth" }] })));
const option = { id: "op1", offer_id: "o1", lender_name: "Northern Capital", product_name: null, amount: 75000, term_months: 9, rate_kind: "factor_rate" as const, rate: 1.28, payment_frequency: "weekly" as const, payment_count: 39, payment_amount: 2461.54, payment_overridden: false, fees: [], total_fees: 0, total_repayment: 96000, cost_of_borrowing: 21000, net_proceeds: 75000, estimated_apr: 70.1, recommended: false, notes: null };
const quote = (over: Partial<Quote> = {}): Quote => ({ id: "q1", application_id: "app-1", quote_number: "Q-261101-AB12C", status: "draft", title: "Your financing options", message: null, currency: "CAD", expires_on: "2026-11-15", pdf_document_id: null, accepted_option_id: null, accepted_name: null, decline_reason: null, view_count: 0, created_at: "2026-11-01T10:00:00Z", sent_at: null, first_viewed_at: null, last_viewed_at: null, accepted_at: null, declined_at: null, withdrawn_at: null, options: [option], ...over });

beforeEach(() => { h.get.mockReset(); h.post.mockReset(); h.put.mockReset(); __setPlanForTests(null); });

describe("Quotes tab", () => {
  it("is locked below Growth", () => {
    setPlan(false);
    renderWithRole(<QuotesTab applicationId="app-1" />, "Staff");
    expect(screen.getByTestId("feature-locked-quotes")).toBeInTheDocument();
  });

  it("starts a quote from an offer, shows the worked-out cost, saves and sends", async () => {
    setPlan(true);
    h.get.mockResolvedValue({ ok: true, quotes: [], offers: [{ id: "o1", lender_name: "Northern Capital", amount: 75000, rate_factor: "1.28", term: "9 months", payment_frequency: "Weekly", expiry_date: null, recommended: false, status: "pending" }] });
    h.post.mockImplementation(async (url: string) => (url.endsWith("/send") ? { ok: true, quote: quote({ status: "sent", sent_at: "2026-11-01T11:00:00Z" }) } : { ok: true, quote: quote() }));
    h.put.mockResolvedValue({ ok: true, quote: quote() });
    renderWithRole(<QuotesTab applicationId="app-1" />, "Staff");
    fireEvent.click(await screen.findByRole("checkbox", { name: /Northern Capital/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start a quote from 1 offer(s)" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/quotes/applications/app-1", { offer_ids: ["o1"] }));
    expect((await screen.findByTestId("quote-option-0-math")).textContent).toMatch(/cost of borrowing \$21,000\.00/);
    fireEvent.click(screen.getByRole("button", { name: "Add a fee" }));
    fireEvent.change(screen.getByLabelText("Fee name"), { target: { value: "Origination" } });
    fireEvent.change(screen.getByLabelText("Fee amount"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Send to client" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/quotes/q1/send", {}));
    const saved = h.put.mock.calls[0]![1];
    expect(saved.options[0].fees).toEqual([{ label: "Origination", amount: 1500, deducted: true }]);
  });

  it("shows views and an accepted option", async () => {
    setPlan(true);
    h.get.mockResolvedValue({ ok: true, offers: [], quotes: [quote({ status: "accepted", sent_at: "2026-11-01T11:00:00Z", view_count: 3, last_viewed_at: "2026-11-02T09:00:00Z", accepted_option_id: "op1", accepted_name: "Jane Doe", accepted_at: "2026-11-02T09:05:00Z" })] });
    renderWithRole(<QuotesTab applicationId="app-1" />, "Staff");
    expect(await screen.findByTestId("quote-chip-accepted")).toHaveTextContent("Accepted");
    expect(screen.getByText(/viewed 3 time\(s\)/)).toBeInTheDocument();
    expect(screen.getByText(/by Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Confirm the acceptance on the Lenders tab/)).toBeInTheDocument();
  });

  it("status chips are readable", () => {
    for (const s of Object.values(QUOTE_STATUS)) expect(contrast(s.fg, s.bg)).toBeGreaterThanOrEqual(4.5);
  });
});
