// KS_PORTAL_v8_DEMO / KS_PORTAL_v11_LIVE_DEMO - every text/background pair the live demo draws itself (src/demo/
// liveDemo.css). The pop-ups and the shell never follow the portal theme, so each pair can be checked: the tests keep
// every one at 4.5:1 or more.
export const TEXT_PAIRS: Array<[name: string, fg: string, bg: string]> = [
  // the /demo shell
  ["shell text", "#e2e8f0", "#0b1220"],
  ["shell greeting on the top of the gradient", "#e2e8f0", "#1e293b"],
  ["side panel text", "#cbd5e1", "#0b1220"],
  ["side panel muted", "#94a3b8", "#0b1220"],
  ["eyebrow", "#fbbf24", "#0b1220"],
  ["step box title", "#f8fafc", "#1e293b"],
  ["step box text", "#cbd5e1", "#1e293b"],
  ["skip link", "#93c5fd", "#0b1220"],
  ["preparing chip", "#dbeafe", "#1e3a8a"],
  ["missing-link card", "#334155", "#ffffff"],
  ["missing-link link", "#1d4ed8", "#ffffff"],
  // the tour card
  ["card text", "#1e293b", "#ffffff"],
  ["card title", "#0f172a", "#ffffff"],
  ["card progress and exit", "#475569", "#ffffff"],
  ["card status", "#1e3a8a", "#eff6ff"],
  ["card error", "#991b1b", "#fef2f2"],
  ["primary button", "#ffffff", "#1d4ed8"],
  ["primary button hover", "#ffffff", "#1e40af"],
  ["secondary button", "#0f172a", "#ffffff"],
  // the call
  ["caller details", "#e5e7eb", "#262b33"],
  ["fraud flag chip", "#7f1d1d", "#fee2e2"],
  ["your words", "#ffffff", "#0a63d6"],
  ["Sam's words", "#ffffff", "#3a3a3c"],
  ["call note badge", "#ecfdf5", "#065f46"],
  ["watch subtitle", "#d4d4d8", "#000000"],
];
