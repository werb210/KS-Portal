import { describe, expect, it } from "vitest";
import { planLockText } from "../ReportDataCards";

describe("a report the plan does not include", () => {
  it("names the plan that has it", () => {
    expect(planLockText({ status: 402, details: { required_plan: "growth" } })).toBe("This report is not in your plan. Included in Growth and Pro.");
  });
  it("still says so when the plan is not known", () => {
    expect(planLockText({ status: 402, details: {} })).toBe("This report is not in your plan.");
  });
  it("leaves real failures alone", () => {
    expect(planLockText({ status: 500 })).toBeNull();
    expect(planLockText(new Error("offline"))).toBeNull();
  });
});
