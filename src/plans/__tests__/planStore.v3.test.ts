// KS_PORTAL_v3_PLANS - the plan store: server answers, the safe Pro fallback, trial start and upgrade requests.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/api/http";
import { ACTIVE_TRIAL, planBody } from "./fixtures";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post } }));

import { __setPlanForTests, getPlan, hasFeature, loadPlan, normalizePlan, requestUpgrade, requiredPlan, startTrial } from "@/plans/planStore";

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  __setPlanForTests(null);
});

describe("plan store", () => {
  it("starts as Pro with no trial, so nothing is locked before the server answers", () => {
    const p = getPlan();
    expect(p.source).toBe("fallback");
    expect(p.plan).toBe("pro");
    expect(p.trial.status).toBe("not_offered");
    expect(hasFeature("call_summaries")).toBe(true);
    expect(hasFeature("sso")).toBe(true);
  });

  it("falls back to Pro / no trial when GET /api/plan answers 404", async () => {
    h.get.mockRejectedValueOnce(new ApiError({ status: 404, message: "not found" }));
    await loadPlan();
    expect(getPlan().source).toBe("fallback");
    expect(getPlan().plan).toBe("pro");
    expect(hasFeature("templates")).toBe(true);
  });

  it("falls back to Pro when the server cannot be reached", async () => {
    h.get.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await loadPlan();
    expect(getPlan().source).toBe("fallback");
    expect(hasFeature("ad_attribution")).toBe(true);
  });

  it("locks what a Starter plan does not include, and says which plan does", async () => {
    h.get.mockResolvedValueOnce(planBody());
    await loadPlan();
    expect(getPlan().plan).toBe("starter");
    expect(hasFeature("templates")).toBe(false);
    expect(hasFeature("ad_attribution")).toBe(false);
    expect(requiredPlan("templates")).toBe("growth");
    expect(requiredPlan("ad_attribution")).toBe("pro");
    expect(requiredPlan("sso")).toBe("pro"); // from the built-in catalogue when the server leaves it out
    expect(hasFeature("some_unknown_feature")).toBe(true);
  });

  it("keeps the last server copy when a later refresh fails with a network error", async () => {
    h.get.mockResolvedValueOnce(planBody());
    await loadPlan();
    h.get.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await loadPlan();
    expect(getPlan().source).toBe("server");
    expect(hasFeature("templates")).toBe(false);
  });

  it("derives features from the effective plan during a trial", async () => {
    h.get.mockResolvedValueOnce(planBody(ACTIVE_TRIAL));
    await loadPlan();
    expect(getPlan().trial.days_left).toBe(9);
    expect(hasFeature("templates")).toBe(true);
    expect(hasFeature("ad_attribution")).toBe(true);
  });

  it("treats a missing storage field as not reported, and reads one that is there", () => {
    expect(normalizePlan(planBody())?.storage).toBeNull();
    const s = normalizePlan(planBody({ storage: { used_bytes: 8e9, allowance_bytes: 10e9, extra_blocks: 0, seats: 1, percent: 80 } }))?.storage;
    expect(s).toMatchObject({ used_bytes: 8e9, allowance_bytes: 10e9, percent: 80, seats: 1 });
    expect(normalizePlan(planBody())?.allowances.storage_gb_per_seat).toBe(10);
  });

  it("rejects a body that is not a plan", () => {
    expect(normalizePlan({ ok: false, error: "x" })).toBeNull();
    expect(normalizePlan({ plan: "enterprise" })).toBeNull();
    expect(normalizePlan(null)).toBeNull();
  });

  it("starts the trial and reloads the plan", async () => {
    h.post.mockResolvedValueOnce({ ok: true });
    h.get.mockResolvedValueOnce(planBody(ACTIVE_TRIAL));
    const r = await startTrial();
    expect(r).toEqual({ ok: true });
    expect(h.post).toHaveBeenCalledWith("/api/plan/trial", {});
    expect(getPlan().trial.status).toBe("active");
  });

  it("explains a 409 when the trial is no longer available", async () => {
    h.post.mockRejectedValueOnce(new ApiError({ status: 409, message: "trial_not_available", details: { ok: false, error: "trial_not_available" } }));
    h.get.mockResolvedValue(planBody({ trial: { status: "used" } }));
    const r = await startTrial();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no longer available/);
  });

  it("sends upgrade and extra-storage requests", async () => {
    h.post.mockResolvedValue({ ok: true });
    await requestUpgrade("growth");
    expect(h.post).toHaveBeenLastCalledWith("/api/plan/upgrade-request", { plan: "growth" });
    await requestUpgrade("starter", 1);
    expect(h.post).toHaveBeenLastCalledWith("/api/plan/upgrade-request", { plan: "starter", extra_storage_blocks: 1 });
  });
});
