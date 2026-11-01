// KS_PORTAL_GMAIL_INBOX - KS-server /api/google/gmail: a Google user's own inbox (read-only), once Gmail inbox reading
// is switched on (after Google's CASA review). While it is off the server answers 409 gmail_read_pending.
import { useEffect, useState } from "react";
import { api } from "@/api";
import { fetchGoogleStatus } from "@/lib/workspace";

export const GMAIL_READ_PENDING = "Gmail inbox reading is pending Google's security review.";

export type GmailThreadRow = { id: string; subject: string; from: string; date: string | null; snippet: string; messages: number; unread: boolean };
export type GmailMessageView = {
  id: string; threadId: string; subject: string; from: string; fromAddress: string; to: string[]; cc: string[]; date: string | null;
  snippet: string; unread: boolean; bodyHtml: string; logged?: boolean;
  attachments: Array<{ id: string; name: string; contentType: string; size: number }>;
};
export type GmailThreadView = { id: string; messages: GmailMessageView[]; contacts: Array<{ id: string; name: string | null; email: string }> };
export type GmailStatus = { enabled: boolean; connected: boolean; granted: boolean; message: string | null; last_synced_at: string | null; first_sync_done: boolean; last_error: string | null };

export const getGmailStatus = () => api.get<GmailStatus>("/api/google/gmail/status");
export const listGmailThreads = (params: { q?: string; label?: string; pageToken?: string }) =>
  api.get<{ threads: GmailThreadRow[]; nextPageToken: string | null }>("/api/google/gmail/threads", { params });
export const getGmailThread = (id: string) => api.get<GmailThreadView>(`/api/google/gmail/threads/${encodeURIComponent(id)}`);
export const fileGmailToCrm = (messageId: string, attachment?: number) =>
  api.post<{ filed: number; duplicates?: number; contactId: string | null; reason?: string }>(`/api/google/gmail/messages/${encodeURIComponent(messageId)}/file-to-crm`, attachment === undefined ? {} : { attachment });
export const syncGmailNow = () => api.post<{ mode: string; inbound: number; outbound: number }>("/api/google/gmail/sync", {});
export const gmailAttachmentPath = (messageId: string, index: string) => `/api/google/gmail/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(index)}`;

/** True when this person should see the Gmail tab: Google connected and inbox reading switched on for the server. */
export function useGmailInboxAvailable(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    void fetchGoogleStatus().then((s) => { if (alive) setOn(s.connected && s.gmailReadEnabled); });
    return () => { alive = false; };
  }, []);
  return on;
}
