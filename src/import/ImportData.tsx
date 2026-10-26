// KS_PORTAL_v16_DATA_IMPORT - Settings > Import data (Admins): bring records over from HubSpot, Salesforce,
// Pipedrive, a spreadsheet or a Keystone export. Steps: upload, match columns, preview, check (dry run), import
// (a background job with progress), and undo. The server does the work (KS-server /api/data-import).
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  BUSY, EXPORT_PATH, downloadFrom, errorMessage, formatBytes, getBatch, getPresets, getPreview, listBatches, listMappings,
  problemsPath, removeBatch, saveMapping, setMapping, startDryRun, startRun, startUndo, statusText, templatePath, uploadImportFile,
  type Batch, type Counts, type Presets, type Preview, type RecordType, type SavedMapping, type Source,
  createFieldsFromColumns,
} from "./importApi";
import MovingToKeystone from "./MovingToKeystone";

// Dark text on light tints, readable on the light and dark portal themes.
export const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16 };
const h3: CSSProperties = { margin: "0 0 6px", fontSize: 16, color: "var(--ui-text)" };
const muted: CSSProperties = { color: "var(--ui-text-muted)", fontSize: 13, margin: "0 0 12px" };
const label: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ui-text)", marginBottom: 4 };
const input: CSSProperties = {
  boxSizing: "border-box", padding: "7px 9px", borderRadius: 8, border: "1px solid var(--ui-border)",
  background: "var(--ui-surface-input, var(--ui-surface))", color: "var(--ui-text)", fontSize: 14, maxWidth: "100%",
};
const btn: CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface)", color: "var(--ui-text)", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const primary: CSSProperties = { ...btn, background: "#1d4ed8", border: "1px solid #1d4ed8", color: "#ffffff" };
const danger: CSSProperties = { ...btn, background: "#fef2f2", border: "1px solid #fca5a5", color: "#7f1d1d" };
const linkBtn: CSSProperties = { background: "none", border: "none", padding: 0, color: "var(--ui-accent-fg, #1d4ed8)", textDecoration: "underline", cursor: "pointer", fontSize: 13, fontWeight: 600 };
const errorBox: CSSProperties = { background: "#fef2f2", color: "#7f1d1d", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 10px", fontSize: 13, margin: "8px 0" };
const okBox: CSSProperties = { background: "#ecfdf5", color: "#064e3b", border: "1px solid #6ee7b7", borderRadius: 8, padding: "8px 10px", fontSize: 13, margin: "8px 0" };
const warnBox: CSSProperties = { background: "#fffbeb", color: "#78350f", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 10px", fontSize: 13, margin: "8px 0" };
const th: CSSProperties = { textAlign: "left", padding: "6px 8px", fontSize: 12, color: "var(--ui-text-muted)", borderBottom: "1px solid var(--ui-border)", whiteSpace: "nowrap" };
const td: CSSProperties = { padding: "6px 8px", fontSize: 13, color: "var(--ui-text)", borderBottom: "1px solid var(--ui-border)", verticalAlign: "top" };
const row: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" };

const STATUS_CHIP: Record<string, CSSProperties> = {
  completed: { background: "#dcfce7", color: "#14532d" },
  ready: { background: "#dbeafe", color: "#1e3a8a" },
  failed: { background: "#fee2e2", color: "#7f1d1d" },
  undone: { background: "#e2e8f0", color: "#1e293b" },
  uploaded: { background: "#e2e8f0", color: "#1e293b" },
};
const busyChip: CSSProperties = { background: "#fef3c7", color: "#78350f" };

export function StatusChip({ status }: { status: string }) {
  return (
    <span data-testid="import-status" style={{ padding: "1px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", ...(BUSY.has(status) ? busyChip : STATUS_CHIP[status] ?? STATUS_CHIP.uploaded) }}>
      {statusText(status)}
    </span>
  );
}

const SOURCE_HELP: Record<Source, string> = {
  spreadsheet: "Any CSV or Excel (.xlsx) file. Download a template below to see the columns Keystone uses.",
  hubspot: "Export from HubSpot (Contacts, Companies, Deals or Activities: Export, CSV). HubSpot's column names are matched for you.",
  salesforce: "A Salesforce report or Data Loader export as CSV. Salesforce's field names are matched for you.",
  pipedrive: "Pipedrive's Export data (CSV or Excel). Pipedrive's column names are matched for you.",
  keystone: "The .zip of all data from a Keystone portal. Contacts, companies, lenders, products, deals, notes and documents come in together, still linked.",
};

const TYPE_HELP: Record<RecordType, string> = {
  contacts: "Matched to existing contacts by email, then phone number.",
  companies: "Matched to existing companies by name.",
  lenders: "Matched to existing lenders by name.",
  lender_products: "Each product names its lender (by name or old id). Import lenders first, or a missing lender is added.",
  applications: "Pipeline stages are matched to Keystone's stages; you can change any of them in the preview.",
  notes: "Each note needs a contact, company or deal to attach to - import those first.",
  documents: "One .zip with the files and a CSV listing each file, its deal or contact, and its category.",
};

type Step = "home" | "upload" | "map" | "preview" | "job";

function CountsLine({ c, testId }: { c: Partial<Counts> | null | undefined; testId?: string }) {
  if (!c) return null;
  const items: Array<[string, number | undefined, CSSProperties]> = [
    ["created", c.created, { background: "#dcfce7", color: "#14532d" }],
    ["updated", c.updated, { background: "#dbeafe", color: "#1e3a8a" }],
    ["skipped (no change)", c.skipped, { background: "#e2e8f0", color: "#1e293b" }],
    ["with errors", c.errors, { background: "#fee2e2", color: "#7f1d1d" }],
  ];
  return (
    <div data-testid={testId} style={{ ...row, margin: "8px 0" }}>
      {items.map(([name, n, s]) => (
        <span key={name} style={{ ...s, padding: "4px 10px", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>{Number(n ?? 0).toLocaleString()} {name}</span>
      ))}
    </div>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div style={{ margin: "8px 0" }}>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{ height: 10, borderRadius: 999, background: "var(--ui-border)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#1d4ed8", transition: "width .3s" }} />
      </div>
      <div style={{ fontSize: 13, marginTop: 4, color: "var(--ui-text)" }}>{done.toLocaleString()} of {total.toLocaleString()} rows ({pct}%)</div>
    </div>
  );
}

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section style={card} data-testid={testId}>
      <h3 style={h3}>{title}</h3>
      {children}
    </section>
  );
}

const typeLabel = (p: Presets | null, t: string) => (t === "keystone" ? "Keystone export" : p?.record_types.find((r) => r.key === t)?.label ?? t);
const sourceLabel = (p: Presets | null, s: string) => p?.sources.find((x) => x.key === s)?.label ?? s;
const show = (v: unknown) => (v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : String(v));

export default function ImportData() {
  const [presets, setPresets] = useState<Presets | null>(null);
  const [history, setHistory] = useState<Batch[]>([]);
  const [step, setStep] = useState<Step>("home");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Upload
  const [source, setSource] = useState<Source>("spreadsheet");
  const [recordType, setRecordType] = useState<RecordType>("contacts");
  const [file, setFile] = useState<File | null>(null);
  // Mapping
  const [batch, setBatch] = useState<Batch | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [sample, setSample] = useState<Array<Record<string, string>>>([]);
  const [mapping, setMappingState] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<SavedMapping[]>([]);
  const [saveName, setSaveName] = useState("");
  // Preview
  const [preview, setPreview] = useState<Preview | null>(null);
  const [stageMap, setStageMap] = useState<Record<string, string>>({});

  const refreshHistory = useCallback(async () => {
    try { setHistory(await listBatches()); } catch (err) { setError(errorMessage(err, "Your imports could not be loaded.")); }
  }, []);

  useEffect(() => {
    getPresets().then(setPresets).catch((err) => setError(errorMessage(err, "The importer could not be loaded.")));
    void refreshHistory();
  }, [refreshHistory]);

  // While a job runs, poll the batch every 2 seconds.
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (step !== "job" || !batch || !BUSY.has(batch.status)) return;
    const id = batch.id;
    timer.current = setInterval(() => {
      getBatch(id).then((b) => {
        setBatch(b);
        if (!BUSY.has(b.status)) void refreshHistory();
      }).catch((err) => setError(errorMessage(err)));
    }, 2000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [step, batch, refreshHistory]);

  const fields = useMemo(() => presets?.record_types.find((r) => r.key === (batch?.record_type ?? recordType))?.fields ?? [], [presets, batch, recordType]);
  const isKeystone = (batch?.record_type ?? (source === "keystone" ? "keystone" : recordType)) === "keystone";
  // KS_PORTAL_v20_CRM_FIELDS - the record type's custom fields as mapping targets ("cf:<name>").
  const customTargets = useMemo(() => presets?.custom_fields?.[(batch?.record_type ?? recordType) as RecordType] ?? [], [presets, batch, recordType]);
  const canHaveCustom = ["contacts", "companies", "applications"].includes(String(batch?.record_type ?? recordType));
  const [newFieldCols, setNewFieldCols] = useState<Record<string, string>>({}); // column -> field type ("" = guess)
  const unusedColumns = useMemo(() => { const used = new Set(Object.values(mapping)); return columns.filter((c) => !used.has(c)); }, [columns, mapping]);
  const doCreateFields = () => run(async () => {
    if (!batch) return;
    const cols = Object.entries(newFieldCols).map(([column, field_type]) => ({ column, ...(field_type ? { field_type } : {}) }));
    if (!cols.length) throw new Error("Tick the columns to turn into custom fields.");
    const r = await createFieldsFromColumns(batch.id, cols);
    setBatch(r.batch); setMappingState(r.batch.mapping ?? {}); setNewFieldCols({});
    setPresets(await getPresets());
    setNotice(`${r.created.length} custom field${r.created.length === 1 ? "" : "s"} created and matched${r.problems.length ? `. Not created: ${r.problems.join(" ")}` : "."}`);
  });

  const run = async (fn: () => Promise<void>) => {
    setError(null); setNotice(null); setBusy(true);
    try { await fn(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  const startNew = () => {
    setBatch(null); setFile(null); setPreview(null); setMappingState({}); setStageMap({}); setColumns([]); setSample([]);
    setError(null); setNotice(null); setStep("upload");
  };

  const open = (b: Batch) => {
    setBatch(b); setMappingState(b.mapping ?? {}); setStageMap(b.options?.stage_map ?? {}); setColumns(b.columns ?? []);
    setError(null); setNotice(null);
    if (b.status === "uploaded") { setStep(b.record_type === "keystone" ? "preview" : "map"); if (b.record_type === "keystone") void loadPreview(b.id); }
    else setStep("job");
  };

  const doUpload = () => run(async () => {
    if (!file) throw new Error("Choose a file first.");
    const r = await uploadImportFile(file, source, source === "keystone" ? "keystone" : recordType);
    setBatch(r.batch); setColumns(r.columns); setSample(r.sample ?? []); setMappingState(r.suggested_mapping ?? {}); setStageMap({});
    void refreshHistory();
    if (r.batch.record_type === "keystone") { setStep("preview"); await loadPreview(r.batch.id); }
    else {
      setStep("map");
      listMappings(r.batch.record_type).then(setSaved).catch(() => setSaved([]));
    }
  });

  const loadPreview = async (id: string) => {
    const p = await getPreview(id);
    setPreview(p);
    if (p.stages?.length) setStageMap((cur) => {
      const next = { ...cur };
      for (const s of p.stages) if (!next[s.value]) next[s.value] = s.stage;
      return next;
    });
  };

  const toPreview = () => run(async () => {
    if (!batch) return;
    const b = await setMapping(batch.id, mapping, stageMap);
    setBatch(b);
    await loadPreview(b.id);
    setStep("preview");
  });

  const applyStages = () => run(async () => {
    if (!batch) return;
    const b = await setMapping(batch.id, batch.record_type === "keystone" ? {} : mapping, stageMap);
    setBatch(b);
    await loadPreview(b.id);
    setNotice("Stage choices saved.");
  });

  const doDryRun = () => run(async () => {
    if (!batch) return;
    if (Object.keys(stageMap).length) setBatch(await setMapping(batch.id, batch.record_type === "keystone" ? {} : mapping, stageMap));
    setBatch(await startDryRun(batch.id));
    setStep("job");
  });

  const doRun = () => run(async () => { if (batch) setBatch(await startRun(batch.id)); });

  const doUndo = () => run(async () => {
    if (!batch) return;
    const ok = typeof window === "undefined" || window.confirm("Undo this import? Records it added are deleted (with anything added to them since), and fields it changed go back to their earlier values.");
    if (!ok) return;
    setBatch(await startUndo(batch.id));
  });

  const doRemove = (b: Batch) => run(async () => {
    await removeBatch(b.id);
    await refreshHistory();
    if (batch?.id === b.id) { setBatch(null); setStep("home"); }
  });

  const doSaveMapping = () => run(async () => {
    if (!batch || batch.record_type === "keystone") return;
    const name = saveName.trim();
    if (!name) throw new Error("Give the mapping a name.");
    await saveMapping({ name, source: batch.source, record_type: batch.record_type, mapping, options: { stage_map: stageMap } });
    setSaved(await listMappings(batch.record_type));
    setSaveName("");
    setNotice(`Saved as "${name}".`);
  });

  const applySaved = (id: string) => {
    const m = saved.find((s) => s.id === id);
    if (!m) return;
    const cols = new Set(columns);
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(m.mapping)) if (cols.has(v)) next[k] = v;
    setMappingState(next);
    if (m.options?.stage_map) setStageMap(m.options.stage_map);
    const missing = Object.values(m.mapping).filter((v) => !cols.has(v));
    setNotice(missing.length ? `Used "${m.name}". This file has no column ${missing.map((c) => `"${c}"`).join(", ")}.` : `Used "${m.name}".`);
  };

  const download = (path: string, name: string) => run(async () => { await downloadFrom(path, name); });

  const missingRequired = fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);
  const groups = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const f of fields) if (f.group) g.set(f.group, [...(g.get(f.group) ?? []), f.key]);
    return [...g.values()].filter((keys) => !keys.some((k) => mapping[k])).map((keys) => keys.map((k) => fields.find((f) => f.key === k)?.label ?? k));
  }, [fields, mapping]);

  const limits = presets?.limits;

  return (
    <div style={{ maxWidth: 980, color: "var(--ui-text)" }} data-testid="import-data">
      <div style={{ ...row, justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Import data</h2>
        <div style={row}>
          <button type="button" style={linkBtn} onClick={() => setShowGuide((v) => !v)} data-testid="import-guide-toggle">
            {showGuide ? "Hide the Moving to Keystone guide" : "Read the Moving to Keystone guide"}
          </button>
          {step !== "home" && <button type="button" style={btn} onClick={() => { setStep("home"); void refreshHistory(); }}>All imports</button>}
        </div>
      </div>
      {showGuide && <MovingToKeystone />}
      {error && <div role="alert" style={errorBox}>{error}</div>}
      {notice && <div role="status" style={okBox}>{notice}</div>}

      {step === "home" && (
        <>
          <Section title="Bring your records into Keystone">
            <p style={muted}>
              Move contacts, companies, lenders and their products, deals, notes and documents from HubSpot, Salesforce, Pipedrive,
              a spreadsheet or another Keystone portal. You will see every row before anything is saved, and you can undo an import afterwards.
            </p>
            <button type="button" style={primary} onClick={startNew} data-testid="import-new">New import</button>
          </Section>
          <Section title="Your imports" testId="import-history">
            {history.length === 0 ? <p style={{ ...muted, margin: 0 }}>No imports yet.</p> : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead><tr><th style={th}>File</th><th style={th}>What</th><th style={th}>Status</th><th style={th}>Result</th><th style={th}>By</th><th style={th} /></tr></thead>
                  <tbody>
                    {history.map((b) => (
                      <tr key={b.id} data-testid={`import-row-${b.id}`}>
                        <td style={td}>{b.file_name}<div style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>{new Date(b.created_at).toLocaleString()}</div></td>
                        <td style={td}>{typeLabel(presets, b.record_type)}<div style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>{sourceLabel(presets, b.source)}</div></td>
                        <td style={td}><StatusChip status={b.status} /></td>
                        <td style={td}>{["completed", "failed", "undone", "running", "undoing"].includes(b.status)
                          ? `${b.created_count} created, ${b.updated_count} updated, ${b.error_count} errors`
                          : `${b.total_rows.toLocaleString()} rows`}</td>
                        <td style={td}>{b.created_by_email ?? ""}</td>
                        <td style={{ ...td, whiteSpace: "nowrap" }}>
                          <button type="button" style={linkBtn} onClick={() => open(b)}>Open</button>
                          {["uploaded", "ready"].includes(b.status) && <> {" "}<button type="button" style={linkBtn} onClick={() => void doRemove(b)}>Remove</button></>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      {step === "upload" && (
        <Section title="1. Upload a file" testId="import-upload">
          <fieldset style={{ border: "none", padding: 0, margin: "0 0 12px" }}>
            <legend style={label}>Where is the data from?</legend>
            {(presets?.sources ?? []).map((s) => (
              <label key={s.key} style={{ display: "block", fontSize: 14, marginBottom: 4 }}>
                <input type="radio" name="import-source" value={s.key} checked={source === s.key} onChange={() => setSource(s.key)} /> {s.label}
              </label>
            ))}
            <p style={{ ...muted, marginTop: 6 }}>{SOURCE_HELP[source]}</p>
          </fieldset>
          {source !== "keystone" ? (
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="import-type" style={label}>What does the file hold?</label>
              <select id="import-type" value={recordType} onChange={(e) => setRecordType(e.target.value as RecordType)} style={input}>
                {(presets?.record_types ?? []).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <p style={{ ...muted, marginTop: 6 }}>
                {TYPE_HELP[recordType]}{" "}
                <button type="button" style={linkBtn} data-testid="import-template" onClick={() => void download(templatePath(recordType), `keystone-${recordType}-template.csv`)}>Download the template</button>
              </p>
            </div>
          ) : (
            <p style={muted}>
              Moving from another Keystone portal? Download its data there (Settings, Import data, Download this portal's data) and upload the zip here.{" "}
              <button type="button" style={linkBtn} onClick={() => void download(EXPORT_PATH, "data-export.zip")}>Download this portal's data</button>
            </p>
          )}
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="import-file" style={label}>File</label>
            <input id="import-file" data-testid="import-file" type="file" accept={source === "keystone" || recordType === "documents" ? ".zip" : ".csv,.txt,.xlsx"}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={input} />
            {limits && <p style={{ ...muted, marginTop: 6 }}>CSV or Excel up to {formatBytes(limits.tableBytes)}, a .zip up to {formatBytes(limits.zipBytes)}, up to {limits.rows.toLocaleString()} rows per file. Excel: only the first sheet is read.</p>}
          </div>
          <div style={row}>
            <button type="button" style={primary} disabled={busy || !file} onClick={() => void doUpload()} data-testid="import-upload-button">{busy ? "Uploading..." : "Upload"}</button>
            <button type="button" style={btn} onClick={() => setStep("home")}>Cancel</button>
          </div>
        </Section>
      )}

      {step === "map" && batch && (
        <Section title={`2. Match columns: ${typeLabel(presets, batch.record_type)}`} testId="import-map">
          <p style={muted}>{batch.file_name}: {batch.total_rows.toLocaleString()} rows. Columns we recognised are already chosen. Leave a field on "Not imported" to skip it.</p>
          {saved.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="import-saved" style={label}>Use a saved mapping</label>
              <select id="import-saved" defaultValue="" onChange={(e) => applySaved(e.target.value)} style={input}>
                <option value="">Choose...</option>
                {saved.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={th}>Keystone field</th><th style={th}>Column in your file</th><th style={th}>First row</th></tr></thead>
              <tbody>
                {fields.map((f) => (
                  <tr key={f.key}>
                    <td style={td}>
                      <label htmlFor={`map-${f.key}`} style={{ fontWeight: 600 }}>{f.label}{f.required && <span style={{ color: "#b91c1c" }}> *</span>}</label>
                      {f.hint && <div style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>{f.hint}</div>}
                    </td>
                    <td style={td}>
                      <select id={`map-${f.key}`} data-testid={`map-${f.key}`} value={mapping[f.key] ?? ""} style={input}
                        onChange={(e) => setMappingState((m) => { const n = { ...m }; if (e.target.value) n[f.key] = e.target.value; else delete n[f.key]; return n; })}>
                        <option value="">Not imported</option>
                        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, color: "var(--ui-text-muted)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{mapping[f.key] ? show(sample[0]?.[mapping[f.key] ?? ""]) : ""}</td>
                  </tr>
                ))}
                {customTargets.length > 0 && (
                  <tr><td colSpan={3} style={{ ...td, fontWeight: 700, background: "var(--ui-surface-muted)" }}>Custom fields</td></tr>
                )}
                {customTargets.map((f) => (
                  <tr key={f.key}>
                    <td style={td}><label htmlFor={`map-${f.key}`} style={{ fontWeight: 600 }}>{f.label}</label><div style={{ fontSize: 12, color: "var(--ui-text-muted)" }}>{f.name}</div></td>
                    <td style={td}>
                      <select id={`map-${f.key}`} data-testid={`map-${f.key}`} value={mapping[f.key] ?? ""} style={input}
                        onChange={(e) => setMappingState((m) => { const n = { ...m }; if (e.target.value) n[f.key] = e.target.value; else delete n[f.key]; return n; })}>
                        <option value="">Not imported</option>
                        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, color: "var(--ui-text-muted)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{mapping[f.key] ? show(sample[0]?.[mapping[f.key] ?? ""]) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canHaveCustom && unusedColumns.length > 0 && (
            <details style={{ marginTop: 12 }} data-testid="import-unused-columns">
              <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--ui-text)", fontSize: 14 }}>
                {unusedColumns.length} column{unusedColumns.length === 1 ? "" : "s"} not imported{batch.source === "hubspot" ? " (HubSpot custom properties land here)" : ""}
              </summary>
              <p style={{ ...muted, marginTop: 8 }}>Tick a column to keep it as a new custom field. Its type is guessed from the values unless you choose one.</p>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <tbody>
                  {unusedColumns.map((c) => (
                    <tr key={c}>
                      <td style={td}>
                        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <input type="checkbox" checked={c in newFieldCols} onChange={(e) => setNewFieldCols((p) => { const n = { ...p }; if (e.target.checked) n[c] = ""; else delete n[c]; return n; })} />
                          {c}
                        </label>
                      </td>
                      <td style={td}>
                        <select aria-label={`Type for ${c}`} style={input} value={newFieldCols[c] ?? ""} disabled={!(c in newFieldCols)} onChange={(e) => setNewFieldCols((p) => ({ ...p, [c]: e.target.value }))}>
                          <option value="">Guess from the values</option>
                          {(presets?.field_types ?? []).map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                        </select>
                      </td>
                      <td style={{ ...td, color: "var(--ui-text-muted)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{show(sample[0]?.[c])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" style={{ ...btn, marginTop: 8 }} disabled={busy || Object.keys(newFieldCols).length === 0} onClick={() => void doCreateFields()} data-testid="import-create-fields">
                Create custom fields from the ticked columns
              </button>
            </details>
          )}
          {(missingRequired.length > 0 || groups.length > 0) && (
            <div style={warnBox} data-testid="import-map-missing">
              {missingRequired.map((m) => <div key={m}>Choose a column for {m}.</div>)}
              {groups.map((g) => <div key={g.join()}>Choose a column for at least one of: {g.join(", ")}.</div>)}
            </div>
          )}
          <div style={{ ...row, marginTop: 12 }}>
            <input aria-label="Name for this mapping" placeholder="Name this mapping to reuse it" value={saveName} onChange={(e) => setSaveName(e.target.value)} style={{ ...input, minWidth: 240 }} />
            <button type="button" style={btn} disabled={busy} onClick={() => void doSaveMapping()}>Save mapping</button>
          </div>
          <div style={{ ...row, marginTop: 12 }}>
            <button type="button" style={primary} disabled={busy || missingRequired.length > 0 || groups.length > 0} onClick={() => void toPreview()} data-testid="import-to-preview">Next: preview</button>
            <button type="button" style={btn} onClick={() => setStep("home")}>Back</button>
          </div>
        </Section>
      )}

      {step === "preview" && batch && (
        <Section title="3. Preview" testId="import-preview">
          {!preview ? <p style={muted}>Loading the first rows...</p> : (
            <>
              <p style={muted}>
                The first {preview.rows.length} rows as they will be saved. {preview.error_rows_in_scanned > 0
                  ? `${preview.error_rows_in_scanned.toLocaleString()} of the first ${preview.scanned.toLocaleString()} rows have problems and will be skipped unless you fix the file.`
                  : `No problems in the first ${preview.scanned.toLocaleString()} rows.`}
              </p>
              <div style={{ overflowX: "auto", marginBottom: 12 }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead><tr><th style={th}>Row</th>{isKeystone && <th style={th}>Type</th>}<th style={th}>Values</th><th style={th}>Problems</th></tr></thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={`${r.record_type}-${r.row_number}`} data-testid={`preview-row-${r.row_number}`}>
                        <td style={td}>{r.row_number}</td>
                        {isKeystone && <td style={td}>{typeLabel(presets, r.record_type)}</td>}
                        <td style={{ ...td, maxWidth: 520 }}>
                          {Object.entries(r.values).filter(([k, v]) => k !== "custom_fields" && show(v) !== "").slice(0, 8).map(([k, v]) => (
                            <span key={k} style={{ display: "inline-block", marginRight: 10 }}><span style={{ color: "var(--ui-text-muted)" }}>{fields.find((f) => f.key === k)?.label ?? k}:</span> {show(v).slice(0, 80)}</span>
                          ))}
                          {Object.entries((r.values.custom_fields ?? {}) as Record<string, unknown>).slice(0, 6).map(([k, v]) => (
                            <span key={`cf-${k}`} style={{ display: "inline-block", marginRight: 10 }}><span style={{ color: "var(--ui-text-muted)" }}>{customTargets.find((f) => f.name === k)?.label ?? k}:</span> {show(v).slice(0, 80)}</span>
                          ))}
                        </td>
                        <td style={td}>
                          {r.errors.map((e, i) => <div key={`e${i}`} style={{ color: "#991b1b", fontWeight: 600 }}>{e.message}</div>)}
                          {r.warnings.map((w, i) => <div key={`w${i}`} style={{ color: "#92400e" }}>{w.message}</div>)}
                          {r.errors.length === 0 && r.warnings.length === 0 && <span style={{ color: "#166534" }}>OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.stages.length > 0 && (
                <div data-testid="import-stages" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: "0 0 6px", fontSize: 14 }}>Pipeline stages</h4>
                  <p style={muted}>Each stage in your file goes to the Keystone stage on the right. Change any that are wrong.</p>
                  <table style={{ borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>Stage in your file</th><th style={th}>Deals</th><th style={th}>Keystone stage</th></tr></thead>
                    <tbody>
                      {preview.stages.map((s) => (
                        <tr key={s.value}>
                          <td style={td}>{s.value}{!s.matched && <span style={{ marginLeft: 6, fontSize: 12, color: "#92400e" }}>(not recognised)</span>}</td>
                          <td style={td}>{s.rows}</td>
                          <td style={td}>
                            <select aria-label={`Keystone stage for ${s.value}`} value={stageMap[s.value] ?? s.stage} style={input}
                              onChange={(e) => setStageMap((m) => ({ ...m, [s.value]: e.target.value }))}>
                              {(presets?.stages ?? []).map((k) => <option key={k} value={k}>{k}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" style={{ ...btn, marginTop: 8 }} disabled={busy} onClick={() => void applyStages()}>Save stage choices</button>
                </div>
              )}
              <div style={row}>
                <button type="button" style={primary} disabled={busy} onClick={() => void doDryRun()} data-testid="import-dry-run">Check every row (nothing is saved)</button>
                {!isKeystone && <button type="button" style={btn} onClick={() => setStep("map")}>Back to columns</button>}
              </div>
            </>
          )}
        </Section>
      )}

      {step === "job" && batch && <JobView batch={batch} presets={presets} busy={busy} onRun={doRun} onUndo={doUndo} onDownload={download}
        onBack={() => { setMappingState(batch.mapping ?? {}); setColumns(batch.columns ?? []); if (batch.record_type === "keystone") { setStep("preview"); void loadPreview(batch.id); } else setStep("map"); }} />}
    </div>
  );
}

function ByType({ by, presets }: { by: Record<string, Counts> | undefined; presets: Presets | null }) {
  const entries = Object.entries(by ?? {});
  if (entries.length < 2) return null;
  return (
    <table style={{ borderCollapse: "collapse", margin: "6px 0 10px" }}>
      <thead><tr><th style={th}>Type</th><th style={th}>Created</th><th style={th}>Updated</th><th style={th}>Skipped</th><th style={th}>Errors</th></tr></thead>
      <tbody>{entries.map(([t, c]) => <tr key={t}><td style={td}>{typeLabel(presets, t)}</td><td style={td}>{c.created}</td><td style={td}>{c.updated}</td><td style={td}>{c.skipped}</td><td style={td}>{c.errors}</td></tr>)}</tbody>
    </table>
  );
}

function JobView({ batch, presets, busy, onRun, onUndo, onDownload, onBack }: {
  batch: Batch; presets: Presets | null; busy: boolean; onRun: () => void; onUndo: () => void;
  onDownload: (path: string, name: string) => void; onBack: () => void;
}) {
  const s = batch.status;
  const dry = batch.dry_run;
  const runCounts: Counts = { created: batch.created_count, updated: batch.updated_count, skipped: batch.skipped_count, errors: batch.error_count };
  return (
    <div data-testid="import-job">
      <Section title={`${batch.file_name ?? "Import"} - ${typeLabel(presets, batch.record_type)}`}>
        <div style={{ ...row, marginBottom: 8 }}><StatusChip status={s} /><span style={{ fontSize: 13, color: "var(--ui-text-muted)" }}>{sourceLabel(presets, batch.source)}</span></div>
        {(s === "dry_run_queued" || s === "dry_running") && (
          <>
            <p style={muted}>Checking every row against your existing records. Nothing is saved.</p>
            <Progress done={batch.processed_rows} total={batch.total_rows} />
          </>
        )}
        {(s === "queued" || s === "running") && (
          <>
            <p style={muted}>Importing in the background. You can leave this page; the import carries on.</p>
            <Progress done={batch.processed_rows} total={batch.total_rows} />
            <CountsLine c={runCounts} />
          </>
        )}
        {(s === "undo_queued" || s === "undoing") && <p style={muted}>Undoing this import...</p>}
        {s === "failed" && <div role="alert" style={errorBox}>The import stopped: {batch.last_error ?? "unknown problem"}. Start it again to carry on where it stopped, or undo what it saved.</div>}
      </Section>

      {dry && (
        <Section title="4. Check results" testId="import-dry-result">
          <p style={muted}>If you import now, this is what will happen to the {dry.rows.toLocaleString()} rows:</p>
          <CountsLine c={dry} testId="import-dry-counts" />
          <ByType by={dry.by_type} presets={presets} />
          {(dry.errors > 0 || (dry.warnings ?? 0) > 0) && (
            <p style={{ fontSize: 13 }}>
              Rows with errors are left out.{" "}
              <button type="button" style={linkBtn} onClick={() => onDownload(problemsPath(batch.id, "dry_run"), "import-problems.csv")} data-testid="import-dry-problems">Download the problems (CSV)</button>
              {" "}to fix them in your file and import it again.
            </p>
          )}
          {s === "ready" && (
            <div style={row}>
              <button type="button" style={primary} disabled={busy} onClick={onRun} data-testid="import-run">Import now</button>
              <button type="button" style={btn} onClick={onBack}>Change the mapping</button>
            </div>
          )}
        </Section>
      )}

      {["running", "completed", "failed", "undo_queued", "undoing", "undone"].includes(s) && (
        <Section title="5. Import" testId="import-run-result">
          <CountsLine c={runCounts} testId="import-run-counts" />
          <ByType by={batch.run_summary?.by_type} presets={presets} />
          {batch.error_count > 0 && <button type="button" style={linkBtn} onClick={() => onDownload(problemsPath(batch.id, "run"), "import-problems.csv")}>Download the rows that were not imported (CSV)</button>}
          {s === "completed" && <div role="status" style={okBox}>Done. Your records are in Keystone.</div>}
          {s === "failed" && <div style={row}><button type="button" style={primary} disabled={busy} onClick={onRun}>Start again where it stopped</button></div>}
          {(s === "completed" || s === "failed") && (
            <div style={{ marginTop: 12 }}>
              <p style={muted}>Something wrong? Undo removes the records this import added and puts back the fields it changed (a field someone has edited since stays as it is).</p>
              <button type="button" style={danger} disabled={busy} onClick={onUndo} data-testid="import-undo">Undo this import</button>
            </div>
          )}
          {s === "undone" && batch.undo_summary && (
            <div role="status" style={okBox} data-testid="import-undone">
              Undone: {batch.undo_summary.removed} records removed, {batch.undo_summary.restored} restored
              {batch.undo_summary.kept > 0 ? `, ${batch.undo_summary.kept} fields kept because they were edited after the import` : ""}
              {(batch.undo_summary.held ?? 0) > 0 ? `, ${batch.undo_summary.held} kept because they are under a legal hold` : ""}
              {batch.undo_summary.failed > 0 ? `, ${batch.undo_summary.failed} could not be undone` : ""}.
            </div>
          )}
        </Section>
      )}
    </div>
  );
}
