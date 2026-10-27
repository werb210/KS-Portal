// KS_PORTAL_KB_v1 - the Help Center at the top of Get help (and Settings > Help): search Keystone's help articles,
// browse by category, read an article, and "Ask Maya", Keystone's support assistant. Maya answers from the articles
// and links the ones it used; when it can't help, or the person asks for a person, it offers "Contact support", which
// sends a normal support request with the conversation and the articles tried. Articles open in place (?article=slug
// opens one directly). Dark text on light tints: readable on the light and dark portal themes.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import DOMPurify from "dompurify";
import { useSearchParams } from "react-router-dom";
import { MayaMessage } from "@/components/maya/mayaMarkdown";
import { primaryButton } from "@/plans/ui";
import {
  askMaya, contactSupport, getArticle, listCategories, searchArticles,
  type Article, type ArticleSummary, type Citation, type Turn,
} from "@/support/helpCenterApi";

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16 };
const h3: CSSProperties = { margin: "0 0 4px", fontSize: 16, color: "var(--ui-text)" };
const muted: CSSProperties = { color: "var(--ui-text-muted)", fontSize: 13, margin: "0 0 12px" };
const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 8, border: "1px solid var(--ui-border)",
  background: "var(--ui-surface-input, var(--ui-surface))", color: "var(--ui-text)", fontSize: 15,
};
const quietButton: CSSProperties = { background: "none", border: "1px solid var(--ui-border)", borderRadius: 8, padding: "6px 12px", color: "var(--ui-text)", cursor: "pointer", fontSize: 14 };
const linkButton: CSSProperties = { background: "none", border: "none", padding: 0, color: "var(--ui-link, var(--ui-text))", textDecoration: "underline", cursor: "pointer", fontSize: 14, textAlign: "left" };
const chip = (on: boolean): CSSProperties => ({
  border: "1px solid var(--ui-border)", borderRadius: 999, padding: "4px 12px", fontSize: 13, cursor: "pointer",
  background: on ? "#1e3a8a" : "transparent", color: on ? "#ffffff" : "var(--ui-text)", fontWeight: on ? 700 : 500,
});
// Plan badge: dark text on a pale fill.
const planBadge: CSSProperties = { marginLeft: 8, padding: "1px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#fef3c7", color: "#78350f", whiteSpace: "nowrap" };
const errorBox: CSSProperties = { background: "#fef2f2", color: "#7f1d1d", border: "1px solid #fca5a5", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 8 };
const okBox: CSSProperties = { background: "#ecfdf5", color: "#064e3b", border: "1px solid #6ee7b7", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 8 };
const bubble = (mine: boolean): CSSProperties => ({
  alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "88%", padding: "8px 12px", borderRadius: 12, fontSize: 14, lineHeight: 1.5,
  background: mine ? "#1e3a8a" : "var(--ui-surface, #f1f5f9)", color: mine ? "#ffffff" : "var(--ui-text)", border: mine ? "none" : "1px solid var(--ui-border)",
});

