// KS_PORTAL_v3_PLANS - the live api client turns a 402 feature_not_in_plan answer into the upsell dialog, and the
// caller still gets an ApiError (no crash).
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, screen } from "@testing-library/react";
import { renderWithRole } from "./renderWithRole";

vi.mock("@/lib/authToken", () => ({
  getAuthToken: () => "tok",
  authToken: { get: () => "tok", set: () => undefined, clear: () => undefined },
  AUTH_STORAGE_KEY: "auth_token",
}));

import { api, ApiError } from "@/api";
import UpsellHost from "@/plans/UpsellHost";
import { reportPlanRefusal } from "@/plans/upsell";

function respond(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })));
}

afterEach(() => vi.unstubAllGlobals());

describe("402 feature_not_in_plan", () => {
  it("opens the upsell dialog and still rejects the call", async () => {
    renderWithRole(<UpsellHost />, "Staff");
    respond(402, { ok: false, error: "feature_not_in_plan", feature: "call_summaries", required_plan: "growth", trial_available: true });
    let err: unknown;
    await act(async () => { err = await api.post("/api/crm/calls/c1/ai-summary", {}).catch((e: unknown) => e); });
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(402);
    const dialog = await screen.findByTestId("plan-upsell-dialog");
    expect(dialog).toHaveTextContent("Call summaries");
    expect(dialog).toHaveTextContent("Included in Growth and Pro.");
    expect(dialog).toHaveTextContent("Ask your administrator to turn this on.");
    act(() => { screen.getByRole("button", { name: "Close" }).click(); });
    expect(screen.queryByTestId("plan-upsell-dialog")).toBeNull();
  });

  // KS_PORTAL_v4_UPSELL_ON_ACTIONS - pages loading data must not pop the dialog on every visit.
  it("stays quiet when a page load (GET) is refused, and the caller still gets the error", async () => {
    renderWithRole(<UpsellHost />, "Staff");
    respond(402, { ok: false, error: "feature_not_in_plan", feature: "templates", required_plan: "growth", trial_available: true });
    let err: unknown;
    await act(async () => { err = await api.get("/api/templates").catch((e: unknown) => e); });
    expect((err as ApiError).status).toBe(402);
    expect(screen.queryByTestId("plan-upsell-dialog")).toBeNull();
    expect(reportPlanRefusal(402, { error: "feature_not_in_plan", feature: "templates" }, "GET")).toBe(false);
  });

  it("ignores other errors", () => {
    expect(reportPlanRefusal(402, { error: "payment_required" })).toBe(false);
    expect(reportPlanRefusal(403, { error: "feature_not_in_plan" })).toBe(false);
    expect(reportPlanRefusal(402, "nope")).toBe(false);
  });
});
