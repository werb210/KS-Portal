// KS_PORTAL_v12_PRESENTER - the staff presenter-mode demo: the start page refuses anyone without a presenter link
// that KS-Ops accepts, takes the prospect's name and brokerage, and the portal then runs on the sample file with the
// presenter panel (no tour). Every jump, the call, Submit to lenders and Reset work with every request answered by
// the shim and nothing sent to the demo server.
// KS_PORTAL_v12_DEMO_FIXES - plus the guided demo's sign-up hand-over link.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetKeeper } from "../demoApi";
import { LIVE_DEMO_MODE_KEY, PRESENTER_MODE, hasPresenterSession, isPresenterPath, presenterModeRequested, readPresenter, writePresenter } from "../mode";
import PresenterStart, { presenterNav } from "../presenter/PresenterStart";
import { presenterTokenFromHash } from "../presenter/presenterApi";
import { PRESENTER_JUMPS, presenterClientUrl } from "../presenter/PresenterBar";
import { getState, resetState } from "../broker/state";
import { resetCall } from "../broker/tour/callSim";
import { tourPace } from "../broker/tour/steps";
import { signupUrl } from "../broker/tour/BrokerTour";
import { BrokerDemoRoot, setupBrokerDemo, type BrokerSetup } from "../broker/bootBroker";
import { APP_ID } from "../broker/fixture";

const TOKEN = "presenter-token-0123456789-abcdefghij";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  __resetKeeper();
  resetState();
  resetCall();
  tourPace.scale = 0;
  vi.stubEnv("VITE_KS_OPS_URL", "https://ops.example");
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("presenter paths and links", () => {
  it("knows /demo/present and reads the token from the fragment only", () => {
    expect(isPresenterPath("/demo/present")).toBe(true);
    expect(isPresenterPath("/demo/present/")).toBe(true);
    expect(isPresenterPath("/demo")).toBe(false);
    expect(isPresenterPath("/demo/presenter")).toBe(false);
    expect(presenterTokenFromHash(`#p=${TOKEN}`)).toBe(TOKEN);
    expect(presenterTokenFromHash("#p=short")).toBeNull();
    expect(presenterTokenFromHash("")).toBeNull();
  });

  it("the client app is framed with present=1 and this page as its parent", () => {
    expect(presenterClientUrl("https://portal.example")).toMatch(/\/tour\?embed=1&present=1&parent=https%3A%2F%2Fportal\.example$/);
  });

  it("the guided demo's Sign up uses KS-Ops' pre-filled sign-up link, else the plain page", () => {
    const link = "https://site.example/signup#demo=6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b&k=abcDEF123";
    expect(signupUrl("https://site.example", link)).toBe(link);
    expect(signupUrl("https://site.example", null)).toBe("https://site.example/signup");
    expect(signupUrl("https://site.example", "")).toBe("https://site.example/signup");
    expect(signupUrl("https://site.example", "javascript:alert(1)")).toBe("https://site.example/signup");
    expect(signupUrl("https://site.example", "https://site.example/signup?email=dana@x.example")).toBe("https://site.example/signup");
    expect(signupUrl("https://site.example", "https://site.example/other#demo=x")).toBe("https://site.example/signup");
  });
});

