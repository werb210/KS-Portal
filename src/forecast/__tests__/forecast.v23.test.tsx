// KS_PORTAL_v23_FORECAST - the Forecast card and a file's forecast panel.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { planBody } from "@/plans/__tests__/fixtures";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put } }));

import ForecastCard from "@/forecast/ForecastCard";
import { renderReport } from "@/pages/reports/ReportDataCards";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";
import type { Forecast } from "@/forecast/forecastApi";

const b = (o: Partial<Record<string, number | null>> = {}) => ({ closed: 0, commit: 0, best_case: 0, pipeline: 0, weighted: 0, closed_amount: 0, files: 0, goal_commission: null, goal_funding: null, ...o }) as any;
const data: Forecast = {
  granularity: "month", from: "2026-11", currency: "CAD", own: false, team_id: null, probabilities: { Offer: 70 },
  periods: [{ key: "2026-11", label: "Nov 2026", start: "2026-11-01", end: "2026-12-01" }],
  reps: [{ user_id: "u1", name: "Rita", periods: [b({ closed: 1000, commit: 3000, best_case: 3000, pipeline: 3000, weighted: 2400, goal_commission: 3000 })] }],
  teams: [{ team_id: "t1", name: "West", periods: [b({ closed: 1000, commit: 3000 })] }],
  total: [b({ closed: 1000, commit: 3000, best_case: 3000, pipeline: 3000, weighted: 2400, goal_commission: 3000 })],
  unscheduled: { files: 2, pipeline: 5000, weighted: 800 }, overdue_files: 1,
  deals: [{ id: "a1", name: "Acme", owner: "u1", owner_name: "Rita", stage: "Offer", probability: 70, category: "commit", expected_close_date: "2026-11-20", commission: 2000, weighted: 1400, period: "2026-11", overdue: false }],
};

beforeEach(() => { h.get.mockReset(); h.put.mockReset(); __setPlanForTests(null); });

describe("Forecast card", () => {
  it("renders the roll-up from the report data, with goal attainment and the unscheduled files", () => {
    renderWithRole(<>{renderReport("forecast", data)}</>, "Admin");
    expect(screen.getByTestId("forecast-card")).toBeInTheDocument();
    expect(screen.getByText("Everyone")).toBeInTheDocument();
    expect(screen.getByText("Team: West")).toBeInTheDocument();
    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
    expect(screen.getByText(/have no expected close date/)).toBeInTheDocument();
  });

  it("switches to quarters, edits a file's close date, and Admins save stage chances", async () => {
    h.get.mockImplementation(async (url: string) => (url.startsWith("/api/forecast/stages") ? { ok: true, stages: [{ stage: "Offer", probability: 70 }] } : { ok: true, ...data, granularity: "quarter" }));
    h.put.mockResolvedValue({ ok: true });
    renderWithRole(<ForecastCard initial={data} />, "Admin");
    fireEvent.click(screen.getByRole("button", { name: "Quarterly" }));
    await waitFor(() => expect(h.get).toHaveBeenCalledWith("/api/forecast?granularity=quarter"));
    fireEvent.click(screen.getByRole("button", { name: /Show the files/ }));
    fireEvent.change(screen.getByLabelText("Expected close for Acme"), { target: { value: "2026-12-05" } });
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/forecast/applications/a1", { expected_close_date: "2026-12-05" }));
    fireEvent.click(screen.getByRole("button", { name: "Stage chances" }));
    fireEvent.change(await screen.findByLabelText("Offer chance"), { target: { value: "65" } });
    fireEvent.click(screen.getByRole("button", { name: "Save chances" }));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/forecast/stages", { stages: { Offer: 65 } }));
  });

  it("staff do not get the stage chances button", () => {
    renderWithRole(<ForecastCard initial={{ ...data, own: true }} />, "Staff");
    expect(screen.queryByRole("button", { name: "Stage chances" })).toBeNull();
    expect(screen.queryByText("Everyone")).toBeNull();
  });
});

