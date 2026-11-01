// KS_ANDROID_STAFF_v1 - the Android staff app: the web side picks the Android voice token and push app, calls through
// the native engine, understands the Android launch routes, and the build brand (application id, names, colours) is
// resolved like the desktop and client apps.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  platform: "android" as string,
  post: vi.fn(async (_url: string, _body: unknown) => ({ ok: true })),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => h.platform,
    isNativePlatform: () => h.platform !== "web",
    isPluginAvailable: () => true,
  },
  registerPlugin: () => ({}),
}));
vi.mock("@/api", () => ({ api: Object.assign(vi.fn(async () => ({})), { post: h.post }) }));

import { jsDeviceRegistersForIncoming, nativeVoiceAvailable, portalVoipApp } from "@/native/portalVoip";
import { shouldCallNatively } from "@/dialer/nativeVoice";
import { isFcmToken, pushTokenBody, registerPortalPushToken } from "@/native/portalPushToken";
import { parseLaunchRoute, launcherAvailable } from "@/native/portalLauncher";
import { biometryLabel, isNativeIos } from "@/native/biometricLockPolicy";
import { isNativeWorkstation } from "@/native/ipadWorkstation";
import { fixedServerBuild } from "@/config/workspace";
import {
  brandProperties, contrast, DEFAULT_APPLICATION_ID, onBrandColor, packageSegment, resolveAndroidBrand,
} from "../../../scripts/android-brand.mjs";

const FCM = "dK3x9_aB-12:APA91b" + "Hk7_Qw-3".repeat(18);

beforeEach(() => {
  h.platform = "android";
  h.post.mockClear();
});

describe("calls in the Android staff app", () => {
  it("asks for the Android voice token (KS-server's FCM push credential)", () => {
    expect(portalVoipApp("android")).toBe("portal-android");
    expect(portalVoipApp("ios")).toBe("portal-ios");
    expect(portalVoipApp()).toBe("portal-android");
  });

  it("the native engine owns incoming calls once registered, so the page never rings twice", () => {
    expect(nativeVoiceAvailable()).toBe(true);
    expect(jsDeviceRegistersForIncoming({ platform: "android", pluginAvailable: true, nativeRegistered: true })).toBe(false);
    expect(jsDeviceRegistersForIncoming({ platform: "android", pluginAvailable: true, nativeRegistered: false })).toBe(true);
  });

  it("always places calls natively on Android (screen off, Bluetooth, lock screen), never on the web", () => {
    expect(shouldCallNatively({ native: true, webMic: true, platform: "android" })).toBe(true);
    expect(shouldCallNatively({ native: true, webMic: true, platform: "ios" })).toBe(false);
    expect(shouldCallNatively({ native: false, webMic: true, platform: "android" })).toBe(false);
  });
});

describe("push alerts in the Android staff app", () => {
  it("recognises FCM tokens and sends them as portal-android", async () => {
    expect(isFcmToken(FCM)).toBe(true);
    expect(isFcmToken("ab".repeat(32))).toBe(false); // too short for FCM
    expect(isFcmToken("has spaces " + FCM)).toBe(false);
    expect(pushTokenBody(` ${FCM} `, "android")).toEqual({ token: FCM, app: "portal-android", environment: "production" });
    expect(await registerPortalPushToken(FCM)).toBe(true);
    expect(h.post).toHaveBeenCalledWith("/api/staff/push-token", { token: FCM, app: "portal-android", environment: "production" });
  });

  it("does not send an APNs-looking token from Android", async () => {
    expect(await registerPortalPushToken("ab".repeat(32))).toBe(false);
    expect(h.post).not.toHaveBeenCalled();
  });
});

describe("launch routes", () => {
  it("the Phone icon, New call and Call back arrive as routes", () => {
    expect(launcherAvailable()).toBe(true);
    expect(parseLaunchRoute("dialer:")).toEqual({ dialer: true });
    expect(parseLaunchRoute("dial:+14035550199")).toEqual({ dial: "+14035550199" });
    expect(parseLaunchRoute("dial:4035550199")).toBeNull();
    expect(parseLaunchRoute("dial:+1 403")).toBeNull();
    expect(parseLaunchRoute("/communications")).toEqual({ path: "/communications" });
    expect(parseLaunchRoute("//evil.example")).toBeNull();
  });
});

