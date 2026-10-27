// KS_PORTAL_KB_v1 - the Help Center: Keystone's shared help articles and "Ask Maya", Keystone's support assistant,
// relayed by KS-server from Keystone operations (KS-server /api/help-center).
//   GET  /api/help-center/categories                -> { categories: [{ category, count }] }
//   GET  /api/help-center/articles?q=&category=     -> { articles: [ArticleSummary] }
//   GET  /api/help-center/articles/:slug            -> { article: Article }
//   POST /api/help-center/ask { messages }          -> { answer, citations, related, offer_support, outcome }
//   POST /api/help-center/contact-support { messages, articles, note?, priority? } -> 201 { ok, ticket }
// Maya's questions are Keystone's cost: they never use the brokerage's assistant-chat allowance.
import { api } from "@/api";

export type ArticleSummary = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  plans_label: string;
  on_your_plan: boolean;
  updated_at: string | null;
};
export type Article = ArticleSummary & { body_html: string };
export type Citation = { slug: string; title: string; category?: string };
export type Turn = { role: "user" | "assistant"; text: string };
export type MayaReply = { answer: string; citations: Citation[]; related: Citation[]; offerSupport: boolean };

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const statusOf = (e: unknown): number | null => {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : null;
};
const messageOf = (e: unknown): string => {
  const d = obj((e as { details?: unknown } | null)?.details);
  const m = str(d.message);
  return m && !/^[a-z_]+$/.test(m) ? m : "";
};

function toSummary(raw: unknown): ArticleSummary | null {
  const a = obj(raw);
  const slug = str(a.slug);
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  return {
    slug,
    title: str(a.title) || slug,
    category: str(a.category),
    summary: str(a.summary),
    plans_label: str(a.plans_label),
    on_your_plan: a.on_your_plan !== false,
    updated_at: str(a.updated_at) || null,
  };
}

const toCitations = (raw: unknown): Citation[] =>
  (Array.isArray(raw) ? raw : [])
    .map((c) => ({ slug: str(obj(c).slug), title: str(obj(c).title), category: str(obj(c).category) }))
    .filter((c) => /^[a-z0-9-]{1,120}$/.test(c.slug) && c.title);

export type Result<T> = { ok: true; value: T } | { ok: false; status: number | null; error: string };

const UNAVAILABLE = "Help articles aren't available right now. You can still contact support below.";

export async function listCategories(): Promise<Result<Array<{ category: string; count: number }>>> {
  try {
    const b = obj(await api.get<unknown>("/api/help-center/categories"));
    const cats = (Array.isArray(b.categories) ? b.categories : []).map((c) => ({ category: str(obj(c).category), count: Number(obj(c).count) || 0 })).filter((c) => c.category);
    return { ok: true, value: cats };
  } catch (e) {
    return { ok: false, status: statusOf(e), error: messageOf(e) || UNAVAILABLE };
  }
}

export async function searchArticles(q: string, category: string): Promise<Result<ArticleSummary[]>> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (category) params.set("category", category);
  try {
    const b = obj(await api.get<unknown>(`/api/help-center/articles${params.toString() ? `?${params}` : ""}`));
    return { ok: true, value: (Array.isArray(b.articles) ? b.articles : []).map(toSummary).filter((a): a is ArticleSummary => a !== null) };
  } catch (e) {
    return { ok: false, status: statusOf(e), error: messageOf(e) || UNAVAILABLE };
  }
}

export async function getArticle(slug: string): Promise<Result<Article>> {
  try {
    const a = obj(obj(await api.get<unknown>(`/api/help-center/articles/${encodeURIComponent(slug)}`)).article);
    const s = toSummary(a);
    if (!s) return { ok: false, status: 404, error: "That article isn't available." };
    return { ok: true, value: { ...s, body_html: str(a.body_html) } };
  } catch (e) {
    const status = statusOf(e);
    return { ok: false, status, error: status === 404 ? "That article isn't available." : messageOf(e) || UNAVAILABLE };
  }
}

export async function askMaya(messages: Turn[]): Promise<Result<MayaReply>> {
  try {
    const b = obj(await api.post<unknown>("/api/help-center/ask", { messages }));
    return {
      ok: true,
      value: { answer: str(b.answer), citations: toCitations(b.citations), related: toCitations(b.related), offerSupport: b.offer_support === true },
    };
  } catch (e) {
    const status = statusOf(e);
    if (status === 429) return { ok: false, status, error: messageOf(e) || "You've asked a lot of questions in a short time. Please wait a little, or contact support." };
    return { ok: false, status, error: messageOf(e) || "Maya isn't available right now. You can contact support instead." };
  }
}

export async function contactSupport(input: { messages: Turn[]; articles: Citation[]; note: string; priority: "normal" | "urgent" }): Promise<Result<null>> {
  try {
    await api.post<unknown>("/api/help-center/contact-support", {
      messages: input.messages,
      articles: input.articles.map((a) => ({ slug: a.slug, title: a.title })),
      note: input.note,
      priority: input.priority,
    });
    return { ok: true, value: null };
  } catch (e) {
    const status = statusOf(e);
    return { ok: false, status, error: status === 403 ? "Your account cannot send support requests." : messageOf(e) || "Could not send your request. Please try again." };
  }
}
