// KS_META_LEAD_ADS_v1 - Settings > Connections: Facebook and Instagram lead ads. An Admin connects the company's
// Facebook Pages once; every lead form filled in on an ad then becomes a lead in the CRM (tagged facebook_lead).
import { useEffect, useState, type CSSProperties } from "react";
import { api } from "@/api";
import { safeGet } from "./safeGet";

type Page = { page_id: string; page_name: string; active: boolean; tag: string | null; leads: number; last_lead_at: string | null };
type Status = { configured: boolean; missing: string[]; pages: Page[] };

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16 };
const btn: CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const quiet: CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface-strong)", color: "var(--ui-text)", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const box = (bg: string, fg: string, bd: string): CSSProperties => ({ background: bg, color: fg, border: `1px solid ${bd}`, borderRadius: 8, padding: "8px 12px", fontSize: 14, marginTop: 10 });
const unwrap = <T,>(r: unknown): T => ((r as { data?: T })?.data ?? r) as T;

const REASONS: Record<string, string> = {
  state: "The sign-in took too long or was opened in another browser. Try again.",
  exchange: "Facebook did not accept the sign-in. Try again.",
  no_pages: "That Facebook account does not manage any Pages. Sign in with an account that is an admin of your Page.",
  subscribe: "Facebook would not send leads for those Pages. Check that you are a Page admin and try again.",
  access_denied: "Facebook Login was cancelled.",
};

export function metaOutcome(search: string): { ok: boolean; text: string } | null {
  const q = new URLSearchParams(search);
  const m = q.get("meta");
  if (m === "connected") return { ok: true, text: "Facebook is connected. New leads from your lead ads will appear in the CRM." };
  if (m === "error") return { ok: false, text: REASONS[q.get("reason") ?? ""] ?? "Facebook could not be connected. Try again." };
  return null;
}

export default function MetaLeadAdsCard() {
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [outcome] = useState(() => metaOutcome(window.location.search));
  const load = () => void safeGet("/api/integrations/meta/status").then((r) => { const v = r ? unwrap<Status>(r) : null; setS(v && Array.isArray(v.pages) ? v : null); }).catch(() => setErr("Facebook lead ads could not be loaded."));
  useEffect(load, []);

  const connect = async () => {
    setErr(null);
    try {
      const r = unwrap<{ url?: string }>(await api.get("/api/integrations/meta/start"));
      if (r.url) window.location.assign(r.url);
    } catch { setErr("Facebook Login could not start. Try again."); }
  };
  const patch = async (p: Page, body: Partial<Page>) => {
    try { await api.patch(`/api/integrations/meta/pages/${p.page_id}`, body); load(); } catch { setErr("Could not save that change."); }
  };
  const remove = async (p: Page) => {
    if (!window.confirm(`Stop taking leads from ${p.page_name}?`)) return;
    try { await api.delete(`/api/integrations/meta/pages/${p.page_id}`); load(); } catch { setErr("Could not remove that Page."); }
  };

  return (
    <section style={card} aria-labelledby="meta-leads-h">
      <h3 id="meta-leads-h" style={{ margin: "0 0 4px", fontSize: 17 }}>Facebook and Instagram lead ads</h3>
      <p style={{ color: "var(--ui-text-muted)", fontSize: 13, margin: "4px 0 0" }}>
        When someone fills in a lead form on your Facebook or Instagram ad, they appear in the CRM with their answers, and
        your team is told. Connect with a Facebook account that is an admin of your business Page.
      </p>
      {outcome && <div role="status" style={outcome.ok ? box("#ecfdf5", "#064e3b", "#6ee7b7") : box("#fef2f2", "#7f1d1d", "#fca5a5")}>{outcome.text}</div>}
      {err && <div role="alert" style={box("#fef2f2", "#7f1d1d", "#fca5a5")}>{err}</div>}
      {s && !s.configured && (
        <div style={box("#fffbeb", "#78350f", "#fcd34d")}>Not available yet: Keystone is finishing the Facebook set-up.</div>
      )}
      {s?.configured && (
        <>
          {s.pages.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 12 }}>
              <thead><tr>{["Page", "Leads", "Tag", "Taking leads", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: 6, color: "var(--ui-text-muted)" }}>{h}</th>)}</tr></thead>
              <tbody>
                {s.pages.map((p) => (
                  <tr key={p.page_id} style={{ borderTop: "1px solid var(--ui-border)" }}>
                    <td style={{ padding: 6 }}>{p.page_name}</td>
                    <td style={{ padding: 6 }}>{p.leads}{p.last_lead_at ? ` (last ${new Date(p.last_lead_at).toLocaleDateString("en-CA")})` : ""}</td>
                    <td style={{ padding: 6 }}>
                      <input aria-label={`Tag for leads from ${p.page_name}`} defaultValue={p.tag ?? ""} placeholder="facebook_lead"
                        onBlur={(e) => { if ((e.target.value || null) !== p.tag) void patch(p, { tag: e.target.value }); }}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--ui-border)", background: "var(--ui-surface)", color: "var(--ui-text)", width: 140 }} />
                    </td>
                    <td style={{ padding: 6 }}>
                      <input type="checkbox" aria-label={`Take leads from ${p.page_name}`} checked={p.active} onChange={(e) => void patch(p, { active: e.target.checked })} style={{ width: 18, height: 18 }} />
                    </td>
                    <td style={{ padding: 6 }}><button type="button" style={quiet} onClick={() => void remove(p)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 12 }}>
            <button type="button" style={btn} onClick={() => void connect()}>{s.pages.length ? "Connect more Pages" : "Connect Facebook"}</button>
          </div>
        </>
      )}
    </section>
  );
}
