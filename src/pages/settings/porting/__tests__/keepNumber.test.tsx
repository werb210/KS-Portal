// KS_PORTAL_NUMBER_PORTING_v1 - "Your phone numbers": keep the new Keystone number (default) or keep an existing one,
// with the call-forwarding steps shown straight away, the details and bill sent, and the letter signed. Also opened
// inside the set-up wizard. The server is mocked; numbers are 555 test numbers.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put } }));

import CallForwardingGuide, { forwardingCodes } from "../CallForwardingGuide";
import KeepNumberPanel from "../KeepNumberPanel";
import SetupWizard from "@/setup/SetupWizard";
import { useSetupStore } from "@/setup/setupStore";

const PEOPLE = [
  { id: "u-bea", name: "Bea Broker", email: "bea@acme.example", role: "Staff", temporary_number: "+14035550111", temporary_kind: "direct" },
  { id: "u-lee", name: "Lee Staff", email: "lee@acme.example", role: "Staff", temporary_number: "+14035550100", temporary_kind: "main" },
];
const LOA = { version: "loa-1", title: "Letter of Authorization", html: "<h2>Letter of Authorization</h2><p>Account number: 998877</p>", text: "x", sha256: "a".repeat(64), signed: null };
const REQUEST = (over: Record<string, unknown> = {}) => ({
  id: "33333333-3333-4333-8333-333333333333", status: "draft", status_label: "Waiting for your signature", status_message: "Sign the letter of authorization.",
  carrier: "telus", carrier_label: "Telus", account_name: "Acme Lending Inc.", account_number_masked: "••••8877", pin_on_file: true,
  numbers: [{ phone_number: "+14035550188", number_type: "mobile", user_id: "u-bea", assignee_name: "Bea Broker", temporary_number: "+14035550111", forwarding_tested_at: null, attached_at: null }],
  bill: { filename: "bill.pdf", size_bytes: 10 }, loa: null, needs_signature: true, can_cancel: true, foc_date: null, status_reason: null, created_at: null, ...over,
});
let requests: unknown[] = [];

beforeEach(() => {
  requests = [];
  h.get.mockReset().mockImplementation(async (path: string) => {
    if (path === "/api/port-requests") return { ok: true, ops_ready: true, requests, people: PEOPLE, main_line: "+14035550100" };
    if (path.endsWith("/loa")) return LOA;
    if (path === "/api/setup") return WIZARD;
    throw new Error(`unexpected ${path}`);
  });
  h.post.mockReset();
  h.put.mockReset();
});
afterEach(() => {
  useSetupStore.getState().reset();
});

describe("call forwarding guide", () => {
  it("fills the codes in with the temporary Keystone number and says texts are not forwarded", () => {
    const onTested = vi.fn();
    render(<CallForwardingGuide oldNumber="4035550188" temporaryNumber="+14035550111" carrier="bell" numberType="mobile" tested={false} onTestedChange={onTested} />);
    expect(screen.getByText("**21*4035550111#")).toBeTruthy();
    expect(screen.getByText("##21#")).toBeTruthy();
    expect(screen.getByText(/Bell mobiles/)).toBeTruthy();
    expect(screen.getByText(/Texts cannot be forwarded/)).toBeTruthy();
    expect(screen.getByText(/VoIP or PBX/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Test it: I called \(403\) 555-0188/ }));
    expect(onTested).toHaveBeenCalledWith(true);
  });

  it("landlines use *72 / *73; toll-free goes through the provider; before a type is chosen both common codes show", () => {
    expect(forwardingCodes("+14035550111", "bell", "local")).toMatchObject({ on: "*724035550111", off: "*73" });
    expect(forwardingCodes("+14035550111", "verizon", "mobile")).toMatchObject({ on: "*724035550111", off: "*73" });
    expect(forwardingCodes("+14035550111", "", "toll_free")).toEqual({ kind: "toll_free" });
    render(<CallForwardingGuide temporaryNumber="+14035550111" tested={false} onTestedChange={() => undefined} />);
    expect(screen.getByText("*724035550111")).toBeTruthy();
    expect(screen.getByText("**21*4035550111#")).toBeTruthy();
  });
});

