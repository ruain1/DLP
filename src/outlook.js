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
const SCOPES = ["Calendars.ReadWrite", "Mail.Send"];
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
const eventBody = (p) => {
  const b = {
    subject: p.subject,
    body: { contentType: "HTML", content: p.bodyHtml },
    start: { dateTime: localStamp(p.startLocal), timeZone: SITE_TZ },
    end: { dateTime: localStamp(new Date(p.startLocal.getTime() + p.durationMin * 60000)), timeZone: SITE_TZ },
    location: { displayName: p.location },
    attendees: [
      ...(p.required || []).map((address) => ({ emailAddress: { address }, type: "required" })),
      ...(p.optional || []).map((address) => ({ emailAddress: { address }, type: "optional" })),
    ],
  };
  // Vendor logo as a CID inline attachment, deep-inserted with the creation call so the
  // invitation email attendees receive already carries it. Never sent on PATCH.
  if (p.inlineLogo) b.attachments = [{ "@odata.type": "#microsoft.graph.fileAttachment", name: p.inlineLogo.name || "vendor-logo.png", contentType: p.inlineLogo.contentType || "image/png", contentBytes: p.inlineLogo.contentBytes, contentId: "vendorlogo", isInline: true }];
  return b;
};

// Create the event; Exchange sends the invitations. Returns { id, logo } where logo records
// whether the inline vendor logo made it in. Deep-inserting attachments on event creation is
// not explicitly documented, so on rejection the send retries without the logo (body swapped
// to the logoless variant) rather than failing the invite.
export async function sendWitnessEvent(p) {
  try {
    const r = await graph("/me/events", "POST", eventBody(p));
    return { id: r.id, logo: !!p.inlineLogo };
  } catch (e) {
    if (p.inlineLogo && p.bodyHtmlNoLogo) {
      const r = await graph("/me/events", "POST", eventBody({ ...p, inlineLogo: null, bodyHtml: p.bodyHtmlNoLogo }));
      return { id: r.id, logo: false };
    }
    throw e;
  }
}

// PATCH the event; Exchange sends meeting updates to the attendees. Attachments are never
// PATCHed: the creation-time logo persists on the event and the caller passes a body whose
// cid reference matches whether this event actually carries it.
export async function updateWitnessEvent(eventId, p) {
  const b = eventBody({ ...p, inlineLogo: null });
  delete b.attachments;
  await graph("/me/events/" + encodeURIComponent(eventId), "PATCH", b);
}

// Organiser-only cancel action; Exchange sends the cancellation with the comment.
export async function cancelWitnessEvent(eventId, comment) {
  await graph("/me/events/" + encodeURIComponent(eventId) + "/cancel", "POST", { comment: comment || "Cancelled via DLP." });
}

// UTF-8 safe base64 for attachment contentBytes (btoa alone corrupts non-Latin1 text).
export const b64utf8 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin);
};

// Send an email from the signed-in account (delegated Mail.Send). Single-request sendMail:
// the whole message is one JSON body with a 4 MB ceiling, so keep attachments under ~3 MB
// of binary (base64 inflates by a third). Callers guard the size before attaching.
export async function sendMailMessage({ subject, html, to, cc, attachment }) {
  const message = {
    subject,
    body: { contentType: "HTML", content: html },
    toRecipients: (to || []).map((r) => ({ emailAddress: { address: r.email, name: r.name || r.email } })),
  };
  if (cc && cc.length) message.ccRecipients = cc.map((r) => ({ emailAddress: { address: r.email, name: r.name || r.email } }));
  if (attachment) message.attachments = [{ "@odata.type": "#microsoft.graph.fileAttachment", name: attachment.name, contentType: attachment.contentType || "text/html", contentBytes: attachment.contentBytes }];
  await graph("/me/sendMail", "POST", { message, saveToSentItems: true });
}

// ---- REV87: shared email-safe templates (approved mockup) ----
// Rules of the cage: classic Outlook renders with the Word engine, so layout is nested tables
// with inline styles, padding lives on table cells, widths are attributes, and nothing here
// depends on flexbox, grid, border-radius or background images.
const TPL = { blue: "#2456A6", blueSoft: "#EEF3FB", blueInk: "#1f3a6e", ink: "#1f2937", mut: "#6b7280", faint: "#9ca3af", line: "#e5e7eb", amberBg: "#FBF3DC", amberEdge: "#E0A106", amberInk: "#7a5b00" };
const FSTACK = "font-family:Segoe UI,Arial,sans-serif;";
const eH = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dRow = (label, valueHtml) => valueHtml ? `<tr><td width="130" style="padding:5px 10px 5px 0;color:${TPL.mut};font-size:11px;text-transform:uppercase;letter-spacing:0.4px;vertical-align:top;${FSTACK}">${eH(label)}</td><td style="padding:5px 0;font-size:13px;color:${TPL.ink};${FSTACK}">${valueHtml}</td></tr>` : "";

