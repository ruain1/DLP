// REV85: Microsoft Graph delegated calendar integration for witness invites.
// Public client (SPA, auth code + PKCE). The client and tenant ids below are public
// identifiers, not secrets; there is no client secret in this flow by design.
// Exchange does the messaging: creating an event with attendees sends the invitations,
// PATCHing it sends meeting updates, and the cancel action sends cancellations.
// Events are sent as wall-clock time in the site timezone (Europe/Helsinki), so the
// server owns the DST maths across the October and March clock changes.
import { PublicClientApplication } from "@azure/msal-browser";

const CLIENT_ID = "fa956186-27d4-4fae-b276-6c9fb2454457";
const TENANT_ID = "b095dac5-f2b1-4834-b5dd-d29460f9075c";
const SCOPES = ["Calendars.ReadWrite"];
const SITE_TZ = "Europe/Helsinki";

let msal = null;
let ready = null;
const app = () => {
  if (!msal) {
    msal = new PublicClientApplication({
      auth: { clientId: CLIENT_ID, authority: "https://login.microsoftonline.com/" + TENANT_ID, redirectUri: window.location.origin },
      cache: { cacheLocation: "localStorage" },
    });
    ready = msal.initialize();
  }
  return msal;
};

export async function outlookAccount() {
  const m = app(); await ready;
  const accts = m.getAllAccounts();
  return accts.length ? accts[0] : null;
}

export async function connectOutlook() {
  const m = app(); await ready;
  const res = await m.loginPopup({ scopes: SCOPES, prompt: "select_account" });
  if (res && res.account) m.setActiveAccount(res.account);
  return res.account;
}

export async function disconnectOutlook() {
  const m = app(); await ready;
  try { await m.clearCache(); } catch (e) { /* local sign-out only; a failed cache clear is harmless */ }
}

async function token() {
  const m = app(); await ready;
  const account = m.getActiveAccount() || m.getAllAccounts()[0];
  if (!account) throw new Error("Outlook is not connected.");
  try {
    const r = await m.acquireTokenSilent({ scopes: SCOPES, account });
    return r.accessToken;
  } catch (e) {
    const r = await m.acquireTokenPopup({ scopes: SCOPES, account });
    return r.accessToken;
  }
}

async function graph(path, method, body) {
  const t = await token();
  const res = await fetch("https://graph.microsoft.com/v1.0" + path, {
    method: method || "GET",
    headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 202 || res.status === 204) return null;
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error((j && j.error && j.error.message) || "Graph " + (method || "GET") + " " + path + " failed (" + res.status + ")");
  return j;
}

const two = (n) => String(n).padStart(2, "0");
// Wall-clock stamp, deliberately NOT toISOString: the timezone is carried separately.
const localStamp = (d) => d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate()) + "T" + two(d.getHours()) + ":" + two(d.getMinutes()) + ":00";

// payload: { subject, bodyHtml, location, startLocal (Date), durationMin, required [emails], optional [emails] }
const eventBody = (p) => ({
  subject: p.subject,
  body: { contentType: "HTML", content: p.bodyHtml },
  start: { dateTime: localStamp(p.startLocal), timeZone: SITE_TZ },
  end: { dateTime: localStamp(new Date(p.startLocal.getTime() + p.durationMin * 60000)), timeZone: SITE_TZ },
  location: { displayName: p.location },
  attendees: [
    ...(p.required || []).map((address) => ({ emailAddress: { address }, type: "required" })),
    ...(p.optional || []).map((address) => ({ emailAddress: { address }, type: "optional" })),
  ],
});

// Create the event; Exchange sends the invitations. Returns the Graph event id.
export async function sendWitnessEvent(p) {
  const r = await graph("/me/events", "POST", eventBody(p));
  return r.id;
}

// PATCH the event; Exchange sends meeting updates to the attendees.
export async function updateWitnessEvent(eventId, p) {
  await graph("/me/events/" + encodeURIComponent(eventId), "PATCH", eventBody(p));
}

// Organiser-only cancel action; Exchange sends the cancellation with the comment.
export async function cancelWitnessEvent(eventId, comment) {
  await graph("/me/events/" + encodeURIComponent(eventId) + "/cancel", "POST", { comment: comment || "Cancelled via DLP." });
}
