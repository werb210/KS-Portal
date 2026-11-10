// KS_PORTAL_LICENSEE_DOCUMENTS
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), patch: vi.fn(), raw: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: (...a: unknown[]) => h.get(...a), put: (...a: unknown[]) => h.put(...a), patch: (...a: unknown[]) => h.patch(...a) }, rawApiFetch: (...a: unknown[]) => h.raw(...a) }));

import YourDocumentsSettings from "../YourDocumentsSettings";

const PAYLOAD = {
  kinds: [{ key: "application_form", label: "Application form" }, { key: "term_sheet", label: "Offer / term sheet" }],
  dataFields: [{ key: "business.legal_name", label: "Business legal name" }, { key: "business.employees", label: "Number of employees" }],
  documents: [{ id: "d1", kind: "application_form", name: "Our credit application", file_name: "a.pdf", format: "pdf_form", active: true, fields: [
    { name: "BusName", label: "Bus name", type: "text", mapped_to: "business.legal_name", matched_by: "words" },
    { name: "Fleet", label: "Fleet size", type: "text", mapped_to: null, matched_by: null },
    { name: "Sig1", label: "Signature", type: "signature", mapped_to: null, matched_by: null },
  ] }],
  questions: [{ id: "q1", document_id: "d1", key: "fleet", label: "Fleet size", type: "text", options: [], required: false, active: true }],
};

beforeEach(() => { h.get.mockReset(); h.put.mockReset(); h.patch.mockReset(); h.raw.mockReset(); h.get.mockResolvedValue(PAYLOAD); h.put.mockResolvedValue({}); h.patch.mockResolvedValue({}); });

describe("Settings > Your documents", () => {
  it("shows each document with how many fields matched and how many extra questions it adds", async () => {
    render(<YourDocumentsSettings isAdmin />);
    const card = await screen.findByTestId("doc-d1");
    expect(within(card).getByText("1 of 2 fields matched · 1 extra question for the client")).toBeTruthy();
    expect(within(card).getByText("In use")).toBeTruthy();
  });

  it("lets an admin fix a match and saves only what changed", async () => {
    render(<YourDocumentsSettings isAdmin />);
    const card = await screen.findByTestId("doc-d1");
    fireEvent.click(within(card).getByText("Check matches"));
    expect(within(card).getByText("Client signs here")).toBeTruthy();
    fireEvent.change(within(card).getByLabelText("What fills Fleet size"), { target: { value: "business.employees" } });
    fireEvent.click(within(card).getByText("Save matches"));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/licensee-documents/d1/fields", { fields: [{ name: "Fleet", mapped_to: "business.employees" }] }));
  });

  it("uploads with the kind and name", async () => {
    h.raw.mockResolvedValue(new Response(JSON.stringify({ document: { id: "d2" } }), { status: 201 }));
    render(<YourDocumentsSettings isAdmin />);
    await screen.findByTestId("doc-d1");
    fireEvent.change(screen.getByTestId("doc-kind"), { target: { value: "term_sheet" } });
    fireEvent.change(screen.getByTestId("doc-file"), { target: { files: [new File(["%PDF"], "ts.pdf", { type: "application/pdf" })] } });
    fireEvent.click(screen.getByTestId("doc-upload"));
    await waitFor(() => expect(h.raw).toHaveBeenCalled());
    const [path, init] = h.raw.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/licensee-documents");
    expect((init.body as FormData).get("kind")).toBe("term_sheet");
  });

  it("staff can look but not change", async () => {
    render(<YourDocumentsSettings isAdmin={false} />);
    await screen.findByTestId("doc-d1");
    expect(screen.queryByTestId("doc-upload")).toBeNull();
    expect(screen.getByText("An admin uploads and changes these.")).toBeTruthy();
  });
});
