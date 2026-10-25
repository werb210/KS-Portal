// KS_PORTAL_v6_COMPANY - the licensee's company details as an Admin edits them in Settings -> Company.
// GET /api/licensee/admin (Admin) returns the public details plus the connection ids (Twilio main number, Google Ads
// customer id, Microsoft 365 tenant id). Until the server has that endpoint (404) the form starts from the public
// copy in the brand store and the Connections section is hidden. PUT /api/licensee saves; a 400 carries
// { errors: ["<field> ..."] } which is mapped back onto the form fields.
import { api } from "@/api";
import { getBrand } from "@/config/brand";

export const COMPANY_FIELDS = [
  "company_name", "legal_name", "country", "time_zone",
  "support_email", "support_phone", "mailing_address",
  "logo_url", "primary_color", "accent_color",
  "background_color", "font_family", // KS_PORTAL_v14_BRAND_FONT
  "assistant_name",
  "workspace_provider", // KS_PORTAL_v12_GOOGLE_WORKSPACE - m365 | google | both
] as const;
export const CONNECTION_FIELDS = ["twilio_main_number", "google_ads_customer_id", "office365_tenant_id"] as const;

export type CompanyField = (typeof COMPANY_FIELDS)[number];
export type ConnectionField = (typeof CONNECTION_FIELDS)[number];
export type FormField = CompanyField | ConnectionField;
export type CompanyForm = Record<FormField, string>;

export const FIELD_LABEL: Record<FormField, string> = {
  company_name: "Company name",
  legal_name: "Legal name",
  country: "Country",
  time_zone: "Time zone",
  support_email: "Support email",
  support_phone: "Support phone",
  mailing_address: "Mailing address",
  logo_url: "Logo URL",
  primary_color: "Primary colour",
  accent_color: "Accent colour",
  background_color: "Background colour",
  font_family: "Font",
  assistant_name: "Assistant name",
  workspace_provider: "Email, calendar and files",
  twilio_main_number: "Main phone number (Twilio)",
  google_ads_customer_id: "Google Ads customer ID",
  office365_tenant_id: "Microsoft 365 tenant ID",
};

const ALL_FIELDS: FormField[] = [...COMPANY_FIELDS, ...CONNECTION_FIELDS];

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim());

export function emptyForm(): CompanyForm {
  return Object.fromEntries(ALL_FIELDS.map((f) => [f, ""])) as CompanyForm;
}

function toForm(raw: unknown): CompanyForm {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = emptyForm();
  for (const f of ALL_FIELDS) out[f] = str(r[f]);
  return out;
}

/** The public copy in the brand store, as form values (no connection ids). */
export function formFromBrand(): CompanyForm {
  return toForm(getBrand());
}

const statusOf = (e: unknown): number | null => {
  const s = (e as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : null;
};

export type AdminLoad = { form: CompanyForm; connections: boolean };

/** GET /api/licensee/admin. 404 (or any failure) -> the brand store's public copy, connections hidden. */
export async function loadCompany(): Promise<AdminLoad> {
  try {
    const body = await api.get<unknown>("/api/licensee/admin");
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const lic = b.licensee && typeof b.licensee === "object" ? b.licensee : b;
    if (!lic || typeof lic !== "object" || !("company_name" in (lic as object))) return { form: formFromBrand(), connections: false };
    return { form: toForm(lic), connections: true };
  } catch (e) {
    if (statusOf(e) !== 404) console.warn("[company] could not load the admin licensee details", e);
    return { form: formFromBrand(), connections: false };
  }
}

/** Which field a server message is about: "<field> must ..." or { field, message }. */
export function mapServerErrors(errors: unknown): { fields: Partial<Record<FormField, string>>; general: string[] } {
  const fields: Partial<Record<FormField, string>> = {};
  const general: string[] = [];
  const list = Array.isArray(errors) ? errors : errors ? [errors] : [];
  for (const item of list) {
    let field: string | null = null;
    let message = "";
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      field = str(o.field) || null;
      message = str(o.message) || str(o.error);
    } else {
      message = str(item);
    }
    if (!field) {
      const m = /^([a-z0-9_]+)\b/.exec(message);
      if (m && (ALL_FIELDS as string[]).includes(m[1]!)) field = m[1]!;
    }
    if (field && (ALL_FIELDS as string[]).includes(field)) {
      const f = field as FormField;
      const readable = message.startsWith(field) ? `${FIELD_LABEL[f]}${message.slice(field.length)}` : message || "Check this value.";
      fields[f] = fields[f] ? `${fields[f]} ${readable}` : readable;
    } else if (message) {
      general.push(message);
    }
  }
  return { fields, general };
}

export type SaveResult =
  | { ok: true; licensee: unknown }
  | { ok: false; fields: Partial<Record<FormField, string>>; general: string[] };

/** PUT /api/licensee with the changed fields. */
export async function saveCompany(patch: Partial<CompanyForm>): Promise<SaveResult> {
  try {
    const body = await api.put<unknown>("/api/licensee", patch);
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    return { ok: true, licensee: b.licensee ?? null };
  } catch (e) {
    const status = statusOf(e);
    const details = ((e as { details?: unknown } | null)?.details ?? {}) as Record<string, unknown>;
    if (status === 400 && details.errors) return { ok: false, ...mapServerErrors(details.errors) };
    if (status === 403) return { ok: false, fields: {}, general: ["Only an administrator can change the company details."] };
    return { ok: false, fields: {}, general: ["Could not save the company details. Please try again."] };
  }
}

// ---- colour contrast (WCAG 2.x) ----

function channels(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const raw = m[1]!.length === 3 ? m[1]!.split("").map((c) => c + c).join("") : m[1]!;
  return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16)) as [number, number, number];
}

export function relativeLuminance(hex: string): number | null {
  const c = channels(hex);
  if (!c) return null;
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}

/** Contrast ratio between two #RRGGBB colours (1-21), or null when either is not a colour. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const MIN_CONTRAST = 4.5;

/** Why a primary colour cannot be saved (white text on it below 4.5:1), or null when it reads well. */
export function primaryContrastProblem(primary: string): string | null {
  const r = contrastRatio("#ffffff", primary);
  if (r === null) return null; // format errors are reported separately
  if (r >= MIN_CONTRAST) return null;
  return `White text on this colour has a contrast of ${r.toFixed(2)}:1; at least ${MIN_CONTRAST}:1 is needed so buttons and headings stay readable. Choose a darker primary colour.`;
}

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;
