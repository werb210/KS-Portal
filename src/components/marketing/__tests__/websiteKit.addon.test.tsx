// KS_PORTAL_MARKETING_ADDON - Marketing > Website kit: the snippet to copy, the forms and their limit, and the add-on's
// chat widget and tracking switches.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";
import { planBody } from "@/plans/__tests__/fixtures";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put, delete: h.del } }));

import WebsiteKitPanel from "../WebsiteKitPanel";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";

const tools = (on: boolean) => Object.fromEntries(["website_kit", "session_replay", "full_visitor_history", "google_ads_full", "lead_scoring", "ab_test", "send_time", "funded_report"].map((k) => [k, on ? "addon" : null]));
const setAddon = (on: boolean) => __setPlanForTests(normalizePlan(planBody({
  marketing: { addon: { active: on, purchased: on, via: on ? "purchase" : null, price: 49, adds: [], marketing_seats: 3 }, limits: { campaign_emails: 500, text_to_many: 50, sequences: 2, visitor_history_days: 30, lead_forms: on ? null : 1 }, plan_limits: {}, tools: tools(on) },
})));

const overview = (over: Record<string, unknown> = {}) => ({
  ok: true,
  settings: { key: "a1b2c3d4e5f6a1b2c3d4e5f6", allowed_origins: ["https://prairie.ca"], chat_enabled: false, tracking_enabled: false, consent_banner: true },
  forms: [{ id: "f1", name: "Quote", fields: [{ key: "email", label: "Email", required: true }], button_label: "Send", thank_you: "Thanks", tag: null, active: true, submissions: 3, live: true }],
  snippet: { script: '<script src="https://ks.example/api/kit/a1b2c3d4e5f6a1b2c3d4e5f6/kit.js" async></script>', forms: [{ id: "f1", name: "Quote", html: '<div data-ks-form="f1"></div>' }] },
  limits: { lead_forms: 1, addon: false, can_use_extras: false },
  ...over,
});

beforeEach(() => { h.get.mockReset(); h.put.mockReset(); h.post.mockReset(); });

describe("Website kit", () => {
  it("shows the script, the form placeholder and the one-form limit without the add-on", async () => {
    setAddon(false);
    h.get.mockResolvedValue(overview());
    renderWithRole(<WebsiteKitPanel />, "Admin");
    expect(await screen.findByTestId("kit-script")).toHaveTextContent("/api/kit/a1b2c3d4e5f6a1b2c3d4e5f6/kit.js");
    expect(screen.getByTestId("kit-form-f1")).toHaveTextContent('<div data-ks-form="f1"></div>');
    expect(screen.getByTestId("kit-form-f1")).toHaveTextContent("3 submissions");
    expect(screen.getByText("1 of 1 on your plan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New form" })).toBeNull();
    expect(screen.getAllByTestId("addon-locked-website_kit").length).toBeGreaterThan(0);
  });

  it("with the add-on: more forms, and the chat widget and tracking switches", async () => {
    setAddon(true);
    h.get.mockResolvedValue(overview({ limits: { lead_forms: null, addon: true, can_use_extras: true } }));
    h.put.mockResolvedValue(overview({ settings: { ...overview().settings, chat_enabled: true }, limits: { lead_forms: null, addon: true, can_use_extras: true } }));
    renderWithRole(<WebsiteKitPanel />, "Admin");
    expect(await screen.findByRole("button", { name: "New form" })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/AI chat widget/));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/website-kit/settings", expect.objectContaining({ chat_enabled: true, allowed_origins: ["https://prairie.ca"] })));
  });
});
