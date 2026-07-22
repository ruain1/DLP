// REV326 harness: attendanceImport.js. Run: node harness-attendance.bundle.mjs
import { parseAttendanceFile, parseAttendanceText, aggregateAttendance, pickAttendanceFor, normName, emailDomain, domainMatches, parseDurMin, helTimeOf, cleanName, isBotName } from "./src/attendanceImport.js";

let n = 0;
const ok = (cond, msg) => { n++; if (!cond) { console.error("FAIL:", msg); process.exit(1); } };

// ---------- fixture 1: modern post-meeting report, English, UTF-16LE, tab ----------
const en = [
  "1. Summary",
  "Meeting title\tFIN04 - Morning Cx Meeting",
  "Attended participants\t5",
  "Start time\t7/22/26, 7:05:12 AM",
  "End time\t7/22/26, 7:20:41 AM",
  "Meeting duration\t15m 29s",
  "",
  "2. Participants",
  "Name\tFirst Join\tLast Leave\tIn-Meeting Duration\tEmail\tParticipant ID (UPN)\tRole",
  '"Chlebek, Damian"\t7/22/26, 7:02:10 AM\t7/22/26, 7:20:30 AM\t18m 20s\tdamian.c@cts-nordics.com\tdamian.c@cts-nordics.com\tPresenter',
  "Bruno Marques\t7/22/26, 7:03:05 AM\t7/22/26, 7:20:00 AM\t16m 55s\tbruno.marques@veloxelectro-nordics.com\tbruno@x\tAttendee",
  "Omar Belkhiria\t7/22/26, 7:14:02 AM\t7/22/26, 7:20:10 AM\t6m 8s\to.belkhiria@daikinapplied.eu\to@x\tAttendee",
  "Luis Andrade\t7/22/26, 7:05:30 AM\t7/22/26, 7:19:00 AM\t13m 30s\tluis.andrade@mail.mecwide.com\tl@x\tAttendee",
  "Ville Immonen\t7/22/26, 7:06:00 AM\t7/22/26, 7:20:00 AM\t14m 0s\tville.immonen@se.com\tv@x\tAttendee",
  "Antti Tepponen (External)\t7/22/26, 7:04:00 AM\t7/22/26, 7:20:00 AM\t16m 0s\tantti.tepponen@partners.atnorth.com\ta@x\tAttendee",
  "read.ai meeting notes (Unverified)\t7/22/26, 7:05:00 AM\t7/22/26, 7:20:00 AM\t15m 0s\t\t\tAttendee",
  "",
  "3. In-Meeting Activities",
  "Name\tJoin Time\tLeave Time\tDuration\tEmail\tRole",
  "Bruno Marques\t7/22/26, 7:03:05 AM\t7/22/26, 7:20:00 AM\t16m 55s\tbruno.marques@veloxelectro-nordics.com\tAttendee",
].join("\r\n");
const b16 = Buffer.from("\uFEFF" + en, "utf16le");
const p1 = parseAttendanceFile(new Uint8Array(b16), "meetingAttendanceReport.csv");
ok(p1.ok, "en parse ok");
ok(p1.shape === "report", "en shape report, got " + p1.shape);
ok(p1.meetingTitle === "FIN04 - Morning Cx Meeting", "en title, got " + JSON.stringify(p1.meetingTitle));
ok(p1.meetingDate === "2026-07-22", "en meetingDate, got " + p1.meetingDate);
ok(helTimeOf(p1.meetingStartISO) === "07:05", "en start 07:05 Helsinki, got " + helTimeOf(p1.meetingStartISO));
ok(p1.durationMin === 15, "en duration 15 from kv, got " + p1.durationMin);
ok(p1.participants.length === 6, "en 6 participants (bot excluded, activities table not double-counted), got " + p1.participants.length);
const antti = p1.participants.find((p) => p.email === "antti.tepponen@partners.atnorth.com");
ok(antti && antti.name === "Antti Tepponen", "REV327: (External) qualifier stripped at parse, got " + JSON.stringify(antti && antti.name));
ok(!p1.participants.some((p) => /read\.ai/i.test(p.name)), "REV327: read.ai bot excluded at parse");
const damian = p1.participants.find((p) => p.email === "damian.c@cts-nordics.com");
ok(damian && damian.name === "Chlebek, Damian", "quoted name preserved");
ok(damian.durationMin === 18, "duration from column, got " + damian.durationMin);
ok(helTimeOf(damian.firstJoinISO) === "07:02", "damian first join 07:02");

// ---------- fixture 2: localised (Finnish-style) headers, UTF-8, comma, dotted datetimes ----------
const fi = [
  "1. Yhteenveto",
  "Kokouksen otsikko,FIN04 - Morning Cx Meeting",
  "Alkamisaika,\"22.7.2026 7.05.12\"",
  "Paattymisaika,\"22.7.2026 7.20.41\"",
  "",
  "2. Osallistujat",
  "Nimi,Ensimmainen liittyminen,Viimeinen poistuminen,Kesto,Sahkoposti,Rooli",
  "Damian Chlebek,\"22.7.2026 7.02.10\",\"22.7.2026 7.20.30\",18 min 20 s,damian.c@cts-nordics.com,Esittaja",
  "Jukka Peltola,\"22.7.2026 7.07.00\",\"22.7.2026 7.19.30\",12 min 30 s,jukkapeltola@eaton.com,Osallistuja",
].join("\n");
const p2 = parseAttendanceText(fi, "raportti.csv");
ok(p2.ok, "fi parse ok");
ok(p2.meetingDate === "2026-07-22", "fi meetingDate (day-first), got " + p2.meetingDate);
ok(helTimeOf(p2.meetingStartISO) === "07:05", "fi start 07:05, got " + helTimeOf(p2.meetingStartISO));
ok(p2.participants.length === 2, "fi 2 participants");
ok(p2.participants[0].durationMin === 18, "fi localised duration units, got " + p2.participants[0].durationMin);
ok(p2.meetingTitle === "FIN04 - Morning Cx Meeting", "fi title from localised kv");

