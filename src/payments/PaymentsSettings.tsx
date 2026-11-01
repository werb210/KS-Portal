// KS_HUBSPOT_GAPS_1_PAYMENTS - Settings > Payments (Admins; Growth and Pro): connect the brokerage's own Stripe account
// (Stripe Connect), see what it can take (card, pre-authorized debit) and the fee payments report.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Notice, Section, button, cell, danger, errText, muted } from "@/settingsPack/ui";
import { money, paymentsApi, type PaymentsReport, type StripeConnection } from "./paymentsApi";

const RETURN_TEXT: { [k: string]: { ok?: string; error?: string } } = {
  connected: { ok: "Your Stripe account is connected. You can now send payment links." },
  declined: { error: "Stripe was not connected (the request was cancelled in Stripe)." },
  expired: { error: "That connect link expired. Press Connect Stripe again." },
  error: { error: "Stripe could not be connected. Please try again." },
};

export function FeePaymentsReport() {
  const [r, setR] = useState<PaymentsReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void paymentsApi.report(90).then(setR).catch((e) => setErr(errText(e, "Could not load the payments report."))); }, []);
  return (
    <Section id="fee-payments-report" title="Fee payments (last 90 days)" intro="Payment links sent from applications and contacts you can see.">
      <Notice error={err} />
      {r && <>
        <table style={{ borderCollapse: "collapse", marginBottom: 8 }}>
          <tbody>
            <tr><td style={cell}>Collected</td><td style={cell} data-testid="report-paid"><strong>{money(r.paid.amount)}</strong> ({r.paid.count})</td></tr>
            <tr><td style={cell}>Bank debits processing</td><td style={cell}>{money(r.processing.amount)} ({r.processing.count})</td></tr>
            <tr><td style={cell}>Waiting for payment</td><td style={cell}>{money(r.outstanding.amount)} ({r.outstanding.count})</td></tr>
            <tr><td style={cell}>Failed</td><td style={cell}>{r.failed}</td></tr>
          </tbody>
        </table>
        {r.by_month.length > 0 && <p style={muted}>{r.by_month.map((m) => `${m.month}: ${money(m.amount)}`).join(" | ")}</p>}
      </>}
    </Section>
  );
}

export default function PaymentsSettings() {
  const [params] = useSearchParams();
  const [c, setC] = useState<StripeConnection | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const back = RETURN_TEXT[params.get("stripe") ?? ""] ?? {};
  const [err, setErr] = useState<string | null>(back.error ?? null);
  const [ok, setOk] = useState<string | null>(back.ok ?? null);
  const load = useCallback(async () => {
    try { const r = await paymentsApi.settings(); setC(r.connection); setProblem(r.problem); } catch (e) { setErr(errText(e, "Could not load the payment settings.")); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const connect = async () => {
    setErr(null);
    try { const r = await paymentsApi.connect(); window.location.assign(r.url); } catch (e) { setErr(errText(e, "Could not start connecting Stripe.")); }
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect Stripe? Open payment links will stop working until you connect again. Payments already made stay in your Stripe account.")) return;
    try { await paymentsApi.disconnect(); setOk("Stripe disconnected."); await load(); } catch (e) { setErr(errText(e, "Could not disconnect Stripe.")); }
  };

  const connected = c?.status === "connected";
  return (
    <div data-testid="payments-settings">
      <Section id="stripe" title="Stripe" intro="Clients pay fees by card or by Canadian pre-authorized debit through your own Stripe account. Money goes straight to your Stripe balance; we never hold it and take no cut.">
        <Notice error={err} ok={ok} />
        {problem && <p style={muted}>{problem}</p>}
        {c && !connected && !problem && <>
          <p style={muted}>Connect an existing Stripe account, or create one, in a few minutes. You will sign in to Stripe and come back here.</p>
          <button type="button" style={button} onClick={() => void connect()}>Connect Stripe</button>
        </>}
        {connected && <>
          <table style={{ borderCollapse: "collapse", marginBottom: 10 }}>
            <tbody>
              <tr><td style={cell}>Account</td><td style={cell} data-testid="stripe-account">{c?.business_name ?? "Your Stripe account"} ({c?.account_id}){c?.livemode === false ? " - test mode" : ""}</td></tr>
              <tr><td style={cell}>Card payments</td><td style={cell}>{c?.charges_enabled ? "On" : "Not yet - finish setting up your account in Stripe"}</td></tr>
              <tr><td style={cell}>Pre-authorized debit (bank)</td><td style={cell}>{c?.acss_debit_enabled ? "On" : "Off - turn on \"Pre-authorized debit in Canada\" in Stripe (Settings > Payment methods)"}</td></tr>
            </tbody>
          </table>
          <p style={muted}>Paid fees on an application with a QuickBooks fee invoice are recorded against that invoice automatically. Refunds are made in Stripe.</p>
          <button type="button" style={danger} onClick={() => void disconnect()}>Disconnect Stripe</button>
        </>}
      </Section>
      {connected && <FeePaymentsReport />}
    </div>
  );
}