describe("the presenter start page (/demo/present)", () => {
  it("without a link: staff only, and nothing of the demo", async () => {
    window.history.replaceState({}, "", "/demo/present");
    render(<PresenterStart />);
    expect(await screen.findByTestId("presenter-no-link")).toBeTruthy();
    expect(screen.queryByTestId("presenter-form")).toBeNull();
  });

  it("a link KS-Ops refuses is refused and forgotten", async () => {
    const f = vi.fn(async () => json({ error: "presenter_link_invalid" }, 401));
    vi.stubGlobal("fetch", f);
    window.history.replaceState({}, "", `/demo/present#p=${TOKEN}`);
    render(<PresenterStart />);
    expect((await screen.findByTestId("presenter-refused")).textContent).toMatch(/not valid or has expired/);
    expect(screen.queryByTestId("presenter-form")).toBeNull();
    expect(readPresenter()).toBeNull();
    expect(window.location.hash).toBe("");
  });

  it("a valid link: asks for the prospect, then opens the presenter portal on a fresh sample file", async () => {
    const f = vi.fn(async (_url: string, _init?: RequestInit) => json({ ok: true, presenter: { name: "Ada Admin" }, expires_at: "2099-01-01T00:00:00Z" }));
    vi.stubGlobal("fetch", f);
    const assign = vi.spyOn(presenterNav, "assign").mockImplementation(() => undefined);
    sessionStorage.setItem("ks_live_demo_state_v1", JSON.stringify({ stale: true }));
    window.history.replaceState({}, "", `/demo/present#p=${TOKEN}`);
    render(<PresenterStart />);
    await screen.findByTestId("presenter-form");
    expect(f).toHaveBeenCalledWith("https://ops.example/api/public/demo/presenter/verify", expect.objectContaining({ method: "POST", body: JSON.stringify({ token: TOKEN }) }));
    // The token left the address bar at once.
    expect(window.location.hash).toBe("");
    expect(screen.getByText(/Signed in as Ada Admin/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Prospect's name"), { target: { value: "Dana Fraser" } });
    fireEvent.change(screen.getByLabelText("Brokerage"), { target: { value: "Prairie Capital Brokers" } });
    fireEvent.click(screen.getByTestId("presenter-start-button"));
    expect(assign).toHaveBeenCalledWith("/pipeline");
    expect(presenterModeRequested()).toBe(true);
    expect(sessionStorage.getItem(LIVE_DEMO_MODE_KEY)).toBe(PRESENTER_MODE);
    expect(hasPresenterSession()).toBe(true);
    expect(readPresenter()?.prospect).toEqual({ name: "Dana Fraser", company: "Prairie Capital Brokers" });
    expect(sessionStorage.getItem("ks_live_demo_state_v1")).toBeNull();
    assign.mockRestore();
  });

  it("an unchecked or expired stored link does not boot the presenter portal", () => {
    writePresenter({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z", verifiedAt: null, presenterName: null, prospect: { name: "A", company: "B" } });
    expect(hasPresenterSession()).toBe(false);
    writePresenter({ token: TOKEN, expiresAt: "2000-01-01T00:00:00Z", verifiedAt: "2000-01-01T00:00:00Z", presenterName: null, prospect: { name: "A", company: "B" } });
    expect(hasPresenterSession()).toBe(false);
  });
});

describe("the presenter portal", () => {
  let setup: BrokerSetup | null = null;
  afterEach(() => {
    setup?.restore();
    setup = null;
  });

  it("no tour; every jump, the call, Submit to lenders and Reset work, all answered by the shim", async () => {
    writePresenter({ token: TOKEN, expiresAt: "2099-01-01T00:00:00Z", verifiedAt: new Date().toISOString(), presenterName: "Ada Admin", prospect: { name: "Dana Fraser", company: "Prairie Capital Brokers" } });
    sessionStorage.setItem(LIVE_DEMO_MODE_KEY, PRESENTER_MODE);
    window.history.replaceState({}, "", "/pipeline");
    const real = vi.fn(async (_url: unknown, _init?: unknown) => new Response(null, { status: 204 }));
    setup = setupBrokerDemo({ realFetch: real as unknown as typeof fetch, presenter: true });
    render(<BrokerDemoRoot realFetch={real as unknown as typeof fetch} presenter />);

    await waitFor(() => expect(screen.getAllByText("Juniper Hollow Millwork Ltd.").length).toBeGreaterThan(0), { timeout: 20_000 });
    expect(screen.getByTestId("presenter-bar")).toBeTruthy();
    expect(screen.queryByTestId("live-demo-tour")).toBeNull();
    expect(screen.queryByTestId("live-demo-card")).toBeNull();
    // The prospect's own name in the greeting.
    await waitFor(() => expect(document.body.textContent).toContain("Dana"));

    // Sections the sample data does not cover are switched off (no error screens), and so are real calls and deletes.
    expect(screen.getAllByTestId("live-demo-nav-off").map((e) => e.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("Dashboard"), expect.stringContaining("CRM")]));
    expect(document.querySelector('[aria-label="Call client"]')).toBeNull();
    expect(document.querySelector('[aria-label="Delete card"]')).toBeNull();
    expect(document.querySelector('[aria-label="Open dialer"]')).toBeNull();

    // Every key screen.
    const landmarks: Record<string, () => Element | null> = {
      pipeline: () => screen.queryAllByText("Juniper Hollow Millwork Ltd.")[0] ?? null,
      documents: () => document.querySelector('[data-testid="documents-drop-target"]'),
      financials: () => document.querySelector("main table"),
      banking: () => screen.queryByText("3-Month Trend"),
      credit: () => document.querySelector('[data-testid="cs2-status"], [data-testid="cs2-submit"]'),
      fraud: () => document.querySelector('[data-testid="fraud-score"]'),
      lenders: () => document.querySelector('[data-testid="lenders-tab"] table'),
      notes: () => document.querySelector('[data-testid="notes-list"]') ?? screen.queryByText(/Add note/),
    };
    for (const j of PRESENTER_JUMPS) {
      fireEvent.click(screen.getByTestId(`presenter-jump-${j.key}`));
      await waitFor(() => expect(window.location.pathname).toBe(j.route));
      await waitFor(() => expect({ key: j.key, found: Boolean(landmarks[j.key]!()) }).toEqual({ key: j.key, found: true }), { timeout: 15_000 });
    }

    // The file's other tabs answer too; PGI and SBA signing are not part of the sample file.
    expect(screen.queryByRole("button", { name: "PGI insurance" })).toBeNull();
    expect(screen.queryByRole("button", { name: "SBA Signing" })).toBeNull();
    for (const label of ["Application", "Request Items"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      await waitFor(() => expect(window.location.pathname).toMatch(label === "Application" ? /\/application$/ : /\/request-items$/));
    }
    await waitFor(() => expect(screen.getAllByText("Request Items").length).toBeGreaterThan(0));

    // The client's phone: the real client app with no tour, framed by this page.
    fireEvent.click(screen.getByTestId("presenter-view-client"));
    const frame = screen.getByTestId("presenter-client-frame") as HTMLIFrameElement;
    expect(frame.src).toContain("present=1");
    expect(screen.getByTestId("presenter-client").hidden).toBe(false);
    fireEvent.click(screen.getByTestId("presenter-view-portal"));
    expect(screen.getByTestId("presenter-client").hidden).toBe(true);

    // The incoming call: ring, answer, end - the AI note lands on Notes.
    fireEvent.click(screen.getByTestId("presenter-jump-fraud"));
    fireEvent.click(screen.getByTestId("presenter-call"));
    await screen.findByTestId("presenter-call-answer");
    await act(async () => {
      fireEvent.click(screen.getByTestId("presenter-call-answer"));
    });
    await screen.findByTestId("presenter-call-end", undefined, { timeout: 10_000 });
    await act(async () => {
      fireEvent.click(screen.getByTestId("presenter-call-end"));
    });
    await waitFor(() => expect(window.location.pathname).toBe(`/applications/${APP_ID}/notes`), { timeout: 10_000 });
    expect(getState().notes.some((n) => n.id === "ai-call-note")).toBe(true);
    expect(getState().callAnswered).toBe(true);

    // Submit to lenders: the strong fits are ticked and the real Send goes - in the browser only.
    fireEvent.click(screen.getByTestId("presenter-submit"));
    await waitFor(() => expect(getState().submission).not.toBeNull(), { timeout: 30_000 });
    await waitFor(() => expect(screen.getByTestId("presenter-status").textContent).toMatch(/^Sent to /), { timeout: 10_000 });
    expect(getState().submission?.lenders.length).toBeGreaterThan(0);
    expect(getState().submission?.emailed_to).toBeNull();
    expect(real.mock.calls.some(([u]) => String(u).includes("guided-submit"))).toBe(false);

    // Reset: a fresh sample file, back to the pipeline.
    const assign = vi.spyOn(presenterNav, "assign").mockImplementation(() => undefined);
    fireEvent.click(screen.getByTestId("presenter-reset"));
    expect(assign).toHaveBeenCalledWith("/pipeline");
    expect(getState().submission).toBeNull();
    expect(getState().notes).toEqual([]);
    assign.mockRestore();

    expect(setup.shim.unhandled).toEqual([]);
  }, 240_000);
});
