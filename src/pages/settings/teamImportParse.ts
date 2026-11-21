// KS_PORTAL_TEAM_IMPORT_v1 - turns a CSV file or rows pasted from Excel / Google Sheets into people to import.
// The first row may be a header (Name, First name, Last name, Email, Phone or Mobile, Role, in any order); without a
// header the columns are taken as Name, Email, Mobile, Role. Role words: Broker / Staff, Marketing, Admin.
export type ImportPerson = { name: string; email: string; phone: string; role: string };

function splitLine(line: string, sep: string): string[] {
  if (sep === "\t") return line.split("\t").map((c) => c.trim());
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const HEADER: Record<string, keyof ImportPerson | "first" | "last"> = {
  name: "name", "full name": "name", "first name": "first", first: "first", "last name": "last", last: "last", surname: "last",
  email: "email", "email address": "email", "e-mail": "email",
  phone: "phone", mobile: "phone", "mobile phone": "phone", cell: "phone", "cell phone": "phone", "phone number": "phone",
  role: "role", position: "role",
};

export function normalizeRole(raw: string): string {
  const r = raw.trim().toLowerCase();
  if (r.startsWith("admin")) return "Admin";
  if (r.startsWith("market")) return "Marketing";
  return "Broker";
}

export function parseTeamText(text: string): ImportPerson[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const head = lines[0] ?? "";
  const sep = head.includes("\t") ? "\t" : head.includes(";") && !head.includes(",") ? ";" : ",";
  const first = splitLine(head, sep).map((c) => c.toLowerCase());
  const keys = first.map((c) => HEADER[c]);
  const hasHeader = keys.filter(Boolean).length >= 2;
  const cols: Array<keyof ImportPerson | "first" | "last" | undefined> = hasHeader ? keys : ["name", "email", "phone", "role"];
  const body = hasHeader ? lines.slice(1) : lines;
  return body.map((line) => {
    const cells = splitLine(line, sep);
    const p = { name: "", email: "", phone: "", role: "", first: "", last: "" };
    cols.forEach((k, i) => { if (k) p[k] = cells[i] ?? ""; });
    const name = p.name || `${p.first} ${p.last}`.trim();
    return { name, email: p.email.toLowerCase(), phone: p.phone, role: normalizeRole(p.role) };
  }).filter((p) => p.name || p.email || p.phone);
}

export const TEMPLATE_CSV = "Name,Email,Mobile,Role\nJane Smith,jane@yourbrokerage.com,403-555-0101,Broker\n";
