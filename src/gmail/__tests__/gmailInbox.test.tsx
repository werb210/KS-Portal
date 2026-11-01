// KS_PORTAL_GMAIL_INBOX - the Gmail inbox view (threads, a thread, Save to CRM, Sync now) and the reconnect prompt.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post } }));

import GmailInbox from "../GmailInbox";

const status = (granted: boolean) => ({ enabled: true, connected: true, granted, message: granted ? null : "Reconnect Google in My Profile and allow Keystone to read your inbox.", last_synced_at: null, first_sync_done: false, last_error: null });

beforeEach(() => { h.get.mockReset(); h.post.mockReset(); });

describe("Communications > Gmail", () => {
  it("asks a person who has not allowed reading to reconnect", async () => {
    h.get.mockResolvedValue(status(false));
    render(<GmailInbox />);
    expect(await screen.findByTestId("gmail-reconnect")).toHaveTextContent("Reconnect Google in My Profile");
  });

  it("lists threads, opens one, saves an attachment to the CRM and syncs", async () => {
    h.get.mockImplementation(async (path: string) => {
      if (path.endsWith("/status")) return status(true);
      if (path.endsWith("/threads")) return { threads: [{ id: "t1", subject: "Bank statements", from: "Client", date: "2026-10-30T12:00:00Z", snippet: "Attached", messages: 1, unread: true }], nextPageToken: null };
      return {
        id: "t1",
        contacts: [{ id: "c1", name: "Client Co", email: "client@acme.example" }],
        messages: [{ id: "m1", threadId: "t1", subject: "Bank statements", from: "Client <client@acme.example>", fromAddress: "client@acme.example", to: [], cc: [], date: null, snippet: "", unread: true, bodyHtml: "<p>Here you go</p><script>alert(1)</script>", logged: true, attachments: [{ id: "0", name: "march.pdf", contentType: "application/pdf", size: 10 }] }],
      };
    });
    h.post.mockImplementation(async (path: string) => (path.endsWith("/sync") ? { mode: "incremental", inbound: 2, outbound: 0 } : { filed: 1, contactId: "c1" }));
    render(<GmailInbox />);
    fireEvent.click(await screen.findByText("Bank statements"));
    expect(await screen.findByText("Here you go")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText("Client Co")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save march.pdf to the CRM" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/google/gmail/messages/m1/file-to-crm", { attachment: 0 }));
    expect(await screen.findByText("1 file saved to the contact's documents.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    expect(await screen.findByText(/Synced: 2 from clients/)).toBeInTheDocument();
  });
});
