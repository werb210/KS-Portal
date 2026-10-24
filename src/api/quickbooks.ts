// KS_PORTAL_v13_QUICKBOOKS - the licensee's QuickBooks Online connection and fee invoices (KS-server /api/quickbooks).
import { api } from "@/api";

export type QuickBooksStatus = {
  configured: boolean;
  reason: string | null;
  environment: string;
  connected: boolean;
  status: string | null;
  companyName: string | null;
  realmId: string | null;
  connectedAt: string | null;
  lastError: string | null;
  taxCodeId: string | null;
  taxCodeName: string | null;
};

export type QuickBooksInvoice = {
  invoiceId: string | null;
  docNumber: string | null;
  amount: number | null;
  status: string;
  syncStatus: string;
  lastError: string | null;
  syncedAt: string | null;
  canRetry: boolean;
};

export type InvoiceView = { configured: boolean; connected: boolean; invoice: QuickBooksInvoice | null };
export type TaxCode = { id: string; name: string; description: string | null };

const enc = encodeURIComponent;

export const quickbooksApi = {
  status: () => api.get<QuickBooksStatus>("/api/quickbooks/status"),
  connect: () => api.post<{ url?: string }>("/api/quickbooks/connect", {}),
  disconnect: () => api.post<{ ok: boolean; revoked: boolean }>("/api/quickbooks/disconnect", {}),
  taxCodes: () => api.get<{ taxCodes: TaxCode[] }>("/api/quickbooks/tax-codes"),
  saveSettings: (taxCodeId: string | null, taxCodeName: string | null) =>
    api.put<QuickBooksStatus>("/api/quickbooks/settings", { taxCodeId, taxCodeName }),
  invoice: (applicationId: string) => api.get<InvoiceView>(`/api/quickbooks/applications/${enc(applicationId)}/invoice`),
  retry: (applicationId: string) => api.post<InvoiceView & { ok: boolean; result: string }>(`/api/quickbooks/applications/${enc(applicationId)}/invoice/retry`, {}),
};

const STATUS_TEXT: Record<string, string> = { none: "Not created yet", open: "Open", paid: "Paid" };
const SYNC_TEXT: Record<string, string> = { queued: "Sending to QuickBooks", retrying: "Last sync failed, retrying", failed: "Last sync failed" };

/** One line for the application card, e.g. "Invoice 1001 - $5,000.00 - Paid". */
export function invoiceLine(inv: QuickBooksInvoice): string {
  const money = inv.amount === null ? null : inv.amount.toLocaleString("en-CA", { style: "currency", currency: "CAD" }).replace("CA$", "$");
  const parts = [inv.docNumber ? `Invoice ${inv.docNumber}` : inv.invoiceId ? `Invoice #${inv.invoiceId}` : "Invoice", money, STATUS_TEXT[inv.status] ?? inv.status];
  const sync = SYNC_TEXT[inv.syncStatus];
  return parts.filter(Boolean).join(" - ") + (sync ? ` (${sync})` : "");
}
