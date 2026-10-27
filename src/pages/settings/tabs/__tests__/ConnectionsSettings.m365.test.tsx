// KS_PORTAL_M365_ONE_CLICK - Settings > Connections: an Admin connects Microsoft 365 for the company in one click
// (Microsoft's approval page), a person who is not a Microsoft 365 admin gets a link to copy for theirs, a revoked
// consent shows with Reconnect, disconnect asks first, the shared mailbox saves, and Google's status shows. All text
// is plain English; nothing asks the company to register an app or type a tenant id.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), role: "Admin" as string }));
vi.mock("@/api", () => { const api = { get: h.get, put: h.put, post: h.post }; return { api, default: api }; });
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", role: h.role } }) }));
vi.mock("@/hooks/useSilo", () => ({ useSilo: () => ({ silo: "BF" }) }));

import ConnectionsSettings from "../ConnectionsSettings";
import SettingsPage from "../../SettingsPage";
import { consentOutcome } from "@/lib/connections";
import type { Connections } from "@/lib/connections";

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MemoryRouter><QueryClientProvider client={qc}>{ui}</QueryClientProvider></MemoryRouter>);
}

const APP_PERMS = [
  { name: "User.Read.All", why: "find a staff member's or shared mailbox's Microsoft account", granted: null },
  { name: "Mail.Send", why: "send lender packages and notices from the shared mailbox", granted: null },
];

function body(over: Partial<Connections["microsoft"]> = {}, google: Partial<Connections["google"]> = {}): Connections {
  return {
    broker: true,
    microsoft: {
      available: true, app: "keystone", state: "not_connected", headline: "Microsoft 365 is not connected.",
      fix: "A Microsoft 365 administrator clicks Connect Microsoft 365 and approves Keystone once for the whole company.",
      tenant_id: null, tenant_source: "none", domain: null, connected_by: null, connected_at: null, via: null,
      permissions: { application: APP_PERMS, delegated: [{ name: "Mail.ReadWrite", label: "read and organise your mail" }] },
      staff_connected: 0, send_as: null, last_sync_at: null, checked_at: null, ...over,
    },
    google: {
      available: true, app: "keystone", state: "not_connected", headline: "Nobody has connected Google yet.",
      fix: "Each person clicks Connect Google in My Profile and approves once. No setup is needed first.",
      domains: [], staff_connected: 0, staff_needing_reconnect: 0, first_connected_at: null,
      permissions: [{ name: "https://www.googleapis.com/auth/gmail.send", label: "send email from Gmail" }], gmail_reading: false, last_sync_at: null, ...google,
    },
  };
}

const connected = (over: Partial<Connections["microsoft"]> = {}) => body({
  state: "connected", headline: "Connected to prairie.example by Dana Smith (dana@prairie.example) on 2026-10-26.", fix: null,
  tenant_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", tenant_source: "connected", domain: "prairie.example",
  connected_by: "Dana Smith (dana@prairie.example)", connected_at: "2026-10-26T12:00:00.000Z", via: "button",
  permissions: { application: APP_PERMS.map((p) => ({ ...p, granted: true })), delegated: [] },
  staff_connected: 3, last_sync_at: "2026-10-26T13:00:00.000Z", checked_at: "2026-10-26T13:05:00.000Z", ...over,
});

