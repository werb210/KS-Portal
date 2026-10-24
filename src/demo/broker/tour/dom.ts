// KS_PORTAL_v11_LIVE_DEMO - finding things on the real portal screens, and pressing them the way a person would.

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Polls until `fn` returns something truthy (or throws after `timeoutMs`). */
export async function waitFor<T>(fn: () => T | null | undefined | false, timeoutMs = 8000, everyMs = 60): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > until) throw new Error("The demo could not find that on the screen.");
    await sleep(everyMs);
  }
}

const textOf = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

/** Buttons whose visible text is exactly `label`, inside `root`. */
export function buttonsLabelled(label: string, root: ParentNode = document): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll("button")).filter((b) => textOf(b) === label);
}

/** The smallest element whose whole text is `text`. */
export function elementWithText(text: string, root: ParentNode = document, selector = "div,span,h1,h2,h3,strong"): HTMLElement | null {
  const all = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((e) => textOf(e) === text);
  return all[all.length - 1] ?? null;
}

export function press(el: Element | null | undefined): boolean {
  if (!el) return false;
  (el as HTMLElement).click();
  return true;
}

export function reveal(el: Element | null | undefined, block: ScrollLogicalPosition = "nearest"): void {
  if (el && typeof (el as HTMLElement).scrollIntoView === "function") {
    try {
      (el as HTMLElement).scrollIntoView({ block, behavior: "smooth" });
    } catch {
      /* old browsers */
    }
  }
}
