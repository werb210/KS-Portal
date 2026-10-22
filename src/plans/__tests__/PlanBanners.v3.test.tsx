// KS_PORTAL_v3_PLANS - trial banner (days left, amber in the last 3 days), the post-trial recap, the storage banner.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { ACTIVE_TRIAL, planBody } from "./fixtures";
import { renderWithRole } from "./renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post } }));

import PlanBanners, { daysLeftText } from "@/plans/PlanBanners";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";

const setPlan = (over: Record<string, unknown> = {}) => __setPlanForTests(normalizePlan(planBody(over)));
const trialWith = (days: number) => setPlan({ ...ACTIVE_TRIAL, trial: { ...ACTIVE_TRIAL.trial, days_left: days } });

beforeEach(() => {
  h.post.mockReset();
  __setPlanForTests(null);
  try { localStorage.clear(); } catch { /* ignore */ }
});

describe("trial banner", () => {
  it("shows the days left to staff, with a link to the Plan tab", () => {
    trialWith(9);
    renderWithRole(<PlanBanners role="Staff" />, "Staff");
    const banner = screen.getByTestId("trial-banner");
    expect(banner).toHaveTextContent("Pro trial: 9 days left");
    expect(banner).toHaveAttribute("data-urgent", "false");
    expect(screen.getByRole("link", { name: "See your plan" })).toHaveAttribute("href", "/settings/plan");
  });

  it("turns amber at 3 days or fewer", () => {
    trialWith(3);
    renderWithRole(<PlanBanners role="Admin" />, "Admin");
    expect(screen.getByTestId("trial-banner")).toHaveAttribute("data-urgent", "true");
    expect(screen.getByTestId("trial-banner")).toHaveTextContent("Pro trial: 3 days left");
  });

  it("words the last days correctly", () => {
    expect(daysLeftText(1)).toBe("Pro trial: 1 day left");
    expect(daysLeftText(0)).toBe("Pro trial: ends today");
  });

  it("is hidden with no trial, and in the fallback", () => {
    setPlan();
    const { unmount } = renderWithRole(<PlanBanners role="Admin" />, "Admin");
    expect(screen.queryByTestId("trial-banner")).toBeNull();
    unmount();
    __setPlanForTests(null);
    renderWithRole(<PlanBanners role="Admin" />, "Admin");
    expect(screen.queryByTestId("trial-banner")).toBeNull();
  });
});

describe("trial recap", () => {
  const used = { trial: { status: "used", started_at: "2026-09-01T00:00:00Z", ends_at: "2026-09-15T00:00:00Z", days_left: 0 }, trial_usage: { call_summaries: 12, templates: 4 } };

  it("tells an Admin what the team used and requests the chosen upgrade", async () => {
    setPlan(used);
    h.post.mockResolvedValueOnce({ ok: true });
    renderWithRole(<PlanBanners role="Admin" />, "Admin");
    expect(screen.getByTestId("trial-recap")).toHaveTextContent("During your trial your team used: Call summaries 12×, Templates 4×");
    fireEvent.click(screen.getByRole("button", { name: "Keep these features" }));
    fireEvent.click(screen.getByRole("button", { name: /Choose Growth/ }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/plan/upgrade-request", { plan: "growth" }));
    expect(await screen.findByText(/Upgrade to Growth requested/)).toBeInTheDocument();
  });

  it("can be dismissed, and is not shown to staff", () => {
    setPlan(used);
    const { unmount } = renderWithRole(<PlanBanners role="Admin" />, "Admin");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("trial-recap")).toBeNull();
    unmount();
    localStorage.clear();
    renderWithRole(<PlanBanners role="Staff" />, "Staff");
    expect(screen.queryByTestId("trial-recap")).toBeNull();
  });
});

describe("storage banner", () => {
  it("warns an Admin at 80% and is silent below or when storage is not reported", () => {
    setPlan({ storage: { used_bytes: 8.5e9, allowance_bytes: 10e9, extra_blocks: 0, seats: 1, percent: 85 } });
    const first = renderWithRole(<PlanBanners role="Admin" />, "Admin");
    expect(screen.getByTestId("storage-banner")).toHaveTextContent("Document storage is 85% used.");
    first.unmount();
    setPlan({ storage: { used_bytes: 1e9, allowance_bytes: 10e9, extra_blocks: 0, seats: 1, percent: 10 } });
    const second = renderWithRole(<PlanBanners role="Admin" />, "Admin");
    expect(screen.queryByTestId("storage-banner")).toBeNull();
    second.unmount();
    setPlan();
    renderWithRole(<PlanBanners role="Admin" />, "Admin");
    expect(screen.queryByTestId("storage-banner")).toBeNull();
  });
});
