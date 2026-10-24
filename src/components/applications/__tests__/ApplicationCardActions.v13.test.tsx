// KS_PORTAL_v13 - the application card's Calculator button and QuickBooks invoice status, and the Settings card.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put } }));

import ApplicationCardActions, { requestedAmountOf } from "../ApplicationCardActions";
import QuickBooksCard, { callbackMessage } from "@/pages/settings/tabs/QuickBooksCard";
import { invoiceLine } from "@/api/quickbooks";

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  h.put.mockReset();
});

const APP = { overview: { requestedAmount: 250000 }, businessDetails: { legalName: "Acme Films Ltd" } };

describe("Calculator on the application card", () => {
  it("opens with the requested amount and saves the result as a note", async () => {
    h.get.mockResolvedValue({ configured: false, connected: false, invoice: null });
    h.post.mockResolvedValue({ ok: true, data: { id: "n1" } });
    render(<ApplicationCardActions applicationId="app-1" application={APP} />);
    fireEvent.click(screen.getByTestId("open-loan-calculator"));
    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("250000");
    expect(screen.getByTestId("loan-calculator-summary").textContent).toContain("Number of payments60");
    expect(screen.getByTestId("loan-calculator-schedule").querySelectorAll("tbody tr")).toHaveLength(60);
    expect(screen.getByText("Download PDF")).toBeTruthy();
    expect(screen.getByText("Download spreadsheet")).toBeTruthy();
    fireEvent.click(screen.getByText("Save to file"));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/applications/app-1/notes", { body: expect.stringContaining("Loan calculator") }));
    expect(h.post.mock.calls[0]![1].body).toContain("Amount: $250,000.00");
    await screen.findByText("Saved to the file's notes.");
  });

  it("shows input problems instead of a schedule", () => {
    h.get.mockResolvedValue({ configured: false, connected: false, invoice: null });
    render(<ApplicationCardActions applicationId="app-1" application={APP} />);
    fireEvent.click(screen.getByTestId("open-loan-calculator"));
    fireEvent.change(screen.getByLabelText("Balloon"), { target: { value: "300000" } });
    expect(screen.getByRole("alert").textContent).toContain("The balloon must be less than the amount financed.");
    expect(screen.queryByTestId("loan-calculator-schedule")).toBeNull();
  });

  it("reads the requested amount from the shapes the details endpoint uses", () => {
    expect(requestedAmountOf({ fundingRequest: { amount: "$75,000" } })).toBe(75000);
    expect(requestedAmountOf({})).toBeNull();
  });
});

describe("QuickBooks invoice on the application card", () => {
  it("shows nothing when QuickBooks is off or there is no invoice", async () => {
    h.get.mockResolvedValue({ configured: false, connected: false, invoice: null });
    render(<ApplicationCardActions applicationId="app-1" application={APP} />);
    await waitFor(() => expect(h.get).toHaveBeenCalledWith("/api/quickbooks/applications/app-1/invoice"));
    expect(screen.queryByTestId("quickbooks-invoice")).toBeNull();
  });

  it("shows number, amount and status, and Retry after a failed sync", async () => {
    h.get.mockResolvedValue({ configured: true, connected: true, invoice: { invoiceId: "INV1", docNumber: "1001", amount: 5000, status: "open", syncStatus: "failed", lastError: "quickbooks_api_500 - Boom", syncedAt: null, canRetry: true } });
    h.post.mockResolvedValue({ ok: true, result: "done", configured: true, connected: true, invoice: { invoiceId: "INV1", docNumber: "1001", amount: 4000, status: "paid", syncStatus: "ok", lastError: null, syncedAt: "2026-10-23T00:00:00Z", canRetry: false } });
    render(<ApplicationCardActions applicationId="app-1" application={APP} />);
    const chip = await screen.findByTestId("quickbooks-invoice");
    expect(chip.textContent).toContain("Invoice 1001 - $5,000.00 - Open (Last sync failed)");
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/quickbooks/applications/app-1/invoice/retry", {}));
    await waitFor(() => expect(screen.getByTestId("quickbooks-invoice").textContent).toContain("Invoice 1001 - $4,000.00 - Paid"));
    expect(screen.queryByText("Retry")).toBeNull();
  });

  it("invoiceLine says when it is still being sent", () => {
    expect(invoiceLine({ invoiceId: null, docNumber: null, amount: null, status: "none", syncStatus: "queued", lastError: null, syncedAt: null, canRetry: false })).toBe("Invoice - Not created yet (Sending to QuickBooks)");
  });
});

describe("QuickBooks Settings card", () => {
  const base = { environment: "sandbox", status: null, companyName: null, realmId: null, connectedAt: null, lastError: null, taxCodeId: null, taxCodeName: null };

  it("is greyed out with the reason when the server is not set up", async () => {
    h.get.mockResolvedValue({ ...base, configured: false, connected: false, reason: "QuickBooks is not set up on this server yet (QBO_CLIENT_ID)." });
    render(<QuickBooksCard />);
    expect((await screen.findByTestId("quickbooks-off-reason")).textContent).toContain("QBO_CLIENT_ID");
    expect((screen.getByText("Connect QuickBooks") as HTMLButtonElement).disabled).toBe(true);
  });

  it("connects by sending the admin to Intuit", async () => {
    h.get.mockResolvedValue({ ...base, configured: true, connected: false, reason: null });
    h.post.mockResolvedValue({ url: "https://appcenter.intuit.com/connect/oauth2?state=x" });
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign, search: "" } });
    render(<QuickBooksCard />);
    fireEvent.click(await screen.findByText("Connect QuickBooks"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://appcenter.intuit.com/connect/oauth2?state=x"));
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("shows the company, saves a tax code and disconnects", async () => {
    h.get.mockImplementation(async (path: string) => path === "/api/quickbooks/tax-codes"
      ? { taxCodes: [{ id: "4", name: "Exempt", description: null }] }
      : { ...base, configured: true, connected: true, reason: null, status: "connected", companyName: "Northwind Capital", realmId: "9" });
    h.put.mockResolvedValue({ ...base, configured: true, connected: true, reason: null, status: "connected", companyName: "Northwind Capital", realmId: "9", taxCodeId: "4", taxCodeName: "Exempt" });
    h.post.mockResolvedValue({ ok: true, revoked: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<QuickBooksCard />);
    expect((await screen.findByTestId("quickbooks-card")).textContent).toContain("Connected to Northwind Capital (sandbox)");
    await screen.findByRole("option", { name: "Exempt" });
    fireEvent.change(screen.getByLabelText("Tax code on fee lines"), { target: { value: "4" } });
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/quickbooks/settings", { taxCodeId: "4", taxCodeName: "Exempt" }));
    fireEvent.click(screen.getByText("Disconnect"));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/quickbooks/disconnect", {}));
    await screen.findByText("QuickBooks is disconnected.");
  });

  it("reads the outcome the callback sends back", () => {
    expect(callbackMessage("?quickbooks=connected")).toEqual({ ok: true, text: "QuickBooks is connected." });
    expect(callbackMessage("?quickbooks=error&reason=state")?.text).toMatch(/expired/);
    expect(callbackMessage("")).toBeNull();
  });
});
