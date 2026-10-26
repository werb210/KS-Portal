// KS_PORTAL_SETTINGS_PACK_v1_PHONE_MENU - Settings > Phone menu (Admins): what callers to the main number hear and
// where each key goes. KS-server /api/phone-menu.
import { useCallback, useEffect, useState } from "react";
import { api } from "@/api";
import { DAY_LABELS, Field, Notice, Section, Toggle, button, cell, danger, errText, input, muted, quiet } from "./ui";

type Target =
  | { type: "user"; userId: string }
  | { type: "group"; userIds: string[]; strategy: "simultaneous" | "sequential" }
  | { type: "voicemail"; userId: string | null }
  | { type: "ai" }
  | { type: "meeting" };
type Prompt = { mode: "tts" | "audio"; text: string; audioId: string | null };
type Option = { digit: string; label: string; keywords: string[]; target: Target };
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type Menu = {
  greeting: Prompt; announceOptions: boolean;
  hours: { enabled: boolean; weekly: Record<(typeof DAY_KEYS)[number], Array<[string, string]>> };
  afterHoursGreeting: Prompt; afterHours: Target; options: Option[];
  noAnswer: { ringSeconds: number; target: Target }; holidays: Array<{ date: string; name: string }>;
};
type User = { id: string; name: string };
type Audio = { id: string; file_name: string | null };
type Loaded = { menu: Menu; is_default: boolean; users: User[]; audio: Audio[]; stale_user_ids: string[]; time_zone: string; zone_label: string; open_now: boolean; spoken_greeting: string };

const TARGET_LABEL: Record<Target["type"], string> = {
  user: "Ring one person", group: "Ring a group", voicemail: "Voicemail", ai: "AI receptionist (caller says what they need)", meeting: "Meeting dial-in (access code)",
};

function blankTarget(type: Target["type"], users: User[]): Target {
  if (type === "user") return { type, userId: users[0]?.id ?? "" };
  if (type === "group") return { type, userIds: users.map((u) => u.id), strategy: "simultaneous" };
  if (type === "voicemail") return { type, userId: null };
  return { type } as Target;
}

