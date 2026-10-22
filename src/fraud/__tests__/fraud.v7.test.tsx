// KS_PORTAL_v7_FRAUD - the Fraud check tab, the network map, the Company -> Fraud protection card, and the colours.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { planBody } from "@/plans/__tests__/fixtures";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put } }));

import FraudTab from "@/fraud/FraudTab";
import FraudProtectionCard from "@/fraud/FraudProtectionCard";
import NetworkGraph, { layoutNetwork, VIEW } from "@/fraud/NetworkGraph";
import { STATUS_STYLE, BAND_STYLE, contrast } from "@/fraud/status";
import { __setPlanForTests, normalizePlan } from "@/plans/planStore";
import { FEATURES } from "@/plans/catalogue";
import type { FraudCheck, FraudOverview, Network } from "@/fraud/fraudApi";

const ALL = Array.from({ length: 16 }, (_, i) => `fraud_${i + 1}`);
const STARTER = ["fraud_1", "fraud_2", "fraud_4", "fraud_5"];

function overview(allowed: string[], over: Partial<FraudOverview> = {}): FraudOverview {
  const checks: FraudCheck[] = ALL.map((key) => {
    const locked = !allowed.includes(key);
    const f = FEATURES.find((x) => x.key === key)!;
    const base = { key, label: f.label, description: f.description, scope: key === "fraud_1" || key === "fraud_2" ? "document" : "application", plan: f.plan, locked } as FraudCheck;
    if (locked) return { ...base, status: "locked" };
    if (base.scope === "document") return { ...base, status: "per_document" };
    if (key === "fraud_11") return { ...base, status: "red", reasons: [{ code: "stacking_repayments", severity: "red", text: "15 daily payments to merchant growth look like advance repayments." }] };
    if (key === "fraud_6") return { ...base, status: "not_configured", reasons: [{ code: "not_configured", severity: "info", text: "The corporate registry lookup is not set up." }] };
    return { ...base, status: "green", reasons: [{ code: "ok", severity: "info", text: "Nothing found." }] };
  });
  return {
    application_id: "app-1",
    checks,
    documents: [{
      document_id: "d1", filename: "march-statement.pdf", category: "bank_statements_6_months",
      tamper: { status: "red", reasons: [{ code: "editor_producer", severity: "red", text: 'This bank statement was produced by editing software ("photoshop").' }], checked_at: "2026-10-23T12:00:00Z" },
      statement_math: { status: "amber", reasons: [{ code: "balance_breaks", severity: "amber", text: "1 running balance(s) do not add up." }], checked_at: "2026-10-23T12:00:00Z" },
    }],
    score: allowed.includes("fraud_16") ? { score: 72, band: "high", reasons: [{ check: "fraud_11", label: "Loan stacking detector", severity: "red", text: "Daily repayments to another lender." }], covered: [], not_covered: [{ check: "fraud_6", label: "Business reality check", status: "not_configured", why: "not set up" }] } : null,
    include_prescreen_in_package: false,
    queue: { queued: false, done_at: "2026-10-23T12:00:00Z", last_error: null },
    ...over,
  };
}

const setPlan = (plan: "starter" | "pro", features: string[]) =>
  __setPlanForTests(normalizePlan(planBody({ plan, effective_plan: plan, features: Object.fromEntries(ALL.map((k) => [k, features.includes(k)])), catalogue: FEATURES.filter((f) => f.key.startsWith("fraud_")).map(({ key, label, plan: p }) => ({ key, label, plan: p })) })));

beforeEach(() => {
  h.get.mockReset(); h.post.mockReset(); h.put.mockReset();
  __setPlanForTests(null);
});

