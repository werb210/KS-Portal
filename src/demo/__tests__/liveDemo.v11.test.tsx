// KS_PORTAL_v11_LIVE_DEMO - the live demo: the /demo shell (client app in a phone frame, postMessage from the client
// origin only, the missing-link message, the background session), the broker side's fake sign-in, the fetch shim
// (every endpoint the tour's screens call; guided submit with the right body, 409 = success) and the whole broker
// tour driven by Next alone. Plus the colours and the CSP script.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contrast } from "@/fraud/status";
import { TEXT_PAIRS } from "../palette";
import { parseClientMessage } from "../clientMessages";
import { clientTourUrl, demoClientOrigin, demoWebsiteUrl } from "../config";
import { __resetKeeper, ensureSession, getKeeper, initKeeper, waitForSession, type DemoSessionInfo } from "../demoApi";
import { DEMO_STAFF_ID, LIVE_DEMO_MODE_KEY, LIVE_DEMO_STORE_KEY, brokerModeRequested, hasStoredDemo, isDemoPath, isDemoStaffToken, tokenSubject } from "../mode";
import DemoShell, { shellNav } from "../DemoShell";
import { createShim } from "../broker/shim";
import { getState, resetState, updateState } from "../broker/state";
import { clearLeftoverDemoAuth, enterBrokerAuth, fakeStaffToken, restoreRealAuth } from "../broker/session";
import { BrokerDemoRoot, setupBrokerDemo, type BrokerSetup } from "../broker/bootBroker";
import { resetCall } from "../broker/tour/callSim";
import { tourPace } from "../broker/tour/steps";
import { APP_ID, DOCS, matchIdFor } from "../broker/fixture";
import { samplePdfBytes, samplePdfFor } from "../broker/samplePdf";

const SESSION: DemoSessionInfo = {
  server_url: "https://demo.example",
  staff_token: "staff-token",
  client_url: null,
  expires_at: "2099-01-01T00:00:00Z",
  name: "Dana Prospect",
  company: "BrokerCo Capital",
  signup_url: "https://site.example/signup#demo=6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b&k=abcDEF123",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function resetAll(): void {
  localStorage.clear();
  sessionStorage.clear();
  __resetKeeper();
  resetState();
  resetCall();
}

beforeEach(() => {
  resetAll();
  tourPace.scale = 0; // KS_PORTAL_v12_DEMO_FIXES - the reading-pace pauses are for people, not tests
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});

describe("readable colours", () => {
  it("every text colour the live demo draws has at least 4.5:1 contrast", () => {
    for (const [name, fg, bg] of TEXT_PAIRS) expect({ name, ok: contrast(fg, bg) >= 4.5 }).toEqual({ name, ok: true });
  });
});

describe("modes and the magic link", () => {
  it("knows the demo paths and the stored demo", () => {
    expect(isDemoPath("/demo")).toBe(true);
    expect(isDemoPath("/demo/x")).toBe(true);
    expect(isDemoPath("/demonstration")).toBe(false);
    expect(hasStoredDemo()).toBe(false);
    localStorage.setItem(LIVE_DEMO_STORE_KEY, JSON.stringify({ link: { demoId: "d", token: "t" }, session: null }));
    expect(hasStoredDemo()).toBe(true);
    expect(brokerModeRequested()).toBe(false);
    sessionStorage.setItem(LIVE_DEMO_MODE_KEY, "broker");
    expect(brokerModeRequested()).toBe(true);
  });

  it("stores the link from the hash, strips it from the address and keeps an unexpired session", () => {
    window.history.replaceState({}, "", "/demo#d=demo-1&t=secret-token");
    const k = initKeeper(window.location);
    expect(k.link).toEqual({ demoId: "demo-1", token: "secret-token" });
    expect(k.status).toBe("idle");
    expect(window.location.hash).toBe("");
    expect(JSON.parse(localStorage.getItem(LIVE_DEMO_STORE_KEY)!).link.demoId).toBe("demo-1");
    expect(JSON.parse(sessionStorage.getItem(LIVE_DEMO_STORE_KEY)!).link.token).toBe("secret-token");
  });

  it("opens the session in the background, retrying while the demo server wakes up", async () => {
    vi.stubEnv("VITE_KS_OPS_URL", "https://ops.example");
    let calls = 0;
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => (++calls < 3 ? json({ error: "waking" }, 503) : json(SESSION)));
    __resetKeeper({ fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => undefined });
    window.history.replaceState({}, "", "/demo#d=demo-1&t=tok");
    initKeeper(window.location);
    const s = await ensureSession();
    expect(s?.name).toBe("Dana Prospect");
    expect(calls).toBe(3);
    expect(getKeeper().status).toBe("ready");
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://ops.example/api/public/demo/open");
    expect(JSON.parse(String((fetchImpl.mock.calls[0]![1] as RequestInit).body))).toEqual({ demo_id: "demo-1", token: "tok" });
    vi.unstubAllEnvs();
  });

  it("gives up after the deadline with a friendly error (the Send button can try again)", async () => {
    vi.stubEnv("VITE_KS_OPS_URL", "https://ops.example");
    let now = 0;
    __resetKeeper({ fetchImpl: (async () => json({}, 503)) as unknown as typeof fetch, sleep: async (ms) => { now += ms; }, now: () => now });
    localStorage.setItem(LIVE_DEMO_STORE_KEY, JSON.stringify({ link: { demoId: "d", token: "t" }, session: null }));
    initKeeper({ hash: "", pathname: "/pipeline", search: "" });
    await expect(waitForSession(90_000)).rejects.toThrow(/did not answer in time/);
    expect(getKeeper().status).toBe("failed");
    expect(now).toBeGreaterThanOrEqual(90_000);
    vi.unstubAllEnvs();
  });
});

