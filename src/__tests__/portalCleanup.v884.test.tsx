// BF_PORTAL_v884_PORTAL_CLEANUP - behaviour tests for the 2026-11-02 portal review fixes: Quotes (option count, unsaved
// work, send reason), Funding conditions (template refresh, no-offer reason, field error), credit summary markdown,
// starter call scripts, server setting names kept off staff screens, plain words for codes, number formats, time zone.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(), role: "Staff" }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, put: h.put, patch: h.patch, delete: h.del }, rawApiFetch: vi.fn() }));
vi.mock("@/utils/api", () => ({ apiBlob: vi.fn(async () => new Blob(["%PDF-"])) }));
vi.mock("@/dealTools/ui", async (orig) => ({ ...(await orig<any>()), useIsAdmin: () => h.role === "Admin", useRole: () => h.role }));

import FundingConditionsPanel from "@/brokerTools/FundingConditionsPanel";
import CallScriptsSettings from "@/callScripts/CallScriptsSettings";
import { SetupText, plainSetupText, settingNamesIn, withoutSettingNames } from "@/components/SetupNotice";
import { renderInlineMarkdown } from "@/utils/inlineMarkdown";
import { formatDateTimeShort, formatMoneyValue, groupDigits, humanizeCode, humanizeCodesInText, isInternalCode, stripIpPort, zoneWords } from "@/utils/labels";

beforeEach(() => {
  h.get.mockReset(); h.post.mockReset(); h.put.mockReset(); h.patch.mockReset(); h.del.mockReset(); h.role = "Staff";
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

// KS: the Quotes, Funding conditions and Server-setting-name blocks are left out - KS keeps its own (plan-gated)
// versions of those screens.
describe("Credit summary text (v884)", () => {
  it("renders **bold** as bold, never the asterisks", () => {
    render(<div data-testid="t" style={{ whiteSpace: "pre-wrap" }}>{renderInlineMarkdown("**Special Situation**\nThe file has a *prior* payout issue.\n## Public Search")}</div>);
    const box = screen.getByTestId("t");
    expect(box.textContent).not.toContain("*");
    expect(box.textContent).not.toContain("#");
    expect(within(box).getByText("Special Situation").tagName).toBe("STRONG");
    expect(within(box).getByText("prior").tagName).toBe("EM");
    expect(within(box).getByText("Public Search").tagName).toBe("STRONG");
  });
});

// ------------------------------------------------------------------------------------------------ 4. call scripts
describe("Settings > Call scripts (v884)", () => {
  it("hides 'Add starter intake scripts' once the starter scripts exist", async () => {
    const script = { id: "s1", silo: "BF", name: "Intake - term loan", description: null, use_for: "any", sections: [], position: 0, archived_at: null };
    h.get.mockResolvedValue({ silo: "BF", scripts: [script], question_types: [], custom_fields: {} });
    render(<CallScriptsSettings />);
    expect(await screen.findByTestId("starters-added")).toHaveTextContent("already added");
    expect(screen.queryByRole("button", { name: "Add starter intake scripts" })).toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------ 6. setting names
describe("Plain words and numbers (v884)", () => {
  it("turns codes into words", () => {
    expect(humanizeCode("application_started")).toBe("Application started");
    expect(humanizeCode("contact_form")).toBe("Contact form");
    expect(humanizeCode("TERM_LOAN")).toBe("Term loan");
    expect(humanizeCode("LINE_OF_CREDIT")).toBe("Line of credit");
    expect(humanizeCode("MERCHANT_CASH_ADVANCE")).toBe("Merchant cash advance");
    expect(humanizeCode("SBA_GOVERNMENT")).toBe("SBA / Government");
    expect(humanizeCode("EQUIPMENT")).toBe("Equipment finance");
    expect(humanizeCode("TERM")).toBe("Term loan");
    expect(humanizeCode("client_direct")).toBe("Client (direct)");
    expect(humanizeCode("personal_net_worth")).toBe("Personal net worth statement");
    expect(humanizeCode("pending_payment")).toBe("Waiting for payment");
    expect(humanizeCode("canceled")).toBe("Cancelled");
    expect(humanizeCode("Already plain words")).toBe("Already plain words");
    expect(humanizeCodesInText("Status changed from pending_payment to canceled")).toBe("Status changed from waiting for payment to cancelled");
    expect(isInternalCode("exp--abc123")).toBe(true);
    expect(isInternalCode("BIGBROKER")).toBe(false);
  });

  it("formats money, IP addresses, dates and typed amounts", () => {
    expect(formatMoneyValue("2200000")).toBe("$2,200,000");
    expect(formatMoneyValue("230436.87")).toBe("$230,436.87");
    expect(formatMoneyValue("Receivable (A/R)")).toBe("Receivable (A/R)");
    expect(groupDigits("2200000")).toBe("2,200,000");
    expect(groupDigits("1234.5")).toBe("1,234.5");
    expect(stripIpPort("70.65.192.23:63761")).toBe("70.65.192.23");
    expect(stripIpPort("[2001:db8::1]:443")).toBe("2001:db8::1");
    expect(stripIpPort("2001:db8::1")).toBe("2001:db8::1");
    expect(formatDateTimeShort("2026-11-02T21:11:13Z")).not.toMatch(/:\d\d:\d\d/);
  });

  it("names Alberta's time zone the way staff expect", () => {
    expect(zoneWords("America/Regina", "Alberta time")).toBe("Alberta time (America/Edmonton)");
    expect(zoneWords("Etc/GMT+6", "Alberta time")).toBe("Alberta time (America/Edmonton)");
    expect(zoneWords("America/Toronto", "Ontario time")).toBe("Ontario time (America/Toronto)");
  });
});
