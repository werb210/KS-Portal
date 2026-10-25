// KS_PORTAL_v8_DEMO / KS_PORTAL_v11_LIVE_DEMO - /demo boots on its own, without the portal's sign-in: the phase-1
// shell (the client app in a phone frame). Nothing of the real portal starts here (no MSAL, push or service worker).
import React from "react";
import ReactDOM from "react-dom/client";
import DemoShell from "./DemoShell";
import PresenterStart from "./presenter/PresenterStart";
import PhoneBroker from "./phone/PhoneBroker";
import { isPhoneBrokerPath, isPresenterPath } from "./mode";
import "./liveDemo.css";

export { isDemoPath } from "./mode";

export function bootDemo(): void {
  document.title = "Keystone demo";
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      {isPresenterPath(window.location.pathname) ? <PresenterStart /> : isPhoneBrokerPath(window.location.pathname) ? <PhoneBroker /> : <DemoShell />}
    </React.StrictMode>,
  );
}
