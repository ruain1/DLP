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
let pendingHash;   // auth response hash captured synchronously by the app before boot rewrote the URL
let lastAuthDiag = null;   // { at, ok, hadHash, account | code, message } from the last redirect-return processing
export function primeRedirectHash(h) { if (!msal) pendingHash = h || undefined; }
export async function authDiagnostics() { app(); await ready; return lastAuthDiag; }
const app = () => {
  if (!msal) {
    msal = new PublicClientApplication({
      // navigateToLoginRequestUrl false: the app restores its own state from ?p=, so after the
      // redirect return we stay put instead of MSAL bouncing the page a second time.
      auth: { clientId: CLIENT_ID, authority: "https://login.microsoftonline.com/" + TENANT_ID, redirectUri: window.location.origin, navigateToLoginRequestUrl: false },
      cache: { cacheLocation: "localStorage" },
    });
    // initialize, then absorb a redirect return. The hash is passed in explicitly (primeRedirectHash)
    // because the app's boot rewrites the URL with history.replaceState("?p=...") before this lazy
    // chunk can read location.hash, which silently destroyed redirect sign-ins.
    ready = msal.initialize()
      .then(() => {
        const hadHash = !!pendingHash;
        // v5 contract: handleRedirectPromise takes an options OBJECT ({ hash }), not a bare hash
        // string. The bare-string call of the v2/v3 era is silently ignored by 5.x, which is
        // exactly how the REV89 captured-hash fix failed: MSAL fell back to the live URL hash,
        // already wiped by the app's boot rewrite, and resolved null without an error.
        return msal.handleRedirectPromise(pendingHash ? { hash: pendingHash } : undefined)
          .then((res) => {
            lastAuthDiag = { at: new Date().toISOString(), ok: true, hadHash, account: res && res.account ? res.account.username : null };
            if (res && res.account) msal.setActiveAccount(res.account);
          })
          .catch((e) => {
            lastAuthDiag = { at: new Date().toISOString(), ok: false, hadHash, code: (e && (e.errorCode || e.code)) || "", message: (e && e.message) || String(e) };
            try { console.error("[DLP outlook] redirect return failed:", e); } catch (x) { }
          });
      })
      .then(() => { pendingHash = undefined; return null; })
      .catch(() => { pendingHash = undefined; return null; });
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
  // Redirect-first by design (REV90). The popup path in this deployment collided with three
  // separate failure modes: popup blockers and enterprise policy (popup_window_error), the
  // opener's popup monitoring being timer-throttled in a background tab while the app booting
  // inside the popup stripped the response hash, and a reported msal-browser 5.x regression
  // where the popup redirects to the app instead of closing. The full-page redirect is immune
  // to all three; its return is absorbed by the captured-hash path (primeRedirectHash).
  // REV122: same stale interaction_in_progress recovery as sharepoint.js. An
  // abandoned redirect leaves the flag set for this tab; no genuine interaction
  // can be running at click time, so purge once and retry.
  try {
    await m.loginRedirect({ scopes: SCOPES, prompt: "select_account" });
  } catch (e) {
    const stuck = !!e && ((e.errorCode === "interaction_in_progress") || String(e.message || e).indexOf("interaction_in_progress") !== -1);
    if (!stuck) throw e;
    try {
      const needle = "interaction.status";
      [window.sessionStorage, window.localStorage].forEach((store) => {
        const kill = [];
        for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.indexOf(needle) !== -1 && k.indexOf(CLIENT_ID) !== -1) kill.push(k); }
        if (!kill.length) for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k && k.indexOf("msal") !== -1 && k.indexOf(needle) !== -1) kill.push(k); }
        kill.forEach((k) => { try { store.removeItem(k); } catch (x) {} });
      });
    } catch (x) {}
    try { await m.loginRedirect({ scopes: SCOPES, prompt: "select_account" }); }
    catch (e2) {
      const stuck2 = !!e2 && ((e2.errorCode === "interaction_in_progress") || String(e2.message || e2).indexOf("interaction_in_progress") !== -1);
      if (stuck2) throw new Error("Sign-in state was stuck from an earlier attempt and has been cleared. Press Connect Outlook once more.");
      throw e2;
    }
  }
  return null;   // navigation is in flight; callers do nothing
}

