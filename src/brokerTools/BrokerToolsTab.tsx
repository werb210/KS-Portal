// KS_BROKER_TOOLS - the broker tools tabs on an application. Keystone: each panel sits behind its plan feature
// (a locked card explains the plan that includes it).
import FeatureGate from "@/plans/FeatureGate";
import FundingConditionsPanel from "./FundingConditionsPanel";

export const BROKER_TOOL_TABS = [
  { key: "funding", label: "Funding" },
] as const;

export type BrokerToolTab = (typeof BROKER_TOOL_TABS)[number]["key"];

export default function BrokerToolsTab({ tab, applicationId }: { tab: BrokerToolTab; applicationId: string; application?: Record<string, any> | null }) {
  if (tab === "funding") {
    return <FeatureGate feature="funding_conditions"><FundingConditionsPanel applicationId={applicationId} /></FeatureGate>;
  }
  return null;
}
