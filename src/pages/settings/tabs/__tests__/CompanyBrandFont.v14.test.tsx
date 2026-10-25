// KS_PORTAL_v14_BRAND_FONT - background colour and font on Settings > Company, and the portal applying them.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithRole } from "@/plans/__tests__/renderWithRole";

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, put: h.put } }));

import CompanySettings from "../CompanySettings";
import { __resetBrandForTests, applyBrand, getBrand } from "@/config/brand";
import { brandThemeCss, contrast, readableBackground } from "@/config/brandTheme";

const ADMIN_BODY = {
  ok: true,
  licensee: {
    company_name: "Northwind Capital", primary_color: "#0b1f3a", accent_color: "#0e6655", background_color: "#fffaf0",
    font_family: "Lato", time_zone: "America/Edmonton", country: "CA",
  },
};
const fetchMock = vi.fn();

beforeEach(() => {
  h.get.mockReset();
  h.put.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  __resetBrandForTests();
});
afterEach(() => vi.unstubAllGlobals());

describe("Company tab: background and font", () => {
  it("shows the saved values and saves a change", async () => {
    h.get.mockResolvedValueOnce(ADMIN_BODY);
    h.put.mockResolvedValueOnce({ ok: true, licensee: { ...ADMIN_BODY.licensee, font_family: "Merriweather" } });
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, licensee: { ...ADMIN_BODY.licensee, font_family: "Merriweather" } }) });
    renderWithRole(<CompanySettings />, "Admin");
    await waitFor(() => expect((screen.getByLabelText("Font") as HTMLSelectElement).value).toBe("Lato"));
    expect((screen.getByLabelText("Background colour") as HTMLInputElement).value).toBe("#fffaf0");
    expect(screen.getByTestId("background-contrast")).toHaveTextContent("readable");
    fireEvent.change(screen.getByLabelText("Font"), { target: { value: "Merriweather" } });
    expect(screen.getByTestId("font-sample").style.fontFamily).toContain("Merriweather");
    fireEvent.click(screen.getByRole("button", { name: "Save company details" }));
    await waitFor(() => expect(h.put).toHaveBeenCalledWith("/api/licensee", { font_family: "Merriweather" }));
  });

  it("refuses a background too dark for dark text", async () => {
    h.get.mockResolvedValueOnce(ADMIN_BODY);
    renderWithRole(<CompanySettings />, "Admin");
    await waitFor(() => expect((screen.getByLabelText("Background colour") as HTMLInputElement).value).toBe("#fffaf0"));
    fireEvent.change(screen.getByLabelText("Background colour"), { target: { value: "#1e293b" } });
    expect(screen.getByTestId("background-contrast")).toHaveTextContent("too dark");
    fireEvent.click(screen.getByRole("button", { name: "Save company details" }));
    expect(await screen.findByTestId("error-background_color")).toHaveTextContent(/too dark/);
    expect(h.put).not.toHaveBeenCalled();
  });

  it("keeps a font from the licensee's website that is not in the list", async () => {
    h.get.mockResolvedValueOnce({ ok: true, licensee: { ...ADMIN_BODY.licensee, font_family: "Acme Grotesk" } });
    renderWithRole(<CompanySettings />, "Admin");
    await waitFor(() => expect((screen.getByLabelText("Font") as HTMLSelectElement).value).toBe("Acme Grotesk"));
    expect(screen.getByRole("option", { name: "Acme Grotesk (your website's font)" })).toBeInTheDocument();
  });
});

describe("portal theme", () => {
  it("uses the background in the light theme only, lightened when needed, and the font everywhere", () => {
    const css = brandThemeCss({ background_color: "#FFFAF0", font_family: "Lato" });
    expect(css).toContain(':root[data-theme="light"] { --panel-bg: #FFFAF0;');
    expect(css).not.toContain('data-theme="dark"');
    expect(css).toContain('font-family: "Lato"');
    const dark = readableBackground("#1E3A5F")!;
    expect(contrast(dark, "#51617D")).toBeGreaterThanOrEqual(4.5);
    expect(brandThemeCss({ font_family: "x;}body{display:none" })).toBe("");
  });

  it("applies the licensee's background and font when the brand loads", () => {
    applyBrand({ company_name: "Northwind", background_color: "#FFFAF0", font_family: "Open Sans" });
    expect(getBrand()).toMatchObject({ background_color: "#FFFAF0", font_family: "Open Sans" });
    expect(document.getElementById("ks-brand-theme")?.textContent).toContain("--panel-bg: #FFFAF0");
    expect(document.getElementById("ks-brand-font")?.getAttribute("href")).toContain("family=Open+Sans");
    applyBrand({ company_name: "Northwind" });
    expect(document.getElementById("ks-brand-theme")).toBeNull();
    expect(document.getElementById("ks-brand-font")).toBeNull();
  });
});
