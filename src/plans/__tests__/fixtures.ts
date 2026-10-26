// KS_PORTAL_v3_PLANS - GET /api/plan bodies for the plan tests.
export function planBody(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ok: true,
    plan: "starter",
    effective_plan: "starter",
    trial: { status: "available", started_at: null, ends_at: null, days_left: null },
    features: { call_recording_playback: false, call_summaries: false, templates: false, referrer_portal: false, full_reports: false, visitor_tracking: false, ad_attribution: false, multiple_lines: false },
    catalogue: [
      { key: "call_summaries", label: "Call summaries", plan: "growth" },
      { key: "templates", label: "Templates", plan: "growth" },
      { key: "ad_attribution", label: "Ad attribution", plan: "pro" },
    ],
    allowances: { minutes_per_seat: 50, texts_per_seat: 100, assistant_chats: 200, trial_bonus_minutes: 100, trial_bonus_texts: 100, storage_gb_per_seat: 10 },
    trial_usage: {},
    ...over,
  };
}

export const ACTIVE_TRIAL = {
  effective_plan: "pro",
  trial: { status: "active", started_at: "2026-10-10T00:00:00Z", ends_at: "2026-10-24T00:00:00Z", days_left: 9 },
  features: {},
};