describe("the /demo shell", () => {
  afterEach(() => vi.restoreAllMocks());

  it("without a link or a stored session, says where to find one", () => {
    window.history.replaceState({}, "", "/demo");
    render(<DemoShell />);
    const box = screen.getByTestId("live-demo-no-link");
    expect(box.textContent).toContain("Open your demo from the text or email we sent");
    expect(box.querySelector("a")?.getAttribute("href")).toBe(`${demoWebsiteUrl()}/try`);
  });

  it("shows the client app's tour in the phone frame and mirrors its pop-ups - only from the client origin", async () => {
    window.history.replaceState({}, "", "/demo#d=demo-1&t=tok");
    const assign = vi.spyOn(shellNav, "assign").mockImplementation(() => undefined);
    render(<DemoShell />);
    const frame = screen.getByTestId("live-demo-client-frame") as HTMLIFrameElement;
    expect(frame.getAttribute("src")).toBe(clientTourUrl(window.location.origin, true));
    expect(frame.getAttribute("src")).toContain("/tour?embed=1&panel=1&parent=");
    expect(screen.queryByText("Skip to the broker side")).toBeNull();

    const send = (origin: string, data: unknown) => act(() => { window.dispatchEvent(new MessageEvent("message", { origin, data })); });
    send("https://evil.example", { type: "ks-live-demo", event: "step", step: "s1", title: "Hijacked", text: "x" });
    send("https://evil.example", { type: "ks-live-demo", event: "client-done" });
    expect(screen.getByTestId("live-demo-step").textContent).not.toContain("Hijacked");
    expect(assign).not.toHaveBeenCalled();

    send(demoClientOrigin(), { type: "ks-live-demo", event: "step", step: "step-2", title: "Your business", text: "Everything is filled in.", number: 2, total: 10, canBack: true, final: false, busy: false });
    await waitFor(() => expect(screen.getByTestId("live-demo-step").textContent).toContain("Your business"));
    expect(screen.getByTestId("live-demo-step").textContent).toContain("Step 2 of 10");
    // The side panel's buttons drive the phone: commands go into the frame, to the client app's origin only.
    const post = vi.spyOn(frame.contentWindow as Window, "postMessage").mockImplementation(() => undefined);
    fireEvent.click(screen.getByTestId("live-demo-side-next"));
    expect(post).toHaveBeenCalledWith({ type: "ks-live-demo", command: "next" }, demoClientOrigin());
    fireEvent.click(screen.getByTestId("live-demo-side-back"));
    expect(post).toHaveBeenCalledWith({ type: "ks-live-demo", command: "back" }, demoClientOrigin());
    send(demoClientOrigin(), { type: "ks-live-demo", event: "step", step: "step-2", title: "Your business", text: "x", canBack: true, final: false, busy: true });
    await waitFor(() => expect((screen.getByTestId("live-demo-side-next") as HTMLButtonElement).disabled).toBe(true));
    send(demoClientOrigin(), { type: "ks-live-demo", event: "step", step: "handoff", title: "Now the broker", text: "x", canBack: true, final: true, busy: false });
    await waitFor(() => expect(screen.getByTestId("live-demo-side-broker")).toBeTruthy());

    send(demoClientOrigin(), { type: "ks-live-demo", event: "client-done" });
    expect(assign).toHaveBeenCalledWith("/pipeline");
    expect(sessionStorage.getItem(LIVE_DEMO_MODE_KEY)).toBe("broker");
    // KS_PORTAL_v12_DEMO_FIXES - the "you switch sides" line is gone from the side panel.
    expect(document.body.textContent).not.toContain("you switch sides");
  });

  it("/demo?broker=1 with a stored demo goes straight to the broker side", () => {
    localStorage.setItem(LIVE_DEMO_STORE_KEY, JSON.stringify({ link: { demoId: "d", token: "t" }, session: null }));
    window.history.replaceState({}, "", "/demo?broker=1");
    const assign = vi.spyOn(shellNav, "assign").mockImplementation(() => undefined);
    render(<DemoShell />);
    expect(assign).toHaveBeenCalledWith("/pipeline");
  });

  it("parseClientMessage checks origin, source and shape", () => {
    const origin = demoClientOrigin();
    const mine = {} as MessageEventSource;
    const other = {} as MessageEventSource;
    const ev = (o: string, data: unknown, source: MessageEventSource | null = mine) => ({ origin: o, data, source });
    expect(parseClientMessage(ev(origin, { type: "ks-live-demo", event: "client-done" }), origin, mine)).toEqual({ event: "client-done" });
    expect(parseClientMessage(ev("https://x.example", { type: "ks-live-demo", event: "client-done" }), origin, mine)).toBeNull();
    expect(parseClientMessage(ev(origin, { type: "ks-live-demo", event: "client-done" }, other), origin, mine)).toBeNull();
    expect(parseClientMessage(ev(origin, { type: "other", event: "client-done" }), origin, mine)).toBeNull();
    expect(parseClientMessage(ev(origin, { type: "ks-live-demo", event: "step", step: "a" }), origin, mine)).toBeNull();
    expect(parseClientMessage(ev(origin, "client-done"), origin, mine)).toBeNull();
  });
});

