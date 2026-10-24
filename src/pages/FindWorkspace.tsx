// KS_STAFF_DIRECTORY_v1 - the iPad app's first sign-in step: "Enter your work email or mobile number". Keystone
// operations answers which brokerage(s) the person works for; one answer goes straight on, several show a list. The
// company code is a hidden fallback for anyone who has one ("Enter company code instead").
import { FormEvent, useState } from "react";
import BrandLogo from "@/components/brand/BrandLogo";
import {
  DirectoryError, chooseWorkspace, findByCompanyCode, findWorkspaces, looksLikeIdentifier, phoneFrom, type Workspace,
} from "@/config/workspace";

type Mode = "identifier" | "pick" | "code";

const MESSAGES = {
  none: "We couldn't find a Keystone account for that email or number. Check it, or ask your administrator to add you.",
  rate_limited: "Too many tries. Please wait a few minutes and try again.",
  unavailable: "We couldn't reach Keystone. Check your connection and try again.",
  code: "We couldn't find that company code. Check it with your administrator.",
};

export default function FindWorkspace({ fetchImpl, reload }: { fetchImpl?: typeof fetch; reload?: (path: string) => void } = {}) {
  const [mode, setMode] = useState<Mode>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [matches, setMatches] = useState<Workspace[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (w: Workspace) => chooseWorkspace(w, { prefillPhone: phoneFrom(identifier), reload });

  const failure = (err: unknown) => setError(MESSAGES[err instanceof DirectoryError ? err.kind : "unavailable"]);

  const submitIdentifier = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || !looksLikeIdentifier(identifier)) return;
    setBusy(true);
    setError(null);
    try {
      const found = await findWorkspaces(identifier, fetchImpl);
      if (found.length === 0) setError(MESSAGES.none);
      else if (found.length === 1) go(found[0]!);
      else {
        setMatches(found);
        setMode("pick");
      }
    } catch (err) {
      failure(err);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const found = await findByCompanyCode(code, fetchImpl);
      if (found) go(found);
      else setError(MESSAGES.code);
    } catch (err) {
      failure(err);
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (next: Mode) => {
    setError(null);
    setMode(next);
  };

  const inputClass =
    "w-full px-3.5 py-3 text-base text-slate-900 bg-white border border-slate-300 rounded-lg mb-3 box-border focus:outline-none focus:ring-2 focus:ring-amber-500";
  const buttonClass =
    "w-full py-3.5 px-5 text-[17px] font-bold text-slate-900 bg-amber-500 hover:bg-amber-600 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed";
  const linkClass = "mt-3 w-full text-center text-sm font-medium text-slate-600 underline underline-offset-2";

  return (
    <div data-testid="find-workspace" className="min-h-screen w-screen flex items-center justify-center bg-[#020817] px-4 py-12">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <div className="text-center">
          <BrandLogo height={56} style={{ margin: "0 auto 16px" }} />
          <h1 className="text-2xl font-semibold text-white">Sign in</h1>
          <p className="mt-1 text-sm font-medium text-white/70">Staff Portal</p>
        </div>

        {mode === "identifier" ? (
          <form className="w-full bg-white border border-slate-200 rounded-xl p-6 shadow-md" onSubmit={submitIdentifier}>
            <label htmlFor="staff-identifier" className="block text-sm text-slate-700 mb-1.5">
              Work email or mobile number
            </label>
            <input
              id="staff-identifier"
              data-testid="identifier-input"
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              autoFocus
              placeholder="you@company.com or (555) 000-0000"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={inputClass}
            />
            {error ? <p className="text-sm text-red-700 mb-2" role="alert">{error}</p> : null}
            <button data-testid="identifier-continue" type="submit" disabled={busy || !looksLikeIdentifier(identifier)} className={buttonClass}>
              {busy ? "Finding your company…" : "Continue"}
            </button>
            <p className="text-xs text-slate-500 mt-2.5 mb-0 text-center">We'll find your company, then text you a sign-in code.</p>
            <button type="button" data-testid="use-company-code" onClick={() => switchTo("code")} className={linkClass}>
              Enter company code instead
            </button>
          </form>
        ) : null}

        {mode === "pick" ? (
          <div className="w-full bg-white border border-slate-200 rounded-xl p-6 shadow-md" data-testid="workspace-picker">
            <p className="text-sm text-slate-700 mb-3">You work with more than one company. Which one do you want to sign in to?</p>
            <ul className="flex flex-col gap-2">
              {matches.map((m) => (
                <li key={m.server_url}>
                  <button
                    type="button"
                    onClick={() => go(m)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-slate-300 text-base font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    {m.name}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => switchTo("identifier")} className={linkClass}>
              Use a different email or number
            </button>
          </div>
        ) : null}

        {mode === "code" ? (
          <form className="w-full bg-white border border-slate-200 rounded-xl p-6 shadow-md" onSubmit={submitCode}>
            <label htmlFor="company-code" className="block text-sm text-slate-700 mb-1.5">
              Company code
            </label>
            <input
              id="company-code"
              data-testid="company-code-input"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={inputClass}
            />
            {error ? <p className="text-sm text-red-700 mb-2" role="alert">{error}</p> : null}
            <button type="submit" data-testid="company-code-continue" disabled={busy || !code.trim()} className={buttonClass}>
              {busy ? "Checking…" : "Continue"}
            </button>
            <button type="button" onClick={() => switchTo("identifier")} className={linkClass}>
              Use my email or mobile number
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
