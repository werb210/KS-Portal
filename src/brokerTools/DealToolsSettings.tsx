// KS_BROKER_TOOLS - Settings > Deal tools: the set-up behind the broker tools. Each section sits behind its plan
// feature. Admins edit; staff can look.
import FeatureGate from "@/plans/FeatureGate";
import ConditionTemplatesSettings from "./ConditionTemplatesSettings";

export default function DealToolsSettings({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div data-testid="deal-tools-settings" style={{ maxWidth: 1100 }}>
      <FeatureGate feature="funding_conditions" compact><ConditionTemplatesSettings isAdmin={isAdmin} /></FeatureGate>
    </div>
  );
}
