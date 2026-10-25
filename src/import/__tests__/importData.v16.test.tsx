// KS_PORTAL_v16_DATA_IMPORT - the Import data wizard: upload, column matching, preview with row problems and stage
// choices, the check (dry run), import, undo, problem downloads, and the Moving to Keystone guide.
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
import MovingToKeystone from "@/import/MovingToKeystone";
import type { Batch } from "@/import/importApi";

const PRESETS = {
  ok: true,
  sources: [
    { key: "spreadsheet", label: "Spreadsheet (CSV or Excel)" },
    { key: "hubspot", label: "HubSpot export" },
    { key: "keystone", label: "Keystone export zip" },
  ],
  record_types: [
    { key: "contacts", label: "Contacts", fields: [
      { key: "external_id", label: "ID in the old system" },
      { key: "email", label: "Email", group: "who" },
      { key: "first_name", label: "First name", group: "who" },
    ] },
    { key: "applications", label: "Deals / applications", fields: [
      { key: "name", label: "Deal name", required: true },
      { key: "stage", label: "Pipeline stage" },
    ] },
  ],
  stages: ["Received", "In Review", "Offer", "Accepted", "Rejected"],
  limits: { tableBytes: 50 * 1024 * 1024, zipBytes: 200 * 1024 * 1024, rows: 200000, documentBytes: 25 * 1024 * 1024 },
};

function batch(over: Partial<Batch> = {}): Batch {
  return {
    id: "b1", source: "hubspot", record_type: "applications", file_name: "deals.csv", status: "uploaded", columns: ["Deal Name", "Deal Stage"],
    mapping: { name: "Deal Name", stage: "Deal Stage" }, options: {}, total_rows: 2, processed_rows: 0, created_count: 0, updated_count: 0,
    skipped_count: 0, error_count: 0, dry_run: null, run_summary: null, undo_summary: null, last_error: null, created_by_email: "pat@example.com",
    created_at: "2026-10-24T10:00:00Z", finished_at: null, ...over,
  };
}

let history: Batch[] = [];
beforeEach(() => {
  h.api.get.mockReset(); h.api.post.mockReset(); h.api.put.mockReset(); h.api.delete.mockReset(); h.raw.mockReset();
  history = [];
  h.api.get.mockImplementation(async (path: string) => {
    if (path.endsWith("/presets")) return PRESETS;
    if (path.endsWith("/batches")) return { batches: history };
    if (path.endsWith("/mappings")) return { mappings: [{ id: "m1", name: "HubSpot deals", source: "hubspot", record_type: "applications", mapping: { name: "Deal Name" }, options: {} }] };
    if (path.endsWith("/preview")) return {
      rows: [
        { row_number: 1, record_type: "applications", values: { name: "Doe deal", stage: "Accepted" }, errors: [], warnings: [] },
        { row_number: 2, record_type: "applications", values: { stage: "Received" }, errors: [{ field: "name", message: "deal name is required" }], warnings: [] },
      ],
      scanned: 2, error_rows_in_scanned: 1,
      stages: [{ value: "closedwon", rows: 1, stage: "Accepted", matched: true }, { value: "Stage 7", rows: 1, stage: "Received", matched: false }],
    };
    throw new Error(`unexpected GET ${path}`);
  });
});

