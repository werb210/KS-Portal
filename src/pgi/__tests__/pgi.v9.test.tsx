// KS_PORTAL_v9_PGI - the PGI insurance tab, the PGI referrals page and the colours.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => {
  const fn: any = vi.fn();
  fn.get = vi.fn(); fn.post = vi.fn(); fn.patch = vi.fn();
  return { api: fn };
});
vi.mock("@/api", () => ({ api: h.api }));

import PgiTab from "@/pgi/PgiTab";
import PgiReferralsPage from "@/pgi/PgiReferralsPage";
import { SLOT_STATE_STYLE, STATUS_STYLE, contrast, type PgiView } from "@/pgi/pgiApi";
import { FEATURES } from "@/plans/catalogue";

function view(over: Partial<PgiView> = {}): PgiView {
  return {
    referral: {
      application_id: "app-1", status: "awaiting_client", partner_status: "created", application_code: "BI-ABC123",
      completion_url: "https://partner.example/form", missing_count: 2, unread_count: 1, last_error: null, last_synced_at: null,
      created_at: "2026-10-22T00:00:00Z", referral_fee: null,
    },
    input: {},
    checklist: [
      { slot: "loan_agreement", label: "Signed term sheet / lender commitment", state: "sent" },
      { slot: "profit_loss", label: "Profit & loss statement (last 12 months, monthly)", state: "missing" },
      { slot: "ap_aging", label: "Accounts payable aging", state: "rejected", detail: "Older than 90 days" },
    ],
    startup: false,
    missing_fields: [
      { key: "naics_code", label: "NAICS code (6 digits)", completed_by: "broker" },
      { key: "q_ca_id_number", label: "Director ID number", completed_by: "client" },
    ],
    messages: [
      { id: "m1", direction: "from_partner", kind: "doc_request", body: "Please send the P&L", author_name: "Andrew, Boreal Insurance", status: null, created_at: "2026-10-22T10:00:00Z", sent_at: null, send_error: null, read_at: null },
    ],
    partner_name: "Boreal Insurance",
    ...over,
  };
}

beforeEach(() => {
  h.api.mockReset(); h.api.get.mockReset(); h.api.post.mockReset(); h.api.patch.mockReset();
});

