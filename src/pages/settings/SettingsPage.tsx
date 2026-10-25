// BF_PORTAL_BI_SILO_NAV_v56 — BI silo Settings deliberately scopes to
// "My Profile" only. User Management, AI Knowledge, and Runtime
// Verification all live in BF; BI inherits the user table from BF and
// has no per-silo admin surface, so showing those tabs in BI just
// confuses staff. BF and SLF Settings are unchanged.
import { useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import RequireRole from "@/components/auth/RequireRole";
import ErrorBoundary from "@/components/system/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { useSilo } from "@/hooks/useSilo";
import KnowledgeManager from "@/features/ai/KnowledgeManager";
import MayaTuning from "@/features/ai/MayaTuning";
import SettingsSectionLayout from "./components/SettingsSectionLayout";
import ProfileSettings from "./tabs/ProfileSettings";
import RuntimeSettings from "./tabs/RuntimeSettings";
import UserManagement from "./tabs/UserManagement";
import PhoneLines from "./tabs/PhoneLines"; // BF_PORTAL_PHONE_LINES_v689
import SettingsOverview from "./tabs/SettingsOverview";
import TemplatesSettings from "./tabs/TemplatesSettings"; // v694
import SnippetsSettings from "./tabs/SnippetsSettings"; // BF_PORTAL_SNIPPETS_TAB_v46
import CollateralSettings from "./tabs/CollateralSettings"; // v694
import LibraryPage from "@/pages/library/LibraryPage"; // BF_PORTAL_LIBRARY_IN_SETTINGS_v764
import PlanSettings from "./tabs/PlanSettings"; // KS_PORTAL_v3_PLANS
import RetentionSettings from "./tabs/RetentionSettings"; // KS_PORTAL_v14_RETENTION
import CompanySettings from "./tabs/CompanySettings"; // KS_PORTAL_v6_COMPANY
import LabsSettings from "./tabs/LabsSettings"; // KS_PORTAL_BETA_v1
import HelpPage from "@/pages/help/HelpPage"; // KS_PORTAL_v6_SUPPORT
import ImportData from "@/import/ImportData"; // KS_PORTAL_v16_DATA_IMPORT
import FeatureGate, { LockedBadge } from "@/plans/FeatureGate"; // KS_PORTAL_v3_PLANS

// KS_PORTAL_v3_PLANS - tabs that are a plan feature: a badge on the tab and a locked card instead of the content.
// Per-person direct numbers are the Pro "multiple lines" feature; templates are Growth.
const TAB_FEATURE: Record<string, string | undefined> = { phone: "multiple_lines", templates: "templates" };

const SettingsPage = () => {
  const [searchParams] = useSearchParams();
  const { tab: tabParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { silo } = useSilo();
  const isAdmin = user?.role === "Admin";
  const isStaff = user?.role === "Staff"; // BF_PORTAL_BLOCK_v526
  const isBI = String(silo ?? "").toUpperCase() === "BI";

  const tabs = useMemo(
    () => [
      // KS_PORTAL_v6_COMPANY - the licensee's company details, branding and connections (Admins only).
      { id: "company", label: "Company", visible: isAdmin, content: <CompanySettings /> },
      { id: "users", label: "User Management", visible: isAdmin && !isBI, content: <UserManagement /> },
      { id: "phone", label: "Phone lines", visible: isAdmin && !isBI, content: <PhoneLines /> }, // BF_PORTAL_PHONE_LINES_v689
      { id: "ai-knowledge", label: "AI Knowledge", visible: isAdmin && !isBI, content: isAdmin ? (<><KnowledgeManager /><div style={{ height: 28 }} /><MayaTuning /></>) : null },
      { id: "profile", label: "My Profile", visible: true, content: <ProfileSettings /> },
      { id: "runtime", label: "Runtime Verification", visible: !isBI, content: <RuntimeSettings /> },
      { id: "templates", label: "Templates", visible: !isBI, content: <TemplatesSettings /> }, // v694
      // BF_PORTAL_SNIPPETS_TAB_v46 - visible in BI too: #pnw is as useful on a
      // PGI conversation as a lending one, and the server scopes by silo.
      { id: "snippets", label: "Snippets", visible: true, content: <SnippetsSettings /> },
      { id: "collateral", label: "Collateral", visible: !isBI, content: <CollateralSettings /> }, // v694
      // BF_PORTAL_LIBRARY_IN_SETTINGS_v764 - the Staff Library (lender forms, Read This) lives here, not in the sidebar.
      { id: "library", label: "Library", visible: true, content: <LibraryPage /> },
      { id: "plan", label: "Plan", visible: true, content: <PlanSettings /> }, // KS_PORTAL_v3_PLANS
      // KS_PORTAL_BETA_v1 - beta features the brokerage can try (join, leave, feedback). Admins only.
      { id: "labs", label: "Labs", visible: isAdmin && !isBI, content: <LabsSettings /> },
      { id: "retention", label: "Retention & legal holds", visible: isAdmin, content: <RetentionSettings /> }, // KS_PORTAL_v14_RETENTION
      // KS_PORTAL_v16_DATA_IMPORT - bring records over from another system (Admins only).
      { id: "import", label: "Import data", visible: isAdmin && !isBI, content: <ImportData /> },
      { id: "help", label: "Help", visible: isAdmin || isStaff, content: <HelpPage /> }, // KS_PORTAL_v6_SUPPORT
      // BF_PORTAL_PARTNERS_TABS_v720 - Broker Files moved to Marketing > Referrers > Brokers.
    ],
    [isAdmin, isStaff, isBI]
  );

  const safeTabs = Array.isArray(tabs) ? tabs : [];
  const availableTabs = safeTabs.filter((tab) => tab.visible);
  const activeTabId = tabParam ?? searchParams.get("tab");
  const fallbackTabId = availableTabs.some((tab) => tab.id === "profile") ? "profile" : availableTabs[0]?.id ?? "profile";
  const resolvedTabId = availableTabs.some((tab) => tab.id === activeTabId) ? activeTabId : fallbackTabId;
  const activeTab = availableTabs.find((tab) => tab.id === resolvedTabId) ?? availableTabs[0];
  // v694: land directly on the tabbed view (default My Profile) instead of the card chooser.
  const showOverview = false;

  useEffect(() => {
    if (!tabParam) {
      navigate(`/settings/${resolvedTabId}`, { replace: true });
      return;
    }
    if (tabParam && resolvedTabId !== tabParam) {
      navigate(`/settings/${resolvedTabId}`, { replace: true });
    }
  }, [activeTabId, navigate, resolvedTabId, tabParam]);

  return (
    <RequireRole roles={["Admin", "Staff"]}>
      <ErrorBoundary>
        <SettingsSectionLayout>
          {showOverview ? (
            <SettingsOverview />
          ) : availableTabs.length === 0 ? (
            <div className="settings-panel" role="status">
              <h2>Settings</h2>
              <p>No settings sections are available for your account.</p>
            </div>
          ) : (
            <div className="settings-layout">
              <div className="settings-tabs" role="tablist" aria-label="Settings tabs" style={{ display: "flex", flexDirection: "row", gap: 4, borderBottom: "1px solid var(--ui-border)", marginBottom: 24, flexWrap: "wrap" }}>
                {availableTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={tab.id === resolvedTabId}
                    className={`settings-tab ${tab.id === resolvedTabId ? "is-active" : ""}`}
                    style={{ padding: "8px 16px", borderRadius: "6px 6px 0 0", whiteSpace: "nowrap" }}
                    onClick={() => navigate(`/settings/${tab.id}`)}
                  >
                    {tab.label}
                    {TAB_FEATURE[tab.id] && <LockedBadge feature={TAB_FEATURE[tab.id]!} />}
                  </button>
                ))}
              </div>
              <div className="settings-content" role="tabpanel">
                <ErrorBoundary>
                  {activeTab && TAB_FEATURE[activeTab.id] ? <FeatureGate key={activeTab.id} feature={TAB_FEATURE[activeTab.id]!}>{activeTab.content}</FeatureGate> : activeTab?.content}
                </ErrorBoundary>
              </div>
            </div>
          )}
        </SettingsSectionLayout>
      </ErrorBoundary>
    </RequireRole>
  );
};

export default SettingsPage;

// BF_PORTAL_BI_SILO_NAV_v56_SETTINGS_ANCHOR
