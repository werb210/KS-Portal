// KS_PORTAL_BANK_CONNECT_ADDON - bank connect is a hidden per-licensee add-on, not a plan feature. Off (the default,
// and whenever the plan is unknown): no Connect Bank step, no Flinks doc, no check 3, no bank link, no Flinks service
// row, no locked badge. On (GET /api/plan addons.bank_connect === true): all of it is back.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { planBody } from "@/plans/__tests__/fixtures";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put } }));

import FraudTab from "@/fraud/FraudTab";
import FraudProtectionCard from "@/fraud/FraudProtectionCard";
import RequestStepsModal from "@/pages/pipeline/RequestStepsModal";
import { __setPlanForTests, hasAddon, normalizePlan, fallbackPlan } from "@/plans/planStore";
import { FEATURES } from "@/plans/catalogue";
import type { FraudCheck, FraudOverview } from "@/fraud/fraudApi";

const setPlan = (addons?: Record<string, unknown>) =>
  __setPlanForTests(normalizePlan(planBody({ plan: "pro", effective_plan: "pro", ...(addons ? { addons } : {}) })));

const check = (key: string, label: string, locked = false): FraudCheck =>
  ({ key, label, description: label, scope: "application", plan: "pro", locked, status: locked ? "locked" : "green", reasons: [] }) as unknown as FraudCheck;

function overview(withCheck3: boolean): FraudOverview {
  return {
    application_id: "app-1",
    checks: [check("fraud_4", "Duplicate document check"), ...(withCheck3 ? [check("fraud_3", "Statement vs live bank data")] : [])],
    documents: [],
    score: null,
    include_prescreen_in_package: false,
    queue: { queued: false, done_at: null, last_error: null },
  } as FraudOverview;
}

beforeEach(() => {
  h.get.mockReset(); h.post.mockReset(); h.put.mockReset();
  __setPlanForTests(null);
});

describe("plan store", () => {
  it("is off unless the server says exactly true; never a plan feature", () => {
    expect(hasAddon("bank_connect", fallbackPlan())).toBe(false);
    expect(normalizePlan(planBody())!.addons).toEqual({});
    expect(normalizePlan(planBody({ addons: { bank_connect: "yes" } }))!.addons).toEqual({});
    const on = normalizePlan(planBody({ addons: { bank_connect: true } }))!;
    expect(hasAddon("bank_connect", on)).toBe(true);
    expect(FEATURES.map((f) => f.key)).not.toContain("bank_connect");
    expect(FEATURES.map((f) => f.key)).not.toContain("fraud_3");
  });
});

describe("Request additional steps", () => {
  const open = () => renderWithRole(<RequestStepsModal applicationId="app-1" onClose={() => undefined} onDone={() => undefined} />, "Staff");

  it("off: no Connect Bank chip and no locked badge", () => {
    setPlan();
    open();
    expect(screen.queryByText("Connect Bank (View-Only)")).toBeNull();
    expect(screen.queryByTestId("request-step-flinks")).toBeNull();
    expect(screen.queryByTestId("bank-connect-locked")).toBeNull();
    expect(screen.getByTestId("request-step-cra")).toBeInTheDocument();
  });

  it("on: Connect Bank can be requested", async () => {
    setPlan({ bank_connect: true });
    h.post.mockResolvedValue({ ok: true });
    open();
    fireEvent.click(screen.getByTestId("request-step-flinks"));
    expect(screen.getByText("Connect Bank (View-Only)")).toBeInTheDocument();
  });
});

describe("Fraud check tab", () => {
  it("off: check 3 and the bank link are not shown, even if a server lists them", async () => {
    setPlan();
    h.get.mockResolvedValue({ ok: true, ...overview(true) });
    renderWithRole(<FraudTab applicationId="app-1" />, "Staff");
    await screen.findByTestId("fraud-tab");
    expect(screen.queryByTestId("fraud-check-fraud_3")).toBeNull();
    expect(screen.queryByTestId("fraud-bank-link")).toBeNull();
    expect(screen.queryByText(/Flinks/)).toBeNull();
  });

  it("on: check 3 is listed and the Flinks LoginId saves to the bank link", async () => {
    setPlan({ bank_connect: true });
    h.get.mockResolvedValue({ ok: true, ...overview(true) });
    h.put.mockResolvedValue({ ok: true });
    renderWithRole(<FraudTab applicationId="app-1" />, "Staff");
    await screen.findByTestId("fraud-check-fraud_3");
    const box = within(screen.getByTestId("fraud-bank-link")).getByLabelText("Flinks LoginId");
    fireEvent.change(box, { target: { value: "5e2f6a3b-1111-4c4c-9d9d-000000000001" } });
    fireEvent.click(within(screen.getByTestId("fraud-bank-link")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/fraud/applications/app-1/bank-link", { login_id: "5e2f6a3b-1111-4c4c-9d9d-000000000001" }));
  });
});

describe("Company -> Fraud protection services", () => {
  const settings = {
    ok: true, allowed: ["fraud_3"],
    settings: { watchlist_opt_in: false, include_prescreen_in_package: false, updated_at: null },
    watchlist: { available: false, ready: true, why: null },
    services: [
      { key: "bank", label: "Live bank data", provider: "flinks", configured: false, setting: "FLINKS_BASE_URL, FLINKS_CUSTOMER_ID", used_by: ["fraud_3"] },
      { key: "domainAge", label: "Website and email domain age", provider: "rdap", configured: true, setting: "on", used_by: ["fraud_6"] },
    ],
  };

  it("off: no Flinks row", async () => {
    setPlan();
    h.get.mockResolvedValue(settings);
    renderWithRole(<FraudProtectionCard />, "Admin");
    const services = await screen.findByTestId("fraud-services");
    expect(within(services).queryByText("Live bank data")).toBeNull();
    expect(within(services).getByText("Website and email domain age")).toBeInTheDocument();
  });

  it("on: the Flinks row shows", async () => {
    setPlan({ bank_connect: true });
    h.get.mockResolvedValue(settings);
    renderWithRole(<FraudProtectionCard />, "Admin");
    const services = await screen.findByTestId("fraud-services");
    expect(within(services).getByText("Live bank data")).toBeInTheDocument();
  });
});
