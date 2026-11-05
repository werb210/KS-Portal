// HubSpot gaps batch 2 (portal): notification settings, email types, landing pages, Facebook lead ads, WhatsApp.
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const get = vi.fn(), put = vi.fn(), post = vi.fn(), patch = vi.fn(), del = vi.fn();
vi.mock("@/api", () => ({ api: { get: (...a: unknown[]) => get(...a), put: (...a: unknown[]) => put(...a), post: (...a: unknown[]) => post(...a), patch: (...a: unknown[]) => patch(...a), delete: (...a: unknown[]) => del(...a) } }));

import NotificationSettings from "../NotificationSettings";
import EmailTypesPanel from "../EmailTypesPanel";
import LandingPagesPanel, { moveBlock, newBlock } from "../LandingPagesPanel";
import { metaOutcome } from "../MetaLeadAdsCard";
import WhatsAppBar, { fillTemplate } from "../WhatsAppBar";

beforeEach(() => { [get, put, post, patch, del].forEach((f) => f.mockReset()); });

describe("notification settings", () => {
  it("saves a turned-off channel and keeps locked ones on", async () => {
    get.mockResolvedValue({ channels: ["bell", "push", "text"], topics: [
      { key: "tasks", label: "Tasks and reminders", description: "", locked: [] },
      { key: "security", label: "Security alerts", description: "", locked: ["bell"] },
    ], settings: [{ topic: "tasks", bell: true, push: true, text: true }, { topic: "security", bell: true, push: true, text: true }] });
    put.mockImplementation(async (_u: string, b: any) => ({ settings: b.settings }));
    render(<NotificationSettings />);
    const textBox = await screen.findByLabelText("Tasks and reminders: Text message");
    fireEvent.click(textBox);
    expect((screen.getByLabelText("Security alerts: In the portal") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByText("Save notification settings"));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect((put.mock.calls[0] as any[])[1].settings[0]).toEqual({ topic: "tasks", bell: true, push: true, text: false });
    expect(await screen.findByText("Notification settings saved.")).toBeTruthy();
  });
});

describe("email types", () => {
  it("lists types with their opt-out counts and adds one", async () => {
    get.mockResolvedValue({ types: [{ id: "t1", name: "Newsletter", description: "News", active: true, sort_order: 1, opted_out: 3 }] });
    post.mockResolvedValue({ type: {} });
    render(<EmailTypesPanel />);
    expect(await screen.findByText("3 people")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Rate alerts" } });
    fireEvent.click(screen.getByText("Add type"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/marketing/subscription-types", { name: "Rate alerts", description: "" }));
  });
});

describe("landing pages", () => {
  it("moves blocks and starts new pages with a headline and a form", async () => {
    const a = newBlock("hero"), b = newBlock("text");
    expect(moveBlock([a, b], 1, -1)).toEqual([b, a]);
    expect(moveBlock([a, b], 0, -1)).toEqual([a, b]);
    get.mockImplementation(async (u: string) => (u.includes("landing-pages") ? { pages: [] } : { forms: [{ id: "f1", name: "Apply", active: true }] }));
    post.mockResolvedValue({ html: "<p>preview</p>" });
    render(<LandingPagesPanel />);
    fireEvent.click(await screen.findByText("New page"));
    expect(screen.getByRole("button", { name: "Remove Headline" })).toBeTruthy();
    expect(screen.getByLabelText("Form")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Page title"), { target: { value: "Truck loans" } });
    fireEvent.click(screen.getByText("Publish"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/marketing/landing-pages", expect.objectContaining({ title: "Truck loans", status: "published" })));
  });
});

describe("facebook lead ads", () => {
  it("explains the result of Facebook Login in plain words", () => {
    expect(metaOutcome("?meta=connected")?.ok).toBe(true);
    expect(metaOutcome("?meta=error&reason=no_pages")?.text).toMatch(/does not manage any Pages/);
    expect(metaOutcome("?tab=connections")).toBeNull();
  });
});

describe("whatsapp", () => {
  it("fills template values", () => {
    expect(fillTemplate("Hi {{1}}, your {{2}} is ready", { "1": "Pat" })).toBe("Hi Pat, your {{2}} is ready");
  });
  it("is hidden when WhatsApp is not set up", async () => {
    get.mockResolvedValue({ configured: false, open: false, closesAt: null });
    const { container } = render(<WhatsAppBar phone="+17805550100" contactId="c1" channel="sms" onChannel={() => undefined} onSent={() => undefined} />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
  it("offers templates when the 24-hour window is closed and sends one", async () => {
    get.mockImplementation(async (u: string) => (u.includes("status")
      ? { configured: true, open: false, closesAt: null }
      : { templates: [{ sid: "HX" + "a".repeat(32), name: "follow_up", language: "en", body: "Hi {{1}}, any questions?", variables: ["1"] }] }));
    post.mockResolvedValue({ ok: true });
    const onSent = vi.fn();
    render(<WhatsAppBar phone="+17805550100" contactId="c1" channel="whatsapp" onChannel={() => undefined} onSent={onSent} />);
    fireEvent.change(await screen.findByLabelText("WhatsApp template"), { target: { value: "HX" + "a".repeat(32) } });
    fireEvent.change(screen.getByLabelText("Template value 1"), { target: { value: "Pat" } });
    expect(screen.getByText("Hi Pat, any questions?")).toBeTruthy();
    fireEvent.click(screen.getByText("Send template"));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/communications/whatsapp", expect.objectContaining({ contentSid: "HX" + "a".repeat(32), contentVariables: { "1": "Pat" } })));
    expect(onSent).toHaveBeenCalled();
  });
});
