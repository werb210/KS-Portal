// KS_PORTAL_v8_DEMO - the self-serve demo page: walkthrough steps (progress, next/skip, hide/resume, resume from the
// server), the magic-link open, live state, readable colours, and the QR code for the borrower link.
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { contrast } from "@/fraud/status";
import { TEXT_PAIRS } from "../palette";
import { encodeQr, qrSvgPath } from "../qr";
import { STEPS, stepDone, tourFinished } from "../steps";
import { loadStoredSession, parseMagicLink, storeSession, type DemoState } from "../demoApi";
import Walkthrough from "../Walkthrough";
import DemoApp from "../DemoApp";
import { callContext } from "../CallSimulator";
import { isDemoPath } from "../bootDemo";

function makeState(over: Partial<DemoState> = {}, app: Partial<NonNullable<DemoState["application"]>> = {}): DemoState {
  return {
    session: {
      name: "Dana Prospect", company: "BrokerCo", email: "dana@brokerco.example", created_at: "2026-10-22T12:00:00Z", expires_at: "2099-10-29T12:00:00Z",
      client_code: "abcdefghjk", client_url: "https://client.example/demo/abcdefghjk", used_phone: false, used_screen: false,
      walkthrough: { current: "welcome", completed: [], skipped: [], tour_skipped: false }, completed_at: null,
    },
    steps: STEPS.map((s) => ({ key: s.key, label: s.title })),
    application: {
      id: "a1", status: "draft", business: { legal_name: "Juniper Hollow Millwork Ltd.", years_in_business: 7, industry: "Manufacturing", city: "Edmonton", province: "AB" },
      contact: { name: "Sam Carter", phone: "(780) 555-0142", email: "sam@juniperhollow.example" },
      request: { amount: 250000, product: "Equipment financing", term_months: 60, purpose: "A CNC router." },
      financials: { years: [], prepared_by: "x", basis: "y" }, financials_reviewed_at: null, credit_summary: null, selected_lenders: [], call: null, notes: [],
      borrower_submitted_at: null, submitted_at: null, has_package: false, ...app,
    },
    documents: [],
    expected_documents: Array.from({ length: 6 }, (_, i) => ({ key: `k${i}`, label: `Doc ${i}` })),
    lenders: [],
    messages: [],
    call_script: { lines: [{ at: 0, speaker: "broker", text: "Hi" }], duration_seconds: 2 },
    version: "v1",
    ...over,
  };
}

const doc = (key: string, status: "pending" | "accepted" | "rejected", fraud = "green") => ({
  id: key, sample_key: key, label: key === "sep" ? "Bank statement - September 2026" : key, category: "bank_statement", filename: "f.pdf", size_bytes: 4000,
  uploaded_via: "phone", status, reject_reason: null, fraud_status: fraud, tamper: { status: fraud, reasons: [] }, statement_math: null,
  uploaded_at: "2026-10-22T12:00:00Z", decided_at: null,
});

describe("readable colours", () => {
  it("every text colour on the demo page has at least 4.5:1 contrast", () => {
    for (const [name, fg, bg] of TEXT_PAIRS) expect({ name, ok: contrast(fg, bg) >= 4.5 }).toEqual({ name, ok: true });
  });
});

describe("QR code for the borrower link", () => {
  it("matches the reference encoder bit for bit (python-qrcode, level M, mask 3)", () => {
    const r = encodeQr("https://client.example/demo/abcdefghjk", { forceMask: 3 });
    expect(r.version).toBe(3);
    const rows = r.modules.map((row) => row.map((b) => (b ? "1" : "0")).join("")).join("\n");
    expect(createHash("sha256").update(rows).digest("hex")).toBe("b9816ec1cd570df68bf9c3792263d3d453a18cfd3de52ed4f6577b5d74bf0347");
  });

  it("fits a long Azure link, keeps the three finder patterns, and draws an SVG path with a quiet zone", () => {
    const r = encodeQr("https://wonderful-island-0b68ae310.5.azurestaticapps.net/demo/s5bvdfz8dz");
    expect(r.version).toBe(5);
    const m = r.modules;
    const finder = (x: number, y: number) => m[y]![x] && m[y]![x + 6] && m[y + 6]![x] && !m[y + 1]![x + 1] && m[y + 3]![x + 3];
    expect(finder(0, 0) && finder(m.length - 7, 0) && finder(0, m.length - 7)).toBe(true);
    const svg = qrSvgPath(m);
    expect(svg.size).toBe(m.length + 8);
    expect(svg.path.startsWith("M4 4h1v1h-1z")).toBe(true);
    expect(() => encodeQr("x".repeat(400))).toThrow();
  });
});

