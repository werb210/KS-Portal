// KS_PORTAL_v20_TEAMS - Settings > Teams (visibility per role and per person, teams and members) and the Team filter.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put, patch: h.patch } }));

import TeamsSettings from "../TeamsSettings";
import TeamFilter, { setReportTeam, withTeam } from "../TeamFilter";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";
import { planBody } from "@/plans/__tests__/fixtures";

const overview = () => ({
  teams: [{ id: "t1", name: "North", description: null, archived_at: null, members: [{ user_id: "u2" }] }],
  users: [
    { id: "u1", email: "ada@example.com", role: "Admin", first_name: "Ada", last_name: "A", primary_team_id: null, record_visibility: null, team_ids: [] },
    { id: "u2", email: "sam@example.com", role: "Staff", first_name: "Sam", last_name: "S", primary_team_id: "t1", record_visibility: null, team_ids: ["t1"] },
    { id: "u3", email: "sue@example.com", role: "Staff", first_name: "Sue", last_name: "T", primary_team_id: null, record_visibility: "own", team_ids: [] },
  ],
  role_visibility: { Staff: "all", Ops: "all", Marketing: "all" },
  roles: ["Staff", "Ops", "Marketing"],
});

beforeEach(() => {
  h.get.mockReset(); h.post.mockReset(); h.put.mockReset(); h.patch.mockReset();
  __setPlanForTests(null);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("Settings > Teams", () => {
  it("sets what each role sees (Admins always see everything)", async () => {
    h.get.mockResolvedValue(overview());
    h.put.mockResolvedValue({ ok: true });
    render(<TeamsSettings />);
    const staff = await screen.findByLabelText("Staff");
    expect(staff).toHaveValue("all");
    fireEvent.change(staff, { target: { value: "own" } });
    expect(screen.getByText("Sees only records they own (or deals they are assigned to).")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/teams/visibility/roles", { Staff: "own", Ops: "all", Marketing: "all" }));
    expect(within(screen.getByTestId("team-user-u1")).getByText("All records (Admin)")).toBeInTheDocument();
  });

  it("creates teams, sets members and a person's override and primary team", async () => {
    h.get.mockResolvedValue(overview());
    h.post.mockResolvedValue({ team: { id: "t2", name: "South", members: [] } });
    h.put.mockResolvedValue({ ok: true, user: {} });
    render(<TeamsSettings />);
    fireEvent.change(await screen.findByLabelText("New team name"), { target: { value: "South" } });
    fireEvent.click(screen.getByRole("button", { name: "Add team" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/teams", { name: "South", description: "" }));
    const row = screen.getByTestId("team-row-t1");
    expect(row).toHaveTextContent("Sam S");
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    fireEvent.click(within(row).getByLabelText(/Sue T/));
    fireEvent.click(within(row).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/teams/t1/members", { user_ids: ["u2", "u3"] }));
    fireEvent.change(screen.getByLabelText("Visibility for Sam S"), { target: { value: "team" } });
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/teams/users/u2", { record_visibility: "team" }));
    expect(screen.getByLabelText("Visibility for Sue T")).toHaveValue("own");
    expect(screen.getByLabelText("Primary team for Sue T")).toBeDisabled(); // no teams yet
  });
});

describe("Team filter", () => {
  it("is hidden without teams in the plan, and lists teams on Growth", async () => {
    __setPlanForTests(normalizePlan(planBody({ plan: "starter", features: { teams: false } })));
    const { container, unmount } = render(<TeamFilter value="" onChange={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
    expect(h.get).not.toHaveBeenCalled();
    unmount();
    __setPlanForTests(normalizePlan(planBody({ plan: "growth", effective_plan: "growth", features: { teams: true } })));
    h.get.mockResolvedValue({ teams: [{ id: "t1", name: "North" }] });
    const onChange = vi.fn();
    render(<TeamFilter value="" onChange={onChange} />);
    fireEvent.change(await screen.findByTestId("team-filter"), { target: { value: "t1" } });
    expect(onChange).toHaveBeenCalledWith("t1");
    expect(h.get).toHaveBeenCalledWith("/api/teams/options");
  });

  it("adds team_id to report requests", () => {
    expect(withTeam("/api/reports/data/stuck_deals", "t1")).toBe("/api/reports/data/stuck_deals?team_id=t1");
    expect(withTeam("/api/reports/data/x?days=30", "t1")).toBe("/api/reports/data/x?days=30&team_id=t1");
    expect(withTeam("/api/reports/data/x", "")).toBe("/api/reports/data/x");
    setReportTeam("");
  });
});