async function token() {
  const m = app(); await ready;
  const account = m.getActiveAccount() || m.getAllAccounts()[0];
  if (!account) throw new Error("Outlook is not connected.");
  try {
    const r = await m.acquireTokenSilent({ scopes: SCOPES, account });
    return r.accessToken;
  } catch (e) {
    // Silent-only by design: no interactive popups anywhere, and deliberately no redirect here
    // because a full-page navigation mid-send would abandon partially-sent state and risk
    // duplicate invites on retry.
    throw new Error("Your Microsoft session needs a refresh. Press Connect Outlook to sign in again (a quick full-page redirect), then retry this action.");
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
  return b;
};

// Create the event; Exchange sends the invitations. Returns { id, logo } where logo records
// whether the inline vendor logo made it in. Deep-inserting attachments on event creation is
// not explicitly documented, so on rejection the send retries without the logo (body swapped
// to the logoless variant) rather than failing the invite.
export async function sendWitnessEvent(p) {
  if (!p.inlineLogo) {
    const r = await graph("/me/events", "POST", eventBody(p));
    return { id: r.id, logo: false };
  }
  // Step 1: create silently. With no attendees on the event, Exchange sends nothing yet.
  const created = await graph("/me/events", "POST", eventBody({ ...p, required: [], optional: [] }));
  const id = created.id;
  // Step 2: attach the logo through the supported endpoint and believe only the response.
  let logoOk = false;
  try {
    await graph("/me/events/" + encodeURIComponent(id) + "/attachments", "POST", {
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: p.inlineLogo.name || "vendor-logo.png",
      contentType: p.inlineLogo.contentType || "image/png",
      contentBytes: p.inlineLogo.contentBytes,
      contentId: "vendorlogo",
      isInline: true,
    });
    logoOk = true;
  } catch (e) {
    if (p.bodyHtmlNoLogo) {
      try { await graph("/me/events/" + encodeURIComponent(id), "PATCH", { body: { contentType: "HTML", content: p.bodyHtmlNoLogo } }); } catch (e2) { /* body downgrade best-effort; worst case is the old broken image, not a lost invite */ }
    }
  }
  // Step 3: inviting the attendees is what sends the meeting requests, logo aboard.
  try {
    await graph("/me/events/" + encodeURIComponent(id), "PATCH", { attendees: [
      ...(p.required || []).map((address) => ({ emailAddress: { address }, type: "required" })),
      ...(p.optional || []).map((address) => ({ emailAddress: { address }, type: "optional" })),
    ] });
  } catch (e) {
    try { await graph("/me/events/" + encodeURIComponent(id), "DELETE"); } catch (e2) { /* orphan cleanup best-effort */ }
    throw e;
  }
  return { id, logo: logoOk };
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
// Recipients arrive as plain address strings or as { email, name } objects; both are valid.
// Entries without a resolvable address are dropped rather than serialised addressless, which
// Graph rejects with an opaque 400 (the REV98 root cause).
export const mailRecipients = (list) => (list || []).map((r) => {
  const o = typeof r === "string" ? { email: r } : (r || {});
  return { emailAddress: { address: o.email || "", name: o.name || o.email || "" } };
}).filter((x) => x.emailAddress.address && x.emailAddress.address.includes("@"));

export async function sendMailMessage({ subject, html, to, cc, attachment, attachments }) {
  const message = {
    subject,
    body: { contentType: "HTML", content: html },
    toRecipients: mailRecipients(to),
  };
  if (!message.toRecipients.length) throw new Error("No valid recipient addresses.");
  const ccR = mailRecipients(cc);
  if (ccR.length) message.ccRecipients = ccR;
  const atts = attachments || (attachment ? [attachment] : []);
  if (atts.length) message.attachments = atts.map((x) => { const a = { "@odata.type": "#microsoft.graph.fileAttachment", name: x.name, contentType: x.contentType || "text/html", contentBytes: x.contentBytes }; if (x.contentId) { a.contentId = x.contentId; a.isInline = true; } return a; });
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

// p: { title, code, inviteType, location, companyName, cxStage, system, discipline, sessionsLine,
//      openConstraints: [{ text, owner, due, overdue }] (pre-sorted: overdue first, soonest need-by next, undated last),
//      openCount (fallback only, count-only banner when openConstraints is absent),
//      activityUrl (link back to the activity in DLP; omitted when absent),
//      fokRef (external FOK register id, shown as its own row; omitted when absent),
//      accUrl (Autodesk ACC field report link, rendered as a LINK TO ACC FILES button; omitted when absent),
//      assigneeEmail (column H assignee; shown as an Assignee row and added to required attendees; omitted when absent),
//      notes, dayLabel, organiser, logo: { width, alt } | null }
// REV119: the amber block itemises the open constraints (approved mockup) instead of a bare
// count. Rows arrive pre-sorted from the caller (overdue first, soonest need-by next, undated
// last); the cap lives here so every caller gets identical behaviour. A need-by on or before
// the session date renders red with an OVERDUE tag. Falls back to the old count-only sentence
// if only openCount is supplied, so a stale caller cannot break the send.
const INVITE_CON_CAP = 6;
const RED = "#B4231B";
function constraintsBlock(p) {
  const cons = Array.isArray(p.openConstraints) ? p.openConstraints : null;
  const openWrap = (inner) => `<tr><td style="padding:4px 18px 12px 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td style="border-left:3px solid ${TPL.amberEdge};background-color:${TPL.amberBg};padding:9px 12px 10px 12px;">${inner}</td></tr></table></td></tr>`;
  if (!cons) {
    if (!(p.openCount > 0)) return "";
    return openWrap(`<span style="font-size:12px;color:${TPL.amberInk};${FSTACK}">${p.openCount} open constraint${p.openCount === 1 ? "" : "s"} remain${p.openCount === 1 ? "s" : ""} on this activity. They are expected clear before the session; contact the organiser otherwise.</span>`);
  }
  if (!cons.length) return "";
  const shown = cons.slice(0, INVITE_CON_CAP);
  const extra = cons.length - shown.length;
  const head = `<tr><td colspan="2" style="padding:0 0 6px 0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.4px;color:${TPL.amberInk};${FSTACK}">${cons.length} Open Constraint${cons.length === 1 ? "" : "s"} On This Activity</td></tr>`;
  const rows = shown.map((c) => {
    const meta = [];
    if (c.owner) meta.push(eH(c.owner));
    if (c.due) meta.push(c.overdue ? `<span style="color:${RED};font-weight:bold;">need-by ${eH(c.due)} &#183; OVERDUE</span>` : `need-by ${eH(c.due)}`);
    return `<tr><td width="14" style="padding:3px 6px 3px 0;font-size:12px;color:${c.overdue ? RED : TPL.amberEdge};vertical-align:top;line-height:1.5;">&#9679;</td>`
      + `<td style="padding:3px 0;font-size:12.5px;color:${TPL.ink};line-height:1.5;${FSTACK}">${eH(c.text)}${meta.length ? `<span style="color:${TPL.mut};font-size:11.5px;"> &#183; ${meta.join(" &#183; ")}</span>` : ""}</td></tr>`;
  }).join("");
  const more = extra > 0 ? `<tr><td></td><td style="padding:4px 0 0 0;font-size:11.5px;color:${TPL.mut};${FSTACK}">+ ${extra} more, full list in DLP</td></tr>` : "";
  const foot = `<tr><td colspan="2" style="padding:7px 0 0 0;font-size:11.5px;color:${TPL.amberInk};${FSTACK}">These are expected clear before the session; contact the organiser otherwise.</td></tr>`;
  return openWrap(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${head}${rows}${more}${foot}</table>`);
}

export function buildInviteBodyHtml(p) {
  const vendor = p.logo
    ? `<img src="cid:vendorlogo" width="${p.logo.width}" height="24" alt="${eH(p.logo.alt || p.companyName)}" style="display:block;border:0;height:24px;" /><span style="padding-left:10px;font-weight:bold;font-size:13px;color:${TPL.ink};${FSTACK}">${eH(p.companyName)}</span>`
    : `<span style="font-weight:bold;font-size:13px;color:${TPL.ink};${FSTACK}">${eH(p.companyName)}</span>`;
  const chip = p.headerChip || p.dayLabel || "";
  // Retest invitations declare their history: a red block above the vendor row states what
  // failed, when, and the recorded reason. Red sits above amber (constraints): history first.
  const retestBlock = p.retest
    ? `<tr><td style="padding:12px 18px 0 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td style="border-left:3px solid #C0392B;background-color:#FBECEA;padding:9px 12px;font-size:12px;color:#7f2b20;${FSTACK}">Retest. The witness${p.retest.failedDate ? " on " + eH(p.retest.failedDate) : ""} did not pass${p.retest.reason ? "; reason recorded: " + eH(p.retest.reason) : ""}. This session replaces that attempt.</td></tr></table></td></tr>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="border-collapse:collapse;background-color:#ffffff;border:1px solid #d8dee9;${FSTACK}">`
    + `<tr><td style="padding:0;background-color:${TPL.blue};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>`
    + `<td style="padding:12px 18px;font-size:15px;font-weight:bold;color:#ffffff;${FSTACK}">FIN04 Witness Invitation</td>`
    + (chip ? `<td align="right" style="padding:12px 18px;font-size:11px;color:#cfe0f7;${FSTACK}">${eH(chip)}</td>` : "")
    + `</tr></table></td></tr>`
    + retestBlock
    + `<tr><td style="padding:12px 18px 0 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
    + `<td style="padding:2px 0;vertical-align:middle;font-size:10px;color:${TPL.mut};text-transform:uppercase;letter-spacing:0.4px;${FSTACK}">Responsible Vendor&nbsp;&nbsp;</td>`
    + `<td style="padding:2px 0;vertical-align:middle;">${vendor}</td></tr></table></td></tr>`
    + `<tr><td style="padding:10px 18px 6px 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">`
    + dRow("Activity", `<span style="font-weight:bold;">${eH(p.title)}${p.code != null && p.code !== "" ? " (#" + eH(p.code) + ")" : ""}</span>`)
    + dRow("FOK Register ID", p.fokRef ? eH(p.fokRef) : "")
    + dRow("Invite Type", eH(p.inviteType))
    + dRow("Location", eH(p.location))
    + dRow("Cx Stage", eH(p.cxStage))
    + dRow("System", eH(p.system))
    + dRow("Discipline", eH(p.discipline))
    + dRow("Assignee", p.assigneeEmail ? eH(p.assigneeEmail) : "")
    + dRow("Sessions", eH(p.sessionsLine))
    + `</table></td></tr>`
    + constraintsBlock(p)
    + (p.notes ? `<tr><td style="padding:0 18px 12px 18px;font-size:12px;color:#374151;line-height:1.5;${FSTACK}">${eH(p.notes)}</td></tr>` : "")
    + (p.accUrl ? `<tr><td style="padding:2px 18px 4px 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${TPL.blue};padding:9px 22px;"><a href="${eH(p.accUrl)}" target="_blank" style="font-size:12.5px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block;${FSTACK}">LINK TO ACC FILES</a></td></tr></table></td></tr>` : "")
    + (p.activityUrl ? `<tr><td style="padding:2px 18px 14px 18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${TPL.blue};padding:9px 22px;"><a href="${eH(p.activityUrl)}" target="_blank" style="font-size:12.5px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block;${FSTACK}">Open This Activity In DLP</a></td></tr></table></td></tr>` : "")
    + `<tr><td style="padding:10px 18px;border-top:1px solid ${TPL.line};font-size:10.5px;color:${TPL.faint};${FSTACK}">Issued from DLP by ${eH(p.organiser || "")} &#183; CSN Commissioning &#183; replies and responses go to the organiser</td></tr>`
    + `</table>`;
}

// Approved Option A (REV92). p: { periodLabel, by, summary, tiles: [{v,l,color}],
// attached: { mode: "both" | "light" | "none", light: filename, dark: filename } }
export function buildReportEmailHtml(p) {
  const paras = String(p.summary || "").trim().split(/\n{2,}/).filter(Boolean)
    .map((x) => `<p style="margin:6px 0 10px;line-height:1.6;font-size:13.5px;color:${TPL.ink};${FSTACK}">${eH(x).replace(/\n/g, "<br/>")}</p>`).join("")
    || `<p style="margin:6px 0 10px;font-size:13.5px;color:${TPL.ink};${FSTACK}">Weekly DLP report for the period.</p>`;
  const tile = (t) => `<td width="25%" align="center" style="padding:10px 6px 8px 6px;border-top:3px solid ${t.color || TPL.blue};background-color:#F8FAFD;"><span style="font-size:22px;font-weight:bold;color:${t.color === "#111827" || !t.color ? TPL.ink : t.color};${FSTACK}">${eH(t.v)}</span><br><span style="font-size:10px;color:${TPL.mut};text-transform:uppercase;letter-spacing:0.5px;${FSTACK}">${eH(t.l)}</span></td>`;
  const gap = `<td width="8" style="font-size:0;line-height:0;">&nbsp;</td>`;
  const strip = p.tiles && p.tiles.length
    ? `<tr><td style="padding:16px 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr>` + p.tiles.map(tile).join(gap) + `</tr></table></td></tr>`
    : "";
  const a = p.attached || { mode: "none" };
  const fileRow = (dot, name, note) => `<tr><td width="16" style="padding:4px 8px 4px 0;font-size:13px;color:${dot};font-weight:bold;">&#9679;</td><td style="padding:4px 0;font-size:12.5px;color:${TPL.ink};${FSTACK}">${eH(name)} <span style="color:${TPL.mut};">&#183; ${eH(note)}</span></td></tr>`;
  let attachedBlock;
  if (a.mode === "both") {
    attachedBlock = `<tr><td style="padding:6px 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">`
      + `<tr><td colspan="2" style="padding:0 0 6px 0;font-size:11px;font-weight:bold;color:${TPL.blue};text-transform:uppercase;letter-spacing:0.6px;${FSTACK}">Attached</td></tr>`
      + fileRow(TPL.blue, a.light, "for printing and bright rooms")
      + fileRow("#0d1422", a.dark, "for screens")
      + `<tr><td colspan="2" style="padding:4px 0 0 0;font-size:11.5px;color:${TPL.mut};${FSTACK}">Open either in any browser for the complete sections, breakdowns and schedule snapshot.</td></tr>`
      + `</table></td></tr>`;
  } else if (a.mode === "light") {
    attachedBlock = `<tr><td style="padding:6px 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">`
      + `<tr><td colspan="2" style="padding:0 0 6px 0;font-size:11px;font-weight:bold;color:${TPL.blue};text-transform:uppercase;letter-spacing:0.6px;${FSTACK}">Attached</td></tr>`
      + fileRow(TPL.blue, a.light, "opens in any browser")
      + `<tr><td colspan="2" style="padding:4px 0 0 0;font-size:11.5px;color:${TPL.mut};${FSTACK}">The dark version exceeded the email size limit and was left off this send.</td></tr>`
      + `</table></td></tr>`;
  } else {
    attachedBlock = `<tr><td style="padding:6px 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td style="border-left:3px solid ${TPL.blue};background-color:${TPL.blueSoft};padding:9px 14px;font-size:12px;color:${TPL.blueInk};${FSTACK}">The full report exceeded the email attachment limit; open DLP for the complete sections and charts.</td></tr></table></td></tr>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="border-collapse:collapse;background-color:#ffffff;border:1px solid #d8dee9;${FSTACK}">`
    + `<tr><td style="padding:0;background-color:${TPL.blue};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">`
    + `<tr><td style="padding:14px 20px 2px 20px;font-size:17px;font-weight:bold;color:#ffffff;${FSTACK}">FIN04 Weekly DLP Report</td></tr>`
    + `<tr><td style="padding:0 20px 12px 20px;font-size:11.5px;color:#cfe0f7;${FSTACK}">${eH(p.periodLabel)} &#183; generated by ${eH(p.by || "")}</td></tr>`
    + `</table></td></tr>`
    + strip
    + `<tr><td style="padding:16px 20px 4px 20px;"><span style="font-size:11px;font-weight:bold;color:${TPL.blue};text-transform:uppercase;letter-spacing:0.6px;${FSTACK}">Executive Summary</span>${paras}</td></tr>`
    + attachedBlock
    + `<tr><td style="padding:14px 20px 16px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${TPL.blue};padding:9px 22px;font-size:12.5px;font-weight:bold;${FSTACK}"><a href="https://dlp-pi.vercel.app" style="color:#ffffff;text-decoration:none;">Open DLP</a></td></tr></table></td></tr>`
    + `<tr><td style="padding:10px 20px;border-top:1px solid ${TPL.line};font-size:10.5px;color:${TPL.faint};${FSTACK}">FIN04 &#183; atnorth Koski &#183; CSN Commissioning</td></tr>`
    + `</table>`;
}

// ---- REV89: classic Outlook draft (.eml with X-Unsent: 1) ----
// A downloaded .eml carrying X-Unsent: 1 opens in classic Outlook as an editable draft with the
// attachment in place; the user reviews and presses Send from their own mailbox. Pure client-side:
// no Graph call, no sign-in. CRLF line endings per RFC 5322. Known limit: new Outlook handles
// this unreliably (may drop the attachment); classic is the target, which is where the macro
// already lives.
const wrap76 = (b64) => b64.replace(/(.{76})/g, "$1\r\n");
const hdrWord = (s) => (/[^\x20-\x7e]/.test(s) ? "=?utf-8?B?" + b64utf8(s) + "?=" : s);
export function buildReportEml({ subject, to, bodyHtml, attachment, attachments }) {
  const atts = attachments || (attachment ? [attachment] : []);
  const boundary = "----=_DLP_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const addr = (r) => {
    const n = (r.name || "").trim();
    return n && /^[\x20-\x7e]+$/.test(n) && !/[,<>\"]/.test(n) ? n + " <" + r.email + ">" : r.email;
  };
  const toHdr = (to || []).filter((r) => r && r.email).map(addr).join(", ");
  const lines = [
    "X-Unsent: 1",
    toHdr ? "To: " + toHdr : null,
    "Subject: " + hdrWord(subject),
    "MIME-Version: 1.0",
    'Content-Type: multipart/mixed; boundary="' + boundary + '"',
    "",
    "--" + boundary,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64utf8(bodyHtml)),
    ...atts.flatMap((x) => [
      "--" + boundary,
      'Content-Type: text/html; charset="utf-8"; name="' + x.name + '"',
      'Content-Disposition: attachment; filename="' + x.name + '"',
      "Content-Transfer-Encoding: base64",
      "",
      wrap76(b64utf8(x.html)),
    ]),
    "--" + boundary + "--",
    "",
  ].filter((l) => l !== null);
  return lines.join("\r\n");
}

// ---- REV93: user invitation email, approved Option A2 (guided steps) ----
// p: { mode: "invite" | "link", email, roleLabel?, companyName?, link, sentByName, validityDays }
export function buildUserInviteEmailHtml(p) {
  const days = p.validityDays || 30;
  const stepCell = (n) => `<td width="26" valign="top" style="padding:7px 10px 7px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" width="22" style="background-color:${TPL.blue};color:#ffffff;font-size:12px;font-weight:bold;padding:3px 0;${FSTACK}">${n}</td></tr></table></td>`;
  const stepRow = (n, text) => `<tr>${stepCell(n)}<td style="padding:7px 0;font-size:13px;color:${TPL.ink};${FSTACK}">${text}</td></tr>`;
  const who = `<b>${eH(p.email)}</b>`;
  const extras = (p.roleLabel ? ` as a <b>${eH(p.roleLabel)}</b>` : "") + (p.companyName ? ` for <b>${eH(p.companyName)}</b>` : "");
  const intro = p.mode === "link"
    ? `${eH(p.sentByName)} (CSN Commissioning) has issued a fresh sign-in link for ${who}. Getting in takes a minute:`
    : `${eH(p.sentByName)} (CSN Commissioning) has invited ${who} to FIN04${extras}. Getting in takes a minute:`;
  const btnLabel = p.mode === "link" ? "Set Your Password" : "Set Up Your Account";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="border-collapse:collapse;background-color:#ffffff;border:1px solid #d8dee9;${FSTACK}">`
    + `<tr><td style="padding:0;background-color:${TPL.blue};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">`
    + `<tr><td style="padding:14px 20px 2px 20px;font-size:17px;font-weight:bold;color:#ffffff;${FSTACK}">FIN04 DLP</td></tr>`
    + `<tr><td style="padding:0 20px 12px 20px;font-size:11.5px;color:#cfe0f7;${FSTACK}">Commissioning planning workspace &#183; atnorth Koski</td></tr>`
    + `</table></td></tr>`
    + `<tr><td style="padding:16px 20px 2px 20px;"><span style="font-size:15px;font-weight:bold;color:#111827;${FSTACK}">${p.mode === "link" ? "Your sign-in link" : "You have been invited"}</span>`
    + `<p style="margin:8px 0 6px;line-height:1.6;font-size:13.5px;color:${TPL.ink};${FSTACK}">${intro}</p></td></tr>`
    + `<tr><td style="padding:4px 20px 6px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">`
    + stepRow(1, "Press the button below and choose your password.")
    + stepRow(2, "You are signed straight in and land on the FIN04 Planning Board.")
    + stepRow(3, `Afterwards, sign in any time at <span style="font-family:Consolas,ui-monospace,monospace;font-size:12px;color:${TPL.blueInk};">dlp-pi.vercel.app</span> with this email address.`)
    + `</table></td></tr>`
    + `<tr><td style="padding:10px 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${TPL.blue};padding:10px 26px;font-size:13px;font-weight:bold;${FSTACK}"><a href="${eH(p.link)}" style="color:#ffffff;text-decoration:none;">${btnLabel}</a></td></tr></table></td></tr>`
    + `<tr><td style="padding:8px 20px 12px 20px;font-size:11.5px;color:${TPL.mut};line-height:1.6;${FSTACK}">If the button does not work, open this link:<br><span style="font-family:Consolas,ui-monospace,monospace;font-size:11px;color:${TPL.blueInk};">${eH(p.link)}</span></td></tr>`
    + `<tr><td style="padding:0 20px 14px 20px;font-size:11.5px;color:${TPL.faint};line-height:1.6;${FSTACK}">This link is valid for ${days} days and is personal to you. If it has expired, reply to this email and a fresh one will be issued. If you were not expecting this invitation, you can ignore this email.</td></tr>`
    + `<tr><td style="padding:10px 20px;border-top:1px solid ${TPL.line};font-size:10.5px;color:${TPL.faint};${FSTACK}">Sent by ${eH(p.sentByName)} &#183; FIN04 &#183; atnorth Koski &#183; CSN Commissioning</td></tr>`
    + `</table>`;
}

// REV132: RFFE cover-note email in the house style (matches buildInviteBodyHtml).
// p: { assets:[{name,tag}], organiser, appUrl }. appUrl deep-links into DLP; the
// caller derives it from window.location.origin, so no origin is hardcoded here.
export function buildRffeEmailHtml(p) {
  const a = p.assets || [];
  if (!a.length) return "";
  const multi = a.length > 1;
  const P = (html, padTop) => `<tr><td style="padding:${padTop || "2px"} 20px 0 20px;font-size:13.5px;line-height:1.6;color:${TPL.ink};${FSTACK}">${html}</td></tr>`;
  const bAsset = (x) => `<b style="color:${TPL.ink};">${eH(x.tag)}</b> <span style="color:${TPL.mut};font-size:12px;">(${eH(x.name)})</span>`;
  let assetBlock;
  if (multi) {
    const rows = a.map((x) => `<tr><td width="14" style="padding:3px 8px 3px 0;font-size:12px;color:${TPL.amberEdge};vertical-align:top;line-height:1.6;">&#9679;</td><td style="padding:3px 0;font-size:13px;color:${TPL.ink};line-height:1.6;${FSTACK}">${bAsset(x)}</td></tr>`).join("");
    assetBlock = P("See attached RFFE for the following assets:") + `<tr><td style="padding:9px 20px 2px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table></td></tr>`;
  } else {
    assetBlock = P(`See attached RFFE for ${bAsset(a[0])}.`);
  }
  const eeTarget = multi ? "each asset listed above" : `<b>${eH(a[0].tag)}</b>`;
  const linkRow = p.appUrl
    ? `<tr><td style="padding:14px 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${TPL.blue};padding:9px 22px;"><a href="${eH(p.appUrl)}" target="_blank" style="font-size:12.5px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block;${FSTACK}">Open ${multi ? "These Assets" : "This Asset"} In DLP</a></td></tr></table></td></tr>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="border-collapse:collapse;background-color:#ffffff;border:1px solid #d8dee9;${FSTACK}">`
    + `<tr><td style="padding:0;background-color:${TPL.blue};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:12px 18px;font-size:15px;font-weight:bold;color:#ffffff;${FSTACK}">FIN04 Request For Energisation</td><td align="right" style="padding:12px 18px;font-size:11px;color:#cfe0f7;${FSTACK}">Yellow Tag approved</td></tr></table></td></tr>`
    + P("Hi all,", "14px")
    + assetBlock
    + P(`${multi ? "These assets have" : "This asset has"} now been approved for Yellow Tag by the Cx team.`, "11px")
    + P(`Please proceed to energise. Once energised, please mark the <b>EE</b> column for ${eeTarget} as complete.`, "10px")
    + linkRow
    + `<tr><td style="padding:15px 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td style="border-left:3px solid ${TPL.amberEdge};background-color:${TPL.amberBg};padding:9px 12px;font-size:12px;color:${TPL.amberInk};${FSTACK}">Attached: Registration Form For Energisation (PDF). Please action at least 48 hours before the required slot.</td></tr></table></td></tr>`
    + P("Kind regards,<br>CSN Cx Team", "15px")
    + `<tr><td style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>`
    + `<tr><td style="padding:10px 18px;border-top:1px solid ${TPL.line};font-size:10.5px;color:${TPL.faint};${FSTACK}">Issued from DLP by ${eH(p.organiser || "CSN Cx Team")} &#183; CSN Commissioning &#183; RFFE attached as PDF</td></tr>`
    + `</table>`;
}

// REV136: energisation confirmation email. Sent automatically from DLP to the admins
// when the EE column is marked complete (typically by Velox SAP, who cannot send email
// themselves). House style, green to read as "go", asset code primary with the name in
// parentheses to match the RFFE and the PDF, and a deeplink to the asset overview.
export function buildEnergisedEmailHtml(p) {
  const a = p.assets || [];
  if (!a.length) return "";
  const multi = a.length > 1;
  const GRN = "#15803d", GRNBG = "#E9F7EF", GRNEDGE = "#18b69b";
  const P = (html, padTop) => `<tr><td style="padding:${padTop || "2px"} 20px 0 20px;font-size:13.5px;line-height:1.6;color:${TPL.ink};${FSTACK}">${html}</td></tr>`;
  const bAsset = (x) => `<b style="color:${TPL.ink};">${eH(x.tag)}</b> <span style="color:${TPL.mut};font-size:12px;">(${eH(x.name)})</span>`;
  let assetBlock;
  if (multi) {
    const rows = a.map((x) => `<tr><td width="14" style="padding:3px 8px 3px 0;font-size:12px;color:${GRNEDGE};vertical-align:top;line-height:1.6;">&#9679;</td><td style="padding:3px 0;font-size:13px;color:${TPL.ink};line-height:1.6;${FSTACK}">${bAsset(x)}</td></tr>`).join("");
    assetBlock = P("The following assets are now marked as Equipment Energised:") + `<tr><td style="padding:9px 20px 2px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table></td></tr>`;
  } else {
    assetBlock = P(`${bAsset(a[0])} is now marked as <b>Equipment Energised</b>.`);
  }
  const linkRow = p.appUrl
    ? `<tr><td style="padding:14px 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${GRN};padding:9px 22px;"><a href="${eH(p.appUrl)}" target="_blank" style="font-size:12.5px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block;${FSTACK}">Open ${multi ? "These Assets" : "This Asset"} In DLP</a></td></tr></table></td></tr>`
    : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="border-collapse:collapse;background-color:#ffffff;border:1px solid #d8dee9;${FSTACK}">`
    + `<tr><td style="padding:0;background-color:${GRN};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:12px 18px;font-size:15px;font-weight:bold;color:#ffffff;${FSTACK}">FIN04 Equipment Energised</td><td align="right" style="padding:12px 18px;font-size:11px;color:#d6f0e0;${FSTACK}">Loop closed</td></tr></table></td></tr>`
    + P("Hi all,", "14px")
    + assetBlock
    + P(`${multi ? "These assets have" : "This asset has"} been energised by the Velox SAP team. L3 startup can now proceed.`, "11px")
    + linkRow
    + `<tr><td style="padding:15px 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td style="border-left:3px solid ${GRNEDGE};background-color:${GRNBG};padding:9px 12px;font-size:12px;color:${GRN};${FSTACK}">Automated confirmation from DLP, sent when the EE column was marked complete. No action needed.</td></tr></table></td></tr>`
    + P("Kind regards,<br>DLP", "15px")
    + `<tr><td style="height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>`
    + `<tr><td style="padding:10px 18px;border-top:1px solid ${TPL.line};font-size:10.5px;color:${TPL.faint};${FSTACK}">Automated energisation confirmation &#183; CSN Commissioning &#183; sent from DLP</td></tr>`
    + `</table>`;
}