// Article bodies come from Keystone's own renderer (escaped, a few tags only) and are sanitised again here.
const ARTICLE_CSS = `
.kb-article { font-size: 15px; line-height: 1.6; color: var(--ui-text); }
.kb-article h2, .kb-article h3, .kb-article h4 { margin: 18px 0 6px; color: var(--ui-text); }
.kb-article h2 { font-size: 18px; } .kb-article h3 { font-size: 16px; } .kb-article h4 { font-size: 15px; }
.kb-article ol { list-style: decimal; padding-left: 22px; } .kb-article ul { list-style: disc; padding-left: 22px; }
.kb-article li { margin: 3px 0; }
.kb-article a { color: var(--ui-link, var(--ui-text)); text-decoration: underline; }
.kb-article blockquote { margin: 12px 0; padding: 8px 12px; border-left: 4px solid #1e3a8a; background: #eef4fb; color: #0f172a; border-radius: 6px; }
.kb-article code { background: #eef0f3; color: #0f172a; padding: 1px 5px; border-radius: 4px; }
.kb-article img { max-width: 100%; height: auto; border: 1px solid var(--ui-border); border-radius: 6px; }
.kb-article .kb-table { overflow-x: auto; }
.kb-article table { border-collapse: collapse; margin: 10px 0; font-size: 14px; }
.kb-article th, .kb-article td { border: 1px solid var(--ui-border); padding: 6px 10px; text-align: left; vertical-align: top; }
.kb-article th { font-weight: 700; }
`;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function ArticleView({ slug, onOpen, onBack }: { slug: string; onOpen: (slug: string) => void; onBack: () => void }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setArticle(null);
    setError(null);
    void getArticle(slug).then((r) => {
      if (!live) return;
      if (r.ok) setArticle(r.value);
      else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [slug]);
  const html = useMemo(() => (article ? DOMPurify.sanitize(article.body_html, { ADD_ATTR: ["target", "data-kb-slug"] }) : ""), [article]);
  // A link to another article (data-kb-slug) opens it here instead of leaving the page.
  const onClick = (ev: MouseEvent<HTMLDivElement>) => {
    const a = (ev.target as HTMLElement).closest("a");
    const next = a?.getAttribute("data-kb-slug");
    if (next) {
      ev.preventDefault();
      onOpen(next);
    }
  };
  return (
    <section style={card} data-testid="help-article" aria-live="polite">
      <button type="button" style={linkButton} onClick={onBack}>Back to help articles</button>
      {error && <div role="alert" style={errorBox}>{error}</div>}
      {!article && !error && <p style={muted}>Loading…</p>}
      {article && (
        <>
          <h3 style={{ ...h3, fontSize: 20, marginTop: 10 }}>
            {article.title}
            {article.plans_label && <span style={planBadge}>{article.plans_label}</span>}
          </h3>
          <p style={muted}>
            {article.category}
            {formatDate(article.updated_at) && ` · Last updated ${formatDate(article.updated_at)}`}
            {!article.on_your_plan && " · Not on your current plan"}
          </p>
          <div className="kb-article" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
        </>
      )}
    </section>
  );
}

function AskMaya({ onOpen, canContact }: { onOpen: (slug: string) => void; canContact: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [cited, setCited] = useState<Citation[][]>([]);
  const [tried, setTried] = useState<Citation[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [note, setNote] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [sent, setSent] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [turns.length]);

  const ask = async () => {
    const q = text.trim();
    if (!q || busy) return;
    const next: Turn[] = [...turns, { role: "user", text: q }];
    setTurns(next);
    setCited((c) => [...c, []]);
    setText("");
    setError(null);
    setBusy(true);
    const r = await askMaya(next.slice(-12));
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      setOffer(true);
      return;
    }
    setTurns([...next, { role: "assistant", text: r.value.answer }]);
    setCited((c) => [...c, r.value.citations]);
    setTried((t) => {
      const all = [...t];
      for (const a of [...r.value.citations, ...r.value.related]) if (!all.some((x) => x.slug === a.slug)) all.push(a);
      return all;
    });
    if (r.value.offerSupport) setOffer(true);
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    const r = await contactSupport({ messages: turns, articles: tried, note, priority: urgent ? "urgent" : "normal" });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setSent(true);
    setContactOpen(false);
  };

  return (
    <section style={card} data-testid="ask-maya" aria-labelledby="ask-maya-title">
      <h3 id="ask-maya-title" style={h3}>Ask Maya</h3>
      <p style={muted}>Maya is Keystone's support assistant. It answers from the help articles and links the ones it used. Questions don't use your assistant chat allowance.</p>
      {turns.length > 0 && (
        <div role="log" aria-label="Conversation with Maya" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {turns.map((t, i) => (
            <div key={i} style={bubble(t.role === "user")} data-testid={t.role === "user" ? "maya-question" : "maya-answer"}>
              {t.role === "user" ? t.text : <MayaMessage message={t.text} />}
              {t.role === "assistant" && (cited[i] ?? []).length > 0 && (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <strong>From the help articles:</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18, listStyleType: "disc" }}>
                    {(cited[i] ?? []).map((c) => (
                      <li key={c.slug}><button type="button" style={linkButton} onClick={() => onOpen(c.slug)}>{c.title}</button></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {busy && <div style={bubble(false)} aria-live="polite">Maya is looking…</div>}
          <div ref={endRef} />
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void ask(); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label htmlFor="maya-question" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Your question for Maya</label>
        <input id="maya-question" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="For example: how do I add a user?" style={{ ...inputStyle, flex: "1 1 240px" }} />
        <button type="submit" style={primaryButton} disabled={busy || !text.trim()}>Ask</button>
      </form>
      {error && <div role="alert" style={errorBox}>{error}</div>}
      {sent && <div role="status" style={okBox}>Sent to Keystone support with this conversation. They'll reply by email.</div>}
      {canContact && !sent && (offer || turns.length > 0) && !contactOpen && (
        <div style={{ marginTop: 12 }}>
          {offer && <p style={{ ...muted, margin: "0 0 6px" }}>Not solved? The support team can help.</p>}
          <button type="button" style={offer ? primaryButton : quietButton} onClick={() => setContactOpen(true)}>Contact support</button>
        </div>
      )}
      {contactOpen && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--ui-border)", paddingTop: 12 }} data-testid="maya-contact">
          <p style={{ ...muted, margin: "0 0 8px" }}>We'll send this conversation and the {tried.length} article{tried.length === 1 ? "" : "s"} Maya tried. Add anything else that helps.</p>
          <label htmlFor="maya-note" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Anything to add? (optional)</label>
          <textarea id="maya-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
          <label style={{ display: "block", fontSize: 14, margin: "8px 0" }}>
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Urgent - work is stopped
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={primaryButton} disabled={busy} onClick={() => void send()}>Send to support</button>
            <button type="button" style={quietButton} onClick={() => setContactOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function HelpCenter({ canContact = true }: { canContact?: boolean }) {
  const [params, setParams] = useSearchParams();
  const openSlug = params.get("article");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<Array<{ category: string; count: number }>>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const open = useCallback((slug: string | null) => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      if (slug) n.set("article", slug);
      else n.delete("article");
      return n;
    });
  }, [setParams]);

  useEffect(() => {
    void listCategories().then((r) => {
      if (r.ok) setCategories(r.value);
    });
  }, []);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      void searchArticles(q, category).then((r) => {
        if (!live) return;
        setLoaded(true);
        if (r.ok) {
          setArticles(r.value);
          setError(null);
        } else {
          setArticles([]);
          setError(r.error);
        }
      });
    }, q ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, category]);

  return (
    <div data-testid="help-center">
      <style>{ARTICLE_CSS}</style>
      <section style={card}>
        <h3 style={h3}>Help Center</h3>
        <p style={muted}>Search Keystone's help articles, or ask Maya below.</p>
        <label htmlFor="help-search" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Search help articles</label>
        <input id="help-search" type="search" value={q} maxLength={300} placeholder="Search help articles" onChange={(e) => setQ(e.target.value)} style={inputStyle} />
        {categories.length > 0 && (
          <div role="group" aria-label="Categories" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <button type="button" style={chip(category === "")} aria-pressed={category === ""} onClick={() => setCategory("")}>All</button>
            {categories.map((c) => (
              <button key={c.category} type="button" style={chip(category === c.category)} aria-pressed={category === c.category} onClick={() => setCategory(c.category)}>
                {c.category}
              </button>
            ))}
          </div>
        )}
        {error && <div role="alert" style={errorBox}>{error}</div>}
        {!openSlug && loaded && !error && (
          articles.length === 0 ? (
            <p style={{ ...muted, marginTop: 12 }}>No articles match. Try other words, or ask Maya.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }} data-testid="help-results">
              {articles.slice(0, q ? 20 : 80).map((a) => (
                <li key={a.slug} style={{ padding: "8px 0", borderTop: "1px solid var(--ui-border)" }}>
                  <button type="button" style={{ ...linkButton, fontWeight: 600, fontSize: 15 }} onClick={() => open(a.slug)}>{a.title}</button>
                  {a.plans_label && <span style={planBadge}>{a.plans_label}</span>}
                  <div style={{ fontSize: 13, color: "var(--ui-text-muted)", marginTop: 2 }}>{a.category}{a.summary ? ` · ${a.summary}` : ""}</div>
                </li>
              ))}
            </ul>
          )
        )}
      </section>
      {openSlug && <ArticleView slug={openSlug} onOpen={open} onBack={() => open(null)} />}
      <AskMaya onOpen={open} canContact={canContact} />
    </div>
  );
}
