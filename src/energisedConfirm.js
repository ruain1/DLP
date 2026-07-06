// REV136: energisation confirmation. When Velox mark EE complete, the REV132 trigger flips
// the asset event to 'energised'. Velox cannot send email, so DLP sends the confirmation to
// the admins automatically, from the designated sender's delegated session (the same account
// the digest uses). An atomic confirmed_at claim makes it fire exactly once across tabs. This
// is driven off the admin events poll in App, so it lands within a poll cycle of the EE mark.
//
// outlook is imported dynamically so this module, and the msal it pulls, stay out of the
// initial bundle; the poll only reaches it when there is something to send. The two data
// helpers are core (data.js is already in the main bundle), so they are imported statically.

import { claimEnergisedConfirmation, releaseEnergisedConfirmation } from "./data";

export const ENERGISED_SENDER = "ruain.b@cs-nordics.com";
export const ENERGISED_RECIPIENTS = [
  "karolina.d@cs-nordics.com",
  "ruain.b@cs-nordics.com",
  "damian.c@cs-nordics.com",
  "mark.r@cs-nordics.com",
];

let busy = false;

export async function trySendEnergisedConfirmations(projectId, events, organiserName) {
  if (busy) return false;
  const pending = (events || []).filter((e) => e.state === "energised" && !e.confirmed_at);
  if (!pending.length) return false;
  busy = true;
  try {
    const ol = await import("./outlook");
    const acct = await ol.outlookAccount();
    if (!acct || String(acct.username).toLowerCase() !== ENERGISED_SENDER) return false;   // only the designated tab sends
    const won = [];
    for (const e of pending) { try { if (await claimEnergisedConfirmation(e.id)) won.push(e); } catch (x) {} }
    if (!won.length) return false;
    try {
      const origin = (typeof window !== "undefined" && window.location) ? window.location.origin : "";
      const first = won[0];
      const appUrl = origin + "/?p=" + encodeURIComponent(projectId) + "&page=assets" + (won.length === 1 ? "&asset=" + encodeURIComponent(first.asset_tag) : "");
      const html = ol.buildEnergisedEmailHtml({ assets: won.map((e) => ({ name: e.asset_name || e.asset_tag, tag: e.asset_tag })), organiser: organiserName, appUrl });
      const subject = won.length === 1
        ? "FIN04 - Energised " + first.asset_tag
        : "FIN04 - Energised - " + first.asset_tag + " + " + (won.length - 1) + " more";
      await ol.sendMailMessage({ subject, html, to: ENERGISED_RECIPIENTS });
      return true;
    } catch (err) {
      for (const e of won) { try { await releaseEnergisedConfirmation(e.id); } catch (x) {} }
      return false;
    }
  } finally { busy = false; }
}