describe("keep your existing number", () => {
  it("the new Keystone number is the default; keeping one shows the forwarding steps first, then sends the details and the letter is signed", async () => {
    h.post.mockImplementation(async (path: string, body: any) => {
      if (path === "/api/port-requests") return { ok: true, request: REQUEST(), loa: LOA };
      if (path.endsWith("/sign")) return { ok: true, request: REQUEST({ status: "ready_to_submit", needs_signature: false }) };
      throw new Error(`unexpected ${path} ${JSON.stringify(body)}`);
    });
    render(<KeepNumberPanel />);
    const bea = await screen.findByTestId("number-choice-u-bea");
    expect(within(bea).getByRole("radio", { name: "Use the new Keystone number" })).toHaveProperty("checked", true);
    expect(within(bea).getByText(/Keystone number: \(403\) 555-0111/)).toBeTruthy();

    fireEvent.click(within(bea).getByRole("radio", { name: "Keep my existing number" }));
    // Forwarding to Bea's own temporary number, straight away.
    expect(within(bea).getByTestId("call-forwarding-guide").textContent).toContain("(403) 555-0111");

    const set = (labelText: RegExp, value: string) => fireEvent.change(within(bea).getByLabelText(labelText), { target: { value } });
    set(/The number to keep/, "403-555-0188");
    set(/Type of number/, "mobile");
    set(/Current carrier/, "telus");
    set(/Account number/, "998877");
    set(/Account PIN/, "4321");
    set(/Name on the account/, "Acme Lending Inc.");
    set(/Service address/, "1 Test Way");
    set(/^City/, "Calgary");
    set(/Province or state/, "AB");
    set(/Postal or ZIP code/, "T2P 1A1");
    const file = new File(["%PDF-1.4 test"], "bill.pdf", { type: "application/pdf" });
    fireEvent.change(within(bea).getByLabelText(/A recent bill/), { target: { files: [file] } });
    fireEvent.click(within(bea).getByRole("checkbox", { name: /Test it/ }));
    fireEvent.click(within(bea).getByRole("button", { name: "Continue to the letter of authorization" }));

    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/port-requests", expect.anything()));
    const body = h.post.mock.calls[0]![1];
    expect(body).toMatchObject({
      carrier: "telus", account_number: "998877", pin: "4321", account_name: "Acme Lending Inc.", forwarding_tested: true,
      service_address: { line1: "1 Test Way", city: "Calgary", region: "AB", postal_code: "T2P 1A1", country: "CA" },
      numbers: [{ phone_number: "403-555-0188", number_type: "mobile", user_id: "u-bea" }],
      bill: { filename: "bill.pdf", content_type: "application/pdf" },
    });
    expect(atob(body.bill.data_base64)).toBe("%PDF-1.4 test");

    const signer = await screen.findByTestId("loa-signer");
    expect(signer.textContent).toContain("Letter of Authorization");
    const signBtn = within(signer).getByRole("button", { name: "Sign the letter" });
    expect(signBtn).toHaveProperty("disabled", true);
    fireEvent.change(within(signer).getByLabelText("Your full name"), { target: { value: "Ana Admin" } });
    fireEvent.change(within(signer).getByLabelText("Your title"), { target: { value: "Owner" } });
    fireEvent.click(within(signer).getByRole("checkbox"));
    fireEvent.click(signBtn);
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/port-requests/33333333-3333-4333-8333-333333333333/sign", { signer_name: "Ana Admin", signer_title: "Owner", agree: true, sha256: LOA.sha256 }));
    expect(await screen.findByText(/Signed. Keystone support will submit the transfer/)).toBeTruthy();
  });

  it("shows the server's field errors next to the fields", async () => {
    h.post.mockRejectedValue(Object.assign(new Error("Request failed"), { details: { error: "invalid_request", message: "Check the highlighted details.", errors: { account_number: "Enter the account number from your bill." } } }));
    render(<KeepNumberPanel />);
    const lee = await screen.findByTestId("number-choice-u-lee");
    fireEvent.click(within(lee).getByRole("radio", { name: "Keep my existing number" }));
    expect(within(lee).getByTestId("call-forwarding-guide").textContent).toContain("(403) 555-0100"); // Lee uses the main line
    fireEvent.change(within(lee).getByLabelText(/The number to keep/), { target: { value: "4035550199" } });
    fireEvent.change(within(lee).getByLabelText(/Type of number/), { target: { value: "local" } });
    fireEvent.change(within(lee).getByLabelText(/Current carrier/), { target: { value: "bell" } });
    fireEvent.change(within(lee).getByLabelText(/A recent bill/), { target: { files: [new File(["%PDF-1.4"], "b.pdf", { type: "application/pdf" })] } });
    fireEvent.click(within(lee).getByRole("button", { name: "Continue to the letter of authorization" }));
    expect((await within(lee).findAllByText("Enter the account number from your bill.")).length).toBeGreaterThan(0);
  });

  it("lists transfers with the account number masked, the 90-minute warning and the forwarding reminder", async () => {
    requests = [REQUEST({ status: "carrier_approval_pending", status_label: "Approve the carrier's text", needs_signature: false, can_cancel: false })];
    render(<KeepNumberPanel />);
    const card = await screen.findByTestId("port-request");
    expect(card.textContent).toContain("••••8877, PIN on file");
    expect(card.textContent).not.toContain("998877");
    expect(within(card).getByRole("alert").textContent).toMatch(/within 90 minutes/);
    expect(within(card).getByText(/Call forwarding for \(403\) 555-0188/)).toBeTruthy();
    expect(within(screen.getByTestId("number-choice-u-bea")).getByText(/A transfer is running/)).toBeTruthy();
  });

  it("says plainly when the server is not linked to Keystone operations", async () => {
    h.get.mockResolvedValue({ ok: true, ops_ready: false, message: "This server is not linked to Keystone operations yet.", requests: [], people: PEOPLE, main_line: null });
    render(<KeepNumberPanel />);
    expect((await screen.findAllByRole("alert"))[0]!.textContent).toMatch(/not linked/);
    expect(within(screen.getByTestId("number-choice-u-bea")).getByRole("radio", { name: "Keep my existing number" })).toHaveProperty("disabled", true);
  });
});

