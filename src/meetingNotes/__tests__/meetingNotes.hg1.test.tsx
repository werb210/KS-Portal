// KS_HUBSPOT_GAPS_1_MEETING_NOTES - Settings > Meeting notes: Zoom connection, Google Meet state, sync and filing.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), contacts: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put } }));
vi.mock("@/api/crm", () => ({ crmApi: { listContacts: h.contacts } }));

import MeetingNotesSettings from "../MeetingNotesSettings";

const status = (over: Record<string, unknown> = {}) => ({
  zoom: { problem: null, connected: true, status: "connected", email: "sam@zoom.test", last_synced_at: null, last_error: null },
  google_meet: { enabled: true, problem: null, connected: true, email: "sam@broker.test", has_scope: false },
  ...over,
});
const meetings = [
  { id: "m1", provider: "zoom", provider_label: "Zoom", subject: "Acme renewal", started_at: "2026-10-25T15:00:00Z", contact_id: "c1", contact_name: "Pat Acme", maya_summary: "Agreed to send statements.", recording_url: null },
  { id: "m2", provider: "google_meet", provider_label: "Google Meet", subject: "Unknown", started_at: "2026-10-25T17:00:00Z", contact_id: null, contact_name: null, maya_summary: null, recording_url: null },
];

beforeEach(() => {
  h.get.mockReset(); h.post.mockReset(); h.put.mockReset();
  h.contacts.mockResolvedValue([{ id: "c7", name: "Lee Lender", email: "lee@x.test" }]);
  h.get.mockImplementation(async (url: string) => {
    if (url.includes("/status")) return status();
    if (url.includes("/meetings")) return { meetings };
    return {};
  });
});

const view = (path = "/settings/meeting-notes") => render(<MemoryRouter initialEntries={[path]}><MeetingNotesSettings /></MemoryRouter>);

describe("Settings > Meeting notes", () => {
  it("shows the Zoom account, asks to reconnect Google for Meet access, and lists meetings", async () => {
    view("/settings/meeting-notes?zoom=connected");
    expect(await screen.findByText(/Zoom is connected/)).toBeInTheDocument();
    expect(await screen.findByTestId("zoom-status")).toHaveTextContent("Connected as sam@zoom.test");
    expect(screen.getByTestId("meet-status")).toHaveTextContent("Reconnect Google in My Profile and allow access to your Meet conferences.");
    const m1 = await screen.findByTestId("meeting-m1");
    expect(within(m1).getByText("Agreed to send statements.")).toBeInTheDocument();
    expect(within(m1).getByRole("link", { name: "Pat Acme" })).toHaveAttribute("href", "/crm/contacts/c1");
  });

  it("files an unmatched meeting under a contact", async () => {
    h.put.mockResolvedValue({ ok: true });
    view();
    const m2 = await screen.findByTestId("meeting-m2");
    fireEvent.click(within(m2).getByRole("button", { name: "File under a contact" }));
    fireEvent.change(within(m2).getByLabelText("Find a contact"), { target: { value: "Lee" } });
    fireEvent.click(await within(m2).findByRole("button", { name: "Lee Lender (lee@x.test)" }));
    expect(h.contacts).toHaveBeenCalledWith({ q: "Lee", limit: 8 });
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/meeting-notes/meetings/m2/contact", { contact_id: "c7" }));
    expect(await screen.findByText("Filed under Lee Lender.")).toBeInTheDocument();
  });

  it("checks for new meetings and connects Zoom", async () => {
    h.get.mockImplementation(async (url: string) => (url.includes("/status") ? status({ zoom: { problem: null, connected: false, status: "disconnected", email: null, last_synced_at: null, last_error: null } }) : { meetings: [] }));
    h.post.mockImplementation(async (url: string) => (url.endsWith("/sync") ? { imported: { zoom: 2, google_meet: 1 } } : { url: "https://zoom.us/oauth/authorize?x=1" }));
    const assign = vi.fn();
    Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
    view();
    fireEvent.click(await screen.findByRole("button", { name: "Check for new meetings now" }));
    expect(await screen.findByText("3 new meetings brought in. Summaries appear in a few minutes.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Connect Zoom" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://zoom.us/oauth/authorize?x=1"));
  });
});
