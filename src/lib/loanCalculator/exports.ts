// KS_PORTAL_v13_LOAN_CALCULATOR - the schedule as a spreadsheet (CSV, opens in Excel, Numbers and Google Sheets)
// and as a PDF. The PDF is written by hand (standard Helvetica, text only), so no PDF library is needed.
// The same module is in KS-Client (src/lib/loanCalculator) - keep the two identical.
import { frequencyLabel, isoDay, money, type LoanInput, type LoanResult } from "./amortization";

const csvCell = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function scheduleCsv(input: LoanInput, r: LoanResult): string {
  const rows: Array<Array<string | number>> = [
    ["Loan calculator"],
    ["Amount", input.amount.toFixed(2)],
    ["Down payment", r.downPayment.toFixed(2)],
    ["Amount financed", r.financed.toFixed(2)],
    ["Annual rate %", input.annualRatePercent],
    ["Term (months)", input.termMonths],
    ["Frequency", frequencyLabel(input.frequency)],
    ["Balloon / residual", r.balloon.toFixed(2)],
    ["Payment per period", r.payment.toFixed(2)],
    ["Number of payments", r.numberOfPayments],
    ["Total interest", r.totalInterest.toFixed(2)],
    ["Total of payments", r.totalOfPayments.toFixed(2)],
    ["Total cost", r.totalCost.toFixed(2)],
    [],
    ["Payment #", "Date", "Payment", "Principal", "Interest", "Balance"],
    ...r.schedule.map((s) => [s.number, isoDay(s.date), s.payment.toFixed(2), s.principal.toFixed(2), s.interest.toFixed(2), s.balance.toFixed(2)]),
  ];
  // The byte-order mark makes Excel read the file as UTF-8.
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// ---- PDF ---------------------------------------------------------------------------------------------------------

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN = 48;
const LINE = 14;

/** Printable ASCII only: the standard fonts here use WinAnsi, and anything else becomes "?". */
function pdfText(s: string): string {
  return s
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

type Op = { x: number; y: number; text: string; bold?: boolean; size?: number; right?: boolean };

/** Rough Helvetica width (points) - enough to right-align numbers in columns. */
function textWidth(s: string, size: number): number {
  let w = 0;
  for (const ch of s) w += /[0-9$.,]/.test(ch) ? (ch === "." || ch === "," ? 0.278 : 0.556) : /[A-Z]/.test(ch) ? 0.667 : 0.5;
  return w * size;
}

function pageStream(ops: Op[]): string {
  return ops.map((o) => {
    const size = o.size ?? 9;
    const x = o.right ? o.x - textWidth(o.text, size) : o.x;
    return `BT /${o.bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${o.y.toFixed(2)} Td (${pdfText(o.text)}) Tj ET`;
  }).join("\n");
}

/** A minimal, valid PDF 1.4 document from pages of text operations. */
export function buildPdf(pages: Op[][]): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalog = add(""); // filled below
  const pagesObj = add("");
  const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  for (const ops of pages) {
    const stream = pageStream(ops);
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character is ASCII, so string offsets are byte offsets.
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0x7f;
  return bytes;
}

const COLS = [
  { label: "#", x: MARGIN + 24, right: true },
  { label: "Date", x: MARGIN + 36, right: false },
  { label: "Payment", x: MARGIN + 200, right: true },
  { label: "Principal", x: MARGIN + 290, right: true },
  { label: "Interest", x: MARGIN + 380, right: true },
  { label: "Balance", x: PAGE_W - MARGIN, right: true },
];

export function schedulePdf(input: LoanInput, r: LoanResult, opts: { title?: string; subtitle?: string | null } = {}): Uint8Array {
  const pages: Op[][] = [];
  let ops: Op[] = [];
  let y = PAGE_H - MARGIN;
  const header = () => {
    COLS.forEach((c) => ops.push({ x: c.x, y, text: c.label, bold: true, right: c.right }));
    y -= LINE;
  };
  ops.push({ x: MARGIN, y, text: opts.title ?? "Loan amortization schedule", bold: true, size: 16 });
  y -= LINE * 1.6;
  if (opts.subtitle) { ops.push({ x: MARGIN, y, text: opts.subtitle, size: 10 }); y -= LINE * 1.3; }
  const summary: Array<[string, string]> = [
    ["Amount", money(input.amount)],
    ...(r.downPayment ? [["Down payment", money(r.downPayment)] as [string, string], ["Amount financed", money(r.financed)] as [string, string]] : []),
    ["Annual rate", `${input.annualRatePercent}%`],
    ["Term", `${input.termMonths} months`],
    ["Frequency", frequencyLabel(input.frequency)],
    ...(r.balloon ? [["Balloon / residual", money(r.balloon)] as [string, string]] : []),
    ["Payment per period", money(r.payment)],
    ["Number of payments", String(r.numberOfPayments)],
    ["Total interest", money(r.totalInterest)],
    ["Total of payments", money(r.totalOfPayments)],
    ["Total cost", money(r.totalCost)],
  ];
  for (const [k, v] of summary) {
    ops.push({ x: MARGIN, y, text: k, size: 10 });
    ops.push({ x: MARGIN + 260, y, text: v, size: 10, bold: true, right: true });
    y -= LINE;
  }
  y -= LINE;
  header();
  for (const s of r.schedule) {
    if (y < MARGIN + LINE) {
      pages.push(ops);
      ops = [];
      y = PAGE_H - MARGIN;
      header();
    }
    const cells = [String(s.number), isoDay(s.date), money(s.payment), money(s.principal), money(s.interest), money(s.balance)];
    COLS.forEach((c, i) => ops.push({ x: c.x, y, text: cells[i]!, right: c.right }));
    y -= LINE;
  }
  pages.push(ops);
  // Page numbers.
  pages.forEach((p, i) => p.push({ x: PAGE_W - MARGIN, y: MARGIN / 2, text: `Page ${i + 1} of ${pages.length}`, size: 8, right: true }));
  return buildPdf(pages);
}

/** Save bytes or text as a file in the browser. */
export function downloadFile(data: Uint8Array | string, filename: string, type: string): void {
  const blob = new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
