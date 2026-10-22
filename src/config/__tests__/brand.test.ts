// KS_PORTAL_v2_BRANDING - the licensee store: defaults, a successful load, and a failed load.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetBrandForTests, assistantName, brandName, getBrand, legalName, loadBrand, portalTitle } from "@/config/brand";

const LICENSEE = {
  company_name: "Keystone Demo Brokerage",
  legal_name: "Keystone Demo Brokerage Inc.",
  assistant_name: "Assistant",
  support_email: "help@example.com",
  support_phone: "",
  logo_url: "",
  primary_color: "#123456",
  accent_color: "#f59e0b",
  time_zone: "America/Edmonton",
  country: "CA",
  urls: { server: "https://s.example.com", portal: "", client: "", website: "" },
};

describe("brand store", () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
    __resetBrandForTests();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("starts from neutral defaults, never Boreal", () => {
    expect(brandName()).toBe("Keystone");
    expect(legalName()).toBe("Keystone");
    expect(assistantName()).toBe("Assistant");
    expect(brandName()).not.toMatch(/boreal/i);
  });

  it("loadBrand fetches /api/licensee, updates the name, title and cache", async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({ ok: true, licensee: LICENSEE }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadBrand()).resolves.toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/api\/licensee$/);
    expect(brandName()).toBe("Keystone Demo Brokerage");
    expect(legalName()).toBe("Keystone Demo Brokerage Inc.");
    expect(getBrand().primary_color).toBe("#123456");
    expect(document.title).toBe(portalTitle());
    expect(document.title).toBe("Keystone Demo Brokerage Portal");
    // A fresh start (the next page load) picks the cached copy up synchronously.
    __resetBrandForTests();
    expect(brandName()).toBe("Keystone Demo Brokerage");
  });

  it("keeps the default when the server fails, without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await expect(loadBrand()).resolves.toBe(false);
    expect(brandName()).toBe("Keystone");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(loadBrand()).resolves.toBe(false);
    expect(brandName()).toBe("Keystone");
  });

  it("gives up after the timeout", async () => {
    vi.stubGlobal("fetch", vi.fn((_u: string, init?: RequestInit) => new Promise((_r, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    })));
    await expect(loadBrand(20)).resolves.toBe(false);
    expect(brandName()).toBe("Keystone");
  });
});
