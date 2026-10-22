// KS_PORTAL_v3_PLANS - the dialog shown when the server refuses a request with 402 feature_not_in_plan.
import { useEffect, useState } from "react";
import { onUpsell, type UpsellRequest } from "@/plans/upsell";
import { LockedFeature } from "@/plans/FeatureGate";

export default function UpsellHost() {
  const [req, setReq] = useState<UpsellRequest | null>(null);
  useEffect(() => onUpsell(setReq), []);
  if (!req) return null;
  const close = () => setReq(null);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Not in your plan"
      data-testid="plan-upsell-dialog"
      onClick={close}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(2,8,23,0.55)", display: "grid", placeItems: "center", padding: 16 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 560 }}>
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          style={{ position: "absolute", top: 8, right: 10, zIndex: 1, border: "none", background: "transparent", color: "var(--ui-text)", fontSize: 22, cursor: "pointer", lineHeight: 1 }}
        >
          ×
        </button>
        <p style={{ margin: "0 0 8px", color: "#ffffff", fontSize: 14, fontWeight: 600 }}>This isn&apos;t included in your plan yet.</p>
        <LockedFeature feature={req.feature} planOverride={req.required_plan} trialAvailableOverride={req.trial_available} onDone={close} />
      </div>
    </div>
  );
}
