// KS_LICENSEE_DEPLOY_v1 - a licensee's portal build allows its own KS-server in the Content-Security-Policy.
import { describe, expect, it } from "vitest";
import { DEV_SERVER_HOST, addServer, patchServerIfChanged, serverHost } from "../../../scripts/server-csp.mjs";

describe("scripts/server-csp.mjs", () => {
  it("picks the build's server unless it is the development server", () => {
    expect(serverHost({})).toBe("");
    expect(serverHost({ VITE_API_URL: `https://${DEV_SERVER_HOST}` })).toBe("");
    expect(serverHost({ VITE_API_URL: "https://ks-northwind-server.azurewebsites.net/" })).toBe("ks-northwind-server.azurewebsites.net");
    expect(serverHost({ VITE_API_BASE_URL: "https://api.northwind.example" })).toBe("api.northwind.example");
    expect(serverHost({ VITE_API_URL: "http://insecure.example" })).toBe("");
  });

  it("adds https and wss next to the development server and nowhere else", () => {
    const csp = `default-src 'self'; connect-src 'self' https://${DEV_SERVER_HOST} wss://${DEV_SERVER_HOST}; img-src 'self' data:;`;
    expect(addServer(csp, "s.example")).toBe(
      `default-src 'self'; connect-src 'self' https://${DEV_SERVER_HOST} https://s.example wss://${DEV_SERVER_HOST} wss://s.example; img-src 'self' data:;`,
    );
    expect(addServer(addServer(csp, "s.example"), "s.example")).toBe(addServer(csp, "s.example"));
  });

  it("patches a config for a licensee and leaves it alone for the development copy", () => {
    const committed = JSON.stringify({
      globalHeaders: { "Content-Security-Policy": `default-src 'self'; connect-src 'self' https://${DEV_SERVER_HOST} wss://${DEV_SERVER_HOST}` },
      routes: [{ route: "/x", headers: { "Content-Security-Policy": `img-src 'self' https://${DEV_SERVER_HOST}` } }],
    });
    expect(patchServerIfChanged(committed, "")).toBeNull();
    const patched = patchServerIfChanged(committed, "ks-northwind-server.azurewebsites.net");
    expect(patched).not.toBeNull();
    const policy = JSON.parse(patched as string).globalHeaders["Content-Security-Policy"] as string;
    expect(policy).toContain("https://ks-northwind-server.azurewebsites.net");
    expect(policy).toContain("wss://ks-northwind-server.azurewebsites.net");
    expect(policy).toContain(`https://${DEV_SERVER_HOST}`);
    expect(JSON.parse(patched as string).routes[0].headers["Content-Security-Policy"]).toBe(
      `img-src 'self' https://${DEV_SERVER_HOST} https://ks-northwind-server.azurewebsites.net`,
    );
  });
});
