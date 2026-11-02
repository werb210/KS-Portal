// KS_PORTAL_ACTIVE_CONTRACTS - a Timeline row about a contract opens that contract (the Timeline is not
// duplicated: the contract's structured data stays in Active Contracts).
import { Link } from "react-router-dom";

export default function ContractTimelineLink({ contractId }: { contractId: string }) {
  const base = "/crm";
  if (!/^[0-9a-f-]{36}$/i.test(contractId)) return null;
  return (
    <Link to={`${base}/active-contracts/${contractId}`} data-testid="timeline-contract-link" style={{ display: "inline-block", marginTop: 4, fontSize: 12, color: "var(--ui-accent-fg)" }}>
      Open contract
    </Link>
  );
}
