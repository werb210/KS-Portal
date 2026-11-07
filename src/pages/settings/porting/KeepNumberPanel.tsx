// KS_PORTAL_NUMBER_PORTING_v1 - "Your phone numbers": for each person, use the new Keystone number (the default: nothing
// to do) or keep the number they already have. Keeping one shows the call-forwarding steps straight away, then asks
// for the carrier details and a recent bill, then the letter of authorization to sign. Used inside the set-up wizard
// and in Settings > Phone lines. Admins only (the server refuses everyone else).
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import DOMPurify from "dompurify";
import CallForwardingGuide from "./CallForwardingGuide";
import {
  cancelPortRequest, CARRIERS, createPortRequest, fetchLoa, fetchPorting, fieldErrors, fileToBase64, NUMBER_TYPES, portingError, prettyNumber,
  setForwardingTested, signLoa, type Loa, type NumberType, type Overview, type Person, type PortRequest,
} from "./portingApi";

const MAIN = "__main__";
const text: CSSProperties = { fontSize: 14, color: "var(--ui-text)", lineHeight: 1.5 };
const muted: CSSProperties = { fontSize: 13, color: "var(--ui-text-muted)" };
const input: CSSProperties = { padding: "8px 10px", border: "1px solid var(--ui-border)", borderRadius: 6, fontSize: 14, background: "var(--ui-surface-strong)", color: "var(--ui-text)", width: "100%", boxSizing: "border-box" };
const label: CSSProperties = { display: "block", fontSize: 14, fontWeight: 600, color: "var(--ui-text)", margin: "10px 0 4px" };
const button: CSSProperties = { padding: "8px 14px", border: "1px solid var(--ui-border)", borderRadius: 6, background: "var(--ui-surface-strong)", color: "var(--ui-text)", cursor: "pointer", fontSize: 14, minHeight: 40 };
const primary: CSSProperties = { ...button, background: "#1d4ed8", borderColor: "#1d4ed8", color: "#ffffff", fontWeight: 600 };
const card: CSSProperties = { border: "1px solid var(--ui-border)", borderRadius: 10, padding: "12px 14px", margin: "10px 0", background: "var(--ui-surface-strong)" };
const errorText: CSSProperties = { color: "#b91c1c", fontSize: 13, marginTop: 4 };
const alertBox: CSSProperties = { background: "#fef2f2", color: "#7f1d1d", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 14, margin: "8px 0" };
const okBox: CSSProperties = { background: "#dcfce7", color: "#14532d", border: "1px solid #86efac", borderRadius: 8, padding: "8px 12px", fontSize: 14, margin: "8px 0" };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 12px" };
const chip = (s: PortRequest["status"]): CSSProperties => ({
  display: "inline-block", borderRadius: 999, padding: "2px 10px", fontSize: 13, fontWeight: 700, border: "1px solid",
  ...(s === "completed" ? { background: "#dcfce7", color: "#14532d", borderColor: "#86efac" }
    : s === "rejected" ? { background: "#fee2e2", color: "#7f1d1d", borderColor: "#fca5a5" }
      : s === "carrier_approval_pending" || s === "draft" ? { background: "#fef3c7", color: "#78350f", borderColor: "#fcd34d" }
        : s === "cancelled" ? { background: "#f1f5f9", color: "#334155", borderColor: "#cbd5e1" }
          : { background: "#dbeafe", color: "#1e3a8a", borderColor: "#93c5fd" }),
});
const RUNNING: PortRequest["status"][] = ["draft", "ready_to_submit", "submitted", "carrier_approval_pending", "scheduled"];

function Field({ id, title, error, hint, children }: { id: string; title: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} style={label}>{title}</label>
      {children}
      {hint && <div style={muted}>{hint}</div>}
      {error && <div role="alert" style={errorText}>{error}</div>}
    </div>
  );
}

