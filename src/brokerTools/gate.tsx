// KS_BROKER_TOOLS_2 - each broker tool sits behind its plan feature (a locked card explains the plan that includes it).
import type { ReactNode } from "react";
import FeatureGate from "@/plans/FeatureGate";

export default function Gate({ feature, compact, children }: { feature: string; compact?: boolean; children: ReactNode }) {
  return <FeatureGate feature={feature} compact={compact}>{children}</FeatureGate>;
}
