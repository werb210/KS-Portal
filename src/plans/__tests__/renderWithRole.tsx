// KS_PORTAL_v3_PLANS - render inside a router with a signed-in user of the given role.
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext, type AuthContextValue } from "@/auth/AuthContext";

export function renderWithRole(ui: ReactElement, role: "Admin" | "Staff" | "Ops" | null) {
  const value = {
    user: role ? { id: "u1", role } : null,
    role,
    token: role ? "tok" : null,
    logout: () => undefined,
    clearAuth: () => undefined,
    authenticated: Boolean(role),
    isAuthenticated: Boolean(role),
    authStatus: role ? "authenticated" : "unauthenticated",
    isLoading: false,
    rolesStatus: "ready",
    authReady: true,
    canAccessSilo: () => Boolean(role),
  } as AuthContextValue;
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
  );
}
