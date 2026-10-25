// KS_PORTAL_v12_CARD_PLACEMENT - the tour card never covers what it highlights. The highlight boxes below were
// measured in a real browser on the live broker tour (spotlight padding included) at 1280x800, 1440x900 and on iPad
// widths; every one must leave the card fully on screen and clear of the highlight.
import { describe, expect, it } from "vitest";
import { MIN_W, coveredArea, placeCard, type Box } from "../broker/tour/placement";
import { unionRect } from "../broker/tour/BrokerTour";

const box = (l: number, t: number, r: number, b: number): Box => ({ left: l, top: t, width: r - l, height: b - t });
// The card's measured size at 360px wide, by step (the call note and the last step are the tallest).
const CARD = { w: 360, h: 250 };
const TALL = { w: 360, h: 330 };

type Case = [viewport: string, step: string, highlight: Box, card?: { w: number; h: number }];

const CASES: Case[] = [
  // 1280 x 800
  ["1280x800", "pipeline", box(236, 180, 512, 377)],
  ["1280x800", "documents", box(260, 295, 1240, 371)],
  ["1280x800", "documents_flag", box(277, 605, 1223, 784)],
  ["1280x800", "financials", box(278, 293, 1222, 778)],
  ["1280x800", "banking", box(272, 400, 1232, 792)],
  ["1280x800", "credit", box(419, 312, 513, 366)],
  ["1280x800", "fraud", box(256, 300, 1244, 472)],
  ["1280x800", "call (ringing)", box(382, 85, 898, 715)],
  ["1280x800", "lenders", box(276, 197, 1224, 784), TALL],
  ["1280x800", "done", box(276, 680, 1224, 764), TALL],
  // 1440 x 900
  ["1440x900", "documents_flag", box(277, 705, 1383, 884)],
  ["1440x900", "financials", box(278, 293, 1382, 878)],
  ["1440x900", "call (ringing)", box(462, 135, 978, 765)],
  ["1440x900", "lenders", box(276, 197, 1384, 884), TALL],
  // iPad portrait (820 x 1180, 768 x 1024) and landscape (1024 x 768)
  ["820x1180", "financials", box(258, 293, 802, 1000)],
  ["820x1180", "lenders", box(256, 197, 806, 1160), TALL],
  ["768x1024", "lenders", box(256, 197, 756, 1010), TALL],
  ["768x1024", "call (ringing)", box(126, 197, 642, 827)],
  ["1024x768", "lenders", box(256, 197, 1010, 760), TALL],
  ["1024x768", "fraud", box(256, 300, 1010, 472)],
];

describe("the tour card keeps clear of the highlight", () => {
  for (const [vp, step, target, card = CARD] of CASES) {
    it(`${vp} ${step}`, () => {
      const [w, h] = vp.split("x").map(Number) as [number, number];
      const p = placeCard(target, card, { w, h });
      const height = Math.ceil((card.h * card.w) / p.width);
      const covered = coveredArea(p, height, target);
      // Unavoidable only when the highlight leaves no room anywhere: then it must be the least possible.
      if (p.side !== "corner") expect({ step, covered }).toEqual({ step, covered: 0 });
      else expect(covered / (target.width * target.height)).toBeLessThan(0.2);
      expect(p.left).toBeGreaterThanOrEqual(12);
      expect(p.top).toBeGreaterThanOrEqual(12);
      expect(p.left + p.width).toBeLessThanOrEqual(w - 12);
      expect(p.top + height).toBeLessThanOrEqual(h - 12);
      expect(p.width).toBeGreaterThanOrEqual(MIN_W);
    });
  }

  it("prefers the side with the most room", () => {
    // Small highlight near the top-left: below has the most room.
    expect(placeCard(box(300, 100, 500, 160), CARD, { w: 1280, h: 800 }).side).toBe("below");
    // Highlight across the bottom: above.
    expect(placeCard(box(260, 600, 1240, 780), CARD, { w: 1280, h: 800 }).side).toBe("above");
    // Full-height table with the sidebar free on its left: beside it, narrowed to fit.
    const p = placeCard(box(276, 20, 1224, 784), CARD, { w: 1280, h: 800 });
    expect(p.side).toBe("left");
    expect(p.width).toBeLessThan(360);
  });

  it("with no room beside it, docks in the corner farthest from the highlight", () => {
    const p = placeCard(box(20, 20, 800, 600), CARD, { w: 1000, h: 640 });
    expect(p.side).toBe("corner");
    expect(p.left).toBeGreaterThan(500);
    expect(p.top).toBeGreaterThan(300);
  });

  it("on a phone the sheet moves to the top when the highlight is at the bottom", () => {
    expect(placeCard(box(10, 500, 380, 800), CARD, { w: 390, h: 844 }).side).toBe("sheet-top");
    expect(placeCard(box(10, 80, 380, 300), CARD, { w: 390, h: 844 }).side).toBe("sheet-bottom");
  });
});

describe("several elements lit as one", () => {
  it("one box around them all, ignoring hidden ones", () => {
    expect(unionRect([box(10, 20, 110, 60), null, box(50, 70, 300, 90), { top: 0, left: 0, width: 0, height: 0 }])).toEqual(box(10, 20, 300, 90));
    expect(unionRect([null])).toBeNull();
  });
});
