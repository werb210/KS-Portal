// KS_PORTAL_v11_LIVE_DEMO - keep the browser quiet on the broker side: no realtime streams (EventSource / WebSocket
// connect to nothing and never fire), no blocking dialogs (confirm says yes; alert and prompt do nothing), and no
// permission prompts. Returns a function that puts everything back (tests).

class QuietEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;
  readyState = 1;
  withCredentials = false;
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  constructor(public url: string) {}
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }
  close(): void {
    this.readyState = 2;
  }
}

class QuietWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readyState = 0;
  binaryType = "blob";
  bufferedAmount = 0;
  extensions = "";
  protocol = "";
  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  constructor(public url: string) {}
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }
  send(): void {}
  close(): void {
    this.readyState = 3;
  }
}

export function installQuietBrowser(win: Window & typeof globalThis = window): () => void {
  // In a browser window and globalThis are the same object; in some test environments they are not.
  const targets = Array.from(new Set([win as unknown as Record<string, unknown>, globalThis as unknown as Record<string, unknown>]));
  const saved: Array<[Record<string, unknown>, string, unknown]> = [];
  const put = (key: string, value: unknown) => {
    for (const w of targets) {
      saved.push([w, key, w[key]]);
      try {
        w[key] = value;
      } catch {
        /* read-only in this browser */
      }
    }
  };
  put("EventSource", QuietEventSource);
  put("WebSocket", QuietWebSocket);
  put("confirm", () => true);
  put("alert", () => undefined);
  put("prompt", () => "");
  const N = (win as { Notification?: { requestPermission?: unknown; permission?: string } }).Notification;
  let savedRequest: unknown;
  if (N) {
    savedRequest = N.requestPermission;
    try {
      N.requestPermission = () => Promise.resolve(N.permission === "granted" ? "granted" : "default");
    } catch {
      /* ignore */
    }
  }
  return () => {
    for (const [w, k, v] of saved.reverse()) {
      try {
        w[k] = v;
      } catch {
        /* ignore */
      }
    }
    if (N && savedRequest) N.requestPermission = savedRequest;
  };
}
