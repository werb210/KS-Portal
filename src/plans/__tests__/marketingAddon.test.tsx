// KS_PORTAL_MARKETING_ADDON - the Marketing add-on on the Plan page, the add-on gate for its tools, the e-signing and
// campaign email meters, the composer's send options and the campaign report's A/B line.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { planBody } from "@/plans/__tests__/fixtures";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put, delete: vi.fn() } }));

import PlanSettings from "@/pages/settings/tabs/PlanSettings";
import { __setPlanForTests, normalizePlan, getPlan } from "@/plans/planStore";
import { AddonGate, hasMarketingTool, serverMessage } from "@/plans/marketing";
import { sendOptionsPayload, DEFAULT_SEND_OPTIONS } from "@/components/marketing/CampaignSendOptions";
import { abSummary } from "@/components/marketing/CampaignReportPanel";

const ADDS = ["10,000 campaign emails a month on top of your plan's, then $10 per 10,000 on next month's bill", "Lead scoring"];
const marketing = (over: Record<string, unknown> = {}) => ({
  addon: { key: "marketing", name: "Marketing add-on", price: 49, currency: "CAD", active: false, purchased: false, via: null, adds: ADDS, marketing_seats: 3 },
  limits: { campaign_emails: 500, plan_campaign_emails: 500, text_to_many: 50, sequences: 2, visitor_history_days: 30, lead_forms: 1, bonus_marketing_texts: 0, addon: false },
  plan_limits: {
    starter: { campaign_emails: 500, text_to_many: 50, sequences: 2, visitor_history_days: 30, lead_forms: 1 },
    growth: { campaign_emails: 1000, text_to_many: 250, sequences: 5, visitor_history_days: 90, lead_forms: 1 },
    pro: { campaign_emails: 2500, text_to_many: 500, sequences: 10, visitor_history_days: 365, lead_forms: 1 },
  },
  tools: { website_kit: null, session_replay: null, full_visitor_history: null, google_ads_full: null, lead_scoring: null, ab_test: null, send_time: null, funded_report: null },
  ...over,
});
const usage = {
  period: "2026-10", minutes: 10, texts: 20, assistant_chats: 1, storage_bytes: 0,
  campaign_emails: 450, marketing_texts: 0, signings: 7, marketing_addon: false,
  allowances: { minutes: 50, texts: 100, assistant_chats: 200, storage_bytes: 10e9, campaign_emails: 500, signings: 4, bonus_marketing_texts: 0 },
  overage: { minutes: 0, texts: 0, campaign_emails: 0, campaign_email_blocks: 0, signings: 3 },
};
const setPlan = (over: Record<string, unknown> = {}) => __setPlanForTests(normalizePlan(planBody({ marketing: marketing(), signings: { included: 4, overage_price: 2.5 }, usage, ...over })));

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  __setPlanForTests(null);
});

describe("plan store", () => {
  it("reads the marketing block and signings; tools come from the plan or the add-on", () => {
    setPlan();
    const s = getPlan();
    expect(s.marketing?.limits).toMatchObject({ campaign_emails: 500, text_to_many: 50, sequences: 2 });
    expect(s.signings).toEqual({ included: 4, overage_price: 2.5 });
    expect(s.usage).toMatchObject({ signings: 7, campaign_emails: 450, overage: { signings: 3 } });
    expect(hasMarketingTool("lead_scoring", s)).toBe(false);
    setPlan({ marketing: marketing({ tools: { ...marketing().tools, lead_scoring: "addon" } }) });
    expect(hasMarketingTool("lead_scoring", getPlan())).toBe(true);
    __setPlanForTests(null);
    expect(hasMarketingTool("lead_scoring", getPlan())).toBe(true); // unknown plan: nothing locked
  });
});

