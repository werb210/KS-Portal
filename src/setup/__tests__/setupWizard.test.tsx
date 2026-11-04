// KS_SETUP_WIZARD - the set-up wizard: step cards, progress, first-run auto-open, Mark done / Skip, Help in place,
// the Set-up count in the menu, and the Staff role reading as "Broker".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, put: h.put } }));

import { SetupNavItem, SetupWizardHost } from "../SetupNavItem";
import { resetSetupAutoOpenForTests, useSetupStore } from "../setupStore";
import { getRoleLabel, roleLabel } from "@/utils/roles";
import { roleOptions } from "@/roles/useRoleChoices";

const step = (key: string, title: string, over: Record<string, unknown> = {}) => ({
  key, title, why: `Why ${title}.`, link: `/settings/${key}`, help_slug: `${key}-help`, status: "todo", auto: true, can_mark_done: false, optional: false, external_url: null, ...over,
});
const ADMIN = {
  ok: true, role: "admin", dismissed: false, complete: false,
  steps: [
    step("profile", "Your profile", { status: "done" }),
    step("brand", "Brand your portal and client app", { link: "/settings/company", help_slug: "brand-your-portal" }),
    step("import", "Bring your data over", { status: "skipped" }),
    step("payments", "Payments and QuickBooks", { optional: true }),
    step("test_link", "Send yourself a test application link", { link: "/crm/contacts", can_mark_done: true, external_url: "https://apply.example.ca" }),
  ],
};
const BROKER = {
  ok: true, role: "broker", dismissed: false, complete: false,
  steps: [
    step("profile", "Your profile and email signature"),
    step("apps", "Install the iPhone dialler and iPad app", { link: null, help_slug: "iphone-dialler", can_mark_done: true }),
  ],
};

function Where() {
  const l = useLocation();
  return <div data-testid="where">{l.pathname}{l.search}</div>;
}
function renderHost(enabled = true) {
  return render(
    <MemoryRouter initialEntries={["/portal"]}>
      <SetupNavItem />
      <SetupWizardHost enabled={enabled} />
      <Routes><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>,
  );
}
const answer = (body: unknown) => h.get.mockImplementation(async (path: string) => {
  if (path === "/api/setup") return body;
  if (path.startsWith("/api/help-center/articles/")) {
    return { article: { slug: "iphone-dialler", title: "The iPhone dialler", category: "Phone", summary: "", plans_label: "", on_your_plan: true, updated_at: null, body_html: "<p>Install the Keystone dialler.</p>" } };
  }
  throw new Error(`unexpected ${path}`);
});

beforeEach(() => {
  h.get.mockReset();
  h.put.mockReset();
  resetSetupAutoOpenForTests();
  useSetupStore.getState().reset();
});
afterEach(() => vi.restoreAllMocks());