describe("PGI insurance tab", () => {
  it("shows status, the insurer's checklist, details needed and the thread; marks messages read", async () => {
    h.api.get.mockResolvedValue(view());
    h.api.post.mockResolvedValue({ ok: true });
    renderWithRole(<PgiTab applicationId="app-1" />, "Staff");
    expect(await screen.findByTestId("pgi-status-chip")).toHaveTextContent("Waiting for client");
    expect(screen.getByText("Ref BI-ABC123")).toBeTruthy();
    expect(screen.getByTestId("pgi-slot-state-loan_agreement")).toHaveTextContent("Sent");
    expect(screen.getByTestId("pgi-slot-state-profit_loss")).toHaveTextContent("Missing");
    expect(screen.getByText("Reason: Older than 90 days")).toBeTruthy();
    expect(screen.queryByTestId("pgi-upload-loan_agreement")).toBeNull();
    expect(screen.getByTestId("pgi-upload-profit_loss")).toBeTruthy();
    expect(screen.getByTestId("pgi-field-naics_code")).toBeTruthy();
    expect(screen.getByText(/Director ID number/)).toBeTruthy();
    expect(screen.getByTestId("pgi-message-m1")).toHaveTextContent("Please send the P&L");
    expect(screen.getByTestId("pgi-message-m1")).toHaveTextContent("Document request");
    await waitFor(() => expect(h.api.post).toHaveBeenCalledWith("/api/pgi/referrals/app-1/read", {}));
  });

  it("uploads for a slot: files the document, accepts it (which forwards it), refreshes", async () => {
    h.api.get.mockResolvedValue(view());
    h.api.mockResolvedValue({ id: "doc-9" });
    h.api.post.mockImplementation(async (url: string) => (url.endsWith("/sync") ? view({ checklist: [{ slot: "profit_loss", label: "P&L", state: "sent" }] }) : { ok: true }));
    renderWithRole(<PgiTab applicationId="app-1" />, "Staff");
    const input = await screen.findByTestId("pgi-upload-profit_loss");
    fireEvent.change(input, { target: { files: [new File(["%PDF"], "pl.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(h.api.post).toHaveBeenCalledWith("/api/pgi/referrals/app-1/sync", {}));
    const [url, opts] = h.api.mock.calls[0]!;
    expect(url).toBe("/api/documents/upload");
    expect((opts.body as FormData).get("category")).toBe("PnL - Interim financials");
    expect((opts.body as FormData).get("applicationId")).toBe("app-1");
    expect(h.api.post).toHaveBeenCalledWith("/api/portal/documents/doc-9/accept", {});
    expect(await screen.findByText("Uploaded and sent to the insurance partner.")).toBeTruthy();
  });

  it("saves missing details and replies to the partner", async () => {
    h.api.get.mockResolvedValue(view());
    h.api.patch.mockResolvedValue(view({ missing_fields: [] }));
    h.api.post.mockResolvedValue({ ok: true, sent: true, error: null });
    renderWithRole(<PgiTab applicationId="app-1" />, "Staff");
    fireEvent.change(await screen.findByTestId("pgi-field-naics_code"), { target: { value: "236220" } });
    fireEvent.click(screen.getByTestId("pgi-fields-save"));
    await waitFor(() => expect(h.api.patch).toHaveBeenCalledWith("/api/pgi/referrals/app-1", { naics_code: "236220" }));
    fireEvent.change(screen.getByTestId("pgi-reply"), { target: { value: "Sending it today" } });
    fireEvent.click(screen.getByTestId("pgi-send"));
    await waitFor(() => expect(h.api.post).toHaveBeenCalledWith("/api/pgi/referrals/app-1/messages", { body: "Sending it today" }));
    expect(await screen.findByText("Message sent.")).toBeTruthy();
  });

  it("a bound policy shows the referral fee; a missing link says why", async () => {
    h.api.get.mockResolvedValue(view({ referral: { ...view().referral, status: "policy_issued", unread_count: 0, referral_fee: { amount: 108, currency: "CAD", status: "accrued" }, last_error: "insurance_partner_not_linked" } }));
    renderWithRole(<PgiTab applicationId="app-1" />, "Staff");
    expect(await screen.findByTestId("pgi-fee")).toHaveTextContent("$108.00");
    expect(screen.getByTestId("pgi-status-chip")).toHaveTextContent("Policy bound");
    expect(screen.getByTestId("pgi-error")).toHaveTextContent("not linked to the insurance partner yet");
  });

  it("not referred: offers to refer the file", async () => {
    h.api.get.mockRejectedValue(Object.assign(new Error("no_referral"), { status: 404 }));
    h.api.post.mockResolvedValue(view());
    renderWithRole(<PgiTab applicationId="app-1" />, "Staff");
    fireEvent.click(await screen.findByTestId("pgi-refer"));
    await waitFor(() => expect(h.api.post).toHaveBeenCalledWith("/api/pgi/referrals/app-1", {}));
    expect(await screen.findByTestId("pgi-tab")).toBeTruthy();
  });
});

describe("PGI referrals page", () => {
  it("lists referrals with status, missing documents, unread messages and fees", async () => {
    h.api.get.mockResolvedValue({ referrals: [
      { application_id: "a1", application_name: "Widget Co", referring_user_name: "Sam Broker", status: "information_required", bi_application_code: "BI-1", missing_count: 2, unread_count: 1, referral_fee_amount: null, referral_fee_currency: null, referral_fee_status: null, last_error: null, updated_at: "2026-10-22" },
      { application_id: "a2", application_name: "Gadget Ltd", referring_user_name: null, status: "policy_issued", bi_application_code: "BI-2", missing_count: 0, unread_count: 0, referral_fee_amount: 108, referral_fee_currency: "CAD", referral_fee_status: "accrued", last_error: null, updated_at: "2026-10-22" },
    ] });
    renderWithRole(<PgiReferralsPage />, "Staff");
    const row = await screen.findByTestId("pgi-row-a1");
    expect(row).toHaveTextContent("Widget Co");
    expect(row).toHaveTextContent("Insurer needs info");
    expect(row).toHaveTextContent("1 new");
    expect(screen.getByTestId("pgi-row-a2")).toHaveTextContent("$108.00");
    expect(screen.getByTestId("pgi-fee-total")).toHaveTextContent("$108.00");
    expect(screen.getByRole("link", { name: "Widget Co" }).getAttribute("href")).toBe("/applications/a1/pgi");
  });

  it("empty state", async () => {
    h.api.get.mockResolvedValue({ referrals: [] });
    renderWithRole(<PgiReferralsPage />, "Staff");
    expect(await screen.findByTestId("pgi-empty")).toBeTruthy();
  });
});

describe("readable and on every plan", () => {
  it("every chip is at least 4.5:1", () => {
    for (const s of [...Object.values(STATUS_STYLE), ...Object.values(SLOT_STATE_STYLE)]) {
      expect(contrast(s.fg, s.bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast("#ffffff", "#1d4ed8")).toBeGreaterThanOrEqual(4.5); // primary button
  });

  it("PGI referrals is a starter feature", () => {
    expect(FEATURES.find((f) => f.key === "pgi_referrals")?.plan).toBe("starter");
  });
});
