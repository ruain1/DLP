// witnessContacts.js
import { projName } from "./data";
// ---------------------------------------------------------------------------
// Hardcoded routing for witness calendar invites.
//
// HOW TO MAINTAIN THIS FILE (no other file needs touching):
//   - To add or remove a named person for a discipline, edit the array under
//     that discipline in TO below.
//   - To add or remove a contractor, edit the COMPANY ADD blocks (Velox ->
//     Electrical, Mecwide -> Mechanical, Gapit -> BMS/EPMS). These are whole
//     companies attached to one discipline each.
//   - CC people are copied on every invite regardless of discipline.
//   - ORGANISER addresses are never invited (the sender cannot invite himself).
//
// Routing rule: an activity's selected discipline(s) -> the union of every TO
// list for those disciplines, minus organiser and CC, plus the CC list.
//
// Discipline tokens MUST match the dropdown values exactly:
//   MECHANICAL, ELECTRICAL, BMS/EPMS, FLS
// ---------------------------------------------------------------------------

export const DISCIPLINES = ["MECHANICAL", "ELECTRICAL", "BMS/EPMS", "FLS"];

// Required attendees (To) per discipline.
export const TO = {
  MECHANICAL: [
    // Implex (matrix)
    "andrew.sharp@implexcritical.com",
    "chris.southern@implexcritical.com",
    "joshua.lawrance@implexcritical.com",
    "ashley.gateley@implexcritical.com",      // not in user export - verify
    "jonathan.crossland@implexcritical.com",  // not in user export - verify
    "colin.murphy@implexcritical.com",
    // CTS (matrix)
    "catalin.m@cts-nordics.com",
    "sergiu.n@cts-nordics.com",
    "pavel.v@cts-nordics.com",
    "cristi.s@cts-nordics.com",
    // Client (atnorth) - Mechanical
    "toni.korpinen@partners.atnorth.com",
    "miikka.oksanen@atnorth.com",
    "seppo.vallberg@partners.atnorth.com",
    "nuutti.niemi@atnorth.com",
    "samu.spannari@atnorth.com",
    "aksu.niskala@atnorth.com",
    "mirva.taylor@atnorth.com",
    // CX team (all disciplines)
    "damian.c@cs-nordics.com",
    "karolina.d@cs-nordics.com",
    "mark.r@cs-nordics.com",
    // COMPANY ADD: Mecwide -> Mechanical
    "gabriel.gois@mecwide.com",
    "joao.rocha@veloxelectro-nordics.com",    // tagged Mecwide, velox-domain email
    "luis.andrade@mecwide.com",
    "luis.rodrigues@mecwide.com",
    "marcelo.castro@mecwide.com",
    "martinho.afonso@mecwide.com",
    "tiago.macedo@mecwide.com",
  ],
  ELECTRICAL: [
    // Implex (matrix)
    "mark.donnison@implexcritical.com",
    "andy.hewkin@implexcritical.com",
    "jeffrey.bailey@implexcritical.com",
    "martin.coatsworth@implexcritical.com",
    "dariusz.gozdek@implexcritical.com",
    "colin.murphy@implexcritical.com",
    // CTS (matrix)
    "michael.o@cts-nordics.com",
    "rafal.b@cts-nordics.com",
    "mark.he@cts-nordics.com",
    "christopher.j@cts-nordics.com",
    // Client (atnorth) - Electrical
    "pertti.levealahti@partners.atnorth.com",
    "miro.dahlman@partners.atnorth.com",
    "aku.kangas@atnorth.com",
    "miki.ruohisto@atnorth.com",
    "janne.huimala@atnorth.com",
    "janne.lemola@atnorth.com",
    "mikko.luoma@atnorth.com",
    "smrutigandha.angane@atnorth.com",
    "antti.tepponen@partners.atnorth.com",
    // CX team (all disciplines)
    "damian.c@cs-nordics.com",
    "karolina.d@cs-nordics.com",
    "mark.r@cs-nordics.com",
    // COMPANY ADD: Velox -> Electrical
    "alexander.skavlid@veloxelectro-nordics.com",
    "andreas.bjornstad@veloxelectro-nordics.com",
    "antonio.reveles@veloxelectro-nordics.com",
    "bruno.marques@veloxelectro-nordics.com",
    "carlos.madeira@veloxelectro-nordics.com",
    "dariusz.piecuch@veloxelectro-nordics.com",
    "diogo.miguel.lourenco@veloxelectro-nordics.com",
    "fabian.flageborg@veloxelectro-nordics.com",
    "francisco.joao.baptista@veloxelectro-nordics.com",
    "konrad.kroc@veloxelectro-nordics.com",
    "pedro.aguiar@veloxelectro-nordics.com",
    "robert.targosz@veloxelectro-nordics.com",
    "szymon.wieczorek@veloxelectro-nordics.com",
    "tomasz.domeracki@veloxelectro-nordics.com",
  ],
  "BMS/EPMS": [
    // Implex (matrix)
    "mark.donnison@implexcritical.com",
    "andrew.sharp@implexcritical.com",
    "chris.southern@implexcritical.com",
    "joshua.lawrance@implexcritical.com",
    "ashley.gateley@implexcritical.com",      // not in user export - verify
    "jonathan.crossland@implexcritical.com",  // not in user export - verify
    "colin.murphy@implexcritical.com",
    // CTS (matrix)
    "rafal.b@cts-nordics.com",
    "mark.he@cts-nordics.com",
    "christopher.j@cts-nordics.com",
    // CX team (all disciplines)
    "damian.c@cs-nordics.com",
    "karolina.d@cs-nordics.com",
    "mark.r@cs-nordics.com",
    // COMPANY ADD: Gapit -> BMS/EPMS
    "jha@gapit.io",
    "lpn@gapit.io",
    "od@gapit.io",
  ],
  FLS: [
    // Implex (matrix)
    "mark.donnison@implexcritical.com",
    "chris.southern@implexcritical.com",
    "colin.murphy@implexcritical.com",
    // CTS (matrix)
    "rafal.b@cts-nordics.com",
    "mark.he@cts-nordics.com",
    "christopher.j@cts-nordics.com",
    // CX team (all disciplines)
    "damian.c@cs-nordics.com",
    "karolina.d@cs-nordics.com",
    "mark.r@cs-nordics.com",
    // (no contractor company add for FLS)
  ],
};

