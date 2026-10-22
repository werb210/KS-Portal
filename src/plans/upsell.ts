// KS_PORTAL_v3_PLANS - a server route answered 402 feature_not_in_plan. The api client calls reportPlanRefusal(); the
// upsell dialog (UpsellHost, mounted in AppLayout) listens and shows what the feature is and how to get it. When no
// dialog is mounted (a page outside the main layout) a toast says the same in one line. Nothing here ever throws.
import toast from "react-hot-toast";
import { featureInfo, includedInText, isPlanKey, PLAN_LABEL, type PlanKey } from "@/plans/catalogue";

export type UpsellRequest = { feature: string; required_plan: PlanKey | null; trial_available: boolean };

type Listener = (req: UpsellRequest) => void;
const listeners = new Set<Listener>();

export function onUpsell(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function showUpsell(req: UpsellRequest): void {
  if (listeners.size === 0) {
    try {
      const info = featureInfo(req.feature);
      const plan = req.required_plan ?? info?.plan ?? null;
      const name = info?.label ?? "This feature";
      toast.error(plan ? `${name} is not in your plan. ${includedInText(plan)}.` : `${name} is not in your plan.`);
    } catch {
      /* no toaster - nothing else to do */
    }
    return;
  }
  for (const l of listeners) {
    try { l(req); } catch { /* one listener's failure must not stop the others */ }
  }
}

/** Called by the api client for every failed response; acts only on 402 feature_not_in_plan. Returns true when it did.
 *  KS_PORTAL_v4_UPSELL_ON_ACTIONS - only for something the user did (POST/PUT/PATCH/DELETE). A page loading data
 *  in the background (GET) is refused quietly: the page shows its own lock or empty state instead of a pop-up on
 *  every visit. */
export function reportPlanRefusal(status: number, payload: unknown, method: string = "POST"): boolean {
  if (status !== 402 || !payload || typeof payload !== "object") return false;
  if (String(method || "GET").toUpperCase() === "GET") return false;
  const p = payload as Record<string, unknown>;
  if (p.error !== "feature_not_in_plan" && p.code !== "feature_not_in_plan") return false;
  const feature = typeof p.feature === "string" ? p.feature : "";
  showUpsell({
    feature,
    required_plan: isPlanKey(p.required_plan) ? p.required_plan : featureInfo(feature)?.plan ?? null,
    trial_available: p.trial_available === true,
  });
  return true;
}

export const planName = (p: PlanKey | null | undefined): string => (p ? PLAN_LABEL[p] : "");