describe("walkthrough steps", () => {
  it("each step is done when its action has happened", () => {
    const s = makeState();
    expect(stepDone("welcome", s)).toBe(true);
    expect(stepDone("borrower", s)).toBe(false);
    expect(stepDone("borrower", makeState({ documents: [doc("a", "pending")] }))).toBe(true);
    expect(stepDone("documents", makeState({ documents: [doc("a", "accepted"), doc("b", "pending")] }))).toBe(false);
    expect(stepDone("documents", makeState({ documents: [doc("a", "accepted"), doc("sep", "rejected", "red")] }))).toBe(true);
    expect(stepDone("call", makeState({}, { call: { status: "completed" } }))).toBe(true);
    expect(stepDone("financials", makeState({}, { financials_reviewed_at: "x" }))).toBe(true);
    expect(stepDone("lenders", makeState({}, { selected_lenders: ["aspen-ridge"] }))).toBe(true);
    expect(stepDone("submit", s)).toBe(false);
    expect(tourFinished(makeState({}, { submitted_at: "x" }))).toBe(true);
    expect(STEPS.map((x) => x.key)).toEqual(["welcome", "borrower", "application", "documents", "call", "financials", "credit_summary", "lenders", "submit"]);
  });

  it("shows progress, offers Skip until the step is done, then Next; Back and Hide the tour", () => {
    const onAction = vi.fn();
    const s = makeState();
    s.session.walkthrough = { current: "documents", completed: ["welcome", "borrower", "application"], skipped: [], tour_skipped: false };
    const { rerender } = render(<Walkthrough state={s} busy={false} onAction={onAction} />);
    expect(screen.getByText("Step 4 of 9")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "33");
    expect(screen.getByText(/To do: Decide on every document/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip this step" }));
    expect(onAction).toHaveBeenLastCalledWith("skip", "documents");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onAction).toHaveBeenLastCalledWith("view", "application");
    const done = makeState({ documents: [doc("a", "accepted")] });
    done.session.walkthrough = s.session.walkthrough;
    rerender(<Walkthrough state={done} busy={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onAction).toHaveBeenLastCalledWith("complete", "documents");
    fireEvent.click(screen.getByRole("button", { name: "Hide the tour" }));
    expect(onAction).toHaveBeenLastCalledWith("skip_tour");
  });

  it("a hidden tour can be resumed; a finished tour says so", () => {
    const onAction = vi.fn();
    const hidden = makeState();
    hidden.session.walkthrough = { current: "call", completed: ["welcome"], skipped: ["borrower"], tour_skipped: true };
    const { rerender } = render(<Walkthrough state={hidden} busy={false} onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Resume the tour" }));
    expect(onAction).toHaveBeenLastCalledWith("resume_tour");
    const fin = makeState({}, { submitted_at: "2026-10-22T13:00:00Z" });
    fin.session.walkthrough = { current: "submit", completed: STEPS.map((x) => x.key), skipped: [], tour_skipped: false };
    rerender(<Walkthrough state={fin} busy={false} onAction={onAction} />);
    expect(screen.getByTestId("tour-finished")).toHaveTextContent("That's Keystone.");
    expect(screen.getByTestId("tour-finished")).toHaveTextContent("dana@brokerco.example");
  });
});

describe("magic link and session", () => {
  afterEach(() => { storeSession(null); vi.unstubAllEnvs(); window.location.hash = ""; });

  it("reads #d and #t, and keeps the session only until it expires", () => {
    expect(parseMagicLink("#d=abc&t=tok")).toEqual({ demoId: "abc", token: "tok" });
    expect(parseMagicLink("#d=abc")).toBeNull();
    storeSession({ server_url: "https://s", staff_token: "t", client_url: null, expires_at: "2099-01-01T00:00:00Z", name: "D", company: "C" });
    expect(loadStoredSession()?.staff_token).toBe("t");
    expect(loadStoredSession(Date.parse("2100-01-01"))).toBeNull();
    expect(isDemoPath("/demo")).toBe(true);
    expect(isDemoPath("/demonstration")).toBe(false);
  });

  it("opens the demo from the link, greets the prospect, and shows the file arriving live", async () => {
    vi.stubEnv("VITE_KS_OPS_URL", "https://ops.example");
    window.location.hash = "#d=11111111-1111-4111-8111-111111111111&t=secret";
    let state = makeState();
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push(`${init.method ?? "GET"} ${url}`);
      if (url === "https://ops.example/api/public/demo/open") {
        expect(JSON.parse(String(init.body))).toEqual({ demo_id: "11111111-1111-4111-8111-111111111111", token: "secret" });
        return new Response(JSON.stringify({ server_url: "https://demo.example", staff_token: "staff-tok", client_url: state.session.client_url, expires_at: "2099-10-29T12:00:00Z", name: "Dana Prospect", company: "BrokerCo" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer staff-tok");
      if (url.endsWith("/api/demo/staff/state")) return new Response(JSON.stringify(state), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    render(<DemoApp fetchImpl={fetchImpl} />);
    await screen.findByText(/Hi Dana - this is your private Keystone portal for BrokerCo/);
    expect(screen.getByText("Dana Prospect")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(loadStoredSession()?.staff_token).toBe("staff-tok");
    expect(screen.getByText(/Waiting for your borrower/)).toBeInTheDocument();
    // The borrower uploads from the phone: the next poll shows the file in the pipeline.
    state = makeState({ documents: [doc("sep", "pending", "red")] }, { status: "in_review" });
    await waitFor(() => expect(screen.getByTestId("pipeline-card")).toHaveTextContent("Fraud flag"), { timeout: 5000 });
    expect(calls.some((c) => c === "POST https://demo.example/api/demo/staff/opened")).toBe(true);
  });

  it("an invalid or expired link explains what happened", async () => {
    vi.stubEnv("VITE_KS_OPS_URL", "https://ops.example");
    window.location.hash = "#d=x&t=y";
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "demo_expired", message: "This demo has ended and its data was wiped." }), { status: 410, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
    render(<DemoApp fetchImpl={fetchImpl} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This demo has ended");
  });

  it("without a link or a saved session it asks the prospect to use their email", async () => {
    render(<DemoApp fetchImpl={vi.fn() as unknown as typeof fetch} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Open your demo from your email");
  });
});

describe("simulated call", () => {
  beforeEach(() => vi.useRealTimers());
  it("the phone shows the caller's file: amount, documents and the fraud flag", () => {
    const ctx = callContext(makeState({ documents: [doc("a", "accepted"), doc("sep", "pending", "red")] }, { status: "in_review" }));
    expect(ctx).toEqual(["$250,000 equipment financing", "2 of 6 documents received", "Fraud flag: September 2026 statement", "Stage: In review"]);
  });
});

describe("Content-Security-Policy for the demo (scripts/demo-csp.mjs)", () => {
  it("adds the KS-Ops and demo server origins to connect-src once, and ignores non-https values", async () => {
    const { addConnectSrc, originsOf, patchConfig, readDotEnv } = await import("../../../scripts/demo-csp.mjs");
    expect(originsOf(["https://ops.example/api/", "http://insecure.example", "nope", "", "https://ops.example"])).toEqual(["https://ops.example"]);
    const csp = "default-src 'self'; connect-src 'self' https://a.example; img-src 'self'";
    const out = addConnectSrc(csp, ["https://ops.example", "https://a.example"]);
    expect(out).toBe("default-src 'self'; connect-src 'self' https://a.example https://ops.example; img-src 'self';");
    expect(addConnectSrc("default-src 'self'", ["https://x.example"])).toBe("default-src 'self'; connect-src 'self' https://x.example;");
    const cfg = JSON.parse(patchConfig(JSON.stringify({ globalHeaders: { "Content-Security-Policy": csp } }), ["https://demo.example"]));
    expect(cfg.globalHeaders["Content-Security-Policy"]).toContain("connect-src 'self' https://a.example https://demo.example;");
    expect(readDotEnv("VITE_KS_OPS_URL=https://ops.example\n# c\nX=\"y\"")).toEqual({ VITE_KS_OPS_URL: "https://ops.example", X: "y" });
  });
});
