// KS_PORTAL_NUMBER_PORTING_v1 - how to forward an old number to the temporary Keystone number while it transfers, so no
// calls are missed. Shown in the set-up wizard right after "Keep my existing number" is chosen, and in Settings >
// Phone lines for every transfer still running. The codes are filled in with the Keystone number.
import { useState, type CSSProperties } from "react";
import { prettyNumber, type NumberType } from "./portingApi";

const box: CSSProperties = { border: "1px solid #93c5fd", background: "#eff6ff", color: "#1e3a8a", borderRadius: 10, padding: "12px 14px", margin: "10px 0", fontSize: 14, lineHeight: 1.5 };
const code: CSSProperties = { fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontWeight: 700, background: "#ffffff", color: "#0f172a", border: "1px solid #bfdbfe", borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap" };
const small: CSSProperties = { fontSize: 13, color: "#1e3a8a" };
const copyBtn: CSSProperties = { marginLeft: 6, fontSize: 12, padding: "1px 8px", border: "1px solid #93c5fd", borderRadius: 6, background: "#ffffff", color: "#1e3a8a", cursor: "pointer" };

const MOBILE_CARRIERS_CA = ["bell", "rogers", "telus", "fido", "koodo", "virgin", "freedom", "videotron", "sasktel", "eastlink"];

/** The 10 digits of a North American number ("+14035550111" -> "4035550111"). */
export function tenDigits(n: string | null | undefined): string {
  const d = String(n ?? "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d.slice(-10);
}

/** The codes to dial for this carrier and kind of number. */
export function forwardingCodes(temporary: string | null, carrier: string, type: NumberType | "") {
  const t = tenDigits(temporary);
  const landline = { on: `*72${t}`, off: "*73" };
  const mobile = { on: `**21*${t}#`, off: "##21#" };
  if (type === "toll_free") return { kind: "toll_free" as const };
  if (type === "mobile") {
    if (carrier === "verizon") return { kind: "verizon" as const, ...landline };
    if (carrier === "att" || carrier === "tmobile") return { kind: "us_mobile" as const, on: `**21*1${t}#`, off: "##21#" };
    return { kind: "mobile" as const, ...mobile };
  }
  return { kind: "landline" as const, ...landline };
}

function Code({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span>
      <span style={code}>{value}</span>
      <button type="button" style={copyBtn} aria-label={`Copy ${value}`}
        onClick={() => void navigator.clipboard?.writeText(value).then(() => setCopied(true)).catch(() => setCopied(false))}>
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

export default function CallForwardingGuide({ oldNumber, temporaryNumber, carrier = "", numberType = "", tested, onTestedChange, testId }: {
  oldNumber?: string;
  temporaryNumber: string | null;
  carrier?: string;
  numberType?: NumberType | "";
  tested: boolean;
  onTestedChange: (tested: boolean) => void;
  testId?: string;
}) {
  const temp = temporaryNumber ? prettyNumber(temporaryNumber) : null;
  const c = forwardingCodes(temporaryNumber, carrier, numberType);
  const old = oldNumber && tenDigits(oldNumber).length === 10 ? prettyNumber(oldNumber) : "your old number";
  return (
    <div style={box} data-testid={testId ?? "call-forwarding-guide"} role="region" aria-label="Forward your old number while it transfers">
      <strong style={{ display: "block", fontSize: 15, marginBottom: 4 }}>Forward {old} now, so no calls are missed</strong>
      {temp ? (
        <p style={{ margin: "0 0 8px" }}>
          A transfer takes up to four weeks. Until it is done, forward {old} to your temporary Keystone number <strong>{temp}</strong>. Do it from the old phone:
        </p>
      ) : (
        <p style={{ margin: "0 0 8px" }}>Your Keystone number is not set up yet. Get it in Settings, Phone lines, then forward {old} to it.</p>
      )}
      {temp && (
        <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
          {c.kind === "toll_free" ? (
            <li>Toll-free numbers are forwarded in your toll-free provider&apos;s online account, or by calling them: ask for it to ring <strong>{temp}</strong>.</li>
          ) : (
            <>
              {(c.kind === "landline" || numberType === "") && (
                <li>Most landlines and business lines: dial <Code value={`*72${tenDigits(temporaryNumber)}`} /> and wait for the confirmation. To stop, dial <Code value="*73" />.</li>
              )}
              {(c.kind === "mobile" || numberType === "") && (
                <li>
                  {numberType === "mobile" && MOBILE_CARRIERS_CA.includes(carrier) ? `${carrier === "virgin" ? "Virgin Plus" : carrier.charAt(0).toUpperCase() + carrier.slice(1)} mobiles` : "Bell, Rogers and Telus mobiles (and most others)"}:
                  {" "}dial <Code value={`**21*${tenDigits(temporaryNumber)}#`} /> and press call. To stop, dial <Code value="##21#" />.
                </li>
              )}
              {c.kind === "verizon" && <li>Verizon mobiles: dial <Code value={c.on} />. To stop, dial <Code value={c.off} />.</li>}
              {c.kind === "us_mobile" && <li>AT&amp;T and T-Mobile mobiles: dial <Code value={c.on} /> and press call. To stop, dial <Code value={c.off} />.</li>}
              <li>Office phone systems (VoIP or PBX), or if a code does not work: check your carrier or your phone system&apos;s settings for &quot;call forwarding&quot;, and forward to {temp}.</li>
            </>
          )}
        </ul>
      )}
      <p style={{ ...small, margin: "0 0 8px" }}>
        Texts cannot be forwarded. They keep going to the old phone until the transfer is done.
      </p>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, cursor: "pointer" }}>
        <input type="checkbox" checked={tested} onChange={(e) => onTestedChange(e.target.checked)} />
        Test it: I called {old} from another phone and it rang in Keystone
      </label>
    </div>
  );
}