const assign = vi.fn();
beforeEach(() => {
  h.get.mockReset(); h.put.mockReset(); h.post.mockReset();
  h.role = "Admin";
  assign.mockReset();
  vi.stubGlobal("location", { ...window.location, assign, href: "https://portal.test/settings/connections", search: "", pathname: "/settings/connections", hash: "" });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("Settings > Connections", () => {
  it("not connected: one button opens Microsoft's approval page; nothing to register or type", async () => {
    h.get.mockImplementation(async (path: string) => (path.startsWith("/api/connections/status") ? body() : { url: "https://login.microsoftonline.com/organizations/v2.0/adminconsent?client_id=x" }));
    wrap(<ConnectionsSettings />);
    const ms = await screen.findByTestId("connections-microsoft");
    expect(within(ms).getByText("Microsoft 365 is not connected.")).toBeInTheDocument();
    expect(ms.textContent).not.toMatch(/Azure|app registration|tenant id/i);
    fireEvent.click(within(ms).getByTestId("m365-connect"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://login.microsoftonline.com/organizations/v2.0/adminconsent?client_id=x"));
    expect(h.get).toHaveBeenCalledWith("/api/o365-oauth/admin-consent/start");
  });

  it("connected: who, when, which permissions and the last successful sync", async () => {
    h.get.mockResolvedValue(connected());
    wrap(<ConnectionsSettings />);
    const ms = await screen.findByTestId("connections-microsoft");
    expect(within(ms).getByTestId("m365-headline")).toHaveTextContent("Connected to prairie.example by Dana Smith (dana@prairie.example) on 2026-10-26.");
    expect(within(ms).getByText("Connected by")).toBeInTheDocument();
    expect(within(ms).getByText("Last successful sync")).toBeInTheDocument();
    expect(within(ms).getByText("3")).toBeInTheDocument();
    expect(within(ms).getByTestId("m365-app-permissions")).toHaveTextContent("send lender packages and notices from the shared mailbox (Mail.Send) - granted");
    expect(within(ms).queryByTestId("m365-connect")).not.toBeInTheDocument();
    expect(within(ms).getByTestId("m365-disconnect")).toBeInTheDocument();
  });

  it("revoked later: says so, with Reconnect and the admin link", async () => {
    h.get.mockResolvedValue(connected({ state: "revoked", headline: "Microsoft 365 stopped accepting Keystone in prairie.example.", fix: "Keystone was removed from your Microsoft 365, or its permission was taken back. A Microsoft 365 administrator clicks Reconnect and approves again." }));
    wrap(<ConnectionsSettings />);
    const ms = await screen.findByTestId("connections-microsoft");
    expect(within(ms).getByText("Not working")).toBeInTheDocument();
    expect(within(ms).getByTestId("m365-fix")).toHaveTextContent(/approves again/);
    expect(within(ms).getByTestId("m365-connect")).toHaveTextContent("Reconnect Microsoft 365");
    expect(within(ms).getByTestId("m365-admin-link")).toBeInTheDocument();
  });

  it("not a Microsoft 365 admin: 'ask your Microsoft 365 admin' and a link they can copy", async () => {
    vi.stubGlobal("location", { ...window.location, assign, href: "https://portal.test/settings/connections?m365=needs_admin", search: "?m365=needs_admin", pathname: "/settings/connections", hash: "" });
    h.get.mockResolvedValue(body());
    h.post.mockResolvedValue({ url: "https://login.microsoftonline.com/organizations/v2.0/adminconsent?state=link", expires_at: "2026-11-02T12:00:00.000Z" });
    wrap(<ConnectionsSettings />);
    const ms = await screen.findByTestId("connections-microsoft");
    expect(within(ms).getByTestId("m365-message")).toHaveTextContent("Ask your Microsoft 365 admin");
    fireEvent.click(within(ms).getByRole("button", { name: /get a link for your admin/i }));
    const box = await within(ms).findByLabelText(/send this link to your microsoft 365 admin/i);
    expect(box).toHaveValue("https://login.microsoftonline.com/organizations/v2.0/adminconsent?state=link");
    expect(h.post).toHaveBeenCalledWith("/api/o365-oauth/admin-consent/link", {});
  });

  it("disconnect asks first, then reports who was signed out", async () => {
    h.get.mockResolvedValueOnce(connected()).mockResolvedValue(body());
    h.post.mockResolvedValue({ ok: true, users_signed_out: 3 });
    vi.stubGlobal("confirm", vi.fn(() => true));
    wrap(<ConnectionsSettings />);
    fireEvent.click(await screen.findByTestId("m365-disconnect"));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/o365-oauth/admin-consent/disconnect", {}));
    expect(await screen.findByText(/3 people were signed out/)).toBeInTheDocument();
  });

  it("saves the shared mailbox lender packages go out from", async () => {
    h.get.mockResolvedValue(connected());
    h.put.mockResolvedValue({});
    wrap(<ConnectionsSettings />);
    fireEvent.change(await screen.findByLabelText(/shared mailbox for lender packages/i), { target: { value: "submissions@prairie.example" } });
    fireEvent.click(screen.getByRole("button", { name: "Save mailbox" }));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/licensee", { office365_send_as: "submissions@prairie.example" }));
  });

  it("Google: plain status; Gmail reading stays off", async () => {
    h.get.mockResolvedValue(body({}, { state: "connected", headline: "2 people are connected to prairie.example.", fix: null, staff_connected: 2, domains: ["prairie.example"] }));
    wrap(<ConnectionsSettings />);
    const g = await screen.findByTestId("connections-google");
    expect(within(g).getByTestId("google-headline")).toHaveTextContent("2 people are connected to prairie.example.");
    expect(within(g).getByText(/does not read the inbox yet/)).toBeInTheDocument();
  });

  it("is an Admin-only tab", () => {
    h.role = "Staff";
    h.get.mockResolvedValue({});
    wrap(<SettingsPage />);
    expect(screen.queryByRole("tab", { name: "Connections" })).not.toBeInTheDocument();
  });

  it("reads the outcome Microsoft sent back", () => {
    expect(consentOutcome("?m365=connected")?.ok).toBe(true);
    expect(consentOutcome("?m365=declined")?.text).toMatch(/cancelled/);
    expect(consentOutcome("?m365=state")?.text).toMatch(/expired/);
    expect(consentOutcome("?other=1")).toBeNull();
  });
});
