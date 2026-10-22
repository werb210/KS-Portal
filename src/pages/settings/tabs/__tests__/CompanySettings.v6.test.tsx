// KS_PORTAL_v6_COMPANY - Settings > Company: Admins only, save refreshes the brand store, server field errors,
// the primary-colour contrast refusal, and the Connections section hidden when /api/licensee/admin is missing.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, put: h.put } }));

import CompanySettings from "../CompanySettings";
import { __resetBrandForTests, getBrand } from "@/config/brand";
import { contrastRatio, primaryContrastProblem } from "@/company/licenseeAdmin";

const ADMIN_BODY = {
  ok: true,
  licensee: {
    company_name: "Northwind Capital", legal_name: "Northwind Capital Inc.", assistant_name: "Ava",
    support_email: "help@northwind.example", support_phone: "+15875550100", logo_url: "", primary_color: "#0b1f3a",
    accent_color: "#f59e0b", time_zone: "America/Edmonton", country: "CA", mailing_address: "1 Main St, Calgary AB",
    twilio_main_number: "+18665550100", google_ads_customer_id: "123-456-7890", office365_tenant_id: "tenant-1",
  },
};
const notFound = () => Object.assign(new Error("Not found"), { status: 404 });
const fetchMock = vi.fn();

beforeEach(() => {
  h.get.mockReset();
  h.put.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  __resetBrandForTests();
});
afterEach(() => vi.unstubAllGlobals());

const companyName = () => screen.getByLabelText("Company name") as HTMLInputElement;

describe("Company tab", () => {
  it("shows nothing to Staff and never asks for the admin details", () => {
    renderWithRole(<CompanySettings />, "Staff");
    expect(screen.queryByTestId("company-settings")).toBeNull();
    expect(h.get).not.toHaveBeenCalled();
  });

  it("an Admin saves; only changed fields are sent and the brand store is refreshed at once", async () => {
    h.get.mockResolvedValueOnce(ADMIN_BODY);
    h.put.mockResolvedValueOnce({ ok: true, licensee: { ...ADMIN_BODY.licensee, company_name: "Northwind Lending" } });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, licensee: { ...ADMIN_BODY.licensee, company_name: "Northwind Lending" } }) });
    renderWithRole(<CompanySettings />, "Admin");
    await waitFor(() => expect(companyName().value).toBe("Northwind Capital"));
    expect(screen.getByTestId("company-section-connections")).toBeInTheDocument();
    expect(screen.getByText(/anti-spam law/)).toBeInTheDocument();
    fireEvent.change(companyName(), { target: { value: "Northwind Lending" } });
    fireEvent.click(screen.getByRole("button", { name: "Save company details" }));
    await waitFor(() => expect(getBrand().company_name).toBe("Northwind Lending"));
    expect(h.put).toHaveBeenCalledWith("/api/licensee", { company_name: "Northwind Lending" });
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ cache: "no-store" });
    expect(await screen.findAllByText("Company details saved.")).not.toHaveLength(0);
  });

  it("shows the server's field errors next to the fields", async () => {
    h.get.mockResolvedValueOnce(ADMIN_BODY);
    h.put.mockRejectedValueOnce(Object.assign(new Error("Bad"), { status: 400, details: { errors: ["support_email must be an email address"] } }));
    renderWithRole(<CompanySettings />, "Admin");
    await waitFor(() => expect(companyName().value).toBe("Northwind Capital"));
    fireEvent.change(screen.getByLabelText("Support email"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Save company details" }));
    expect(await screen.findByTestId("error-support_email")).toHaveTextContent("Support email must be an email address");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a primary colour white text cannot be read on, and explains why", async () => {
    h.get.mockResolvedValueOnce(ADMIN_BODY);
    renderWithRole(<CompanySettings />, "Admin");
    await waitFor(() => expect(companyName().value).toBe("Northwind Capital"));
    fireEvent.change(screen.getByLabelText("Primary colour"), { target: { value: "#fde047" } });
    expect(screen.getByTestId("primary-contrast")).toHaveTextContent("too faint");
    fireEvent.click(screen.getByRole("button", { name: "Save company details" }));
    expect(await screen.findByTestId("error-primary_color")).toHaveTextContent(/4\.5:1/);
    expect(h.put).not.toHaveBeenCalled();
  });

  it("hides Connections and starts from the public details when /api/licensee/admin is missing", async () => {
    h.get.mockRejectedValueOnce(notFound());
    renderWithRole(<CompanySettings />, "Admin");
    expect(await screen.findByTestId("company-section-branding")).toBeInTheDocument();
    expect(screen.queryByTestId("company-section-connections")).toBeNull();
    expect(companyName().value).toBe(getBrand().company_name);
  });
});

describe("contrast maths", () => {
  it("matches WCAG: white on black is 21:1, white on white 1:1", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(primaryContrastProblem("#0b1f3a")).toBeNull();
    expect(primaryContrastProblem("#f59e0b")).toMatch(/Choose a darker/);
  });
});
