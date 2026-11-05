// KS_LANDING_PAGES_v1 - Marketing > Landing pages: build a page from blocks, preview it, publish it.
import { useEffect, useMemo, useState } from "react";
import { api } from "@/api";
import { safeGet } from "./safeGet";
import { Notice, button, danger, errText, input, quiet } from "@/settingsPack/ui";

export type Block =
  | { type: "hero"; heading: string; text: string; image_url: string; button_text: string; button_link: string }
  | { type: "text"; heading: string; text: string }
  | { type: "image"; url: string; alt: string }
  | { type: "bullets"; heading: string; items: string[] }
  | { type: "button"; text: string; link: string }
  | { type: "form"; form_id: string; heading: string };
type Page = { id: string; slug: string; title: string; description: string | null; status: "draft" | "published"; blocks: Block[]; views: number; submissions: number; url: string };
type Draft = { id?: string; title: string; slug: string; description: string; status: "draft" | "published"; blocks: Block[] };
type KitForm = { id: string; name: string; active: boolean };

const unwrap = <T,>(r: unknown): T => ((r as { data?: T })?.data ?? r) as T;

export const BLOCK_LABELS: Record<Block["type"], string> = {
  hero: "Headline", text: "Text", image: "Picture", bullets: "List", button: "Button", form: "Form",
};

export function newBlock(type: Block["type"]): Block {
  switch (type) {
    case "hero": return { type, heading: "", text: "", image_url: "", button_text: "Apply now", button_link: "#form" };
    case "text": return { type, heading: "", text: "" };
    case "image": return { type, url: "", alt: "" };
    case "bullets": return { type, heading: "", items: [""] };
    case "button": return { type, text: "Apply now", link: "#form" };
    case "form": return { type, form_id: "", heading: "Tell us about your business" };
  }
}

