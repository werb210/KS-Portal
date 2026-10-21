// BF_PORTAL_BLOCK_v167_SELECTOR_TEST_FIX_v1
// BF_PORTAL_BLOCK_v200_LIVE_TEST_FIXES_v1 — selector now calls
// useNavigate() after setSilo, so every render needs a Router wrapper.
// Updated for v166 button selector. The control is:
//   role="group" aria-label="Active silo"
//     button[aria-pressed=true]  → active silo
//     button[aria-pressed=false] → inactive silos
// SLF is shown again for admins (re-added to the selector).
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import BusinessUnitSelector from "@/components/BusinessUnitSelector";

vi.mock("@/hooks/useSilo", () => ({
  useSilo: () => ({ silo: "bf", setSilo: vi.fn() }),
}));

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// BF_PORTAL_BLOCK_v200_LIVE_TEST_FIXES_v1 — every render goes through
// this helper so the Router context is present for useNavigate().
function renderSelector() {
  return render(
    <MemoryRouter>
      <BusinessUnitSelector />
    </MemoryRouter>,
  );
}

// KS_PORTAL_v1_NO_BI - Keystone has one silo, so every user sees the static label, never a switch.
describe("BusinessUnitSelector", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it.each([
    ["staff with old BI access", { role: "staff", silos: ["BF", "BI"] }],
    ["admin", { role: "admin" }],
    ["staff with one silo", { role: "staff", silos: ["BF"] }],
  ])("shows a static label for %s", (_name, user) => {
    mockUseAuth.mockReturnValue({ user });
    renderSelector();
    expect(screen.queryByRole("group", { name: /active silo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /insurance/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Lending/i)).toBeInTheDocument();
  });
});