// ---------- fixture 3: legacy in-meeting list (no emails) ----------
const legacy = [
  "Full Name\tUser Action\tTimestamp",
  "Damian Chlebek\tJoined\t7/22/2026, 7:02:10 AM",
  "Damian Chlebek\tLeft\t7/22/2026, 7:20:30 AM",
  "Sten Andre Olsen\tJoined\t7/22/2026, 7:05:00 AM",
].join("\r\n");
const p3 = parseAttendanceText(legacy, "attendance list.csv");
ok(p3.ok, "legacy parse ok");
ok(p3.shape === "legacy", "legacy shape, got " + p3.shape);
ok(p3.participants.length === 2, "legacy dedup joins/leaves, got " + p3.participants.length);
ok(p3.warnings.some((w) => /member names/.test(w)), "legacy name-fallback warning present");

// ---------- aggregation ----------
const companies = [
  { name: "atnorth", domains: ["atnorth.com", "partners.atnorth.com"] },
  { name: "CS Nordics", domains: ["cts-nordics.com"] },
  { name: "Velox", domains: ["veloxelectro-nordics.com"] },
  { name: "Mecwide", domains: ["mecwide.com"] },
  { name: "Daikin Applied", domains: ["daikinapplied.eu"] },
  { name: "DCS Norway", domains: ["dcsnorway.com"] },
];
const agg = aggregateAttendance(p1, companies, null);
ok(agg.totals.invited === 6 && agg.totals.present === 5, "agg present 5 of 6, got " + agg.totals.present);
ok(agg.totals.people === 6, "REV327: totals.people excludes bots, got " + agg.totals.people);
const atn = agg.rows.find((r) => r.name === "atnorth");
ok(atn && atn.names[0] === "Antti Tepponen", "REV327: aggregation renders cleaned name for stored uploads");
// stored-upload path: aggregation cleans and excludes even when the parser did not
const storedAgg = aggregateAttendance({ participants: [{ name: "Jan Ackermann (External)", email: "j@daikinapplied.eu" }, { name: "read.ai meeting notes (Unverified)", email: "" }] }, [{ name: "Daikin Applied", domains: ["daikinapplied.eu"] }], null);
ok(storedAgg.rows[0].names[0] === "Jan Ackermann" && storedAgg.totals.people === 1 && storedAgg.unmatched.length === 0, "REV327: defensive clean on stored participants");
ok(cleanName("A B (External)") === "A B" && cleanName("A (Guest) (Unverified)") === "A" && cleanName("Marcel - DCS") === "Marcel - DCS", "REV327: cleanName strips qualifiers only");
ok(isBotName("read.ai meeting notes") && isBotName("Fireflies.ai Notetaker") && !isBotName("Mark Robertson"), "REV327: bot detection");
ok(agg.absent.length === 1 && agg.absent[0].name === "DCS Norway", "DCS Norway absent");
ok(agg.unmatched.length === 1 && agg.unmatched[0].domain === "se.com", "se.com unmatched, got " + JSON.stringify(agg.unmatched));
const mec = agg.rows.find((r) => r.name === "Mecwide");
ok(mec && mec.count === 1, "subdomain mail.mecwide.com matched Mecwide");
const daikin = agg.rows.find((r) => r.name === "Daikin Applied");
ok(daikin && daikin.late === true, "Daikin 07:14 flagged late");
const csn = agg.rows.find((r) => r.name === "CS Nordics");
ok(csn && csn.late === false, "CS Nordics 07:02 not late");
ok(agg.rows[0].count >= agg.rows[agg.rows.length - 1].count, "rows sorted by count desc");

// name-fallback aggregation on legacy
const idx = { [normName("Sten Andre Olsen")]: "Nordic EPod" };
const agg3 = aggregateAttendance(p3, [{ name: "Nordic EPod", domains: ["nordicepod.com"] }], idx);
ok(agg3.rows.length === 1 && agg3.rows[0].name === "Nordic EPod", "legacy name fallback matched");
ok(agg3.unmatched.length === 1, "legacy unmatched participant kept");

// ---------- helpers ----------
ok(emailDomain("A@B.CTS-Nordics.COM.") === "b.cts-nordics.com", "emailDomain normalises");
ok(domainMatches("mail.mecwide.com", "mecwide.com") && !domainMatches("notmecwide.com", "mecwide.com"), "domainMatches subdomain-safe");
ok(parseDurMin("1h 2m 30s") === 63, "parseDurMin h/m/s");
ok(parseDurMin("07:32") === 452, "parseDurMin h:mm");

// ---------- pickAttendanceFor ----------
const due = new Date("2026-07-22T05:00:00Z"); // 08:00 Helsinki
const recs = [
  { id: "a", meeting_date: "2026-07-21", meeting_start: "2026-07-21T04:05:00Z" },
  { id: "b", meeting_date: "2026-07-22", meeting_start: "2026-07-22T04:05:00Z" },
];
ok(pickAttendanceFor(recs, due).id === "b", "pick newest within window");
ok(pickAttendanceFor([recs[0]], due).id === "a", "yesterday still inside 26h");
ok(pickAttendanceFor([{ id: "c", meeting_date: "2026-07-19", meeting_start: "2026-07-19T04:05:00Z" }], due) === null, "stale record excluded");
ok(pickAttendanceFor([{ id: "d", meeting_start: "2026-07-22T06:00:00Z" }], due) === null, "future meeting excluded");

console.log("attendance harness: " + n + " assertions passed");
