// KS_PORTAL_v22_KYC - the ID verification tab and Settings > ID verification.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { planBody } from "@/plans/__tests__/fixtures";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put } }));

import IdVerificationTab from "@/kyc/IdVerificationTab";
import IdVerificationSettings from "@/kyc/IdVerificationSettings";
import { STATUS_LOOK } from "@/kyc/kycApi";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";
import { FEATURES } from "@/plans/catalogue";
import { contrast } from "@/fraud/status";

const setPlan = (on: boolean) => __setPlanForTests(normalizePlan(planBody({
  plan: on ? "growth" : "starter", effective_plan: on ? "growth" : "starter",
  features: { id_verification: on }, catalogue: [{ key: "id_verification", label: "ID and selfie verification", plan: "growth" }],
})));

const verification = (over: Record<string, unknown> = {}) => ({
  id: "v1", application_id: "app-1", contact_id: "c1", person_name: "Jane Doe", person_role: "applicant", provider: "onfido",
  status: "review", decision_source: "vendor", reasons: [{ code: "identity_record_caution", severity: "amber", text: "The identity record (data source) check needs a look (result: caution)." }],
  checks: { document: "clear", identity_record: "caution" }, document_ids: ["d1", "d2"], has_id_details: true, requested_via: "staff",
  requested_at: "2026-11-01T10:00:00Z", started_at: null, completed_at: "2026-11-01T10:05:00Z", reviewed_at: null, review_note: null, ...over,
});

beforeEach(() => { h.get.mockReset(); h.post.mockReset(); h.put.mockReset(); __setPlanForTests(null); });

describe("ID verification tab", () => {
  it("is locked below Growth", () => {
    setPlan(false);
    renderWithRole(<IdVerificationTab applicationId="app-1" />, "Staff");
    expect(screen.getByTestId("feature-locked-id_verification")).toBeInTheDocument();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("sends a request to a guarantor, shows results, and lets staff approve a review", async () => {
    setPlan(true);
    h.get.mockImplementation(async (url: string) => {
      if (url.endsWith("/id-details")) return { ok: true, details: { first_name: "Jane", last_name: "Doe", document_number: "*****6789" } };
      return { ok: true, application_id: "app-1", provider: { key: "onfido", label: "Entrust IDV (Onfido)", configured: true, hosted: true },
        people: [{ contact_id: "c1", role: "applicant", name: "Jane Doe", has_phone: true }, { contact_id: "c2", role: "guarantor", name: "Gus G", has_phone: true }],
        verifications: [verification()] };
    });
    h.post.mockResolvedValue({ ok: true, created: true, verification: verification({ id: "v2", status: "requested" }) });
    renderWithRole(<IdVerificationTab applicationId="app-1" />, "Staff");
    await screen.findByTestId("kyc-row-v1");
    expect(screen.getByTestId("kyc-chip-review")).toHaveTextContent("Needs review");
    expect(screen.getByText(/identity record \(data source\) check needs a look/)).toBeInTheDocument();
    expect(screen.getByText(/2 picture\(s\) saved to the Documents tab/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Person to verify"), { target: { value: "c2" } });
    fireEvent.click(screen.getByRole("button", { name: "Send verification request" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/kyc/applications/app-1/requests", { contact_id: "c2" }));

    fireEvent.click(screen.getByRole("button", { name: "Show what the ID says" }));
    expect(await screen.findByText("*****6789")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /full number/ })).toBeNull(); // staff cannot reveal

    fireEvent.change(screen.getByLabelText("Review note"), { target: { value: "Looks right" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/kyc/verifications/v1/decision", { decision: "approved", note: "Looks right" }));
  });

  it("says when no service is set up", async () => {
    setPlan(true);
    h.get.mockResolvedValue({ ok: true, application_id: "app-1", provider: { key: "onfido", label: "Entrust IDV", configured: false, hosted: true }, people: [], verifications: [] });
    renderWithRole(<IdVerificationTab applicationId="app-1" />, "Staff");
    expect(await screen.findByText(/not set up yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send verification request" })).toBeDisabled();
  });

  it("status chips are readable (contrast 4.5:1 or better)", () => {
    for (const s of Object.values(STATUS_LOOK)) expect(contrast(s.fg, s.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Settings > ID verification", () => {
  it("shows the webhook address and saves the wizard step", async () => {
    setPlan(true);
    h.get.mockResolvedValue({ ok: true, settings: { provider: null, wizard_step: false, wizard_people: "applicant", updated_at: null }, active_provider: "manual",
      providers: [{ key: "onfido", label: "Entrust IDV (Onfido)", configured: false, hosted: true, settings: ["ONFIDO_API_TOKEN"] }, { key: "manual", label: "Manual review", configured: true, hosted: false, settings: [] }],
      webhook_url: "https://server.example/api/kyc/webhooks/onfido" });
    h.put.mockResolvedValue({ ok: true, settings: { provider: null, wizard_step: true, wizard_people: "applicant", updated_at: null } });
    renderWithRole(<IdVerificationSettings />, "Admin");
    expect(await screen.findByTestId("kyc-webhook-url")).toHaveTextContent("https://server.example/api/kyc/webhooks/onfido");
    fireEvent.click(screen.getByRole("checkbox", { name: /Ask for ID right after/ }));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/kyc/settings", { wizard_step: true }));
    expect(await screen.findByLabelText("Who to verify")).toBeInTheDocument();
  });

  it("catalogue lists ID verification at Growth", () => {
    expect(FEATURES.find((f) => f.key === "id_verification")?.plan).toBe("growth");
  });
});
