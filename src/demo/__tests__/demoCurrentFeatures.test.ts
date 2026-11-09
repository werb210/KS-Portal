// KS_PORTAL_DEMO_CURRENT_FEATURES - the presenter can show the Dashboard, "Ask Maya for a report" and lead scores.
import { beforeEach, describe, expect, it } from "vitest";
import { createShim } from "../broker/shim";
import { resetState } from "../broker/state";

const shim = () => createShim({
  realFetch: (async () => new Response("{}")) as unknown as typeof fetch,
  serverOrigin: "https://api.demo.test",
  prospect: () => ({ name: "Pat Prospect", company: "Pat's Brokerage" }),
  session: () => null,
  waitForSession: async () => { throw new Error("no session"); },
  latencyMs: 0,
  localSubmit: true,
});
const call = async (s: ReturnType<typeof shim>, method: string, path: string, body?: unknown) => {
  const r = await s.fetch(`https://api.demo.test${path}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json() };
};

beforeEach(() => resetState());

describe("demo: current features", () => {
  it("answers the Dashboard and keeps the layout in the tab", async () => {
    const s = shim();
    expect((await call(s, "GET", "/api/dashboard/metrics")).json.activeApplications).toBe(5);
    await call(s, "PUT", "/api/reports/layouts", { silo: "BF", tabs: [], dashboard: { cards: [{ id: "x", report: "maya_table" }] } });
    expect((await call(s, "GET", "/api/reports/layouts?silo=BF")).json.dashboard.cards[0].report).toBe("maya_table");
  });
  it("builds a Maya table from a question", async () => {
    const s = shim();
    const ask = (await call(s, "POST", "/api/reports/ask", { question: "applications by product", silo: "BF" })).json;
    expect(ask).toMatchObject({ kind: "table", spec: { group_by: "product" } });
    const t = (await call(s, "GET", `/api/reports/maya-table?silo=BF&spec=${encodeURIComponent(JSON.stringify(ask.spec))}`)).json;
    expect(t.rows.reduce((n: number, r: { value: number }) => n + r.value, 0)).toBe(5);
  });
  it("scores contacts", async () => {
    const s = shim();
    const r = (await call(s, "POST", "/api/lead-scores/lookup", { contact_ids: ["a", "b"] })).json;
    expect(r.scores.a.grade).toBe("hot");
    expect(s.unhandled).toEqual([]);
  });
});
