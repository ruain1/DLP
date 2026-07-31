// REV361 harness: src/delayInfo.js. Run: node harness-delayinfo.mjs
import { delayIndex, delayPhrase, isClosedActivity, openPredecessors } from "./src/delayInfo.js";

let n = 0;
const ok = (cond, msg) => { n++; if (!cond) { console.error("FAIL:", msg); process.exit(1); } };
const eq = (got, want, msg) => { n++; if (got !== want) { console.error("FAIL:", msg, "got", JSON.stringify(got), "want", JSON.stringify(want)); process.exit(1); } };

const TODAY = "2026-07-31";
const A = (o) => ({ status: "planned", percent: 0, duration: 1, predecessors: [], ...o });

// ---------- fixture 1: the live FIN04 chain that produced Marisa's email ----------
// #2 B3 MV Energisation, in progress, planned to finish 07 Aug.
// #1138 EPOD101 FOK planned 20 to 22 Jul, held behind #2.
// #1142 EPOD301 FOK held behind #1138, so held transitively with #2 as root driver.
// #139 SB DB BMS Signal Checking, overdue with no open predecessor: genuinely late.
const fin04 = [
  A({ id: "u2", code: 2, desc: "B3 MV Energisation to A1 & A2 feeders", companyId: "atnorth", start: "2026-07-20", duration: 19, status: "in_progress", percent: 40 }),
  A({ id: "u1138", code: 1138, desc: "EPOD101 FOK", companyId: "schneider", start: "2026-07-20", duration: 3, predecessors: ["u2"] }),
  A({ id: "u1142", code: 1142, desc: "EPOD301 FOK", companyId: "schneider", start: "2026-07-23", duration: 3, predecessors: ["u1138"] }),
  A({ id: "u139", code: 139, desc: "SB DB - BMS Signal Checking", companyId: "gapit", start: "2026-07-19", duration: 7, percent: 30, status: "in_progress" }),
];
const ix = delayIndex(fin04, TODAY);

const i2 = ix.get("u2");
eq(i2.state, "clear", "the energisation is underway with a 07 Aug planned finish, so it is neither late nor held");
// planned 20 Jul + 19 days = finish 07 Aug, today 31 Jul, so not overdue; underway with no actualStart.
eq(delayIndex([fin04[0]], TODAY).get("u2").state, "clear", "root driver alone is clear, not late");

const i1138 = ix.get("u1138");
eq(i1138.state, "held", "EPOD101 FOK is held, not late");
eq(i1138.forecastStart, "2026-08-08", "cannot start until the day after the energisation finishes");
eq(i1138.forecastFinish, "2026-08-10", "3 day duration from the feasible start");
eq(i1138.days, 19, "19 days of drift, planned 20 Jul to feasible 08 Aug");
eq(i1138.driver.code, 2, "driver is the energisation");
eq(i1138.rootDriver.code, 2, "root driver is the energisation itself");
ok(!i1138.underway, "EPOD101 FOK has not started");

const i1142 = ix.get("u1142");
eq(i1142.state, "held", "EPOD301 FOK is held transitively");
eq(i1142.forecastStart, "2026-08-11", "held behind EPOD101 FOK which now forecasts to 10 Aug");
eq(i1142.driver.code, 1138, "immediate driver is EPOD101 FOK");
eq(i1142.rootDriver.code, 2, "root driver climbs to the energisation");

const i139 = ix.get("u139");
eq(i139.state, "late", "no open predecessor, so the delay is its own");
eq(i139.days, 6, "planned finish 25 Jul, today 31 Jul");
eq(i139.driver, null, "nothing is holding it");

// ---------- fixture 2: closure rules release the hold ----------
const closedForms = [
  { status: "complete", percent: 100 },
  { status: "in_progress", percent: 100 },   // REV335 reported-100 closure
  { status: "in_progress", percent: 0, outcome: "failed" },  // REV328 failed-terminal
];
closedForms.forEach((cf, k) => {
  const set = [
    A({ id: "p", code: 1, desc: "pred", start: "2026-07-20", duration: 19, ...cf }),
    A({ id: "s", code: 2, desc: "succ", start: "2026-07-20", duration: 3, predecessors: ["p"] }),
  ];
  const g = delayIndex(set, TODAY).get("s");
  eq(g.state, "late", "closed predecessor form " + k + " releases the hold, successor is late on its own");
  eq(g.days, 9, "planned finish 22 Jul, today 31 Jul, form " + k);
});

// ---------- fixture 3: an underway successor is never held ----------
const started = [
  A({ id: "p", code: 1, desc: "pred", start: "2026-07-20", duration: 30, status: "in_progress", percent: 10 }),
  A({ id: "s", code: 2, desc: "succ", start: "2026-07-20", duration: 3, predecessors: ["p"], actualStart: "2026-07-21", status: "in_progress", percent: 20 }),
];
const g3 = delayIndex(started, TODAY).get("s");
eq(g3.state, "late", "work has demonstrably begun, so the hold is moot and lateness is its own");
ok(g3.underway, "underway flag set");

