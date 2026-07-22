// REV326 harness: morningReport attendance section. Bundled via esbuild first.
import { buildAttendanceHtml, buildMorningEmail, morningCfg, MORNING_DEFAULTS } from "./src/morningReport.js";

let n = 0;
const ok = (cond, msg) => { n++; if (!cond) { console.error("FAIL:", msg); process.exit(1); } };

const att = {
  meetingTitle: "FIN04 - Morning Cx Meeting",
  meetingStartISO: "2026-07-22T04:05:00Z",   // 07:05 Helsinki
  meetingDate: "2026-07-22",
  durationMin: 15,
  totals: { people: 38, invited: 11, present: 9, absent: 2, unmatched: 3 },
  rows: [
    { name: "CS Nordics", count: 14, names: ["Lee Goodway", "Mark Robertson", "Karolina Dabek", "A", "B"], firstJoinISO: "2026-07-22T04:02:00Z", late: false },
    { name: "Daikin Applied", count: 1, names: ["Omar Belkhiria"], firstJoinISO: "2026-07-22T04:14:00Z", late: true },
  ],
  absent: [{ name: "DCS Norway", domains: ["dcsnorway.com"] }, { name: "AGIS", domains: ["agisfs.fi"] }],
  unmatched: [{ name: "Ville Immonen", email: "v@se.com", domain: "se.com", firstJoinISO: "2026-07-22T04:06:00Z" }],
  uploadedByName: "Ruain Burrows",
};

// section builder
const h = buildAttendanceHtml(att, true);
ok(h.includes("Morning meeting attendance"), "section head present");
ok(h.includes("Wed 22 Jul"), "date label rendered");
ok(h.includes("07:05") && h.includes("15 min"), "start and duration in the meta line");
ok(h.includes("<b>9</b> of <b>11</b>"), "summary counts");
ok(h.includes("joined late") && h.includes("07:14"), "late tag and amber first-in");
ok(h.includes("and 2 more"), "names capped at 3 with more-line");
ok(h.includes("NOT REPRESENTED") && h.includes("dcsnorway.com"), "absent block with failed domain");
ok(h.includes("UNMATCHED") && h.includes("se.com"), "unmatched block");
ok(h.includes("uploaded by Ruain Burrows"), "provenance");
ok(!/[\u2013\u2014]/.test(h), "no em/en dashes in output");

const h2 = buildAttendanceHtml(att, false);
ok(!h2.includes("NOT REPRESENTED"), "absent hidden when showAbsent false");

// defaults + cfg merge
ok(MORNING_DEFAULTS.sections.attendance === true, "attendance section default on");
const cfg = morningCfg({ design: { morningReport: { attendance: { showAbsent: false, companies: [{ name: "X", domains: ["x.com"] }] } } } });
ok(cfg.attendance.showAbsent === false && cfg.attendance.companies.length === 1, "cfg deep-merge attendance");
ok(cfg.sections.ai === true, "other section defaults intact");

// full email: minimal but complete d
const d = {
  today: "2026-07-22", yday: "2026-07-21", tmrw: "2026-07-23",
  yDone: [], yMissed: [], tStart: [], tDue: [], pushing: [],
  counts: { inProgress: 1, finishing: 0, overdue: 0, starting: 0, cons: 0 },
  finishing: [], overdue: [], overdueOlder: 0, starting: [], consRows: [], witness: [], upRows: [],
  ai: "", attendance: att,
};
const meta = { projName: "FIN04", projLine: "atnorth Koski", dateLine: "Wednesday, 22 July 2026", logoDark: "", logoUrl: "", appUrl: "https://dlp-pi.vercel.app" };
const full = buildMorningEmail(d, morningCfg({}), meta);
ok(full.includes("Morning meeting attendance"), "block present in full email");
ok(full.indexOf("OPEN CONSTRAINTS") < full.indexOf("Morning meeting attendance"), "block sits after the counter tiles");
ok(full.includes("MORNING CX UPDATE") && full.includes("#001C26"), "masthead untouched");

const cfgOff = morningCfg({ design: { morningReport: { sections: { attendance: false } } } });
const fullOff = buildMorningEmail(d, cfgOff, meta);
ok(!fullOff.includes("Morning meeting attendance"), "section toggle removes the block");

const dNo = { ...d, attendance: null };
const fullNo = buildMorningEmail(dNo, morningCfg({}), meta);
ok(!fullNo.includes("Morning meeting attendance"), "no upload, no block");
ok(!/[\u2013\u2014]/.test(fullNo) && !/[\u2013\u2014]/.test(full), "no em/en dashes in full emails");

console.log("morning attendance harness: " + n + " assertions passed");
