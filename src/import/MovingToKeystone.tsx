// KS_PORTAL_v16_DATA_IMPORT - "Moving to Keystone": a short guide to bringing records over, shown in Settings >
// Import data and in Help. Plain text on the portal's own surface colours, readable in both themes.
import type { CSSProperties } from "react";

const card: CSSProperties = { padding: 16, border: "1px solid var(--ui-border)", borderRadius: 12, background: "var(--ui-surface-strong)", color: "var(--ui-text)", marginBottom: 16, fontSize: 14, lineHeight: 1.5 };
const h3: CSSProperties = { margin: "0 0 8px", fontSize: 16, color: "var(--ui-text)" };
const h4: CSSProperties = { margin: "12px 0 4px", fontSize: 14, color: "var(--ui-text)" };
const list: CSSProperties = { margin: "0 0 8px", paddingLeft: 20 };

export default function MovingToKeystone() {
  return (
    <section style={card} data-testid="moving-to-keystone">
      <h3 style={h3}>Moving to Keystone</h3>
      <p style={{ margin: "0 0 8px" }}>
        An administrator brings your records over in Settings, Import data. Nothing is saved until you have seen a check of every row,
        and an import can be undone afterwards.
      </p>

      <h4 style={h4}>1. Export from your old system</h4>
      <ul style={list}>
        <li><strong>HubSpot:</strong> on each list (Contacts, Companies, Deals) choose Export, CSV, all properties. Activities and notes export from the same place.</li>
        <li><strong>Salesforce:</strong> a report per object (Contacts, Accounts, Opportunities, Tasks) exported as CSV, or Data Loader. Include the Id columns.</li>
        <li><strong>Pipedrive:</strong> Settings, Export data, one file each for People, Organizations, Deals and Notes or Activities.</li>
        <li><strong>A spreadsheet:</strong> download the template for each record type from the importer and paste your data into it.</li>
        <li><strong>Another Keystone portal:</strong> download that portal's data (a .zip) and upload it as a Keystone export. Everything comes in together, still linked.</li>
      </ul>

      <h4 style={h4}>2. Import in this order</h4>
      <ol style={list}>
        <li>Companies</li>
        <li>Contacts</li>
        <li>Lenders, then lender products</li>
        <li>Deals (applications)</li>
        <li>Notes and activities</li>
        <li>Documents: one .zip with the files and a CSV saying which deal or contact each file belongs to, and its category</li>
      </ol>
      <p style={{ margin: "0 0 8px" }}>
        Keep the old system's ID columns: a deal that names its contact's old ID is linked to that contact, even across files.
        Importing the same file twice updates the records instead of making copies.
      </p>

      <h4 style={h4}>3. Match, preview and check</h4>
      <ul style={list}>
        <li>Columns are matched for you; change any that are wrong, and save the mapping to reuse it next time.</li>
        <li>Existing records are updated, not duplicated: contacts by email or phone number, companies and lenders by name.</li>
        <li>Pipeline stages are matched to Keystone's stages. Choose a stage for any the importer does not recognise.</li>
        <li>The check shows how many records will be created, updated or skipped, and lists rows with problems as a CSV you can fix and upload again.</li>
      </ul>

      <h4 style={h4}>4. Import, and undo if you need to</h4>
      <ul style={list}>
        <li>The import runs in the background; you can leave the page and come back to see its progress.</li>
        <li>Undo removes the records the import added and puts back fields it changed. A field someone has edited since stays as it is, and records under a legal hold are kept.</li>
        <li>Limits: CSV or Excel up to 50 MB, a .zip up to 200 MB, each document up to 25 MB, and up to 200,000 rows per file. Split larger exports into parts.</li>
      </ul>
    </section>
  );
}