describe("Import data wizard", () => {
  it("uploads a HubSpot deals export, matches columns, previews problems and stages, then starts the check", async () => {
    h.api.post.mockImplementation(async (path: string, body: unknown) => {
      if (path.endsWith("/uploads")) {
        expect(body).toBeInstanceOf(FormData);
        const form = body as FormData;
        expect(form.get("source")).toBe("hubspot");
        expect(form.get("record_type")).toBe("applications");
        return { batch: batch(), columns: ["Deal Name", "Deal Stage"], suggested_mapping: { name: "Deal Name", stage: "Deal Stage" }, counts: { applications: 2 }, total_rows: 2, sample: [{ "Deal Name": "Doe deal", "Deal Stage": "closedwon" }] };
      }
      if (path.endsWith("/dry-run")) return { batch: batch({ status: "dry_run_queued" }) };
      throw new Error(`unexpected POST ${path}`);
    });
    h.api.put.mockImplementation(async (_path: string, body: any) => ({ batch: batch({ mapping: body.mapping, options: body.options }) }));

    renderWithRole(<ImportData />, "Admin");
    fireEvent.click(await screen.findByTestId("import-new"));
    fireEvent.click(await screen.findByLabelText(/HubSpot export/));
    fireEvent.change(screen.getByLabelText("What does the file hold?"), { target: { value: "applications" } });
    const file = new File(["Deal Name,Deal Stage\nDoe deal,closedwon\n"], "deals.csv", { type: "text/csv" });
    fireEvent.change(screen.getByTestId("import-file"), { target: { files: [file] } });
    fireEvent.click(screen.getByTestId("import-upload-button"));

    const map = await screen.findByTestId("import-map");
    expect((within(map).getByTestId("map-name") as HTMLSelectElement).value).toBe("Deal Name");
    expect(within(map).getByText("Doe deal")).toBeTruthy(); // first row shown next to the field
    // Clearing a required field blocks the next step and says why.
    fireEvent.change(within(map).getByTestId("map-name"), { target: { value: "" } });
    expect(screen.getByTestId("import-map-missing")).toHaveTextContent("Choose a column for Deal name.");
    expect((screen.getByTestId("import-to-preview") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(map).getByTestId("map-name"), { target: { value: "Deal Name" } });
    fireEvent.click(screen.getByTestId("import-to-preview"));

    const preview = await screen.findByTestId("import-preview");
    expect(within(preview).getByText("deal name is required")).toBeTruthy();
    expect(within(preview).getByText(/1 of the first 2 rows have problems/)).toBeTruthy();
    expect(within(preview).getByText("(not recognised)")).toBeTruthy();
    fireEvent.change(within(preview).getByLabelText("Keystone stage for Stage 7"), { target: { value: "Offer" } });
    fireEvent.click(screen.getByTestId("import-dry-run"));
    await waitFor(() => expect(h.api.post).toHaveBeenCalledWith("/api/data-import/batches/b1/dry-run"));
    const lastPut = h.api.put.mock.calls.at(-1)!;
    expect(lastPut[1].options.stage_map).toEqual({ closedwon: "Accepted", "Stage 7": "Offer" });
    expect(await screen.findByTestId("import-job")).toBeTruthy();
  });

  it("shows the check result, downloads the problems and imports", async () => {
    history = [batch({ status: "ready", dry_run: { created: 5, updated: 2, skipped: 1, errors: 3, warnings: 0, rows: 11, error_rows: 3 } })];
    h.api.post.mockResolvedValue({ batch: batch({ status: "queued", total_rows: 11 }) });
    h.raw.mockResolvedValue({ ok: true, blob: async () => new Blob(["row,problem\n"]), headers: new Headers({ "content-disposition": 'attachment; filename="import-problems-dry-run.csv"' }) });
    (URL as any).createObjectURL = vi.fn(() => "blob:x");
    (URL as any).revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderWithRole(<ImportData />, "Admin");
    const row = await screen.findByTestId("import-row-b1");
    expect(row).toHaveTextContent("Checked - ready to import");
    fireEvent.click(within(row).getByText("Open"));
    expect(await screen.findByTestId("import-dry-counts")).toHaveTextContent("5 created2 updated1 skipped (no change)3 with errors");
    fireEvent.click(screen.getByTestId("import-dry-problems"));
    await waitFor(() => expect(h.raw).toHaveBeenCalledWith("/api/data-import/batches/b1/errors.csv?phase=dry_run"));
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
    fireEvent.click(screen.getByTestId("import-run"));
    await waitFor(() => expect(h.api.post).toHaveBeenCalledWith("/api/data-import/batches/b1/run"));
    expect(await screen.findByText(/Importing in the background/)).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("undoes a finished import after confirming, and shows what was undone", async () => {
    history = [batch({ status: "completed", created_count: 4, updated_count: 1 })];
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    h.api.post.mockResolvedValue({ batch: batch({ status: "undone", undo_summary: { removed: 4, restored: 1, kept: 2, failed: 0 } }) });
    renderWithRole(<ImportData />, "Admin");
    fireEvent.click(within(await screen.findByTestId("import-row-b1")).getByText("Open"));
    expect(await screen.findByTestId("import-run-counts")).toHaveTextContent("4 created1 updated");
    fireEvent.click(screen.getByTestId("import-undo"));
    await waitFor(() => expect(h.api.post).toHaveBeenCalledWith("/api/data-import/batches/b1/undo"));
    expect(confirm).toHaveBeenCalled();
    expect(await screen.findByTestId("import-undone")).toHaveTextContent("4 records removed, 1 restored, 2 fields kept because they were edited after the import");
    confirm.mockRestore();
  });

  it("shows the server's reason when an upload is refused", async () => {
    h.api.post.mockRejectedValue(Object.assign(new Error("API_ERROR"), { details: { error: "A file can hold up to 200,000 rows; this one has 250,000. Split it and import each part." } }));
    renderWithRole(<ImportData />, "Admin");
    fireEvent.click(await screen.findByTestId("import-new"));
    fireEvent.change(screen.getByTestId("import-file"), { target: { files: [new File(["a"], "big.csv")] } });
    fireEvent.click(screen.getByTestId("import-upload-button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Split it and import each part.");
  });

  it("the Moving to Keystone guide opens from the importer", async () => {
    renderWithRole(<ImportData />, "Admin");
    fireEvent.click(await screen.findByTestId("import-guide-toggle"));
    expect(screen.getByTestId("moving-to-keystone")).toHaveTextContent("Import in this order");
    renderWithRole(<MovingToKeystone />, "Admin");
    expect(screen.getAllByText(/Undo removes the records the import added/).length).toBeGreaterThan(0);
  });
});
