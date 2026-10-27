// KS_PORTAL_v6_COMPANY - Settings -> Company (Admins only): the licensee's company details, contact details, branding,
// assistant name and connection ids. Saves through PUT /api/licensee; on success the brand store is reloaded so the
// sidebar name and logo change at once. A primary colour that white text cannot be read on (below 4.5:1) is refused.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import toast from "react-hot-toast";
import BrandLogo, { readableTextOn } from "@/components/brand/BrandLogo";
import { applyBrand, loadBrand } from "@/config/brand";
import {
  CONNECTION_FIELDS, FIELD_LABEL, HEX_COLOR, MIN_CONTRAST, contrastRatio, emptyForm, loadCompany, primaryContrastProblem,
  saveCompany, type CompanyForm, type FormField,
} from "@/company/licenseeAdmin";
import { primaryButton, useIsAdmin } from "@/plans/ui";
import FraudProtectionCard from "@/fraud/FraudProtectionCard"; // KS_PORTAL_v7_FRAUD
import QuickBooksCard from "./QuickBooksCard"; // KS_PORTAL_v13_QUICKBOOKS
import { FONT_NAME, contrast as bgContrast, fontStack, googleFontHref } from "@/config/brandTheme"; // KS_PORTAL_v14_BRAND_FONT
import { WORKSPACE_MODE_LABEL, normalizeWorkspaceMode, type WorkspaceMode } from "@/lib/workspace"; // KS_PORTAL_v12_GOOGLE_WORKSPACE

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16 };
const h3: CSSProperties = { margin: "0 0 4px", fontSize: 16, color: "var(--ui-text)" };
const muted: CSSProperties = { color: "var(--ui-text-muted)", fontSize: 13, margin: "0 0 12px" };
const labelStyle: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ui-text)", marginBottom: 4 };
const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--ui-border)",
  background: "var(--ui-surface-input, var(--ui-surface))", color: "var(--ui-text)", fontSize: 14,
};
// Dark text on a light tint: readable on the light and dark portal themes.
const errorBox: CSSProperties = { background: "#fef2f2", color: "#7f1d1d", border: "1px solid #fca5a5", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 6 };
const okBox: CSSProperties = { background: "#ecfdf5", color: "#064e3b", border: "1px solid #6ee7b7", borderRadius: 8, padding: "6px 10px", fontSize: 13, marginTop: 6 };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 };

const TIME_ZONES: string[] = (() => {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    return fn ? fn("timeZone") : [];
  } catch {
    return [];
  }
})();

type Errors = Partial<Record<FormField, string>>;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: "var(--ui-text-muted)", marginTop: 4 }}>{hint}</div>}
      {error && <div role="alert" data-testid={`error-${id.replace(/^company-/, "")}`} style={errorBox}>{error}</div>}
    </div>
  );
}

/** Client-side checks that match the server's, plus the contrast rule. */
export function validateCompany(form: CompanyForm): Errors {
  const e: Errors = {};
  for (const f of ["primary_color", "accent_color"] as const) {
    if (form[f] && !HEX_COLOR.test(form[f])) e[f] = `${FIELD_LABEL[f]} must be a colour like #0B1F3A.`;
  }
  // KS_PORTAL_v14_BRAND_FONT - the background carries dark text in the client app and the light portal theme.
  if (form.background_color) {
    if (!HEX_COLOR.test(form.background_color)) e.background_color = `${FIELD_LABEL.background_color} must be a colour like #F5F8FC.`;
    else if (bgContrast(form.background_color, DARK_TEXT) < MIN_CONTRAST) e.background_color = `${FIELD_LABEL.background_color} is too dark for dark text (needs ${MIN_CONTRAST}:1). Choose a lighter colour.`;
  }
  if (form.font_family && !FONT_NAME.test(form.font_family)) e.font_family = "Choose a font from the list.";
  if (!e.primary_color && form.primary_color) {
    const why = primaryContrastProblem(form.primary_color);
    if (why) e.primary_color = why;
  }
  return e;
}

