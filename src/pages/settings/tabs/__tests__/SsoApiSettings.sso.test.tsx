// KS_PORTAL_SSO_API_KEYS - Settings > Single sign-on and Settings > API: Admin only; providers not set up on the server
// can't be switched on; saving sends the settings; API keys are listed, a new key is shown once, and revoking asks
// first; the docs list the endpoints and the OpenAPI address; both tabs are locked below Pro.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), del: vi.fn(), role: "Admin" as string }));
vi.mock("@/api", () => ({ api: { get: h.get, put: h.put, post: h.post, delete: h.del } }));
vi.mock("@/config/api", () => ({ API_BASE: "https://server.test" }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", role: h.role } }) }));
vi.mock("@/hooks/useSilo", () => ({ useSilo: () => ({ silo: "BF" }) }));

import SsoSettings from "../SsoSettings";
import ApiSettings, { ApiDocs } from "../ApiSettings";
import SettingsPage from "../../SettingsPage";
import { __setPlanForTests, fallbackPlan } from "@/plans/planStore";

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={qc}>{ui}</QueryClientProvider></MemoryRouter>);
}

const SSO_BODY = {
  ok: true,
  settings: { microsoft_enabled: false, google_enabled: true, microsoft_tenant_id: "", google_hosted_domain: "acme.com", require_sso: false },
  providers: {
    microsoft: { configured: false, enabled: false, available: false, redirect_uri: null },
    google: { configured: true, enabled: true, available: true, redirect_uri: "https://server.test/api/auth/sso/google/callback" },
  },
  require_sso_active: false,
};

const KEY = { id: "k1", name: "Zapier", scope: "read", key_prefix: "ks_live_0a1b2c3d", created_by: "u1", created_at: "2026-10-01T10:00:00Z", last_used_at: null, revoked_at: null };

beforeEach(() => {
  h.get.mockReset(); h.put.mockReset(); h.post.mockReset(); h.del.mockReset();
  h.role = "Admin";
  __setPlanForTests(null);
});
afterEach(() => { vi.unstubAllGlobals(); __setPlanForTests(null); });

