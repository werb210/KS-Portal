// BF_PORTAL_v856_CRM_UNIFY / KS_PORTAL_v18_CRM_UNIFY - the contact record in the shared CRM: AI summary above Stage
// history, the duplicates banner, Edit tags, the role badge, and a merged record sending staff to the survivor.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), getContact: vi.fn() }));
vi.mock("@/api", () => {
  const fn: any = vi.fn(async () => ({}));
  fn.get = (...a: unknown[]) => h.get(...a);
  fn.post = (...a: unknown[]) => h.post(...a);
  fn.patch = vi.fn(async () => ({}));
  fn.delete = vi.fn(async () => ({}));
  return { api: fn, default: fn, apiGetEnvelope: vi.fn(), rawApiFetch: vi.fn() };
});
vi.mock("@/api/crm", () => ({
  crmApi: {
    getContact: (...a: unknown[]) => h.getContact(...a),
    timeline: vi.fn().mockResolvedValue([]),
    sharedMailboxes: vi.fn().mockResolvedValue({ mine: null, shared: [] }),
  },
}));

import ContactDetailPage from "@/pages/crm/contacts/ContactDetailPage";

const KAY = {
  id: "c1", name: "Kay Hollis", email: "kay@harbour.ca", phone: "+15875550100", tags: ["Lender", "website_signup"], role: "unknown",
  company_id: "co1", company_name: "Harbour Freight", created_at: "2026-10-23T12:00:00Z", applicationIds: [],
};

function renderAt(id = "c1") {
  return render(
    <MemoryRouter initialEntries={[`/crm/contacts/${id}`]}>
      <Routes><Route path="/crm/contacts/:id" element={<ContactDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  h.getContact.mockReset();
  h.post.mockResolvedValue({});
  h.getContact.mockImplementation(async (id: string) => (id === "old" ? { ...KAY, id: "old", name: "Kay H", merged_into_id: "c1" } : KAY));
  h.get.mockImplementation(async (path: string) => {
    if (path === "/api/crm/unified/duplicates/contact/c1") return { count: 2, candidates: [
      { id: "c2", name: "Kay H.", email: "kay@harbour.ca", phone: null, company_name: null, created_at: null, reasons: ["Same email"] },
      { id: "c3", name: "K Hollis", email: null, phone: "+15875550100", company_name: null, created_at: null, reasons: ["Same phone"] },
    ] };
    if (path === "/api/crm/unified/contacts/old/survivor") return { id: "c1", requestedId: "old", merged: true, archived: false, missing: false, name: "Kay Hollis" };
    return {};
  });
});

describe("contact record (shared CRM)", () => {
  it("duplicates banner, AI summary above Stage history, editable tags and a meaningful role badge", async () => {
    renderAt();
    await screen.findByText("Kay Hollis");
    const banner = await screen.findByTestId("crm-duplicates-banner");
    expect(banner).toHaveTextContent("There are 2 possible duplicates. Would you like to merge them?");
    expect(within(banner).getByRole("link", { name: "Kay H." }).getAttribute("href")).toBe("/crm/contacts/c2");
    // "Unknown" is replaced by what the person is, with a tooltip.
    const badge = screen.getByTestId("contact-role-badge");
    expect(badge).toHaveTextContent("Lender");
    expect(badge.getAttribute("title")).toBe("Tagged Lender.");
    fireEvent.click(screen.getByRole("tab", { name: "Analytics" }));
    const analytics = screen.getByTestId("contact-panel-analytics");
    const summary = within(analytics).getByTestId("crm-ai-summary");
    const stage = within(analytics).getByText(/stage history/i);
    expect(summary.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const editor = screen.getByTestId("crm-tag-editor");
    expect(within(editor).getAllByTestId("crm-tag-chip").map((c) => c.getAttribute("data-kind"))).toEqual(["core", "system"]);
  });

  it("a merged record opens the surviving record with a note", async () => {
    renderAt("old");
    expect(await screen.findByText("Kay H was merged into this contact, so you are seeing the surviving record.")).toBeInTheDocument();
    await waitFor(() => expect(h.getContact).toHaveBeenCalledWith("c1"));
    expect(screen.getByText("Kay Hollis")).toBeInTheDocument();
  });
});
