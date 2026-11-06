// KS_PORTAL_ZOOM_MEETINGS_v1 - the meeting form offers the video apps the broker connected and sends the choice.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({
  get: vi.fn(async () => ({ data: { connected: { teams: true, google_meet: false, zoom: true }, default: "teams" } })),
  create: vi.fn(async () => ({})),
}));
vi.mock("@/api", () => ({ api: { get: h.get, post: vi.fn() }, default: { get: h.get } }));
vi.mock("@/api/crm", () => ({ crmApi: { meetings: { create: h.create } } }));
vi.mock("@/components/ui/DateTimePicker", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input aria-label="When" value={value} onChange={(e) => onChange(e.target.value)} />,
}));
vi.mock("@/pages/calendar/MeetingRoomsPanel", () => ({ describeMeetingDelivery: () => ({ ok: true, text: "" }) }));
vi.mock("@/settingsPack/FollowUpPrompt", () => ({ requestFollowUp: vi.fn() }));
vi.mock("@/components/communications/RecipientAutocomplete", () => ({
  RecipientAutocomplete: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input aria-label="Attendees" value={value} onChange={(e) => onChange(e.target.value)} />,
}));

import { MeetingPopup } from "../MeetingPopup";
import { meetingLinkLabel } from "../../ActivityTimeline";

describe("meeting app picker", () => {
  it("lists only connected apps, defaults to Teams, and sends Zoom when picked", async () => {
    render(<MeetingPopup scope={{ kind: "contact", id: "c1" }} onClose={vi.fn()} onCreated={vi.fn()} defaultEmail="client@example.test" />);
    const pick = (await screen.findByTestId("meeting-app")) as HTMLSelectElement;
    expect(Array.from(pick.options).map((o) => o.textContent)).toEqual(["Microsoft Teams", "Zoom"]);
    expect(pick.value).toBe("teams");
    fireEvent.change(pick, { target: { value: "zoom" } });
    expect(screen.getByText(/A Zoom join link is created automatically/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "Review" } });
    const [start, end] = screen.getAllByLabelText("When");
    fireEvent.change(start!, { target: { value: "2026-11-10T16:00:00Z" } });
    fireEvent.change(end!, { target: { value: "2026-11-10T16:30:00Z" } });
    fireEvent.click(screen.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(h.create).toHaveBeenCalled());
    expect((h.create.mock.calls[0] as unknown[])[1]).toMatchObject({ online: true, meeting_app: "zoom" });
  });
});

describe("timeline join buttons", () => {
  it("names Zoom and Google Meet links", () => {
    expect(meetingLinkLabel("https://us02web.zoom.us/j/123456?pwd=x")).toBe("Join Zoom meeting");
    expect(meetingLinkLabel("https://meet.google.com/abc-defg-hij")).toBe("Join Google Meet");
    expect(meetingLinkLabel("https://teams.microsoft.com/l/meetup-join/x")).toBe("Join Teams meeting");
    expect(meetingLinkLabel("https://graph.microsoft.com/v1.0/x")).toBeNull();
  });
});
