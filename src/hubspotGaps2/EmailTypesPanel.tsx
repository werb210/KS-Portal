// KS_EMAIL_SUBSCRIPTION_TYPES_v1 - Marketing > Email types: the kinds of marketing email this brokerage sends.
// Contacts choose which types they get on the preferences page linked from every campaign email.
import { useEffect, useState } from "react";
import { api } from "@/api";
import { safeGet } from "./safeGet";
import { Notice, button, errText, input, quiet } from "@/settingsPack/ui";

type SubType = { id: string; name: string; description: string | null; active: boolean; sort_order: number; opted_out: number };
const unwrap = <T,>(r: unknown): T => ((r as { data?: T })?.data ?? r) as T;

export default function EmailTypesPanel() {
  const [types, setTypes] = useState<SubType[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = () => void safeGet("/api/marketing/subscription-types")
    .then((r) => setTypes(unwrap<{ types: SubType[] }>(r).types ?? []))
    .catch((e) => setErr(errText(e, "Could not load email types.")));
  useEffect(load, []);

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setErr(null); setOk(null);
    try { await fn(); setOk(done); load(); } catch (e) { setErr(errText(e, "Could not save.")); }
  };

  return (
    <div>
      <p style={{ marginTop: 0, color: "var(--ui-text-muted)", fontSize: 13 }}>
        Sort your marketing email into types. Every campaign email has a link where people choose the types they want or
        unsubscribe from all. Pick a type when you send a campaign and anyone who turned it off is skipped.
        Emails about a client's own application are never affected.
      </p>
      <Notice error={err} ok={ok} />
      {types && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
          <thead><tr>{["Type", "Turned off by", "Shown on the page", ""].map((h) => <th key={h} style={{ textAlign: "left", padding: 8, color: "var(--ui-text-muted)" }}>{h}</th>)}</tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--ui-border)" }}>
                <td style={{ padding: 8, color: "var(--ui-text)" }}><div style={{ fontWeight: 600 }}>{t.name}</div><div style={{ color: "var(--ui-text-muted)", fontSize: 12 }}>{t.description}</div></td>
                <td style={{ padding: 8, color: "var(--ui-text)" }}>{t.opted_out} {t.opted_out === 1 ? "person" : "people"}</td>
                <td style={{ padding: 8, color: "var(--ui-text)" }}>{t.active ? "Yes" : "No (hidden)"}</td>
                <td style={{ padding: 8 }}>
                  <button type="button" style={quiet} onClick={() => void run(() => api.put(`/api/marketing/subscription-types/${t.id}`, { ...t, active: !t.active }), t.active ? "Type hidden." : "Type shown.")}>
                    {t.active ? "Hide" : "Show"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h4 style={{ margin: "0 0 6px", fontSize: 14, color: "var(--ui-text)" }}>Add a type</h4>
      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <label htmlFor="et-name" style={{ fontSize: 13, color: "var(--ui-text)" }}>Name<input id="et-name" value={name} onChange={(e) => setName(e.target.value)} style={input} /></label>
        <label htmlFor="et-desc" style={{ fontSize: 13, color: "var(--ui-text)" }}>What people get<input id="et-desc" value={description} onChange={(e) => setDescription(e.target.value)} style={input} /></label>
        <div><button type="button" style={button} disabled={!name.trim()} onClick={() => void run(async () => { await api.post("/api/marketing/subscription-types", { name, description }); setName(""); setDescription(""); }, "Type added.")}>Add type</button></div>
      </div>
    </div>
  );
}
