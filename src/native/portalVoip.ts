// BF_PORTAL_v817_IPAD_VOIP - the iPad app's native calling (ios/App/App/BorealVoicePlugin.swift, jsName "BorealVoice").
// Incoming calls ring through PushKit + CallKit even when the app is closed; this wrapper
// hands the native side the Twilio access token and lets the dialer UI follow native calls.
// KS_ANDROID_STAFF_v1 - the Android staff app has the same plugin (android/.../BorealVoicePlugin.java: Twilio Voice
// Android SDK, FCM pushes, Android Telecom), so everything here works there too. A no-op in web browsers.
import { Capacitor, registerPlugin } from "@capacitor/core";

export type NativeCallInfo = {
  uuid?: string;
  callSid?: string;
  from?: string;
  callerName?: string;
  phase?: "ringing" | "connecting" | "connected";
  reason?: string;
};
export type NativeVoiceState = {
  registered: boolean;
  hasDeviceToken: boolean;
  muted: boolean;
  speaker: boolean;
  lastError?: string;
  call?: NativeCallInfo;
};
export type NativeCallStateChange = {
  state: "ringing" | "connecting" | "connected" | "ended";
  from: string;
  uuid: string;
  callerName?: string;
  reason?: string;
};
export type NativeVoiceEvent =
  | "callStateChanged"
  | "callIncoming"
  | "callAnswered"
  | "callConnected"
  | "callEnded"
  | "callMuted"
  | "registrationChanged";

export interface BorealVoicePlugin {
  register(options: { accessToken: string }): Promise<{ registered: boolean; error?: string }>;
  unregister(): Promise<void>;
  mute(options: { muted: boolean }): Promise<{ muted: boolean }>;
  speaker(options: { on: boolean }): Promise<{ speaker: boolean }>;
  hangup(): Promise<void>;
  getState(): Promise<NativeVoiceState>;
  // BF_PORTAL_v824_NATIVE_OUTGOING - an outgoing call placed by the app itself (the web page has no microphone).
  connect(options: { accessToken?: string; params: Record<string, string> }): Promise<{ started: boolean; error?: string }>;
  sendDigits(options: { digits: string }): Promise<void>;
  // KS_ANDROID_STAFF_v1 - Android only: answer / decline a ringing call from the portal page (the iPad answers in
  // CallKit's own screen).
  answer?(options: { uuid?: string }): Promise<void>;
  reject?(options: { uuid?: string }): Promise<void>;
  addListener(event: NativeVoiceEvent, cb: (data: any) => void): Promise<{ remove: () => Promise<void> }>;
}

export const BorealVoice = registerPlugin<BorealVoicePlugin>("BorealVoice");

/** KS_ANDROID_STAFF_v1 - the platforms whose app carries the BorealVoice plugin. */
export function isNativeVoicePlatform(platform: string): boolean {
  return platform === "ios" || platform === "android";
}

/** The iPad or Android staff app with a build that has the BorealVoice plugin. Web browsers: false. */
export function nativeVoiceAvailable(): boolean {
  try {
    return isNativeVoicePlatform(Capacitor.getPlatform()) && Capacitor.isPluginAvailable("BorealVoice");
  } catch {
    return false;
  }
}

// BF_PORTAL_v817_IPAD_VOIP - the app id BF-Server uses to pick the portal's Twilio Push Credential
// (TWILIO_PUSH_CREDENTIAL_SID_PORTAL) for the voice token.
export const PORTAL_VOIP_APP = "portal-ios" as const;
// KS_ANDROID_STAFF_v1 - the Android staff app's voice token names KS-server's Android (FCM) push credential.
export const PORTAL_VOIP_APP_ANDROID = "portal-android" as const;
export type PortalVoipApp = typeof PORTAL_VOIP_APP | typeof PORTAL_VOIP_APP_ANDROID;

export function portalVoipApp(platform: string = safePlatform()): PortalVoipApp {
  return platform === "android" ? PORTAL_VOIP_APP_ANDROID : PORTAL_VOIP_APP;
}

function safePlatform(): string {
  try { return Capacitor.getPlatform(); } catch { return "web"; }
}

/**
 * BF_PORTAL_v817_IPAD_VOIP - should the Twilio JS Device register for INCOMING calls?
 * Web browsers / Android: yes (unchanged). The iPad app with the native plugin: no once the
 * native (PushKit + CallKit) registration succeeded, so the iPad never rings twice. The JS
 * Device is still used for outgoing calls either way. If the native side could not register
 * (no push credential on the server yet, no VoIP token) the JS Device keeps the iPad ringing
 * while the app is open, and stops as soon as the native registration lands.
 */
export function jsDeviceRegistersForIncoming(opts: {
  platform: string;
  pluginAvailable: boolean;
  nativeRegistered: boolean;
}): boolean {
  const nativeApp = isNativeVoicePlatform(opts.platform) && opts.pluginAvailable;
  return !(nativeApp && opts.nativeRegistered);
}

/** Registers this iPad for incoming VoIP calls. False when the native side could not (no push credential, no VoIP token). */
export async function registerNativeIncoming(accessToken: string): Promise<boolean> {
  if (!accessToken || !nativeVoiceAvailable()) return false;
  try {
    const r = await BorealVoice.register({ accessToken });
    return !!r?.registered;
  } catch {
    return false;
  }
}

export async function unregisterNativeIncoming(): Promise<void> {
  if (!nativeVoiceAvailable()) return;
  try { await BorealVoice.unregister(); } catch { /* older build */ }
}

/** "client:abc" -> "abc"; keeps a phone number as-is. */
export function nativeCallerLabel(info: NativeCallInfo | null | undefined): string {
  const name = String(info?.callerName ?? "").trim();
  if (name) return name;
  const from = String(info?.from ?? "").replace(/^client:/, "").trim();
  return from || "Unknown caller";
}

// BF_PORTAL_v817_IPAD_VOIP - the wrapper as one object: portalVoip.register(token) / portalVoip.unregister().
export const portalVoip = {
  available: nativeVoiceAvailable,
  register: registerNativeIncoming,
  unregister: unregisterNativeIncoming,
  onCallStateChanged(cb: (e: NativeCallStateChange) => void): () => void {
    if (!nativeVoiceAvailable()) return () => {};
    const handle = BorealVoice.addListener("callStateChanged", cb);
    return () => { void Promise.resolve(handle).then((x) => x?.remove()).catch(() => {}); };
  },
};
