// KS_PORTAL_v2_BRANDING - tests the "no Boreal in visible text" scanner (scripts/check-no-boreal-text.mjs, run in CI)
// on in-memory snippets: text is caught, comments and identifiers are not.
import { describe, expect, it } from "vitest";
import { findBorealInMarkup, findBorealText } from "../../../scripts/check-no-boreal-text.mjs";

describe("check-no-boreal-text scanner", () => {
  it("flags string literals, template literals and JSX text", () => {
    const src = [
      'const a = "Welcome to Boreal";',
      "const b = `Boreal ${x}% split`;",
      "const C = () => <h1>Boreal Financial</h1>;",
      'const D = () => <img alt="Boreal" />;',
    ].join("\n");
    const hits = findBorealText(src, "x.tsx") as { line: number }[];
    expect(hits.map((h) => h.line)).toEqual([1, 2, 3, 4]);
  });

  it("ignores comments, identifiers and storage keys", () => {
    const src = [
      "// Boreal used to be hard-coded here",
      "/* Boreal */ import { BorealVoice } from './x';",
      "const C = () => <h1>{/* Boreal mark */}{brandName()}</h1>;",
      'const k = "boreal_session"; launchNativeBorealDialer();',
    ].join("\n");
    expect(findBorealText(src, "x.tsx")).toEqual([]);
  });

  it("checks markup but skips HTML comments", () => {
    expect(findBorealInMarkup("<!-- Boreal -->\n<title>Staff Portal</title>")).toEqual([]);
    expect((findBorealInMarkup('{ "name": "Boreal Portal" }') as unknown[]).length).toBe(1);
  });
});
