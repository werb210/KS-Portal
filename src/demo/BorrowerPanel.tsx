// KS_PORTAL_v8_DEMO - "You're the borrower now": the QR code and short link that open the real client app on the
// prospect's phone, and, for anyone without a phone handy, the same borrower screens inside a phone on this page.
import { useMemo, useState } from "react";
import type { BorrowerState, DemoClient, DemoState } from "./demoApi";
import { encodeQr, qrSvgPath } from "./qr";

export function QrCode({ text, label }: { text: string; label: string }) {
  const { path, size } = useMemo(() => qrSvgPath(encodeQr(text).modules), [text]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges" data-testid="demo-qr">
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}

export function BorrowerPanel({ state, api, onScreen, setOnScreen }: { state: DemoState; api: DemoClient; onScreen: boolean; setOnScreen: (v: boolean) => void }) {
  const url = state.session.client_url;
  const [copied, setCopied] = useState(false);
  const docs = state.documents.length;
  return (
    <section className="ksd-card" aria-label="Be the borrower">
      <h3>Scan with your phone - you're the borrower now</h3>
      {url ? (
        <div className="ksd-qr">
          <QrCode text={url} label="QR code that opens the borrower app on your phone" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p className="ksd-small">Point your phone's camera at the code, or open this link on your phone:</p>
            <div className="ksd-code" data-testid="demo-short-link">{url}</div>
            <div className="ksd-row" style={{ marginTop: 8 }}>
              <button type="button" className="ksd-btn" onClick={() => {
                void navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => setCopied(false));
                void api.track("copied_link", "borrower");
              }}>{copied ? "Copied" : "Copy link"}</button>
            </div>
          </div>
        </div>
      ) : (
        <p className="ksd-muted">The phone link is not set up on this demo server. Use this screen instead.</p>
      )}
      <p className="ksd-small" style={{ marginTop: 12 }}>
        {state.session.used_phone ? "Your phone is connected. " : ""}
        {docs ? `${docs} document${docs === 1 ? "" : "s"} received so far.` : "Waiting for the first document..."}
      </p>
      {!onScreen && (
        <button type="button" className="ksd-btn ksd-btn-link" onClick={() => { setOnScreen(true); void api.track("used_screen_borrower", "borrower"); }}>
          No phone handy? Do it on this screen instead
        </button>
      )}
    </section>
  );
}

/** The borrower's screens (same calls the phone makes), shown in a phone frame on this page. */
export function OnScreenBorrower({ api }: { api: DemoClient }) {
  const [token, setToken] = useState<string | null>(null);
  const [st, setSt] = useState<BorrowerState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const client = token ? api.client(token) : null;
  const start = async () => {
    setBusy("start");
    setError(null);
    try {
      const t = (await api.borrowerToken()).client_token;
      setToken(t);
      setSt(await api.client(t).state());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setBusy(null);
    }
  };
  const upload = async (key: string, filename: string) => {
    if (!client) return;
    setBusy(key);
    setError(null);
    try {
      const blob = await client.sample(key);
      await client.upload(key, blob, filename);
      setSt(await client.state());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  };
  const uploadAll = async () => {
    for (const s of st?.samples ?? []) if (!s.uploaded) await upload(s.key, s.filename);
  };
  const ask = async () => {
    if (!client || !question.trim()) return;
    setBusy("ask");
    try {
      const r = await client.ask(question.trim());
      setSt((cur) => (cur ? { ...cur, messages: r.messages, assistant_remaining: Math.max(0, cur.assistant_remaining - 1) } : cur));
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant could not answer.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ksd-devices" aria-label="Borrower app on this screen">
      <div className="ksd-phone">
        <div className="ksd-phone-island" />
        <div className="ksd-phone-screen ksd-phone-light">
          <div className="ksd-phone-body">
            {!st ? (
              <div style={{ paddingTop: 30 }}>
                <h3>Borrower app</h3>
                <p className="ksd-small">You'll play Sam Carter, owner of Juniper Hollow Millwork (a sample business).</p>
                <button type="button" className="ksd-btn ksd-btn-primary" disabled={busy !== null} onClick={() => void start()}>Start as the borrower</button>
              </div>
            ) : (
              <>
                <h4 style={{ fontSize: 15 }}>Hi {st.contact.name?.split(" ")[0]}</h4>
                <p className="ksd-small">{st.broker.company} needs these for your {st.request ? `$${Number(st.request.amount).toLocaleString("en-CA")}` : ""} equipment loan. Tap to upload (samples).</p>
                {st.samples.map((s) => (
                  <div key={s.key} className="ksd-row" style={{ justifyContent: "space-between", borderBottom: "1px solid #e2e8f0", padding: "6px 0" }}>
                    <span className="ksd-small" style={{ flex: 1, minWidth: 0 }}>{s.label}</span>
                    {s.uploaded ? <span className="ksd-small" style={{ color: "#15803d", fontWeight: 700 }}>Sent</span> : (
                      <button type="button" className="ksd-btn ksd-btn-primary" style={{ minHeight: 32, padding: "4px 10px", fontSize: 13 }} disabled={busy !== null} onClick={() => void upload(s.key, s.filename)} aria-label={`Upload ${s.label}`}>
                        {busy === s.key ? "..." : "Upload"}
                      </button>
                    )}
                  </div>
                ))}
                {st.samples.some((s) => !s.uploaded) && (
                  <button type="button" className="ksd-btn" style={{ width: "100%", marginTop: 8 }} disabled={busy !== null} onClick={() => void uploadAll()}>Upload all</button>
                )}
                {!st.borrower_submitted_at && st.samples.some((s) => s.uploaded) && (
                  <button type="button" className="ksd-btn ksd-btn-success" style={{ width: "100%", marginTop: 8 }} disabled={busy !== null} onClick={() => { if (client) void client.submit().then(setSt); }}>Send to my broker</button>
                )}
                <h4 style={{ fontSize: 14, marginTop: 12 }}>Ask the assistant</h4>
                {st.messages.map((m, i) => (
                  <div key={i} className={`ksd-bubble ${m.role === "borrower" ? "ksd-bubble-me" : "ksd-bubble-ai"}`}>{m.body}</div>
                ))}
                {st.assistant_remaining > 0 ? (
                  <form onSubmit={(e) => { e.preventDefault(); void ask(); }} className="ksd-row" style={{ marginTop: 6 }}>
                    <label htmlFor="ksd-ask" className="ksd-small" style={{ position: "absolute", left: -9999 }}>Question for the assistant</label>
                    <input id="ksd-ask" className="ksd-input" style={{ flex: 1, minWidth: 0 }} maxLength={500} placeholder="e.g. How long does approval take?" value={question} onChange={(e) => setQuestion(e.target.value)} />
                    <button type="submit" className="ksd-btn ksd-btn-primary" disabled={busy !== null || !question.trim()}>Ask</button>
                  </form>
                ) : <p className="ksd-small ksd-muted">That's all the questions this demo allows.</p>}
              </>
            )}
            {error && <p role="alert" className="ksd-small" style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
