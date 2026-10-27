// KS_HUBSPOT_GAPS_1_CALL_SCRIPTS - call scripts where the call happens: a "Call script" panel beside the dialler while
// a call is ringing or live, and a "Call scripts" section on a contact or application. Growth and Pro (call_scripts);
// nothing shows on Starter.
import { useState } from "react";
import { useDialer } from "@/dialer/store";
import { hasFeature, usePlan } from "@/plans/planStore";
import { Section } from "@/settingsPack/ui";
import CallScriptRunner from "./CallScriptRunner";

/** The live call's CallSid when the Voice SDK has one. */
function callSidOf(call: unknown): string | null {
  const sid = (call as { parameters?: { CallSid?: string } } | null)?.parameters?.CallSid;
  return typeof sid === "string" && /^CA[0-9a-f]{32}$/i.test(sid) ? sid : null;
}

export function CallScriptDock() {
  const plan = usePlan();
  const isOpen = useDialer((s) => s.isOpen);
  const minimized = useDialer((s) => s.isMinimized);
  const status = useDialer((s) => s.status);
  const ctx = useDialer((s) => s.ctx);
  const call = useDialer((s) => s.call);
  const [shown, setShown] = useState(true);
  const live = status === "connected" || status === "ringing" || status === "dialing";
  if (!hasFeature("call_scripts", plan) || !isOpen || minimized || !live || ctx.isStaff) return null;
  const key = `${ctx.contactId ?? ""}|${ctx.applicationId ?? ""}`;
  return (
    <aside aria-label="Call script" data-testid="call-script-dock" style={{
      position: "fixed", right: 24 + 380 + 12, bottom: "calc(7rem + env(safe-area-inset-bottom, 0px))", width: 360, maxWidth: "calc(100vw - 440px)",
      maxHeight: "calc(100vh - 48px)", overflowY: "auto", zIndex: 1000, background: "var(--ui-surface-strong)", color: "var(--ui-text)",
      border: "1px solid var(--ui-border)", borderRadius: 16, boxShadow: "0 18px 40px rgba(0,0,0,0.35)", padding: shown ? 14 : 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 14 }}>Call script</strong>
        <button type="button" onClick={() => setShown((v) => !v)} aria-expanded={shown}
          style={{ background: "transparent", border: "1px solid var(--ui-border)", color: "var(--ui-text)", borderRadius: 8, fontSize: 12, padding: "3px 8px", cursor: "pointer" }}>
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {shown && <div style={{ marginTop: 8 }}><CallScriptRunner key={key} compact contact_id={ctx.contactId ?? null} application_id={ctx.applicationId ?? null} call_sid={callSidOf(call)} /></div>}
    </aside>
  );
}

export default function CallScriptsPanel({ contactId, applicationId }: { contactId?: string; applicationId?: string }) {
  const plan = usePlan();
  const [open, setOpen] = useState(false);
  if (!hasFeature("call_scripts", plan)) return null;
  return (
    <Section id="call-scripts" title="Call scripts" intro="Follow a script on a call and keep the answers on the timeline.">
      {open ? <CallScriptRunner contact_id={contactId ?? null} application_id={applicationId ?? null} />
        : <button type="button" onClick={() => setOpen(true)} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Open a call script</button>}
    </Section>
  );
}
