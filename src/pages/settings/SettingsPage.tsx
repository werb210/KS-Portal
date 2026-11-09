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
import ContentSettings, { isContentSection } from "./tabs/ContentSettings"; // BF_PORTAL_v864_CONTENT_TAB
import RuntimeSettings from "./tabs/RuntimeSettings";
import UsersAndRoles from "@/roles/UsersAndRoles"; // KS_PORTAL_CUSTOM_ROLES - people and roles
import { can, usePermissions } from "@/roles/permissionStore"; // KS_PORTAL_CUSTOM_ROLES
import PhoneLines from "./tabs/PhoneLines"; // BF_PORTAL_PHONE_LINES_v689
import SettingsOverview from "./tabs/SettingsOverview";
import PlanSettings from "./tabs/PlanSettings"; // KS_PORTAL_v3_PLANS
import RetentionSettings from "./tabs/RetentionSettings"; // KS_PORTAL_v14_RETENTION
import IdVerificationSettings from "@/kyc/IdVerificationSettings"; // KS_PORTAL_v22_KYC
import VendorKeysSettings from "@/integrations/VendorKeysSettings"; // KS_PORTAL_VENDOR_KEYS
import CompanySettings from "./tabs/CompanySettings"; // KS_PORTAL_v6_COMPANY
import ConnectionsSettings from "./tabs/ConnectionsSettings"; // KS_PORTAL_M365_ONE_CLICK
import LabsSettings from "./tabs/LabsSettings"; // KS_PORTAL_BETA_v1
import HelpPage from "@/pages/help/HelpPage"; // KS_PORTAL_v6_SUPPORT
import ImportData from "@/import/ImportData"; // KS_PORTAL_v16_DATA_IMPORT
import FeatureGate, { LockedBadge } from "@/plans/FeatureGate"; // KS_PORTAL_v3_PLANS
// KS_PORTAL_SETTINGS_PACK_v1 - HubSpot-parity settings.
import PhoneMenuSettings from "@/settingsPack/PhoneMenuSettings";
import BookingSettings from "@/settingsPack/BookingSettings";
import PrivacySettings from "@/settingsPack/PrivacySettings";
import SecuritySettings from "@/settingsPack/SecuritySettings";
import SurveySettings from "@/settingsPack/SurveySettings";
import { BlockedNumbersSettings, LeadRotationSettings, NeverLogSettings } from "@/settingsPack/ListSettings";
import SsoSettings from "./tabs/SsoSettings"; // KS_PORTAL_SSO_API_KEYS
import ApiSettings from "./tabs/ApiSettings"; // KS_PORTAL_SSO_API_KEYS
import PropertiesSettings from "@/crmFields/PropertiesSettings"; // KS_PORTAL_v20_CRM_FIELDS
import TeamsSettings from "@/teams/TeamsSettings"; // KS_PORTAL_v20_TEAMS
import WebhooksSettings from "@/webhooks/WebhooksSettings"; // KS_PORTAL_v20_WEBHOOKS
import PaymentsSettings from "@/payments/PaymentsSettings"; // KS_HUBSPOT_GAPS_1_PAYMENTS
import CallScriptsSettings from "@/callScripts/CallScriptsSettings"; // KS_HUBSPOT_GAPS_1_CALL_SCRIPTS
import MeetingNotesSettings from "@/meetingNotes/MeetingNotesSettings"; // KS_HUBSPOT_GAPS_1_MEETING_NOTES
import PipelinesSettings from "@/pipelines/PipelinesSettings"; // KS_HUBSPOT_GAPS_1_PIPELINES
import CallQueuesSettings from "@/callQueues/CallQueuesSettings"; // KS_HUBSPOT_GAPS_1_CALL_QUEUES
import { hasFeature, usePlan } from "@/plans/planStore"; // KS_PORTAL_PLAN_FIXES
import DealToolsSettings from "@/brokerTools/DealToolsSettings"; // KS_BROKER_TOOLS

