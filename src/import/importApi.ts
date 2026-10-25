// KS_PORTAL_v16_DATA_IMPORT - the Import data wizard's API (KS-server /api/data-import, admins only). Shapes match
// src/routes/dataImport.ts there.
import { api, rawApiFetch } from "@/api";

export type RecordType = "contacts" | "companies" | "lenders" | "lender_products" | "applications" | "notes" | "documents";
export type Source = "spreadsheet" | "hubspot" | "salesforce" | "pipedrive" | "keystone";
export type FieldDef = { key: string; label: string; required?: boolean; group?: string; hint?: string; example?: string };
export type Presets = {
  sources: Array<{ key: Source; label: string }>;
  record_types: Array<{ key: RecordType; label: string; fields: FieldDef[] }>;
  stages: string[];
  limits: { tableBytes: number; zipBytes: number; rows: number; documentBytes: number };
};
export type Counts = { created: number; updated: number; skipped: number; errors: number; warnings?: number };
export type Batch = {
  id: string;
  source: Source;
  record_type: RecordType | "keystone";
  file_name: string | null;
  status: string;
  columns: string[];
  mapping: Record<string, string>;
  options: { stage_map?: Record<string, string>; counts?: Record<string, number> };
  total_rows: number;
  processed_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  dry_run: (Counts & { rows: number; error_rows: number; by_type?: Record<string, Counts> }) | null;
  run_summary: { by_type?: Record<string, Counts> } | null;
  undo_summary: { removed: number; restored: number; kept: number; held?: number; failed: number } | null;
  last_error: string | null;
  created_by_email: string | null;
  created_at: string;
  finished_at: string | null;
};
export type UploadResult = {
  batch: Batch;
  columns: string[];
  suggested_mapping: Record<string, string>;
  counts: Record<string, number>;
  total_rows: number;
  sample: Array<Record<string, string>>;
};
export type RowIssue = { field: string; message: string };
export type PreviewRow = { row_number: number; record_type: RecordType; values: Record<string, unknown>; errors: RowIssue[]; warnings: RowIssue[] };
export type StageValue = { value: string; rows: number; stage: string; matched: boolean };
export type Preview = { rows: PreviewRow[]; scanned: number; error_rows_in_scanned: number; stages: StageValue[] };
export type SavedMapping = { id: string; name: string; source: Source; record_type: RecordType; mapping: Record<string, string>; options: { stage_map?: Record<string, string> } };

const BASE = "/api/data-import";

export const getPresets = () => api.get<Presets & { ok: boolean }>(`${BASE}/presets`);
export const listBatches = async () => (await api.get<{ batches: Batch[] }>(`${BASE}/batches`)).batches ?? [];
export const getBatch = async (id: string) => (await api.get<{ batch: Batch }>(`${BASE}/batches/${id}`)).batch;
export const listMappings = async (recordType: string) =>
  (await api.get<{ mappings: SavedMapping[] }>(`${BASE}/mappings`, { params: { record_type: recordType } })).mappings ?? [];
export const saveMapping = (body: { name: string; source: Source; record_type: RecordType; mapping: Record<string, string>; options?: { stage_map?: Record<string, string> } }) =>
  api.post<{ mapping: SavedMapping }>(`${BASE}/mappings`, body);
export const deleteMapping = (id: string) => api.delete(`${BASE}/mappings/${id}`);

export async function uploadImportFile(file: File, source: Source, recordType: RecordType | "keystone"): Promise<UploadResult> {
  const form = new FormData();
  form.append("source", source);
  form.append("record_type", recordType);
  form.append("file", file);
  return api.post<UploadResult>(`${BASE}/uploads`, form);
}

export const setMapping = async (id: string, mapping: Record<string, string>, stageMap: Record<string, string>) =>
  (await api.put<{ batch: Batch }>(`${BASE}/batches/${id}/mapping`, { mapping, options: { stage_map: stageMap } })).batch;
export const getPreview = (id: string) => api.get<Preview>(`${BASE}/batches/${id}/preview`, { params: { limit: 25 } });
export const startDryRun = async (id: string) => (await api.post<{ batch: Batch }>(`${BASE}/batches/${id}/dry-run`)).batch;
export const startRun = async (id: string) => (await api.post<{ batch: Batch }>(`${BASE}/batches/${id}/run`)).batch;
export const startUndo = async (id: string) => (await api.post<{ batch: Batch }>(`${BASE}/batches/${id}/undo`)).batch;
export const removeBatch = (id: string) => api.delete(`${BASE}/batches/${id}`);

/** Downloads a file the server sends (template, problem list, data export) with the signed-in session. */
export async function downloadFrom(path: string, fallbackName: string): Promise<void> {
  const res = await rawApiFetch(path);
  if (!res.ok) throw new Error("The download did not work. Please try again.");
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const name = /filename="?([^";]+)"?/i.exec(cd)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const templatePath = (type: RecordType) => `${BASE}/templates/${type}`;
export const problemsPath = (id: string, phase: "dry_run" | "run" | "undo") => `${BASE}/batches/${id}/errors.csv?phase=${phase}`;
/** This copy's own data, as the zip the Keystone import reads (GET /api/export, admins). */
export const EXPORT_PATH = "/api/export";

/** Statuses while a background job is queued or running: the wizard polls until they change. */
export const BUSY = new Set(["dry_run_queued", "dry_running", "queued", "running", "undo_queued", "undoing"]);

export const STATUS_LABEL: Record<string, string> = {
  uploaded: "Uploaded",
  dry_run_queued: "Check queued",
  dry_running: "Checking",
  ready: "Checked - ready to import",
  queued: "Import queued",
  running: "Importing",
  completed: "Imported",
  failed: "Stopped",
  undo_queued: "Undo queued",
  undoing: "Undoing",
  undone: "Undone",
};

export function statusText(status: string): string {
  return STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as { message?: unknown; details?: { error?: unknown } } | null;
  const detail = e?.details?.error;
  if (typeof detail === "string" && detail.trim()) return detail;
  const m = typeof e?.message === "string" ? e.message : "";
  return m && m !== "API_ERROR" ? m : fallback;
}

export function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${Math.round(n / (1024 * 1024))} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
