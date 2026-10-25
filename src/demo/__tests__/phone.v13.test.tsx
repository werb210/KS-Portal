// KS_PORTAL_v13_PHONE_DEMO - the live demo on a phone: who counts as a phone (an iPad and a computer never do), the
// camera arithmetic, the full-screen client side with its bottom sheet, "Email me the link for my computer", the call
// screen and the broker tour handing its card to the phone page through the bridge.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contrast } from "@/fraud/status";
import { TEXT_PAIRS } from "../palette";
import { demoClientOrigin } from "../config";
import { __resetKeeper, emailDemoLink, getKeeper, initKeeper, type DemoSessionInfo } from "../demoApi";
import { LIVE_DEMO_MODE_KEY, LIVE_DEMO_STORE_KEY, framedByPhoneBroker, isPhoneBrokerPath } from "../mode";
import DemoShell, { shellNav } from "../DemoShell";
import { __resetEmailLink } from "../phone/EmailLinkButton";
import PhoneCall from "../phone/PhoneCall";
import {
  LAYOUT_W, READABLE_PX, clampPan, frameRegion, isPhoneViewport, layoutHeight, maskEmail, overviewScale, tween, visibleShare,
} from "../phone/phone";
import { BrokerDemoRoot, setupBrokerDemo, type BrokerSetup } from "../broker/bootBroker";
import { __resetBridge, bridgeOf, markCameraDemo, type TourSnapshot } from "../broker/tour/bridge";
import { resetState } from "../broker/state";
import { resetCall } from "../broker/tour/callSim";
import { tourPace } from "../broker/tour/steps";

const SESSION: DemoSessionInfo = {
  server_url: "https://demo.example", staff_token: "staff-token", client_url: null, expires_at: "2099-01-01T00:00:00Z",
  name: "Dana Prospect", company: "BrokerCo Capital", signup_url: null,
};

