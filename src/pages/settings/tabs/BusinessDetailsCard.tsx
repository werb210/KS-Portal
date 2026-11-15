// KS_PORTAL_SETUP_BUSINESS_DETAILS_v1 - the short sign-up asks only for a name, email and mobile. The business address,
// business number, kind of business and job title are asked for here, in set-up, because the phone lines need the
// address. Saving registers it with the phone system; nobody waits on Keystone staff.
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { api } from "@/api";

export type BusinessDetails = {
  company_name: string; legal_name: string; address_line1: string; address_line2: string; city: string; province_state: string;
  postal_code: string; country: "CA" | "US"; business_number: string; business_type: string; contact_title: string;
  business_types: string[]; complete: boolean; missing: string; address_registered: boolean;
};
type Reply = { ok?: boolean; ops_ready?: boolean; message?: string; details?: BusinessDetails | null; errors?: Record<string, string> };

const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];
export const KIND_LABELS: Record<string, string> = {
  corporation: "Corporation", llc: "LLC", partnership: "Partnership", sole_proprietor: "Sole proprietor", non_profit: "Non-profit", cooperative: "Co-operative",
};

const input: CSSProperties = { padding: "8px 10px", border: "1px solid var(--ui-border)", borderRadius: 6, fontSize: 14, background: "var(--ui-surface-strong)", color: "var(--ui-text)", width: "100%", boxSizing: "border-box", minHeight: 40 };
const label: CSSProperties = { display: "block", fontSize: 13, color: "var(--ui-text)", fontWeight: 600, marginBottom: 4 };
const hint: CSSProperties = { fontSize: 12, color: "var(--ui-text-muted)", fontWeight: 400 };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 12 };
const box: CSSProperties = { border: "1px solid var(--ui-border)", borderRadius: 10, padding: 14, background: "var(--ui-surface-strong)", margin: "12px 0" };
const primary: CSSProperties = { padding: "9px 18px", border: 0, borderRadius: 8, background: "var(--ui-accent, #0B1F3A)", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600, minHeight: 40 };
const quiet: CSSProperties = { padding: "7px 14px", border: "1px solid var(--ui-border)", borderRadius: 6, background: "transparent", color: "var(--ui-text)", cursor: "pointer", fontSize: 14 };

const EMPTY = { legal_name: "", address_line1: "", address_line2: "", city: "", province_state: "", postal_code: "", country: "CA" as "CA" | "US", business_number: "", business_type: "", contact_title: "" };
type Form = typeof EMPTY;

function errorsOf(e: unknown): { errors: Record<string, string>; message: string } {
  const d = (e as { details?: Reply })?.details;
  return { errors: d?.errors ?? {}, message: d?.message || (d?.errors ? "Please fix the highlighted fields." : "Your details could not be saved. Please try again.") };
}

