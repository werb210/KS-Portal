// KS_PORTAL_MARKETING_CONTACTS_v1 - the contact page shows and saves the "Marketing contact" yes/no.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ContactDetailPage from "../ContactDetailPage";

import { api } from "@/api";
vi.mock("@/api/crm", () => ({
  crmApi: {
    getContact: vi.fn().mockResolvedValue({ id: "c1", name: "Jane Doe", email: "jane@example.com", marketing_contact: false, created_at: new Date().toISOString() }),
    timeline: vi.fn().mockResolvedValue([]),
    sharedMailboxes: vi.fn().mockResolvedValue({ mine: null, shared: [] }),
  },
}));

describe("Marketing contact toggle", () => {
  it("shows No for an imported contact and saves Yes", async () => {
    const patch = vi.spyOn(api, "patch").mockResolvedValue({} as never);
    render(
      <MemoryRouter initialEntries={["/crm/contacts/c1"]}>
        <Routes><Route path="/crm/contacts/:id" element={<ContactDetailPage />} /></Routes>
      </MemoryRouter>,
    );
    const box = (await screen.findByTestId("contact-marketing-toggle")) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.getByText(/not marketed to/)).toBeInTheDocument();
    fireEvent.click(box);
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/api/crm/contacts/c1", { marketing_contact: true }));
  });
});