describe("Plan page", () => {
  it("shows the add-on, the signing and campaign email meters, and the signing overage", () => {
    setPlan();
    renderWithRole(<PlanSettings />, "Admin");
    expect(screen.getByTestId("plan-marketing-addon")).toHaveTextContent("Marketing add-on: Not added");
    expect(screen.getByTestId("plan-marketing-addon")).toHaveTextContent("$49 a month for your whole brokerage");
    expect(screen.getByTestId("usage-signings")).toHaveTextContent("E-signings: 7 of 4");
    expect(screen.getByTestId("usage-campaign_emails")).toHaveTextContent("Campaign emails: 450 of 500");
    expect(screen.getByTestId("plan-usage-overage")).toHaveTextContent("3 extra signings at $2.50 = $7.50");
    expect(screen.getByTestId("plan-allowances")).toHaveTextContent("E-signings: 4 a month for the brokerage, then $2.50 each");
    expect(screen.getByTestId("plan-allowances")).toHaveTextContent("Send one text to many: up to 50 people per send");
    expect(screen.getByTestId("plan-comparison")).toHaveTextContent("Campaign emails per month");
  });

  it("an Admin asks Keystone for the add-on", async () => {
    setPlan();
    h.post.mockResolvedValueOnce({ ok: true });
    renderWithRole(<PlanSettings />, "Admin");
    fireEvent.click(screen.getByRole("button", { name: "Ask for the Marketing add-on ($49 a month)" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/plan/upgrade-request", { addon: "marketing" }));
    expect(await screen.findByText(/We will switch the Marketing add-on on/)).toBeInTheDocument();
  });

  it("says when the add-on comes from a trial", () => {
    setPlan({ marketing: marketing({ addon: { ...marketing().addon, active: true, via: "trial" } }) });
    renderWithRole(<PlanSettings />, "Staff");
    expect(screen.getByTestId("plan-marketing-addon")).toHaveTextContent("Marketing add-on: On during your free trial");
  });
});

describe("add-on gate", () => {
  it("shows the tool when the brokerage has it, else what the add-on is", () => {
    setPlan();
    renderWithRole(<AddonGate tool="lead_scoring"><p>scores</p></AddonGate>, "Staff");
    expect(screen.queryByText("scores")).toBeNull();
    expect(screen.getByTestId("addon-locked-lead_scoring")).toHaveTextContent("comes with the Marketing add-on");
    expect(screen.getByText("Ask your administrator about the Marketing add-on.")).toBeInTheDocument();
    cleanup();
    setPlan({ marketing: marketing({ tools: { ...marketing().tools, lead_scoring: "addon" } }) });
    render(<AddonGate tool="lead_scoring"><p>scores</p></AddonGate>);
    expect(screen.getByText("scores")).toBeInTheDocument();
  });

  it("names the plan that already includes a tool", () => {
    setPlan();
    renderWithRole(<AddonGate tool="google_ads_full"><p>x</p></AddonGate>, "Admin");
    expect(screen.getByTestId("addon-locked-google_ads_full")).toHaveTextContent("Included in Pro.");
  });
});

describe("helpers", () => {
  it("sends the A/B test or the best time, never both", () => {
    expect(sendOptionsPayload(DEFAULT_SEND_OPTIONS)).toEqual({});
    expect(sendOptionsPayload({ ...DEFAULT_SEND_OPTIONS, ab: true, subjectB: " B " })).toEqual({ abTest: { subjectB: "B", testPercent: 20, waitHours: 4 } });
    expect(sendOptionsPayload({ ...DEFAULT_SEND_OPTIONS, ab: true, subjectB: "" })).toEqual({});
    expect(sendOptionsPayload({ ...DEFAULT_SEND_OPTIONS, bestTime: true })).toEqual({ sendTime: "best" });
  });

  it("reads the server's plain-English refusal", () => {
    expect(serverMessage({ details: { error: { code: "text_to_many_limit", message: "This text would go to 60 people." } } }, "x")).toBe("This text would go to 60 people.");
    expect(serverMessage({ details: { message: "With the Marketing add-on, up to 3 people." } }, "x")).toBe("With the Marketing add-on, up to 3 people.");
    expect(serverMessage({ details: { error: "campaign_email_limit" } }, "fallback")).toBe("fallback");
  });

  it("summarises an A/B test", () => {
    expect(abSummary(null)).toBeNull();
    expect(abSummary({ subjectB: "B" })).toMatch(/A\/B test running/);
    expect(abSummary({ subjectB: "B", winner: "B", results: { A: { sent: 10, opened: 2, clicked: 0 }, B: { sent: 10, opened: 4, clicked: 1 } } }))
      .toBe("A/B test: subject B won (A 20% opened, B 40% opened).");
  });
});
