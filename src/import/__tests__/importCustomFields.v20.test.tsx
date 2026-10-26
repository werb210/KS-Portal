// KS_PORTAL_v20_CRM_FIELDS - the Import data wizard maps columns to custom fields (HubSpot custom properties
// pre-matched by the server) and can create custom fields from columns that match nothing.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => {
  const fn: any = vi.fn();
  fn.get = vi.fn(); fn.post = vi.fn(); fn.put = vi.fn(); fn.delete = vi.fn();
  return { api: fn, raw: vi.fn() };
});
vi.mock("@/api", () => ({ api: h.api, default: h.api, rawApiFetch: h.raw }));

import ImportData from "@/import/ImportData";
import type { Batch } from "@/import/importApi";

let customContacts = [{ key: "cf:broker_licence", name: "broker_licence", label: "Broker licence", field_type: "text", required: false }];
const presets = () => ({
  ok: true,
  sources: [{ key: "hubspot", label: "HubSpot export" }, { key: "spreadsheet", label: "Spreadsheet (CSV or Excel)" }],
  record_types: [{ key: "contacts", label: "Contacts", fields: [{ key: "email", label: "Email", group: "who" }] }],
  stages: ["Received"],
  limits: { tableBytes: 1, zipBytes: 1, rows: 1, documentBytes: 1 },
  custom_fields: { contacts: customContacts },
  field_types: ["text", "number", "date"],
});
const batch = (over: Partial<Batch> = {}): Batch => ({
  id: "b1", source: "hubspot", record_type: "contacts", file_name: "contacts.csv", status: "uploaded", columns: ["Email", "Broker Licence", "Fleet Size"],
  mapping: { email: "Email", "cf:broker_licence": "Broker Licence" }, options: {}, total_rows: 1, processed_rows: 0, created_count: 0, updated_count: 0,
  skipped_count: 0, error_count: 0, dry_run: null, run_summary: null, undo_summary: null, last_error: null, created_by_email: null,
  created_at: "2026-11-03T10:00:00Z", finished_at: null, ...over,
});

beforeEach(() => {
  h.api.get.mockReset(); h.api.post.mockReset(); h.api.put.mockReset();
  customContacts = [{ key: "cf:broker_licence", name: "broker_licence", label: "Broker licence", field_type: "text", required: false }];
  h.api.get.mockImplementation(async (path: string) => {
    if (path.endsWith("/presets")) return presets();
    if (path.endsWith("/batches")) return { batches: [] };
    if (path.endsWith("/mappings")) return { mappings: [] };
    throw new Error(`unexpected GET ${path}`);
  });
});

describe("Import wizard and custom fields", () => {
  it("shows custom fields as targets and turns an unmatched HubSpot column into a new field", async () => {
    h.api.post.mockImplementation(async (path: string, body: any) => {
      if (path.endsWith("/uploads")) return { batch: batch(), columns: ["Email", "Broker Licence", "Fleet Size"], suggested_mapping: { email: "Email", "cf:broker_licence": "Broker Licence" }, counts: { contacts: 1 }, total_rows: 1, sample: [{ Email: "a@b.co", "Broker Licence": "AB-1", "Fleet Size": "12" }] };
      if (path.endsWith("/custom-fields")) {
        expect(body).toEqual({ columns: [{ column: "Fleet Size", field_type: "number" }] });
        customContacts = [...customContacts, { key: "cf:fleet_size", name: "fleet_size", label: "Fleet Size", field_type: "number", required: false }];
        return { batch: batch({ mapping: { email: "Email", "cf:broker_licence": "Broker Licence", "cf:fleet_size": "Fleet Size" } }), created: [{ name: "fleet_size", label: "Fleet Size", field_type: "number" }], problems: [] };
      }
      throw new Error(`unexpected POST ${path}`);
    });
    renderWithRole(<ImportData />, "Admin");
    fireEvent.click(await screen.findByTestId("import-new"));
    fireEvent.click(await screen.findByLabelText(/HubSpot export/));
    fireEvent.change(screen.getByTestId("import-file"), { target: { files: [new File(["Email\n"], "contacts.csv", { type: "text/csv" })] } });
    fireEvent.click(screen.getByTestId("import-upload-button"));
    const map = await screen.findByTestId("import-map");
    expect(within(map).getByText("Custom fields")).toBeTruthy();
    expect((within(map).getByTestId("map-cf:broker_licence") as HTMLSelectElement).value).toBe("Broker Licence");
    const unused = screen.getByTestId("import-unused-columns");
    expect(unused).toHaveTextContent("1 column not imported (HubSpot custom properties land here)");
    fireEvent.click(within(unused).getByLabelText("Fleet Size"));
    fireEvent.change(within(unused).getByLabelText("Type for Fleet Size"), { target: { value: "number" } });
    fireEvent.click(screen.getByTestId("import-create-fields"));
    await waitFor(() => expect(h.api.post).toHaveBeenCalledWith("/api/data-import/batches/b1/custom-fields", expect.anything()));
    expect(await screen.findByText(/1 custom field created and matched/)).toBeTruthy();
    expect((screen.getByTestId("map-cf:fleet_size") as HTMLSelectElement).value).toBe("Fleet Size");
  });
});
