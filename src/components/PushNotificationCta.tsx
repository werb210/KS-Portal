import { useEffect } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import { isLiveDemo } from "@/demo/mode"; // KS_PORTAL_v12_DEMO_FIXES

const PushNotificationCta = () => {
  const { user, authStatus } = useAuth();
  const { permission, requestPermission, isSupported, hasPrompted, hydratePreference } =
    usePushNotifications();

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const userId = (user as { id?: string } | null)?.id ?? null;
    hydratePreference(userId);
  }, [authStatus, hydratePreference, user]);

  if (!isSupported || isLiveDemo()) return null; // KS_PORTAL_v12_DEMO_FIXES - no browser notifications in the demo

  if (permission === "denied") {
    return <span className="text-xs text-slate-500">Notifications are blocked in browser settings.</span>;
  }

  if (permission === "granted") {
    return null;
  }

  return (
    <Button variant="ghost" onClick={() => void requestPermission()}>
      {hasPrompted ? "Enable Notifications" : "Allow Notifications"}
    </Button>
  );
};

export default PushNotificationCta;
