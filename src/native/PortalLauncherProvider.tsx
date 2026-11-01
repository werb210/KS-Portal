// BF_PORTAL_BLOCK_v556 - takes Siri/Spotlight launches and keeps Spotlight fed.
import { useEffect } from "react";
import { App } from "@capacitor/app";
import { useNavigate } from "react-router-dom";
import { api } from "@/api";
import { getAuthToken } from "@/lib/authToken";
import { deliverMaya, launcherAvailable, parseLaunchRoute, PortalLauncherPlugin, spotlightItems } from "@/native/portalLauncher";
import { useDialer } from "@/dialer/store";

const REINDEX_MS = 60 * 60 * 1000;
export default function PortalLauncherProvider() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!launcherAvailable()) return;
    let lastIndexed = 0;
    const go = (raw: unknown) => {
      const target = parseLaunchRoute(raw);
      if (!target) return;
      if ("maya" in target) deliverMaya(target.maya);
      // KS_ANDROID_STAFF_v1 - the Android "Phone" icon / "New call" shortcut, and "Call back" on a missed call.
      else if ("dialer" in target) { navigate("/communications"); useDialer.getState().open(); }
      else if ("dial" in target) { navigate("/communications"); void import("@/dialer/actions").then((m) => m.startOutboundPstn(target.dial, { source: "missed_call_alert" })); }
      else navigate(target.path);
    };
    const takePending = () => void PortalLauncherPlugin.take().then((result) => go(result?.route)).catch(() => undefined);
    const reindex = async () => {
      if (!getAuthToken()) { await PortalLauncherPlugin.clearIndex().catch(() => undefined); return; }
      if (Date.now() - lastIndexed < REINDEX_MS) return;
      try {
        const response = await api<unknown>("/api/portal/applications", { headers: { "X-Silo": "BF" } });
        const list = Array.isArray(response) ? response : Array.isArray((response as { items?: unknown[] })?.items) ? (response as { items: unknown[] }).items : [];
        await PortalLauncherPlugin.index({ items: spotlightItems(list as never[]) });
        lastIndexed = Date.now();
      } catch { /* Spotlight is a convenience; never disturb the app. */ }
    };
    takePending(); void reindex();
    const routeHandle = PortalLauncherPlugin.addListener("route", ({ route }) => go(route));
    const stateHandle = App.addListener("appStateChange", ({ isActive }) => { if (isActive) { takePending(); void reindex(); } });
    return () => { void routeHandle.then((handle) => handle.remove()); void stateHandle.then((handle) => handle.remove()); };
  }, [navigate]);
  return null;
}
