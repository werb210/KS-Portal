// KS_PORTAL_NUMBER_PORTING_v1 - "Keep your existing phone number" (KS-server /api/port-requests, Admins only). The
// server relays to Keystone operations, which keeps the request and the carrier details (encrypted). The portal never
// shows an account number or PIN after it is sent: only "ending 1234" and "PIN on file".
import { api } from "@/api";

export type NumberType = "local" | "mobile" | "toll_free";
export const NUMBER_TYPES: Array<{ value: NumberType; label: string }> = [
  { value: "local", label: "Landline / business line" },
  { value: "mobile", label: "Mobile" },
  { value: "toll_free", label: "Toll-free" },
];

export const CARRIERS: Array<{ value: string; label: string }> = ([
  ["bell", "Bell"], ["rogers", "Rogers"], ["telus", "Telus"], ["fido", "Fido"], ["koodo", "Koodo"], ["virgin", "Virgin Plus"],
  ["freedom", "Freedom Mobile"], ["videotron", "Videotron"], ["shaw", "Shaw"], ["cogeco", "Cogeco"], ["eastlink", "Eastlink"],
  ["sasktel", "SaskTel"], ["att", "AT&T"], ["verizon", "Verizon"], ["tmobile", "T-Mobile"], ["other", "Other"],
] as Array<[string, string]>).map(([value, label]) => ({ value, label }));

export type Person = { id: string; name: string; email: string | null; role: string; temporary_number: string | null; temporary_kind: "direct" | "main" | null };

export type PortNumber = {
  phone_number: string; number_type: NumberType; user_id: string | null; assignee_name: string; temporary_number: string | null;
  forwarding_tested_at: string | null; attached_at: string | null;
};

export type PortRequest = {
  id: string;
  status: "draft" | "ready_to_submit" | "submitted" | "carrier_approval_pending" | "scheduled" | "completed" | "rejected" | "cancelled";
  status_label: string;
  status_message: string;
  carrier: string;
  carrier_label: string;
  account_name: string;
  account_number_masked: string;
  pin_on_file: boolean;
  numbers: PortNumber[];
  bill: { filename: string; size_bytes: number } | null;
  loa: { signer_name: string; signer_title: string; signed_at: string | null; expired: boolean } | null;
  needs_signature: boolean;
  can_cancel: boolean;
  foc_date: string | null;
  status_reason: string | null;
  created_at: string | null;
};

export type Overview = { ops_ready: boolean; message?: string; requests: PortRequest[]; people: Person[]; main_line: string | null };

export type Loa = { version: string; title: string; html: string; text: string; sha256: string; signed: { signer_name: string; signer_title: string; signed_at: string; expired: boolean } | null };

export type NewRequest = {
  carrier: string;
  carrier_other?: string;
  account_number: string;
  pin?: string;
  account_name: string;
  service_address: { line1: string; line2?: string; city: string; region: string; postal_code: string; country: "CA" | "US" };
  numbers: Array<{ phone_number: string; number_type: NumberType; user_id: string | null }>;
  bill: { filename: string; content_type: string; data_base64: string };
  forwarding_tested: boolean;
};

const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {});

export async function fetchPorting(): Promise<Overview> {
  const r = obj(await api.get<unknown>("/api/port-requests"));
  return {
    ops_ready: r.ops_ready === true,
    message: typeof r.message === "string" ? r.message : undefined,
    requests: Array.isArray(r.requests) ? (r.requests as PortRequest[]) : [],
    people: Array.isArray(r.people) ? (r.people as Person[]) : [],
    main_line: typeof r.main_line === "string" ? r.main_line : null,
  };
}

export async function createPortRequest(body: NewRequest): Promise<{ request: PortRequest; loa: Loa | null }> {
  const r = obj(await api.post<unknown>("/api/port-requests", body));
  return { request: r.request as PortRequest, loa: (r.loa as Loa) ?? null };
}

export async function fetchLoa(id: string): Promise<Loa> {
  return (await api.get<Loa>(`/api/port-requests/${encodeURIComponent(id)}/loa`)) as Loa;
}

export async function signLoa(id: string, body: { signer_name: string; signer_title: string; agree: boolean; sha256: string }): Promise<PortRequest> {
  return obj(await api.post<unknown>(`/api/port-requests/${encodeURIComponent(id)}/sign`, body)).request as PortRequest;
}

export async function setForwardingTested(id: string, phone_number: string, tested: boolean): Promise<void> {
  await api.post(`/api/port-requests/${encodeURIComponent(id)}/forwarding`, { phone_number, tested });
}

export async function cancelPortRequest(id: string): Promise<void> {
  await api.post(`/api/port-requests/${encodeURIComponent(id)}/cancel`, {});
}

/** The server's field errors ({ errors: { field: message } }), when it sent them. */
export function fieldErrors(e: unknown): Record<string, string> {
  const d = obj(obj(e).details);
  const errors = obj(d.errors);
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

/** A refusal in plain words. */
export function portingError(e: unknown, fallback: string): string {
  const d = obj(obj(e).details);
  const errs = Object.values(fieldErrors(e));
  const m = typeof d.message === "string" ? d.message : "";
  if (m && !/^[a-z_]+$/.test(m) && !/^Check the highlighted/.test(m)) return m;
  if (errs.length) return errs.join(" ");
  return m && !/^[a-z_]+$/.test(m) ? m : fallback;
}

/** "+14035550188" -> "(403) 555-0188". */
export function prettyNumber(n: string | null | undefined): string {
  const d = String(n ?? "").replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(n ?? "");
}

/** Reads an uploaded file as base64 (without the data: prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.onload = () => resolve(String(reader.result ?? "").replace(/^data:[^,]*,/, ""));
    reader.readAsDataURL(file);
  });
}
