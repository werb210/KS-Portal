// KS_PORTAL_v11_LIVE_DEMO - an iPhone status bar (time, signal, Wi-Fi, battery) in inline SVG.
export default function StatusBar({ dark = true }: { dark?: boolean }) {
  const c = dark ? "#fff" : "#000";
  return (
    <div className="ksld-statusbar" style={{ color: c }}>
      <span>9:41</span>
      <span className="ksld-statusbar-icons" aria-hidden="true">
        <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill={c} /><rect x="5" y="5" width="3" height="6" rx="1" fill={c} /><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill={c} /><rect x="15" y="0" width="3" height="11" rx="1" fill={c} /></svg>
        <svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.3 10.3 0 0 0 8 .4C5.2.4 2.7 1.5.8 3.3L2 4.6a8.5 8.5 0 0 1 6-2.4zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.3-1.3A6.6 6.6 0 0 0 8 4c-1.8 0-3.5.7-4.7 1.8l1.3 1.3c.9-.8 2.1-1.3 3.4-1.3zM8 11l2.2-2.2a3.1 3.1 0 0 0-4.4 0z" fill={c} /></svg>
        <svg width="27" height="12" viewBox="0 0 27 12"><rect x="0.5" y="0.5" width="23" height="11" rx="3.5" fill="none" stroke={c} opacity="0.5" /><rect x="2" y="2" width="18" height="8" rx="2" fill={c} /><rect x="24.5" y="4" width="2" height="4" rx="1" fill={c} opacity="0.5" /></svg>
      </span>
    </div>
  );
}
