// KS_PORTAL_SSO_API_KEYS - "Sign in with Microsoft / Google" on the staff sign-in page, shown only for the providers
// this brokerage has switched on (Pro). Also finishes the sign-in when the server sends the browser back here with a
// one-time code. Not shown in the iPad app: the provider's pages would open outside the app.
import { useEffect, useRef, useState } from "react";
import { isNativeApp } from "@/config/workspace";
import {
  PROVIDER_LABEL, SSO_OFF, exchangeSsoCode, fetchSsoConfig, readSsoReturn, ssoErrorText, ssoStartUrl,
  type SsoConfig, type SsoProvider,
} from "@/auth/sso";

type Props = {
  /** Test seams. */
  loadConfig?: () => Promise<SsoConfig>;
  exchange?: (code: string) => Promise<void>;
  onSignedIn?: () => void;
  native?: boolean;
};

function MicrosoftMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function SsoButtons({ loadConfig = fetchSsoConfig, exchange = exchangeSsoCode, onSignedIn, native }: Props) {
  const isNative = native ?? isNativeApp();
  const [config, setConfig] = useState<SsoConfig>(SSO_OFF);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const exchanged = useRef(false);

  useEffect(() => {
    if (isNative) return;
    let live = true;
    const back = readSsoReturn(window.location);
    if (back.error) setError(ssoErrorText(back.error));
    if (back.code && !exchanged.current) {
      exchanged.current = true;
      // The code is single-use: take it out of the address bar before anything else.
      window.history.replaceState(null, "", window.location.pathname);
      setFinishing(true);
      exchange(back.code)
        .then(() => {
          if (onSignedIn) onSignedIn();
          else window.location.href = "/dashboard";
        })
        .catch((e: unknown) => {
          if (!live) return;
          setFinishing(false);
          setError(e instanceof Error && e.message ? e.message : "Single sign-on didn't work. Please try again.");
        });
    }
    void loadConfig().then((c) => { if (live) setConfig(c); });
    return () => { live = false; };
  }, [isNative, loadConfig, exchange, onSignedIn]);

  if (isNative) return null;
  const providers = (["microsoft", "google"] as SsoProvider[]).filter((p) => config[p]);
  if (!providers.length && !error && !finishing) return null;

  return (
    <div className="w-full max-w-md flex flex-col gap-3" data-testid="sso-buttons">
      {finishing ? (
        <p role="status" className="text-sm text-white text-center">Finishing sign-in…</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-900 bg-red-100 border border-red-300 rounded-lg px-3 py-2">{error}</p>
      ) : null}
      {providers.length ? (
        <>
          <div className="flex items-center gap-3 text-xs text-white/80" aria-hidden="true">
            <span className="flex-1 h-px bg-white/30" />
            <span>or</span>
            <span className="flex-1 h-px bg-white/30" />
          </div>
          {providers.map((p) => (
            <a
              key={p}
              href={ssoStartUrl(p)}
              data-testid={`sso-${p}`}
              className="w-full flex items-center justify-center gap-3 py-3 px-5 text-[15px] font-semibold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg no-underline"
            >
              {p === "microsoft" ? <MicrosoftMark /> : <GoogleMark />}
              <span>Sign in with {PROVIDER_LABEL[p]}</span>
            </a>
          ))}
          {config.require_sso ? (
            <p className="text-xs text-white/80 text-center m-0">Staff sign in with single sign-on. Admins can still use a text code.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
