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
import { PHONE_BROKER_PATH, framedByPhoneBroker, isPresenterDemo, markLiveDemo, markPresenterDemo, readPresenter } from "../mode";
import { isPhoneViewport } from "../phone/phone";
import { markCameraDemo } from "./tour/bridge";
import { createShim, type Prospect, type Shim } from "./shim";
import { installQuietBrowser } from "./quiet";
import { enterBrokerAuth } from "./session";
import BrokerTour from "./tour/BrokerTour";
import PresenterBar from "../presenter/PresenterBar";
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
  // KS_PORTAL_v12_PRESENTER - the presenter typed the prospect's name and brokerage on the start page.
  if (isPresenterDemo()) {
    const p = readPresenter()?.prospect;
    return { name: p?.name?.trim() || "Demo broker", company: p?.company?.trim() || "Your brokerage" };
  }
  const s = getKeeper().session;
  return { name: s?.name?.trim() || "Demo broker", company: s?.company?.trim() || "Your brokerage" };
}

/** Everything before the first render. Returns the shim (tests read its `unhandled` list) and an undo. */
export function setupBrokerDemo(opts: { realFetch?: typeof fetch; latencyMs?: number; sendTimeoutMs?: number; presenter?: boolean } = {}): BrokerSetup {
  markLiveDemo(true);
  markPresenterDemo(Boolean(opts.presenter));
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
    localSubmit: Boolean(opts.presenter),
  });
  window.fetch = shim.fetch;
  globalThis.fetch = shim.fetch; // the same object in a browser
  const unquiet = installQuietBrowser();
  enterBrokerAuth(prospect().name);
  const unsubscribe = subscribeKeeper((k) => {
    if (!opts.presenter && k.session?.company) applyBrand({ company_name: k.session.company });
  });
  if (opts.presenter) applyBrand({ company_name: prospect().company });
  return {
    shim,
    realFetch,
    restore: () => {
      window.fetch = original;
      globalThis.fetch = original;
      unquiet();
      unsubscribe();
      markLiveDemo(false);
      markPresenterDemo(false);
      document.documentElement.removeAttribute("data-live-demo");
    },
  };
}

export function BrokerDemoRoot({ realFetch, presenter = false }: { realFetch: typeof fetch; presenter?: boolean }) {
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
        {presenter ? <PresenterBar /> : <BrokerTour websiteUrl={demoWebsiteUrl()} supportEmail={DEMO_CONTACT_EMAIL} onTrack={onTrack} />}
      </AuthProvider>
    </BrowserRouter>
  );
}

export async function bootBroker(opts: { presenter?: boolean } = {}): Promise<void> {
  const presenter = Boolean(opts.presenter);
  // KS_PORTAL_v13_PHONE_DEMO - on a phone the broker side is the camera page (/demo/broker), which runs this portal in a
  // frame at a desktop width. The presenter mode is staff-only and stays as it is.
  if (!presenter) {
    if (framedByPhoneBroker()) {
      markCameraDemo(true);
    } else if (window.parent === window && isPhoneViewport()) {
      window.location.replace(PHONE_BROKER_PATH);
      return;
    }
  }
  const { realFetch } = setupBrokerDemo({ latencyMs: 180, presenter });
  // The light theme for a prospect with no saved choice (not saved, so the real portal keeps its own default).
  if (!hasSavedTheme()) applyTheme("light");
  if (!presenter) void ensureSession();
  await loadBrand();
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <BrokerDemoRoot realFetch={realFetch} presenter={presenter} />
    </React.StrictMode>,
  );
}
