import { describe, expect, it } from "vitest";
import { forBrokerage } from "../GoogleHealthPanel";

describe("Google checks on a brokerage's System check page", () => {
  it("shows a part that was never connected as Off, without the server's setting name", () => {
    const c = forBrokerage({ key: "login", label: "Google login", status: "fail", detail: "GOOGLE_ADS_REFRESH_TOKEN is not set" });
    expect(c.status).toBe("off");
    expect(c.detail).not.toMatch(/GOOGLE_|_TOKEN/);
    expect(c.detail).toMatch(/Settings > Integrations/);
  });
  it("leaves a real failure and a pass as they are", () => {
    const fail = { key: "login", label: "Google login", status: "fail" as const, detail: "Google refused the sign-in (invalid_grant)" };
    expect(forBrokerage(fail)).toEqual(fail);
    const ok = { key: "x", label: "x", status: "ok" as const, detail: "42 conversions" };
    expect(forBrokerage(ok)).toEqual(ok);
  });
});