/** The letter of authorization and the click-to-sign form. */
export function LoaSigner({ requestId, initial, onSigned, onCancel }: { requestId: string; initial?: Loa | null; onSigned: (r: PortRequest) => void; onCancel?: () => void }) {
  const [loa, setLoa] = useState<Loa | null>(initial ?? null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (initial) return;
    fetchLoa(requestId).then(setLoa).catch((e) => setError(portingError(e, "Couldn't load the letter. Please try again.")));
  }, [requestId, initial]);
  const html = useMemo(() => (loa ? DOMPurify.sanitize(loa.html) : ""), [loa]);
  async function sign() {
    if (!loa) return;
    setBusy(true); setError(null); setErrors({});
    try {
      onSigned(await signLoa(requestId, { signer_name: name.trim(), signer_title: title.trim(), agree, sha256: loa.sha256 }));
    } catch (e) {
      setErrors(fieldErrors(e));
      setError(portingError(e, "Couldn't sign. Please try again."));
      if ((e as { details?: { error?: string } })?.details?.error === "loa_changed") fetchLoa(requestId).then(setLoa).catch(() => undefined);
    } finally { setBusy(false); }
  }
  return (
    <div style={card} data-testid="loa-signer">
      <h4 style={{ margin: "0 0 6px", fontSize: 16, color: "var(--ui-text)" }}>Sign the letter of authorization</h4>
      <p style={muted}>It lets Keystone&apos;s phone partner transfer the number from your current carrier. The carrier needs it signed within the last 30 days. Your PIN is never shown in it.</p>
      {!loa && !error && <p style={text}>Loading the letter...</p>}
      {loa && (
        <div style={{ ...text, maxHeight: 260, overflowY: "auto", border: "1px solid var(--ui-border)", borderRadius: 8, padding: "8px 12px", margin: "8px 0", background: "var(--ui-surface)" }}
          // The letter comes from Keystone operations as plain paragraphs and lists; sanitized here as well.
          dangerouslySetInnerHTML={{ __html: html }} />
      )}
      <div style={grid}>
        <Field id={`loa-name-${requestId}`} title="Your full name" error={errors.signer_name}>
          <input id={`loa-name-${requestId}`} style={input} value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id={`loa-title-${requestId}`} title="Your title" error={errors.signer_title} hint="For example Owner or President">
          <input id={`loa-title-${requestId}`} style={input} value={title} autoComplete="organization-title" onChange={(e) => setTitle(e.target.value)} />
        </Field>
      </div>
      <label style={{ ...text, display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 4 }} />
        I am authorized to sign for this business, and I sign this letter.
      </label>
      {error && <div role="alert" style={alertBox}>{error}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button type="button" style={primary} disabled={busy || !loa || !agree || name.trim().length < 2 || title.trim().length < 2} onClick={() => void sign()}>
          {busy ? "Signing..." : "Sign the letter"}
        </button>
        {onCancel && <button type="button" style={button} onClick={onCancel}>Later</button>}
      </div>
    </div>
  );
}

type Draft = {
  phone_number: string; number_type: NumberType | ""; assign: string; carrier: string; carrier_other: string; account_number: string; pin: string;
  account_name: string; line1: string; line2: string; city: string; region: string; postal_code: string; country: "CA" | "US";
};
const emptyDraft = (assign: string): Draft => ({
  phone_number: "", number_type: "", assign, carrier: "", carrier_other: "", account_number: "", pin: "", account_name: "",
  line1: "", line2: "", city: "", region: "", postal_code: "", country: "CA",
});