describe("native pieces shared with the iPad", () => {
  it("biometric lock and the workstation plugin are on for Android", () => {
    expect(isNativeIos()).toBe(true);
    expect(isNativeWorkstation()).toBe(true);
    expect(biometryLabel("biometric")).toBe("fingerprint or face");
    h.platform = "web";
    expect(isNativeIos()).toBe(false);
    expect(isNativeWorkstation()).toBe(false);
  });

  it("a licensee's own app has a fixed server; the Keystone app finds the company", () => {
    expect(fixedServerBuild({ VITE_KS_FIXED_SERVER: "true" })).toBe(true);
    expect(fixedServerBuild({ VITE_KS_FIXED_SERVER: "" })).toBe(false);
    expect(fixedServerBuild({})).toBe(false);
  });
});

describe("Android build brand (scripts/android-brand.mjs)", () => {
  it("no settings = the Keystone app", () => {
    const b = resolveAndroidBrand({});
    expect(b.application_id).toBe(DEFAULT_APPLICATION_ID);
    expect(b.app_name).toBe("Keystone Staff Portal");
    expect(b.phone_name).toBe("Keystone Phone");
    expect(b.on_brand_color).toBe("#FFFFFF");
    expect(brandProperties(b)).toContain("applicationId=financial.boreal.keystone.portal\n");
  });

  it("a licensee gets its own application id and names from its environment", () => {
    const b = resolveAndroidBrand({ ANDROID_LICENSEE: "north-wind", VITE_COMPANY_NAME: "North Wind & Co" });
    expect(b.application_id).toBe("financial.boreal.keystone.north_wind.portal");
    expect(b.app_name).toBe("North Wind and Co Staff Portal");
    expect(b.phone_name).toBe("North Wind and Co Phone");
    expect(packageSegment("7seas")).toBe("k7seas");
    expect(resolveAndroidBrand({ ANDROID_LICENSEE: "acme", ANDROID_APPLICATION_ID: "ca.acme.staff" }).application_id).toBe("ca.acme.staff");
  });

  it("text on the brand colour is always readable", () => {
    for (const color of ["#1E3A8A", "#F5D90A", "#FFFFFF", "#0B1F3A", "#22C55E", "#777777"]) {
      expect(contrast(color, onBrandColor(color))).toBeGreaterThanOrEqual(4.5);
    }
    expect(onBrandColor("#F5D90A")).toBe("#111827");
    expect(onBrandColor("#777777")).toBe("#000000");
  });

  it("refuses ids, names and colours the stores or Android would reject", () => {
    expect(() => resolveAndroidBrand({ ANDROID_APPLICATION_ID: "Com.Bad-Id" })).toThrow(/application id/);
    expect(() => resolveAndroidBrand({ ANDROID_BRAND_COLOR: "blue" })).toThrow(/brand colour/);
    expect(() => resolveAndroidBrand({ ANDROID_APP_NAME: "x" })).toThrow(/app name/);
    expect(() => resolveAndroidBrand({ ANDROID_LICENSEE: "Bad Code" })).toThrow(/licensee code/);
  });
});

describe("Firebase file for the build (scripts/android-google-services.mjs)", () => {
  it("uses the secret only when it is for this application id, raw or base64", async () => {
    const { applicationIdFrom, placeholderFor, realFileFor } = await import("../../../scripts/android-google-services.mjs");
    expect(applicationIdFrom("appName=X\napplicationId=ca.acme.staff\n")).toBe("ca.acme.staff");
    const real = JSON.stringify({ client: [{ client_info: { android_client_info: { package_name: "ca.acme.staff" } } }] });
    expect(realFileFor("ca.acme.staff", real)).toBe(real + "\n");
    expect(realFileFor("ca.acme.staff", Buffer.from(real).toString("base64"))).toBe(real + "\n");
    expect(realFileFor("other.app.id", real)).toBeNull();
    expect(realFileFor("ca.acme.staff", "")).toBeNull();
    expect(JSON.parse(placeholderFor("ca.acme.staff")).client[0].client_info.android_client_info.package_name).toBe("ca.acme.staff");
  });
});
