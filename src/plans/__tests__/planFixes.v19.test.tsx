// KS_PORTAL_PLAN_FIXES (Todd, Oct 26) - Templates, Snippets and Automations are hidden on Starter (shown on Growth and
// during the trial); call recording runs on every plan but playback is Growth+; the iPad app is on every plan.
// KS_PORTAL_PHONE_PROVISIONING - Settings > Phone lines searches and buys numbers through the server.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { planBody, ACTIVE_TRIAL } from "./fixtures";
import { renderWithRole } from "./renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), useAuth: vi.fn(), useSilo: vi.fn() }));
vi.mock("@/api", () => ({ api: Object.assign(h.get, { get: h.get, post: h.post, put: h.put }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => h.useAuth() }));
vi.mock("@/hooks/useSilo", () => ({ useSilo: () => h.useSilo() }));
vi.mock("@/components/auth/RequireRole", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/system/ErrorBoundary", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/features/ai/KnowledgeManager", () => ({ default: () => null }));
vi.mock("@/features/ai/MayaTuning", () => ({ default: () => null }));
vi.mock("@/pages/settings/components/SettingsSectionLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
for (const tab of ["ProfileSettings", "RuntimeSettings", "UserManagement", "SettingsOverview", "TemplatesSettings", "SnippetsSettings", "CollateralSettings", "PlanSettings", "RetentionSettings", "CompanySettings", "LabsSettings"]) {
  vi.doMock(`@/pages/settings/tabs/${tab}`, () => ({ default: () => <div data-testid={`tab-${tab}`} /> }));
}
vi.mock("@/pages/library/LibraryPage", () => ({ default: () => null }));
vi.mock("@/pages/help/HelpPage", () => ({ default: () => null }));
vi.mock("@/import/ImportData", () => ({ default: () => null }));

import { FEATURES, featureInfo } from "@/plans/catalogue";
import { __setPlanForTests, hasFeature, normalizePlan } from "@/plans/planStore";
import PhoneLines from "@/pages/settings/tabs/PhoneLines";

const starter = () => normalizePlan(planBody({ plan: "starter", effective_plan: "starter", features: { templates: false, automations: false, multiple_lines: false, toll_free_number: false, call_recording: true, call_recording_playback: false } }));
const growth = () => normalizePlan(planBody({ plan: "growth", effective_plan: "growth", features: { templates: true, automations: true, multiple_lines: false, toll_free_number: true, call_recording: true, call_recording_playback: true } }));

beforeEach(() => {
  __setPlanForTests(null);
  h.get.mockReset(); h.post.mockReset(); h.put.mockReset();
  h.useAuth.mockReturnValue({ user: { role: "Admin" } });
  h.useSilo.mockReturnValue({ silo: "BF" });
});

describe("catalogue", () => {
  it("matches the server's plan levels", () => {
    const levels = Object.fromEntries(FEATURES.map((f) => [f.key, f.plan]));
    expect(levels).toMatchObject({
      ipad_app: "starter", call_recording: "starter", call_recording_playback: "growth", watch_app: "growth",
      templates: "growth", automations: "growth", lender_portal: "starter", pgi_referrals: "starter", multiple_lines: "pro",
    });
    expect(levels.watch_ipad_apps).toBeUndefined();
    expect(featureInfo("lender_portal")!.description).toMatch(/by email or API/);
    expect(featureInfo("lender_portal")!.description).not.toMatch(/see the files|review/i);
    expect(featureInfo("office_sync")!.label).toMatch(/Gmail sends only/);
  });

  it("the trial opens templates and automations", () => {
    const trial = normalizePlan(planBody({ ...ACTIVE_TRIAL, features: {} }))!;
    expect(hasFeature("templates", trial)).toBe(true);
    expect(hasFeature("automations", trial)).toBe(true);
    expect(hasFeature("templates", starter()!)).toBe(false);
  });
});

describe("Settings tabs", () => {
  async function tabs(plan: ReturnType<typeof starter>) {
    __setPlanForTests(plan);
    const { default: SettingsPage } = await import("@/pages/settings/SettingsPage");
    render(
      <MemoryRouter initialEntries={["/settings/profile"]}>
        <Routes><Route path="/settings/:tab" element={<SettingsPage />} /></Routes>
      </MemoryRouter>,
    );
    return screen.getAllByRole("tab").map((t) => t.textContent);
  }

  it("Starter: no Templates or Snippets tab; Phone lines stays for Admins", async () => {
    const names = await tabs(starter());
    expect(names).not.toContain("Templates");
    expect(names).not.toContain("Snippets");
    expect(names).toContain("Phone lines");
  });

  it("Growth: Templates and Snippets are there", async () => {
    const names = await tabs(growth());
    expect(names).toContain("Templates");
    expect(names).toContain("Snippets");
  });
});

describe("Phone lines", () => {
  const overview = (over: Record<string, unknown> = {}) => ({
    ok: true,
    numbers: [{ id: "n1", phone_number: "+14035550111", kind: "main", status: "active", assigned_user_id: null, assigned_name: null, locality: "Calgary", region: "AB", release_after: null, release_reason: null, last_error: null }],
    limits: { main: 1, toll_free: 0, direct: 0 },
    allowed: { main: true, toll_free: false, direct: false },
    grace_days: 30,
    main_line: "+14035550111",
    setup: { ready: true, messages: ["Texting from a toll-free number needs toll-free verification in Twilio."] },
    ...over,
  });
  function route(over: Record<string, unknown> = {}) {
    h.get.mockImplementation(async (path: string) => {
      if (path === "/api/voice/direct-numbers") return { users: [{ id: "u1", name: "Sam Staff", email: "sam@acme.example", direct_number: null }] };
      if (path === "/api/phone-numbers") return overview(over);
      if (path === "/api/phone-numbers/available") return { numbers: [{ phone_number: "+14035550199", friendly_name: "(403) 555-0199", locality: "Calgary", region: "AB", iso_country: "CA", address_requirements: "none", needs_address: false }] };
      return {};
    });
  }

  it("Starter: the business line is listed, toll-free and direct lines are locked", async () => {
    __setPlanForTests(starter());
    route();
    renderWithRole(<PhoneLines />, "Admin");
    expect(await screen.findByText("+14035550111", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByTestId("feature-locked-toll_free_number")).toBeInTheDocument();
    expect(screen.getByTestId("feature-locked-multiple_lines")).toBeInTheDocument();
    expect(screen.queryByTestId("number-picker-main")).toBeNull(); // the one business line is in use
  });

  it("Pro: Get a number offers the brokerage's area code, shows numbers and one click buys it for the person", async () => {
    __setPlanForTests(normalizePlan(planBody({ plan: "pro", effective_plan: "pro", features: { multiple_lines: true, toll_free_number: true } })));
    route({ limits: { main: 5, toll_free: 2, direct: 3 }, used: { main: 1, toll_free: 0, direct: 0 }, allowed: { main: true, toll_free: true, direct: true }, default_search: { country: "CA", area_code: "403", region: "AB" } });
    h.post.mockResolvedValue({ ok: true });
    renderWithRole(<PhoneLines />, "Admin");
    const row = (await screen.findAllByTestId("phone-line"))[0]!;
    fireEvent.click(within(row).getByRole("button", { name: "Get a number" }));
    await waitFor(() => expect(h.get).toHaveBeenCalledWith("/api/phone-numbers/available", { params: expect.objectContaining({ kind: "direct", area_code: "403", region: "AB", country: "CA" }) }));
    expect((within(row).getByLabelText("Area code") as HTMLInputElement).value).toBe("403");
    fireEvent.click(await within(row).findByRole("button", { name: "Get this number" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/phone-numbers", expect.objectContaining({ kind: "direct", phone_number: "+14035550199", user_id: "u1" })));
    expect(screen.getByText(/0 of 3 \(Pro: one per seat\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Buy the number in Twilio/)).toBeNull();
  });

  it("a person's line can be changed (new number, old one waits out the grace period) or released after a confirm", async () => {
    __setPlanForTests(normalizePlan(planBody({ plan: "pro", effective_plan: "pro", features: { multiple_lines: true, toll_free_number: true } })));
    route({
      numbers: [{ id: "d1", phone_number: "+14035550150", kind: "direct", status: "active", assigned_user_id: "u1", assigned_name: "Sam Staff", locality: null, region: null, release_after: null, release_reason: null, last_error: null }],
      limits: { main: 5, toll_free: 2, direct: 3 }, used: { main: 0, toll_free: 0, direct: 1 }, allowed: { main: true, toll_free: true, direct: true },
    });
    h.post.mockResolvedValue({ ok: true });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithRole(<PhoneLines />, "Admin");
    const row = (await screen.findAllByTestId("phone-line"))[0]!;
    await within(row).findByText("+14035550150");
    fireEvent.click(within(row).getByRole("button", { name: "Release number" }));
    expect(confirm.mock.calls[0]?.[0]).toMatch(/30 days/);
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/phone-numbers/d1/release", {}));
    fireEvent.click(within(row).getByRole("button", { name: "Change number" }));
    fireEvent.click(await within(row).findByRole("button", { name: "Switch to this number" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/phone-numbers/d1/change", expect.objectContaining({ phone_number: "+14035550199" })));
    confirm.mockRestore();
  });

  it("a number that needs regulatory information says so instead of offering it", async () => {
    __setPlanForTests(growth());
    route({ numbers: [] , limits: { main: 1, toll_free: 1, direct: 0 }, used: { main: 0, toll_free: 0, direct: 0 }, allowed: { main: true, toll_free: true, direct: false } });
    h.get.mockImplementation(async (path: string) => {
      if (path === "/api/phone-numbers/available") return { numbers: [{ phone_number: "+14035550177", friendly_name: "(403) 555-0177", locality: null, region: "AB", iso_country: "CA", address_requirements: "local", needs_address: true }] };
      if (path === "/api/voice/direct-numbers") return { users: [] };
      return { ok: true, numbers: [], limits: { main: 1, toll_free: 1, direct: 0 }, used: { main: 0, toll_free: 0, direct: 0 }, allowed: { main: true, toll_free: true, direct: false }, grace_days: 30, main_line: null, setup: { ready: true, messages: [] } };
    });
    renderWithRole(<PhoneLines />, "Admin");
    fireEvent.click((await screen.findAllByRole("button", { name: "Get a number" }))[0]!);
    expect(await screen.findByText(/registered business address \(regulatory information\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Get this number" })).toBeNull();
  });

  it("a number waiting to be released shows its date and a Keep button", async () => {
    __setPlanForTests(growth());
    route({ numbers: [{ id: "n2", phone_number: "+18335550123", kind: "toll_free", status: "releasing", assigned_user_id: null, assigned_name: null, locality: null, region: null, release_after: "2026-12-01T12:00:00Z", release_reason: "an admin asked for it", last_error: null }] });
    h.post.mockResolvedValue({ ok: true });
    renderWithRole(<PhoneLines />, "Admin");
    expect(await screen.findByText(/Will be released on/)).toHaveTextContent("an admin asked for it");
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/phone-numbers/n2/keep", {}));
  });

  it("setup problems are shown in plain words", async () => {
    __setPlanForTests(growth());
    route({ setup: { ready: false, messages: ["Twilio is not connected: TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are not set on this server."] } });
    renderWithRole(<PhoneLines />, "Admin");
    expect(await screen.findByTestId("phone-setup")).toHaveTextContent("Twilio is not connected");
    expect(screen.queryByTestId("number-picker-main")).toBeNull();
  });
});

describe("Marketing tabs", () => {
  async function marketingTabs(plan: ReturnType<typeof starter>) {
    __setPlanForTests(plan);
    h.get.mockResolvedValue({});
    const { default: MarketingDashboard } = await import("@/pages/marketing/MarketingDashboard");
    renderWithRole(<MarketingDashboard />, "Admin");
    return screen.getAllByRole("button").map((b) => b.textContent ?? "");
  }
  it("Starter: no Automations tab", async () => {
    expect(await marketingTabs(starter())).not.toContain("Automations");
  });
  it("Growth: the Automations tab is there", async () => {
    expect(await marketingTabs(growth())).toContain("Automations");
  });
});