export default function BusinessDetailsCard({ onSaved }: { onSaved?: () => void }) {
  const [details, setDetails] = useState<BusinessDetails | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  function take(d: BusinessDetails | null | undefined) {
    if (!d) return;
    setDetails(d);
    setForm({
      legal_name: d.legal_name || d.company_name || "", address_line1: d.address_line1, address_line2: d.address_line2, city: d.city,
      province_state: d.province_state, postal_code: d.postal_code, country: d.country, business_number: d.business_number,
      business_type: d.business_type, contact_title: d.contact_title,
    });
    setOpen(!d.complete);
  }

  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => api.get<Reply>("/api/business-details"))
      .then((r) => { if (!live) return; const b = (r ?? {}) as Reply; setReady(b.ops_ready !== false && Boolean(b.details)); take(b.details); })
      .catch(() => { if (live) setReady(false); });
    return () => { live = false; };
  }, []);

  // Not a Keystone-hosted brokerage, or operations could not be reached: nothing to show, the page works as before.
  if (!ready || !details) return null;

  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const regions = form.country === "US" ? STATES : PROVINCES;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErrors({}); setMsg(null);
    try {
      const r = (await api.put<Reply>("/api/business-details", form)) as Reply;
      take(r.details);
      setMsg(r.message || "Saved.");
      setOpen(false);
      onSaved?.();
    } catch (err) {
      const x = errorsOf(err);
      setErrors(x.errors); setMsg(x.message);
    } finally {
      setBusy(false);
    }
  }

  const field = (k: keyof Form, text: string, extra?: { hint?: string; placeholder?: string; autoComplete?: string }) => (
    <div>
      <label style={label} htmlFor={`bd-${k}`}>{text} {extra?.hint ? <span style={hint}>{extra.hint}</span> : null}</label>
      <input id={`bd-${k}`} style={input} value={form[k]} onChange={set(k)} placeholder={extra?.placeholder} autoComplete={extra?.autoComplete}
        aria-invalid={errors[k] ? true : undefined} aria-describedby={errors[k] ? `bd-${k}-err` : undefined} />
      {errors[k] ? <div id={`bd-${k}-err`} role="alert" style={{ fontSize: 13, color: "var(--ui-danger, #b42318)", marginTop: 4 }}>{errors[k]}</div> : null}
    </div>
  );

  if (!open) {
    return (
      <div data-testid="business-details" style={box}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ui-text)" }}>Your business address</div>
            <div style={{ fontSize: 14, color: "var(--ui-text)" }}>
              {[details.address_line1, details.address_line2, details.city, details.province_state, details.postal_code].filter(Boolean).join(", ")}
            </div>
            <div style={hint}>{details.address_registered ? "On file with the phone system." : "Saved. It is added to the phone system by itself."}</div>
          </div>
          <button type="button" style={quiet} onClick={() => { setOpen(true); setMsg(null); }}>Change</button>
        </div>
        {msg ? <p role="status" style={{ fontSize: 14, color: "var(--ui-text)", margin: "8px 0 0" }}>{msg}</p> : null}
      </div>
    );
  }

  return (
    <form data-testid="business-details" style={box} onSubmit={save} noValidate>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ui-text)" }}>
        {details.complete ? "Your business address" : "Add your business address to finish your phone set-up"}
      </div>
      <p style={{ fontSize: 14, color: "var(--ui-text)", margin: "4px 0 0" }}>
        Phone companies need a business address before texting can be turned on, and for some numbers. It takes a minute and you only do it once.
      </p>
      <div style={grid}>
        {field("address_line1", "Street address", { autoComplete: "address-line1" })}
        {field("address_line2", "Unit or suite", { hint: "(if you have one)", autoComplete: "address-line2" })}
        {field("city", "City", { autoComplete: "address-level2" })}
        <div>
          <label style={label} htmlFor="bd-country">Country</label>
          <select id="bd-country" style={input} value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value === "US" ? "US" : "CA", province_state: "" }))}>
            <option value="CA">Canada</option>
            <option value="US">United States</option>
          </select>
        </div>
        <div>
          <label style={label} htmlFor="bd-province_state">{form.country === "US" ? "State" : "Province or territory"}</label>
          <select id="bd-province_state" style={input} value={form.province_state} onChange={set("province_state")} aria-invalid={errors.province_state ? true : undefined}>
            <option value="">Choose...</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {errors.province_state ? <div role="alert" style={{ fontSize: 13, color: "var(--ui-danger, #b42318)", marginTop: 4 }}>{errors.province_state}</div> : null}
        </div>
        {field("postal_code", form.country === "US" ? "ZIP code" : "Postal code", { autoComplete: "postal-code" })}
      </div>
      <div style={grid}>
        {field("legal_name", "Legal business name", { hint: "(if different from your company name)" })}
        {field("business_number", form.country === "US" ? "EIN" : "Business number", { hint: "(you can add this later)" })}
        <div>
          <label style={label} htmlFor="bd-business_type">Kind of business <span style={hint}>(you can add this later)</span></label>
          <select id="bd-business_type" style={input} value={form.business_type} onChange={set("business_type")}>
            <option value="">Choose...</option>
            {(details.business_types?.length ? details.business_types : Object.keys(KIND_LABELS)).map((k) => <option key={k} value={k}>{KIND_LABELS[k] ?? k}</option>)}
          </select>
        </div>
        {field("contact_title", "Your job title", { hint: "(you can add this later)", autoComplete: "organization-title" })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 14 }}>
        <button type="submit" style={{ ...primary, opacity: busy ? 0.7 : 1 }} disabled={busy}>{busy ? "Saving..." : "Save"}</button>
        {details.complete ? <button type="button" style={quiet} onClick={() => { setOpen(false); setErrors({}); setMsg(null); }}>Cancel</button> : null}
        {msg ? <span role={Object.keys(errors).length ? "alert" : "status"} style={{ fontSize: 14, color: "var(--ui-text)" }}>{msg}</span> : null}
      </div>
    </form>
  );
}
