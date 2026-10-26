// KS_PORTAL_SETTINGS_PACK_v1 - the HubSpot-parity settings tabs, the follow-up prompt and the two-step sign-in screen.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn(), del: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, put: h.put, post: h.post, delete: h.del }, default: { get: h.get, put: h.put, post: h.post, delete: h.del } }));
vi.mock("@/auth/passkey", () => ({ passkeysSupported: () => true, registerPasskey: vi.fn(), loginWithPasskey: vi.fn() }));

import PhoneMenuSettings from "../PhoneMenuSettings";
import BookingSettings from "../BookingSettings";
import SecuritySettings from "../SecuritySettings";
import PrivacySettings from "../PrivacySettings";
import { BlockedNumbersSettings, LeadRotationSettings, NeverLogSettings } from "../ListSettings";
import SurveySettings from "../SurveySettings";
import FollowUpPrompt, { requestFollowUp } from "../FollowUpPrompt";
import StrongSignInGate from "../StrongSignInGate";
import { reportStrongSignInRequired } from "../strongSignIn";

const A = "11111111-1111-4111-8111-111111111111";
const MENU = {
  greeting: { mode: "tts", text: "Thank you for calling Acme Capital.", audioId: null }, announceOptions: true,
  hours: { enabled: false, weekly: { sun: [], mon: [["09:00", "17:00"]], tue: [], wed: [], thu: [], fri: [], sat: [] } },
  afterHoursGreeting: { mode: "tts", text: "Closed.", audioId: null }, afterHours: { type: "voicemail", userId: null },
  options: [{ digit: "1", label: "Jane Smith", keywords: [], target: { type: "user", userId: A } }],
  noAnswer: { ringSeconds: 25, target: { type: "voicemail", userId: null } }, holidays: [],
};

beforeEach(() => {
  for (const f of Object.values(h)) f.mockReset();
  h.put.mockResolvedValue({ ok: true, spoken_greeting: "Thank you for calling Acme Capital. For Jane Smith, press 1." });
  h.post.mockResolvedValue({ ok: true });
  h.del.mockResolvedValue({ ok: true });
});

describe("Phone menu", () => {
  it("shows the menu built from the team and saves it with the spoken greeting", async () => {
    h.get.mockResolvedValue({ menu: MENU, is_default: true, users: [{ id: A, name: "Jane Smith" }], audio: [], stale_user_ids: [], time_zone: "America/Edmonton", zone_label: "Alberta time", open_now: true, spoken_greeting: "" });
    render(<PhoneMenuSettings />);
    expect(await screen.findAllByTestId("pm-option")).toHaveLength(1);
    expect(screen.getByText(/This is the default menu, built from your team/)).toBeTruthy();
    fireEvent.click(screen.getByText("Add an option"));
    expect(screen.getAllByTestId("pm-option")).toHaveLength(2);
    fireEvent.click(screen.getByText("Save phone menu"));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/phone-menu", expect.objectContaining({ menu: expect.objectContaining({ options: expect.any(Array) }) })));
    expect((h.put.mock.calls[0]![1] as any).menu.options[1].digit).toBe("2");
    expect(await screen.findByText(/Callers now hear/)).toBeTruthy();
  });
});

