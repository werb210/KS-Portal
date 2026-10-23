// KS_PORTAL_v8_DEMO - the self-serve demo at /demo. Opened from the magic link (#d=<id>&t=<token>), it greets the
// prospect by name and company and runs the guided walkthrough beside a portal that shows only their own sample file.
// It is separate from the real portal: no sign-in, no MSAL, no service worker; it talks only to KS-Ops (to open the
// session) and the demo server. The file updates live by polling, the way the portal's other live views do.
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import "./demo.css";
import { C } from "./palette";
import { DemoApiError, demoClient, loadStoredSession, openDemoWithRetry, parseMagicLink, storeSession, type DemoSessionInfo, type DemoState } from "./demoApi";
import { STEPS, stepIndex, type StepKey, type Tab } from "./steps";
import Walkthrough from "./Walkthrough";
import { BorrowerPanel, OnScreenBorrower } from "./BorrowerPanel";
import CallSimulator from "./CallSimulator";
import { CreditPanel, DocumentsPanel, FinancialsPanel, LendersPanel, OverviewPanel, PipelinePanel } from "./Panels";

export const POLL_MS = 2000;

const vars = {
  "--ksd-page": C.page, "--ksd-surface": C.surface, "--ksd-border": C.border, "--ksd-text": C.text, "--ksd-muted": C.muted,
  "--ksd-primary": C.primary, "--ksd-primary-text": C.primaryText, "--ksd-header": C.header, "--ksd-header-text": C.headerText,
  "--ksd-header-muted": C.headerMuted, "--ksd-tour": C.tour, "--ksd-tour-text": C.tourText, "--ksd-tour-accent": C.tourAccent,
  "--ksd-track": C.track, "--ksd-success": C.success, "--ksd-success-text": C.successText, "--ksd-danger": C.danger,
  "--ksd-danger-text": C.dangerText, "--ksd-phone": C.phone, "--ksd-phone-text": C.phoneText, "--ksd-phone-muted": C.phoneMuted,
  "--ksd-chip-neutral-bg": C.chipNeutralBg, "--ksd-chip-neutral-text": C.chipNeutralText, "--ksd-live-bg": C.liveBg, "--ksd-live-text": C.liveText,
} as CSSProperties;

const TABS: Array<[Tab, string]> = [
  ["pipeline", "Pipeline"], ["overview", "File"], ["documents", "Documents"], ["financials", "Financials"], ["credit", "Credit summary"], ["lenders", "Lenders"],
];

type Boot = { kind: "loading"; waking?: boolean } | { kind: "ready"; info: DemoSessionInfo } | { kind: "error"; title: string; message: string };

function Shell({ children, info }: { children: ReactNode; info?: { name: string; company: string; expires_at: string } }) {
  return (
    <div className="ksd" style={vars}>
      <header className="ksd-header">
        <div className="ksd-brand"><span className="ksd-brand-mark" aria-hidden="true" />Keystone <span className="ksd-pill">Demo</span></div>
        {info && (
          <div className="ksd-header-meta">
            <strong>{info.name}</strong> · {info.company} · demo open until {new Date(info.expires_at).toLocaleDateString()}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

function Message({ title, message }: { title: string; message: string }) {
  return (
    <Shell>
      <div className="ksd-center"><div className="ksd-card" role="alert"><h1 style={{ fontSize: 22 }}>{title}</h1><p>{message}</p></div></div>
    </Shell>
  );
}

export default function DemoApp({ fetchImpl = fetch }: { fetchImpl?: typeof fetch }) {
  const [boot, setBoot] = useState<Boot>({ kind: "loading" });
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true } } }));

  useEffect(() => {
    let alive = true;
    const link = parseMagicLink(window.location.hash);
    (async () => {
      if (link) {
        try {
          const info = await openDemoWithRetry(link, { fetchImpl, onWaiting: () => { if (alive) setBoot({ kind: "loading", waking: true }); } });
          storeSession(info);
          window.history.replaceState(null, "", "/demo");
          if (alive) setBoot({ kind: "ready", info });
        } catch (err) {
          const e = err instanceof DemoApiError ? err : new DemoApiError(0, "network", "We could not reach the demo. Check your connection and open the link again in a minute.");
          const title = e.status === 410 ? "This demo has ended" : e.status === 404 ? "This link is not valid" : "The demo could not start";
          if (alive) setBoot({ kind: "error", title, message: e.message });
        }
        return;
      }
      const stored = loadStoredSession();
      if (alive) setBoot(stored ? { kind: "ready", info: stored } : { kind: "error", title: "Open your demo from your email", message: "Use the link we emailed you to open your private demo. No email? Ask for a demo on our website." });
    })();
    return () => { alive = false; };
  }, [fetchImpl]);

  if (boot.kind === "loading") {
    return (
      <Shell>
        <div className="ksd-center">
          <p aria-live="polite">{boot.waking ? "Starting your demo - this can take up to a minute. Keep this page open." : "Opening your demo..."}</p>
        </div>
      </Shell>
    );
  }
  if (boot.kind === "error") return <Message title={boot.title} message={boot.message} />;
  return (
    <QueryClientProvider client={client}>
      <Workspace info={boot.info} fetchImpl={fetchImpl} onEnded={() => { storeSession(null); setBoot({ kind: "error", title: "This demo has ended", message: "Its sample data has been wiped. You can start a new demo from our website." }); }} />
    </QueryClientProvider>
  );
}