export function moveBlock(blocks: Block[], i: number, by: -1 | 1): Block[] {
  const j = i + by;
  if (j < 0 || j >= blocks.length) return blocks;
  const next = [...blocks];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

const label = { display: "block", fontSize: 13, fontWeight: 600, margin: "8px 0 4px", color: "var(--ui-text)" } as const;
const hint = { fontSize: 12, color: "var(--ui-text-muted)", margin: "2px 0 0" } as const;

function Text({ id, name, value, onChange, area, placeholder }: { id: string; name: string; value: string; onChange: (v: string) => void; area?: boolean; placeholder?: string }) {
  return (
    <>
      <label htmlFor={id} style={label}>{name}</label>
      {area
        ? <textarea id={id} value={value} rows={4} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={input} />
        : <input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={input} />}
    </>
  );
}

function BlockEditor({ b, i, forms, onChange }: { b: Block; i: number; forms: KitForm[]; onChange: (b: Block) => void }) {
  const id = (k: string) => `lp-${i}-${k}`;
  switch (b.type) {
    case "hero":
      return <>
        <Text id={id("h")} name="Headline" value={b.heading} onChange={(v) => onChange({ ...b, heading: v })} />
        <Text id={id("t")} name="Short text under it" value={b.text} area onChange={(v) => onChange({ ...b, text: v })} />
        <Text id={id("i")} name="Picture address (https://, optional)" value={b.image_url} onChange={(v) => onChange({ ...b, image_url: v })} />
        <Text id={id("bt")} name="Button text" value={b.button_text} onChange={(v) => onChange({ ...b, button_text: v })} />
        <Text id={id("bl")} name="Button goes to" value={b.button_link} placeholder="#form, https://..., tel:... or mailto:..." onChange={(v) => onChange({ ...b, button_link: v })} />
      </>;
    case "text":
      return <>
        <Text id={id("h")} name="Heading (optional)" value={b.heading} onChange={(v) => onChange({ ...b, heading: v })} />
        <Text id={id("t")} name="Text" value={b.text} area onChange={(v) => onChange({ ...b, text: v })} />
        <p style={hint}>Leave a blank line between paragraphs.</p>
      </>;
    case "image":
      return <>
        <Text id={id("u")} name="Picture address (https://)" value={b.url} onChange={(v) => onChange({ ...b, url: v })} />
        <Text id={id("a")} name="Describe the picture (for screen readers)" value={b.alt} onChange={(v) => onChange({ ...b, alt: v })} />
      </>;
    case "bullets":
      return <>
        <Text id={id("h")} name="Heading (optional)" value={b.heading} onChange={(v) => onChange({ ...b, heading: v })} />
        <Text id={id("l")} name="Items, one per line" value={b.items.join("\n")} area onChange={(v) => onChange({ ...b, items: v.split("\n") })} />
      </>;
    case "button":
      return <>
        <Text id={id("t")} name="Button text" value={b.text} onChange={(v) => onChange({ ...b, text: v })} />
        <Text id={id("l")} name="Button goes to" value={b.link} placeholder="#form, https://..., tel:... or mailto:..." onChange={(v) => onChange({ ...b, link: v })} />
      </>;
    case "form":
      return <>
        <Text id={id("h")} name="Heading above the form" value={b.heading} onChange={(v) => onChange({ ...b, heading: v })} />
        <label htmlFor={id("f")} style={label}>Form</label>
        <select id={id("f")} value={b.form_id} onChange={(e) => onChange({ ...b, form_id: e.target.value })} style={input}>
          <option value="">Choose a form</option>
          {forms.map((f) => <option key={f.id} value={f.id}>{f.name}{f.active ? "" : " (paused)"}</option>)}
        </select>
        <p style={hint}>Forms are made in Marketing &gt; Website kit. A submission becomes a lead in the CRM.</p>
      </>;
  }
}

function Editor({ initial, forms, onDone }: { initial: Draft; forms: KitForm[]; onDone: (msg: string) => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [preview, setPreview] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blocksKey = useMemo(() => JSON.stringify(d.blocks) + d.title, [d.blocks, d.title]);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      void api.post<{ html?: string; data?: { html?: string } }>("/api/marketing/landing-pages/preview", { title: d.title, blocks: d.blocks })
        .then((r) => { if (alive) setPreview(unwrap<{ html?: string }>(r)?.html ?? ""); })
        .catch(() => { if (alive) setPreview(""); });
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [blocksKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const setBlock = (i: number, b: Block) => setD({ ...d, blocks: d.blocks.map((x, j) => (j === i ? b : x)) });
  const save = async (status: Draft["status"]) => {
    setBusy(true); setErr(null);
    try {
      const body = { ...d, status };
      if (d.id) await api.put(`/api/marketing/landing-pages/${d.id}`, body);
      else await api.post("/api/marketing/landing-pages", body);
      onDone(status === "published" ? "Page published." : "Draft saved.");
    } catch (e) { setErr(errText(e, "Could not save the page.")); } finally { setBusy(false); }
  };
  const hasForm = d.blocks.some((b) => b.type === "form");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1fr) minmax(300px, 1fr)", gap: 16 }}>
      <div>
        <Text id="lp-title" name="Page title" value={d.title} onChange={(v) => setD({ ...d, title: v })} />
        <Text id="lp-slug" name="Web address" value={d.slug} placeholder="made from the title if empty" onChange={(v) => setD({ ...d, slug: v })} />
        <Text id="lp-desc" name="Search description (optional)" value={d.description} onChange={(v) => setD({ ...d, description: v })} />
        <h4 style={{ margin: "16px 0 6px", fontSize: 14, color: "var(--ui-text)" }}>Blocks</h4>
        {d.blocks.length === 0 && <p style={hint}>Add a headline to start.</p>}
        {d.blocks.map((b, i) => (
          <div key={i} style={{ border: "1px solid var(--ui-border)", borderRadius: 10, padding: 10, marginBottom: 10, background: "var(--ui-surface)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <strong style={{ flex: 1, fontSize: 13, color: "var(--ui-text)" }}>{BLOCK_LABELS[b.type]}</strong>
              <button type="button" style={quiet} aria-label={`Move ${BLOCK_LABELS[b.type]} up`} disabled={i === 0} onClick={() => setD({ ...d, blocks: moveBlock(d.blocks, i, -1) })}>Up</button>
              <button type="button" style={quiet} aria-label={`Move ${BLOCK_LABELS[b.type]} down`} disabled={i === d.blocks.length - 1} onClick={() => setD({ ...d, blocks: moveBlock(d.blocks, i, 1) })}>Down</button>
              <button type="button" style={danger} aria-label={`Remove ${BLOCK_LABELS[b.type]}`} onClick={() => setD({ ...d, blocks: d.blocks.filter((_, j) => j !== i) })}>Remove</button>
            </div>
            <BlockEditor b={b} i={i} forms={forms} onChange={(nb) => setBlock(i, nb)} />
          </div>
        ))}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 16px" }}>
          {(Object.keys(BLOCK_LABELS) as Block["type"][]).filter((t) => t !== "form" || !hasForm).map((t) => (
            <button key={t} type="button" style={quiet} onClick={() => setD({ ...d, blocks: [...d.blocks, newBlock(t)] })}>+ {BLOCK_LABELS[t]}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={quiet} disabled={busy} onClick={() => void save("draft")}>Save draft</button>
          <button type="button" style={button} disabled={busy} onClick={() => void save("published")}>Publish</button>
          <button type="button" style={quiet} disabled={busy} onClick={() => onDone("")}>Cancel</button>
        </div>
        <Notice error={err} />
      </div>
      <div>
        <p style={{ ...label, marginTop: 0 }}>Preview</p>
        <iframe title="Page preview" sandbox="" srcDoc={preview} style={{ width: "100%", height: 640, border: "1px solid var(--ui-border)", borderRadius: 10, background: "#fff" }} />
      </div>
    </div>
  );
}

export default function LandingPagesPanel() {
  const [pages, setPages] = useState<Page[] | null>(null);
  const [forms, setForms] = useState<KitForm[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    void safeGet("/api/marketing/landing-pages").then((r) => setPages(unwrap<{ pages: Page[] }>(r).pages ?? [])).catch((e) => setErr(errText(e, "Could not load landing pages.")));
    void safeGet("/api/website-kit").then((r) => setForms(unwrap<{ forms: KitForm[] }>(r).forms ?? [])).catch(() => setForms([]));
  };
  useEffect(load, []);

  if (editing) {
    return <Editor initial={editing} forms={forms} onDone={(m) => { setEditing(null); setMsg(m || null); load(); }} />;
  }
  const remove = async (p: Page) => {
    if (!window.confirm(`Delete the page "${p.title}"? Its web address stops working.`)) return;
    try { await api.delete(`/api/marketing/landing-pages/${p.id}`); setMsg("Page deleted."); load(); } catch (e) { setErr(errText(e, "Could not delete the page.")); }
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <p style={{ flex: 1, margin: 0, color: "var(--ui-text-muted)", fontSize: 13 }}>Pages for ads and campaigns. A form on a page puts the person straight into the CRM.</p>
        <button type="button" style={button} onClick={() => setEditing({ title: "", slug: "", description: "", status: "draft", blocks: [newBlock("hero"), newBlock("form")] })}>New page</button>
      </div>
      <Notice error={err} ok={msg} />
      {pages && pages.length === 0 && <p style={{ color: "var(--ui-text-muted)" }}>No landing pages yet.</p>}
      {pages && pages.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["Page", "Status", "Views", "Leads", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: 8, color: "var(--ui-text-muted)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--ui-border)" }}>
                <td style={{ padding: 8, color: "var(--ui-text)" }}>
                  <div style={{ fontWeight: 600 }}>{p.title}</div>
                  {p.status === "published" ? <a href={p.url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{p.url}</a> : <span style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>Not live yet</span>}
                </td>
                <td style={{ padding: 8, color: "var(--ui-text)" }}>{p.status === "published" ? "Live" : "Draft"}</td>
                <td style={{ padding: 8, color: "var(--ui-text)" }}>{p.views}</td>
                <td style={{ padding: 8, color: "var(--ui-text)" }}>{p.submissions}</td>
                <td style={{ padding: 8, whiteSpace: "nowrap" }}>
                  <button type="button" style={quiet} onClick={() => setEditing({ id: p.id, title: p.title, slug: p.slug, description: p.description ?? "", status: p.status, blocks: p.blocks })}>Edit</button>{" "}
                  <button type="button" style={danger} onClick={() => void remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
