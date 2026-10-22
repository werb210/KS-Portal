// KS_PORTAL_v5_NO_REPORTS_ON_STARTER - Starter has no Reports page; the basic Dashboard sections stay.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { planBody } from "./fixtures";
import { renderWithRole } from "./renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(async () => ({ reports: [], tabs: [], teamTabs: [], dashboard: null })), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: Object.assign(h.get, { get: h.get, post: h.post, put: h.put }) }));

import ReportsBoard, { STARTER_DASHBOARD_REPORTS, reportFeature } from "@/pages/reports/ReportsBoard";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";

beforeEach(() => { __setPlanForTests(null); });

describe("no reports on Starter", () => {
  it("only the basic Dashboard sections are free; every other card needs Reports", () => {
    for (const key of STARTER_DASHBOARD_REPORTS) expect(reportFeature(key, "operations")).toBeNull();
    expect(reportFeature("stuck_deals", "operations")).toBe("full_reports");
    expect(reportFeature("dash_marketing_perf", "operations")).toBe("full_reports");
    expect(reportFeature("commission_by_month", "money")).toBe("full_reports");
    expect(reportFeature("ads_story", "marketing")).toBe("ad_attribution");
  });

  it("the Reports page is locked on Starter", () => {
    __setPlanForTests(normalizePlan(planBody({ plan: "starter", effective_plan: "starter", features: { full_reports: false } })));
    renderWithRole(<ReportsBoard />, "Admin");
    expect(screen.getByTestId("feature-locked-full_reports")).toBeInTheDocument();
    expect(screen.queryByTestId("reports-board")).toBeNull();
  });
});
