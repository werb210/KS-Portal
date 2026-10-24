// KS_PORTAL_v13_LOAN_CALCULATOR - the amortization maths and the PDF / spreadsheet exports.
import { describe, expect, it } from "vitest";
import { amortize, paymentDates, periodicPayment, summaryText, validateLoan, type LoanInput } from "../amortization";
import { buildPdf, scheduleCsv, schedulePdf } from "../exports";

const START = new Date(2026, 0, 15); // Thu 15 Jan 2026
const base: LoanInput = { amount: 100000, annualRatePercent: 6, termMonths: 60, frequency: "monthly", startDate: START };
const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

describe("amortize", () => {
  it("matches the standard monthly payment and ends at a zero balance", () => {
    const r = amortize(base);
    expect(r.payment).toBe(1933.28);
    expect(r.numberOfPayments).toBe(60);
    expect(r.schedule.at(-1)!.balance).toBe(0);
    expect(sum(r.schedule.map((s) => s.principal))).toBe(100000);
    expect(r.totalInterest).toBe(sum(r.schedule.map((s) => s.interest)));
    expect(r.totalOfPayments).toBe(Math.round((100000 + r.totalInterest) * 100) / 100);
    expect(r.totalCost).toBe(r.totalOfPayments);
    expect(r.schedule[0]).toMatchObject({ number: 1, interest: 500, principal: 1433.28, balance: 98566.72 });
    expect(r.schedule[0]!.date).toEqual(new Date(2026, 1, 15));
  });

  it("handles a 0% rate: equal payments, no interest", () => {
    const r = amortize({ ...base, annualRatePercent: 0, termMonths: 12, amount: 1000 });
    expect(r.payment).toBe(83.33);
    expect(r.totalInterest).toBe(0);
    expect(r.schedule.at(-1)!.payment).toBe(83.37); // the last payment takes the rounding
    expect(r.totalOfPayments).toBe(1000);
    expect(r.schedule.at(-1)!.balance).toBe(0);
  });

  it("handles a balloon: lower payments, and the last payment carries the residual", () => {
    const plain = amortize(base);
    const r = amortize({ ...base, balloon: 20000 });
    expect(r.payment).toBeLessThan(plain.payment);
    expect(r.payment).toBe(1646.62);
    expect(r.schedule.at(-2)!.balance).toBeGreaterThan(20000);
    expect(r.schedule.at(-1)!.payment).toBeGreaterThan(20000);
    expect(r.schedule.at(-1)!.balance).toBe(0);
    expect(sum(r.schedule.map((s) => s.principal))).toBe(100000);
  });

  it("handles a balloon at 0%", () => {
    const r = amortize({ ...base, annualRatePercent: 0, termMonths: 10, amount: 10000, balloon: 5000 });
    expect(r.payment).toBe(500);
    expect(r.schedule.at(-1)!.payment).toBe(5500);
    expect(r.totalInterest).toBe(0);
  });

  it("takes the down payment off the amount financed and adds it to the total cost", () => {
    const r = amortize({ ...base, downPayment: 20000 });
    expect(r.financed).toBe(80000);
    expect(r.totalCost).toBe(Math.round((r.totalOfPayments + 20000) * 100) / 100);
    expect(summaryText({ ...base, downPayment: 20000 }, r)).toContain("down payment $20,000.00, financed $80,000.00");
  });

  it("schedules bi-weekly, weekly and business-day payments", () => {
    expect(amortize({ ...base, frequency: "biweekly", termMonths: 12 }).numberOfPayments).toBe(26);
    const weekly = amortize({ ...base, frequency: "weekly", termMonths: 12 });
    expect(weekly.numberOfPayments).toBe(52);
    expect(weekly.schedule[1]!.date).toEqual(new Date(2026, 0, 29));
    const daily = paymentDates(START, 1, "daily");
    // 16 Jan (Fri) to 15 Feb: no Saturdays or Sundays.
    expect(daily[0]).toEqual(new Date(2026, 0, 16));
    expect(daily[1]).toEqual(new Date(2026, 0, 19));
    expect(daily.every((d) => d.getDay() !== 0 && d.getDay() !== 6)).toBe(true);
    expect(daily).toHaveLength(21);
    const r = amortize({ ...base, frequency: "daily", termMonths: 1, amount: 21000, annualRatePercent: 0 });
    expect(r.payment).toBe(1000);
  });

  it("clamps monthly dates to the end of short months", () => {
    expect(paymentDates(new Date(2026, 0, 31), 2, "monthly")).toEqual([new Date(2026, 1, 28), new Date(2026, 2, 31)]);
  });

  it("explains bad input in plain words", () => {
    expect(validateLoan({ ...base, amount: 0 })).toContain("Enter an amount greater than 0.");
    expect(validateLoan({ ...base, termMonths: 0 })[0]).toMatch(/term/);
    expect(validateLoan({ ...base, downPayment: 100000 })).toContain("The down payment must be less than the amount.");
    expect(validateLoan({ ...base, balloon: 100000 })).toContain("The balloon must be less than the amount financed.");
    expect(validateLoan(base)).toEqual([]);
    expect(() => amortize({ ...base, amount: -1 })).toThrow(/amount/);
  });

  it("periodicPayment is the textbook formula", () => {
    expect(periodicPayment(1200, 0, 12)).toBe(100);
    expect(Math.round(periodicPayment(100000, 0.005, 360) * 100) / 100).toBe(599.55);
  });
});

describe("exports", () => {
  const r = amortize({ ...base, termMonths: 70 });
  it("writes a spreadsheet with the summary and one row per payment", () => {
    const csv = scheduleCsv(base, r);
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines).toContain("Payment #,Date,Payment,Principal,Interest,Balance");
    expect(lines.at(-1)).toMatch(/^70,\d{4}-\d{2}-\d{2},[\d.]+,[\d.]+,[\d.]+,0\.00$/);
    expect(csv).toContain("Total interest," + r.totalInterest.toFixed(2));
  });

  it("writes a well-formed multi-page PDF", () => {
    const bytes = schedulePdf(base, r, { subtitle: "Acme (Films) Ltd" });
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("Acme \\(Films\\) Ltd");
    expect(text).toMatch(/\/Count [2-9]/);
    // Every xref offset points at the start of its object.
    const xrefAt = Number(/startxref\n(\d+)/.exec(text)![1]);
    const offsets = text.slice(xrefAt).split("\n").slice(3).filter((l) => / 00000 n $/.test(l)).map((l) => Number(l.slice(0, 10)));
    offsets.forEach((o, i) => expect(text.slice(o, o + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
  });

  it("keeps PDF text printable", () => {
    const text = new TextDecoder().decode(buildPdf([[{ x: 10, y: 10, text: "Café – total" }]]));
    expect(text).toContain("(Caf? - total)");
  });
});