// Copied on every witness invite, regardless of discipline.
export const CC = [
  "malina.v@cts-nordics.com",
  "farman.n@cts-nordics.com",
  "ricky.k@cts-nordics.com",
  "patrick.o@cts-nordics.com",
  "hermanni.peltola@atnorth.com",
  "radoslaw.slominski@atnorth.com",            // not in user export - verify
];

// The organiser/sender. Never invited (Outlook adds the sender automatically).
// Both of Ruain's accounts are excluded.
export const ORGANISER = [
  "ruain.b@cs-nordics.com",
  "r.burrows@quantum-mc.com",
];

const norm = (e) => (e || "").trim().toLowerCase();

// Resolve a list of disciplines to { to, cc } deduped address lists.
// Accepts an array (["ELECTRICAL","BMS/EPMS"]) or a "; "-joined string.
// REV264: this matrix is FIN04's people. On any other project the resolver returns
// empty lists and names itself unconfigured, so a Vantaa invite can never silently
// summon the Koski contact set. New projects get their own matrix here (or a future
// per-project editor) before witnessing goes live on them.
export function witnessRecipients(disciplines) {
  if ((projName() || "FIN04") !== "FIN04") return { to: [], cc: [], unconfigured: projName() };
  const list = Array.isArray(disciplines)
    ? disciplines
    : String(disciplines || "").split(/\s*;\s*/);
  const sel = list.map((d) => (d || "").trim()).filter(Boolean);

  const organiser = new Set(ORGANISER.map(norm));
  const ccSet = new Set(CC.map(norm).filter((e) => !organiser.has(e)));

  const toSet = new Set();
  sel.forEach((d) => {
    (TO[d] || []).forEach((e) => {
      const n = norm(e);
      if (!organiser.has(n) && !ccSet.has(n)) toSet.add(n);
    });
  });

  return { to: [...toSet], cc: [...ccSet] };
}