const realWidth = window.innerWidth;
const realHeight = window.innerHeight;
function setViewport(w: number, h: number, coarse = true): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: h });
  window.matchMedia = ((q: string) => ({
    matches: q.includes("coarse") ? coarse : false, media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  __resetKeeper();
  __resetEmailLink();
  __resetBridge();
  resetState();
  resetCall();
  tourPace.scale = 0;
  setViewport(1024, 768, false);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  setViewport(realWidth, realHeight, false);
  markCameraDemo(false);
});

describe("who gets the phone demo", () => {
  it("phones in portrait and landscape do; computers and iPads (even an iPad mini) keep the desktop demo", () => {
    for (const [w, h] of [[375, 667], [390, 844], [430, 932], [360, 800]] as Array<[number, number]>) expect(isPhoneViewport({ w, h, coarse: true })).toBe(true);
    expect(isPhoneViewport({ w: 844, h: 390, coarse: true })).toBe(true); // a phone held sideways
    expect(isPhoneViewport({ w: 600, h: 900, coarse: false })).toBe(true); // a narrow window
    for (const [w, h] of [[1280, 800], [1440, 900], [820, 1180], [1180, 820], [744, 1133], [1133, 744]] as Array<[number, number]>) {
      expect(isPhoneViewport({ w, h, coarse: w < 1200 })).toBe(false);
    }
    expect(isPhoneViewport({ w: 1280, h: 450, coarse: false })).toBe(false); // a short laptop window is not a phone
  });

  it("knows the phone broker page and whether this portal runs inside it", () => {
    expect(isPhoneBrokerPath("/demo/broker")).toBe(true);
    expect(isPhoneBrokerPath("/demo/present")).toBe(false);
    expect(framedByPhoneBroker(window)).toBe(false); // top level
  });
});

describe("the camera", () => {
  const stage = { w: 390, h: 480 };
  const layout = { w: LAYOUT_W, h: layoutHeight(390, 844) };

  it("lays the portal out at the desktop width, phone-shaped, never shorter than a laptop", () => {
    expect(layout.h).toBe(Math.round((1280 * 844) / 390));
    expect(layoutHeight(844, 390)).toBe(720);
  });

  it("frames a small region so it fills the width, and never zooms text below the readable size", () => {
    const card = { top: 180, left: 240, width: 260, height: 180 };
    const cam = frameRegion(card, stage, layout, 14);
    expect(cam.scale * 14).toBeGreaterThanOrEqual(READABLE_PX - 0.01);
    expect(visibleShare(card, cam, stage)).toBeCloseTo(1, 5);
    // A wide table: readable first, shown from its left edge (the person pans for the rest).
    const table = { top: 300, left: 260, width: 980, height: 400 };
    const wide = frameRegion(table, stage, layout, 14);
    expect(wide.scale * 14).toBeGreaterThanOrEqual(READABLE_PX - 0.01);
    expect(260 * wide.scale - wide.x).toBeGreaterThan(0);
    expect(260 * wide.scale - wide.x).toBeLessThan(20);
    // Small text zooms further.
    expect(frameRegion(card, stage, layout, 10).scale).toBeGreaterThanOrEqual(1.6);
  });

  it("with nothing highlighted shows the whole page; pans stay inside the page; moves ease from one shot to the next", () => {
    const all = frameRegion(null, stage, layout);
    expect(all.scale).toBeCloseTo(overviewScale(stage, layout), 6);
    expect(clampPan({ scale: 1, x: -50, y: 1e6 }, stage, layout)).toEqual({ scale: 1, x: 0, y: layout.h - stage.h });
    const a = { scale: 1, x: 0, y: 0 };
    const b = { scale: 2, x: 100, y: 200 };
    expect(tween(a, b, 0)).toEqual(a);
    expect(tween(a, b, 1)).toEqual(b);
    expect(tween(a, b, 0.5).scale).toBeCloseTo(1.5, 5);
  });

  it("masks the email it confirms", () => {
    expect(maskEmail("todd@example.com")).toBe("t***@example.com");
    expect(maskEmail("")).toBe("your email");
  });

  it("every colour the phone pieces draw is readable", () => {
    for (const [name, fg, bg] of TEXT_PAIRS) expect(contrast(fg, bg), name).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the client side on a phone", () => {
  it("starts with a start screen, then shows the client app full screen with the step in a bottom sheet", async () => {
    setViewport(390, 844);
    window.history.replaceState({}, "", "/demo#d=demo-1&t=tok");
    const assign = vi.spyOn(shellNav, "assign").mockImplementation(() => undefined);
    render(<DemoShell />);
    expect(screen.getByTestId("live-demo-phone-start")).toBeTruthy();
    expect(screen.getByTestId("live-demo-phone-start").textContent).toContain("Email me the link for my computer");
    // No phone frame: the app fills the screen, in the side-panel mode so the sheet carries the words and buttons.
    const frame = screen.getByTestId("live-demo-client-frame") as HTMLIFrameElement;
    expect(frame.getAttribute("src")).toContain("/tour?embed=1&panel=1&parent=");
    expect(document.querySelector(".ksld-iphone")).toBeNull();
    fireEvent.click(screen.getByTestId("live-demo-phone-begin"));
    expect(screen.queryByTestId("live-demo-phone-start")).toBeNull();

    const send = (origin: string, data: unknown) => act(() => { window.dispatchEvent(new MessageEvent("message", { origin, data })); });
    send("https://evil.example", { type: "ks-live-demo", event: "step", step: "s", title: "Hijacked", text: "x" });
    expect(screen.getByTestId("live-demo-sheet").textContent).not.toContain("Hijacked");
    send(demoClientOrigin(), { type: "ks-live-demo", event: "step", step: "step3", title: "His business details", text: "Juniper Hollow Millwork in Edmonton.", number: 4, total: 10, canBack: true, final: false, busy: false });
    await waitFor(() => expect(screen.getByTestId("live-demo-sheet").textContent).toContain("His business details"));
    expect(screen.getByTestId("live-demo-sheet-count").textContent).toBe("You are the client · 4 of 10");
    const post = vi.spyOn(frame.contentWindow as Window, "postMessage").mockImplementation(() => undefined);
    fireEvent.click(screen.getByTestId("live-demo-side-next"));
    expect(post).toHaveBeenCalledWith({ type: "ks-live-demo", command: "next" }, demoClientOrigin());
    fireEvent.click(screen.getByTestId("live-demo-side-back"));
    expect(post).toHaveBeenCalledWith({ type: "ks-live-demo", command: "back" }, demoClientOrigin());

    // Collapses to a slim bar that keeps Next.
    fireEvent.click(screen.getByTestId("live-demo-sheet-toggle"));
    expect(screen.getByTestId("live-demo-sheet").getAttribute("data-collapsed")).toBe("1");
    expect(screen.getByTestId("live-demo-side-next")).toBeTruthy();
    fireEvent.click(screen.getByTestId("live-demo-sheet-toggle"));

    // The end of the client side opens the phone's broker page.
    send(demoClientOrigin(), { type: "ks-live-demo", event: "step", step: "handoff", title: "Now the broker", text: "x", canBack: true, final: true, busy: false });
    await waitFor(() => expect(screen.getByTestId("live-demo-side-broker")).toBeTruthy());
    fireEvent.click(screen.getByTestId("live-demo-side-broker"));
    expect(assign).toHaveBeenCalledWith("/demo/broker");
    expect(sessionStorage.getItem(LIVE_DEMO_MODE_KEY)).toBe("broker");
  });

  it("/demo?broker=1 on a phone goes to the phone's broker page", () => {
    setViewport(375, 667);
    localStorage.setItem(LIVE_DEMO_STORE_KEY, JSON.stringify({ link: { demoId: "d", token: "t" }, session: null }));
    window.history.replaceState({}, "", "/demo?broker=1");
    const assign = vi.spyOn(shellNav, "assign").mockImplementation(() => undefined);
    render(<DemoShell />);
    expect(assign).toHaveBeenCalledWith("/demo/broker");
  });
});

describe("Email me the link for my computer", () => {
  it("asks KS-Ops with the current link, keeps the new token and confirms the masked address", async () => {
    vi.stubEnv("VITE_KS_OPS_URL", "https://ops.example");
    setViewport(390, 844);
    window.history.replaceState({}, "", "/demo#d=6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b&t=old-token-123");
    const calls: Array<[string, RequestInit]> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((async (url: string, init: RequestInit) => {
      calls.push([String(url), init]);
      if (String(url).endsWith("/email-link")) {
        return new Response(JSON.stringify({ ok: true, sent_to: "d***@brokerco.example", token: "fresh-token-0123456789" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "x" }), { status: 404 });
    }) as unknown as typeof fetch);
    render(<DemoShell />);
    fireEvent.click(screen.getByTestId("live-demo-phone-start").querySelector('[data-testid="live-demo-email-link"]')!);
    await waitFor(() => expect(screen.getAllByTestId("live-demo-email-sent")[0]!.textContent).toContain("Sent to d***@brokerco.example"));
    const sent = calls.find(([u]) => u === "https://ops.example/api/public/demo/email-link")!;
    expect(JSON.parse(String(sent[1].body))).toEqual({ demo_id: "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b", token: "old-token-123" });
    expect(getKeeper().link?.token).toBe("fresh-token-0123456789");
    expect(JSON.parse(localStorage.getItem(LIVE_DEMO_STORE_KEY)!).link.token).toBe("fresh-token-0123456789");
    // They can carry on on the phone.
    expect(screen.getByTestId("live-demo-phone-begin")).toBeTruthy();
  });

  it("shows KS-Ops's message when it is rate-limited", async () => {
    vi.stubEnv("VITE_KS_OPS_URL", "https://ops.example");
    initKeeper({ hash: "#d=d1&t=t1", pathname: "/demo", search: "" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "too_many_links", message: "We've already sent your demo link several times today." }), { status: 429 }));
    await expect(emailDemoLink()).rejects.toThrow(/several times today/);
  });
});

describe("the call on a phone", () => {
  const call: TourSnapshot["call"] = {
    phase: "ringing", lines: [], startedAt: null,
    caller: { name: "Sam Carter", company: "Juniper Hollow Millwork", deal: "$250,000 equipment" },
    facts: ["Juniper Hollow Millwork Ltd.", "6 of 6 documents received", "Owner, 7 years in business"],
    flag: "Fraud flag: September statement",
  };

  it("rings full screen with the file card and Accept / Decline, then shows the live transcript", () => {
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    const { rerender } = render(<PhoneCall call={call} onAccept={onAccept} onDecline={onDecline} onEnd={() => undefined} />);
    const card = screen.getByTestId("live-demo-call-card").textContent ?? "";
    for (const t of ["$250,000 equipment", "6 of 6 documents received", "Fraud flag: September statement", "Also rings on your Apple Watch and in the portal"]) expect(card).toContain(t);
    fireEvent.click(screen.getByTestId("live-demo-call-accept"));
    fireEvent.click(screen.getByTestId("live-demo-call-decline"));
    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
    const onEnd = vi.fn();
    rerender(<PhoneCall call={{ ...call, phase: "connected", startedAt: Date.now(), lines: [{ at: 1, speaker: "broker", text: "Hi Sam" } as never] }} onAccept={onAccept} onDecline={onDecline} onEnd={onEnd} />);
    expect(screen.getByTestId("live-demo-transcript").textContent).toContain("Hi Sam");
    fireEvent.click(screen.getByTestId("live-demo-call-end"));
    expect(onEnd).toHaveBeenCalled();
  });
});

describe("the broker tour inside the phone's camera", () => {
  let setup: BrokerSetup | null = null;
  afterEach(() => {
    setup?.restore();
    setup = null;
  });

  it("draws no card of its own, publishes the step and its highlight, and takes Next from the phone page", async () => {
    localStorage.setItem(LIVE_DEMO_STORE_KEY, JSON.stringify({ link: { demoId: "d1", token: "t1" }, session: SESSION }));
    sessionStorage.setItem(LIVE_DEMO_MODE_KEY, "broker");
    window.history.replaceState({}, "", "/pipeline");
    const real = vi.fn(async () => new Response(null, { status: 204 }));
    setup = setupBrokerDemo({ realFetch: real as unknown as typeof fetch });
    markCameraDemo(true);
    render(<BrokerDemoRoot realFetch={real as unknown as typeof fetch} />);
    const frameLike = { contentWindow: window } as unknown as HTMLIFrameElement;
    await waitFor(() => expect(bridgeOf(frameLike)?.get()?.key).toBe("pipeline"), { timeout: 20_000 });
    const bridge = bridgeOf(frameLike)!;
    const s = bridge.get()!;
    expect(s).toMatchObject({ index: 0, total: 10, title: "A new application just arrived", nextLabel: "Open the file", backDisabled: true });
    expect(s.body[0]!.text).toContain("Sam applied from his phone");
    expect(screen.queryByTestId("live-demo-card")).toBeNull();
    expect(screen.getByTestId("live-demo-tour").getAttribute("data-camera")).toBe("1");
    await waitFor(() => expect(bridge.get()!.els.length).toBeGreaterThan(0), { timeout: 10_000 });
    act(() => bridge.next());
    await waitFor(() => expect(bridge.get()!.key).toBe("documents"), { timeout: 20_000 });
    expect(bridge.get()!.title).toBe("Everything Sam sent is here");
  }, 60_000);
});
