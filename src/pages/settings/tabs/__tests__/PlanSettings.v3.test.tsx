// KS_PORTAL_v3_PLANS - Settings > Plan: current plan, start-trial flow, upgrade requests, comparison, storage meter.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { ACTIVE_TRIAL, planBody } from "@/plans/__tests__/fixtures";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post } }));

import PlanSettings, { storageTone } from "../PlanSettings";
import { TRIAL_CTA } from "@/plans/FeatureGate";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";

const setPlan = (over: Record<string, unknown> = {}) => __setPlanForTests(normalizePlan(planBody(over)));

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  __setPlanForTests(null);
});

describe("Plan tab", () => {
  it("an Admin starts the trial; the tab then shows the trial and the bonus allowances", async () => {
    setPlan();
    h.post.mockResolvedValueOnce({ ok: true });
    h.get.mockResolvedValueOnce(planBody(ACTIVE_TRIAL));
    renderWithRole(<PlanSettings />, "Admin");
    expect(screen.getByTestId("plan-current")).toHaveTextContent("Your plan: Starter");
    expect(screen.getByTestId("plan-allowances")).toHaveTextContent("Call minutes: 50 per seat");
    expect(screen.getByTestId("plan-allowances")).not.toHaveTextContent("trial bonus");
    fireEvent.click(screen.getByRole("button", { name: TRIAL_CTA }));
    await waitFor(() => expect(screen.getByTestId("plan-current")).toHaveTextContent("Pro trial: 9 days left"));
    expect(h.post).toHaveBeenCalledWith("/api/plan/trial", {});
    expect(screen.queryByRole("button", { name: TRIAL_CTA })).toBeNull();
    expect(screen.getByTestId("plan-allowances")).toHaveTextContent("Call minutes: 50 per seat + 100 trial bonus");
    expect(screen.getByTestId("plan-allowances")).toHaveTextContent("Texts: 100 per seat + 100 trial bonus");
  });

  it("shows the server's refusal when the trial cannot start", async () => {
    setPlan();
    h.post.mockRejectedValueOnce(Object.assign(new Error("x"), { status: 409, details: { ok: false, error: "Trial already used" } }));
    h.get.mockResolvedValue(planBody({ trial: { status: "used" } }));
    renderWithRole(<PlanSettings />, "Admin");
    fireEvent.click(screen.getByRole("button", { name: TRIAL_CTA }));
    expect(await screen.findByText("Trial already used")).toBeInTheDocument();
  });

  it("Admins request upgrades; staff see no buttons", async () => {
    setPlan();
    h.post.mockResolvedValueOnce({ ok: true });
    const { unmount } = renderWithRole(<PlanSettings />, "Admin");
    fireEvent.click(screen.getByRole("button", { name: "Request upgrade to Pro" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/plan/upgrade-request", { plan: "pro" }));
    unmount();
    renderWithRole(<PlanSettings />, "Staff");
    expect(screen.queryByRole("button", { name: /Request upgrade/ })).toBeNull();
    expect(screen.queryByRole("button", { name: TRIAL_CTA })).toBeNull();
  });

  it("compares the three plans, storage per seat included", () => {
    setPlan();
    renderWithRole(<PlanSettings />, "Staff");
    const table = screen.getByTestId("plan-comparison");
    expect(table).toHaveTextContent("Starter (yours)");
    expect(table).toHaveTextContent("Document storage per seat (shared)");
    expect(table).toHaveTextContent("10 GB");
    expect(table).toHaveTextContent("25 GB");
    expect(table).toHaveTextContent("50 GB");
    expect(table).toHaveTextContent("Unlimited");
  });

  it("shows the storage meter and lets an Admin ask for 50 GB more", async () => {
    setPlan({ storage: { used_bytes: 9e9, allowance_bytes: 10e9, extra_blocks: 0, seats: 1, percent: 90 } });
    h.post.mockResolvedValueOnce({ ok: true });
    renderWithRole(<PlanSettings />, "Admin");
    expect(screen.getByTestId("plan-storage")).toHaveTextContent("9 GB of 10 GB used (90%)");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "90");
    fireEvent.click(screen.getByRole("button", { name: "Add 50 GB for $10/month" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/plan/upgrade-request", { plan: "starter", extra_storage_blocks: 1 }));
  });

  it("hides the storage meter when the server does not report storage", () => {
    setPlan();
    renderWithRole(<PlanSettings />, "Admin");
    expect(screen.queryByTestId("plan-storage")).toBeNull();
  });

  it("colours storage amber at 80% and red at 100%", () => {
    expect(storageTone(50).label).toBe("");
    expect(storageTone(80).label).toBe("Almost full");
    expect(storageTone(100).label).toBe("Full");
  });

  it("says plan details are unavailable in the fallback", () => {
    renderWithRole(<PlanSettings />, "Admin");
    expect(screen.getByText(/Plan details are not available right now/)).toBeInTheDocument();
  });
});