describe("first run", () => {
  it("opens by itself the first time someone signs in, with the progress and each step as a card", async () => {
    answer(ADMIN);
    renderHost();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Set up your brokerage")).toBeInTheDocument();
    expect(within(dialog).getByText("1 of 5 done")).toBeInTheDocument();
    expect(within(dialog).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    const brand = screen.getByTestId("setup-step-brand");
    expect(within(brand).getByText("Brand your portal and client app")).toBeInTheDocument();
    expect(within(brand).getByText("Why Brand your portal and client app.")).toBeInTheDocument();
    expect(within(brand).getByTestId("setup-status")).toHaveTextContent("To do");
    expect(within(brand).getByRole("button", { name: "Do it now" })).toBeInTheDocument();
    expect(within(brand).getByRole("button", { name: "Help" })).toBeInTheDocument();
    expect(within(brand).queryByRole("button", { name: "Mark done" })).toBeNull(); // detected by itself
    expect(within(brand).getByRole("button", { name: "Skip" })).toBeInTheDocument();
    expect(within(screen.getByTestId("setup-step-profile")).getByTestId("setup-status")).toHaveTextContent("Done");
    expect(within(screen.getByTestId("setup-step-import")).getByTestId("setup-status")).toHaveTextContent("Skipped");
    expect(within(screen.getByTestId("setup-step-payments")).getByText("Optional")).toBeInTheDocument();
    // The menu item shows the count.
    expect(screen.getByTestId("setup-nav")).toHaveTextContent("Set-up1 of 5");
  });

  it("does not open by itself again in the same sign-in, once dismissed, or when everything is done", async () => {
    answer(ADMIN);
    const first = renderHost();
    await screen.findByRole("dialog");
    first.unmount();
    useSetupStore.getState().reset();
    renderHost();
    await waitFor(() => expect(screen.getByTestId("setup-nav")).toBeInTheDocument());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a dismissed or finished wizard stays closed but is reachable from Set-up", async () => {
    answer({ ...ADMIN, dismissed: true });
    renderHost();
    await waitFor(() => expect(screen.getByTestId("setup-nav")).toBeInTheDocument());
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByTestId("setup-nav"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("nothing loads for people the wizard is not for", async () => {
    renderHost(false);
    await act(async () => undefined);
    expect(h.get).not.toHaveBeenCalled();
    expect(screen.queryByTestId("setup-nav")).toBeNull();
  });
});

describe("steps", () => {
  it("Do it now goes to the existing page and closes the wizard", async () => {
    answer(ADMIN);
    renderHost();
    const brand = await screen.findByTestId("setup-step-brand");
    fireEvent.click(within(brand).getByRole("button", { name: "Do it now" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/settings/company");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Mark done and Skip save the answer and show the new status", async () => {
    answer(ADMIN);
    h.put.mockImplementation(async (path: string, body: { status: string }) => {
      const key = path.split("/").pop();
      return { ...ADMIN, steps: ADMIN.steps.map((s) => (s.key === key ? { ...s, status: body.status } : s)) };
    });
    renderHost();
    const test = await screen.findByTestId("setup-step-test_link");
    expect(within(test).getByText("https://apply.example.ca")).toBeInTheDocument();
    fireEvent.click(within(test).getByRole("button", { name: "Mark done" }));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/setup/steps/test_link", { status: "done" }));
    await waitFor(() => expect(within(screen.getByTestId("setup-step-test_link")).getByTestId("setup-status")).toHaveTextContent("Done"));
    expect(screen.getByText("2 of 5 done")).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId("setup-step-brand")).getByRole("button", { name: "Skip" }));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/setup/steps/brand", { status: "skipped" }));
    await waitFor(() => expect(within(screen.getByTestId("setup-step-brand")).getByRole("button", { name: "Put back on my list" })).toBeInTheDocument());
  });

  it("a refused change is shown in plain words", async () => {
    answer(ADMIN);
    h.put.mockRejectedValue(Object.assign(new Error("Request failed"), { details: { message: "This step is ticked off by itself once it is done." } }));
    renderHost();
    const brand = await screen.findByTestId("setup-step-brand");
    fireEvent.click(within(brand).getByRole("button", { name: "Skip" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This step is ticked off by itself once it is done.");
  });

  it("a step with no page (the apps) shows the help article in place, with a way back", async () => {
    answer(BROKER);
    renderHost();
    const apps = await screen.findByTestId("setup-step-apps");
    expect(screen.getByText("Get set up as a broker")).toBeInTheDocument();
    fireEvent.click(within(apps).getByRole("button", { name: "Show me how" }));
    expect(await screen.findByText("Install the Keystone dialler.")).toBeInTheDocument();
    expect(h.get).toHaveBeenCalledWith("/api/help-center/articles/iphone-dialler");
    fireEvent.click(screen.getByRole("button", { name: "Back to set-up" }));
    expect(await screen.findByTestId("setup-step-apps")).toBeInTheDocument();
  });

  it("Don't show this again closes it for good", async () => {
    answer(BROKER);
    h.put.mockResolvedValue({ ...BROKER, dismissed: true });
    renderHost();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Don't show this again" }));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/setup/dismiss", {}));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("the Staff role reads as Broker", () => {
  it("labels and role pickers say Broker; the value sent to the server stays Staff", () => {
    expect(getRoleLabel("Staff")).toBe("Broker");
    expect(roleLabel("staff")).toBe("Broker");
    expect(roleLabel("Marketing")).toBe("Marketing");
    const opts = roleOptions([]);
    expect(opts.find((o) => o.value === "builtin:Staff")?.label).toBe("Broker");
    expect(opts.map((o) => o.label)).not.toContain("Staff");
  });
});