// ---------- fixture 4: held but not yet overdue ----------
const future = [
  A({ id: "p", code: 1, desc: "pred", start: "2026-07-20", duration: 30, status: "in_progress", percent: 10 }),
  A({ id: "s", code: 2, desc: "succ", start: "2026-08-05", duration: 3, predecessors: ["p"] }),
];
const g4 = delayIndex(future, TODAY).get("s");
eq(g4.state, "held", "a future activity already impossible is held, not clear");
eq(g4.forecastStart, "2026-08-19", "day after the predecessor forecast finish 18 Aug");

// ---------- fixture 5: cycle guard ----------
const cyc = [
  A({ id: "a", code: 1, desc: "a", start: "2026-07-20", duration: 3, predecessors: ["b"] }),
  A({ id: "b", code: 2, desc: "b", start: "2026-07-20", duration: 3, predecessors: ["a"] }),
];
let cycOut = null;
try { cycOut = delayIndex(cyc, TODAY).all(); } catch (e) { cycOut = null; }
ok(cycOut && Object.keys(cycOut).length === 2, "a predecessor cycle resolves instead of hanging or throwing");

// ---------- fixture 6: unresolvable links never hide an item ----------
const dangling = [A({ id: "a", code: 1, desc: "a", start: "2026-07-20", duration: 3, predecessors: ["does-not-exist"] })];
const g6 = delayIndex(dangling, TODAY).get("a");
eq(g6.state, "late", "a link resolving to nothing leaves the activity flagged, never hidden");

// ---------- fixture 7: legacy integer code links still resolve ----------
const byCode = [
  A({ id: "p", code: 77, desc: "pred", start: "2026-07-20", duration: 30, status: "in_progress", percent: 10 }),
  A({ id: "s", code: 78, desc: "succ", start: "2026-07-20", duration: 3, predecessors: ["77"] }),
];
eq(delayIndex(byCode, TODAY).get("s").state, "held", "REV352 rule: integer code links resolve as well as UUIDs");

// ---------- fixture 8: late start with no predecessor ----------
const ls = [A({ id: "a", code: 1, desc: "a", start: "2026-07-20", duration: 30, actualStart: "2026-07-27", status: "in_progress", percent: 5 })];
const g8 = delayIndex(ls, TODAY).get("a");
eq(g8.state, "late", "a late actual start is late");
eq(g8.days, 7, "7 days late off the blocks");
eq(g8.lateKind, "lateStart", "classified as a late start, not overdue");

// ---------- fixture 9: undated and closed states ----------
eq(delayIndex([A({ id: "a", code: 1, desc: "a" })], TODAY).get("a").state, "undated", "no start date yields undated");
eq(delayIndex([A({ id: "a", code: 1, desc: "a", start: "2026-07-01", status: "complete", percent: 100 })], TODAY).get("a").state, "closed", "a complete activity is never late here");

// ---------- fixture 10: milestones ----------
const ms = [A({ id: "m", code: 9, desc: "milestone", start: "2026-07-20", duration: 5, isMilestone: true })];
eq(delayIndex(ms, TODAY).get("m").days, 11, "a milestone is one day long regardless of stored duration");

// ---------- predicates and wording ----------
ok(isClosedActivity({ status: "complete" }), "complete is closed");
ok(isClosedActivity({ status: "in_progress", percent: 100 }), "reported 100 is closed");
ok(isClosedActivity({ outcome: "FAILED" }), "failed outcome is closed, case insensitive");
ok(!isClosedActivity({ status: "in_progress", percent: 99 }), "99 percent is open");
eq(openPredecessors(fin04[1], fin04).length, 1, "one open predecessor for EPOD101 FOK");
eq(openPredecessors(fin04[3], fin04).length, 0, "none for the Gapit item");
ok(delayPhrase(i1138).indexOf("Held by") === 0, "held wording leads with the hold");
ok(delayPhrase(i1138).indexOf("19 days adrift") > 0, "held wording carries the drift");
ok(delayPhrase(i139).indexOf("Running 6 days past") === 0, "late wording unchanged in shape");
eq(delayPhrase(null), "", "no info yields no wording");
eq(delayPhrase({ state: "clear" }), "", "clear yields no wording");

// ---------- determinism: no clock reads ----------
const later = delayIndex(fin04, "2026-08-20").get("u1138");
eq(later.state, "held", "still held at a later reference date while the driver stays open");
// An open predecessor cannot have finished in the past, so once the energisation passes its own
// 07 Aug planned finish the feasible start walks forward with the clock and the drift grows.
// This is deliberate: it is what stops a stale forecast reading as achievable.
eq(later.forecastStart, "2026-08-21", "an overdue open driver pushes the feasible start to tomorrow");
eq(later.days, 32, "drift grows once the driver is itself overdue");
eq(delayIndex(fin04, "2026-08-01").get("u1138").days, 19, "drift is stable while the driver is still within its own plan");

console.log("delayInfo harness: " + n + " assertions passed");
