// KS_PORTAL_v9_PORTAL_PLANS - lender portal is on every plan; the broker portal (Marketing > Referrers > Brokers) is
// growth and up, locked like the referrer portal on starter.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { planBody } from "./fixtures";
import { renderWithRole } from "./renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post } }));
vi.mock("@/pages/marketing/BFReferrerManagement", () => ({ default: () => <div>referrer-management</div> }));
vi.mock("@/pages/brokerImports/BrokerImportsPage", () => ({ default: () => <div>broker-files</div> }));

import ReferrersAndBrokers from "@/pages/marketing/ReferrersAndBrokers";
import { featureInfo } from "@/plans/catalogue";
import { __setPlanForTests, hasFeature, normalizePlan } from "@/plans/planStore";

beforeEach(() => { __setPlanForTests(null); });

describe("portal plans", () => {
  it("lender portal is a starter feature with the new label; broker portal is growth", () => {
    expect(featureInfo("lender_portal")).toMatchObject({ plan: "starter", label: "Lender portal (lenders keep their details and products current and send you deals they can't place)" }); // KS_PORTAL_PLAN_FIXES
    expect(featureInfo("broker_portal")).toMatchObject({ plan: "growth", label: "Broker portal" });
    __setPlanForTests(normalizePlan(planBody()));
    expect(hasFeature("lender_portal")).toBe(true);
    expect(hasFeature("broker_portal")).toBe(false);
  });

  it("locks the Brokers sub-tab on starter", () => {
    __setPlanForTests(normalizePlan(planBody()));
    renderWithRole(<ReferrersAndBrokers initial="brokers" />, "Staff");
    expect(screen.queryByText("broker-files")).toBeNull();
    expect(screen.getAllByText(/Broker portal/).length).toBeGreaterThan(0);
  });

  it("shows broker files on growth", () => {
    __setPlanForTests(normalizePlan(planBody({ plan: "growth", effective_plan: "growth", features: { referrer_portal: true, broker_portal: true } })));
    renderWithRole(<ReferrersAndBrokers />, "Staff");
    fireEvent.click(screen.getByRole("tab", { name: "Brokers" }));
    expect(screen.getByText("broker-files")).toBeTruthy();
  });
});
