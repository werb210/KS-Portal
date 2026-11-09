// KS_PORTAL_OWN_APP_ID_v1 - the Keystone iPad app ships as its own app (com.keystonecrm.portal) and never shows Boreal
// to licensees: no Boreal bundle ids, app groups or user-visible names in the iOS project.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");
const IOS_FILES = [
  "capacitor.config.ts",
  "ios/App/App.xcodeproj/project.pbxproj",
  "ios/App/App/Info.plist",
  "ios/App/App/App.entitlements",
  "ios/App/BorealShare/Info.plist",
  "ios/App/BorealShare/BorealShare.entitlements",
  "ios/App/BorealWidget/Info.plist",
  "ios/App/BorealWidget/BorealWidget.entitlements",
];

describe("Keystone iPad app identity", () => {
  it("uses com.keystonecrm.portal for the app, widget, share extension and app group", () => {
    const pbx = read("ios/App/App.xcodeproj/project.pbxproj");
    expect(pbx).toContain("PRODUCT_BUNDLE_IDENTIFIER = com.keystonecrm.portal;");
    expect(pbx).toContain("PRODUCT_BUNDLE_IDENTIFIER = com.keystonecrm.portal.widget;");
    expect(pbx).toContain("PRODUCT_BUNDLE_IDENTIFIER = com.keystonecrm.portal.share;");
    expect(read("ios/App/App/App.entitlements")).toContain("group.com.keystonecrm.portal");
    expect(read("capacitor.config.ts")).toContain("appId: 'com.keystonecrm.portal'");
  });

  it("has no Boreal ids or names in the native project files", () => {
    for (const f of IOS_FILES) {
      const s = read(f).replace(/Boreal(Share|Widget)\//g, "").replace(/BorealShare|BorealWidget/g, "");
      expect(s, f).not.toMatch(/com\.boreal/);
      expect(s, f).not.toMatch(/Boreal (Staff )?Portal|<string>Boreal/);
    }
  });

  it("shows Keystone in visible native text", () => {
    expect(read("ios/App/App/Info.plist")).toContain("<string>Keystone Staff Portal</string>");
    expect(read("ios/App/BorealWidget/SummaryWidget.swift")).not.toMatch(/"Boreal |Text\("Open Boreal/);
    expect(read("ios/App/BorealWidget/SummaryConfiguration.swift")).not.toContain("Boreal");
    expect(read("ios/App/BorealShare/ShareViewController.swift")).toContain('"Keystone Portal"');
  });
});
