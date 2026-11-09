// KS_PORTAL_BRAND_ASSETS_v1
import { describe, expect, it } from "vitest";
import { BRAND_ASSET_ACCEPT, COMPANY_FIELDS, uploadBrandAsset } from "../licenseeAdmin";

describe("logo and favicon upload", () => {
  it("refuses files over 2 MB before uploading", async () => {
    const big = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" });
    expect(await uploadBrandAsset("logo", big)).toEqual({ ok: false, message: "The file is larger than 2 MB." });
  });
  it("accepts ICO only for the favicon and has a favicon setting", () => {
    expect(BRAND_ASSET_ACCEPT.favicon).toContain("image/x-icon");
    expect(BRAND_ASSET_ACCEPT.logo).not.toContain("icon");
    expect(COMPANY_FIELDS).toContain("favicon_url");
  });
});
