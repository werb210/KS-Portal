// KS_PORTAL_v11_LIVE_DEMO / KS_PORTAL_v13_PHONE_DEMO - leaving the client side for the broker side. A computer or an
// iPad opens the real portal (/pipeline); a phone opens the camera page (/demo/broker), which runs the same portal.
import { requestBrokerMode } from "./broker/session";
import { PHONE_BROKER_PATH } from "./mode";
import { isPhoneViewport } from "./phone/phone";

/** Navigation, behind a seam so tests can watch it. */
export const shellNav = { assign: (url: string) => window.location.assign(url) };

export function goBroker(): void {
  requestBrokerMode();
  shellNav.assign(isPhoneViewport() ? PHONE_BROKER_PATH : "/pipeline");
}