describe("the fake staff sign-in", () => {
  it("is an unsigned token for the fixed demo id, role Staff, silo BF, far in the future", () => {
    const t = fakeStaffToken("Dana Prospect");
    const payload = JSON.parse(atob(t.split(".")[1]!));
    expect(payload).toMatchObject({ sub: DEMO_STAFF_ID, role: "Staff", name: "Dana Prospect", silos: ["BF"], silo: "BF" });
    expect(payload.exp * 1000).toBeGreaterThan(Date.now() + 50 * 365 * 24 * 3600 * 1000);
    expect(tokenSubject(t)).toBe(DEMO_STAFF_ID);
    expect(isDemoStaffToken(t)).toBe(true);
  });

  it("puts a real staff token aside and gives it back on exit; a leftover demo token is never used", () => {
    localStorage.setItem("auth_token", "real.staff.token");
    enterBrokerAuth("Dana");
    expect(isDemoStaffToken(localStorage.getItem("auth_token"))).toBe(true);
    expect(sessionStorage.getItem("staff-portal.business-unit")).toBe("BF");
    restoreRealAuth();
    expect(localStorage.getItem("auth_token")).toBe("real.staff.token");
    localStorage.removeItem("auth_token");
    enterBrokerAuth("Dana");
    clearLeftoverDemoAuth();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});

describe("the fetch shim", () => {
  const make = (realFetch: typeof fetch, waitFor: () => Promise<DemoSessionInfo> = async () => SESSION) =>
    createShim({ realFetch, serverOrigin: "https://api.example", prospect: () => ({ name: "Dana Prospect", company: "BrokerCo" }), session: () => SESSION, waitForSession: waitFor });

  it("answers the portal's API from the sample file, passes other origins through, and records unknown calls", async () => {
    const real = vi.fn(async () => json({ passed: true }));
    const shim = make(real as unknown as typeof fetch);
    const list = await (await shim.fetch("https://api.example/api/portal/applications")).json();
    expect(list.data.items[0]).toMatchObject({ id: APP_ID, business_legal_name: "Juniper Hollow Millwork Ltd.", pipeline_state: "Received", requested_amount: 250000 });
    const me = await (await shim.fetch("https://api.example/api/auth/me")).json();
    expect(me.data.user).toMatchObject({ id: DEMO_STAFF_ID, role: "Staff", silo: "BF", silos: ["BF"] });
    await shim.fetch("https://elsewhere.example/thing");
    expect(real).toHaveBeenCalledTimes(1);
    const unknown = await shim.fetch("https://api.example/api/nope");
    expect(unknown.status).toBe(404);
    expect(shim.unhandled).toEqual(["GET /api/nope"]);
  });

  it("previews documents with a generated PDF before the session exists", async () => {
    expect(samplePdfFor(DOCS[2]!.id).type).toBe("application/pdf");
    const text = new TextDecoder().decode(samplePdfBytes(DOCS[2]!.id));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("Prairie Hollow Credit Union");
    expect(text).toContain("%%EOF");
  });

  it("Send posts the guided submit with the decisions, the lender ids and the call, and shows it as sent", async () => {
    updateState((s) => {
      for (const d of DOCS) s.docs[d.id]!.status = d.key === "photo_id" ? "rejected" : "accepted";
      s.callAnswered = true;
    });
    const real = vi.fn(async () => json({ submitted_at: "2026-10-23T12:00:00Z", emailed_to: "dana@brokerco.example", lenders: ["aspen-ridge", "northgate"] }));
    const shim = make(real as unknown as typeof fetch);
    const r = await shim.fetch("https://api.example/api/portal/lender-submissions", {
      method: "POST",
      body: JSON.stringify({ applicationId: APP_ID, lenderProductIds: [matchIdFor("aspen-ridge"), matchIdFor("northgate")] }),
    });
    expect(r.status).toBe(200);
    const body = (await r.json()).data;
    expect(body.sent).toHaveLength(2);
    expect(body.orchestrator.stageB.fired).toBe(true);
    const [url, init] = real.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://demo.example/api/demo/staff/guided-submit");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer staff-token");
    expect(JSON.parse(String(init.body))).toEqual({
      accepted: ["bank_2026_07", "bank_2026_08", "bank_2026_09", "financials_2025", "void_cheque"],
      rejected: ["photo_id"],
      lenders: ["aspen-ridge", "northgate"],
      call_answered: true,
    });
    expect(getState().stage).toBe("Off to Lender");
    expect(getState().submission?.emailed_to).toBe("dana@brokerco.example");
  });

  it("treats 409 already_submitted as success", async () => {
    const shim = make((async () => json({ error: "already_submitted", emailed_to: "dana@brokerco.example" }, 409)) as unknown as typeof fetch);
    const r = await shim.fetch("https://api.example/api/portal/lender-submissions", { method: "POST", body: JSON.stringify({ applicationId: APP_ID, lenderProductIds: [matchIdFor("granite-peak")] }) });
    expect(r.status).toBe(200);
    expect((await r.json()).data.sent[0].lenderId).toBe("granite-peak");
    expect(getState().submission?.already).toBe(true);
  });

  it("when the session cannot be opened, Send fails with a readable reason (the tour offers Try again)", async () => {
    const shim = make(vi.fn() as unknown as typeof fetch, async () => { throw new Error("The demo server did not answer in time."); });
    const r = await shim.fetch("https://api.example/api/portal/lender-submissions", { method: "POST", body: JSON.stringify({ applicationId: APP_ID, lenderProductIds: [matchIdFor("aspen-ridge")] }) });
    expect(r.status).toBe(503);
    expect((await r.json()).message).toMatch(/did not answer in time/);
    expect(getState().submission).toBeNull();
  });
});

describe("the broker tour on the real portal", () => {
  let setup: BrokerSetup | null = null;
  afterEach(() => {
    setup?.restore();
    setup = null;
  });

  it("signs in, then Next alone goes from the new card to Sent, with every request answered by the shim", async () => {
    localStorage.setItem(LIVE_DEMO_STORE_KEY, JSON.stringify({ link: { demoId: "d1", token: "t1" }, session: SESSION }));
    sessionStorage.setItem(LIVE_DEMO_MODE_KEY, "broker");
    window.history.replaceState({}, "", "/pipeline");
    const real = vi.fn(async (url: string) =>
      String(url).includes("guided-submit")
        ? json({ submitted_at: "2026-10-23T12:00:00Z", emailed_to: "dana@brokerco.example", lenders: ["aspen-ridge", "northgate", "granite-peak"] })
        : new Response(null, { status: 204 }),
    );
    setup = setupBrokerDemo({ realFetch: real as unknown as typeof fetch });
    render(<BrokerDemoRoot realFetch={real as unknown as typeof fetch} />);

    // Signed in with the fake staff token: the real pipeline, not the login page.
    await waitFor(() => expect(screen.getAllByText("Juniper Hollow Millwork Ltd.").length).toBeGreaterThan(0), { timeout: 20_000 });
    expect(window.location.pathname).toBe("/pipeline");
    expect(screen.getByText("Step 1 of 10")).toBeTruthy();

    const titles: string[] = [];
    const card = () => screen.getByTestId("live-demo-card");
    for (let i = 0; i < 16; i++) {
      const title = card().querySelector("h2")?.textContent ?? "";
      if (titles[titles.length - 1] !== title) titles.push(title);
      const next = screen.queryByTestId("live-demo-next") as HTMLButtonElement | null;
      if (!next) break;
      expect(card().querySelector('[role="alert"]')).toBeNull();
      if (title === "Pick your lenders") {
        // The prospect picks the lenders: Submit waits for 1-3 ticks.
        await waitFor(() => expect(screen.getByTestId("live-demo-pick-hint").textContent).toMatch(/at least one/), { timeout: 10_000 });
        expect(next.disabled).toBe(true);
        for (const name of ["Aspen Ridge Capital", "Northgate Equipment Finance"]) {
          fireEvent.click(await screen.findByLabelText(`Send to ${name}`));
        }
        await waitFor(() => expect((screen.getByTestId("live-demo-next") as HTMLButtonElement).disabled).toBe(false), { timeout: 10_000 });
        expect(screen.getByTestId("live-demo-next").textContent).toBe("Submit to 2 lenders");
      }
      fireEvent.click(screen.getByTestId("live-demo-next"));
      await waitFor(() => {
        const n = screen.queryByTestId("live-demo-next") as HTMLButtonElement | null;
        const t = card().querySelector("h2")?.textContent ?? "";
        expect(!n || ((!n.disabled || t === "Pick your lenders") && (t !== title || ["Client intake call: Sam is calling", "Live call"].includes(t)))).toBe(true);
      }, { timeout: 30_000 });
    }

    expect(titles).toEqual([
      "A new application just arrived",
      "Everything Sam sent is here",
      "One statement needs a closer look",
      "The financials, read for you",
      "The bank summary",
      "A credit summary, drafted",
      "The fraud report",
      "Client intake call: Sam is calling",
      "Live call",
      "AI call note added to the file",
      "Pick your lenders",
      "That's how to efficiently supply all requirements to your lenders and get your clients funded",
    ]);
    expect(screen.getByTestId("live-demo-sent").textContent).toContain("dana@brokerco.example");
    // KS_PORTAL_v12_DEMO_FIXES - Sign up opens the pre-filled sign-up from KS-Ops (id and key in the fragment only).
    expect(screen.getByTestId("live-demo-signup").getAttribute("href")).toBe(SESSION.signup_url);
    expect(window.location.pathname).toBe(`/applications/${APP_ID}/lenders`);

    const submits = real.mock.calls.filter(([u]) => String(u).includes("guided-submit"));
    expect(submits).toHaveLength(1);
    expect(JSON.parse(String((submits[0] as unknown as [string, RequestInit])[1].body))).toEqual({
      accepted: DOCS.map((d) => d.key),
      rejected: [],
      lenders: ["aspen-ridge", "northgate"],
      call_answered: true,
    });
    expect(getState().creditSummary.status).toBe("submitted");
    expect(getState().notes.some((n) => n.id === "ai-call-note")).toBe(true);
    expect(setup.shim.unhandled).toEqual([]);
  }, 240_000);
});

describe("Content-Security-Policy for the demo (scripts/demo-csp.mjs)", () => {
  it("adds the demo servers to connect-src and the client app to frame-src, and leaves an unchanged policy alone", async () => {
    const { addConnectSrc, addSources, demoOrigins, originsOf, patchConfig, patchIfChanged, readDotEnv, DEFAULT_CLIENT_URL } = await import("../../../scripts/demo-csp.mjs");
    expect(readDotEnv("A=1\nVITE_KS_OPS_URL=\"https://ops.example/x\"\n# c")).toMatchObject({ A: "1", VITE_KS_OPS_URL: "https://ops.example/x" });
    expect(originsOf(["https://a.example/p", "http://b.example", "nope", "https://a.example/q"])).toEqual(["https://a.example"]);
    expect(addConnectSrc("default-src 'self'; connect-src 'self'", ["https://a.example"])).toBe("default-src 'self'; connect-src 'self' https://a.example;");
    expect(addSources("default-src 'self'", "frame-src", ["https://c.example"])).toBe("default-src 'self'; frame-src 'self' https://c.example;");
    expect(demoOrigins({})).toEqual({ connect: [], frame: [new URL(DEFAULT_CLIENT_URL).origin] });
    expect(demoOrigins({ VITE_CLIENT_URL: "https://client.example/x", VITE_DEMO_SERVER_URL: "https://demo.example" })).toEqual({ connect: ["https://demo.example"], frame: ["https://client.example"] });

    const cfg = JSON.stringify({ globalHeaders: { "Content-Security-Policy": "default-src 'self'; connect-src 'self'; frame-src 'self'" } });
    const out = JSON.parse(patchConfig(cfg, { connect: ["https://ops.example"], frame: ["https://client.example"] }));
    expect(out.globalHeaders["Content-Security-Policy"]).toBe("default-src 'self'; connect-src 'self' https://ops.example; frame-src 'self' https://client.example;");
    expect(patchIfChanged(patchConfig(cfg, { frame: ["https://client.example"] }), { frame: ["https://client.example"] })).toBeNull();
  });

  it("the committed configs already let /demo frame the default client app", async () => {
    const root = (await import("../../../staticwebapp.config.json")).default as { globalHeaders: Record<string, string> };
    const frame = root.globalHeaders["Content-Security-Policy"]!.split(";").map((d) => d.trim()).find((d) => d.startsWith("frame-src "))!;
    expect(frame.split(/\s+/)).toContain(demoClientOrigin());
  });
});
