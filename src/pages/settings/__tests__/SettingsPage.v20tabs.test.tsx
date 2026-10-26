// KS_PORTAL_v20 - Settings has Properties (every plan), Teams (growth+) and Webhooks (pro) tabs for Admins only; on a
// plan without the feature the tab shows the locked card instead of its content.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { render, screen } from "@testing-library/react";

const useAuthMock = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => useAuthMock() }));
vi.mock("@/hooks/useSilo", () => ({ useSilo: () => ({ silo: "BF" }) }));
vi.mock("@/components/auth/RequireRole", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/system/ErrorBoundary", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/features/ai/KnowledgeManager", () => ({ default: () => null }));
vi.mock("@/features/ai/MayaTuning", () => ({ default: () => null }));
vi.mock("../components/SettingsSectionLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../tabs/ProfileSettings", () => ({ default: () => <div data-testid="profile-mock" /> }));
vi.mock("@/crmFields/PropertiesSettings", () => ({ default: () => <div data-testid="properties-mock" /> }));
vi.mock("@/teams/TeamsSettings", () => ({ default: () => <div data-testid="teams-mock" /> }));
vi.mock("@/webhooks/WebhooksSettings", () => ({ default: () => <div data-testid="webhooks-mock" /> }));

import SettingsPage from "../SettingsPage";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";
import { planBody } from "@/plans/__tests__/fixtures";

function open(tab: string, role: string) {
  useAuthMock.mockReturnValue({ user: { role } });
  return render(
    <MemoryRouter initialEntries={[`/settings/${tab}`]}>
      <Routes><Route path="/settings/:tab" element={<SettingsPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  __setPlanForTests(normalizePlan(planBody({ plan: "starter", features: { custom_fields: true, teams: false, webhooks: false } })));
});

describe("Settings: Properties, Teams and Webhooks tabs", () => {
  it("Admins see the three tabs; Properties works on every plan", () => {
    open("properties", "Admin");
    expect(screen.getByRole("tab", { name: /^Properties/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Teams/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Webhooks/ })).toBeInTheDocument();
    expect(screen.getByTestId("properties-mock")).toBeInTheDocument();
  });

  it("Teams and Webhooks are locked on Starter", () => {
    open("webhooks", "Admin");
    expect(screen.queryByTestId("webhooks-mock")).toBeNull();
    expect(screen.getAllByText(/Webhooks and Zapier/).length).toBeGreaterThan(0);
  });

  it("are unlocked on Pro", () => {
    __setPlanForTests(normalizePlan(planBody({ plan: "pro", effective_plan: "pro", features: { custom_fields: true, teams: true, webhooks: true } })));
    open("teams", "Admin");
    expect(screen.getByTestId("teams-mock")).toBeInTheDocument();
  });

  it("Staff do not see them", () => {
    open("profile", "Staff");
    expect(screen.queryByRole("tab", { name: /^Properties/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /^Webhooks/ })).toBeNull();
  });
});
