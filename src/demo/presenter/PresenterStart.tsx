// KS_PORTAL_v12_PRESENTER - /demo/present: the start page of the staff presenter-mode demo. It checks the presenter
// link with KS-Ops (staff only), asks for the prospect's name and brokerage, then opens the portal on the sample file
// with the presenter bar instead of the tour. Without a valid link it says so and shows nothing of the demo.
import { useEffect, useState, type FormEvent } from "react";
import { LIVE_DEMO_MODE_KEY, PRESENTER_MODE, readPresenter, writePresenter, type PresenterStore } from "../mode";
import { checkPresenterToken, presenterTokenFromHash } from "./presenterApi";

/** Navigation, behind a seam so tests can watch it. */
export const presenterNav = { assign: (url: string) => window.location.assign(url) };

const STATE_KEYS = ["ks_live_demo_state_v1", "ks_live_demo_tour_v1"];

type Phase = { kind: "checking" } | { kind: "no_link" } | { kind: "refused"; message: string; retry: boolean } | { kind: "ready"; store: PresenterStore };

/** Start (or restart) the presenter portal for this prospect: fresh sample file, presenter mode, the pipeline. */
export function startPresenterDemo(store: PresenterStore, prospect: { name: string; company: string }): void {
  writePresenter({ ...store, prospect: { name: prospect.name.trim().slice(0, 80), company: prospect.company.trim().slice(0, 120) } });
  try {
    for (const k of STATE_KEYS) window.sessionStorage.removeItem(k);
    window.sessionStorage.setItem(LIVE_DEMO_MODE_KEY, PRESENTER_MODE);
  } catch {
    /* private mode: main.tsx then shows the normal portal sign-in */
  }
  presenterNav.assign("/pipeline");
}

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 4h14l-3 11h-8z" fill="#f59e0b" />
      <path d="M4 10l6 2 2 18H5zM28 10l-6 2-2 18h7z" fill="#93c5fd" />
      <path d="M12.5 17h7l1.5 13h-10z" fill="#e2e8f0" />
    </svg>
  );
}

export default function PresenterStart() {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState(() => readPresenter()?.prospect?.name ?? "");
  const [company, setCompany] = useState(() => readPresenter()?.prospect?.company ?? "");

  useEffect(() => {
    document.title = "Keystone - presenter demo";
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fromHash = presenterTokenFromHash(window.location.hash);
    if (fromHash) {
      try {
        window.history.replaceState(window.history.state, "", window.location.pathname);
      } catch {
        /* not fatal */
      }
    }
    const stored = readPresenter();
    const token = fromHash ?? stored?.token ?? null;
    if (!token) {
      writePresenter(null);
      setPhase({ kind: "no_link" });
      return;
    }
    setPhase({ kind: "checking" });
    void checkPresenterToken(token).then((r) => {
      if (cancelled) return;
      if (!r.ok) {
        if (r.reason === "invalid") writePresenter(null);
        setPhase({ kind: "refused", message: r.message, retry: r.reason !== "invalid" });
        return;
      }
      const store: PresenterStore = {
        token,
        expiresAt: r.expiresAt,
        verifiedAt: new Date().toISOString(),
        presenterName: r.presenterName,
        prospect: stored?.token === token ? stored.prospect : null,
      };
      writePresenter(store);
      setPhase({ kind: "ready", store });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (phase.kind !== "ready") return;
    startPresenterDemo(phase.store, { name: name.trim() || "Demo broker", company: company.trim() || "Your brokerage" });
  };

  return (
    <div className="ksld-shell ksld-shell--empty" data-testid="presenter-start">
      <div className="ksld-empty-card ksld-present-card">
        <div className="ksld-brand"><Mark /><span>Keystone</span></div>
        {phase.kind === "checking" && (
          <>
            <h1>Presenter demo</h1>
            <p role="status">Checking your presenter link…</p>
          </>
        )}
        {phase.kind === "no_link" && (
          <>
            <h1>For Keystone staff only</h1>
            <p data-testid="presenter-no-link">The presenter demo opens from the staff portal: Keystone, then <strong>Start sales demo</strong>. Prospects can try Keystone themselves from the website's "Try it yourself" page.</p>
          </>
        )}
        {phase.kind === "refused" && (
          <>
            <h1>For Keystone staff only</h1>
            <p role="alert" data-testid="presenter-refused">{phase.message}</p>
            {phase.retry && (
              <div className="ksld-present-actions">
                <button type="button" className="ksld-btn ksld-btn--primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
              </div>
            )}
          </>
        )}
        {phase.kind === "ready" && (
          <form onSubmit={onSubmit} data-testid="presenter-form">
            <h1>Presenter demo</h1>
            <p>{phase.store.presenterName ? `Signed in as ${phase.store.presenterName}. ` : ""}A hands-on demo with no pop-ups: you drive it. Everything is sample data and nothing is sent anywhere.</p>
            <label className="ksld-present-label" htmlFor="presenter-prospect-name">Prospect's name</label>
            <input id="presenter-prospect-name" className="ksld-present-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" placeholder="e.g. Dana Fraser" />
            <label className="ksld-present-label" htmlFor="presenter-prospect-company">Brokerage</label>
            <input id="presenter-prospect-company" className="ksld-present-input" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} autoComplete="off" placeholder="e.g. Prairie Capital Brokers" />
            <p className="ksld-present-hint">The portal greets them by name and carries the brokerage's name, as if it were their own copy.</p>
            <div className="ksld-present-actions">
              <button type="submit" className="ksld-btn ksld-btn--primary" data-testid="presenter-start-button">Start the demo</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
