// KS_PORTAL_v20_WEBHOOKS - Settings > Webhooks: add (secret shown once), https only, pause, test, log with Resend,
// the payload reference and the Zapier guide.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const h = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("@/api", () => ({ api: { get: h.get, post: h.post, patch: h.patch, delete: h.delete } }));

import WebhooksSettings from "../WebhooksSettings";

const info = {
  events: [
    { type: "contact.created", label: "Contact created", object: "contact", description: "A contact is added.", example: { id: "evt", type: "contact.created", data: { object: { email: "jordan@example.com" } } } },
    { type: "deal.funded", label: "Deal funded", object: "application", description: "Funded.", example: { id: "evt", type: "deal.funded", data: { object: { funded_amount: 240000 } } } },
  ],
  signing: { signature_header: "X-Webhook-Signature", timestamp_header: "X-Webhook-Timestamp", tolerance_seconds: 300, algorithm: "HMAC-SHA256" },
  retry: { max_attempts: 10, first_retry_seconds: 60, max_delay_hours: 6, disable_after_dead: 5, timeout_seconds: 10, keep_days: 30 },
  limits: { endpoints: 25 },
};
const endpoint = { id: "e1", url: "https://hooks.zapier.com/hooks/catch/1/abc/", description: "Zap", events: ["contact.created"], status: "active", consecutive_failures: 0,
  disabled_at: null, disabled_reason: null, last_success_at: null, last_failure_at: null, created_at: "2026-11-03T00:00:00Z", delivered_30d: 3, failed_30d: 1, queued: 0 };

function routeGets(endpoints: unknown[], deliveries: unknown[] = []) {
  h.get.mockImplementation(async (path: string) => {
    if (path.endsWith("/events")) return info;
    if (path.endsWith("/deliveries")) return { deliveries };
    return { endpoints };
  });
}

beforeEach(() => {
  h.get.mockReset(); h.post.mockReset(); h.patch.mockReset(); h.delete.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("Settings > Webhooks", () => {
  it("adds an https endpoint and shows the signing secret once", async () => {
    routeGets([]);
    h.post.mockResolvedValueOnce({ endpoint, secret: "whsec_abc123" });
    render(<WebhooksSettings />);
    fireEvent.click(await screen.findByTestId("webhook-add"));
    fireEvent.change(screen.getByLabelText("Endpoint URL (https)"), { target: { value: "http://example.com/hook" } });
    fireEvent.click(screen.getByLabelText("Contact created"));
    fireEvent.click(screen.getByRole("button", { name: "Add endpoint" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("must start with https://");
    expect(h.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Endpoint URL (https)"), { target: { value: "https://hooks.zapier.com/hooks/catch/1/abc/" } });
    fireEvent.click(screen.getByRole("button", { name: "Add endpoint" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/webhook-endpoints", { url: "https://hooks.zapier.com/hooks/catch/1/abc/", events: ["contact.created"], description: "" }));
    expect(await screen.findByTestId("webhook-secret")).toHaveTextContent("whsec_abc123");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByTestId("webhook-secret")).toBeNull();
  });

  it("pauses, sends a test, and resends from the 30-day log", async () => {
    routeGets([endpoint], [{ id: "d1", event_id: "ev1", endpoint_id: "e1", event_type: "contact.created", object_type: "contact", object_id: "c1", status: "dead", attempts: 10,
      next_attempt_at: null, last_attempt_at: null, last_status_code: 500, last_error: "HTTP 500: oops", last_duration_ms: 20, delivered_at: null, resend_of: null, created_at: "2026-11-03T00:00:00Z" }]);
    h.patch.mockResolvedValue({ endpoint: { ...endpoint, status: "paused" } });
    h.post.mockResolvedValue({ delivery_id: "d2" });
    render(<WebhooksSettings />);
    const row = await screen.findByTestId("webhook-row-e1");
    expect(row).toHaveTextContent("3 delivered, 1 failed");
    fireEvent.click(within(row).getByRole("button", { name: "Send test" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/webhook-endpoints/e1/test", {}));
    fireEvent.click(within(row).getByRole("button", { name: "Log" }));
    expect(await screen.findByText("HTTP 500: oops")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resend" }));
    await waitFor(() => expect(h.post).toHaveBeenCalledWith("/api/webhook-endpoints/deliveries/d1/resend"));
    fireEvent.click(within(row).getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(h.patch).toHaveBeenCalledWith("/api/webhook-endpoints/e1", { status: "paused" }));
  });

  it("shows why an endpoint was turned off, the payload reference and the Zapier guide", async () => {
    routeGets([{ ...endpoint, status: "disabled", disabled_reason: "The receiver answered 410 Gone." }]);
    render(<WebhooksSettings />);
    const row = await screen.findByTestId("webhook-row-e1");
    expect(row).toHaveTextContent("Turned off");
    expect(row).toHaveTextContent("410 Gone");
    expect(within(row).getByRole("button", { name: "Turn back on" })).toBeInTheDocument();
    expect(screen.getByText("Use with Zapier")).toBeInTheDocument();
    expect(screen.getAllByText(/Catch Hook/).length).toBeGreaterThan(0);
    expect(screen.getByText(/240000/)).toBeInTheDocument(); // example payloads
    expect(screen.getByText(/timingSafeEqual/)).toBeInTheDocument(); // how to verify the signature
  });
});
