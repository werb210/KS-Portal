// KS_PORTAL_v9_PGI - the PGI referral API (KS-server /api/pgi). Shapes match src/routes/pgi.ts and src/pgi/service.ts
// there. Documents are uploaded with the ordinary document upload (category per slot) and accepted, which forwards
// them to the insurance partner.
import { api } from "@/api";

export type SlotState = "missing" | "awaiting_review" | "ready" | "sent" | "received" | "accepted" | "rejected";
export type PgiSlot = "loan_agreement" | "profit_loss" | "balance_sheet" | "ar_aging" | "ap_aging" | "founder_cv" | "financial_forecast";
export type ChecklistRow = { slot: PgiSlot; label: string; state: SlotState; detail?: string | null };
export type MissingField = { key: string; label: string; completed_by?: "broker" | "client" };
export type ReferralFee = { amount: number; currency: string; status: string | null };

export type PgiReferral = {
  application_id: string;
  status: string;
  partner_status: string | null;
  application_code: string | null;
  completion_url: string | null;
  missing_count: number;
  unread_count: number;
  last_error: string | null;
  last_synced_at: string | null;
  created_at: string;
  referral_fee: ReferralFee | null;
};

export type PgiMessage = {
  id: string;
  direction: "from_partner" | "to_partner";
  kind: "message" | "doc_request" | "reminder" | "status";
  body: string;
  author_name: string | null;
  status: string | null;
  created_at: string;
  sent_at: string | null;
  send_error: string | null;
  read_at: string | null;
};

export type PgiView = {
  referral: PgiReferral;
  input: Record<string, unknown>;
  checklist: ChecklistRow[];
  startup: boolean;
  missing_fields: MissingField[];
  messages: PgiMessage[];
  partner_name: string;
};

export type PgiListRow = {
  application_id: string;
  application_name: string | null;
  referring_user_name: string | null;
  status: string;
  bi_application_code: string | null;
  missing_count: number;
  unread_count: number;
  referral_fee_amount: number | null;
  referral_fee_currency: string | null;
  referral_fee_status: string | null;
  last_error: string | null;
  updated_at: string;
};

/** The category a document is filed under when uploaded for a slot (KS-server src/pgi/checklist.ts). */
export const SLOT_UPLOAD_CATEGORY: Record<PgiSlot | "kyc_id", string> = {
  loan_agreement: "signed_term_sheet",
  profit_loss: "PnL - Interim financials",
  balance_sheet: "Balance Sheet - Interim financials",
  ar_aging: "accounts_receivable_aging",
  ap_aging: "accounts_payable_aging",
  founder_cv: "founder_cv",
  financial_forecast: "financial_forecast",
  kyc_id: "government_id",
};

const base = (id: string) => `/api/pgi/referrals/${encodeURIComponent(id)}`;

export const pgiApi = {
  list: () => api.get<{ referrals: PgiListRow[] }>("/api/pgi/referrals"),
  view: (id: string) => api.get<PgiView>(base(id)),
  start: (id: string) => api.post<PgiView>(base(id), {}),
  update: (id: string, fields: Record<string, unknown>) => api.patch<PgiView>(base(id), fields),
  sync: (id: string) => api.post<PgiView & { sync?: { ok: boolean; error?: string } }>(`${base(id)}/sync`, {}),
  send: (id: string, body: string) => api.post<{ ok: boolean; sent: boolean; error: string | null }>(`${base(id)}/messages`, { body }),
  markRead: (id: string) => api.post<{ ok: boolean }>(`${base(id)}/read`, {}),
  /** Upload a file for a slot, accept it (accepting forwards it to the partner), then refresh. */
  async uploadForSlot(id: string, slot: PgiSlot | "kyc_id", file: File): Promise<PgiView> {
    const fd = new FormData();
    fd.append("applicationId", id);
    fd.append("category", SLOT_UPLOAD_CATEGORY[slot]);
    fd.append("file", file);
    const up = await api<any>("/api/documents/upload", { method: "POST", body: fd });
    const docId = up?.id ?? up?.data?.id;
    if (docId) await api.post(`/api/portal/documents/${encodeURIComponent(String(docId))}/accept`, {});
    return pgiApi.sync(id);
  },
};

/** Status words and colours: dark text on a light tint (each pair at least 4.5:1). */
export const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string; border: string }> = {
  pending: { label: "Sending", bg: "#e0f2fe", fg: "#0c4a6e", border: "#7dd3fc" },
  not_configured: { label: "Waiting for setup", bg: "#e2e8f0", fg: "#1e293b", border: "#cbd5e1" },
  needs_details: { label: "Details needed", bg: "#fef3c7", fg: "#78350f", border: "#fcd34d" },
  error: { label: "Not sent yet", bg: "#ffedd5", fg: "#7c2d12", border: "#fdba74" },
  not_eligible: { label: "Not eligible", bg: "#f1f5f9", fg: "#334155", border: "#cbd5e1" },
  awaiting_client: { label: "Waiting for client", bg: "#fef3c7", fg: "#78350f", border: "#fcd34d" },
  in_review: { label: "In review", bg: "#e0f2fe", fg: "#0c4a6e", border: "#7dd3fc" },
  documents_rejected: { label: "Documents rejected", bg: "#fee2e2", fg: "#7f1d1d", border: "#fca5a5" },
  submitted: { label: "Submitted to insurer", bg: "#e0e7ff", fg: "#312e81", border: "#a5b4fc" },
  quoted: { label: "Quoted", bg: "#e0e7ff", fg: "#312e81", border: "#a5b4fc" },
  information_required: { label: "Insurer needs info", bg: "#fef3c7", fg: "#78350f", border: "#fcd34d" },
  approved: { label: "Approved", bg: "#dcfce7", fg: "#14532d", border: "#86efac" },
  declined: { label: "Declined", bg: "#fee2e2", fg: "#7f1d1d", border: "#fca5a5" },
  policy_issued: { label: "Policy bound", bg: "#dcfce7", fg: "#14532d", border: "#86efac" },
};

export const SLOT_STATE_STYLE: Record<SlotState, { label: string; bg: string; fg: string; border: string }> = {
  missing: { label: "Missing", bg: "#fee2e2", fg: "#7f1d1d", border: "#fca5a5" },
  awaiting_review: { label: "Uploaded - accept it to send", bg: "#fef3c7", fg: "#78350f", border: "#fcd34d" },
  ready: { label: "Sending", bg: "#e0f2fe", fg: "#0c4a6e", border: "#7dd3fc" },
  sent: { label: "Sent", bg: "#e0e7ff", fg: "#312e81", border: "#a5b4fc" },
  received: { label: "Received by insurer", bg: "#e0e7ff", fg: "#312e81", border: "#a5b4fc" },
  accepted: { label: "Accepted", bg: "#dcfce7", fg: "#14532d", border: "#86efac" },
  rejected: { label: "Rejected - send again", bg: "#fee2e2", fg: "#7f1d1d", border: "#fca5a5" },
};

export function statusStyle(status: string) {
  return STATUS_STYLE[status] ?? { label: status.replace(/_/g, " "), bg: "#f1f5f9", fg: "#334155", border: "#cbd5e1" };
}

export function money(amount: number, currency = "CAD"): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

/** WCAG contrast ratio of two #rrggbb colours (the tests keep every chip at 4.5:1 or better). */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}