describe("Fraud check tab", () => {
  it("pro: score, document badges with reasons, every check, network and pre-screen", async () => {
    setPlan("pro", ALL);
    h.get.mockImplementation(async (url: string) => {
      if (url.endsWith("/network")) return { ok: true, network: { nodes: [{ id: "app:app-1", type: "application", label: "Acme", current: true }, { id: "id:phone:x", type: "phone", label: "Phone ...0100" }, { id: "app:f", type: "application", label: "Fraudco", fraud: true }], edges: [{ from: "app:app-1", to: "id:phone:x" }, { from: "id:phone:x", to: "app:f" }] } };
      if (url.endsWith("/prescreen")) return { ok: true, include_in_package: false, lines: ["Fraud pre-screen - Acme", "Fraud score: 72 / 100 (high risk)"] };
      return { ok: true, ...overview(ALL) };
    });
    h.put.mockResolvedValue({ ok: true, include_in_package: true });
    renderWithRole(<FraudTab applicationId="app-1" />, "Staff");
    await screen.findByTestId("fraud-score");
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByText("Fraud score: High risk")).toBeInTheDocument();
    const doc = screen.getByTestId("fraud-doc-d1");
    expect(within(doc).getByTestId("doc-tamper-chip")).toHaveTextContent("Concern");
    expect(within(doc).getByTestId("doc-math-chip")).toHaveTextContent("Worth a look");
    expect(within(doc).getByText(/produced by editing software/)).toBeInTheDocument();
    expect(screen.getByTestId("chip-fraud_11")).toHaveTextContent("Concern");
    expect(screen.getByTestId("chip-fraud_6")).toHaveTextContent("Not set up");
    expect(screen.queryByTestId("feature-locked-fraud_12")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show the network map" }));
    expect(await screen.findByTestId("network-graph")).toBeInTheDocument();
    expect(screen.getByTestId("network-node-fraud")).toHaveTextContent("Fraud");
    fireEvent.click(screen.getByRole("checkbox", { name: /Add the pre-screen page/ }));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/fraud/applications/app-1/prescreen", { include_in_package: true }));
    fireEvent.click(screen.getByRole("button", { name: "Preview the pre-screen" }));
    expect(await screen.findByTestId("prescreen-text")).toHaveTextContent("Fraud score: 72 / 100");
  });

  it("starter: only checks 1, 2, 4, 5 run; the rest show which plan includes them; no score, network or pre-screen", async () => {
    setPlan("starter", STARTER);
    h.get.mockResolvedValue({ ok: true, ...overview(STARTER) });
    renderWithRole(<FraudTab applicationId="app-1" />, "Admin");
    await screen.findByTestId("fraud-tab");
    expect(screen.queryByTestId("fraud-score")).toBeNull();
    expect(screen.getByTestId("feature-locked-fraud_16")).toBeInTheDocument();
    for (const k of ["fraud_3", "fraud_6", "fraud_9", "fraud_12", "fraud_15"]) {
      expect(within(screen.getByTestId(`fraud-check-${k}`)).getByTestId(`feature-locked-${k}`)).toBeInTheDocument();
    }
    expect(within(screen.getByTestId("fraud-check-fraud_6")).getByText(/Included in Growth and Pro/)).toBeInTheDocument();
    expect(within(screen.getByTestId("fraud-check-fraud_12")).getByText(/Included in Pro/)).toBeInTheDocument();
    expect(screen.queryByTestId("fraud-network")).toBeNull();
    expect(screen.queryByTestId("fraud-prescreen")).toBeNull();
    expect(screen.queryByTestId("fraud-bank-link")).toBeNull();
  });

  it("run again asks the server to queue the checks", async () => {
    setPlan("starter", STARTER);
    h.get.mockResolvedValue({ ok: true, ...overview(STARTER) });
    h.post.mockResolvedValue({ ok: true, queued: true });
    renderWithRole(<FraudTab applicationId="app-1" />, "Staff");
    fireEvent.click(await screen.findByRole("button", { name: "Run checks again" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/fraud/applications/app-1/run", {}));
  });

  it("a server without the fraud suite shows a plain message", async () => {
    h.get.mockResolvedValue({ ok: true });
    renderWithRole(<FraudTab applicationId="app-1" />, "Staff");
    expect(await screen.findByRole("alert")).toHaveTextContent(/not available on this server/);
  });
});

describe("network map", () => {
  const net: Network = {
    nodes: [{ id: "app:me", type: "application", label: "Me", current: true }, ...Array.from({ length: 4 }, (_, i) => ({ id: `id:${i}`, type: "email" as const, label: `Email ${i}` })), ...Array.from({ length: 12 }, (_, i) => ({ id: `app:${i}`, type: "application" as const, label: `App ${i}`, fraud: i === 0 }))],
    edges: [...Array.from({ length: 4 }, (_, i) => ({ from: "app:me", to: `id:${i}` })), ...Array.from({ length: 12 }, (_, i) => ({ from: `id:${i % 4}`, to: `app:${i}` }))],
  };
  it("keeps every node inside the picture and the current file in the middle", () => {
    const placed = layoutNetwork(net);
    expect(placed).toHaveLength(net.nodes.length);
    expect(placed[0]).toMatchObject({ id: "app:me", x: VIEW.w / 2, y: VIEW.h / 2 });
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(30);
      expect(p.x).toBeLessThanOrEqual(VIEW.w - 30);
      expect(p.y).toBeGreaterThanOrEqual(20);
      expect(p.y).toBeLessThanOrEqual(VIEW.h - 20);
    }
  });
  it("says so when nothing is linked", () => {
    renderWithRole(<NetworkGraph network={{ nodes: [net.nodes[0]!], edges: [] }} />, "Staff");
    expect(screen.getByTestId("network-empty")).toBeInTheDocument();
  });
});

describe("Company -> Fraud protection", () => {
  const settings = (allowed: string[], over: Record<string, unknown> = {}) => ({
    ok: true, allowed,
    settings: { watchlist_opt_in: false, include_prescreen_in_package: false, updated_at: null },
    watchlist: { available: allowed.includes("fraud_13"), ready: true, why: null },
    services: [{ key: "voice", label: "Voice / deepfake analysis vendor", provider: "none", configured: false, setting: "not available yet", used_by: ["fraud_15"] }, { key: "domainAge", label: "Website and email domain age", provider: "rdap", configured: true, setting: "on", used_by: ["fraud_6"] }],
    ...over,
  });

  it("pro: the watchlist switch saves, staff alerts are listed, services show their state", async () => {
    setPlan("pro", ALL);
    h.get.mockImplementation(async (url: string) => (url.endsWith("/staff-alerts")
      ? { ok: true, alerts: [{ id: 1, kind: "banking_details_changed", severity: "red", application_id: "a1", created_at: "2026-10-23T05:00:00Z", staff_name: "Pat" }] }
      : settings(ALL)));
    h.put.mockResolvedValue({ ok: true, settings: { watchlist_opt_in: true, include_prescreen_in_package: false, updated_at: null }, ops: { told: true, error: null } });
    renderWithRole(<FraudProtectionCard />, "Admin");
    fireEvent.click(await screen.findByTestId("watchlist-opt-in"));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/fraud/settings", { watchlist_opt_in: true }));
    expect(await screen.findByText(/Pat changed the banking details on a file/)).toBeInTheDocument();
    const services = screen.getByTestId("fraud-services");
    expect(within(services).getByText("Voice / deepfake analysis vendor")).toBeInTheDocument();
    expect(within(services).getAllByText("Not set up")).toHaveLength(1);
  });

  it("starter: the watchlist, pre-screen default and staff alerts show as locked", async () => {
    setPlan("starter", STARTER);
    h.get.mockResolvedValue(settings(STARTER));
    renderWithRole(<FraudProtectionCard />, "Admin");
    expect(await screen.findByTestId("feature-locked-fraud_13")).toBeInTheDocument();
    expect(screen.getByTestId("feature-locked-fraud_16")).toBeInTheDocument();
    expect(screen.getByTestId("feature-locked-fraud_14")).toBeInTheDocument();
    expect(screen.queryByTestId("watchlist-opt-in")).toBeNull();
  });

  it("hides itself on a server without the fraud suite", async () => {
    h.get.mockRejectedValue(new Error("404"));
    const { container } = renderWithRole(<FraudProtectionCard />, "Admin");
    await waitFor(() => expect(container.querySelector("[data-testid='company-section-fraud']")).toBeNull());
    expect(screen.queryByText(/Loading fraud protection/)).toBeNull();
  });
});

describe("readability and catalogue", () => {
  it("every chip has at least 4.5:1 contrast", () => {
    for (const s of [...Object.values(STATUS_STYLE), ...Object.values(BAND_STYLE)]) expect(contrast(s.fg, s.bg)).toBeGreaterThanOrEqual(4.5);
  });
  it("lists the 16 checks with the plans Todd chose", () => {
    const by = (p: string) => FEATURES.filter((f) => f.key.startsWith("fraud_") && f.plan === p).map((f) => Number(f.key.slice(6))).sort((a, b) => a - b);
    expect(by("starter")).toEqual([1, 2, 4, 5]);
    expect(by("growth")).toEqual([6, 7, 8]);
    expect(by("pro")).toEqual([3, 9, 10, 11, 12, 13, 14, 15, 16]);
  });
});
