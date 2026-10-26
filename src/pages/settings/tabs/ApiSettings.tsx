// KS_PORTAL_SSO_API_KEYS - Settings > API (Admins, Pro). Create, name, scope and revoke API keys (a new key is shown
// once - only a hash is kept), see when each was last used, and read the REST API's docs: endpoints, examples and the
// OpenAPI description at a stable address.
import { useState, type CSSProperties, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api";
import { API_BASE } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";

export type ApiKeyRow = {
  id: string; name: string; scope: "read" | "read_write"; key_prefix: string;
  created_by: string | null; created_at: string; last_used_at: string | null; revoked_at: string | null;
};

export const API_KEYS_KEY = ["settings", "api-keys"] as const;
export const PUBLIC_API_PATH = "/api/open/v1";
export const SCOPE_LABEL: Record<ApiKeyRow["scope"], string> = { read: "Read only", read_write: "Read and write" };

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16, maxWidth: 900 };
const h3: CSSProperties = { margin: "0 0 8px", fontSize: 16, color: "var(--ui-text)" };
const h4: CSSProperties = { margin: "14px 0 6px", fontSize: 14, color: "var(--ui-text)" };
const text: CSSProperties = { margin: "0 0 10px", fontSize: 13, lineHeight: 1.5, color: "var(--ui-text)" };
const label: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ui-text)", marginBottom: 4 };
const input: CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface)", color: "var(--ui-text)", fontSize: 13, boxSizing: "border-box" };
const button: CSSProperties = { padding: "8px 16px", borderRadius: 8, border: "1px solid #1d4ed8", background: "#1d4ed8", color: "#ffffff", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const quiet: CSSProperties = { padding: "5px 10px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface-strong)", color: "var(--ui-text)", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const danger: CSSProperties = { ...quiet, border: "1px solid #b91c1c", background: "#b91c1c", color: "#ffffff" };
const cell: CSSProperties = { padding: "7px 10px", borderTop: "1px solid var(--ui-border)", fontSize: 13, color: "var(--ui-text)", textAlign: "left", verticalAlign: "top" };
const mono: CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 };
const pre: CSSProperties = { ...mono, margin: "0 0 10px", padding: 10, borderRadius: 8, background: "#0f172a", color: "#f8fafc", overflowX: "auto", whiteSpace: "pre", lineHeight: 1.5 };
const secretBox: CSSProperties = { padding: 12, borderRadius: 10, background: "#fef3c7", color: "#78350f", border: "1px solid #f59e0b", marginTop: 12 };
const errorBox: CSSProperties = { marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "#fee2e2", color: "#7f1d1d", fontSize: 13 };

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message && e.message !== "API_ERROR" ? e.message : fallback);
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never");

export const ENDPOINTS: Array<{ method: string; path: string; what: string; write?: boolean }> = [
  { method: "GET", path: "/contacts", what: "List contacts (?q= name or email, ?email=)" },
  { method: "GET", path: "/contacts/{id}", what: "One contact" },
  { method: "POST", path: "/contacts", what: "Create a contact: first_name, last_name, email, phone, company_id, job_title", write: true },
  { method: "GET", path: "/companies", what: "List companies (?q=)" },
  { method: "GET", path: "/companies/{id}", what: "One company" },
  { method: "GET", path: "/applications", what: "List applications with their stage (?stage=)" },
  { method: "GET", path: "/applications/{id}", what: "One application with its stage" },
  { method: "PATCH", path: "/applications/{id}/stage", what: "Move to another stage: { \"stage\": \"In Review\" }", write: true },
  { method: "GET", path: "/applications/{id}/notes", what: "An application's notes" },
  { method: "POST", path: "/applications/{id}/notes", what: "Add a note: { \"body\": \"...\" }", write: true },
  { method: "GET", path: "/lenders", what: "List lenders (?active=true)" },
  { method: "GET", path: "/lenders/{id}", what: "One lender" },
];