const WIZARD = {
  ok: true, role: "admin", dismissed: false, complete: false,
  steps: [
    { key: "phone", title: "Get your phone number", why: "Calls.", link: "/settings/phone", help_slug: "get-phone-numbers", status: "done", auto: true, can_mark_done: false, optional: false, external_url: null },
    { key: "phone_numbers", title: "Your phone numbers", why: "Keep a number.", link: "/settings/phone", help_slug: "keep-your-existing-number", status: "todo", auto: true, can_mark_done: true, optional: true, external_url: null },
  ],
};

describe("in the set-up wizard", () => {
  it("\"Your phone numbers\" opens the choice in place; the default needs one click and is skippable", async () => {
    h.put.mockResolvedValue({ ...WIZARD, steps: [WIZARD.steps[0], { ...WIZARD.steps[1], status: "done" }] });
    await useSetupStore.getState().load();
    useSetupStore.setState({ open: true });
    render(<MemoryRouter><SetupWizard /></MemoryRouter>);
    const step = await screen.findByTestId("setup-step-phone_numbers");
    expect(within(step).getByRole("button", { name: "Skip" })).toBeTruthy();
    fireEvent.click(within(step).getByRole("button", { name: "Choose" }));
    expect(await screen.findByTestId("setup-phone-numbers")).toBeTruthy();
    expect(await screen.findByTestId("keep-number-panel")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Done: everyone else uses their new Keystone number/ }));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/setup/steps/phone_numbers", { status: "done" }));
    expect(await screen.findByTestId("setup-step-phone_numbers")).toBeTruthy();
  });
});
