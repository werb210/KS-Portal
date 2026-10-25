// KS_PORTAL_v12_CARD_PLACEMENT - where the tour's pop-up card goes, so it never covers what it is talking about.
//   1. Beside the highlight, on the side with the most free space (below / above / right / left). Beside it, the card
//      may narrow to MIN_W so it fits a gap such as the sidebar next to a wide table.
//   2. When no side has room, the screen corner that overlaps the highlight least (ties: the one farthest from it).
// On a narrow screen the card is a sheet across the bottom, moved to the top when the highlight is at the bottom.
// Pure arithmetic, so it is tested for every broker step at the sizes people use (see __tests__).

export type Box = { top: number; left: number; width: number; height: number };
export type Placement = { top: number; left: number; width: number; side: "below" | "above" | "right" | "left" | "corner" | "sheet-bottom" | "sheet-top" };

export const CARD_W = 360;
export const MIN_W = 220;
export const GAP = 16;
export const MARGIN = 12;
export const NARROW = 700;

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

/**
 * @param target the highlighted area (already including the spotlight's padding), or null
 * @param card the card's measured size at its current width (its height grows as it narrows)
 * @param vp the window
 */
export function placeCard(target: Box | null, card: { w: number; h: number }, vp: { w: number; h: number }): Placement {
  const natW = Math.min(CARD_W, vp.w - MARGIN * 2);
  // Text reflows: the same words at a narrower width take proportionally more height.
  const heightAt = (w: number) => Math.ceil((card.h * Math.max(card.w, 1)) / Math.max(w, 1));

  if (vp.w < NARROW) {
    const w = vp.w - MARGIN * 2;
    const h = heightAt(w);
    const bottomTop = vp.h - MARGIN - h;
    const bottom: Box = { top: bottomTop, left: MARGIN, width: w, height: h };
    if (target && overlap(bottom, target) > 0) {
      const top: Box = { top: MARGIN, left: MARGIN, width: w, height: h };
      if (overlap(top, target) < overlap(bottom, target)) return { top: MARGIN, left: MARGIN, width: w, side: "sheet-top" };
    }
    return { top: Math.max(MARGIN, bottomTop), left: MARGIN, width: w, side: "sheet-bottom" };
  }

  const h = heightAt(natW);
  const clampLeft = (l: number, w: number) => Math.max(MARGIN, Math.min(vp.w - w - MARGIN, l));
  const clampTop = (t: number, hh: number) => Math.max(MARGIN, Math.min(vp.h - hh - MARGIN, t));

  if (!target) return { top: vp.h - h - 24, left: vp.w - natW - 24, width: natW, side: "corner" };

  const t = target;
  const below = vp.h - MARGIN - (t.top + t.height + GAP);
  const above = t.top - GAP - MARGIN;
  const right = vp.w - MARGIN - (t.left + t.width + GAP);
  const left = t.left - GAP - MARGIN;

  type Option = { area: number; p: Placement };
  const options: Option[] = [];
  if (below >= h) options.push({ area: below * vp.w, p: { side: "below", top: t.top + t.height + GAP, left: clampLeft(t.left, natW), width: natW } });
  if (above >= h) options.push({ area: above * vp.w, p: { side: "above", top: t.top - GAP - h, left: clampLeft(t.left, natW), width: natW } });
  for (const [side, space] of [["right", right], ["left", left]] as const) {
    if (space < MIN_W) continue;
    const w = Math.min(natW, Math.floor(space));
    const hh = heightAt(w);
    if (hh > vp.h - MARGIN * 2) continue;
    options.push({
      area: space * vp.h,
      p: { side, width: w, top: clampTop(t.top, hh), left: side === "right" ? t.left + t.width + GAP : t.left - GAP - w },
    });
  }
  if (options.length) return options.sort((a, b) => b.area - a.area)[0]!.p;

  // No room beside it: the corner that covers it least, then the farthest from it.
  const cx = t.left + t.width / 2;
  const cy = t.top + t.height / 2;
  const corners: Box[] = [
    { top: MARGIN, left: MARGIN, width: natW, height: h },
    { top: MARGIN, left: vp.w - natW - MARGIN, width: natW, height: h },
    { top: vp.h - h - MARGIN, left: MARGIN, width: natW, height: h },
    { top: vp.h - h - MARGIN, left: vp.w - natW - MARGIN, width: natW, height: h },
  ];
  const dist = (b: Box) => Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy);
  const best = corners.sort((a, b) => overlap(a, t) - overlap(b, t) || dist(b) - dist(a))[0]!;
  return { side: "corner", top: Math.max(MARGIN, best.top), left: best.left, width: natW };
}

/** How much of `target` the card at `p` (with height `h`) would cover, in square pixels. */
export function coveredArea(p: Placement, h: number, target: Box): number {
  return overlap({ top: p.top, left: p.left, width: p.width, height: h }, target);
}
