import { describe, expect, it } from "vitest";
import { addressesFromHost, runtimeConfig } from "../licensee";

// KS_SHARED_APP_BUILD_v1
describe("shared build addresses", () => {
  it("reads the web host's /ks-config.js answer", () => {
    expect(runtimeConfig({ __KS_CONFIG__: { code: "acme", server_url: "https://acme.api.k.test" } })).toEqual({ code: "acme", server_url: "https://acme.api.k.test" });
    expect(runtimeConfig({})).toEqual({});
    expect(runtimeConfig(undefined)).toEqual({});
  });
  it("works out the server and client app from a portal address", () => {
    expect(addressesFromHost("acme.portal.keystonecrm.online")).toEqual({ server: "https://acme.api.keystonecrm.online", client: "https://acme.app.keystonecrm.online" });
    expect(addressesFromHost("localhost")).toBeNull();
    expect(addressesFromHost("thankful-wave-04964490f.2.azurestaticapps.net")).toBeNull();
  });
});
