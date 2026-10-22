// KS_PORTAL_v6_USAGE - Plan tab "This month" card: used/allowance, amber at 80%, red at 100%, unlimited,
// overage lines, and hidden when GET /api/plan has no usage.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { planBody } from "@/plans/__tests__/fixtures";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post } }));

import PlanSettings, { overageLine, usageTone } from "../PlanSettings";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";

const usage = (over: Record<string, unknown> = {}) => ({
  period: "2026-10",
  minutes: 212, texts: 85, assistant_chats: 40, storage_bytes: 2_000_000_000,
  allowances: { minutes: 200, texts: 100, assistant_chats: null, storage_bytes: 10_000_000_000 },
  overage: { minutes: 12, texts: 0 },
  ...over,
});
const setPlan = (over: Record<string, unknown> = {}) => __setPlanForTests(normalizePlan(planBody(over)));

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  __setPlanForTests(null);
});

describe("usage card", () => {
  it("shows used / allowance with the right colours, unlimited chats and the overage cost", () => {
    setPlan({ usage: usage() });
    renderWithRole(<PlanSettings />, "Admin");
    expect(screen.getByTestId("usage-minutes")).toHaveTextContent("Call minutes: 212 of 200");
    expect(screen.getByTestId("usage-minutes-bar")).toHaveStyle({ background: "#b91c1c", width: "100%" });
    expect(screen.getByTestId("usage-texts")).toHaveTextContent("Texts: 85 of 100");
    expect(screen.getByTestId("usage-texts-bar")).toHaveStyle({ background: "#b45309" });
    expect(screen.getByTestId("usage-assistant_chats")).toHaveTextContent("40 used of Unlimited");
    expect(screen.queryByTestId("usage-assistant_chats-bar")).toBeNull();
    expect(screen.getByTestId("usage-storage-bar")).toHaveStyle({ background: "#1d4ed8", width: "20%" });
    expect(screen.getByTestId("plan-usage-overage")).toHaveTextContent("12 extra minutes at $0.04 = $0.48");
    expect(screen.getByTestId("plan-usage")).toHaveTextContent("never cut off");
  });

  it("is hidden when the server sends no usage", () => {
    setPlan();
    renderWithRole(<PlanSettings />, "Admin");
    expect(screen.queryByTestId("plan-usage")).toBeNull();
  });

  it("maths: thresholds and overage lines", () => {
    expect(usageTone(79.9).bar).toBe("#1d4ed8");
    expect(usageTone(80).bar).toBe("#b45309");
    expect(usageTone(100).bar).toBe("#b91c1c");
    expect(overageLine(1, "texts")).toBe("1 extra text at $0.03 = $0.03");
    expect(overageLine(250, "texts")).toBe("250 extra texts at $0.03 = $7.50");
  });

  it("works out overage from the allowance when the server leaves it out", () => {
    const p = normalizePlan(planBody({ usage: usage({ overage: undefined, texts: 130 }) }));
    expect(p?.usage?.overage).toEqual({ minutes: 12, texts: 30 });
  });
});
