// KS_PORTAL_v6_SUPPORT - Get help: send a request, see the company's requests with their status.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post } }));

import HelpPage from "../HelpPage";

const existing = { id: "t1", subject: "Calls drop", priority: "normal", status: "resolved", created_at: "2026-10-01T12:00:00Z" };

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
});

describe("Get help", () => {
  it("lists the company's requests with their status", async () => {
    h.get.mockResolvedValue({ tickets: [existing] });
    renderWithRole(<HelpPage />, "Staff");
    expect(await screen.findByTestId("ticket-t1")).toHaveTextContent("Calls drop");
    expect(screen.getByTestId("ticket-t1")).toHaveTextContent("Resolved");
    expect(h.get).toHaveBeenCalledWith("/api/support/tickets");
  });

  it("sends subject, body and priority, then shows the new request and says we reply by email", async () => {
    h.get.mockResolvedValueOnce({ tickets: [] });
    h.post.mockResolvedValueOnce({ ok: true, ticket: { id: "t2", subject: "Cannot log in", priority: "urgent", status: "open", created_at: "2026-10-22T09:00:00Z" } });
    h.get.mockResolvedValueOnce({ tickets: [{ id: "t2", subject: "Cannot log in", priority: "urgent", status: "open", created_at: "2026-10-22T09:00:00Z" }] });
    renderWithRole(<HelpPage />, "Admin");
    await screen.findByText("No requests yet.");
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Cannot log in" } });
    fireEvent.change(screen.getByLabelText("What do you need help with?"), { target: { value: "The code never arrives." } });
    fireEvent.click(screen.getByLabelText(/Urgent/));
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(/We'll reply by email\./)).toBeInTheDocument();
    expect(h.post).toHaveBeenCalledWith("/api/support/tickets", { subject: "Cannot log in", body: "The code never arrives.", priority: "urgent" });
    await waitFor(() => expect(screen.getByTestId("ticket-t2")).toHaveTextContent("Open"));
    expect((screen.getByLabelText("Subject") as HTMLInputElement).value).toBe("");
  });

  it("asks for a subject and details before sending", async () => {
    h.get.mockResolvedValueOnce({ tickets: [] });
    renderWithRole(<HelpPage />, "Staff");
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please add a subject");
    expect(h.post).not.toHaveBeenCalled();
  });

  it("hides the request list when the server has no tickets endpoint", async () => {
    h.get.mockRejectedValueOnce(Object.assign(new Error("Not found"), { status: 404 }));
    renderWithRole(<HelpPage />, "Staff");
    await waitFor(() => expect(h.get).toHaveBeenCalled());
    expect(screen.queryByTestId("help-tickets")).toBeNull();
    expect(screen.getByRole("button", { name: "Send request" })).toBeInTheDocument();
  });

  // KS_PORTAL_v17_TICKET_REPLIES
  it("sends a follow-up reply on a request to POST /api/support/tickets/:id/messages", async () => {
    h.get.mockResolvedValue({ tickets: [existing] });
    h.post.mockResolvedValueOnce({ ok: true, message: { id: "m1" }, relayed: true });
    renderWithRole(<HelpPage />, "Staff");
    await screen.findByTestId("ticket-t1");
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Write your reply first.");
    expect(h.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Your reply on/), { target: { value: "Still dropping today." } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    expect(await screen.findByText(/Reply sent\./)).toBeInTheDocument();
    expect(h.post).toHaveBeenCalledWith("/api/support/tickets/t1/messages", { body: "Still dropping today." });
  });

  it("shows an error when the reply cannot be sent", async () => {
    h.get.mockResolvedValue({ tickets: [existing] });
    h.post.mockRejectedValueOnce(Object.assign(new Error("Not found"), { status: 404 }));
    renderWithRole(<HelpPage />, "Admin");
    await screen.findByTestId("ticket-t1");
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    fireEvent.change(screen.getByLabelText(/Your reply on/), { target: { value: "Hello?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Replies are not available yet");
  });
});
