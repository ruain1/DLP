// GENERATED smoke double for ./data: stubs every exported name src imports.
// The boot smoke aliases the real data layer to this file; nothing touches the network.
export const PRIV_GROUPS = [];
export async function addActivityUpdate() { return null; }
export async function addMember() { return null; }
export async function addProjectCompany() { return null; }
export async function applyAuditRevert() { return null; }
export function applyBrandToTab() {}
export async function checkImportFingerprint() { return null; }
export async function claimEnergisedConfirmation() { return null; }
export async function claimInvite() { return null; }
export async function clearBaseline() { return null; }
export async function companyUsage() { return null; }
export async function computeDocsConflicts() { return null; }
export async function computeSyncConflicts() { return null; }
export async function countCompanyActivitiesOnProject() { return null; }
export async function createCompany() { return null; }
export async function createProject() { return null; }
export async function createVendor() { return null; }
export async function decideAccessRequest() { return null; }
export async function decideInviteRequest() { return null; }
export async function deleteAssetOverride() { return null; }
export async function deleteCompanyById() { return null; }
export async function deleteDocsOverride() { return null; }
export async function deleteVendorById() { return null; }
export async function diffBenchmarkSnapshots() { return null; }
export async function ensureProjectCompanies() { return null; }
export async function fetchAccessRequests() { return null; }
export async function fetchActivityAudit() { return null; }
export async function fetchActivityUpdates() { return null; }
export async function fetchBranding() { return null; }
export async function fetchCreatedBetween() { return null; }
export async function fetchUpdatesBetween() { return null; }
export async function fetchUserStatus() { return null; }
export async function heartbeat() {}
export async function importFingerprint() { return null; }
export async function linkBenchmarksToActivities() { return null; }
export async function loadAccSync() { return null; }
export async function loadAccSyncEvents() { return null; }
export async function loadActivitySnapshots() { return null; }
export async function loadAll() {
  return {
    projectCompanyIds: [], companies: [], areas: [], systems: [], crews: [],
    levels: {},
    settings: { weeks: 4, makeReadyDays: 7, workingDays: [1, 2, 3, 4, 5], hoursPerDay: 8, ppcTarget: 80, benchmarksVisible: false, crewsEnabled: false, pageIcons: {}, design: {} },
    users: [{ id: "smoke-user", name: "Smoke Tester", role: "admin", companyId: null, platformRole: "user", mustReset: false }],
    loadErrors: [],
    activities: [],
    audit: [],
    brand: { projectName: "FIN04", appName: "DLP", logoUrl: "", logoDark: "", tagline: "" },
    projectMeta: { code: "FIN04", location: "Smoke", id: "smoke-proj" },
    projectRole: "admin", projectId: "smoke-proj",
    baseline: null, constraints: [], theme: "dark",
  };
}
export async function loadAssetEventsNamed() { return null; }
export async function loadAssetOverrides() { return null; }
export async function loadAssetStatus() { return null; }
export async function loadBaseline() { return null; }
export async function loadBenchmarkImports() { return null; }
export async function loadBenchmarks() { return null; }
export async function loadDirectory() { return null; }
export async function loadDocsStatus() { return null; }
export async function loadLatestAuditByUser() { return {}; }
export async function loadMembershipCounts() { return null; }
export async function loadPortfolioAnalytics() { return null; }
export async function loadPresence() { return {}; }
export async function loadProjectCompanies() { return null; }
export async function loadProjectCompanyMap() { return null; }
export async function loadProjectMembers() { return null; }
export async function loadProjectOverview() { return null; }
export async function loadProjects() { return { isSuper: false, platformRole: "user", userName: "Smoke Tester", list: [{ id: "smoke-proj", name: "FIN04 Smoke", status: "active" }], activity: [] }; }
export async function loadReportRecipients() { return null; }
export async function loadVendorUsageByName() { return null; }
export async function loadVendors() { return null; }
export async function mergeVendorNames() { return null; }
export const projName = () => "FIN04";
export async function recordImportFingerprint() { return null; }
export async function releaseEnergisedConfirmation() { return null; }
export async function removeMember() { return null; }
export async function removeProjectCompany() { return null; }
export async function renameCompany() { return null; }
export async function resolveBenchmarkCompanies() { return null; }
export function resolvePriv() { return { can: () => false }; }
export async function saveAssetOverride() { return null; }
export async function saveAssetRegister() { return null; }
export async function saveAssetStatusConfig() { return null; }
export async function saveAssetVendor() { return null; }
export async function saveBaseline() { return null; }
export async function saveBaselineMappings() { return null; }
export async function saveDocsMatrix() { return null; }
export async function saveDocsOverride() { return null; }
export async function saveDocsStatusConfig() { return null; }
export async function saveDocsVendorTarget() { return null; }
export async function saveReportRecipients() { return null; }
export async function saveStepReference() { return null; }
export async function saveUserPrivileges() { return null; }
export function scopeCompanies(x) { return x || []; }
export function scopeCompaniesWith(x) { return x || []; }
export async function setActivityPercent() { return null; }
export async function setAssetEventState() { return null; }
export async function setBenchmarkComplete() { return null; }
export async function setCompanyDomain() { return null; }
export async function setCompanyLogo() { return null; }
export async function setMemberRole() { return null; }
export async function setPlatformRole() { return null; }
export async function signOut() {}
export async function submitAccessRequest() { return null; }
export async function submitInviteRequest() { return null; }
export function subscribeAccessRequests() { return () => {}; }
export function subscribeAll() { return () => {}; }
export async function syncCollections() { return null; }
export async function updateBranding() { return null; }
export async function updateProject() { return null; }
export async function updateVendor() { return null; }
export async function uploadCompanyLogo() { return null; }
export async function uploadLogo() { return null; }
export async function userOp() { return null; }
export async function writeBenchmarks() { return null; }