function ColorField({ field, value, onChange, error }: { field: "primary_color" | "accent_color"; value: string; onChange: (v: string) => void; error?: string }) {
  const valid = HEX_COLOR.test(value);
  const ratio = valid ? contrastRatio("#ffffff", value) : null;
  const passes = ratio !== null && ratio >= MIN_CONTRAST;
  const id = `company-${field}`;
  return (
    <Field id={id} label={FIELD_LABEL[field]} error={error}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="color"
          aria-label={`${FIELD_LABEL[field]} picker`}
          value={valid ? value.toLowerCase() : "#000000"}
          onChange={(ev) => onChange(ev.target.value)}
          style={{ width: 44, height: 36, padding: 0, border: "1px solid var(--ui-border)", borderRadius: 8, background: "transparent", cursor: "pointer" }}
        />
        <input id={id} type="text" value={value} maxLength={7} placeholder="#0B1F3A" onChange={(ev) => onChange(ev.target.value.trim())} style={{ ...inputStyle, maxWidth: 120 }} />
        {valid && (
          <span
            data-testid={`${field}-sample`}
            style={{ padding: "6px 10px", borderRadius: 8, background: value, color: field === "primary_color" ? "#ffffff" : readableTextOn(value), fontSize: 13, fontWeight: 700, border: "1px solid var(--ui-border)" }}
          >
            Sample text
          </span>
        )}
      </div>
      {field === "primary_color" && ratio !== null && (
        <div data-testid="primary-contrast" style={passes ? okBox : errorBox}>
          {passes
            ? `White text on this colour: ${ratio.toFixed(2)}:1 - readable.`
            : `White text on this colour: ${ratio.toFixed(2)}:1 - too faint (needs ${MIN_CONTRAST}:1).`}
        </div>
      )}
    </Field>
  );
}

const DARK_TEXT = "#0B1F3A";
const SYSTEM_FONTS = ["Arial", "Verdana", "Tahoma", "Trebuchet MS", "Georgia", "Times New Roman"];
const GOOGLE_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Source Sans 3", "Nunito Sans", "Poppins", "Raleway", "Work Sans",
  "IBM Plex Sans", "DM Sans", "Public Sans", "Figtree", "Merriweather", "Playfair Display", "Libre Baskerville", "Lora", "Source Serif 4",
];

/** KS_PORTAL_v14_BRAND_FONT - the background colour: dark text sits on it in the client app and the light theme. */
function BackgroundField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const valid = HEX_COLOR.test(value);
  const ratio = valid ? bgContrast(value, DARK_TEXT) : null;
  const id = "company-background_color";
  return (
    <Field id={id} label={FIELD_LABEL.background_color} error={error} hint="Page and panel background in your client app and the portal's light theme. Leave blank for the default.">
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="color" aria-label={`${FIELD_LABEL.background_color} picker`} value={valid ? value.toLowerCase() : "#f5f8fc"} onChange={(ev) => onChange(ev.target.value)}
          style={{ width: 44, height: 36, padding: 0, border: "1px solid var(--ui-border)", borderRadius: 8, background: "transparent", cursor: "pointer" }} />
        <input id={id} type="text" value={value} maxLength={7} placeholder="Default" onChange={(ev) => onChange(ev.target.value.trim())} style={{ ...inputStyle, maxWidth: 120 }} />
        {valid && (
          <span data-testid="background_color-sample" style={{ padding: "6px 10px", borderRadius: 8, background: value, color: DARK_TEXT, fontSize: 13, fontWeight: 700, border: "1px solid var(--ui-border)" }}>
            Sample text
          </span>
        )}
      </div>
      {ratio !== null && !error && (
        <div data-testid="background-contrast" style={ratio >= MIN_CONTRAST ? okBox : errorBox}>
          {ratio >= MIN_CONTRAST ? `Dark text on this colour: ${ratio.toFixed(2)}:1 - readable.` : `Dark text on this colour: ${ratio.toFixed(2)}:1 - too dark (needs ${MIN_CONTRAST}:1).`}
        </div>
      )}
    </Field>
  );
}