function KeysCard() {
  const qc = useQueryClient();
  const keys = useQuery({ queryKey: API_KEYS_KEY, queryFn: () => api.get<{ keys: ApiKeyRow[] }>("/api/api-keys") });
  const [name, setName] = useState("");
  const [scope, setScope] = useState<ApiKeyRow["scope"]>("read");
  const [created, setCreated] = useState<{ key: ApiKeyRow; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: (body: { name: string; scope: ApiKeyRow["scope"] }) => api.post<{ key: ApiKeyRow; secret: string }>("/api/api-keys", body),
    onSuccess: (r) => {
      setCreated(r);
      setCopied(false);
      setName("");
      void qc.invalidateQueries({ queryKey: API_KEYS_KEY });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/api/api-keys/${encodeURIComponent(id)}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: API_KEYS_KEY }); },
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name: name.trim(), scope });
  };
  const onRevoke = (k: ApiKeyRow) => {
    const yes = typeof window === "undefined" ? true : window.confirm(`Revoke "${k.name}"? Anything using it stops working straight away.`);
    if (yes) revoke.mutate(k.id);
  };
  const onCopy = async () => {
    if (!created) return;
    try { await navigator.clipboard.writeText(created.secret); setCopied(true); } catch { setCopied(false); }
  };

  const rows = keys.data?.keys ?? [];
  return (
    <section style={card} aria-labelledby="api-keys-h" data-testid="api-keys">
      <h3 id="api-keys-h" style={h3}>API keys</h3>
      <p style={text}>
        A key lets another system read (and, with a read-and-write key, update) your contacts, companies, applications, notes and
        lenders. Treat it like a password. Creating and revoking keys is recorded in the audit log.
      </p>
      <form onSubmit={onCreate} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div>
          <label htmlFor="api-key-name" style={label}>Key name</label>
          <input id="api-key-name" style={{ ...input, width: 240 }} value={name} maxLength={80} placeholder="e.g. Zapier, Accounting sync" onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="api-key-scope" style={label}>Access</label>
          <select id="api-key-scope" style={input} value={scope} onChange={(e) => setScope(e.target.value as ApiKeyRow["scope"])}>
            <option value="read">Read only</option>
            <option value="read_write">Read and write</option>
          </select>
        </div>
        <button type="submit" style={button} disabled={!name.trim() || create.isPending}>{create.isPending ? "Creating…" : "Create key"}</button>
      </form>
      {create.isError ? <p style={errorBox} role="alert">{errText(create.error, "Could not create the key.")}</p> : null}
      {created ? (
        <div style={secretBox} role="status" data-testid="api-key-secret">
          <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 14 }}>Copy &ldquo;{created.key.name}&rdquo; now. You won&rsquo;t see this key again.</p>
          <p style={{ ...mono, margin: "0 0 8px", wordBreak: "break-all", fontSize: 13 }}>{created.secret}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={{ ...quiet, background: "#ffffff", color: "#78350f", border: "1px solid #b45309" }} onClick={() => void onCopy()}>{copied ? "Copied" : "Copy key"}</button>
            <button type="button" style={{ ...quiet, background: "#ffffff", color: "#78350f", border: "1px solid #b45309" }} onClick={() => setCreated(null)}>I&rsquo;ve saved it</button>
          </div>
        </div>
      ) : null}
      {keys.isError ? <p style={errorBox} role="alert">{errText(keys.error, "Could not load the API keys.")}</p> : null}
      {revoke.isError ? <p style={errorBox} role="alert">{errText(revoke.error, "Could not revoke the key.")}</p> : null}
      <div style={{ overflowX: "auto", marginTop: 14 }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Name", "Key", "Access", "Created", "Last used", ""].map((h) => (
                <th key={h} style={{ ...cell, borderTop: "none", fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.isLoading ? (
              <tr><td style={cell} colSpan={6}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td style={cell} colSpan={6}>No API keys yet.</td></tr>
            ) : rows.map((k) => (
              <tr key={k.id} data-testid={`api-key-row-${k.id}`}>
                <td style={cell}>{k.name}</td>
                <td style={{ ...cell, ...mono }}>{k.key_prefix}…</td>
                <td style={cell}>{SCOPE_LABEL[k.scope] ?? k.scope}</td>
                <td style={cell}>{when(k.created_at)}</td>
                <td style={cell}>{when(k.last_used_at)}</td>
                <td style={cell}>
                  {k.revoked_at ? (
                    <span>Revoked {when(k.revoked_at)}</span>
                  ) : (
                    <button type="button" style={danger} disabled={revoke.isPending} onClick={() => onRevoke(k)} aria-label={`Revoke ${k.name}`}>Revoke</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ApiDocs({ base = `${API_BASE}${PUBLIC_API_PATH}` }: { base?: string }) {
  const openapi = `${base}/openapi.json`;
  return (
    <section style={card} aria-labelledby="api-docs-h" data-testid="api-docs">
      <h3 id="api-docs-h" style={h3}>REST API</h3>
      <p style={text}>Base address: <span style={mono}>{base}</span></p>
      <p style={text}>
        Send the key on every request as <span style={mono}>Authorization: Bearer ks_live_…</span>. Answers are JSON. Lists are
        paged with <span style={mono}>limit</span> (1–100, default 25) and <span style={mono}>offset</span>; use{" "}
        <span style={mono}>pagination.next_offset</span> for the next page (null on the last). Each key can make 120 requests a
        minute. Errors look like <span style={mono}>{`{ "error": { "code": "...", "message": "..." } }`}</span>: 401 bad or
        revoked key, 402 the plan no longer includes API access, 403 a read-only key tried to change something, 404 not found,
        429 slow down.
      </p>
      <p style={text}>
        OpenAPI description (for Postman, Zapier and code generators):{" "}
        <a href={openapi} target="_blank" rel="noreferrer" style={{ color: "var(--ui-text)", fontWeight: 600, textDecoration: "underline" }}>{openapi}</a>
      </p>
      <h4 style={h4}>Endpoints</h4>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            {ENDPOINTS.map((e) => (
              <tr key={`${e.method} ${e.path}`}>
                <td style={{ ...cell, ...mono, fontWeight: 700, whiteSpace: "nowrap" }}>{e.method}</td>
                <td style={{ ...cell, ...mono, whiteSpace: "nowrap" }}>{e.path}</td>
                <td style={cell}>{e.what}{e.write ? " (read-and-write key)" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 style={h4}>Examples</h4>
      <pre style={pre}>{`# The first 25 contacts
curl -H "Authorization: Bearer $KS_API_KEY" \\
  "${base}/contacts?limit=25"

# Applications waiting on documents
curl -H "Authorization: Bearer $KS_API_KEY" \\
  "${base}/applications?stage=Documents%20Required"

# Move an application to In Review (read-and-write key)
curl -X PATCH -H "Authorization: Bearer $KS_API_KEY" -H "Content-Type: application/json" \\
  -d '{"stage":"In Review"}' \\
  "${base}/applications/APPLICATION_ID/stage"

# Add a note to an application (read-and-write key)
curl -X POST -H "Authorization: Bearer $KS_API_KEY" -H "Content-Type: application/json" \\
  -d '{"body":"Spoke with the client; statements to follow."}' \\
  "${base}/applications/APPLICATION_ID/notes"`}</pre>
      <p style={text}>Stages: Received, In Review, Documents Required, Additional Steps Required, Off to Lender, Offer, Accepted, Rejected.</p>
    </section>
  );
}

export default function ApiSettings() {
  const { user } = useAuth();
  if (user?.role !== "Admin") return null;
  return (
    <div data-testid="api-settings">
      <KeysCard />
      <ApiDocs />
    </div>
  );
}