describe("Single sign-on tab", () => {
  it("shows nothing to Staff and never loads the settings", () => {
    h.role = "Staff";
    const { container } = wrap(<SsoSettings />);
    expect(container).toBeEmptyDOMElement();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("a provider not set up on the server can't be switched on; the redirect address is shown for the one that is", async () => {
    h.get.mockResolvedValueOnce(SSO_BODY);
    wrap(<SsoSettings />);
    const ms = await screen.findByTestId("sso-section-microsoft");
    expect(within(ms).getByRole("checkbox")).toBeDisabled();
    expect(within(ms).getByText(/isn.t set up on this server yet/i)).toBeInTheDocument();
    const g = screen.getByTestId("sso-section-google");
    expect(within(g).getByRole("checkbox")).toBeChecked();
    expect(within(g).getByText("https://server.test/api/auth/sso/google/callback")).toBeInTheDocument();
  });

  it("saves the form, including the domain restriction and the require switch", async () => {
    h.get.mockResolvedValueOnce(SSO_BODY);
    h.put.mockImplementationOnce(async (_p: string, body: any) => ({ ...SSO_BODY, settings: body }));
    wrap(<SsoSettings />);
    const domain = await screen.findByLabelText(/only allow this google workspace domain/i);
    fireEvent.change(domain, { target: { value: "northwind.com" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /staff must sign in with microsoft or google/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save single sign-on settings" }));
    await waitFor(() => expect(h.put).toHaveBeenCalled());
    expect(h.put).toHaveBeenCalledWith("/api/sso-settings", expect.objectContaining({ google_enabled: true, google_hosted_domain: "northwind.com", require_sso: true }));
    expect(await screen.findByText("Single sign-on settings saved.")).toBeInTheDocument();
  });

  it("shows the server's refusal", async () => {
    h.get.mockResolvedValueOnce(SSO_BODY);
    h.put.mockRejectedValueOnce(new Error("The Google domain must look like yourcompany.com."));
    wrap(<SsoSettings />);
    fireEvent.click(await screen.findByRole("button", { name: "Save single sign-on settings" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The Google domain must look like yourcompany.com.");
  });
});

describe("API tab", () => {
  it("lists keys with their access and last use, and never shows a stored secret", async () => {
    h.get.mockResolvedValueOnce({ keys: [KEY, { ...KEY, id: "k2", name: "Old", scope: "read_write", revoked_at: "2026-10-02T10:00:00Z" }] });
    wrap(<ApiSettings />);
    const row = await screen.findByTestId("api-key-row-k1");
    expect(within(row).getByText("Zapier")).toBeInTheDocument();
    expect(within(row).getByText("ks_live_0a1b2c3d…")).toBeInTheDocument();
    expect(within(row).getByText("Read only")).toBeInTheDocument();
    expect(within(row).getByText("Never")).toBeInTheDocument();
    expect(within(screen.getByTestId("api-key-row-k2")).getByText(/^Revoked/)).toBeInTheDocument();
    expect(h.get).toHaveBeenCalledWith("/api/api-keys");
  });

  it("creates a key with a name and scope and shows it once", async () => {
    h.get.mockResolvedValue({ keys: [] });
    h.post.mockResolvedValueOnce({ key: { ...KEY, name: "Sync", scope: "read_write" }, secret: "ks_live_0a1b2c3d0a1b2c3d0a1b2c3d0a1b2c3d_secretpart" });
    wrap(<ApiSettings />);
    fireEvent.change(await screen.findByLabelText("Key name"), { target: { value: "Sync" } });
    fireEvent.change(screen.getByLabelText("Access"), { target: { value: "read_write" } });
    fireEvent.click(screen.getByRole("button", { name: "Create key" }));
    const secret = await screen.findByTestId("api-key-secret");
    expect(secret).toHaveTextContent("ks_live_0a1b2c3d0a1b2c3d0a1b2c3d0a1b2c3d_secretpart");
    expect(secret).toHaveTextContent(/won.t see this key again/i);
    expect(h.post).toHaveBeenCalledWith("/api/api-keys", { name: "Sync", scope: "read_write" });
    fireEvent.click(within(secret).getByRole("button", { name: /saved it/i }));
    expect(screen.queryByTestId("api-key-secret")).toBeNull();
  });

  it("revokes after confirming", async () => {
    h.get.mockResolvedValue({ keys: [KEY] });
    h.del.mockResolvedValueOnce({ key: { ...KEY, revoked_at: "2026-10-03T00:00:00Z" } });
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    wrap(<ApiSettings />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke Zapier" }));
    await waitFor(() => expect(h.del).toHaveBeenCalledWith("/api/api-keys/k1"));
    expect(confirm).toHaveBeenCalled();
  });

  it("docs: every endpoint, the auth header and the OpenAPI address", () => {
    render(<ApiDocs base="https://server.test/api/open/v1" />);
    expect(screen.getByRole("link", { name: "https://server.test/api/open/v1/openapi.json" })).toHaveAttribute("href", "https://server.test/api/open/v1/openapi.json");
    for (const p of ["/contacts", "/companies/{id}", "/applications/{id}/stage", "/applications/{id}/notes", "/lenders"]) {
      expect(screen.getAllByText(p).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText(/Authorization: Bearer/).length).toBeGreaterThan(0);
  });
});

describe("Settings page gating", () => {
  function renderTab(tab: string) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/settings/${tab}`]}>
          <Routes><Route path="/settings/:tab" element={<SettingsPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("below Pro both tabs show the locked card instead of the settings", async () => {
    __setPlanForTests({ ...fallbackPlan(), source: "server", plan: "growth", effective_plan: "growth", features: { sso: false, api_access: false } });
    renderTab("sso");
    expect(await screen.findByTestId("feature-locked-sso")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^API/ })).toBeInTheDocument();
    expect(h.get).not.toHaveBeenCalledWith("/api/sso-settings");
  });

  it("on Pro the Single sign-on tab loads its settings", async () => {
    __setPlanForTests({ ...fallbackPlan(), source: "server", plan: "pro", effective_plan: "pro", features: { sso: true, api_access: true } });
    h.get.mockResolvedValue(SSO_BODY);
    renderTab("sso");
    expect(await screen.findByTestId("sso-settings")).toBeInTheDocument();
  });
});
