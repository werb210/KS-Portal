// KS_PORTAL_MARKETING_ADDON - the Marketing add-on's send options in the email composer: a subject-line A/B test (a
// sample gets subject A or B, the one opened more goes to everyone else) or sending at each person's best time; and
// this month's campaign emails against the plan's allowance.
import type { CSSProperties } from "react";
import { usePlan } from "@/plans/planStore";
import { AddonBadge, useMarketingTool } from "@/plans/marketing";

export type SendOptions = { ab: boolean; subjectB: string; testPercent: number; waitHours: number; bestTime: boolean };
export const DEFAULT_SEND_OPTIONS: SendOptions = { ab: false, subjectB: "", testPercent: 20, waitHours: 4, bestTime: false };

/** The fields the send route takes for these options (nothing when neither is on). */
export function sendOptionsPayload(o: SendOptions): Record<string, unknown> {
  if (o.ab && o.subjectB.trim()) return { abTest: { subjectB: o.subjectB.trim(), testPercent: o.testPercent, waitHours: o.waitHours } };
  if (o.bestTime) return { sendTime: "best" };
  return {};
}

export function CampaignEmailAllowance({ audience }: { audience: number }) {
  const plan = usePlan();
  const u = plan.usage;
  if (!u || u.campaign_emails === null || u.allowances.campaign_emails === null) return null;
  const left = Math.max(0, u.allowances.campaign_emails - u.campaign_emails);
  const over = !u.marketing_addon && audience > left;
  return (
    <p data-testid="campaign-email-allowance" style={{ margin: "4px 0", fontSize: 12, color: over ? "#b91c1c" : "var(--ui-text-muted)", fontWeight: over ? 700 : 400 }}>
      {u.campaign_emails.toLocaleString()} of {u.allowances.campaign_emails.toLocaleString()} campaign emails used this month.
      {over ? ` This audience is ${audience.toLocaleString()}, more than the ${left.toLocaleString()} left: choose a smaller audience, wait for the 1st, or ask an Admin about the Marketing add-on.` : ""}
      {u.marketing_addon && u.campaign_emails > u.allowances.campaign_emails ? " Extra emails are billed at $10 per 10,000." : ""}
    </p>
  );
}

export default function CampaignSendOptions({ value, onChange, subjectA, inputStyle, labelStyle }: {
  value: SendOptions; onChange: (v: SendOptions) => void; subjectA: string; inputStyle: CSSProperties; labelStyle: CSSProperties;
}) {
  const ab = useMarketingTool("ab_test");
  const best = useMarketingTool("send_time");
  const set = (patch: Partial<SendOptions>) => onChange({ ...value, ...patch });
  const same = value.ab && value.subjectB.trim() !== "" && value.subjectB.trim() === subjectA.trim();
  return (
    <fieldset className="border rounded p-2 mt-2 text-sm" style={{ borderColor: "var(--ui-border)", color: "var(--ui-text)" }} data-testid="campaign-send-options">
      <legend className="font-medium px-1">Send options</legend>
      <label className="flex items-center gap-2">
        <input type="checkbox" disabled={!ab} checked={value.ab} onChange={(e) => set({ ab: e.target.checked, bestTime: e.target.checked ? false : value.bestTime })} />
        Test two subject lines first<AddonBadge tool="ab_test" />
      </label>
      {value.ab && (
        <div className="flex flex-wrap gap-2 items-end mt-1 ml-6">
          <label style={labelStyle}>Subject B
            <input value={value.subjectB} onChange={(e) => set({ subjectB: e.target.value })} className="block border rounded px-2 py-1 text-sm mt-1" style={inputStyle} />
          </label>
          <label style={labelStyle}>Test on
            <select value={value.testPercent} onChange={(e) => set({ testPercent: Number(e.target.value) })} className="block border rounded px-2 py-1 text-sm mt-1" style={inputStyle}>
              {[10, 20, 30, 40, 50].map((p) => <option key={p} value={p}>{p}% of the audience</option>)}
            </select>
          </label>
          <label style={labelStyle}>Pick the winner after
            <select value={value.waitHours} onChange={(e) => set({ waitHours: Number(e.target.value) })} className="block border rounded px-2 py-1 text-sm mt-1" style={inputStyle}>
              {[1, 2, 4, 8, 12, 24].map((h) => <option key={h} value={h}>{h} hour{h === 1 ? "" : "s"}</option>)}
            </select>
          </label>
          <p style={{ flexBasis: "100%", margin: 0, fontSize: 12, color: same ? "#b91c1c" : "var(--ui-text-muted)" }}>
            {same ? "The two subject lines are the same. Change one of them." : "Half the test group gets each subject. The one opened more goes to everyone else."}
          </p>
        </div>
      )}
      <label className="flex items-center gap-2 mt-1">
        <input type="checkbox" disabled={!best} checked={value.bestTime} onChange={(e) => set({ bestTime: e.target.checked, ab: e.target.checked ? false : value.ab })} />
        Send at each person&apos;s best time (the hour they usually open email, within a day)<AddonBadge tool="send_time" />
      </label>
    </fieldset>
  );
}
