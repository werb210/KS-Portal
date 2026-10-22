// KS_PORTAL_v3_PLANS - FeatureGate: allowed, locked for an Admin with the trial available, locked for staff,
// locked after the trial was used, and the nav/tab badge.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { ACTIVE_TRIAL, planBody } from "./fixtures";
import { renderWithRole } from "./renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post } }));

import FeatureGate, { LockedBadge, TRIAL_CTA } from "@/plans/FeatureGate";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";

const setPlan = (over: Record<string, unknown> = {}) => __setPlanForTests(normalizePlan(planBody(over)));

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  __setPlanForTests(null);
});

const gated = <FeatureGate feature="call_summaries"><div>summary content</div></FeatureGate>;

describe("FeatureGate", () => {
  it("shows the feature when the plan includes it", () => {
    setPlan({ plan: "growth", effective_plan: "growth", features: { call_summaries: true } });
    renderWithRole(gated, "Staff");
    expect(screen.getByText("summary content")).toBeInTheDocument();
  });

  it("shows the feature while the plan is unknown (fallback)", () => {
    renderWithRole(gated, "Staff");
    expect(screen.getByText("summary content")).toBeInTheDocument();
  });

  it("locked, Admin, trial available: explains the feature and offers the 14-day trial", async () => {
    setPlan();
    h.post.mockResolvedValueOnce({ ok: true });
    h.get.mockResolvedValueOnce(planBody(ACTIVE_TRIAL));
    renderWithRole(gated, "Admin");
    expect(screen.queryByText("summary content")).toBeNull();
    expect(screen.getByTestId("feature-locked-call_summaries")).toBeInTheDocument();
    expect(screen.getByText(/writes a short summary/)).toBeInTheDocument();
    expect(screen.getByText("Included in Growth and Pro.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: TRIAL_CTA }));
    await waitFor(() => expect(screen.getByText("summary content")).toBeInTheDocument());
    expect(h.post).toHaveBeenCalledWith("/api/plan/trial", {});
  });

  it("locked, not an Admin: tells them to ask their administrator, with no trial button", () => {
    setPlan();
    renderWithRole(gated, "Staff");
    expect(screen.getByText("Ask your administrator to turn this on.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: TRIAL_CTA })).toBeNull();
  });

  it("locked after the trial was used: no trial button, an upgrade request instead", async () => {
    setPlan({ trial: { status: "used", started_at: "2026-09-01T00:00:00Z", ends_at: "2026-09-15T00:00:00Z", days_left: 0 } });
    h.post.mockResolvedValueOnce({ ok: true });
    renderWithRole(<FeatureGate feature="ad_attribution"><div>ads</div></FeatureGate>, "Admin");
    expect(screen.queryByRole("button", { name: TRIAL_CTA })).toBeNull();
    expect(screen.getByText("Your free trial has been used.")).toBeInTheDocument();
    expect(screen.getByText("Included in Pro.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Request Pro" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/plan/upgrade-request", { plan: "pro" }));
    expect(await screen.findByText(/Upgrade to Pro requested/)).toBeInTheDocument();
  });

  it("compact gate renders a one-line note", () => {
    setPlan();
    renderWithRole(<FeatureGate feature="call_recording" compact><div>audio</div></FeatureGate>, "Staff");
    expect(screen.getByTestId("feature-locked-call_recording")).toHaveTextContent("Call recording");
    expect(screen.queryByText("audio")).toBeNull();
  });

  it("badges a locked feature with the plan that includes it, and nothing when included", () => {
    setPlan();
    const { unmount } = renderWithRole(<LockedBadge feature="ad_attribution" />, "Staff");
    expect(screen.getByTestId("plan-badge-pro")).toHaveTextContent("Pro");
    unmount();
    setPlan(ACTIVE_TRIAL);
    renderWithRole(<LockedBadge feature="ad_attribution" />, "Staff");
    expect(screen.queryByTestId("plan-badge-pro")).toBeNull();
  });
});
