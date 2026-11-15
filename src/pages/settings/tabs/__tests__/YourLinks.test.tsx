// KS_PORTAL_YOUR_LINKS
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const plan = vi.hoisted(() => ({ on: new Set<string>(["lender_portal"]) }));
vi.mock("@/plans/planStore", () => ({ hasFeature: (k: string) => plan.on.has(k), requiredPlan: () => "growth" }));
vi.mock("@/config/licensee", () => ({ CLIENT_URL: "https://apply.acmebrokers.example/" }));

import YourLinks, { shareLinks } from "../YourLinks";

afterEach(cleanup);

describe("Settings > Your links", () => {
  it("builds every link from the brokerage's own addresses", () => {
    const l = Object.fromEntries(shareLinks("https://portal.acmebrokers.example/", "https://apply.acmebrokers.example/").map((x) => [x.key, x.url]));
    expect(l).toEqual({
      client: "https://apply.acmebrokers.example",
      lender: "https://portal.acmebrokers.example/lender-portal/login",
      "referrer-signup": "https://portal.acmebrokers.example/referrer/signup",
      "referrer-login": "https://portal.acmebrokers.example/referrer/login",
      broker: "https://portal.acmebrokers.example/broker",
      staff: "https://portal.acmebrokers.example/login",
    });
  });

  it("shows each link with who it is for and copies it", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<YourLinks />);
    const client = screen.getByTestId("link-client");
    expect(within(client).getByText("https://apply.acmebrokers.example")).toBeTruthy();
    fireEvent.click(within(client).getByRole("button", { name: "Copy the Client application link" }));
    expect(writeText).toHaveBeenCalledWith("https://apply.acmebrokers.example");
    expect(await within(client).findByText("Copied")).toBeTruthy();
    expect(within(screen.getByTestId("link-lender")).getByText(/\/lender-portal\/login$/)).toBeTruthy();
  });

  it("a portal that is not on the brokerage's plan is named with its plan and has no link to copy", () => {
    render(<YourLinks />);
    const broker = screen.getByTestId("link-broker");
    expect(within(broker).getByText("On the Growth plan")).toBeTruthy();
    expect(within(broker).queryByRole("button")).toBeNull();
    expect(within(broker).queryByText(/\/broker$/)).toBeNull();
  });
});
