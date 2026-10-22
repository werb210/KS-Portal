#!/usr/bin/env node
// KS_PORTAL_v2_BRANDING - KS-Portal shows the licensee's name (src/config/brand.ts), never "Boreal". This guard parses
// every source file under src/ (tests excluded) with the TypeScript parser and fails when a string literal, template
// literal or JSX text contains the word "Boreal". Comments and identifiers (BorealVoice, launchNativeBorealDialer)
// are not text and are ignored. It also checks index.html and public/manifest.webmanifest.
// It runs in CI as a script rather than a vitest file because tests that read source text are capped
// (scripts/check-source-grep-tests.mjs); src/config/__tests__/noBorealText.test.ts tests the scanner itself.
//
//   node scripts/check-no-boreal-text.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const WORD = /\bBoreal\b/;

// "src/path:text" entries allowed to keep the word. Keep this list short and say why for each entry. Empty today:
// the native identifiers that remain (BorealVoice, BorealPortalSummary) do not match the whole word "Boreal".
export const ALLOW = new Set([]);

/** Every piece of user-visible text in a TS/TSX source that contains "Boreal". */
export function findBorealText(source, fileName = "file.tsx") {
  const kind = fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind);
  const hits = [];
  const visit = (node) => {
    let text = null;
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      text = node.text;
    }
    if (text !== null && WORD.test(text)) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      hits.push({ line: line + 1, text: text.trim().slice(0, 120) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

/** "Boreal" in an HTML/JSON file, ignoring HTML comments. */
export function findBorealInMarkup(source) {
  const stripped = source.replace(/<!--[\s\S]*?-->/g, "");
  return stripped
    .split("\n")
    .map((t, i) => ({ line: i + 1, text: t.trim() }))
    .filter((h) => WORD.test(h.text));
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__" && e.name !== "node_modules") walk(p, out);
    } else if (/\.(tsx?|mts)$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name) && !e.name.endsWith(".d.ts")) {
      out.push(p);
    }
  }
  return out;
}

function main() {
  const root = process.cwd();
  const problems = [];
  for (const f of walk(join(root, "src"))) {
    const rel = relative(root, f);
    for (const h of findBorealText(readFileSync(f, "utf8"), f)) {
      if (!ALLOW.has(`${rel}:${h.text}`)) problems.push(`${rel}:${h.line}  ${h.text}`);
    }
  }
  for (const rel of ["index.html", "public/manifest.webmanifest"]) {
    let src = "";
    try { src = readFileSync(join(root, rel), "utf8"); } catch { continue; }
    for (const h of findBorealInMarkup(src)) problems.push(`${rel}:${h.line}  ${h.text}`);
  }
  if (problems.length) {
    console.error(`FAIL: "Boreal" in user-visible text - use brandName()/legalName() from src/config/brand.ts:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log('OK: no "Boreal" in user-visible text.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
