// KS_PORTAL_v13_PHONE_DEMO - the live demo on a phone. A computer and an iPad keep the phone frame with the side panel
// and the portal with its pop-up cards, exactly as before. A phone instead gets:
//   - the client app full screen with the guidance in a bottom sheet (/demo),
//   - the broker side as a "camera" over the real portal at a desktop width (/demo/broker),
//   - the incoming call as the real iPhone call screen,
//   - "Email me the link for my computer".
// Everything here is pure arithmetic so it is tested at the sizes people use (see __tests__/phone.v13.test.ts).

/** Below this width the demo is phone-shaped (the old narrow breakpoint, so an iPad mini in portrait stays as it was). */
export const PHONE_MAX_W = 700;
/** A touch screen whose short side is below this is a phone held sideways. */
export const PHONE_MAX_SHORT_SIDE = 500;

export type ViewportInfo = { w: number; h: number; coarse: boolean };

export function viewportInfo(win: Window = window): ViewportInfo {
  let coarse = false;
  try {
    coarse = Boolean(win.matchMedia?.("(pointer: coarse)")?.matches);
  } catch {
    coarse = false;
  }
  return { w: win.innerWidth || 0, h: win.innerHeight || 0, coarse };
}

/** A phone: a narrow window, or a touch screen with a short side under 500px (a phone in landscape). */
export function isPhoneViewport(v: ViewportInfo = viewportInfo()): boolean {
  if (v.w <= 0) return false;
  if (v.w < PHONE_MAX_W) return true;
  return v.coarse && Math.min(v.w, v.h) < PHONE_MAX_SHORT_SIDE;
}

/** Landscape phones put the guidance at the side instead of the bottom. */
export function isLandscape(v: { w: number; h: number }): boolean {
  return v.w > v.h;
}

// ---------------------------------------------------------------- the broker "camera"

/** The portal is laid out at this width (its desktop layout) and zoomed. */
export const LAYOUT_W = 1280;
export const MIN_LAYOUT_H = 720;
/** Text in the framed region is drawn at least this big on the phone. */
export const READABLE_PX = 16;
export const MAX_SCALE = 2.4;
export const FRAME_PAD = 12;

export type Box = { top: number; left: number; width: number; height: number };
export type Camera = { scale: number; x: number; y: number };

/** The portal's layout height for a phone: the phone's shape at the desktop width, never shorter than a laptop. */
export function layoutHeight(vw: number, vh: number): number {
  if (vw <= 0 || vh <= 0) return MIN_LAYOUT_H;
  return Math.max(MIN_LAYOUT_H, Math.round((LAYOUT_W * vh) / vw));
}

/** The smallest zoom: the whole page in the stage. */
export function overviewScale(stage: { w: number; h: number }, layout: { w: number; h: number }): number {
  return Math.min(stage.w / layout.w, stage.h / layout.h);
}

/** Keeps a scroll position inside the zoomed page (the page smaller than the stage is pinned at 0). */
export function clampPan(cam: Camera, stage: { w: number; h: number }, layout: { w: number; h: number }): Camera {
  const maxX = Math.max(0, layout.w * cam.scale - stage.w);
  const maxY = Math.max(0, layout.h * cam.scale - stage.h);
  return { scale: cam.scale, x: Math.min(maxX, Math.max(0, cam.x)), y: Math.min(maxY, Math.max(0, cam.y)) };
}

/**
 * Where the camera goes for a highlighted region (in the portal's layout pixels): zoomed so the region fills the stage
 * width with padding, but never so small that its text reads under READABLE_PX (`fontPx`: the region's usual text
 * size). A region wider or taller than the stage at that zoom is shown from its top-left corner (the person can pan).
 */
export function frameRegion(
  region: Box | null,
  stage: { w: number; h: number },
  layout: { w: number; h: number },
  fontPx = 14,
): Camera {
  const minScale = overviewScale(stage, layout);
  if (!region || region.width <= 0 || region.height <= 0) return clampPan({ scale: minScale, x: 0, y: 0 }, stage, layout);
  const fit = Math.min((stage.w - FRAME_PAD * 2) / region.width, (stage.h - FRAME_PAD * 2) / region.height);
  const readable = READABLE_PX / Math.max(8, fontPx);
  const scale = Math.min(MAX_SCALE, Math.max(minScale, readable, Math.min(fit, Math.max(readable * 1.35, 1.25))));
  const w = region.width * scale;
  const h = region.height * scale;
  const x = w + FRAME_PAD * 2 <= stage.w ? region.left * scale - (stage.w - w) / 2 : region.left * scale - FRAME_PAD;
  const y = h + FRAME_PAD * 2 <= stage.h ? region.top * scale - (stage.h - h) / 2 : region.top * scale - FRAME_PAD;
  return clampPan({ scale, x, y }, stage, layout);
}

/** How much of the region the stage shows at this camera (0-1). */
export function visibleShare(region: Box, cam: Camera, stage: { w: number; h: number }): number {
  const l = region.left * cam.scale - cam.x;
  const t = region.top * cam.scale - cam.y;
  const r = l + region.width * cam.scale;
  const b = t + region.height * cam.scale;
  const iw = Math.max(0, Math.min(r, stage.w) - Math.max(l, 0));
  const ih = Math.max(0, Math.min(b, stage.h) - Math.max(t, 0));
  const area = region.width * cam.scale * region.height * cam.scale;
  return area > 0 ? (iw * ih) / area : 0;
}

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** A step of the camera's move from `a` to `b` at time t (0-1). */
export function tween(a: Camera, b: Camera, t: number): Camera {
  const k = easeInOut(Math.max(0, Math.min(1, t)));
  return { scale: a.scale + (b.scale - a.scale) * k, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/** The usual text size inside some elements: the median font size of their visible text, weighted by length. */
export function typicalFontPx(els: Element[], win: Window): number {
  const sizes: Array<[number, number]> = [];
  const walk = (el: Element, depth: number) => {
    if (depth > 12 || sizes.length > 400) return;
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3) {
        const len = (node.textContent ?? "").trim().length;
        if (len) {
          const px = parseFloat(win.getComputedStyle(el).fontSize || "14");
          if (Number.isFinite(px)) sizes.push([px, len]);
        }
      } else if (node.nodeType === 1) walk(node as Element, depth + 1);
    }
  };
  for (const el of els) walk(el, 0);
  if (!sizes.length) return 14;
  sizes.sort((a, b) => a[0] - b[0]);
  const total = sizes.reduce((s, [, n]) => s + n, 0);
  let acc = 0;
  for (const [px, n] of sizes) {
    acc += n;
    if (acc >= total / 2) return px;
  }
  return sizes[sizes.length - 1]![0];
}

/** "t***@example.com" (KS-Ops masks it the same way; used when it answers without one). */
export function maskEmail(email: string | null | undefined): string {
  const e = String(email ?? "").trim();
  const at = e.lastIndexOf("@");
  return at < 1 ? "your email" : `${e[0]}***${e.slice(at)}`;
}
