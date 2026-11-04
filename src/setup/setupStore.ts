// KS_SETUP_WIZARD - one copy of the wizard for the whole portal: the Set-up item in the sidebar and the wizard window
// read the same data, so ticking a step off in one updates the other.
import { create } from "zustand";
import { logger } from "@/utils/logger";
import { dismissSetup, fetchSetup, saveStep, type SetupWizard, type StepStatus } from "./setupApi";

/** The wizard opens by itself once per sign-in (this browser tab) until it is finished or closed for good. */
const SHOWN_KEY = "ks.setup.autoShown";

function shownThisSession(): boolean {
  try { return window.sessionStorage.getItem(SHOWN_KEY) === "1"; } catch { return false; }
}
function markShown(): void {
  try { window.sessionStorage.setItem(SHOWN_KEY, "1"); } catch { /* private mode: it may open again next page load */ }
}
export function resetSetupAutoOpenForTests(): void {
  try { window.sessionStorage.removeItem(SHOWN_KEY); } catch { /* ignore */ }
}

type SetupState = {
  wizard: SetupWizard | null;
  open: boolean;
  loading: boolean;
  /** GET /api/setup; opens the wizard the first time in this sign-in if it is not finished or closed for good. */
  load: (opts?: { autoOpen?: boolean }) => Promise<void>;
  setOpen: (open: boolean) => void;
  setStatus: (key: string, status: StepStatus) => Promise<void>;
  dismiss: () => Promise<void>;
  reset: () => void;
};

export const useSetupStore = create<SetupState>((set, get) => ({
  wizard: null,
  open: false,
  loading: false,
  load: async (opts) => {
    set({ loading: true });
    try {
      const wizard = await fetchSetup();
      const autoOpen = Boolean(opts?.autoOpen && wizard && wizard.total > 0 && !wizard.complete && !wizard.dismissed && !shownThisSession());
      if (autoOpen) markShown();
      set({ wizard, loading: false, ...(autoOpen ? { open: true } : {}) });
    } catch (e) {
      logger.warn("[setup] could not load the set-up wizard", { message: (e as Error)?.message });
      set({ loading: false });
    }
  },
  setOpen: (open) => {
    set({ open });
    if (open) void get().load(); // fresh ticks after visiting a settings page
  },
  setStatus: async (key, status) => {
    const wizard = await saveStep(key, status);
    if (wizard) set({ wizard });
  },
  dismiss: async () => {
    const wizard = await dismissSetup();
    set({ open: false, ...(wizard ? { wizard } : {}) });
  },
  reset: () => set({ wizard: null, open: false, loading: false }),
}));
