// KS_PORTAL_v11_LIVE_DEMO - the broker side of the live demo: the REAL portal (BrowserRouter > AuthProvider > App)
// on the sample file. Before the first render: the fetch shim answers the API, a fake staff token signs in (silo BF),
// streams/dialogs/permission prompts are quietened, and the session keeper keeps opening the demo session in the
// background. Never started here: MSAL, the service worker, push registration, SSE, a Twilio Device or the mic.
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import { AuthProvider } from "@/auth/AuthProvider";
import ErrorBoundary from "@/components/system/ErrorBoundary";
import { applyBrand, loadBrand } from "@/config/brand";
import { applyTheme } from "@/theme/theme";
import { SERVER_URL } from "@/config/licensee";
import { DEMO_CONTACT_EMAIL, demoWebsiteUrl } from "../config";
import { ensureSession, getKeeper, initKeeper, subscribeKeeper, trackDemo, waitForSession } from "../demoApi";
import { markLiveDemo } from "../mode";
import { createShim, type Prospect, type Shim } from "./shim";
import { installQuietBrowser } from "./quiet";
import { enterBrokerAuth } from "./session";
import BrokerTour from "./tour/BrokerTour";
import "../liveDemo.css";

function hasSavedTheme(): boolean {
  try {
    return Boolean(window.localStorage.getItem("bf_theme"));
  } catch {
    return false;
  }
}

export type BrokerSetup = { shim: Shim; realFetch: typeof fetch; restore: () => void };

export function prospect(): Prospect {
  const s = getKeeper().session;
  return { name: s?.name?.trim() || "Demo broker", company: s?.company?.trim() || "Your brokerage" };
}

/** Everything before the first render. Returns the shim (tests read its `unhandled` list) and an undo. */
export function setupBrokerDemo(opts: { realFetch?: typeof fetch; latencyMs?: number; sendTimeoutMs?: number } = {}): BrokerSetup {
  markLiveDemo(true);
  document.documentElement.setAttribute("data-live-demo", "broker");
  initKeeper(window.location);
  const original = window.fetch;
  const realFetch = opts.realFetch ?? original.bind(window);
  let serverOrigin = "";
  try {
    serverOrigin = new URL(SERVER_URL).origin;
  } catch {
    /* only same-origin /api calls are answered */
  }
  const shim = createShim({
    realFetch,
    serverOrigin,
    prospect,
    session: () => getKeeper().session,
    waitForSession: () => waitForSession(opts.sendTimeoutMs ?? 90_000),
    latencyMs: opts.latencyMs ?? 0,
  });
  window.fetch = shim.fetch;
  globalThis.fetch = shim.fetch; // the same object in a browser
  const unquiet = installQuietBrowser();
  enterBrokerAuth(prospect().name);
  const unsubscribe = subscribeKeeper((k) => {
    if (k.session?.company) applyBrand({ company_name: k.session.company });
  });
  return {
    shim,
    realFetch,
    restore: () => {
      window.fetch = original;
      globalThis.fetch = original;
      unquiet();
      unsubscribe();
      markLiveDemo(false);
      document.documentElement.removeAttribute("data-live-demo");
    },
  };
}

export function BrokerDemoRoot({ realFetch }: { realFetch: typeof fetch }) {
  const onTrack = (name: string, step: string) => {
    const s = getKeeper().session;
    if (s) void trackDemo(s, name, step, realFetch);
  };
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
        <BrokerTour websiteUrl={demoWebsiteUrl()} supportEmail={DEMO_CONTACT_EMAIL} onTrack={onTrack} />
      </AuthProvider>
    </BrowserRouter>
  );
}

export async function bootBroker(): Promise<void> {
  const { realFetch } = setupBrokerDemo({ latencyMs: 180 });
  // The light theme for a prospect with no saved choice (not saved, so the real portal keeps its own default).
  if (!hasSavedTheme()) applyTheme("light");
  void ensureSession();
  await loadBrand();
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <BrokerDemoRoot realFetch={realFetch} />
    </React.StrictMode>,
  );
}