function TargetEditor({ id, value, users, onChange, allow }: { id: string; value: Target; users: User[]; onChange: (t: Target) => void; allow: Target["type"][] }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <select id={id} aria-label="Where it goes" value={value.type} onChange={(e) => onChange(blankTarget(e.target.value as Target["type"], users))} style={input}>
        {allow.map((t) => <option key={t} value={t}>{TARGET_LABEL[t]}</option>)}
      </select>
      {value.type === "user" && (
        <select aria-label="Person" value={value.userId} onChange={(e) => onChange({ type: "user", userId: e.target.value })} style={input}>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}
      {value.type === "voicemail" && (
        <select aria-label="Voicemail box" value={value.userId ?? ""} onChange={(e) => onChange({ type: "voicemail", userId: e.target.value || null })} style={input}>
          <option value="">The person who was rung, else the shared voicemail</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}'s voicemail</option>)}
        </select>
      )}
      {value.type === "group" && (
        <div style={{ display: "grid", gap: 4 }}>
          <select aria-label="How the group rings" value={value.strategy} onChange={(e) => onChange({ ...value, strategy: e.target.value as "simultaneous" | "sequential" })} style={input}>
            <option value="simultaneous">Everyone at once</option>
            <option value="sequential">One at a time, in this order</option>
          </select>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {users.map((u) => (
              <Toggle key={u.id} id={`${id}-${u.id}`} label={u.name} checked={value.userIds.includes(u.id)}
                onChange={(on) => onChange({ ...value, userIds: on ? [...value.userIds, u.id] : value.userIds.filter((x) => x !== u.id) })} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PromptEditor({ id, label, value, audio, onChange }: { id: string; label: string; value: Prompt; audio: Audio[]; onChange: (p: Prompt) => void }) {
  return (
    <Field id={id} label={label}>
      <div style={{ display: "grid", gap: 6 }}>
        <select aria-label={`${label}: read aloud or recording`} value={value.mode} onChange={(e) => onChange({ ...value, mode: e.target.value as "tts" | "audio", audioId: e.target.value === "audio" ? (value.audioId ?? audio[0]?.id ?? null) : null })} style={input}>
          <option value="tts">Read this text aloud</option>
          <option value="audio" disabled={!audio.length}>Play an uploaded recording{audio.length ? "" : " (upload one below)"}</option>
        </select>
        {value.mode === "tts"
          ? <textarea id={id} value={value.text} maxLength={600} rows={2} onChange={(e) => onChange({ ...value, text: e.target.value })} style={input} />
          : <select id={id} value={value.audioId ?? ""} onChange={(e) => onChange({ ...value, audioId: e.target.value })} style={input}>
              {audio.map((a) => <option key={a.id} value={a.id}>{a.file_name || a.id}</option>)}
            </select>}
      </div>
    </Field>
  );
}

export default function PhoneMenuSettings() {
  const [data, setData] = useState<Loaded | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [holiday, setHoliday] = useState({ date: "", name: "" });

  const load = useCallback(async () => {
    try {
      const r = await api.get<Loaded>("/api/phone-menu");
      setData(r); setMenu(r.menu);
    } catch (e) { setErr(errText(e, "Could not load the phone menu.")); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!menu || !data) return <div data-testid="phone-menu-settings"><Notice error={err} />{!err && <p style={muted}>Loading...</p>}</div>;
  const users = data.users;
  const set = (patch: Partial<Menu>) => setMenu({ ...menu, ...patch });
  const setOption = (i: number, patch: Partial<Option>) => set({ options: menu.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const nextDigit = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].find((d) => !menu.options.some((o) => o.digit === d));

  const save = async () => {
    setBusy(true); setErr(null); setOk(null);
    try {
      const r = await api.put<{ spoken_greeting: string }>("/api/phone-menu", { menu });
      setOk(`Saved. Callers now hear: "${r.spoken_greeting}"`);
      await load();
    } catch (e) { setErr(errText(e, "Could not save the phone menu.")); } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!window.confirm("Go back to the default menu built from your team?")) return;
    try { await api.post("/api/phone-menu/reset", {}); setOk("Back to the default menu."); await load(); } catch (e) { setErr(errText(e, "Could not reset.")); }
  };
  const upload = async (file: File | null) => {
    if (!file) return;
    setErr(null);
    const form = new FormData();
    form.append("file", file);
    try { await api.post("/api/phone-menu/audio", form); setOk("Recording uploaded. Choose it as a greeting, then save."); await load(); }
    catch (e) { setErr(errText(e, "Could not upload the recording. Use an MP3 or WAV up to 5 MB.")); }
  };
  const removeAudio = async (id: string) => {
    try { await api.delete(`/api/phone-menu/audio/${id}`); await load(); } catch (e) { setErr(errText(e, "Could not remove the recording.")); }
  };

  return (
    <div data-testid="phone-menu-settings">
      <Section id="pm-greeting" title="Greeting" intro={<>What callers to your main number hear first. {data.is_default ? "This is the default menu, built from your team; save it to start using it." : ""} Office status now: <strong>{data.open_now ? "open" : "closed"}</strong> ({data.zone_label}).</>}>
        <PromptEditor id="pm-greeting-text" label="Greeting" value={menu.greeting} audio={data.audio} onChange={(greeting) => set({ greeting })} />
        <Toggle id="pm-announce" label="After the greeting, read the options (For sales, press 1...)" checked={menu.announceOptions} onChange={(announceOptions) => set({ announceOptions })} />
        <p style={muted}>Callers can also say what they want, and can always key 3 followed by a meeting access code and # to join a meeting.</p>
      </Section>

      <Section id="pm-options" title="Menu options" intro="Up to nine keys. Keywords help when a caller speaks instead of pressing a key.">
        {data.stale_user_ids.length > 0 && <Notice error="This menu still sends calls to someone who is no longer an active user. Change those options and save." />}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={cell}>Key</th><th style={cell}>Label (read to callers)</th><th style={cell}>Goes to</th><th style={cell}>Spoken keywords</th><th style={cell} /></tr></thead>
            <tbody>
              {menu.options.map((o, i) => (
                <tr key={i} data-testid="pm-option">
                  <td style={cell}>
                    <select aria-label="Key" value={o.digit} onChange={(e) => setOption(i, { digit: e.target.value })} style={{ ...input, width: 60 }}>
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </td>
                  <td style={cell}><input aria-label="Label" value={o.label} maxLength={80} onChange={(e) => setOption(i, { label: e.target.value })} style={input} /></td>
                  <td style={cell}><TargetEditor id={`pm-opt-${i}`} value={o.target} users={users} allow={["user", "group", "voicemail", "ai", "meeting"]} onChange={(target) => setOption(i, { target })} /></td>
                  <td style={cell}><input aria-label="Keywords" value={o.keywords.join(", ")} onChange={(e) => setOption(i, { keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })} style={input} placeholder="sales, apply" /></td>
                  <td style={cell}><button type="button" style={danger} onClick={() => set({ options: menu.options.filter((_, j) => j !== i) })}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {nextDigit && <button type="button" style={{ ...quiet, marginTop: 8 }} onClick={() => set({ options: [...menu.options, { digit: nextDigit, label: "", keywords: [], target: blankTarget("user", users) }] })}>Add an option</button>}
      </Section>

      <Section id="pm-noanswer" title="When nobody answers" intro="Used when nobody picks up, nobody can be rung, or a caller does not choose.">
        <Field id="pm-ring" label="Ring for (seconds)">
          <input id="pm-ring" type="number" min={10} max={60} value={menu.noAnswer.ringSeconds} onChange={(e) => set({ noAnswer: { ...menu.noAnswer, ringSeconds: Number(e.target.value) } })} style={{ ...input, width: 100 }} />
        </Field>
        <Field id="pm-noanswer-target" label="Then">
          <TargetEditor id="pm-noanswer-target" value={menu.noAnswer.target} users={users} allow={["voicemail", "user", "group", "ai"]} onChange={(target) => set({ noAnswer: { ...menu.noAnswer, target } })} />
        </Field>
      </Section>

      <Section id="pm-hours" title="Business hours and holidays" intro={`In your company's time zone (${data.time_zone}). Outside these hours, and on holidays, callers hear the after-hours greeting.`}>
        <Toggle id="pm-hours-on" label="Use business hours (off: always open, except holidays)" checked={menu.hours.enabled} onChange={(enabled) => set({ hours: { ...menu.hours, enabled } })} />
        {menu.hours.enabled && DAY_KEYS.map((d, i) => {
          const range = menu.hours.weekly[d][0];
          return (
            <Field key={d} id={`pm-day-${d}`} label={DAY_LABELS[i]!}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <Toggle id={`pm-day-${d}`} label="Open" checked={Boolean(range)} onChange={(on) => set({ hours: { ...menu.hours, weekly: { ...menu.hours.weekly, [d]: on ? [["09:00", "17:00"]] : [] } } })} />
                {range && <>
                  <input aria-label={`${DAY_LABELS[i]} opens`} type="time" value={range[0]} onChange={(e) => set({ hours: { ...menu.hours, weekly: { ...menu.hours.weekly, [d]: [[e.target.value, range[1]]] } } })} style={{ ...input, width: 120 }} />
                  <span>to</span>
                  <input aria-label={`${DAY_LABELS[i]} closes`} type="time" value={range[1]} onChange={(e) => set({ hours: { ...menu.hours, weekly: { ...menu.hours.weekly, [d]: [[range[0], e.target.value]] } } })} style={{ ...input, width: 120 }} />
                </>}
              </div>
            </Field>
          );
        })}
        <PromptEditor id="pm-after-text" label="After-hours greeting" value={menu.afterHoursGreeting} audio={data.audio} onChange={(afterHoursGreeting) => set({ afterHoursGreeting })} />
        <Field id="pm-after-target" label="After hours, callers go to">
          <TargetEditor id="pm-after-target" value={menu.afterHours} users={users} allow={["voicemail", "user", "group", "ai"]} onChange={(afterHours) => set({ afterHours })} />
        </Field>
        <p style={{ ...muted, marginTop: 12 }}>Holidays (closed all day)</p>
        <ul style={{ margin: "0 0 8px", paddingLeft: 18 }}>
          {menu.holidays.map((h, i) => (
            <li key={`${h.date}-${i}`} style={{ fontSize: 13 }}>{h.date} {h.name} <button type="button" style={quiet} onClick={() => set({ holidays: menu.holidays.filter((_, j) => j !== i) })}>Remove</button></li>
          ))}
        </ul>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input aria-label="Holiday date" type="date" value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} style={{ ...input, width: 170 }} />
          <input aria-label="Holiday name" placeholder="Christmas Day" value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} style={{ ...input, width: 200 }} />
          <button type="button" style={quiet} disabled={!holiday.date} onClick={() => { set({ holidays: [...menu.holidays, { date: holiday.date, name: holiday.name || "Holiday" }] }); setHoliday({ date: "", name: "" }); }}>Add holiday</button>
        </div>
      </Section>

      <Section id="pm-audio" title="Recordings" intro="Upload an MP3 or WAV (up to 5 MB) to play instead of reading a greeting aloud.">
        <input aria-label="Upload a recording" type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" onChange={(e) => void upload(e.target.files?.[0] ?? null)} />
        <ul style={{ paddingLeft: 18 }}>
          {data.audio.map((a) => <li key={a.id} style={{ fontSize: 13 }}>{a.file_name || a.id} <button type="button" style={quiet} onClick={() => void removeAudio(a.id)}>Remove</button></li>)}
        </ul>
      </Section>

      <Notice error={err} ok={ok} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" style={button} disabled={busy} onClick={() => void save()}>{busy ? "Saving..." : "Save phone menu"}</button>
        {!data.is_default && <button type="button" style={quiet} onClick={() => void reset()}>Back to the default menu</button>}
      </div>
    </div>
  );
}
