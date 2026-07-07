// REV115: SharePoint sync for the Asset Status page.
// The Cx Master lives in the Quantum MC tenant, a DIFFERENT tenant from the
// Outlook integration (CS Nordics). Delegated tokens are tenant-bound, so this
// module runs its own MSAL instance against a dedicated single-tenant app
// registration (DLP SharePoint Sync) in the file's tenant. The client and
// tenant ids are public identifiers, not secrets; PKCE, no client secret.
// Deliberately a separate file from outlook.js so the two auth flows and token
// caches cannot cross-contaminate; MSAL namespaces its cache by clientId, so
// the two instances coexist in localStorage without conflict.
import { PublicClientApplication } from "@azure/msal-browser";

const DEFAULT_CLIENT_ID = "f427bccb-01e7-4066-a7bf-35caee5e5002";
const DEFAULT_TENANT_ID = "bac317b1-4620-48f4-9c20-eb5308d5540b";
const SCOPES = ["Files.Read.All"];

let msal = null;
let ready = null;
let pendingHash;
let ids = { clientId: DEFAULT_CLIENT_ID, tenantId: DEFAULT_TENANT_ID };

// Must be called before the first token use if the project config overrides the
// defaults. No-op once the MSAL instance exists (a changed registration needs a
// page reload, which the page states next to the config fields).
export function initSharePoint(cfg) {
  if (msal) return;
  if (cfg && cfg.client_id) ids.clientId = cfg.client_id;
  if (cfg && cfg.tenant_id) ids.tenantId = cfg.tenant_id;
}

// Same captured-hash contract as outlook.js: the app boot rewrites the URL
// before lazy chunks can read location.hash, so the auth response is handed in
// explicitly. Both MSAL instances receive the same hash on a redirect return;
// each only consumes a response whose state lives in its own cache namespace,
// the other resolves null. That is the documented multi-instance behaviour.
export function primeRedirectHash(h) { if (!msal) pendingHash = h || undefined; }

const app = () => {
  if (!msal) {
    msal = new PublicClientApplication({
      auth: { clientId: ids.clientId, authority: "https://login.microsoftonline.com/" + ids.tenantId, redirectUri: window.location.origin, navigateToLoginRequestUrl: false },
      cache: { cacheLocation: "localStorage" },
    });
    ready = msal.initialize()
      .then(() => msal.handleRedirectPromise(pendingHash ? { hash: pendingHash } : undefined)
        .then((res) => { if (res && res.account) msal.setActiveAccount(res.account); })
        .catch(() => { /* hash belonged to the Outlook instance or was stale; harmless */ }))
      .then(() => { pendingHash = undefined; return null; })
      .catch(() => { pendingHash = undefined; return null; });
  }
  return msal;
};

// MSAL's account cache is shared across client instances on the same origin, so
// getAllAccounts also returns the Outlook (CS Nordics) sign-in. Only an account
// whose tenantId matches the file's tenant can mint a Files.Read.All token here,
// so the picker filters hard on tenant.
const tenantAccount = (m) => (m.getAllAccounts() || []).find((a) => a.tenantId === ids.tenantId) || null;

export async function sharePointAccount() {
  const m = app(); await ready;
  return tenantAccount(m);
}

export function requiredTenant() { return ids.tenantId; }

// REV122: an abandoned or failed redirect sign-in (closed tab at the Microsoft
// screen, back button, or an AADSTS error page that never redirects home) leaves
// MSAL's interaction flag set in this tab's storage, and every later connect
// throws interaction_in_progress. At the moment the user presses Connect there
// is provably no interaction running in this tab (a live one would have
// navigated away), so a stale flag is safe to purge, once, then retry.
function purgeStuckInteraction(clientId) {
  try {
    const needle = "interaction.status";
    [window.sessionStorage, window.localStorage].forEach((store) => {
      const kill = [];
      for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.indexOf(needle) !== -1 && k.indexOf(clientId) !== -1) kill.push(k); }
      if (!kill.length) for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.indexOf("msal") !== -1 && k.indexOf(needle) !== -1) kill.push(k); }
      kill.forEach((k) => { try { store.removeItem(k); } catch (e) {} });
    });
  } catch (e) {}
}

const isStuck = (e) => !!e && ((e.errorCode === "interaction_in_progress") || String(e.message || e).indexOf("interaction_in_progress") !== -1);

export async function connectSharePoint() {
  const m = app(); await ready;
  // Redirect-first for the same three reasons outlook.js is (REV90): popup
  // blockers and enterprise policy, background-tab popup monitoring, and the
  // msal-browser 5.x popup-close regression.
  try {
    await m.loginRedirect({ scopes: SCOPES, prompt: "select_account" });
  } catch (e) {
    if (!isStuck(e)) throw e;
    purgeStuckInteraction(ids.clientId);
    try { await m.loginRedirect({ scopes: SCOPES, prompt: "select_account" }); }
    catch (e2) {
      if (isStuck(e2)) throw new Error("Sign-in state was stuck from an earlier attempt and has been cleared. Press Connect SharePoint once more.");
      throw e2;
    }
  }
  return null;
}

