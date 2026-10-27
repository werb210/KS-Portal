// KS_PORTAL_KB_v1 - the Help Center: search and categories, an article opened in place (links between articles stay
// in the portal), Ask Maya with the articles it cited, and Contact support with the conversation and articles tried.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post } }));

import HelpCenter from "../HelpCenter";

const ARTICLES = [
  { slug: "pipeline-stages", title: "Pipeline stages and moving deals", category: "Pipeline", summary: "The stages every deal moves through.", plans_label: "", on_your_plan: true },
  { slug: "single-sign-on", title: "Single sign-on with Microsoft or Google", category: "Security and privacy", summary: "Sign in with work accounts.", plans_label: "Pro", on_your_plan: false },
];

function routeGets() {
  h.get.mockImplementation(async (path: string) => {
    if (path === "/api/help-center/categories") return { categories: [{ category: "Pipeline", count: 3 }, { category: "Security and privacy", count: 5 }] };
    if (path.startsWith("/api/help-center/articles/pipeline-stages")) {
      return { article: { ...ARTICLES[0], updated_at: "2026-10-20T00:00:00Z", body_html: '<h2>The stages</h2><p>See <a href="#kb-single-sign-on" data-kb-slug="single-sign-on">SSO</a>.</p><img src="x" onerror="alert(1)">' } };
    }
    if (path.startsWith("/api/help-center/articles/single-sign-on")) return { article: { ...ARTICLES[1], body_html: "<p>Turn it on in Settings.</p>" } };
    if (path.startsWith("/api/help-center/articles")) {
      if (path.includes("category=Pipeline")) return { articles: [ARTICLES[0]] };
      if (path.includes("q=")) return { articles: [ARTICLES[1]] };
      return { articles: ARTICLES };
    }
    throw Object.assign(new Error("not found"), { status: 404 });
  });
}

beforeEach(() => {
  h.get.mockReset();
  h.post.mockReset();
  routeGets();
});

describe("Help Center", () => {
  it("lists articles with plan badges, filters by category and searches", async () => {
    renderWithRole(<HelpCenter />, "Staff");
    const list = await screen.findByTestId("help-results");
    expect(within(list).getByText("Pipeline stages and moving deals")).toBeInTheDocument();
    expect(within(list).getByText("Pro")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Pipeline" }));
    await waitFor(() => expect(h.get).toHaveBeenCalledWith("/api/help-center/articles?category=Pipeline"));
    await waitFor(() => expect(within(screen.getByTestId("help-results")).queryByText("Single sign-on with Microsoft or Google")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.change(screen.getByLabelText("Search help articles"), { target: { value: "sso" } });
    await waitFor(() => expect(h.get).toHaveBeenCalledWith("/api/help-center/articles?q=sso"));
  });

  it("opens an article in place, sanitised, and follows links to other articles", async () => {
    renderWithRole(<HelpCenter />, "Staff");
    fireEvent.click(await screen.findByRole("button", { name: "Pipeline stages and moving deals" }));
    const view = await screen.findByTestId("help-article");
    expect(await within(view).findByText("The stages")).toBeInTheDocument();
    expect(view.innerHTML).not.toContain("onerror");
    expect(within(view).getByText(/Last updated/)).toBeInTheDocument();
    fireEvent.click(within(view).getByText("SSO"));
    expect(await within(screen.getByTestId("help-article")).findByText("Turn it on in Settings.")).toBeInTheDocument();
    expect(screen.getByText(/Not on your current plan/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to help articles" }));
    await waitFor(() => expect(screen.queryByTestId("help-article")).toBeNull());
  });

  it("Ask Maya shows the answer with the articles it cited, which open in place", async () => {
    h.post.mockResolvedValueOnce({ answer: "Drag the card to **Offer**.", citations: [{ slug: "pipeline-stages", title: "Pipeline stages and moving deals" }], related: [], offer_support: false });
    renderWithRole(<HelpCenter />, "Staff");
    fireEvent.change(screen.getByLabelText("Your question for Maya"), { target: { value: "How do I move a deal?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const answer = await screen.findByTestId("maya-answer");
    expect(answer).toHaveTextContent("Drag the card to Offer.");
    expect(h.post).toHaveBeenCalledWith("/api/help-center/ask", { messages: [{ role: "user", text: "How do I move a deal?" }] });
    fireEvent.click(within(answer).getByRole("button", { name: "Pipeline stages and moving deals" }));
    expect(await screen.findByTestId("help-article")).toBeInTheDocument();
  });

  it("when Maya can't help it offers Contact support, which sends the conversation and the articles tried", async () => {
    h.post.mockResolvedValueOnce({ answer: "I couldn't find a help article that answers this.", citations: [], related: [{ slug: "pipeline-stages", title: "Pipeline stages and moving deals" }], offer_support: true });
    h.post.mockResolvedValueOnce({ ok: true, ticket: { id: "t1" } });
    renderWithRole(<HelpCenter />, "Staff");
    fireEvent.change(screen.getByLabelText("Your question for Maya"), { target: { value: "My fax rejects documents" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Not solved? The support team can help.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Contact support" }));
    expect(screen.getByTestId("maya-contact")).toHaveTextContent("the 1 article Maya tried");
    fireEvent.change(screen.getByLabelText("Anything to add? (optional)"), { target: { value: "Since Monday" } });
    fireEvent.click(screen.getByLabelText(/Urgent/));
    fireEvent.click(screen.getByRole("button", { name: "Send to support" }));
    expect(await screen.findByText(/Sent to Keystone support/)).toBeInTheDocument();
    expect(h.post).toHaveBeenLastCalledWith("/api/help-center/contact-support", {
      messages: [{ role: "user", text: "My fax rejects documents" }, { role: "assistant", text: "I couldn't find a help article that answers this." }],
      articles: [{ slug: "pipeline-stages", title: "Pipeline stages and moving deals" }],
      note: "Since Monday",
      priority: "urgent",
    });
  });

  it("shows the rate-limit message and still offers Contact support", async () => {
    h.post.mockRejectedValueOnce(Object.assign(new Error("Too many"), { status: 429 }));
    renderWithRole(<HelpCenter />, "Staff");
    fireEvent.change(screen.getByLabelText("Your question for Maya"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You've asked a lot of questions");
    expect(screen.getByRole("button", { name: "Contact support" })).toBeInTheDocument();
  });

  it("explains when help articles are not available", async () => {
    h.get.mockRejectedValue(Object.assign(new Error("down"), { status: 503, details: { message: "Help articles are not available on this copy yet. You can still send a request to support below." } }));
    renderWithRole(<HelpCenter />, "Staff");
    expect(await screen.findByRole("alert")).toHaveTextContent("Help articles are not available on this copy yet.");
  });
});
