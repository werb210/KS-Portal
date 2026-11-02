// KS_BROKER_TOOLS - the broker tools tabs on an application. Keystone: each panel sits behind its plan feature
// (a locked card explains the plan that includes it).
import Gate from "./gate";
import FundingConditionsPanel from "./FundingConditionsPanel";
import DealDeskTab from "./DealDeskTab"; // KS_BROKER_TOOLS_2

export const BROKER_TOOL_TABS = [
  { key: "funding", label: "Funding" },
  { key: "deal-desk", label: "Deal desk" }, // KS_BROKER_TOOLS_2
] as const;

export type BrokerToolTab = (typeof BROKER_TOOL_TABS)[number]["key"];

export default function BrokerToolsTab({ tab, applicationId }: { tab: BrokerToolTab; applicationId: string; application?: Record<string, any> | null }) {
  if (tab === "funding") {
    return <Gate feature="funding_conditions"><FundingConditionsPanel applicationId={applicationId} /></Gate>;
  }
  if (tab === "deal-desk") return <DealDeskTab applicationId={applicationId} />;
  return null;
}
