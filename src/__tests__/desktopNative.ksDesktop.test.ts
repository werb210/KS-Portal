// KS_NATIVE_DESKTOP_v1 - the native desktop app's build inputs: the brand (name, bundle id, portal address), the
// Tauri config overlay (updater, signing), the macOS entitlements (Associated Domains only with a provisioning
// profile), the capability that lets only the portal call the app, the updater manifest, and the portal's
// apple-app-site-association.
import { describe, expect, it } from "vitest";
import {
  appNameFor, appleAppSiteAssociation, entitlementsPlist, portalCapability, releaseNames, resolveBrand, runtimeBrand,
  tauriOverlay, updaterManifest,
} from "../../desktop/native/brand-lib.mjs";
import { aasaJson, desktopAppIds } from "../../scripts/desktop-aasa.mjs";
import keystone from "../../desktop/native/brands/keystone.json";
import tauriConf from "../../desktop/native/src-tauri/tauri.conf.json";
import localCapability from "../../desktop/native/src-tauri/capabilities/local.json";

const LICENSEE_ENV = {
  DESKTOP_KEY: "northwind",
  DESKTOP_COMPANY_NAME: "Northwind & Sons' Capital",
  DESKTOP_BUNDLE_ID: "com.northwind.staff.desktop",
  DESKTOP_PORTAL_URL: "https://staff.northwind.example/login",
};

describe("native desktop app brand", () => {
  it("the Keystone app finds the company by email or phone (no fixed portal)", () => {
    const brand = resolveBrand(keystone, {});
    expect(brand.portal_url).toBe("");
    expect(brand.ops_url).toMatch(/^https:\/\//);
    expect(runtimeBrand(brand)).toEqual({ app_name: "Keystone Staff Portal", portal_url: "", ops_url: brand.ops_url });
    expect(portalCapability(brand).remote.urls).toEqual(["https://*/*"]);
  });

  it("a licensee build takes its name, bundle id and portal from its environment", () => {
    const brand = resolveBrand(keystone, LICENSEE_ENV);
    expect(brand.app_name).toBe("Northwind and Sons Capital Staff Portal");
    expect(brand.portal_url).toBe("https://staff.northwind.example");
    expect(portalCapability(brand).remote.urls).toEqual(["https://staff.northwind.example/*"]);
    expect(releaseNames(brand)).toEqual({ tag: "desktop-northwind-v2.0.0", manifest: "latest-northwind.json", channel: "desktop-latest" });
  });

  it("refuses a bad bundle id or a non-https portal", () => {
    expect(() => resolveBrand(keystone, { DESKTOP_BUNDLE_ID: "Not A Bundle" })).toThrow(/bundle_id/);
    expect(() => resolveBrand(keystone, { DESKTOP_PORTAL_URL: "http://staff.example.com" })).toThrow(/https/);
    expect(appNameFor("")).toBe("Staff Portal");
    expect(appNameFor("A".repeat(60)).length).toBeLessThanOrEqual(40);
  });

  it("turns on the updater only with a public key", () => {
    const brand = resolveBrand(keystone, {});
    expect(tauriOverlay(brand).bundle.createUpdaterArtifacts).toBe(false);
    expect(tauriOverlay(brand).plugins.updater.endpoints).toEqual([]);
    const on = tauriOverlay(brand, { updaterPubkey: "PUBKEY", windowsThumbprint: "ab cd", adhocSign: true });
    expect(on.bundle.createUpdaterArtifacts).toBe(true);
    expect(on.plugins.updater.endpoints).toEqual(["https://github.com/werb210/ks-portal/releases/download/desktop-latest/latest-keystone.json"]);
    expect(on.bundle.windows.certificateThumbprint).toBe("ABCD");
    expect(on.bundle.macOS.signingIdentity).toBe("-");
    expect(on.identifier).toBe("financial.boreal.keystone.desktop");
  });

  it("adds Associated Domains (passkeys, code AutoFill) only with a provisioning profile and Team ID", () => {
    const brand = resolveBrand(keystone, LICENSEE_ENV);
    const without = entitlementsPlist(brand, { teamId: "ABCDE12345" });
    expect(without).toContain("com.apple.security.device.audio-input");
    expect(without).not.toContain("associated-domains");
    const withProfile = entitlementsPlist(brand, { teamId: "ABCDE12345", provisioned: true });
    expect(withProfile).toContain("<string>webcredentials:staff.northwind.example</string>");
    expect(withProfile).toContain("<string>applinks:staff.northwind.example</string>");
    expect(withProfile).toContain("<string>ABCDE12345.com.northwind.staff.desktop</string>");
  });

  it("writes the update manifest for both Mac chips and Windows", () => {
    const m = updaterManifest({
      version: "2.0.0",
      pubDate: "2026-11-04T00:00:00Z",
      files: {
        "darwin-universal": { url: "https://example/mac.app.tar.gz", signature: "SIGMAC\n" },
        "windows-x86_64": { url: "https://example/setup.exe", signature: "SIGWIN" },
      },
    });
    expect(Object.keys(m.platforms).sort()).toEqual(["darwin-aarch64", "darwin-x86_64", "windows-x86_64"]);
    expect(m.platforms["darwin-aarch64"]!.signature).toBe("SIGMAC");
    expect(() => updaterManifest({ version: "2.0.0", files: {} })).toThrow();
  });

  it("the committed Tauri config ships no window of its own and lets the start page find the company", () => {
    expect(tauriConf.app.windows).toEqual([]);
    expect(tauriConf.app.security.capabilities).toEqual(["local", "portal"]);
    expect(localCapability.permissions).toEqual(["allow-find-company", "allow-choose-company"]);
  });
});

describe("portal apple-app-site-association", () => {
  it("names the desktop apps once a Team ID is set", () => {
    expect(desktopAppIds({})).toEqual([]);
    expect(desktopAppIds({ APPLE_TEAM_ID: "ABCDE12345" })).toEqual(["ABCDE12345.financial.boreal.keystone.desktop"]);
    expect(desktopAppIds({ APPLE_TEAM_ID: "ABCDE12345", DESKTOP_BUNDLE_IDS: "financial.boreal.keystone.desktop,com.northwind.staff.desktop," }))
      .toEqual(["ABCDE12345.financial.boreal.keystone.desktop", "ABCDE12345.com.northwind.staff.desktop"]);
    const aasa = JSON.parse(aasaJson({ APPLE_TEAM_ID: "ABCDE12345" }));
    expect(aasa.webcredentials.apps).toEqual(["ABCDE12345.financial.boreal.keystone.desktop"]);
    expect(aasa.applinks.details[0].components).toEqual([{ "/": "/desktop-app/*", comment: "Opens the desktop app" }]);
  });

  it("ignores ids that are not TEAMID.bundle", () => {
    expect(appleAppSiteAssociation(["bad", "ABCDE12345.com.example.app"]).webcredentials.apps).toEqual(["ABCDE12345.com.example.app"]);
  });
});
