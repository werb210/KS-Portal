// KS_BROKER_TOOLS_2 - busy / error / message state for a panel's buttons, and multipart uploads with a readable error.
import { useState } from "react";
import { rawApiFetch } from "@/api";
import { errorText } from "./ui";

export function useRun(reload?: () => Promise<void> | void) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
    setBusy(true); setErr(null); setMsg(null);
    try { const out = await fn(); if (ok) setMsg(ok); if (reload) await reload(); return out; }
    catch (e) { setErr(errorText(e)); return undefined; }
    finally { setBusy(false); }
  };
  return { busy, err, msg, setErr, setMsg, run };
}

export async function postFile<T = any>(path: string, file: File, fields: Record<string, string> = {}): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const res = await rawApiFetch(path, { method: "POST", body: fd });
  const j = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(j?.message ?? `Upload failed (${res.status}).`);
  return j;
}
