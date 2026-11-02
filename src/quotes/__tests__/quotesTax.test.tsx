// KS_BROKER_TOOLS_3_SALES_TAX - the quote editor's sales tax: the province and the fees ticked taxable.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { planBody } from "@/plans/__tests__/fixtures";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put } }));
vi.mock("@/utils/api", () => ({ apiBlob: vi.fn(async () => new Blob(["%PDF-"])) }));

import QuotesTab from "@/quotes/QuotesTab";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";

beforeEach(() => { h.get.mockReset(); h.post.mockReset(); h.put.mockReset(); __setPlanForTests(null); });

describe("quote editor sales tax", () => {
  it("sends the province and the fees ticked taxable, and shows the tax", async () => {
    __setPlanForTests(normalizePlan(planBody({ plan: "growth", effective_plan: "growth", features: { quotes: true }, catalogue: [{ key: "quotes", label: "Quotes", plan: "growth" }] })));
    const option = { id: "op1", offer_id: null, lender_name: "Northern Capital", product_name: null, amount: 10000, term_months: 12, rate_kind: "interest_rate" as const, rate: 10, payment_frequency: "monthly" as const, payment_count: 12, payment_amount: 879.16, payment_overridden: false, fees: [], total_fees: 0, total_repayment: 10549.92, cost_of_borrowing: 549.92, net_proceeds: 10000, estimated_apr: 10, recommended: false, notes: null };
    const quote = { id: "q1", application_id: "app-1", quote_number: "Q-1", status: "draft" as const, title: "Your financing options", message: null, currency: "CAD" as const, expires_on: null, pdf_document_id: null, accepted_option_id: null, accepted_name: null, decline_reason: null, view_count: 0, created_at: "2026-11-01T10:00:00Z", sent_at: null, first_viewed_at: null, last_viewed_at: null, accepted_at: null, declined_at: null, withdrawn_at: null, options: [option], tax_province: "ON" };
    h.get.mockResolvedValue({ ok: true, quotes: [], offers: [] });
    h.post.mockResolvedValue({ ok: true, quote });
    h.put.mockResolvedValue({ ok: true, quote: { ...quote, options: [{ ...option, fees: [{ label: "Doc fee", amount: 300, deducted: false, taxable: true }], tax_lines: [{ label: "HST 13%", amount: 39 }], total_tax: 39 }] } });
    renderWithRole(<QuotesTab applicationId="app-1" />, "Staff");
    fireEvent.click(await screen.findByRole("button", { name: "Start a blank quote" }));
    expect(((await screen.findByLabelText("Sales tax province")) as HTMLSelectElement).value).toBe("ON");
    fireEvent.change(screen.getByLabelText("Sales tax province"), { target: { value: "QC" } });
    fireEvent.click(screen.getByRole("button", { name: "Add a fee" }));
    fireEvent.change(screen.getByLabelText("Fee name"), { target: { value: "Doc fee" } });
    fireEvent.change(screen.getByLabelText("Fee amount"), { target: { value: "300" } });
    fireEvent.click(screen.getByLabelText("Sales tax applies"));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(h.put).toHaveBeenCalled());
    const body = h.put.mock.calls[0]![1];
    expect(body.tax_province).toBe("QC");
    expect(body.options[0].fees[0]).toEqual({ label: "Doc fee", amount: 300, deducted: true, taxable: true });
    expect((await screen.findByTestId("quote-option-0-math")).textContent).toMatch(/tax on fees HST 13% \$39\.00/);
  });
});
