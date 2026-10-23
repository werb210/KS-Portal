// KS_PORTAL_v11_LIVE_DEMO - a small, valid PDF drawn in the browser, so a document preview works before the demo
// session is open (afterwards the demo server's own sample PDFs are shown). Text only, Helvetica, one page.
import { BANK, BUSINESS, DOCS, FINANCIALS, STATEMENTS, money, type SampleDoc } from "./fixture";

type Line = { text: string; size?: number; bold?: boolean; x?: number; gap?: number };

const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, "-").replace(/([\\()])/g, "\\$1");

/** Bytes of a one-page PDF with the given lines (top to bottom). */
export function buildPdf(lines: Line[]): Uint8Array {
  let y = 760;
  const ops: string[] = [];
  for (const l of lines) {
    const size = l.size ?? 10;
    y -= l.gap ?? size + 6;
    if (y < 40) break;
    ops.push(`BT /${l.bold ? "F2" : "F1"} ${size} Tf ${l.x ?? 50} ${y} Td (${esc(l.text)}) Tj ET`);
  }
  const stream = ops.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

const amt = (n: number) => (n < 0 ? `-${money(-n)}` : money(n)).replace("$", "");

function statementLines(doc: SampleDoc): Line[] {
  const st = STATEMENTS.find((s) => doc.key === `bank_${s.month.replace("-", "_")}`);
  if (!st) return [];
  const out: Line[] = [
    { text: BANK, size: 16, bold: true },
    { text: `Business chequing - ${st.label}`, size: 12 },
    { text: BUSINESS.legal_name, gap: 22 },
    { text: BUSINESS.address },
    { text: `Opening balance  ${amt(st.opening)}`, bold: true, gap: 24 },
  ];
  let bal = st.opening;
  for (const t of st.tx) {
    bal += t.amount;
    out.push({ text: `${t.date}   ${t.description.padEnd(44, " ")} ${amt(t.amount).padStart(12, " ")}   ${amt(bal).padStart(12, " ")}`, size: 9 });
  }
  out.push({ text: `Closing balance  ${amt(bal)}`, bold: true, gap: 22 });
  return out;
}

function financialLines(): Line[] {
  const [cur, prev] = FINANCIALS.years;
  const row = (label: string, a: number, b: number): Line => ({ text: `${label.padEnd(30, " ")} ${amt(a).padStart(14, " ")} ${amt(b).padStart(14, " ")}`, size: 10 });
  return [
    { text: BUSINESS.legal_name, size: 16, bold: true },
    { text: `Financial statements - year ended December 31, ${cur.year}`, size: 12 },
    { text: `${FINANCIALS.basis}. ${FINANCIALS.prepared_by}.`, gap: 20 },
    { text: `${"".padEnd(30, " ")} ${String(cur.year).padStart(14, " ")} ${String(prev.year).padStart(14, " ")}`, bold: true, gap: 26 },
    row("Revenue", cur.revenue, prev.revenue),
    row("Cost of sales", cur.cogs, prev.cogs),
    row("Gross profit", cur.gross_profit, prev.gross_profit),
    row("Operating expenses", cur.operating_expenses, prev.operating_expenses),
    row("EBITDA", cur.ebitda, prev.ebitda),
    row("Depreciation", cur.depreciation, prev.depreciation),
    row("Interest", cur.interest, prev.interest),
    row("Net income", cur.net_income, prev.net_income),
    row("Current assets", cur.current_assets, prev.current_assets),
    row("Total assets", cur.total_assets, prev.total_assets),
    row("Current liabilities", cur.current_liabilities, prev.current_liabilities),
    row("Total liabilities", cur.total_liabilities, prev.total_liabilities),
    row("Equity", cur.equity, prev.equity),
  ];
}

/** The preview for one sample document. */
export function samplePdfFor(docId: string): Blob {
  const bytes = samplePdfBytes(docId);
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

export function samplePdfBytes(docId: string): Uint8Array {
  const doc = DOCS.find((d) => d.id === docId);
  const lines: Line[] = doc?.key.startsWith("bank_")
    ? statementLines(doc)
    : doc?.key === "financials_2025"
      ? financialLines()
      : [
          { text: doc?.label ?? "Sample document", size: 16, bold: true },
          { text: BUSINESS.legal_name, gap: 22 },
          { text: doc?.key === "photo_id" ? "A placeholder - not a real ID." : `${BANK} - for the lender's payments.` },
        ];
  lines.push({ text: "SAMPLE - every name and number in this demo is fictional.", size: 9, gap: 30 });
  return buildPdf(lines);
}
