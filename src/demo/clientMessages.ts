// KS_PORTAL_v11_LIVE_DEMO - the client app's /tour talks to this page with postMessage:
//   { type: "ks-live-demo", event: "step", step: "<key>", title, text }   one per pop-up, mirrored in the side panel
//   { type: "ks-live-demo", event: "client-done" }                          "Show me the broker side" was pressed
// Only messages from the client app's origin (and, when known, from our own iframe) are accepted.

export type ClientMessage =
  | { event: "step"; step: string; title: string; text: string; number?: number; total?: number; canBack: boolean; final: boolean; busy: boolean }
  | { event: "client-done" };

/** What the side panel's buttons send into the client app's frame. */
export type ClientCommand = "next" | "back" | "broker";
export function sendClientCommand(win: Window | null | undefined, origin: string, command: ClientCommand): boolean {
  if (!win || !origin) return false;
  try {
    win.postMessage({ type: "ks-live-demo", command }, origin);
    return true;
  } catch {
    return false;
  }
}

const short = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function parseClientMessage(
  e: Pick<MessageEvent, "origin" | "data" | "source">,
  expectedOrigin: string,
  expectedSource?: MessageEventSource | null,
): ClientMessage | null {
  if (!expectedOrigin || e.origin !== expectedOrigin) return null;
  if (expectedSource && e.source && e.source !== expectedSource) return null;
  const d = e.data as { type?: unknown; event?: unknown; step?: unknown; title?: unknown; text?: unknown; number?: unknown; total?: unknown; canBack?: unknown; final?: unknown; busy?: unknown } | null;
  if (!d || typeof d !== "object" || d.type !== "ks-live-demo") return null;
  if (d.event === "client-done") return { event: "client-done" };
  if (d.event === "step") {
    const title = short(d.title, 120);
    const text = short(d.text, 400);
    if (!title && !text) return null;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 100 ? Math.floor(v) : undefined);
    return {
      event: "step", step: short(d.step, 60), title, text, number: num(d.number), total: num(d.total),
      canBack: d.canBack === true, final: d.final === true, busy: d.busy === true,
    };
  }
  return null;
}
