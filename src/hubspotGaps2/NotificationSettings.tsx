// KS_NOTIFICATION_TOPICS_v1 - My Profile > Notifications: per topic, the bell, push (phone, tablet, desktop, watch)
// and text messages. Everything is on until the person turns it off; locked channels cannot be turned off.
import { useEffect, useState } from "react";
import { api } from "@/api";
import { safeGet } from "./safeGet";
import { Notice, Section, button, cell, errText } from "@/settingsPack/ui";

type Channel = "bell" | "push" | "text";
type Topic = { key: string; label: string; description: string; locked: Channel[] };
type Setting = { topic: string; bell: boolean; push: boolean; text: boolean };
type Reply = { channels: Channel[]; topics: Topic[]; settings: Setting[] };

const CHANNEL_LABEL: Record<Channel, string> = { bell: "In the portal", push: "Push", text: "Text message" };

export default function NotificationSettings() {
  const [data, setData] = useState<Reply | null>(null);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void safeGet<Reply>("/api/notifications/settings")
      .then((r) => { if (r && Array.isArray(r.channels) && Array.isArray(r.topics)) { setData(r); setSettings(Array.isArray(r.settings) ? r.settings : []); } })
      .catch((e) => setErr(errText(e, "Could not load your notification settings.")));
  }, []);

  if (!data) return err ? <Notice error={err} /> : null;
  const setOne = (topic: string, channel: Channel, value: boolean) => {
    setOk(null);
    setSettings((s) => s.map((x) => (x.topic === topic ? { ...x, [channel]: value } : x)));
  };
  const save = async () => {
    setSaving(true); setErr(null); setOk(null);
    try {
      const r = await api.put<{ settings: Setting[] }>("/api/notifications/settings", { settings });
      setSettings(r.settings);
      setOk("Notification settings saved.");
    } catch (e) { setErr(errText(e, "Could not save your notification settings.")); } finally { setSaving(false); }
  };

  return (
    <Section id="my-notifications" title="Notifications" intro="Choose how each kind of update reaches you. Push covers your phone, tablet, computer and watch.">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
          <thead>
            <tr>
              <th style={{ ...cell, borderTop: "none", fontWeight: 600 }} scope="col">Topic</th>
              {data.channels.map((c) => <th key={c} style={{ ...cell, borderTop: "none", fontWeight: 600, textAlign: "center" }} scope="col">{CHANNEL_LABEL[c]}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.topics.map((t) => {
              const s = settings.find((x) => x.topic === t.key) ?? { topic: t.key, bell: true, push: true, text: true };
              return (
                <tr key={t.key}>
                  <th scope="row" style={{ ...cell, fontWeight: 400 }}>
                    <div style={{ fontWeight: 600 }}>{t.label}</div>
                    <div style={{ color: "var(--ui-text-muted)", fontSize: 12 }}>{t.description}</div>
                  </th>
                  {data.channels.map((c) => {
                    const locked = t.locked.includes(c);
                    return (
                      <td key={c} style={{ ...cell, textAlign: "center" }}>
                        <input
                          type="checkbox"
                          aria-label={`${t.label}: ${CHANNEL_LABEL[c]}`}
                          checked={locked ? true : s[c]}
                          disabled={locked}
                          title={locked ? "Always on" : undefined}
                          onChange={(e) => setOne(t.key, c, e.target.checked)}
                          style={{ width: 18, height: 18 }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ color: "var(--ui-text-muted)", fontSize: 12, margin: "8px 0" }}>Incoming calls always ring. Anything not listed here always reaches you.</p>
      <button type="button" style={button} disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save notification settings"}</button>
      <Notice error={err} ok={ok} />
    </Section>
  );
}
