// KS_PORTAL_TEAM_IMPORT_v1 - Settings > Team and roles > Import team: paste rows from Excel or upload a CSV, check
// them (each row's result and the seats before and after), then add everyone and invite them now, or add them and
// invite later.
import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { api } from "@/api";
import { getErrorMessage } from "@/utils/errors";
import { parseTeamText, TEMPLATE_CSV, type ImportPerson } from "../teamImportParse";

type PreviewRow = { email: string; status: "new" | "existing" | "invalid"; error?: string };
type Preview = { rows: PreviewRow[]; seats_before: number; seats_after: number };
type ImportOut = { results: Array<{ email: string; status: string; error?: string; invited?: boolean }>; seats_after: number; invite_error: string | null };

const ERRORS: Record<string, string> = {
  invalid_email: "Email address is not valid",
  invalid_phone: "Mobile number is missing or not a Canadian or US number",
  invalid_role: "Role must be Broker, Marketing or Admin",
  invalid_name: "Name is missing",
  duplicate_in_list: "Listed twice",
  user_conflict: "Clashes with someone already here",
};

export default function TeamImportModal({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const [text, setText] = useState("");
  const [people, setPeople] = useState<ImportPerson[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async (raw: string) => {
    setError(null);
    const list = parseTeamText(raw);
    setPeople(list);
    setPreview(null);
    if (!list.length) { setError("No people found. Paste rows with a name, email and mobile number, or upload a CSV."); return; }
    if (list.length > 200) { setError("Import at most 200 people at a time."); return; }
    setBusy(true);
    try {
      const r = await api.post<Preview & { ok: boolean }>("/api/users/import", { people: list, preview: true });
      setPreview(r);
    } catch (err) {
      setError(getErrorMessage(err, "The list could not be checked. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const raw = await file.text();
    setText(raw);
    await check(raw);
  };

  const run = async (invite: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const good = people.filter((_, i) => preview?.rows[i]?.status === "new");
      const r = await api.post<ImportOut & { ok: boolean }>("/api/users/import", { people: good, invite });
      const added = r.results.filter((x) => x.status === "created").length;
      const invited = r.results.filter((x) => x.invited).length;
      let msg = `${added} ${added === 1 ? "person" : "people"} added.`;
      if (invite) msg += r.invite_error ? " Invites couldn't be sent right now; use Invite next to each person later." : ` ${invited} invited.`;
      else msg += " Nobody was emailed: use Invite when you're ready.";
      onDone(msg);
    } catch (err) {
      setError(getErrorMessage(err, "The team could not be imported. Nobody was added or invited; try again."));
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "keystone-team-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = preview
    ? { new: preview.rows.filter((r) => r.status === "new").length, existing: preview.rows.filter((r) => r.status === "existing").length, invalid: preview.rows.filter((r) => r.status === "invalid").length }
    : null;

  return (
    <Modal title="Import your team" onClose={onClose}>
      <div className="settings-grid" data-testid="team-import">
        <p style={{ margin: 0 }}>
          Paste rows from Excel or Google Sheets, or upload a CSV file. Columns: <strong>Name, Email, Mobile, Role</strong> (Broker, Marketing or Admin).
          A header row is optional. <button type="button" className="link-button" onClick={downloadTemplate}>Download a template</button>
        </p>
        <label htmlFor="team-import-text">Paste your team</label>
        <textarea
          id="team-import-text"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Jane Smith\tjane@yourbrokerage.com\t403-555-0101\tBroker"}
          style={{ width: "100%", fontFamily: "monospace" }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Button type="button" variant="secondary" disabled={busy || !text.trim()} onClick={() => check(text)}>
            {busy && !preview ? "Checking..." : "Check the list"}
          </Button>
          <label className="button button--ghost" style={{ cursor: "pointer" }}>
            Upload CSV
            <input type="file" accept=".csv,text/csv,.txt" hidden data-testid="team-import-file" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
        {error && <ErrorBanner message={error} />}
        {preview && counts && (
          <>
            <p data-testid="team-import-summary" style={{ margin: 0 }}>
              <strong>{counts.new}</strong> to add{counts.existing ? `, ${counts.existing} already on your team (left as they are)` : ""}
              {counts.invalid ? `, ${counts.invalid} with a problem (skipped)` : ""}. Seats: {preview.seats_before} now, {preview.seats_after} after.
              {preview.seats_after > preview.seats_before ? " Each added person is a paid seat on your next invoice." : ""}
            </p>
            <div style={{ maxHeight: 280, overflow: "auto" }}>
              <table className="table" data-testid="team-import-preview">
                <thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Role</th><th>Result</th></tr></thead>
                <tbody>
                  {people.map((p, i) => {
                    const r = preview.rows[i];
                    return (
                      <tr key={`${p.email}-${i}`}>
                        <td>{p.name}</td><td>{p.email}</td><td>{p.phone}</td><td>{p.role}</td>
                        <td>{r?.status === "new" ? "Will be added" : r?.status === "existing" ? "Already on your team" : ERRORS[r?.error ?? ""] ?? "Can't be added"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button type="button" disabled={busy || counts.new === 0} onClick={() => run(true)}>Add and invite now</Button>
              <Button type="button" variant="secondary" disabled={busy || counts.new === 0} onClick={() => run(false)}>Add, invite later</Button>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