/** KS_PORTAL_v14_BRAND_FONT - the font for the client app and the portal: web-safe or Google fonts, with a preview. */
function FontField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const id = "company-font_family";
  useEffect(() => {
    const href = googleFontHref(value);
    if (!href || document.querySelector(`link[data-font-preview="${value}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.fontPreview = value;
    document.head.appendChild(link);
  }, [value]);
  const known = !value || SYSTEM_FONTS.includes(value) || GOOGLE_FONTS.includes(value);
  return (
    <Field id={id} label={FIELD_LABEL.font_family} error={error} hint="Used for the text in your client app and this portal.">
      <select id={id} value={value} onChange={(ev) => onChange(ev.target.value)} style={inputStyle}>
        <option value="">Default</option>
        {!known && <option value={value}>{value} (your website's font)</option>}
        <optgroup label="On every device">{SYSTEM_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>
        <optgroup label="Google Fonts">{GOOGLE_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</optgroup>
      </select>
      <div data-testid="font-sample" style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--ui-border)", fontFamily: value && FONT_NAME.test(value) ? fontStack(value) : "inherit", fontSize: 15 }}>
        Your application is in review. We&apos;ll let you know what comes next.
      </div>
    </Field>
  );
}

export default function CompanySettings() {
  const isAdmin = useIsAdmin();
  const [loaded, setLoaded] = useState(false);
  const [connections, setConnections] = useState(false);
  const [initial, setInitial] = useState<CompanyForm>(emptyForm);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [errors, setErrors] = useState<Errors>({});
  const [general, setGeneral] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let live = true;
    void loadCompany().then((r) => {
      if (!live) return;
      setInitial(r.form);
      setForm(r.form);
      setConnections(r.connections);
      setLoaded(true);
    });
    return () => { live = false; };
  }, [isAdmin]);

  const changed = useMemo(() => {
    const out: Partial<CompanyForm> = {};
    for (const k of Object.keys(form) as FormField[]) {
      if (!connections && (CONNECTION_FIELDS as readonly string[]).includes(k)) continue;
      if (form[k] !== initial[k]) out[k] = form[k];
    }
    return out;
  }, [form, initial, connections]);

  if (!isAdmin) return null;
  if (!loaded) return <p role="status" style={{ color: "var(--ui-text)" }}>Loading company details…</p>;

  const set = (f: FormField) => (v: string) => {
    setForm((prev) => ({ ...prev, [f]: v }));
    setSaved(null);
    setErrors((prev) => {
      if (!prev[f]) return prev;
      const next = { ...prev };
      delete next[f];
      return next;
    });
  };
  const text = (f: FormField, opts: { type?: string; placeholder?: string; hint?: ReactNode; multiline?: boolean; list?: string } = {}) => {
    const id = `company-${f}`;
    return (
      <Field id={id} label={FIELD_LABEL[f]} error={errors[f]} hint={opts.hint}>
        {opts.multiline ? (
          <textarea id={id} value={form[f]} maxLength={200} rows={3} placeholder={opts.placeholder} onChange={(e) => set(f)(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
        ) : (
          <input id={id} type={opts.type ?? "text"} value={form[f]} maxLength={200} placeholder={opts.placeholder} list={opts.list} onChange={(e) => set(f)(e.target.value)} style={inputStyle} />
        )}
      </Field>
    );
  };

  const onSave = async () => {
    setGeneral([]);
    setSaved(null);
    const local = validateCompany(form);
    if (Object.keys(local).length) {
      setErrors(local);
      setGeneral(["Some details need fixing before they can be saved."]);
      return;
    }
    if (Object.keys(changed).length === 0) {
      setSaved("Nothing has changed.");
      return;
    }
    setSaving(true);
    const r = await saveCompany(changed);
    if (!r.ok) {
      setSaving(false);
      setErrors(r.fields);
      setGeneral(r.general.length ? r.general : ["Some details need fixing before they can be saved."]);
      return;
    }
    const fresh = await loadBrand(4000, { fresh: true });
    if (!fresh && r.licensee) applyBrand(r.licensee);
    setInitial(form);
    setErrors({});
    setSaving(false);
    setSaved("Company details saved.");
    try { toast.success("Company details saved."); } catch { /* no toaster */ }
  };

  return (
    <div style={{ maxWidth: 860, color: "var(--ui-text)" }} data-testid="company-settings">
      <h2 style={{ fontSize: 18, margin: "0 0 12px" }}>Company</h2>

      <section style={card} data-testid="company-section-company">
        <h3 style={h3}>Company</h3>
        <p style={muted}>Your trading name appears across the portal, the client app and your emails.</p>
        <div style={grid}>
          {text("company_name")}
          {text("legal_name", { hint: "Used on agreements and invoices. Leave blank to use the company name." })}
          {text("country", { placeholder: "CA", hint: "Two-letter code, e.g. CA or US." })}
          {text("time_zone", { placeholder: "America/Edmonton", list: TIME_ZONES.length ? "company-time-zones" : undefined })}
        </div>
        {TIME_ZONES.length > 0 && (
          <datalist id="company-time-zones">{TIME_ZONES.map((z) => <option key={z} value={z} />)}</datalist>
        )}
      </section>

      <section style={card} data-testid="company-section-contact">
        <h3 style={h3}>Contact</h3>
        <p style={muted}>Shown to clients who need help.</p>
        <div style={grid}>
          {text("support_email", { type: "email", placeholder: "help@example.com" })}
          {text("support_phone", { type: "tel" })}
        </div>
        <div style={{ marginTop: 14 }}>
          {text("mailing_address", {
            multiline: true,
            hint: "Printed in the footer of every marketing email. Canada's anti-spam law (CASL) requires a valid mailing address in commercial emails.",
          })}
        </div>
      </section>

      <section style={card} data-testid="company-section-branding">
        <h3 style={h3}>Branding</h3>
        <p style={muted}>Your logo, colours and font. The preview shows how the logo will look before you save. Values chosen at sign-up arrive here automatically; once you change one, your choice is kept.</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, border: "1px solid var(--ui-border)", marginBottom: 14 }} data-testid="logo-preview">
          <BrandLogo height={44} preview={{ logo_url: /^https:\/\/\S+$/i.test(form.logo_url) ? form.logo_url : "", primary_color: HEX_COLOR.test(form.primary_color) ? form.primary_color : undefined, company_name: form.company_name }} />
          <strong style={{ fontSize: 15 }}>{form.company_name || "Your company"}</strong>
        </div>
        <div style={grid}>
          {text("logo_url", { type: "url", placeholder: "https://example.com/logo.png", hint: "A web address starting with https://. Leave blank to show your initial." })}
        </div>
        <div style={{ ...grid, marginTop: 14 }}>
          <ColorField field="primary_color" value={form.primary_color} onChange={set("primary_color")} error={errors.primary_color} />
          <ColorField field="accent_color" value={form.accent_color} onChange={set("accent_color")} error={errors.accent_color} />
        </div>
        <div style={{ ...grid, marginTop: 14 }}>
          <BackgroundField value={form.background_color} onChange={set("background_color")} error={errors.background_color} />
          <FontField value={form.font_family} onChange={set("font_family")} error={errors.font_family} />
        </div>
      </section>

      <section style={card} data-testid="company-section-assistant">
        <h3 style={h3}>Assistant</h3>
        <p style={muted}>The name your AI assistant uses with staff and clients.</p>
        <div style={grid}>{text("assistant_name")}</div>
      </section>

      {/* KS_PORTAL_v12_GOOGLE_WORKSPACE - which Connect buttons staff see in My Profile. */}
      <section style={card} data-testid="company-section-workspace">
        <h3 style={h3}>Email, calendar and files</h3>
        <p style={muted}>
          Choose the service your team uses for email, calendar, tasks and client folders. Staff connect their own account in
          My Profile. With &ldquo;Both&rdquo;, each person can connect either one; Microsoft 365 is used when someone connects both.
        </p>
        <Field id="company-workspace_provider" label={FIELD_LABEL.workspace_provider} error={errors.workspace_provider}>
          <select
            id="company-workspace_provider"
            value={normalizeWorkspaceMode(form.workspace_provider)}
            onChange={(e) => set("workspace_provider")(e.target.value)}
            style={{ ...inputStyle, maxWidth: 320 }}
          >
            {(Object.keys(WORKSPACE_MODE_LABEL) as WorkspaceMode[]).map((m) => (
              <option key={m} value={m}>{WORKSPACE_MODE_LABEL[m]}</option>
            ))}
          </select>
        </Field>
      </section>

      {connections && (
        <section style={card} data-testid="company-section-connections">
          <h3 style={h3}>Connections</h3>
          <p style={muted}>
            Accounts this copy uses for calls and ads. Microsoft 365 and Google Workspace are connected on the Connections tab
            {/* KS_PORTAL_M365_ONE_CLICK - the tenant is saved by Microsoft's admin approval, never typed. */}
            {" "}(one click, nothing to type).
          </p>
          <div style={grid}>
            {text("twilio_main_number", { type: "tel", placeholder: "+15875550100" })}
            {text("google_ads_customer_id", { placeholder: "123-456-7890" })}
          </div>
        </section>
      )}

      {general.length > 0 && (
        <div role="alert" data-testid="company-general-errors" style={{ ...errorBox, marginBottom: 12 }}>
          {general.map((g) => <div key={g}>{g}</div>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" style={primaryButton} disabled={saving} onClick={() => void onSave()}>
          {saving ? "Saving…" : "Save company details"}
        </button>
        {saved && <span role="status" style={{ fontSize: 14 }}>{saved}</span>}
      </div>

      {/* KS_PORTAL_v7_FRAUD - saves on its own, separate from the company details above. */}
      <div style={{ marginTop: 20 }}><FraudProtectionCard /></div>
      {/* KS_PORTAL_v13_QUICKBOOKS - the licensee's own QuickBooks Online, for media fee invoices. */}
      <div style={{ marginTop: 20 }}><QuickBooksCard /></div>
    </div>
  );
}
