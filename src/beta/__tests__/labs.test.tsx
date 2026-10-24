// KS_PORTAL_BETA_v1 - beta features: the store (off until the server says on), the Beta badge and gate, and the
// Settings -> Labs page (admins only; join, leave and feedback go to the server).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, render } from "@testing-library/react";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post } }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { __setBetaForTests, getBeta, isBetaEnabled, loadBeta, normalizeBeta } from "@/beta/betaStore";
import { BetaBadge, BetaGate } from "@/beta/BetaBadge";
import LabsSettings from "@/pages/settings/tabs/LabsSettings";

const feature = (over: Record<string, unknown> = {}) => ({
  key: "ai_call_notes", name: "AI call notes", description: "Writes the call note for you.", status: "public_beta",
  enabled: false, enrolled: false, can_join: true, can_leave: false, feedback_url: null, docs_url: null, ...over,
});

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  __setBetaForTests(null);
});

describe("beta store", () => {
  it("drops unknown, retired and duplicate items and keeps only https links", () => {
    const out = normalizeBeta({ features: [feature({ docs_url: "javascript:alert(1)" }), feature(), { key: "x y", status: "ga" }, feature({ key: "gone", status: "retired" })] });
    expect(out).toHaveLength(1);
    expect(out[0]!.docs_url).toBeNull();
    expect(normalizeBeta(null)).toEqual([]);
  });

  it("is off until the server says on, and off again when the server does not know betas (404)", async () => {
    expect(isBetaEnabled("ai_call_notes")).toBe(false);
    h.get.mockResolvedValueOnce({ features: [feature({ enabled: true, enrolled: true })] });
    await loadBeta();
    expect(isBetaEnabled("ai_call_notes")).toBe(true);
    h.get.mockRejectedValueOnce(Object.assign(new Error("nf"), { status: 404 }));
    await loadBeta();
    expect(getBeta().source).toBe("fallback");
    expect(isBetaEnabled("ai_call_notes")).toBe(false);
  });
});

describe("Beta badge and gate", () => {
  it("shows a readable Beta badge and the status label", () => {
    render(<><BetaBadge /><BetaBadge status="ga" /></>);
    const badges = screen.getAllByTestId("beta-badge");
    expect(badges[0]).toHaveTextContent("Beta");
    expect(badges[1]).toHaveTextContent("Now available");
  });

  it("renders gated content only while the beta is on", () => {
    __setBetaForTests({ source: "server", features: [] });
    const { rerender } = render(<BetaGate flag="ai_call_notes" fallback={<span>old</span>}><span>new</span></BetaGate>);
    expect(screen.getByText("old")).toBeInTheDocument();
    __setBetaForTests({ source: "server", features: normalizeBeta({ features: [feature({ enabled: true })] }) });
    rerender(<BetaGate flag="ai_call_notes" fallback={<span>old</span>}><span>new</span></BetaGate>);
    expect(screen.getByText("new")).toBeInTheDocument();
  });
});

describe("Settings -> Labs", () => {
  it("is for administrators only", () => {
    h.get.mockResolvedValue({ features: [feature()] });
    renderWithRole(<LabsSettings />, "Staff");
    expect(screen.getByText("Only an administrator can manage beta features.")).toBeInTheDocument();
  });

  it("lists betas with their status and joins one", async () => {
    h.get.mockResolvedValue({ features: [feature()] });
    h.post.mockResolvedValue({ ok: true, status: "joined", features: [feature({ enabled: true, enrolled: true, can_join: false, can_leave: true })], enabled: ["ai_call_notes"] });
    renderWithRole(<LabsSettings />, "Admin");
    expect(await screen.findByText("AI call notes")).toBeInTheDocument();
    expect(screen.getByText("Writes the call note for you.")).toBeInTheDocument();
    expect(screen.getByText("Public beta")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/beta/features/ai_call_notes/join", {}));
    expect(await screen.findByRole("button", { name: "Leave" })).toBeInTheDocument();
    expect(isBetaEnabled("ai_call_notes")).toBe(true);
  });

  it("sends feedback on a joined beta", async () => {
    h.get.mockResolvedValue({ features: [feature({ enabled: true, enrolled: true, can_join: false, can_leave: true })] });
    h.post.mockResolvedValue({ ok: true });
    renderWithRole(<LabsSettings />, "Admin");
    fireEvent.click(await screen.findByRole("button", { name: "Send feedback" }));
    fireEvent.change(screen.getByLabelText("Your feedback on AI call notes"), { target: { value: "Saves me time." } });
    fireEvent.change(screen.getByLabelText("How useful is it?"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/beta/features/ai_call_notes/feedback", { message: "Saves me time.", rating: 5 }));
  });

  it("says so when there are no betas", async () => {
    h.get.mockResolvedValue({ features: [] });
    renderWithRole(<LabsSettings />, "Admin");
    expect(await screen.findByTestId("labs-empty")).toBeInTheDocument();
  });
});
