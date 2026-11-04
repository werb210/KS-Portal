// KS_SETUP_WIZARD - "Set-up 3 of 9" at the top of the sidebar (and the phone menu): opens the set-up wizard.
// SetupWizardHost loads the wizard once the person is signed in and opens it by itself the first time.
import { useEffect } from "react";
import { useSetupStore } from "./setupStore";
import SetupWizard from "./SetupWizard";

export function SetupNavItem({ onOpen }: { onOpen?: () => void }) {
  const wizard = useSetupStore((s) => s.wizard);
  const setOpen = useSetupStore((s) => s.setOpen);
  if (!wizard || wizard.total === 0) return null;
  const pct = Math.round((wizard.done / wizard.total) * 100);
  return (
    <button
      type="button"
      data-testid="setup-nav"
      onClick={() => { onOpen?.(); setOpen(true); }}
      aria-label={`Set-up, ${wizard.done} of ${wizard.total} steps done`}
      style={{
        display: "block", width: "100%", textAlign: "left", padding: "9px 12px", marginBottom: 6, borderRadius: 8,
        border: "1px solid var(--ui-border)", background: "transparent", color: "var(--ui-text)", cursor: "pointer", fontSize: 14,
      }}
    >
      <span style={{ display: "flex", justifyContent: "space-between", gap: 6, fontWeight: 600 }}>
        <span>Set-up</span>
        <span>{wizard.done} of {wizard.total}</span>
      </span>
      <span aria-hidden="true" style={{ display: "block", marginTop: 6, height: 6, borderRadius: 999, background: "var(--ui-surface-muted, #e2e8f0)", overflow: "hidden" }}>
        <span style={{ display: "block", width: `${pct}%`, height: "100%", background: "#2563eb" }} />
      </span>
    </button>
  );
}

export function SetupWizardHost({ enabled }: { enabled: boolean }) {
  const load = useSetupStore((s) => s.load);
  const reset = useSetupStore((s) => s.reset);
  useEffect(() => {
    if (!enabled) { reset(); return; }
    void load({ autoOpen: true });
  }, [enabled, load, reset]);
  if (!enabled) return null;
  return <SetupWizard />;
}
