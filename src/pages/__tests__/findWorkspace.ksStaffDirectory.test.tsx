// KS_STAFF_DIRECTORY_v1 - the iPad app finds the staff member's brokerage from their email or mobile number; the
// company code is only a hidden fallback; the web portal is unchanged.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Login from "@/pages/Login";
import FindWorkspace from "@/pages/FindWorkspace";
import {
  PREFILL_PHONE_KEY, WORKSPACE_KEY, findWorkspaces, nativeWorkspaceServer, needsWorkspace, opsUrl, phoneFrom, storedWorkspace,
} from "@/config/workspace";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const A = { name: "Alpha Capital", server_url: "https://ks-alpha.azurewebsites.net" };
const B = { name: "Beta Funding", server_url: "https://ks-beta.azurewebsites.net" };

function setNative(on: boolean) {
  if (on) (window as any).Capacitor = { isNativePlatform: () => true };
  else delete (window as any).Capacitor;
}

describe("workspace (iPad app)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setNative(false);
  });
  afterAll(() => setNative(false));

  it("the web portal never asks and keeps its build-time server", () => {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(A));
    expect(needsWorkspace()).toBe(false);
    expect(nativeWorkspaceServer()).toBeNull();
    localStorage.clear();
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByTestId("phone-input")).toBeInTheDocument();
    expect(screen.queryByTestId("find-workspace")).toBeNull();
  });

  it("the iPad app asks for an email or mobile number first, and never mentions a company code up front", () => {
    setNative(true);
    expect(needsWorkspace()).toBe(true);
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByTestId("find-workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Work email or mobile number")).toBeInTheDocument();
    expect(screen.queryByLabelText(/company code/i)).toBeNull();
  });

  it("one match is chosen straight away and a typed mobile number is carried to the code step", async () => {
    setNative(true);
    const fetchImpl = vi.fn(async () => json({ matches: [A] })) as unknown as typeof fetch;
    const reload = vi.fn();
    render(<FindWorkspace fetchImpl={fetchImpl} reload={reload} />);
    fireEvent.change(screen.getByTestId("identifier-input"), { target: { value: "(403) 555-0101" } });
    fireEvent.click(screen.getByTestId("identifier-continue"));
    await waitFor(() => expect(reload).toHaveBeenCalledWith("/login"));
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(`${opsUrl()}/api/staff-directory/lookup`);
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ identifier: "(403) 555-0101" });
    expect(storedWorkspace()).toEqual(A);
    expect(nativeWorkspaceServer()).toBe(A.server_url);
    expect(sessionStorage.getItem(PREFILL_PHONE_KEY)).toBe("+14035550101");
  });

  it("several matches show a picker", async () => {
    setNative(true);
    const reload = vi.fn();
    render(<FindWorkspace fetchImpl={(async () => json({ matches: [A, B] })) as unknown as typeof fetch} reload={reload} />);
    fireEvent.change(screen.getByTestId("identifier-input"), { target: { value: "sam@example.test" } });
    fireEvent.click(screen.getByTestId("identifier-continue"));
    await screen.findByTestId("workspace-picker");
    fireEvent.click(screen.getByRole("button", { name: "Beta Funding" }));
    expect(storedWorkspace()).toEqual(B);
    expect(reload).toHaveBeenCalledWith("/login");
    expect(sessionStorage.getItem(PREFILL_PHONE_KEY)).toBeNull();
  });

  it("no match says so plainly; a rate limit says to wait", async () => {
    setNative(true);
    const responses = [json({ matches: [] }), json({ error: "rate_limited" }, 429)];
    render(<FindWorkspace fetchImpl={(async () => responses.shift()!) as unknown as typeof fetch} reload={vi.fn()} />);
    fireEvent.change(screen.getByTestId("identifier-input"), { target: { value: "nobody@example.test" } });
    fireEvent.click(screen.getByTestId("identifier-continue"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn't find a Keystone account/);
    fireEvent.click(screen.getByTestId("identifier-continue"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Too many tries/));
    expect(storedWorkspace()).toBeNull();
  });

  it("the company code still works behind 'Enter company code instead'", async () => {
    setNative(true);
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith("/api/directory/alpha") ? json({ company_code: "alpha", company_name: A.name, server_url: A.server_url }) : json({ error: "unknown_company" }, 404),
    ) as unknown as typeof fetch;
    const reload = vi.fn();
    render(<FindWorkspace fetchImpl={fetchImpl} reload={reload} />);
    fireEvent.click(screen.getByTestId("use-company-code"));
    fireEvent.change(screen.getByTestId("company-code-input"), { target: { value: "nope" } });
    fireEvent.click(screen.getByTestId("company-code-continue"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn't find that company code/);
    fireEvent.change(screen.getByTestId("company-code-input"), { target: { value: " Alpha " } });
    fireEvent.click(screen.getByTestId("company-code-continue"));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(storedWorkspace()).toEqual(A);
  });

  it("with a workspace chosen, the iPad shows the phone step, pre-filled, with a way to change company", () => {
    setNative(true);
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(A));
    sessionStorage.setItem(PREFILL_PHONE_KEY, "+14035550101");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect((screen.getByTestId("phone-input") as HTMLInputElement).value).toBe("+14035550101");
    expect(screen.getByTestId("workspace-line").textContent).toMatch(/Signing in to Alpha Capital/);
    expect(sessionStorage.getItem(PREFILL_PHONE_KEY)).toBeNull();
  });

  it("ignores servers that are not https and parses phone numbers like KS-Ops", async () => {
    const found = await findWorkspaces("a@b.co", (async () => json({ matches: [{ name: "X", server_url: "http://evil.example" }, A] })) as unknown as typeof fetch);
    expect(found).toEqual([A]);
    expect(phoneFrom("+1 (403) 555-0101")).toBe("+14035550101");
    expect(phoneFrom("555-0101")).toBeNull();
    expect(phoneFrom("a@b.co")).toBeNull();
  });
});