export function Workspace({ info, fetchImpl = fetch, onEnded }: { info: DemoSessionInfo; fetchImpl?: typeof fetch; onEnded: () => void }) {
  const api = useMemo(() => demoClient(info, fetchImpl), [info, fetchImpl]);
  const q = useQuery<DemoState, Error>({ queryKey: ["demo-state", info.staff_token], queryFn: () => api.state(), refetchInterval: POLL_MS });
  const [tab, setTab] = useState<Tab>("pipeline");
  const [busy, setBusy] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const refresh = useCallback(() => { void q.refetch(); }, [q]);
  const state = q.data;
  const current = state?.session.walkthrough.current;

  useEffect(() => { void api.opened().catch(() => undefined); }, [api]);
  useEffect(() => {
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void api.heartbeat(60); }, 60_000);
    return () => window.clearInterval(t);
  }, [api]);
  useEffect(() => {
    const err = q.error;
    if (err instanceof DemoApiError && err.status === 401) onEnded();
  }, [q.error, onEnded]);
  // Each step shows its part of the portal.
  useEffect(() => { if (current) setTab(STEPS[stepIndex(current)]!.tab); }, [current]);

  const onAction = useCallback(async (action: "view" | "complete" | "skip" | "skip_tour" | "resume_tour", step?: StepKey) => {
    setBusy(true);
    try { await api.walkthrough(action, step); await q.refetch(); } finally { setBusy(false); }
  }, [api, q]);

  if (!state) {
    return <Shell info={info}><div className="ksd-center"><p aria-live="polite">{q.error ? q.error.message : "Loading your demo..."}</p></div></Shell>;
  }
  const tourHidden = state.session.walkthrough.tour_skipped;
  const showBorrower = tourHidden || ["welcome", "borrower", "application"].includes(current ?? "");
  const showCall = tourHidden || current === "call" || (state.application?.call?.status === "completed" && current === "financials");

  return (
    <Shell info={{ name: state.session.name, company: state.session.company, expires_at: state.session.expires_at }}>
      <div className="ksd-layout">
        <main className="ksd-card" aria-label="Your portal">
          <div className="ksd-tabs" role="tablist" aria-label="Portal sections">
            {TABS.map(([key, label]) => (
              <button key={key} type="button" role="tab" className="ksd-tab" aria-selected={tab === key} onClick={() => { setTab(key); void api.track(`tab_${key}`); }}>{label}</button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === "pipeline" && <PipelinePanel state={state} onOpen={() => setTab("overview")} />}
            {tab === "overview" && <OverviewPanel state={state} />}
            {tab === "documents" && <DocumentsPanel state={state} api={api} onChanged={refresh} />}
            {tab === "financials" && <FinancialsPanel state={state} api={api} onChanged={refresh} />}
            {tab === "credit" && <CreditPanel state={state} api={api} onChanged={refresh} />}
            {tab === "lenders" && <LendersPanel state={state} api={api} onChanged={refresh} />}
          </div>
        </main>
        <aside className="ksd-side" aria-label="Guided tour and devices">
          <Walkthrough state={state} busy={busy} onAction={(a, s) => void onAction(a, s)} />
          {showBorrower && <BorrowerPanel state={state} api={api} onScreen={onScreen} setOnScreen={setOnScreen} />}
          {showBorrower && onScreen && <OnScreenBorrower api={api} />}
          {showCall && <CallSimulator state={state} api={api} active={current === "call" || tourHidden} onChanged={refresh} />}
        </aside>
      </div>
    </Shell>
  );
}
