// KS_PORTAL_v13_LOAN_CALCULATOR - loan amortization maths. Pure: no React, no network, no clock (the start date is
// passed in). The same module is in KS-Client (src/lib/loanCalculator) - keep the two identical.
//
// Amount financed = amount - down payment. A balloon (residual) is left owing after the last regular payment and is
// paid with it. With rate r per period, n payments and balloon B:
//   payment = (P - B / (1 + r)^n) * r / (1 - (1 + r)^-n)        and, at 0%,  payment = (P - B) / n
// Every amount is rounded to the cent; the last payment absorbs the rounding so the balance ends at exactly 0.

export type Frequency = "monthly" | "biweekly" | "weekly" | "daily";

export const FREQUENCIES: ReadonlyArray<{ value: Frequency; label: string; perYear: number }> = [
  { value: "monthly", label: "Monthly", perYear: 12 },
  { value: "biweekly", label: "Bi-weekly", perYear: 26 },
  { value: "weekly", label: "Weekly", perYear: 52 },
  { value: "daily", label: "Daily (business days)", perYear: 260 },
];

export type LoanInput = {
  amount: number;
  annualRatePercent: number;
  termMonths: number;
  frequency: Frequency;
  downPayment?: number | null;
  balloon?: number | null;
  /** The loan's start; the first payment is one period later. */
  startDate: Date;
};

export type ScheduleRow = { number: number; date: Date; payment: number; principal: number; interest: number; balance: number };

export type LoanResult = {
  financed: number;
  downPayment: number;
  balloon: number;
  periodicRate: number;
  paymentsPerYear: number;
  numberOfPayments: number;
  /** The regular payment (the last one also carries the balloon and any rounding). */
  payment: number;
  totalInterest: number;
  /** Everything paid on the loan: all payments including the balloon. */
  totalOfPayments: number;
  /** Total of payments plus the down payment. */
  totalCost: number;
  schedule: ScheduleRow[];
};

export const MAX_TERM_MONTHS = 600;

export const cents = (n: number): number => Math.round((n + Math.sign(n) * Number.EPSILON) * 100) / 100;

export function perYear(frequency: Frequency): number {
  return FREQUENCIES.find((f) => f.value === frequency)?.perYear ?? 12;
}

function addMonths(d: Date, months: number): Date {
  const day = d.getDate();
  const out = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, last));
  return out;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

const isWeekday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

function nextBusinessDay(d: Date): Date {
  let x = addDays(d, 1);
  while (!isWeekday(x)) x = addDays(x, 1);
  return x;
}

/** The payment dates for the term (the first one period after the start). */
export function paymentDates(start: Date, termMonths: number, frequency: Frequency): Date[] {
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  if (frequency === "monthly") return Array.from({ length: termMonths }, (_, i) => addMonths(from, i + 1));
  if (frequency === "daily") {
    const end = addMonths(from, termMonths);
    const out: Date[] = [];
    for (let d = nextBusinessDay(from); d <= end; d = nextBusinessDay(d)) out.push(d);
    return out;
  }
  const step = frequency === "biweekly" ? 14 : 7;
  const n = Math.max(1, Math.round((termMonths * perYear(frequency)) / 12));
  return Array.from({ length: n }, (_, i) => addDays(from, step * (i + 1)));
}

/** Problems with the input, in plain words. Empty when it can be calculated. */
export function validateLoan(input: Partial<LoanInput>): string[] {
  const errors: string[] = [];
  const amount = Number(input.amount);
  const rate = Number(input.annualRatePercent);
  const term = Number(input.termMonths);
  const down = Number(input.downPayment ?? 0);
  const balloon = Number(input.balloon ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) errors.push("Enter an amount greater than 0.");
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) errors.push("Enter an annual rate between 0 and 100%.");
  if (!Number.isInteger(term) || term < 1 || term > MAX_TERM_MONTHS) errors.push(`Enter a term of 1 to ${MAX_TERM_MONTHS} whole months.`);
  if (!Number.isFinite(down) || down < 0) errors.push("The down payment cannot be negative.");
  if (!Number.isFinite(balloon) || balloon < 0) errors.push("The balloon cannot be negative.");
  if (Number.isFinite(amount) && Number.isFinite(down) && amount > 0 && down >= amount) errors.push("The down payment must be less than the amount.");
  if (Number.isFinite(amount) && Number.isFinite(down) && Number.isFinite(balloon) && amount > 0 && balloon > 0 && balloon >= amount - down) {
    errors.push("The balloon must be less than the amount financed.");
  }
  return errors;
}

