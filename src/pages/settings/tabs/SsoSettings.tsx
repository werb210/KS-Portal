// KS_PORTAL_SSO_API_KEYS - Settings > Single sign-on (Admins, Pro). Switch "Sign in with Microsoft" / "Sign in with
// Google" on or off, optionally limit them to the company's Microsoft tenant or Google Workspace domain, and optionally
// require staff to use single sign-on (Admins can still use a text code or passkey, in case SSO is down).
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api";
import { useAuth } from "@/hooks/useAuth";

export type SsoProviderStatus = { configured: boolean; enabled: boolean; available: boolean; redirect_uri: string | null };
export type SsoSettingsBody = {
  settings: { microsoft_enabled: boolean; google_enabled: boolean; microsoft_tenant_id: string; google_hosted_domain: string; require_sso: boolean };
  providers: { microsoft: SsoProviderStatus; google: SsoProviderStatus };
  require_sso_active: boolean;
};

export const SSO_SETTINGS_KEY = ["settings", "sso"] as const;

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16, maxWidth: 760 };
const h3: CSSProperties = { margin: "0 0 8px", fontSize: 16, color: "var(--ui-text)" };
const text: CSSProperties = { margin: "0 0 10px", fontSize: 13, lineHeight: 1.5, color: "var(--ui-text)" };
const label: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ui-text)", margin: "10px 0 4px" };
const input: CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface)", color: "var(--ui-text)", fontSize: 13, width: "100%", maxWidth: 420, boxSizing: "border-box" };
const check: CSSProperties = { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, fontWeight: 600, color: "var(--ui-text)", cursor: "pointer" };
const button: CSSProperties = { padding: "8px 16px", borderRadius: 8, border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#ffffff", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const notice: CSSProperties = { margin: "6px 0 0", padding: "8px 10px", borderRadius: 8, background: "#fef3c7", color: "#78350f", fontSize: 13 };
const errorBox: CSSProperties = { marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "#fee2e2", color: "#7f1d1d", fontSize: 13 };
const okBox: CSSProperties = { marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "#dcfce7", color: "#14532d", fontSize: 13 };

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message && e.message !== "API_ERROR" ? e.message : fallback);