/** "Keep my existing number" for one person (or the main line): forwarding first, then the details and the bill. */
function KeepForm({ who, people, mainLine, onCreated, onCancel }: {
  who: string; people: Person[]; mainLine: string | null; onCreated: (r: PortRequest, loa: Loa | null) => void; onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(() => emptyDraft(who));
  const [file, setFile] = useState<File | null>(null);
  const [tested, setTested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));
  const person = people.find((p) => p.id === d.assign);
  const temporary = d.assign === MAIN ? mainLine : person?.temporary_number ?? mainLine;
  const id = (k: string) => `keep-${who}-${k}`;

  async function submit() {
    setError(null); setErrors({});
    const local: Record<string, string> = {};
    if (!d.phone_number.trim()) local["numbers.0.phone_number"] = "Enter the number you want to keep.";
    if (!d.number_type) local["numbers.0.number_type"] = "Choose landline, mobile or toll-free.";
    if (!d.carrier) local.carrier = "Choose the carrier the number is with now.";
    if (!file) local.bill = "Upload a recent bill (PDF or a photo of the first page).";
    else if (file.size > 7 * 1024 * 1024) local.bill = "The bill must be 7 MB or smaller.";
    if (Object.keys(local).length) { setErrors(local); setError("Check the highlighted details."); return; }
    setBusy(true);
    try {
      const data = await fileToBase64(file!);
      const r = await createPortRequest({
        carrier: d.carrier, carrier_other: d.carrier === "other" ? d.carrier_other : undefined, account_number: d.account_number, pin: d.pin || undefined,
        account_name: d.account_name,
        service_address: { line1: d.line1, line2: d.line2 || undefined, city: d.city, region: d.region, postal_code: d.postal_code, country: d.country },
        numbers: [{ phone_number: d.phone_number, number_type: d.number_type as NumberType, user_id: d.assign === MAIN ? null : d.assign }],
        bill: { filename: file!.name, content_type: file!.type || "application/octet-stream", data_base64: data },
        forwarding_tested: tested,
      });
      onCreated(r.request, r.loa);
    } catch (e) {
      setErrors(fieldErrors(e));
      setError(portingError(e, "Couldn't send the request. Please try again."));
    } finally { setBusy(false); }
  }

  return (
    <div data-testid="keep-form">
      <CallForwardingGuide oldNumber={d.phone_number} temporaryNumber={temporary} carrier={d.carrier} numberType={d.number_type} tested={tested} onTestedChange={setTested} />
      <div style={grid}>
        <Field id={id("number")} title="The number to keep" error={errors["numbers.0.phone_number"]}>
          <input id={id("number")} style={input} inputMode="tel" placeholder="(403) 555-0100" value={d.phone_number} onChange={set("phone_number")} />
        </Field>
        <Field id={id("assign")} title="Whose number is it?" error={errors["numbers.0.user_id"]}>
          <select id={id("assign")} style={input} value={d.assign} onChange={set("assign")}>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value={MAIN}>The main line (the whole brokerage)</option>
          </select>
        </Field>
        <Field id={id("type")} title="Type of number" error={errors["numbers.0.number_type"]}>
          <select id={id("type")} style={input} value={d.number_type} onChange={set("number_type")}>
            <option value="">Choose...</option>
            {NUMBER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field id={id("carrier")} title="Current carrier" error={errors.carrier}>
          <select id={id("carrier")} style={input} value={d.carrier} onChange={set("carrier")}>
            <option value="">Choose...</option>
            {CARRIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        {d.carrier === "other" && (
          <Field id={id("carrier-other")} title="Carrier name" error={errors.carrier_other}>
            <input id={id("carrier-other")} style={input} value={d.carrier_other} onChange={set("carrier_other")} />
          </Field>
        )}
      </div>
      <p style={{ ...muted, marginTop: 12 }}>Copy these from your latest bill exactly as they appear. The carrier rejects the transfer if they do not match.</p>
      <div style={grid}>
        <Field id={id("acct")} title="Account number" error={errors.account_number}>
          <input id={id("acct")} style={input} autoComplete="off" value={d.account_number} onChange={set("account_number")} />
        </Field>
        <Field id={id("pin")} title="Account PIN or passcode (if any)" error={errors.pin} hint="Stored encrypted. Only used to submit the transfer.">
          <input id={id("pin")} style={input} type="password" autoComplete="off" value={d.pin} onChange={set("pin")} />
        </Field>
        <Field id={id("name")} title="Name on the account" error={errors.account_name}>
          <input id={id("name")} style={input} value={d.account_name} onChange={set("account_name")} />
        </Field>
      </div>
      <div style={grid}>
        <Field id={id("line1")} title="Service address (as on the bill)" error={errors["service_address.line1"]}>
          <input id={id("line1")} style={input} value={d.line1} onChange={set("line1")} />
        </Field>
        <Field id={id("line2")} title="Suite or unit (if any)">
          <input id={id("line2")} style={input} value={d.line2} onChange={set("line2")} />
        </Field>
        <Field id={id("city")} title="City" error={errors["service_address.city"]}>
          <input id={id("city")} style={input} value={d.city} onChange={set("city")} />
        </Field>
        <Field id={id("region")} title="Province or state" error={errors["service_address.region"]}>
          <input id={id("region")} style={input} maxLength={2} placeholder="AB" value={d.region} onChange={set("region")} />
        </Field>
        <Field id={id("postal")} title="Postal or ZIP code" error={errors["service_address.postal_code"]}>
          <input id={id("postal")} style={input} value={d.postal_code} onChange={set("postal_code")} />
        </Field>
        <Field id={id("country")} title="Country">
          <select id={id("country")} style={input} value={d.country} onChange={set("country")}>
            <option value="CA">Canada</option>
            <option value="US">United States</option>
          </select>
        </Field>
      </div>
      <Field id={id("bill")} title="A recent bill" error={errors.bill} hint="PDF, PNG or JPG, up to 7 MB. The first page with the account number and address is enough.">
        <input id={id("bill")} type="file" accept="application/pdf,image/png,image/jpeg" style={{ ...text, marginTop: 2 }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      {error && <div role="alert" style={alertBox}>{error}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button type="button" style={primary} disabled={busy} onClick={() => void submit()}>{busy ? "Sending..." : "Continue to the letter of authorization"}</button>
        <button type="button" style={button} onClick={onCancel}>Use the new Keystone number instead</button>
      </div>
    </div>
  );
}

/** One transfer already asked for: its status, the letter to sign, the forwarding reminder and Cancel. */
function RequestCard({ r, onChange }: { r: PortRequest; onChange: () => void }) {
  const [signing, setSigning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tested, setTested] = useState<Record<string, boolean>>(() => Object.fromEntries(r.numbers.map((n) => [n.phone_number, Boolean(n.forwarding_tested_at)])));
  const running = RUNNING.includes(r.status);
  async function tick(phone: string, v: boolean) {
    setTested((t) => ({ ...t, [phone]: v }));
    try { await setForwardingTested(r.id, phone, v); } catch (e) { setMsg(portingError(e, "Couldn't save that.")); }
  }
  async function cancel() {
    if (!window.confirm("Cancel this transfer? The number stays with your current carrier.")) return;
    try { await cancelPortRequest(r.id); onChange(); } catch (e) { setMsg(portingError(e, "Couldn't cancel.")); }
  }
  return (
    <div style={card} data-testid="port-request">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <strong style={{ ...text, fontSize: 15 }}>{r.numbers.map((n) => `${prettyNumber(n.phone_number)} - ${n.assignee_name}`).join("; ")}</strong>
        <span style={chip(r.status)}>{r.status_label}</span>
      </div>
      <p style={{ ...text, margin: "6px 0" }}>{r.status_message}</p>
      <p style={muted}>From {r.carrier_label}, account {r.account_number_masked}{r.pin_on_file ? ", PIN on file" : ""}{r.foc_date ? `. Transfer date: ${r.foc_date}` : ""}{r.status_reason ? `. ${r.status_reason}` : ""}</p>
      {r.status === "carrier_approval_pending" && (
        <div role="alert" style={alertBox}>Watch the old phone: when your current carrier texts asking to approve the transfer, approve it within 90 minutes or it is rejected.</div>
      )}
      {r.needs_signature && !signing && (
        <button type="button" style={primary} onClick={() => setSigning(true)}>{r.loa ? "Sign the letter again" : "Sign the letter of authorization"}</button>
      )}
      {signing && <LoaSigner requestId={r.id} onSigned={() => { setSigning(false); onChange(); }} onCancel={() => setSigning(false)} />}
      {running && r.numbers.map((n) => (
        <details key={n.phone_number} style={{ marginTop: 8 }}>
          <summary style={{ ...text, cursor: "pointer" }}>Call forwarding for {prettyNumber(n.phone_number)}{tested[n.phone_number] ? " (tested)" : ""}</summary>
          <CallForwardingGuide oldNumber={n.phone_number} temporaryNumber={n.temporary_number} numberType={n.number_type} tested={Boolean(tested[n.phone_number])}
            onTestedChange={(v) => void tick(n.phone_number, v)} testId={`forwarding-${n.phone_number}`} />
        </details>
      ))}
      {r.status === "completed" && <div style={okBox}>Done. Turn off the call forwarding on the old phone (dial *73 on most landlines, ##21# on most mobiles).</div>}
      {r.can_cancel && <button type="button" style={{ ...button, marginTop: 8 }} onClick={() => void cancel()}>Cancel this transfer</button>}
      {msg && <p role="status" style={text}>{msg}</p>}
    </div>
  );
}

export default function KeepNumberPanel({ onUseNewForEveryone }: { onUseNewForEveryone?: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keeping, setKeeping] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{ request: PortRequest; loa: Loa | null } | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = () => {
    fetchPorting().then((d) => { setData(d); setError(null); }).catch((e) => setError(portingError(e, "Couldn't load your phone numbers.")));
  };
  useEffect(load, []);

  if (error) return <div role="alert" style={alertBox}>{error}</div>;
  if (!data) return <p style={text}>Loading...</p>;

  const busyNumbers = new Set(data.requests.filter((r) => RUNNING.includes(r.status)).flatMap((r) => r.numbers.map((n) => n.user_id ?? MAIN)));
  const rows: Array<{ id: string; name: string; number: string | null }> = [
    ...data.people.map((p) => ({ id: p.id, name: p.name, number: p.temporary_number })),
    { id: MAIN, name: "Main line (the whole brokerage)", number: data.main_line },
  ];

  return (
    <div data-testid="keep-number-panel">
      <p style={text}>
        Everyone already has a new Keystone number. If you or a broker would rather keep a number you use today, choose
        &quot;Keep my existing number&quot;: Keystone transfers it for you (it takes up to four weeks), and you forward it meanwhile so no calls are missed.
      </p>
      {!data.ops_ready && <div role="alert" style={alertBox}>{data.message ?? "Number transfers are not available yet. Ask Keystone support."}</div>}
      {data.ops_ready && data.message && <div role="status" style={alertBox}>{data.message}</div>}
      {done && <div role="status" style={okBox}>{done}</div>}

      {justCreated && (
        <LoaSigner requestId={justCreated.request.id} initial={justCreated.loa}
          onSigned={() => { setJustCreated(null); setDone("Signed. Keystone support will submit the transfer within one business day and email you at each step. Keep the forwarding on until it is done."); load(); }}
          onCancel={() => { setJustCreated(null); load(); }} />
      )}

      {data.requests.length > 0 && (
        <section aria-labelledby="port-requests-h" style={{ marginTop: 12 }}>
          <h4 id="port-requests-h" style={{ margin: "0 0 4px", fontSize: 15, color: "var(--ui-text)" }}>Your number transfers</h4>
          {data.requests.map((r) => <RequestCard key={r.id} r={r} onChange={load} />)}
        </section>
      )}

      <section aria-labelledby="choose-h" style={{ marginTop: 12 }}>
        <h4 id="choose-h" style={{ margin: "0 0 4px", fontSize: 15, color: "var(--ui-text)" }}>Choose for each person</h4>
        {rows.map((row) => {
          const isKeeping = keeping === row.id;
          const busy = busyNumbers.has(row.id);
          return (
            <div key={row.id} style={card} data-testid={`number-choice-${row.id}`}>
              <div style={{ ...text, fontWeight: 600 }}>{row.name}</div>
              <div style={muted}>Keystone number: {row.number ? prettyNumber(row.number) : "not set up yet"}</div>
              {busy ? (
                <p style={{ ...text, margin: "6px 0 0" }}>A transfer is running for this line (see above).</p>
              ) : (
                <fieldset style={{ border: 0, padding: 0, margin: "8px 0 0" }}>
                  <legend style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Phone number for {row.name}</legend>
                  <label style={{ ...text, display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                    <input type="radio" name={`choice-${row.id}`} checked={!isKeeping} onChange={() => setKeeping(null)} />
                    Use the new Keystone number
                  </label>
                  <label style={{ ...text, display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                    <input type="radio" name={`choice-${row.id}`} checked={isKeeping} disabled={!data.ops_ready} onChange={() => { setKeeping(row.id); setDone(null); }} />
                    Keep my existing number
                  </label>
                </fieldset>
              )}
              {isKeeping && !busy && (
                <KeepForm who={row.id} people={data.people} mainLine={data.main_line}
                  onCancel={() => setKeeping(null)}
                  onCreated={(request, loa) => { setKeeping(null); setJustCreated({ request, loa }); load(); }} />
              )}
            </div>
          );
        })}
      </section>
      {onUseNewForEveryone && (
        <button type="button" style={{ ...primary, marginTop: 8 }} onClick={onUseNewForEveryone}>Done: everyone else uses their new Keystone number</button>
      )}
    </div>
  );
}