describe("Booking pages", () => {
  it("lists the team and personal links and adds a meeting type", async () => {
    h.get.mockResolvedValue({ settings: { team_page: true, hours: { 1: [["09:00", "17:00"]] }, reminders: { email_24h: true, email_1h: true, sms_24h: true, sms_1h: true }, confirmation_note: "" },
      meeting_types: [], links: { team: "https://client.acme.test/book/team", staff: [{ user_id: A, name: "Jane", url: "https://client.acme.test/book/jane" }] }, time_zone: "America/Edmonton", zone_label: "Alberta time" });
    render(<BookingSettings />);
    expect(await screen.findByText("https://client.acme.test/book/team")).toBeTruthy();
    expect(screen.getByText("https://client.acme.test/book/jane")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Intro call" } });
    fireEvent.click(screen.getByText("Add meeting type"));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/booking-settings/meeting-types", expect.objectContaining({ name: "Intro call", duration_min: 30 })));
  });
});

describe("Security", () => {
  it("the two-step switch stays off until this session is strong", async () => {
    h.get.mockResolvedValue({ require_strong_sign_in: false, session_strong: false, readiness: { with_passkey: 1, staff: 3, admins_without_passkey: [{ id: A, name: "Jane" }] }, users: [] });
    render(<SecuritySettings />);
    const box = await screen.findByLabelText("Require a passkey or two-step sign-in for all staff") as HTMLInputElement;
    expect(box.disabled).toBe(true);
    expect(screen.getByText(/1 of 3 staff have a passkey. Admins without one: Jane/)).toBeTruthy();
  });
});

describe("Privacy requests", () => {
  it("explains what a deletion keeps and why", async () => {
    h.get.mockImplementation(async (path: string) => path === "/api/privacy/requests"
      ? { requests: [{ id: "r1", contact_id: "c1", contact_label: "Jane Client", kind: "deletion", status: "open", requested_at: "2026-10-26T00:00:00Z", due_at: "2026-11-25T00:00:00Z" }] }
      : { deletion_plan: { can_delete: false, will_delete: [], will_keep: [{ what: "The contact, its applications", why: "An application is still open; records are kept for 7 years after it closes.", until: null }] } });
    render(<PrivacySettings />);
    fireEvent.click(await screen.findByText("Open"));
    expect(await screen.findByText(/kept for 7 years after it closes/)).toBeTruthy();
    expect(screen.getByText("Opt out and close the request")).toBeTruthy();
  });
});

describe("Lists", () => {
  it("never log, blocked numbers and lead rotation", async () => {
    h.get.mockImplementation(async (path: string) => {
      if (path === "/api/never-log") return { entries: [{ id: "e1", value: "family.test", kind: "domain", note: null }] };
      if (path === "/api/blocked-numbers") return { numbers: [], settings: { call_action: "reject" }, events: [] };
      return { settings: { enabled: false, user_ids: [], sources: { website: true, booking: true, form: true }, away_user_ids: [] }, users: [{ id: A, name: "Jane Smith" }], recent: [] };
    });
    render(<><NeverLogSettings /><BlockedNumbersSettings /><LeadRotationSettings /></>);
    expect(await screen.findByText("Anyone at family.test")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "403-555-0199" } });
    fireEvent.click(screen.getByText("Block"));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/blocked-numbers", { number: "403-555-0199", reason: "" }));
    fireEvent.click(await screen.findByLabelText("Jane Smith in the rotation"));
    fireEvent.click(screen.getByLabelText("Give new leads an owner in turn"));
    fireEvent.click(screen.getByText("Save lead rotation"));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/lead-rotation", { settings: expect.objectContaining({ enabled: true, user_ids: [A] }) }));
  });
});

describe("Client survey", () => {
  it("shows the NPS report", async () => {
    h.get.mockImplementation(async (path: string) => path === "/api/surveys/settings"
      ? { settings: { enabled: true, delay_days: 7, question: "How likely?", comment_prompt: "Why?", email_subject: "Hi", email_intro: "Hi", sms_text: "Hi", review_url: "" } }
      : { nps: 40, responses: 5, sent: 8, promoters: 3, passives: 1, detractors: 1, response_rate: 63, by_month: [], recent: [] });
    render(<SurveySettings />);
    expect((await screen.findByTestId("nps-score")).textContent).toBe("NPS 40");
  });
});

describe("follow-up prompt", () => {
  it("after a logged call, offers the task pre-filled from my defaults and creates it", async () => {
    h.get.mockResolvedValue({ prompt: true, title: "Call Pat Lee - follow-up after the call", type: "CALL", due_at: "2026-12-11T15:00:00.000Z", reminder_at: "2026-12-11T14:45:00.000Z", contact_id: "c1" });
    render(<FollowUpPrompt />);
    act(() => requestFollowUp("call", "c1"));
    expect(await screen.findByDisplayValue("Call Pat Lee - follow-up after the call")).toBeTruthy();
    expect(h.get).toHaveBeenCalledWith("/api/task-defaults/suggestion?after=call&contact_id=c1");
    fireEvent.click(screen.getByText("Create task"));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/tasks", expect.objectContaining({ title: "Call Pat Lee - follow-up after the call", type: "CALL", contact_id: "c1", due_at: "2026-12-11T15:00:00.000Z", reminder_at: "2026-12-11T14:45:00.000Z" })));
  });

  it("stays quiet when I switched the prompt off", async () => {
    h.get.mockResolvedValue({ prompt: false });
    render(<FollowUpPrompt />);
    act(() => requestFollowUp("email", "c1"));
    await waitFor(() => expect(h.get).toHaveBeenCalled());
    expect(screen.queryByTestId("follow-up-prompt")).toBeNull();
  });
});

describe("two-step sign-in", () => {
  it("a 403 STRONG_SIGN_IN_REQUIRED opens the one-more-step screen", async () => {
    h.get.mockResolvedValue({ has_passkey: false });
    render(<StrongSignInGate />);
    expect(screen.queryByTestId("strong-sign-in")).toBeNull();
    act(() => reportStrongSignInRequired(403, { error: "OTHER" }));
    expect(screen.queryByTestId("strong-sign-in")).toBeNull();
    act(() => reportStrongSignInRequired(403, { error: "STRONG_SIGN_IN_REQUIRED" }));
    expect(await screen.findByText("One more step to sign in")).toBeTruthy();
    expect(await screen.findByText("Set up a passkey on this device")).toBeTruthy();
  });
});
