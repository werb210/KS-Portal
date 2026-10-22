// KS_PORTAL_v8_DEMO - starts the demo page instead of the portal when the address is /demo. Nothing of the real portal
// boots (no sign-in check, MSAL, push, or service worker).
import React from "react";
import ReactDOM from "react-dom/client";
import DemoApp from "./DemoApp";

export function isDemoPath(pathname: string): boolean {
  return pathname === "/demo" || pathname.startsWith("/demo/");
}

export function bootDemo(): void {
  document.title = "Keystone demo";
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <DemoApp />
    </React.StrictMode>,
  );
}
