// KS_PORTAL_v13_PHONE_DEMO - the guidance on a phone: a sheet along the bottom (at the side in landscape) with the step
// number, the title, a short text and Back / Next. It never lies over the app: the page above it is laid out in the
// space that is left (see .ksld-ph in liveDemo.css), so whatever is highlighted can always be scrolled into view. It
// collapses to a slim bar that keeps Next. Text is 15px and up, buttons 44px and up.
import { useId, type ReactNode } from "react";
import EmailLinkButton from "./EmailLinkButton";

export type SheetAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  testId?: string;
  kind?: "primary" | "ghost";
};

export type PhoneSheetProps = {
  count: string;
  title: string;
  body?: ReactNode;
  notes?: ReactNode;
  actions: SheetAction[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onExit?: () => void;
  /** Extra controls in the top row (the camera's Whole page / Re-centre). */
  tools?: ReactNode;
  testId?: string;
};

function ActionButton({ a }: { a: SheetAction }) {
  const cls = `ksld-ph-btn ksld-ph-btn--${a.kind ?? "primary"}`;
  if (a.href) {
    return <a className={cls} href={a.href} data-testid={a.testId}>{a.label}</a>;
  }
  return (
    <button type="button" className={cls} onClick={a.onClick} disabled={a.disabled} data-testid={a.testId}>
      {a.label}
    </button>
  );
}

export default function PhoneSheet({ count, title, body, notes, actions, collapsed, onCollapsedChange, onExit, tools, testId = "live-demo-sheet" }: PhoneSheetProps) {
  const titleId = useId();
  const primary = actions[actions.length - 1];
  if (collapsed) {
    return (
      <section className="ksld-ph-sheet ksld-ph-sheet--slim" aria-labelledby={titleId} data-testid={testId} data-collapsed="1">
        <button type="button" className="ksld-ph-grip" onClick={() => onCollapsedChange(false)} aria-expanded="false" data-testid="live-demo-sheet-toggle">
          <span className="ksld-ph-chevron ksld-ph-chevron--up" aria-hidden="true" />
          <span className="ksld-ph-slim-text">
            <span className="ksld-ph-slim-count">{count}</span>
            <span id={titleId} className="ksld-ph-slim-title">{title}</span>
          </span>
          <span className="ksld-ph-visually-hidden">Show the step</span>
        </button>
        {primary ? <ActionButton a={primary} /> : null}
      </section>
    );
  }
  return (
    <section className="ksld-ph-sheet" aria-labelledby={titleId} aria-live="polite" data-testid={testId} data-collapsed="0">
      <div className="ksld-ph-sheet-top">
        <span className="ksld-ph-count" data-testid="live-demo-sheet-count">{count}</span>
        {tools ? <div className="ksld-ph-tools">{tools}</div> : null}
        <button type="button" className="ksld-ph-hide" onClick={() => onCollapsedChange(true)} aria-expanded="true" data-testid="live-demo-sheet-toggle">
          <span className="ksld-ph-chevron" aria-hidden="true" />
          Hide
        </button>
      </div>
      <div className="ksld-ph-sheet-scroll">
        <h2 id={titleId} className="ksld-ph-title">{title}</h2>
        {body ? <div className="ksld-ph-body">{body}</div> : null}
        {notes}
      </div>
      <div className="ksld-ph-actions">
        {actions.map((a) => <ActionButton key={a.label + (a.testId ?? "")} a={a} />)}
      </div>
      <div className="ksld-ph-sheet-foot">
        <EmailLinkButton variant="link" />
        {onExit ? <button type="button" className="ksld-ph-link" onClick={onExit}>Exit demo</button> : null}
      </div>
    </section>
  );
}
