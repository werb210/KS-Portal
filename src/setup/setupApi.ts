// KS_SETUP_WIZARD - the set-up wizard's data (KS-server /api/setup). The server builds each role's list and works out
// which steps are already done from the brokerage's data; the portal only shows it and saves Mark done / Skip.
//   GET /api/setup                                 -> SetupWizard
//   PUT /api/setup/steps/:key { status }           -> SetupWizard   (status: done | skipped | todo)
//   PUT /api/setup/dismiss                         -> SetupWizard   (no longer opens by itself)
import { api } from "@/api";

export type StepStatus = "done" | "todo" | "skipped";
export type SetupStep = {
  key: string;
  title: string;
  why: string;
  /** The existing portal page that does the job, or null when there is none for this role. */
  link: string | null;
  help_slug: string;
  status: StepStatus;
  auto: boolean;
  can_mark_done: boolean;
  optional: boolean;
  external_url: string | null;
};
export type SetupRole = "admin" | "broker" | "marketing";
export type SetupWizard = { role: SetupRole; steps: SetupStep[]; done: number; total: number; complete: boolean; dismissed: boolean };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const isStatus = (v: unknown): v is StepStatus => v === "done" || v === "todo" || v === "skipped";
const isRole = (v: unknown): v is SetupRole => v === "admin" || v === "broker" || v === "marketing";
// Only links inside the portal ("/settings/company"), never another site.
const portalPath = (v: unknown): string | null => (typeof v === "string" && /^\/[a-z0-9/_?=&-]*$/i.test(v) ? v : null);
const httpsUrl = (v: unknown): string | null => (typeof v === "string" && /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : null);

export function toWizard(raw: unknown): SetupWizard | null {
  const b = obj(raw);
  if (!Array.isArray(b.steps)) return null;
  const steps: SetupStep[] = b.steps.map(obj).filter((s) => str(s.key) && str(s.title)).map((s) => ({
    key: str(s.key),
    title: str(s.title),
    why: str(s.why),
    link: portalPath(s.link),
    help_slug: /^[a-z0-9-]{1,120}$/.test(str(s.help_slug)) ? str(s.help_slug) : "",
    status: isStatus(s.status) ? s.status : "todo",
    auto: s.auto === true,
    can_mark_done: s.can_mark_done === true,
    optional: s.optional === true,
    external_url: httpsUrl(s.external_url),
  }));
  const done = steps.filter((s) => s.status === "done").length;
  return {
    role: isRole(b.role) ? b.role : "broker",
    steps,
    done,
    total: steps.length,
    complete: steps.length > 0 && steps.every((s) => s.status !== "todo"),
    dismissed: b.dismissed === true,
  };
}

export async function fetchSetup(): Promise<SetupWizard | null> {
  return toWizard(await api.get<unknown>("/api/setup"));
}

export async function saveStep(key: string, status: StepStatus): Promise<SetupWizard | null> {
  return toWizard(await api.put<unknown>(`/api/setup/steps/${encodeURIComponent(key)}`, { status }));
}

export async function dismissSetup(): Promise<SetupWizard | null> {
  return toWizard(await api.put<unknown>("/api/setup/dismiss", {}));
}

/** A server refusal in plain words (the server's own message when it gave one). */
export function setupError(e: unknown, fallback: string): string {
  const d = obj((e as { details?: unknown } | null)?.details);
  const m = str(d.message) || str(obj(e).message);
  return m && !/^[a-z_]+$/.test(m) && !/^(Request failed|HTTP \d)/i.test(m) ? m : fallback;
}
