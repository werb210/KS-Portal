import { describe, expect, it } from "vitest";
import { patchSharedConfig, sharedPolicy } from "../../../scripts/shared-csp.mjs";
import { DEV_SERVER_HOST } from "../../../scripts/server-csp.mjs";
import { blobPrefix } from "../../../deploy/publish-site.mjs";

// KS_SHARED_APP_BUILD_v1
describe("shared build policy", () => {
  const csp = `default-src 'self'; connect-src 'self' https://${DEV_SERVER_HOST} wss://${DEV_SERVER_HOST}; frame-src 'self';`;
  it("allows every brokerage's server and client app", () => {
    const p = sharedPolicy(csp, "keystonecrm.online");
    expect(p).toContain("https://*.api.keystonecrm.online");
    expect(p).toContain("wss://*.api.keystonecrm.online");
    expect(p).toContain("https://*.app.keystonecrm.online");
  });
  it("patches the build's staticwebapp.config.json", () => {
    const out = JSON.parse(patchSharedConfig(JSON.stringify({ globalHeaders: { "Content-Security-Policy": csp } }), "k.test"));
    expect(out.globalHeaders["Content-Security-Policy"]).toContain("*.api.k.test");
  });
  it("publishes to sites/_shared/<app>/", () => {
    expect(blobPrefix("_shared", "portal")).toBe("_shared/portal/");
    expect(() => blobPrefix("_bad", "portal")).toThrow();
  });
});
