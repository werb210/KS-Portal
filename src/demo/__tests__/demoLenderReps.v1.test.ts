// KS_PORTAL_DEMO_LENDER_REPS_v1 - after the package goes out, the Lenders tab shows each lender's people.
import { beforeEach, describe, expect, it } from "vitest";
import { createShim } from "../broker/shim";
import { resetState } from "../broker/state";
import { APP_ID, LENDER_REPS, matchIdFor } from "../broker/fixture";

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
const reps = (s: ReturnType<typeof shim>) => call(s, "GET", `/api/portal/applications/${APP_ID}/lender-reps`);

beforeEach(() => resetState());

describe("demo: lender reps", () => {
  it("nothing before the package is sent; then every sent lender with its reps, the first one already picked", async () => {
    const s = shim();
    expect((await reps(s)).json.data.lenders).toEqual([]);
    await call(s, "POST", "/api/portal/lender-submissions", { applicationId: APP_ID, lenderProductIds: [matchIdFor("aspen-ridge"), matchIdFor("northgate")] });
    const l = (await reps(s)).json.data.lenders;
    expect(l.map((x: { lender_id: string }) => x.lender_id)).toEqual(["aspen-ridge", "northgate"]);
    expect(l[0].rep_id).toBe(LENDER_REPS["aspen-ridge"]![0]!.id);
    expect(l[0].reps[0].phone_extension).toBe("214");
    expect(l[1].rep_id).toBeNull();
    expect(s.unhandled).toEqual([]);
  });
  it("picks a rep, and adds a new one who becomes the rep", async () => {
    const s = shim();
    await call(s, "POST", "/api/portal/lender-submissions", { applicationId: APP_ID, lenderProductIds: [matchIdFor("northgate")] });
    let r = await call(s, "PUT", `/api/portal/applications/${APP_ID}/lenders/northgate/rep`, { rep_id: "rep-northgate-1" });
    expect(r.json.data.lenders[0].rep_id).toBe("rep-northgate-1");
    expect((await call(s, "POST", "/api/portal/lenders/northgate/reps", { name: "", email: "x" })).status).toBe(400);
    r = await call(s, "POST", "/api/portal/lenders/northgate/reps", { name: "Lee Park", email: "lee@northgate.example", phone_extension: "330", application_id: APP_ID });
    const n = r.json.data.lenders[0];
    expect(n.reps.map((x: { name: string }) => x.name)).toContain("Lee Park");
    expect(n.reps.find((x: { id: string }) => x.id === n.rep_id).name).toBe("Lee Park");
  });
});
