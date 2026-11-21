// KS_PORTAL_TEAM_IMPORT_v1
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseTeamText } from "../teamImportParse";

const post = vi.fn();
vi.mock("@/api", () => ({ api: { post: (...a: unknown[]) => post(...a), get: vi.fn(), patch: vi.fn() } }));
const fetchUsers = vi.fn().mockResolvedValue(undefined);
let users: any[] = [];
vi.mock("@/state/settings.store", () => ({
  useSettingsStore: () => ({ users, updateUserRole: vi.fn(), setUserDisabled: vi.fn(), statusMessage: "", fetchUsers, isLoadingUsers: false }),
}));

import UserManagement from "../tabs/UserManagement";

describe("parseTeamText", () => {
  it("reads rows pasted from Excel without a header", () => {
    expect(parseTeamText("Jane Smith\tJANE@b.example\t403-555-0101\tbroker\nMo Lee\tmo@b.example\t403-555-0102\tMarketing manager\n")).toEqual([
      { name: "Jane Smith", email: "jane@b.example", phone: "403-555-0101", role: "Broker" },
      { name: "Mo Lee", email: "mo@b.example", phone: "403-555-0102", role: "Marketing" },
    ]);
  });
  it("reads a CSV with a header in any order, quotes and first/last names", () => {
    const csv = 'Email,First name,Last name,Mobile,Role\r\n"ann@b.example","Ann","O\'Neil, Jr",(587) 555-0109,Admin\r\n';
    expect(parseTeamText(csv)).toEqual([{ name: "Ann O'Neil, Jr", email: "ann@b.example", phone: "(587) 555-0109", role: "Admin" }]);
  });
});

describe("Team and roles: import and invite", () => {
  beforeEach(() => { post.mockReset(); fetchUsers.mockClear(); users = []; });

  it("checks a pasted list, then adds the good rows without inviting", async () => {
    post.mockImplementation(async (_p: string, body: any) => body.preview
      ? { ok: true, rows: [{ email: "jane@b.example", status: "new" }, { email: "bad", status: "invalid", error: "invalid_email" }], seats_before: 3, seats_after: 4 }
      : { ok: true, results: [{ email: "jane@b.example", status: "created" }], seats_after: 4, invite_error: null });
    render(<UserManagement />);
    fireEvent.click(screen.getByRole("button", { name: "Import team" }));
    fireEvent.change(screen.getByLabelText("Paste your team"), { target: { value: "Jane Smith\tjane@b.example\t403-555-0101\tBroker\nBad Row\tbad\t403-555-0102\tBroker" } });
    fireEvent.click(screen.getByRole("button", { name: "Check the list" }));
    expect(await screen.findByTestId("team-import-summary")).toHaveTextContent("1 to add, 1 with a problem (skipped). Seats: 3 now, 4 after.");
    expect(screen.getByText("Email address is not valid")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add, invite later" }));
    await waitFor(() => expect(post).toHaveBeenLastCalledWith("/api/users/import", { people: [{ name: "Jane Smith", email: "jane@b.example", phone: "403-555-0101", role: "Broker" }], invite: false }));
    expect(await screen.findByTestId("invite-note")).toHaveTextContent("1 person added. Nobody was emailed");
  });

  it("shows who is not invited and invites them", async () => {
    users = [
      { id: "u1", email: "a@b.example", firstName: "Al", role: "Staff", invited_at: null, silos: [] },
      { id: "u2", email: "c@b.example", firstName: "Cy", role: "Staff", invited_at: "2026-11-21T10:00:00Z", silos: [] },
    ];
    post.mockResolvedValue({ ok: true, sent: ["u1"], failed: [] });
    render(<UserManagement />);
    expect(screen.getAllByText("Not invited").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Invite everyone not yet invited (1)" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/users/invite", { user_ids: ["u1"] }));
    expect(await screen.findByTestId("invite-note")).toHaveTextContent("1 invite sent.");
  });
});
