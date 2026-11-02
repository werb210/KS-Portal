// KS_BROKER_TOOLS_2 - the application's Deal desk tab: the broker tools that work on one deal, each behind its plan
// feature.
import Gate from "./gate";
import InvoicesPanel from "./InvoicesPanel"; // KS_BROKER_TOOLS_INVOICES
import CreditLinesPanel from "./CreditLinesPanel"; // KS_BROKER_TOOLS_CREDIT_LINES

export default function DealDeskTab({ applicationId }: { applicationId: string }) {
  return (
    <div data-testid="deal-desk" style={{ maxWidth: 1200 }}>
      <Gate feature="invoice_reading"><InvoicesPanel applicationId={applicationId} /></Gate>
      <Gate feature="credit_lines"><CreditLinesPanel applicationId={applicationId} /></Gate>
    </div>
  );
}
