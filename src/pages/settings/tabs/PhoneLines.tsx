// BF_PORTAL_PHONE_LINES_v689 - Settings -> Phone lines: give each staff member their own direct number.
// Calls to a direct number ring only that person (then their voicemail); calls to any other number go to the
// receptionist. Staff outbound calls show their own direct number.
// KS_PORTAL_PHONE_PROVISIONING (Todd, Oct 26) - fully automatic: "Get a number" offers an area code (from the
// brokerage's main line, phone or address), shows a few numbers for sale, and one click buys it into the brokerage's
// Twilio account with its voice and SMS webhooks set and gives it to the person. "Change number" buys a new one and
// "Release number" lets one go; either way the old number waits out the grace period first (Keep cancels it) and the
// Admins are told. Business line on every plan, toll-free line on Growth and Pro, direct lines on Pro.
import { useEffect, useState, type CSSProperties } from "react";
import { api } from "@/api";
import FeatureGate from "@/plans/FeatureGate";

type Kind = "main" | "toll_free" | "direct";
type Line = { id: string; name: string; email: string | null; direct_number: string | null };
type OwnedNumber = {
  id: string; phone_number: string; kind: Kind; status: "purchasing" | "active" | "releasing";
  assigned_user_id: string | null; assigned_name: string | null; locality: string | null; region: string | null;
  release_after: string | null; release_reason: string | null; last_error: string | null;
};
type Search = { country: string; area_code: string; region: string };
type Overview = {
  plan?: string;
  numbers: OwnedNumber[];
  limits: Record<Kind, number>;
  used?: Record<Kind, number>;
  allowed: Record<Kind, boolean>;
  grace_days: number;
  main_line: string | null;
  default_search?: Search;
  setup: { ready: boolean; messages: string[] };
};
type Available = { phone_number: string; friendly_name: string; locality: string | null; region: string | null; iso_country: string; address_requirements: string; needs_address: boolean };

const KIND_TITLE: Record<Kind, string> = { main: "Business line", toll_free: "Toll-free line", direct: "Direct line" };
const input: CSSProperties = { padding: "7px 9px", border: "1px solid var(--ui-border)", borderRadius: 6, fontSize: 14, background: "var(--ui-surface-strong)", color: "var(--ui-text)" };
const button: CSSProperties = { padding: "7px 14px", border: "1px solid var(--ui-border)", borderRadius: 6, background: "var(--ui-surface-strong)", color: "var(--ui-text)", cursor: "pointer", fontSize: 14 };
const section: CSSProperties = { marginTop: 22, paddingTop: 14, borderTop: "1px solid var(--ui-border)" };
const text: CSSProperties = { fontSize: 14, color: "var(--ui-text)" };
const muted: CSSProperties = { fontSize: 13, color: "var(--ui-text-muted)" };
const notice: CSSProperties = { fontSize: 14, color: "var(--ui-text)", border: "1px solid var(--ui-border)", borderRadius: 8, padding: "8px 12px", background: "var(--ui-surface-strong)", margin: "8px 0" };

function errorMessage(e: unknown, fallback: string): string {
  const d = (e as { details?: { message?: string; error?: string } })?.details;
  return d?.message || d?.error || (e as { message?: string })?.message || fallback;
}

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "");
const ADDRESS_NOTE = "Twilio needs your registered business address (regulatory information) before it sells this number. Pick another number, or ask Keystone support to add the address.";

