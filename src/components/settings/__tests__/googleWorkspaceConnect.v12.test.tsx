// KS_PORTAL_v12_GOOGLE_WORKSPACE - Connect buttons per company setting (m365 default / google / both), the Google
// card's not-configured, connect, connected, disconnect and reconnect states, and the Company setting itself.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put }, default: { get: h.get, post: h.post, put: h.put } }));

import GoogleWorkspaceConnect, { WorkspaceConnections } from "../GoogleWorkspaceConnect";
import CompanySettings from "@/pages/settings/tabs/CompanySettings";
import { __resetBrandForTests, applyBrand } from "@/config/brand";
import { normalizeWorkspaceMode, showsGoogle, showsMicrosoft } from "@/lib/workspace";

const STATUS = {
  configured: true, configProblem: null, gmailReadEnabled: false, connected: false, status: "not_connected", email: null, scopes: [],
};
const setMode = (workspace_provider?: string) => act(() => { applyBrand({ company_name: "Northwind", ...(workspace_provider ? { workspace_provider } : {}) }); });

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  h.put.mockReset();
  try { localStorage.clear(); } catch { /* none */ }
  __resetBrandForTests();
  h.get.mockImplementation(async (url: string) => (url === "/api/google/status" ? STATUS : {}));
});
afterEach(() => vi.unstubAllGlobals());

const MS = <div data-testid="ms-slot"><button type="button">Connect Microsoft 365</button></div>;

describe("which Connect buttons staff see", () => {
  it("the company setting normalises to m365 by default", () => {
    expect(normalizeWorkspaceMode(undefined)).toBe("m365");
    expect(normalizeWorkspaceMode("GOOGLE")).toBe("google");
    expect(showsMicrosoft("m365") && !showsGoogle("m365")).toBe(true);
    expect(!showsMicrosoft("google") && showsGoogle("google")).toBe(true);
    expect(showsMicrosoft("both") && showsGoogle("both")).toBe(true);
  });

  it("Microsoft 365 only by default (today's behaviour)", () => {
    setMode();
    render(<WorkspaceConnections microsoft={MS} microsoftConnected={false} />);
    expect(screen.getByTestId("ms-slot")).toBeInTheDocument();
    expect(screen.queryByTestId("google-connect")).toBeNull();
  });

  it("Google Workspace only: no Microsoft button unless an old Microsoft connection needs disconnecting", async () => {
    setMode("google");
    const { rerender } = render(<WorkspaceConnections microsoft={MS} microsoftConnected={false} />);
    expect(screen.queryByTestId("ms-slot")).toBeNull();
    expect(await screen.findByTestId("google-connect-button")).toHaveTextContent("Connect Google");
    rerender(<WorkspaceConnections microsoft={MS} microsoftConnected />);
    expect(screen.getByTestId("ms-slot")).toBeInTheDocument();
  });

  it("Both: both buttons", async () => {
    setMode("both");
    render(<WorkspaceConnections microsoft={MS} microsoftConnected={false} />);
    expect(screen.getByTestId("ms-slot")).toBeInTheDocument();
    expect(await screen.findByTestId("google-connect")).toBeInTheDocument();
  });
});

describe("Connect Google card", () => {
  it("is disabled with a short explanation when Google is not set up on the server", async () => {
    h.get.mockImplementation(async () => ({ ...STATUS, configured: false, configProblem: "Google Workspace is not set up on this server yet (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET)." }));
    render(<GoogleWorkspaceConnect />);
    expect(await screen.findByTestId("google-not-configured")).toHaveTextContent("not set up on this server yet");
    expect(screen.getByTestId("google-connect-button")).toBeDisabled();
  });

  it("an older server without /api/google (404) counts as not set up, and nothing breaks", async () => {
    h.get.mockRejectedValue(Object.assign(new Error("Not found"), { status: 404 }));
    render(<GoogleWorkspaceConnect />);
    expect(await screen.findByTestId("google-not-configured")).toBeInTheDocument();
    expect(screen.getByTestId("google-connect-button")).toBeDisabled();
  });

  it("Connect goes to the consent URL the server returns", async () => {
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { href: "http://localhost/settings/profile" } });
    h.get.mockImplementation(async (url: string) => (url === "/api/google/status" ? STATUS : { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" }));
    render(<GoogleWorkspaceConnect />);
    const btn = await screen.findByTestId("google-connect-button");
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    await waitFor(() => expect(h.get).toHaveBeenCalledWith("/api/google/oauth/start"));
    await waitFor(() => expect(window.location.href).toBe("https://accounts.google.com/o/oauth2/v2/auth?x=1"));
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("connected: shows the address and Disconnect revokes on the server", async () => {
    let connected = true;
    h.get.mockImplementation(async () => (connected ? { ...STATUS, connected: true, status: "connected", email: "pat@northwind.example" } : STATUS));
    h.post.mockImplementation(async () => { connected = false; return { ok: true, connected: false, revoked: true }; });
    render(<GoogleWorkspaceConnect />);
    expect(await screen.findByTestId("google-connect-button")).toHaveTextContent("Connected: pat@northwind.example");
    fireEvent.click(screen.getByTestId("google-disconnect-button"));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/google/oauth/disconnect", {}));
    await waitFor(() => expect(screen.getByTestId("google-connect-button")).toHaveTextContent("Connect Google"));
    expect(screen.getByRole("status")).toHaveTextContent("Google account disconnected.");
    expect(screen.queryByTestId("google-disconnect-button")).toBeNull();
  });

  it("asks to reconnect when Google revoked or expired the connection", async () => {
    h.get.mockImplementation(async () => ({ ...STATUS, status: "reauth_required" }));
    render(<GoogleWorkspaceConnect />);
    expect(await screen.findByTestId("google-reconnect")).toBeInTheDocument();
    expect(screen.getByTestId("google-connect-button")).toHaveTextContent("Reconnect Google");
    expect(screen.getByTestId("google-connect-button")).not.toBeDisabled();
  });
});

describe("Company setting", () => {
  it("an Admin chooses Google Workspace; only that field is sent", async () => {
    h.get.mockResolvedValueOnce({ ok: true, licensee: { company_name: "Northwind", workspace_provider: "m365" } });
    h.put.mockResolvedValueOnce({ ok: true, licensee: { company_name: "Northwind", workspace_provider: "google" } });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, licensee: { company_name: "Northwind", workspace_provider: "google" } }) })));
    renderWithRole(<CompanySettings />, "Admin");
    const select = (await screen.findByLabelText("Email, calendar and files")) as HTMLSelectElement;
    expect(select.value).toBe("m365");
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(["Microsoft 365", "Google Workspace", "Both (each person chooses)"]);
    fireEvent.change(select, { target: { value: "google" } });
    fireEvent.click(screen.getByText("Save company details"));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/licensee", { workspace_provider: "google" }));
  });
});
