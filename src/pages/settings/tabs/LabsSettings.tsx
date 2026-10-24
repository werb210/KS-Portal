// KS_PORTAL_BETA_v1 - Settings -> Labs (Admins): the beta features this brokerage can try. Each shows its name,
// description and status; public betas can be joined and left here, joined ones take feedback. Keystone operations
// runs the programme; the list comes from GET /api/beta/features.
import { useEffect, useState, type CSSProperties } from "react";
import toast from "react-hot-toast";
import { BetaBadge } from "@/beta/BetaBadge";
import { joinBeta, leaveBeta, loadBeta, sendBetaFeedback, useBeta, type BetaFeature } from "@/beta/betaStore";
import { primaryButton, secondaryButton, useIsAdmin } from "@/plans/ui";

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16 };
const muted: CSSProperties = { color: "var(--ui-text-muted)", fontSize: 13 };
const field: CSSProperties = { width: "100%", padding: 8, borderRadius: 8, border: "1px solid var(--ui-border)", background: "var(--ui-surface)", color: "var(--ui-text)", font: "inherit", fontSize: 14 };

function Feedback({ feature, onDone }: { feature: BetaFeature; onDone: () => void }) {
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState("");
  const [busy, setBusy] = useState(false);
  const id = `beta-fb-${feature.key}`;
  const send = async () => {
    if (!message.trim()) { toast.error("Write your feedback first."); return; }
    setBusy(true);
    const r = await sendBetaFeedback(feature.key, message.trim(), rating ? Number(rating) : null);
    setBusy(false);
    if (r.ok) { toast.success("Thanks - your feedback was sent to the Keystone team."); onDone(); }
    else toast.error(r.error ?? "Your feedback could not be sent.");
  };
  return (
    <div style={{ marginTop: 12 }} data-testid={`beta-feedback-form-${feature.key}`}>
      <label htmlFor={id} style={{ display: "block", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Your feedback on {feature.name}</label>
      <textarea id={id} rows={4} maxLength={5000} value={message} onChange={(e) => setMessage(e.target.value)} style={field} placeholder="What worked, what didn't, what you'd change." />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
        <label htmlFor={`${id}-rating`} style={{ fontSize: 14 }}>How useful is it?</label>
        <select id={`${id}-rating`} value={rating} onChange={(e) => setRating(e.target.value)} style={{ ...field, width: "auto" }}>
          <option value="">No rating</option>
          <option value="5">5 - Very useful</option>
          <option value="4">4</option>
          <option value="3">3</option>
          <option value="2">2</option>
          <option value="1">1 - Not useful</option>
        </select>
        <button type="button" style={primaryButton} disabled={busy} onClick={send}>{busy ? "Sending..." : "Send feedback"}</button>
        <button type="button" style={secondaryButton} disabled={busy} onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function FeatureCard({ feature }: { feature: BetaFeature }) {
  const [busy, setBusy] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const act = async (action: "join" | "leave") => {
    if (action === "leave" && !window.confirm(`Leave ${feature.name}? It switches off for everyone at your brokerage. You can join again while the beta is open.`)) return;
    setBusy(true);
    const r = action === "join" ? await joinBeta(feature.key) : await leaveBeta(feature.key);
    setBusy(false);
    if (!r.ok) { toast.error(r.error); return; }
    if (r.status === "requested") toast.success(r.message ?? "We have your request and will be in touch.");
    else toast.success(action === "join" ? `${feature.name} is now on for your brokerage.` : `${feature.name} is now off.`);
  };
  return (
    <section style={card} data-testid={`beta-feature-${feature.key}`} aria-labelledby={`beta-h-${feature.key}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 280px" }}>
          <h3 id={`beta-h-${feature.key}`} style={{ margin: 0, fontSize: 16, color: "var(--ui-text)" }}>
            {feature.name}
            <BetaBadge status={feature.status} />
            {feature.enabled && <BetaBadge label="On" style={{ background: "#dcfce7", color: "#14532d", borderColor: "#16a34a" }} />}
          </h3>
          {feature.description && <p style={{ margin: "6px 0 0", fontSize: 14, whiteSpace: "pre-wrap" }}>{feature.description}</p>}
          {feature.docs_url && (
            <p style={{ margin: "6px 0 0", fontSize: 14 }}>
              <a href={feature.docs_url} target="_blank" rel="noreferrer" style={{ color: "inherit", fontWeight: 600, textDecoration: "underline" }}>How it works</a>
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {feature.can_join && <button type="button" style={primaryButton} disabled={busy} onClick={() => act("join")}>{busy ? "Joining..." : "Join"}</button>}
          {feature.can_leave && <button type="button" style={secondaryButton} disabled={busy} onClick={() => act("leave")}>{busy ? "Leaving..." : "Leave"}</button>}
          {feature.enrolled && !feedbackOpen && <button type="button" style={secondaryButton} onClick={() => setFeedbackOpen(true)}>Send feedback</button>}
        </div>
      </div>
      {!feature.can_join && !feature.enabled && feature.status === "public_beta" && <p style={{ ...muted, margin: "8px 0 0" }}>This beta is full right now.</p>}
      {feature.status === "ga" && <p style={{ ...muted, margin: "8px 0 0" }}>This feature is now part of Keystone and is on for your brokerage.</p>}
      {feedbackOpen && <Feedback feature={feature} onDone={() => setFeedbackOpen(false)} />}
    </section>
  );
}

export default function LabsSettings() {
  const isAdmin = useIsAdmin();
  const beta = useBeta();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    void loadBeta().finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  if (!isAdmin) {
    return <div style={card} role="status"><p style={{ margin: 0 }}>Only an administrator can manage beta features.</p></div>;
  }
  const joined = beta.features.filter((f) => f.enrolled || f.status === "ga");
  const available = beta.features.filter((f) => !(f.enrolled || f.status === "ga"));
  return (
    <div data-testid="labs-settings">
      <div style={card}>
        <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Labs <BetaBadge /></h2>
        <p style={{ margin: 0, fontSize: 14 }}>
          Try new Keystone features before everyone else and help shape them. Betas switch on for everyone at your
          brokerage, can be switched off at any time, and may change before they are finished.
        </p>
      </div>
      {loading && beta.source === "fallback" ? (
        <p style={muted} role="status">Loading beta features...</p>
      ) : beta.features.length === 0 ? (
        <div style={card} role="status" data-testid="labs-empty">
          <p style={{ margin: 0 }}>There are no betas open to your brokerage right now. New ones appear here when they open.</p>
        </div>
      ) : (
        <>
          {joined.length > 0 && <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>Switched on</h3>}
          {joined.map((f) => <FeatureCard key={f.key} feature={f} />)}
          {available.length > 0 && <h3 style={{ fontSize: 15, margin: "8px 0 8px" }}>Available to try</h3>}
          {available.map((f) => <FeatureCard key={f.key} feature={f} />)}
        </>
      )}
    </div>
  );
}
