// KS_PORTAL_SSO_API_KEYS - the sign-in page's single sign-on buttons: only the providers the server says are on, links
// to the server's /start, hidden in the iPad app; the one-time code coming back is exchanged once and stored as the
// session; refusals are shown in plain words.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/config/api", () => ({ API_BASE: "https://server.test" }));

import SsoButtons from "../SsoButtons";
import { exchangeSsoCode, fetchSsoConfig, readSsoReturn, ssoErrorText } from "../sso";
import { getAuthToken, clearAuthToken } from "@/lib/authToken";

const cfg = (c: Partial<{ microsoft: boolean; google: boolean; require_sso: boolean }>) => async () => ({ microsoft: false, google: false, require_sso: false, ...c });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  window.history.replaceState(null, "", "/login");
  clearAuthToken();
});
afterEach(() => vi.unstubAllGlobals());

describe("SsoButtons", () => {
  it("shows nothing when no provider is switched on", async () => {
    const load = vi.fn(cfg({}));
    const { container } = render(<SsoButtons loadConfig={load} native={false} />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a button per switched-on provider, linking to the server's start address", async () => {
    render(<SsoButtons loadConfig={cfg({ microsoft: true, google: true })} native={false} />);
    const ms = await screen.findByRole("link", { name: /sign in with microsoft/i });
    expect(ms).toHaveAttribute("href", "https://server.test/api/auth/sso/microsoft/start");
    expect(screen.getByRole("link", { name: /sign in with google/i })).toHaveAttribute("href", "https://server.test/api/auth/sso/google/start");
  });

  it("only Google when only Google is on, with the require-SSO note", async () => {
    render(<SsoButtons loadConfig={cfg({ google: true, require_sso: true })} native={false} />);
    await screen.findByRole("link", { name: /sign in with google/i });
    expect(screen.queryByRole("link", { name: /microsoft/i })).toBeNull();
    expect(screen.getByText(/admins can still use a text code/i)).toBeInTheDocument();
  });

  it("is hidden in the iPad app", async () => {
    const load = vi.fn(cfg({ microsoft: true }));
    const { container } = render(<SsoButtons loadConfig={load} native />);
    expect(container).toBeEmptyDOMElement();
    expect(load).not.toHaveBeenCalled();
  });

  it("exchanges the one-time code from the address once and removes it from the address bar", async () => {
    window.history.replaceState(null, "", "/login#sso_code=abc123");
    const exchange = vi.fn(async () => undefined);
    const onSignedIn = vi.fn();
    render(<SsoButtons loadConfig={cfg({})} exchange={exchange} onSignedIn={onSignedIn} native={false} />);
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(exchange).toHaveBeenCalledTimes(1);
    expect(exchange).toHaveBeenCalledWith("abc123");
    expect(window.location.hash).toBe("");
  });

  it("shows the refusal from the server in plain words", async () => {
    window.history.replaceState(null, "", "/login?sso_error=user_inactive");
    render(<SsoButtons loadConfig={cfg({ microsoft: true })} native={false} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This account has been switched off. Ask an admin.");
  });
});

describe("sso helpers", () => {
  it("fetchSsoConfig: true only for an explicit true; any failure means no buttons", async () => {
    expect(await fetchSsoConfig((async () => json({ ok: true, microsoft: true, google: "yes" })) as unknown as typeof fetch)).toEqual({ microsoft: true, google: false, require_sso: false });
    expect(await fetchSsoConfig((async () => json({}, 500)) as unknown as typeof fetch)).toEqual({ microsoft: false, google: false, require_sso: false });
    expect(await fetchSsoConfig((async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toEqual({ microsoft: false, google: false, require_sso: false });
  });

  it("exchangeSsoCode stores the session token, and explains an expired code", async () => {
    const f = vi.fn(async () => json({ status: "ok", data: { token: "tok-1" } }));
    await exchangeSsoCode("c1", f as unknown as typeof fetch);
    expect(getAuthToken()).toBe("tok-1");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://server.test/api/auth/sso/exchange");
    expect(JSON.parse(String(init.body))).toEqual({ code: "c1" });
    await expect(exchangeSsoCode("c2", (async () => json({ message: "That sign-in link has expired. Please sign in again." }, 401)) as unknown as typeof fetch))
      .rejects.toThrow(/expired/);
  });

  it("reads the code from the fragment and the error from the query", () => {
    expect(readSsoReturn({ hash: "#sso_code=x1", search: "" })).toEqual({ code: "x1", error: null });
    expect(readSsoReturn({ hash: "", search: "?sso_error=wrong_tenant" })).toEqual({ code: null, error: "wrong_tenant" });
    expect(ssoErrorText("something_new")).toMatch(/didn't work/);
  });
});
