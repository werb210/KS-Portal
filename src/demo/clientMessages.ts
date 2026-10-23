// KS_PORTAL_v11_LIVE_DEMO - the client app's /tour talks to this page with postMessage:
//   { type: "ks-live-demo", event: "step", step: "<key>", title, text }   one per pop-up, mirrored in the side panel
//   { type: "ks-live-demo", event: "client-done" }                          "Show me the broker side" was pressed
// Only messages from the client app's origin (and, when known, from our own iframe) are accepted.

export type ClientMessage =
  | { event: "step"; step: string; title: string; text: string }
  | { event: "client-done" };

const short = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function parseClientMessage(
  e: Pick<MessageEvent, "origin" | "data" | "source">,
  expectedOrigin: string,
  expectedSource?: MessageEventSource | null,
): ClientMessage | null {
  if (!expectedOrigin || e.origin !== expectedOrigin) return null;
  if (expectedSource && e.source && e.source !== expectedSource) return null;
  const d = e.data as { type?: unknown; event?: unknown; step?: unknown; title?: unknown; text?: unknown } | null;
  if (!d || typeof d !== "object" || d.type !== "ks-live-demo") return null;
  if (d.event === "client-done") return { event: "client-done" };
  if (d.event === "step") {
    const title = short(d.title, 120);
    const text = short(d.text, 400);
    if (!title && !text) return null;
    return { event: "step", step: short(d.step, 60), title, text };
  }
  return null;
}
