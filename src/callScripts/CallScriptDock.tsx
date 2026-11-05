// KS_HUBSPOT_GAPS_1_CALL_SCRIPTS - the "Call scripts" section on a contact or application. Growth and Pro (call_scripts).
// KS_ONE_CALL_SCRIPT - the floating "Call script" box beside the dialler is gone: the dialler shows the same scripts in
// its own "Call script" fold-out (DialerPanel), where the fixed intake script used to be.
import { useState } from "react";
import { hasFeature, usePlan } from "@/plans/planStore";
import { Section } from "@/settingsPack/ui";
import CallScriptRunner from "./CallScriptRunner";

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