function ProviderSection({ name, status, enabled, onEnabled, restrictLabel, restrictHelp, restrictPlaceholder, restrict, onRestrict, inputId }: {
  name: string; status: SsoProviderStatus; enabled: boolean; onEnabled: (v: boolean) => void;
  restrictLabel: string; restrictHelp: string; restrictPlaceholder: string; restrict: string; onRestrict: (v: string) => void; inputId: string;
}) {
  return (
    <section style={card} aria-label={`${name} sign-in`} data-testid={`sso-section-${name.toLowerCase()}`}>
      <h3 style={h3}>{name}</h3>
      <label style={check}>
        <input type="checkbox" checked={enabled} disabled={!status.configured} onChange={(e) => onEnabled(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Show &ldquo;Sign in with {name}&rdquo; on the staff sign-in page</span>
      </label>
      {!status.configured ? (
        <p style={notice}>{name} sign-in isn&rsquo;t set up on this server yet. Ask Keystone support to add it.</p>
      ) : (
        <>
          <label htmlFor={inputId} style={label}>{restrictLabel}</label>
          <input id={inputId} style={input} value={restrict} placeholder={restrictPlaceholder} onChange={(e) => onRestrict(e.target.value)} />
          <p style={{ ...text, marginTop: 6 }}>{restrictHelp}</p>
          {/* KS_PORTAL_M365_ONE_CLICK - Keystone registers the redirect address itself; nothing for the company to copy. */}
        </>
      )}
    </section>
  );
}

export default function SsoSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: SSO_SETTINGS_KEY,
    queryFn: () => api.get<SsoSettingsBody>("/api/sso-settings"),
    enabled: isAdmin,
  });
  const [form, setForm] = useState<SsoSettingsBody["settings"] | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  useEffect(() => { if (q.data?.settings) setForm(q.data.settings); }, [q.data]);

  const save = useMutation({
    mutationFn: (next: SsoSettingsBody["settings"]) => api.put<SsoSettingsBody>("/api/sso-settings", next),
    onSuccess: (body) => {
      qc.setQueryData(SSO_SETTINGS_KEY, body);
      setOk("Single sign-on settings saved.");
    },
  });

  if (!isAdmin) return null;
  if (q.isLoading || (!form && !q.isError)) return <p style={text}>Loading single sign-on settings…</p>;
  if (q.isError || !q.data || !form) return <p style={errorBox} role="alert">{errText(q.error, "Could not load the single sign-on settings.")}</p>;

  const p = q.data.providers;
  const set = (patch: Partial<SsoSettingsBody["settings"]>) => { setOk(null); setForm({ ...form, ...patch }); };
  const anyOn = (form.microsoft_enabled && p.microsoft.configured) || (form.google_enabled && p.google.configured);
  const onSubmit = (e: FormEvent) => { e.preventDefault(); setOk(null); save.mutate(form); };

  return (
    <form onSubmit={onSubmit} data-testid="sso-settings">
      <section style={card}>
        <h3 style={h3}>Single sign-on</h3>
        <p style={text}>
          Let staff sign in with their work Microsoft or Google account. They are matched to their staff account by email:
          nobody new is added, and switched-off staff can&rsquo;t sign in. Every single sign-on sign-in, and every refused one,
          is recorded in the audit log.
        </p>
      </section>
      <ProviderSection
        name="Microsoft" status={p.microsoft} enabled={form.microsoft_enabled} onEnabled={(v) => set({ microsoft_enabled: v })}
        restrictLabel="Only allow this Microsoft tenant (directory ID, optional)" restrictPlaceholder="e.g. 3f2504e0-4f89-11d3-9a0c-0305e82c3301"
        restrictHelp="Usually not needed: once Microsoft 365 is connected (Settings > Connections), only accounts from your organisation can sign in. When set, accounts from other organisations are refused."
        restrict={form.microsoft_tenant_id} onRestrict={(v) => set({ microsoft_tenant_id: v.trim() })} inputId="sso-ms-tenant"
      />
      <ProviderSection
        name="Google" status={p.google} enabled={form.google_enabled} onEnabled={(v) => set({ google_enabled: v })}
        restrictLabel="Only allow this Google Workspace domain (optional)" restrictPlaceholder="e.g. yourcompany.com"
        restrictHelp="When set, only Google Workspace accounts on this domain can sign in (personal Gmail accounts are refused)."
        restrict={form.google_hosted_domain} onRestrict={(v) => set({ google_hosted_domain: v.trim() })} inputId="sso-google-domain"
      />
      <section style={card}>
        <h3 style={h3}>Require single sign-on</h3>
        <label style={check}>
          <input type="checkbox" checked={form.require_sso} disabled={!anyOn && !form.require_sso} onChange={(e) => set({ require_sso: e.target.checked })} style={{ marginTop: 3 }} />
          <span>Staff must sign in with Microsoft or Google</span>
        </label>
        <p style={{ ...text, marginTop: 6 }}>
          Text codes and passkeys stop working for staff. Admins can still sign in with a text code or passkey, so you are never
          locked out if Microsoft or Google is down. The iPhone dialler and the iPad app sign in with a text code, so staff
          (other than Admins) can&rsquo;t sign in to them while this is on.
        </p>
        {!anyOn ? <p style={notice}>Turn on Microsoft or Google above before requiring single sign-on.</p> : null}
      </section>
      <button type="submit" style={button} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save single sign-on settings"}</button>
      {save.isError ? <p style={errorBox} role="alert">{errText(save.error, "Could not save the settings.")}</p> : null}
      {ok ? <p style={okBox} role="status">{ok}</p> : null}
    </form>
  );
}