async function token() {
  const m = app(); await ready;
  const account = tenantAccount(m);
  if (!account) throw new Error("SharePoint is not connected with a Quantum MC tenant account. Press Connect SharePoint and sign in with your account in that tenant (the one that can open the Cx Master in the browser).");
  try {
    const r = await m.acquireTokenSilent({ scopes: SCOPES, account });
    return r.accessToken;
  } catch (e) {
    throw new Error("Your SharePoint session needs a refresh. Press Connect SharePoint to sign in again, then retry the sync.");
  }
}

async function graph(path) {
  const t = await token();
  const res = await fetch("https://graph.microsoft.com/v1.0" + path, { headers: { Authorization: "Bearer " + t } });
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (j && j.error && j.error.message) || "";
    if (res.status === 401 || res.status === 403) throw new Error("Graph refused the read (" + res.status + "). Check that Files.Read.All has the green Granted tick in the app registration and that the signed-in account can open the file in the browser. " + msg);
    if (res.status === 404) throw new Error("The file or worksheet was not found. Check the file URL and the sheet name in the sync settings. " + msg);
    throw new Error("Graph GET " + path.slice(0, 60) + " failed (" + res.status + "). " + msg);
  }
  return j;
}

// Graph shares encoding: u! + base64url of the full URL. Accepts any browser
// URL to the file, including Doc.aspx links, so the config is one pasted URL
// with no folder-path digging, and survives the file being moved in the site.
export function shareId(url) {
  const b = (typeof btoa !== "undefined") ? btoa(unescape(encodeURIComponent(url))) : Buffer.from(url, "utf8").toString("base64");
  return "u!" + b.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
}

// One sessionless ranged read of the whole register. At ~1100 x 39 cells this
// is a single call returning in seconds; no workbook session is created.
export async function readSharePointRegister(fileUrl, sheetName) {
  const sid = shareId(fileUrl);
  // Two-step by necessity: the Excel workload rejects the /shares path for work
  // accounts (400, "no addressUrl for Microsoft.Excel"). The shares call resolves
  // the URL to a concrete driveId + itemId; the workbook read is then addressed
  // through /drives, the only path the workbook API documents and supports.
  const item = await graph("/shares/" + sid + "/driveItem?$select=id,name,lastModifiedDateTime,parentReference");
  const driveId = item && item.parentReference && item.parentReference.driveId;
  if (!driveId || !item.id) throw new Error("The share resolved but returned no drive identity. Check the file URL in Sync Settings points at the workbook itself.");
  const sheet = encodeURIComponent(String(sheetName || "Asset Cx Register").replace(/'/g, "''"));
  const rng = await graph("/drives/" + driveId + "/items/" + item.id + "/workbook/worksheets('" + sheet + "')/usedRange?$select=values");
  return {
    fileName: item && item.name ? item.name : "",
    lastModified: item && item.lastModifiedDateTime ? item.lastModifiedDateTime : "",
    values: (rng && rng.values) || [],
  };
}

// REV143: raw workbook download for pages that parse the whole file client-side.
// Weekly Cx Progress reads several sheets through exceljs, so a single usedRange
// is not enough; it needs the bytes. Same two-step share resolution as the
// register read (the Excel workload rejects /shares for work accounts), then a
// GET of the item content through /drives. Returns an ArrayBuffer the caller
// hands straight to the existing workbook parser, so the parse path is shared
// with a manual upload and never forks.
export async function downloadSharePointFile(fileUrl) {
  const sid = shareId(fileUrl);
  const item = await graph("/shares/" + sid + "/driveItem?$select=id,name,lastModifiedDateTime,parentReference");
  const driveId = item && item.parentReference && item.parentReference.driveId;
  if (!driveId || !item.id) throw new Error("The share resolved but returned no drive identity. Check the file URL points at the workbook itself.");
  const t = await token();
  const res = await fetch("https://graph.microsoft.com/v1.0/drives/" + driveId + "/items/" + item.id + "/content", { headers: { Authorization: "Bearer " + t } });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error("Graph refused the download (" + res.status + "). Check that Files.Read.All has the green Granted tick and that the signed-in account can open the file in the browser.");
    if (res.status === 404) throw new Error("The file was not found. Check the file URL in the sync window.");
    throw new Error("Graph download of the workbook failed (" + res.status + ").");
  }
  const buffer = await res.arrayBuffer();
  return {
    fileName: item && item.name ? item.name : "",
    lastModified: item && item.lastModifiedDateTime ? item.lastModifiedDateTime : "",
    buffer,
  };
}