/** The regular payment for a balance, periodic rate, number of payments and balloon. */
export function periodicPayment(principal: number, rate: number, n: number, balloon = 0): number {
  if (n <= 0) return 0;
  if (rate === 0) return (principal - balloon) / n;
  const growth = Math.pow(1 + rate, n);
  return ((principal - balloon / growth) * rate) / (1 - 1 / growth);
}

export function amortize(input: LoanInput): LoanResult {
  const errors = validateLoan(input);
  if (errors.length) throw new Error(errors.join(" "));
  const downPayment = cents(Number(input.downPayment ?? 0));
  const balloon = cents(Number(input.balloon ?? 0));
  const financed = cents(input.amount - downPayment);
  const ppy = perYear(input.frequency);
  const periodicRate = input.annualRatePercent / 100 / ppy;
  const dates = paymentDates(input.startDate, input.termMonths, input.frequency);
  const n = dates.length;
  const payment = cents(periodicPayment(financed, periodicRate, n, balloon));

  const schedule: ScheduleRow[] = [];
  let balance = financed;
  let totalInterest = 0;
  let totalOfPayments = 0;
  dates.forEach((date, i) => {
    const interest = cents(balance * periodicRate);
    const last = i === n - 1;
    // The last payment clears whatever is left: the balloon plus the rounding of every earlier row.
    let principal = last ? balance : cents(payment - interest);
    if (!last && principal > balance) principal = balance;
    const paid = cents(principal + interest);
    balance = cents(balance - principal);
    totalInterest = cents(totalInterest + interest);
    totalOfPayments = cents(totalOfPayments + paid);
    schedule.push({ number: i + 1, date, payment: paid, principal: cents(principal), interest, balance });
  });

  return {
    financed,
    downPayment,
    balloon,
    periodicRate,
    paymentsPerYear: ppy,
    numberOfPayments: n,
    payment,
    totalInterest,
    totalOfPayments,
    totalCost: cents(totalOfPayments + downPayment),
    schedule,
  };
}

export function money(n: number): string {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace("CA$", "$");
}

export function isoDay(d: Date): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function frequencyLabel(f: Frequency): string {
  return FREQUENCIES.find((x) => x.value === f)?.label ?? f;
}

/** A short plain-text summary (used for the application note). */
export function summaryText(input: LoanInput, r: LoanResult): string {
  const lines = [
    "Loan calculator",
    `Amount: ${money(input.amount)}` + (r.downPayment ? `, down payment ${money(r.downPayment)}, financed ${money(r.financed)}` : ""),
    `Rate: ${input.annualRatePercent}% a year, term ${input.termMonths} months, ${frequencyLabel(input.frequency).toLowerCase()} payments`,
    r.balloon ? `Balloon / residual: ${money(r.balloon)}` : "",
    `Payment: ${money(r.payment)} x ${r.numberOfPayments}` + (r.balloon ? ` (last payment ${money(r.schedule[r.schedule.length - 1]?.payment ?? 0)} including the balloon)` : ""),
    `Total interest: ${money(r.totalInterest)}`,
    `Total of payments: ${money(r.totalOfPayments)}`,
    `Total cost: ${money(r.totalCost)}`,
    r.schedule.length ? `First payment ${isoDay(r.schedule[0]!.date)}, last payment ${isoDay(r.schedule[r.schedule.length - 1]!.date)}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}