// p: { title, code, location, companyName, cxStage, system, discipline, sessionsLine, openCount, notes, dayLabel, organiser, logo: { width, alt } | null }
export function buildInviteBodyHtml(p) {
  const vendor = p.logo
    ? `<img src="cid:vendorlogo" width="${p.logo.width}" height="24" alt="${eH(p.logo.alt || p.companyName)}" style="display:block;border:0;height:24px;" /><span style="padding-left:10px;font-weight:bold;font-size:13px;color:${TPL.ink};${FSTACK}">${eH(p.companyName)}</span>`
    : `<span style="font-weight:bold;font-size:13px;color:${TPL.ink};${FSTACK}">${eH(p.companyName)}</span>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="border-collapse:collapse;background-color:#ffffff;border:1px solid #d8dee9;${FSTACK}">`
    + `<tr><td style="padding:0;background-color:${TPL.blue};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>`
    + `<td style="padding:12px 18px;font-size:15px;font-weight:bold;color:#ffffff;${FSTACK}">FIN04 Witness Invitation</td>`
    + (p.dayLabel ? `<td align="right" style="padding:12px 18px;font-size:11px;color:#cfe0f7;${FSTACK}">${eH(p.dayLabel)}</td>` : "")
    + `</tr></table></td></tr>`
    + `<tr><td style="padding:12px 18px 0 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td style="padding:2px 0;vertical-align:middle;font-size:10px;color:${TPL.mut};text-transform:uppercase;letter-spacing:0.4px;${FSTACK}">Responsible Vendor&nbsp;&nbsp;</td>`
    + `<td style="padding:2px 0;vertical-align:middle;">${vendor}</td></tr></table></td></tr>`
    + `<tr><td style="padding:10px 18px 6px 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">`
    + dRow("Activity", `<span style="font-weight:bold;">${eH(p.title)}${p.code != null && p.code !== "" ? " (#" + eH(p.code) + ")" : ""}</span>`)
    + dRow("Location", eH(p.location))
    + dRow("Cx Stage", eH(p.cxStage))
    + dRow("System", eH(p.system))
    + dRow("Discipline", eH(p.discipline))
    + dRow("Sessions", eH(p.sessionsLine))
    + `</table></td></tr>`
    + (p.openCount > 0 ? `<tr><td style="padding:4px 18px 12px 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td style="border-left:3px solid ${TPL.amberEdge};background-color:${TPL.amberBg};padding:8px 12px;font-size:12px;color:${TPL.amberInk};${FSTACK}">${p.openCount} open constraint${p.openCount === 1 ? "" : "s"} remain${p.openCount === 1 ? "s" : ""} on this activity. They are expected clear before the session; contact the organiser otherwise.</td></tr></table></td></tr>` : "")
    + (p.notes ? `<tr><td style="padding:0 18px 12px 18px;font-size:12px;color:#374151;line-height:1.5;${FSTACK}">${eH(p.notes)}</td></tr>` : "")
    + `<tr><td style="padding:10px 18px;border-top:1px solid ${TPL.line};font-size:10.5px;color:${TPL.faint};${FSTACK}">Issued from DLP by ${eH(p.organiser || "")} &#183; CSN Commissioning &#183; replies and responses go to the organiser</td></tr>`
    + `</table>`;
}

// p: { periodLabel, by, summary, tiles: [{ v, l, color }], tooBig }
export function buildReportEmailHtml(p) {
  const paras = String(p.summary || "").trim().split(/\n{2,}/).filter(Boolean)
    .map((x) => `<p style="margin:0 0 10px;line-height:1.6;font-size:13.5px;color:${TPL.ink};${FSTACK}">${eH(x).replace(/\n/g, "<br/>")}</p>`).join("")
    || `<p style="margin:0 0 10px;font-size:13.5px;color:${TPL.ink};${FSTACK}">Weekly DLP report for the period.</p>`;
  const w = p.tiles && p.tiles.length ? Math.floor(100 / p.tiles.length) : 0;
  const strip = p.tiles && p.tiles.length
    ? `<tr><td style="padding:16px 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr>`
      + p.tiles.map((t) => `<td width="${w}%" align="center" style="padding:10px 6px;border:1px solid ${TPL.line};"><span style="font-size:20px;font-weight:bold;color:${t.color || TPL.ink};${FSTACK}">${eH(t.v)}</span><br><span style="font-size:10px;color:${TPL.mut};text-transform:uppercase;letter-spacing:0.4px;${FSTACK}">${eH(t.l)}</span></td>`).join("")
      + `</tr></table></td></tr>`
    : "";
  const note = p.tooBig
    ? "The full report exceeded the email attachment limit; open DLP for the complete sections and charts."
    : "The full report is attached as an HTML file. Open it in any browser for the complete sections, breakdowns and the schedule snapshot.";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="border-collapse:collapse;background-color:#ffffff;border:1px solid #d8dee9;${FSTACK}">`
    + `<tr><td style="padding:0;background-color:${TPL.blue};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>`
    + `<td style="padding:14px 20px;font-size:17px;font-weight:bold;color:#ffffff;${FSTACK}">FIN04 Weekly DLP Report</td>`
    + `<td align="right" style="padding:14px 20px;font-size:11.5px;color:#cfe0f7;${FSTACK}">${eH(p.periodLabel)}</td>`
    + `</tr></table></td></tr>`
    + strip
    + `<tr><td style="padding:14px 20px 4px 20px;"><span style="font-size:11px;font-weight:bold;color:${TPL.blue};text-transform:uppercase;letter-spacing:0.5px;${FSTACK}">Executive Summary</span><br>${paras}</td></tr>`
    + `<tr><td style="padding:14px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="border-left:3px solid ${TPL.blue};background-color:${TPL.blueSoft};padding:9px 14px;font-size:12px;color:${TPL.blueInk};${FSTACK}">${note}</td></tr></table></td></tr>`
    + `<tr><td style="padding:10px 20px;border-top:1px solid ${TPL.line};font-size:10.5px;color:${TPL.faint};${FSTACK}">Generated from DLP by ${eH(p.by || "")} &#183; FIN04 &#183; atnorth Koski &#183; CSN Commissioning</td></tr>`
    + `</table>`;
}
