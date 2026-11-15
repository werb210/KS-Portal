// KS_PORTAL_SETUP_BUSINESS_DETAILS_v1 - the business address is asked for in set-up (Phone lines), not at sign-up.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, put: h.put } }));

import BusinessDetailsCard from "../BusinessDetailsCard";

const DETAILS = (over: Record<string, unknown> = {}) => ({
  company_name: "Acme Lending", legal_name: "Acme Lending", address_line1: "", address_line2: "", city: "", province_state: "", postal_code: "",
  country: "CA", business_number: "", business_type: "", contact_title: "", business_types: ["corporation", "sole_proprietor"],
  complete: false, missing: "street address, city", address_registered: false, ...over,
});

beforeEach(() => { h.get.mockReset(); h.put.mockReset(); });

describe("business address in set-up", () => {
  it("shows nothing when the server is not linked to Keystone operations", async () => {
    h.get.mockResolvedValue({ ok: true, ops_ready: false, details: null });
    const { container } = render(<BusinessDetailsCard />);
    await waitFor(() => expect(h.get).toHaveBeenCalledWith("/api/business-details"));
    expect(container.querySelector("[data-testid='business-details']")).toBeNull();
  });

  it("asks for the address when it is missing, saves it, and then shows it on one line", async () => {
    h.get.mockResolvedValue({ ok: true, ops_ready: true, details: DETAILS() });
    h.put.mockResolvedValue({ ok: true, message: "Saved. Your phone lines will use this address.", details: DETAILS({ address_line1: "100 Main St SW", city: "Calgary", province_state: "AB", postal_code: "T2P 1P6", complete: true, missing: "", address_registered: true }) });
    const saved = vi.fn();
    render(<BusinessDetailsCard onSaved={saved} />);
    expect(await screen.findByText("Add your business address to finish your phone set-up")).toBeTruthy();
    expect(screen.getAllByText("(you can add this later)").length).toBe(3); // business number, kind of business, job title
    fireEvent.change(screen.getByLabelText(/Street address/), { target: { value: "100 Main St SW" } });
    fireEvent.change(screen.getByLabelText(/^City/), { target: { value: "Calgary" } });
    fireEvent.change(screen.getByLabelText(/Province or territory/), { target: { value: "AB" } });
    fireEvent.change(screen.getByLabelText(/Postal code/), { target: { value: "T2P 1P6" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(h.put).toHaveBeenCalled());
    expect(h.put.mock.calls[0]![0]).toBe("/api/business-details");
    expect(h.put.mock.calls[0]![1]).toMatchObject({ address_line1: "100 Main St SW", city: "Calgary", province_state: "AB", postal_code: "T2P 1P6", country: "CA" });
    expect(await screen.findByText("100 Main St SW, Calgary, AB, T2P 1P6")).toBeTruthy();
    expect(screen.getByText("On file with the phone system.")).toBeTruthy();
    expect(saved).toHaveBeenCalled();
  });

  it("shows what is wrong beside the field, in the server's words", async () => {
    h.get.mockResolvedValue({ ok: true, ops_ready: true, details: DETAILS() });
    h.put.mockRejectedValue({ details: { ok: false, errors: { postal_code: "Enter a Canadian postal code like T2P 1P6." } } });
    render(<BusinessDetailsCard />);
    await screen.findByText("Add your business address to finish your phone set-up");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a Canadian postal code like T2P 1P6.")).toBeTruthy();
    expect(screen.getByText("Please fix the highlighted fields.")).toBeTruthy();
  });
});
