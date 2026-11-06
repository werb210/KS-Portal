// KS_HUBSPOT_GAPS_1_PAYMENTS - payment links on applications and contacts, and Settings > Payments.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put } }));

import PaymentLinksPanel from "../PaymentLinksPanel";
import PaymentsSettings from "../PaymentsSettings";
import { STATUS } from "../paymentsApi";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";
import { planBody } from "@/plans/__tests__/fixtures";
import { contrast } from "@/crmFields/__tests__/contrast";

const link = (over: Record<string, unknown> = {}) => ({
  id: "l1", url: "https://server.example/api/payments/pay/tok", application_id: "app-1", contact_id: "c1", description: "Broker fee", amount: 2500,
  currency: "cad", methods: ["card", "acss_debit"], status: "open", payment_method_type: null, amount_received: null, paid_at: null,
  failure_message: null, sent_channels: ["email"], sent_at: "2026-10-26T15:00:00Z", expires_at: "2026-11-25T15:00:00Z", created_at: "2026-10-26T15:00:00Z",
  quickbooks_status: "none", quickbooks_error: null, ...over,
});

beforeEach(() => {
  h.get.mockReset(); h.post.mockReset(); h.put.mockReset();
  __setPlanForTests(null);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("Payments on an application", () => {
  it("is hidden on Starter", () => {
    __setPlanForTests(normalizePlan(planBody({ features: { payment_links: false } })));
    const { container } = render(<PaymentLinksPanel applicationId="app-1" />);
    expect(container).toBeEmptyDOMElement();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("lists links with a readable status and QuickBooks state", async () => {
    h.get.mockResolvedValue({ connected: true, problem: null, links: [link(), link({ id: "l2", status: "paid", paid_at: "2026-10-27T10:00:00Z", payment_method_type: "acss_debit", quickbooks_status: "recorded" })] });
    render(<PaymentLinksPanel applicationId="app-1" />);
    const paid = await screen.findByTestId("payment-l2");
    expect(within(paid).getByText("Paid")).toBeInTheDocument();
    expect(within(paid).getByText(/by bank debit/)).toBeInTheDocument();
    expect(within(paid).getByText("Recorded in QuickBooks against the fee invoice")).toBeInTheDocument();
    expect(within(screen.getByTestId("payment-l1")).getByText("Waiting for payment")).toBeInTheDocument();
    expect(h.get).toHaveBeenCalledWith("/api/payments/links", { params: { application_id: "app-1" } });
  });

  it("fills the fee agreement amount and sends the link", async () => {
    h.get.mockImplementation(async (url: string) => url.includes("fee-suggestion")
      ? { fee: { amount: 2000, description: "Broker fee (2% of funding)" } }
      : { connected: true, problem: null, links: [] });
    h.post.mockResolvedValue({ link: link(), sent: ["email"], refused: { sms: "The contact has not agreed to texts." } });
    render(<PaymentLinksPanel applicationId="app-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Request a fee payment" }));
    // BF_PORTAL_v906_PAYMENT_BASIS - the request starts from the signed fee agreement (or an invoice).
    fireEvent.click(await screen.findByLabelText(/The fee in the signed fee agreement/));
    await waitFor(() => expect(screen.getByLabelText("Amount (CAD)")).toHaveValue("2000"));
    expect(screen.getByLabelText("What it is for (shown to the client)")).toHaveValue("Broker fee (2% of funding)");
    fireEvent.click(screen.getByLabelText(/Send by text/));
    fireEvent.click(screen.getByRole("button", { name: "Create and send" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/payments/links", {
      application_id: "app-1", amount: "2000", description: "Broker fee (2% of funding)", methods: ["card", "acss_debit"], send: { email: true, sms: true },
    }));
    expect(await screen.findByText("Payment link sent by email.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("not agreed to texts");
  });

  it("asks an Admin to connect Stripe first", async () => {
    h.get.mockResolvedValue({ connected: false, problem: null, links: [] });
    render(<PaymentLinksPanel contactId="c1" />);
    expect(await screen.findByText(/connect your Stripe account in Settings > Payments/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request a fee payment" })).toBeNull();
  });

  it("every status pill is readable (4.5:1 or better)", () => {
    for (const s of Object.values(STATUS)) expect(contrast(s.fg, s.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Settings > Payments", () => {
  it("connects Stripe and shows what the account can take", async () => {
    h.get.mockImplementation(async (url: string) => url.includes("/report")
      ? { days: 90, sent: 2, paid: { count: 1, amount: 2500 }, processing: { count: 0, amount: 0 }, outstanding: { count: 1, amount: 500 }, failed: 0, by_month: [] }
      : { problem: null, connection: { status: "connected", account_id: "acct_1", business_name: "Acme Capital", livemode: true, charges_enabled: true, acss_debit_enabled: false } });
    render(<MemoryRouter initialEntries={["/settings/payments?stripe=connected"]}><PaymentsSettings /></MemoryRouter>);
    expect(await screen.findByText("Your Stripe account is connected. You can now send payment links.")).toBeInTheDocument();
    expect(await screen.findByTestId("stripe-account")).toHaveTextContent("Acme Capital (acct_1)");
    expect(screen.getByText(/turn on "Pre-authorized debit in Canada" in Stripe/)).toBeInTheDocument();
    expect(await screen.findByTestId("report-paid")).toHaveTextContent("$2,500.00");
  });

  it("starts the Stripe connect screen", async () => {
    h.get.mockResolvedValue({ problem: null, connection: { status: "disconnected" } });
    h.post.mockResolvedValue({ url: "https://connect.stripe.com/oauth/authorize?x=1" });
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
    render(<MemoryRouter><PaymentsSettings /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Connect Stripe" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://connect.stripe.com/oauth/authorize?x=1"));
  });
});