// KS_PORTAL_v3_PLANS - tabs that are a plan feature: a badge on the tab and a locked card instead of the content.
// KS_PORTAL_PLAN_FIXES (Todd, Oct 26) - Templates and Snippets are Growth and up: on Starter the tabs are hidden (the
// server refuses /api/templates too). Phone lines is open on every plan: each section of it is gated by its own feature
// (business line on every plan, toll-free Growth, direct lines Pro).
// KS_PORTAL_SSO_API_KEYS - single sign-on and the REST API are Pro.
const TAB_FEATURE: Record<string, string | undefined> = { sso: "sso", api: "api_access", survey: "nps_survey", teams: "teams", webhooks: "webhooks", payments: "payment_links", "call-scripts": "call_scripts", pipelines: "custom_pipelines", "call-queues": "call_queues" }; // KS_PORTAL_SETTINGS_PACK_v1_NPS (survey Growth+); KS_PORTAL_v20 teams, webhooks

const SettingsPage = () => {
  const [searchParams] = useSearchParams();
  const { tab: tabParam } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { silo } = useSilo();
  // KS_PORTAL_CUSTOM_ROLES - an Admin on a custom role (built from Admin) sees only the admin sections the role allows.
  const perms = usePermissions();
  const isAdminRole = user?.role === "Admin";
  const isAdmin = isAdminRole && can("settings", "view", perms);
  const canUsers = isAdminRole && can("users", "view", perms);
  const canBilling = can("billing", "view", perms);
  const isStaff = user?.role === "Staff"; // BF_PORTAL_BLOCK_v526
  const isBI = String(silo ?? "").toUpperCase() === "BI";
  const planState = usePlan(); // KS_PORTAL_PLAN_FIXES
  const hasTemplates = hasFeature("templates", planState);
  const hasAutomations = hasFeature("automations", planState); // BF_PORTAL_v864_CONTENT_TAB
  const isMarketing = user?.role === "Marketing"; // BF_PORTAL_v864_CONTENT_TAB

  const tabs = useMemo(
    () => [
      // KS_SETTINGS_YOU - My Profile, Content and AI Knowledge come first and are there for every Broker (Staff),
      // Marketing and Admin user. Maya tuning stays Admin-only inside AI Knowledge.
      { id: "profile", label: "My Profile", visible: true, content: <ProfileSettings /> },
      { id: "content", label: "Content", visible: true, content: <ContentSettings isBI={isBI} hasTemplates={hasTemplates} canAutomate={(isAdmin || isMarketing) && hasAutomations} /> },
      { id: "ai-knowledge", label: "AI Knowledge", visible: !isBI, content: isAdmin ? (<><KnowledgeManager /><div style={{ height: 28 }} /><MayaTuning /></>) : <KnowledgeManager /> },
      // KS_PORTAL_v6_COMPANY - the licensee's company details, branding and connections (Admins only).
      { id: "company", label: "Company", visible: isAdmin, content: <CompanySettings /> },
      // KS_PORTAL_M365_ONE_CLICK - Microsoft 365 (one click for the company) and Google Workspace status (Admins only).
      { id: "connections", label: "Connections", visible: isAdmin && !isBI, content: <ConnectionsSettings /> },
      { id: "users", label: "Users & roles", visible: canUsers && !isBI, content: <UsersAndRoles /> }, // KS_PORTAL_CUSTOM_ROLES
      // KS_PORTAL_v20 - custom fields (every plan), teams and record visibility (growth+), webhooks and Zapier (pro). Admins only.
      { id: "properties", label: "Properties", visible: isAdmin && !isBI, content: <PropertiesSettings /> },
      { id: "teams", label: "Teams", visible: canUsers && !isBI, content: <TeamsSettings /> },
      { id: "webhooks", label: "Webhooks", visible: isAdmin && !isBI, content: <WebhooksSettings /> },
      // KS_HUBSPOT_GAPS_1 - HubSpot-parity gaps.
      { id: "payments", label: "Payments", visible: isAdmin && !isBI, content: <PaymentsSettings /> }, // Stripe Connect (growth+)
      { id: "call-scripts", label: "Call scripts", visible: isAdmin && !isBI, content: <CallScriptsSettings /> }, // playbooks (growth+)
      { id: "pipelines", label: "Pipelines", visible: isAdmin && !isBI, content: <PipelinesSettings /> }, // extra pipelines (growth 3, pro unlimited)
      { id: "deal-tools", label: "Deal tools", visible: (isAdmin || isStaff) && !isBI, content: <DealToolsSettings isAdmin={isAdmin} /> }, // KS_BROKER_TOOLS
      { id: "call-queues", label: "Call queues", visible: (isAdmin || isStaff) && !isBI, content: <CallQueuesSettings /> }, // pro: live panel (Admins), my availability
      { id: "phone", label: "Phone lines", visible: isAdmin && !isBI, content: <PhoneLines /> }, // BF_PORTAL_PHONE_LINES_v689
      // KS_PORTAL_SETTINGS_PACK_v1 - Admin settings: phone menu, booking pages, lead rotation, blocked numbers, never log,
      // security, privacy requests and the client survey.
      { id: "phone-menu", label: "Phone menu", visible: isAdmin && !isBI, content: <PhoneMenuSettings /> },
      { id: "booking", label: "Booking pages", visible: isAdmin && !isBI, content: <BookingSettings /> },
      { id: "lead-rotation", label: "Lead rotation", visible: isAdmin && !isBI, content: <LeadRotationSettings /> },
      { id: "blocked-numbers", label: "Blocked numbers", visible: isAdmin && !isBI, content: <BlockedNumbersSettings /> },
      { id: "never-log", label: "Never log", visible: isAdmin && !isBI, content: <NeverLogSettings /> },
      { id: "security", label: "Security", visible: isAdmin, content: <SecuritySettings /> },
      { id: "privacy", label: "Privacy requests", visible: isAdmin && !isBI, content: <PrivacySettings /> },
      { id: "survey", label: "Client survey", visible: isAdmin && !isBI, content: <SurveySettings /> },
      { id: "meeting-notes", label: "Meeting notes", visible: !isBI, content: <MeetingNotesSettings /> }, // KS_HUBSPOT_GAPS_1_MEETING_NOTES - Zoom / Google Meet
      { id: "runtime", label: "Runtime Verification", visible: !isBI, content: <RuntimeSettings /> },
      // BF_PORTAL_v864_CONTENT_TAB - Templates, Snippets, Collateral, the Library and the automations are sections of one
      // Content tab (tabs/ContentSettings.tsx); plan limits still apply to each section.
      { id: "plan", label: "Plan", visible: canBilling, content: <PlanSettings /> }, // KS_PORTAL_v3_PLANS // KS_PORTAL_CUSTOM_ROLES
      // KS_PORTAL_BETA_v1 - beta features the brokerage can try (join, leave, feedback). Admins only.
      { id: "labs", label: "Labs", visible: isAdmin && !isBI, content: <LabsSettings /> },
      { id: "retention", label: "Retention & legal holds", visible: isAdmin, content: <RetentionSettings /> }, // KS_PORTAL_v14_RETENTION
      { id: "id-verification", label: "ID verification", visible: isAdmin && !isBI, content: <IdVerificationSettings /> }, // KS_PORTAL_v22_KYC
      { id: "your-services", label: "Your services", visible: isAdmin && !isBI, content: <VendorKeysSettings /> }, // KS_PORTAL_VENDOR_KEYS - bring your own verification services
      // KS_PORTAL_SSO_API_KEYS - Admins: Microsoft / Google sign-in for staff, and API keys with the REST API docs.
      { id: "sso", label: "Single sign-on", visible: isAdmin && !isBI, content: <SsoSettings /> },
      { id: "api", label: "API", visible: isAdmin && !isBI, content: <ApiSettings /> },
      // KS_PORTAL_v16_DATA_IMPORT - bring records over from another system (Admins only).
      { id: "import", label: "Import data", visible: isAdmin && !isBI, content: <ImportData /> },
      { id: "help", label: "Help", visible: isAdmin || isStaff, content: <HelpPage /> }, // KS_PORTAL_v6_SUPPORT
      // BF_PORTAL_PARTNERS_TABS_v720 - Broker Files moved to Marketing > Referrers > Brokers.
    ],
    [isAdmin, isStaff, isBI, hasTemplates, hasAutomations, isMarketing, canUsers, canBilling]
  );

  // KS_PORTAL_SETTINGS_GROUPED_v1 - same layout as BF-Portal v885/v892: a list of groups on the left (YOU for everyone,
  // BROKERAGE SET-UP for Admins), each group one page with its sections stacked. Old addresses (/settings/phone-menu ...)
  // open their group and scroll to the section. Plan features keep their badge and locked card per section.
  const safeTabs = Array.isArray(tabs) ? tabs : [];
  const visibleSections = safeTabs.filter((tab) => tab.visible);
  const groups = SETTINGS_GROUPS.filter((g) => isAdmin || g.heading === "YOU" || (g.id === "plan" && canBilling))
    .map((g) => ({ ...g, sections: g.sectionIds.map((id) => visibleSections.find((t) => t.id === id)).filter((t): t is (typeof visibleSections)[number] => Boolean(t)) }))
    .filter((g) => g.sections.length > 0);
  const requestedTabId = tabParam ?? searchParams.get("tab");
  // BF_PORTAL_v864_CONTENT_TAB - the old tabs forward to their section of Content, so links and bookmarks keep working.
  const legacySection = isContentSection(requestedTabId) ? requestedTabId : null;
  const activeId = legacySection ? "content" : requestedTabId === "content-ai" ? "content" : requestedTabId;
  const groupOf = (id: string | null | undefined) => groups.find((g) => g.id === id) ?? groups.find((g) => g.sections.some((t) => t.id === id));
  const fallbackGroup = groups.find((g) => g.id === "profile") ?? groups[0];
  const activeGroup = groupOf(activeId) ?? fallbackGroup;
  const resolvedTabId = activeGroup && (activeGroup.id === activeId || activeGroup.sections.some((t) => t.id === activeId)) ? String(activeId) : activeGroup?.id ?? "profile";
  const focusSection = activeGroup && activeGroup.id !== resolvedTabId ? resolvedTabId : null;

  useEffect(() => {
    if (legacySection) {
      navigate(`/settings/content?section=${legacySection}`, { replace: true });
      return;
    }
    if (tabParam !== resolvedTabId) navigate(`/settings/${resolvedTabId}`, { replace: true });
  }, [navigate, resolvedTabId, tabParam, legacySection]);

  useEffect(() => {
    if (!focusSection) return;
    const el = typeof document !== "undefined" ? document.getElementById(`settings-section-${focusSection}`) : null;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "start" });
  }, [focusSection]);

  let lastHeading = "";
  return (
    <RequireRole roles={["Admin", "Staff", "Marketing"]}>
      <ErrorBoundary>
        <SettingsSectionLayout>
          {groups.length === 0 ? (
            <div className="settings-panel" role="status">
              <h2>Settings</h2>
              <p>No settings sections are available for your account.</p>
            </div>
          ) : (
            <div className="settings-grouped">
              <style>{GROUPED_CSS}</style>
              <div className="settings-groups" role="tablist" aria-label="Settings tabs" aria-orientation="vertical">
                {groups.map((g) => {
                  const heading = g.heading !== lastHeading && isAdmin ? g.heading : "";
                  lastHeading = g.heading;
                  return (
                    <div key={g.id} style={{ display: "contents" }}>
                      {heading && <div className="settings-group-heading">{heading}</div>}
                      <button
                        type="button"
                        role="tab"
                        aria-selected={g.id === activeGroup?.id}
                        className={`settings-group ${g.id === activeGroup?.id ? "is-active" : ""}`}
                        onClick={() => navigate(`/settings/${g.id}`)}
                      >
                        {g.label}
                        {g.sections.length === 1 && TAB_FEATURE[g.sections[0]!.id] && <LockedBadge feature={TAB_FEATURE[g.sections[0]!.id]!} />}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="settings-content" role="tabpanel" aria-label={activeGroup?.label}>
                {activeGroup && activeGroup.sections.length > 1 && <h2 className="settings-group-title">{activeGroup.label}</h2>}
                {activeGroup?.sections.map((t) => (
                  <section key={t.id} id={`settings-section-${t.id}`} className="settings-group-section" aria-label={t.label}>
                    {activeGroup.sections.length > 1 && <h3 className="settings-section-title">{t.label}{TAB_FEATURE[t.id] && <LockedBadge feature={TAB_FEATURE[t.id]!} />}</h3>}
                    <ErrorBoundary>{TAB_FEATURE[t.id] ? <FeatureGate key={t.id} feature={TAB_FEATURE[t.id]!}>{t.content}</FeatureGate> : t.content}</ErrorBoundary>
                  </section>
                ))}
              </div>
            </div>
          )}
        </SettingsSectionLayout>
      </ErrorBoundary>
    </RequireRole>
  );
};

// KS_PORTAL_SETTINGS_GROUPED_v1 - the groups (BF-Portal's list plus Keystone's own Company, Plan, Labs and Help).
export const SETTINGS_GROUPS: Array<{ id: string; label: string; heading: string; sectionIds: string[] }> = [
  { id: "profile", label: "My Profile", heading: "YOU", sectionIds: ["profile"] },
  { id: "content", label: "Content", heading: "YOU", sectionIds: ["content"] },
  { id: "ai-knowledge", label: "AI Knowledge", heading: "YOU", sectionIds: ["ai-knowledge"] },
  { id: "meeting-notes", label: "Meeting notes", heading: "YOU", sectionIds: ["meeting-notes"] },
  { id: "help", label: "Help", heading: "YOU", sectionIds: ["help"] },
  { id: "company", label: "Company", heading: "BROKERAGE SET-UP", sectionIds: ["company", "connections"] },
  { id: "plan", label: "Plan and billing", heading: "BROKERAGE SET-UP", sectionIds: ["plan"] },
  { id: "team", label: "Team and roles", heading: "BROKERAGE SET-UP", sectionIds: ["users", "teams"] },
  { id: "crm", label: "CRM set-up", heading: "BROKERAGE SET-UP", sectionIds: ["properties", "pipelines"] },
  { id: "phone-group", label: "Phone", heading: "BROKERAGE SET-UP", sectionIds: ["phone", "phone-menu", "call-queues", "call-scripts", "lead-rotation", "blocked-numbers", "never-log", "booking"] },
  { id: "money", label: "Money", heading: "BROKERAGE SET-UP", sectionIds: ["payments"] },
  { id: "risk", label: "Risk and ID checks", heading: "BROKERAGE SET-UP", sectionIds: ["id-verification", "your-services"] },
  { id: "sign-in", label: "Sign-in and security", heading: "BROKERAGE SET-UP", sectionIds: ["security", "sso"] },
  { id: "records", label: "Privacy and records", heading: "BROKERAGE SET-UP", sectionIds: ["retention", "privacy", "survey"] },
  { id: "integrations", label: "Integrations", heading: "BROKERAGE SET-UP", sectionIds: ["webhooks", "api", "import"] },
  { id: "deal-tools-group", label: "Deal tools", heading: "BROKERAGE SET-UP", sectionIds: ["deal-tools"] },
  { id: "labs-group", label: "Labs", heading: "BROKERAGE SET-UP", sectionIds: ["labs"] },
  { id: "system", label: "System check", heading: "BROKERAGE SET-UP", sectionIds: ["runtime"] },
];

const GROUPED_CSS = `
.settings-grouped { display: flex; gap: 24px; align-items: flex-start; }
.settings-groups { width: 230px; flex: 0 0 230px; display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--ui-border); border-radius: 12px; padding: 10px; position: sticky; top: 12px; }
.settings-group-heading { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; color: var(--ui-text-muted); padding: 10px 10px 4px; }
.settings-group { text-align: left; font-size: 15px; padding: 9px 10px; border: 0; border-radius: 8px; background: transparent; color: var(--ui-text); cursor: pointer; }
.settings-group:hover { background: var(--ui-surface-muted); }
.settings-group.is-active { background: var(--ui-surface-strong); color: var(--ui-text); font-weight: 600; box-shadow: inset 3px 0 0 #2FA86A; }
.settings-content { flex: 1; min-width: 0; }
.settings-group-title { margin: 0 0 8px; font-size: 22px; }
.settings-group-section { padding: 16px 0 24px; border-bottom: 1px solid var(--ui-border); scroll-margin-top: 12px; }
.settings-group-section:last-child { border-bottom: 0; }
.settings-section-title { margin: 0 0 12px; font-size: 18px; }
@media (max-width: 820px) {
  .settings-grouped { flex-direction: column; }
  .settings-groups { width: 100%; flex: none; position: static; flex-direction: row; flex-wrap: wrap; }
  .settings-group-heading { width: 100%; }
}
`;

export default SettingsPage;

// BF_PORTAL_BI_SILO_NAV_v56_SETTINGS_ANCHOR
