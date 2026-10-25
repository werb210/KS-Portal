// KS_PORTAL_v14_BRAND_FONT - the licensee's background colour and font (GET /api/licensee: background_color,
// font_family) in the staff portal. The font applies in both themes. The background replaces the light theme's panel
// colour (--panel-bg) only: the dark theme keeps its own surfaces so its light text stays readable. A background too
// dark for the light theme's text is lightened until body and muted text both reach 4.5 to 1.

const HEX = /^#[0-9a-f]{6}$/i;
export const FONT_NAME = /^[A-Za-z0-9][A-Za-z0-9 -]{0,59}$/;
const LIGHT_TEXT = ["#0B1F3A", "#51617D"];
const SYSTEM_FONTS = new Set(["arial", "helvetica", "georgia", "verdana", "tahoma", "trebuchet ms", "times new roman", "system-ui"]);

function rgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function lum(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

/** The background for the light theme: the licensee's, lightened until the text reads on it; null when unset. */
export function readableBackground(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim();
  if (!HEX.test(v)) return null;
  let c = rgb(v);
  for (let i = 0; i < 60; i++) {
    const hex = toHex(c);
    if (LIGHT_TEXT.every((t) => contrast(hex, t) >= 4.5)) return hex;
    c = c.map((x) => x + (255 - x) * 0.1);
  }
  return "#FFFFFF";
}

export function fontStack(family: string): string {
  return `"${family}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

export function googleFontHref(family: string): string | null {
  if (!FONT_NAME.test(family) || SYSTEM_FONTS.has(family.toLowerCase())) return null;
  return `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@400;500;600;700&display=swap`;
}

/** The CSS for the licensee's theme ("" when nothing is set). */
export function brandThemeCss(b: { background_color?: string | null; font_family?: string | null }): string {
  const out: string[] = [];
  const bg = readableBackground(b.background_color);
  if (bg) {
    const vars = `--panel-bg: ${bg}; --ui-surface-muted: ${bg};`;
    out.push(`:root[data-theme="light"] { ${vars} }`);
    out.push(`@media (prefers-color-scheme: light) { :root:not([data-theme]) { ${vars} } }`);
  }
  const family = String(b.font_family ?? "").trim();
  if (family && FONT_NAME.test(family)) out.push(`:root, body, button, input, select, textarea { font-family: ${fontStack(family)}; }`);
  return out.join("\n");
}

export function applyBrandTheme(b: { background_color?: string | null; font_family?: string | null }, doc: Document | undefined = typeof document !== "undefined" ? document : undefined): void {
  if (!doc?.head) return;
  const css = brandThemeCss(b);
  let style = doc.getElementById("ks-brand-theme") as HTMLStyleElement | null;
  if (!css) {
    style?.remove();
  } else {
    if (!style) {
      style = doc.createElement("style");
      style.id = "ks-brand-theme";
      doc.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }
  const href = googleFontHref(String(b.font_family ?? "").trim());
  let link = doc.getElementById("ks-brand-font") as HTMLLinkElement | null;
  if (!href) {
    link?.remove();
    return;
  }
  if (!link) {
    link = doc.createElement("link");
    link.id = "ks-brand-font";
    link.rel = "stylesheet";
    doc.head.appendChild(link);
  }
  if (link.getAttribute("href") !== href) link.setAttribute("href", href);
}
