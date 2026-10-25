// KS_PORTAL_v6_SUPPORT - support tickets from the licensee's staff to the Keystone vendor, relayed by KS-server.
// POST /api/support/tickets { subject, body, priority } -> { ok, ticket }
// GET  /api/support/tickets -> { tickets: [...] } and, when the server supplies it, the vendor's support hours and
// channels (`support: { hours?, channels?, text? }` or `support_info: "..."`). 404 = the server has no tickets yet.
// KS_PORTAL_v17_TICKET_REPLIES - POST /api/support/tickets/:id/messages { body } -> { ok, message, relayed }: a
// follow-up reply on one of the company's requests (KS-server relays it to the vendor).
import { api } from "@/api";

export type TicketPriority = "normal" | "urgent";
export type Ticket = { id: string; subject: string; priority: TicketPriority; status: string; created_at: string | null };
export type TicketList = { available: boolean; tickets: Ticket[]; supportText: string[] };

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const statusOf = (e: unknown): number | null => {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : null;
};

function toTicket(raw: unknown): Ticket | null {
  const t = obj(raw);
  const id = str(t.id);
  if (!id) return null;
  return {
    id,
    subject: str(t.subject) || "(no subject)",
    priority: t.priority === "urgent" ? "urgent" : "normal",
    status: str(t.status) || "open",
    created_at: str(t.created_at) || null,
  };
}

/** The vendor's support hours / channels as lines of text; empty when the server does not supply them. */
export function supportTextFrom(body: unknown): string[] {
  const b = obj(body);
  const lines: string[] = [];
  const info = b.support ?? b.support_info ?? b.vendor_support;
  if (typeof info === "string") {
    if (info.trim()) lines.push(info.trim());
    return lines;
  }
  const s = obj(info);
  const text = str(s.text) || str(s.message);
  if (text) lines.push(text);
  const hours = str(s.hours);
  if (hours) lines.push(`Hours: ${hours}`);
  const ch = s.channels;
  if (Array.isArray(ch)) {
    const list = ch.map((c) => (typeof c === "string" ? c.trim() : [str(obj(c).label), str(obj(c).value)].filter(Boolean).join(": "))).filter(Boolean);
    if (list.length) lines.push(`Channels: ${list.join(", ")}`);
  } else if (str(ch)) {
    lines.push(`Channels: ${str(ch)}`);
  }
  return lines;
}

export async function listTickets(): Promise<TicketList> {
  try {
    const body = await api.get<unknown>("/api/support/tickets");
    const b = obj(body);
    const raw = Array.isArray(body) ? body : Array.isArray(b.tickets) ? b.tickets : [];
    const tickets = (raw as unknown[]).map(toTicket).filter((t): t is Ticket => t !== null);
    return { available: true, tickets, supportText: supportTextFrom(body) };
  } catch (e) {
    if (statusOf(e) !== 404) console.warn("[support] could not load tickets", e);
    return { available: statusOf(e) !== 404, tickets: [], supportText: [] };
  }
}

export async function createTicket(input: { subject: string; body: string; priority: TicketPriority }): Promise<{ ok: true; ticket: Ticket | null } | { ok: false; error: string }> {
  try {
    const res = await api.post<unknown>("/api/support/tickets", input);
    return { ok: true, ticket: toTicket(obj(res).ticket) };
  } catch (e) {
    const status = statusOf(e);
    if (status === 404) return { ok: false, error: "Support requests are not available yet. Please email your account contact." };
    if (status === 403) return { ok: false, error: "Your account cannot send support requests." };
    const d = obj((e as { details?: unknown } | null)?.details);
    const errs = Array.isArray(d.errors) ? d.errors.map(str).filter(Boolean) : [];
    if (status === 400 && errs.length) return { ok: false, error: errs.join(" ") };
    const msg = str(d.message);
    return { ok: false, error: msg && !/^[a-z_]+$/.test(msg) ? msg : "Could not send your request. Please try again." };
  }
}

// KS_PORTAL_v17_TICKET_REPLIES
export async function replyToTicket(ticketId: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await api.post<unknown>(`/api/support/tickets/${encodeURIComponent(ticketId)}/messages`, { body });
    return { ok: true };
  } catch (e) {
    const status = statusOf(e);
    if (status === 404) return { ok: false, error: "Replies are not available yet. Please email your account contact." };
    if (status === 403) return { ok: false, error: "Your account cannot send support requests." };
    return { ok: false, error: "Could not send your reply. Please try again." };
  }
}