/** Offers an area code, shows a few numbers for sale, and buys the one clicked (or swaps it in for `replaceId`). */
function NumberPicker({ kind, userId, replaceId, initial, onDone, onCancel }: {
  kind: Kind; userId?: string; replaceId?: string; initial: Search; onDone: () => void; onCancel: () => void;
}) {
  const [areaCode, setAreaCode] = useState(kind === "toll_free" ? "" : initial.area_code);
  const [results, setResults] = useState<Available[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function search(code: string) {
    setBusy(true); setMsg(null);
    try {
      const params = { kind, country: initial.country, area_code: code || undefined, region: kind === "toll_free" ? undefined : initial.region || undefined, limit: 5 };
      let r = await api.get<{ numbers?: Available[] }>("/api/phone-numbers/available", { params });
      // Nothing in that area code: try the whole province or state.
      if (!(r?.numbers ?? []).length && code && kind !== "toll_free") r = await api.get<{ numbers?: Available[] }>("/api/phone-numbers/available", { params: { ...params, area_code: undefined } });
      const n = (r?.numbers ?? []).slice(0, 5);
      setResults(n);
      if (!n.length) setMsg("No numbers for sale there right now. Try another area code.");
    } catch (e) {
      setMsg(errorMessage(e, "Couldn't look for numbers."));
    } finally { setBusy(false); }
  }
  useEffect(() => { void search(areaCode); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function buy(n: Available) {
    setBusy(true); setMsg(`Getting ${n.friendly_name}...`);
    const body = { phone_number: n.phone_number, address_requirements: n.address_requirements, locality: n.locality, region: n.region, iso_country: n.iso_country };
    try {
      if (replaceId) await api.post(`/api/phone-numbers/${replaceId}/change`, body);
      else await api.post("/api/phone-numbers", { ...body, kind, user_id: userId });
      setMsg(null); onDone();
    } catch (e) {
      setMsg(errorMessage(e, "Couldn't get that number."));
    } finally { setBusy(false); }
  }

  return (
    <div data-testid={`number-picker-${kind}`} style={{ marginTop: 8, padding: "10px 12px", border: "1px solid var(--ui-border)", borderRadius: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {kind !== "toll_free" && (
          <>
            <label style={text} htmlFor={`area-${kind}-${userId ?? replaceId ?? "new"}`}>Area code</label>
            <input id={`area-${kind}-${userId ?? replaceId ?? "new"}`} aria-label="Area code" inputMode="numeric" placeholder="e.g. 403" value={areaCode}
              onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))} style={{ ...input, width: 90 }} />
            <button type="button" style={button} disabled={busy} onClick={() => void search(areaCode)}>Show numbers</button>
          </>
        )}
        <button type="button" style={button} onClick={onCancel}>Cancel</button>
      </div>
      {busy && !results && <p style={muted}>Looking for numbers...</p>}
      {results && results.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
          {results.map((n) => (
            <li key={n.phone_number} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "5px 0" }}>
              <span style={{ ...text, fontWeight: 600, minWidth: 150 }}>{n.friendly_name}</span>
              <span style={muted}>{[n.locality, n.region].filter(Boolean).join(", ")}</span>
              {n.needs_address ? (
                <span style={{ fontSize: 13, color: "var(--ui-text)" }}>{ADDRESS_NOTE}</span>
              ) : (
                <button type="button" style={button} disabled={busy} onClick={() => void buy(n)}>{replaceId ? "Switch to this number" : "Get this number"}</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {msg && <p role="status" style={{ ...text, marginTop: 6 }}>{msg}</p>}
    </div>
  );
}

/** One number someone (or the brokerage) owns: Change number, Release number, or Keep while it waits to be released. */
function NumberControls({ n, users, graceDays, search, onChange }: { n: OwnedNumber; users: Line[]; graceDays: number; search: Search; onChange: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [keepFor, setKeepFor] = useState("");
  async function post(path: string, body: unknown, done: string) {
    setMsg("Saving...");
    try { await api.post(path, body); setMsg(done); onChange(); }
    catch (e) { setMsg(errorMessage(e, "Couldn't save.")); }
  }
  const release = () => {
    if (window.confirm(`Release ${n.phone_number}? It keeps working for ${graceDays} days, then it is given back and may not be available again. You can press Keep until then.`)) {
      void post(`/api/phone-numbers/${n.id}/release`, {}, `Will be released in ${graceDays} days.`);
    }
  };
  const free = users.filter((u) => !u.direct_number);
  return (
    <div data-testid="owned-number" style={{ flex: "1 1 320px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ ...text, fontWeight: 600 }}>{n.phone_number}</span>
        {n.kind !== "direct" && <span style={muted}>{KIND_TITLE[n.kind]}</span>}
        {n.status === "purchasing" && <span style={muted}>Being set up...</span>}
        {n.status === "active" && !changing && (
          <>
            <button type="button" style={button} onClick={() => setChanging(true)}>Change number</button>
            <button type="button" style={button} onClick={release}>Release number</button>
          </>
        )}
        {n.status === "releasing" && n.kind === "direct" && !n.assigned_user_id && (
          <select aria-label={`Give ${n.phone_number} to`} value={keepFor} onChange={(e) => setKeepFor(e.target.value)} style={input}>
            <option value="">Give it to...</option>
            {free.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
          </select>
        )}
        {n.status === "releasing" && (
          <button type="button" style={button} disabled={n.kind === "direct" && !n.assigned_user_id && !keepFor}
            onClick={() => void post(`/api/phone-numbers/${n.id}/keep`, n.kind === "direct" && keepFor ? { user_id: keepFor } : {}, "Kept.")}>Keep</button>
        )}
      </div>
      {n.status === "releasing" && <div style={text}>Will be released on {day(n.release_after)} ({n.release_reason}).</div>}
      {changing && <NumberPicker kind={n.kind} replaceId={n.id} initial={search} onCancel={() => setChanging(false)} onDone={() => { setChanging(false); onChange(); }} />}
      {msg && <span role="status" style={{ ...text, display: "block", marginTop: 4 }}>{msg}</span>}
    </div>
  );
}

export default function PhoneLines(): JSX.Element {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [typedMsg, setTypedMsg] = useState<Record<string, string>>({});

  const load = () => {
    void api.get<{ users?: Line[] }>("/api/voice/direct-numbers")
      .then((r) => { const u = r?.users ?? []; setLines(u); setDraft(Object.fromEntries(u.map((l) => [l.id, l.direct_number ?? ""]))); })
      .catch(() => setLines([]));
    void api.get<Overview>("/api/phone-numbers")
      .then((r) => { setOverview(r); setLoadError(null); })
      .catch((e) => setLoadError(errorMessage(e, "Couldn't load your numbers.")));
  };
  useEffect(load, []);

  // Admin-only fallback for a number the brokerage already has (ported, or bought before Keystone).
  async function saveTyped(id: string) {
    setTypedMsg((m) => ({ ...m, [id]: "Saving..." }));
    try {
      await api.put("/api/voice/direct-numbers/" + id, { direct_number: draft[id] ?? "" });
      setTypedMsg((m) => ({ ...m, [id]: "Saved" }));
      load();
    } catch (e) {
      setTypedMsg((m) => ({ ...m, [id]: errorMessage(e, "Couldn't save.") }));
    }
  }

  const owned = overview?.numbers ?? [];
  const search: Search = overview?.default_search ?? { country: "CA", area_code: "", region: "" };
  const used = (k: Kind) => overview?.used?.[k] ?? owned.filter((n) => n.kind === k && n.status !== "releasing").length;
  const limit = (k: Kind) => overview?.limits[k] ?? 0;
  const room = (k: Kind) => Boolean(overview?.setup.ready) && used(k) < limit(k);
  const ownedDirect = (userId: string) => owned.find((n) => n.kind === "direct" && n.assigned_user_id === userId);
  const directWaiting = owned.filter((n) => n.kind === "direct" && n.status === "releasing" && !n.assigned_user_id);
  const grace = overview?.grace_days ?? 30;
  const companyKind = (k: "main" | "toll_free") => (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...text, fontWeight: 600 }}>
        {KIND_TITLE[k]}{k === "main" ? "s" : ""} <span style={{ ...muted, fontWeight: 400 }}>{overview ? `${used(k)} of ${limit(k)} on your plan` : ""}</span>
      </div>
      {owned.filter((n) => n.kind === k).map((n) => (
        <div key={n.id} style={{ padding: "8px 0" }}><NumberControls n={n} users={lines ?? []} graceDays={grace} search={search} onChange={load} /></div>
      ))}
      {room(k) && (picking === k
        ? <NumberPicker kind={k} initial={search} onCancel={() => setPicking(null)} onDone={() => { setPicking(null); load(); }} />
        : <button type="button" style={{ ...button, marginTop: 6 }} onClick={() => setPicking(k)}>Get a number</button>)}
    </div>
  );

  return (
    <div style={{ maxWidth: 860 }}>
      <h2 style={{ fontSize: 18, marginBottom: 4, color: "var(--ui-text)" }}>Phone lines</h2>
      <p style={{ ...text, marginBottom: 8 }}>
        Calls to your business and toll-free lines go to the receptionist. A direct line rings only its person, then their
        voicemail, and their outgoing calls show it. Numbers are set up for you: pick one and it works straight away.
      </p>
      <p style={muted}>A number you change or release keeps working for {grace} days first, so you can change your mind.</p>
      {loadError && <p role="alert" style={notice}>{loadError}</p>}
      {overview && (
        <div data-testid="phone-setup" style={notice}>
          {overview.setup.messages.map((m) => <p key={m} style={{ margin: "4px 0" }}>{m}</p>)}
        </div>
      )}

      <section style={section} aria-labelledby="company-lines-h">
        <h3 id="company-lines-h" style={{ fontSize: 16, margin: 0, color: "var(--ui-text)" }}>Main and toll-free lines</h3>
        <p style={muted}>Caller ID for people without a direct line: {overview?.main_line || "not set yet"}</p>
        {companyKind("main")}
        <FeatureGate feature="toll_free_number" compact>{companyKind("toll_free")}</FeatureGate>
      </section>

      <section style={section} aria-labelledby="direct-lines-h">
        <h3 id="direct-lines-h" style={{ fontSize: 16, margin: 0, color: "var(--ui-text)" }}>
          Direct lines <span style={{ ...muted, fontWeight: 400 }}>{overview?.allowed.direct ? `${used("direct")} of ${limit("direct")} (Pro: one per seat)` : "Pro plan"}</span>
        </h3>
        <FeatureGate feature="multiple_lines">
          {directWaiting.map((n) => (
            <div key={n.id} style={{ padding: "8px 0", borderTop: "1px solid var(--ui-border)" }}><NumberControls n={n} users={lines ?? []} graceDays={grace} search={search} onChange={load} /></div>
          ))}
          {lines === null ? <div style={text}>Loading...</div> : lines.map((l) => {
            const mine = ownedDirect(l.id);
            return (
              <div key={l.id} data-testid="phone-line" style={{ padding: "10px 0", borderTop: "1px solid var(--ui-border)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ flex: "0 1 220px", minWidth: 180 }}>
                    <div style={{ ...text, fontWeight: 600 }}>{l.name || l.email || l.id}</div>
                    <div style={muted}>{l.email}</div>
                  </div>
                  {mine ? (
                    <NumberControls n={mine} users={lines} graceDays={grace} search={search} onChange={load} />
                  ) : l.direct_number ? (
                    <span style={text}>{l.direct_number}</span>
                  ) : room("direct") ? (
                    picking === l.id ? null : <button type="button" style={button} onClick={() => setPicking(l.id)}>Get a number</button>
                  ) : overview?.setup.ready ? (
                    <span style={muted}>Every seat on your plan already has a direct line.</span>
                  ) : null}
                </div>
                {picking === l.id && !mine && (
                  <NumberPicker kind="direct" userId={l.id} initial={search} onCancel={() => setPicking(null)} onDone={() => { setPicking(null); load(); }} />
                )}
              </div>
            );
          })}
          <details style={{ marginTop: 14 }}>
            <summary style={{ ...muted, cursor: "pointer" }}>Use a number you already have</summary>
            {(lines ?? []).filter((l) => !ownedDirect(l.id)).map((l) => (
              <div key={l.id} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "6px 0" }}>
                <span style={{ ...text, flex: "1 1 160px" }}>{l.name || l.email}</span>
                <input aria-label={"Existing number for " + (l.name || l.email || "")} value={draft[l.id] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [l.id]: e.target.value }))} style={{ ...input, width: 180 }} />
                <button type="button" onClick={() => void saveTyped(l.id)} style={button}>Save</button>
                {typedMsg[l.id] && <span role="status" style={text}>{typedMsg[l.id]}</span>}
              </div>
            ))}
          </details>
        </FeatureGate>
      </section>
    </div>
  );
}
