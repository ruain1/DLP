// REV361 harness: the rendered Morning Cx Update, not just the classifier.
// Proves the FIN04 chain in Marisa Vartinen's 31 Jul query now reports as held rather than
// as an 8-day Schneider slip, and that a genuine Gapit slip is untouched.
// Run: node harness-morning-held.bundle.mjs (bundled, morningReport imports digestCore).
import { morningData, buildMorningEmail, buildMorningAiFacts, morningCfg } from "./src/morningReport.js";

let n = 0;
const ok = (cond, msg) => { n++; if (!cond) { console.error("FAIL:", msg); process.exit(1); } };
const no = (cond, msg) => ok(!cond, msg);

const A = (o) => ({ status: "planned", percent: 0, duration: 1, predecessors: [], constraints: [], ...o });
const St = {
  companies: [{ id: "c1", name: "atnorth" }, { id: "c2", name: "Schneider" }, { id: "c3", name: "Gapit" }],
  settings: { design: { morningReport: { enabled: true, splitHeld: true, sections: {} } } },
  activities: [
    A({ id: "u2", code: 2, desc: "B3 MV Energisation to A1 & A2 feeders", companyId: "c1", start: "2026-07-20", duration: 19, status: "in_progress", percent: 40 }),
    A({ id: "u1138", code: 1138, desc: "EPOD101 FOK", companyId: "c2", start: "2026-07-20", duration: 3, predecessors: ["u2"] }),
    A({ id: "u1142", code: 1142, desc: "EPOD301 FOK", companyId: "c2", start: "2026-07-23", duration: 3, predecessors: ["u1138"] }),
    A({ id: "u139", code: 139, desc: "SB DB - BMS Signal Checking", companyId: "c3", start: "2026-07-19", duration: 7, status: "in_progress", percent: 30 }),
    A({ id: "u137", code: 137, desc: "EPODS - UPS, Battery, CRAH", companyId: "c3", start: "2026-08-01", duration: 4, predecessors: ["u139"] }),
  ],
};
const due = new Date("2026-07-31T05:00:00Z");
const cfg = morningCfg(St.settings);
const d = morningData(St, due, []);

// ---------- data layer ----------
const cf = d.clearFirst || [];
ok(cf.length >= 2, "the roll-up is populated");
const byDesc = (t) => cf.find((b) => b.desc.indexOf(t) === 0);
const e101 = byDesc("EPOD101 FOK");
const eng = byDesc("B3 MV Energisation");
const sbdb = byDesc("SB DB - BMS Signal Checking");
ok(e101, "EPOD101 FOK appears as a blocker of EPOD301 FOK");
ok(e101.held === true, "EPOD101 FOK is flagged held, not late");
ok(e101.late === 0, "no day-late count is attributed to Schneider for EPOD101 FOK");
ok(e101.canStart === "2026-08-08", "earliest feasible start carried through to the renderer");
ok(e101.root === "B3 MV Energisation to A1 & A2 feeders", "root driver named");
ok(eng && !eng.held, "the energisation itself is not held");
ok(sbdb && sbdb.held === false && sbdb.late === 6, "the genuine Gapit slip keeps its red day count");
ok(cf.indexOf(eng) < cf.indexOf(e101), "causes sort above symptoms");

// ---------- rendered email ----------
const html = buildMorningEmail(d, cfg, { projectName: "FIN04", logoUrl: "", location: "Koski" });
ok(/Clear these first/.test(html), "the section still renders");
ok(/held,&#160;can&#160;start&#160;08&#160;Aug/.test(html), "EPOD101 FOK renders a held chip with its feasible start");
ok(/driven upstream by B3 MV Energisation to A1 &amp; A2 feeders, not by Schneider/.test(html), "attribution line names the driver and clears Schneider");
ok(/6&#160;days&#160;late/.test(html), "the genuine Gapit slip still renders a red day count");
no(/8&#160;days&#160;late/.test(html), "no day-late chip is rendered against a held activity");

// The regression that mattered: the string that reached Marisa.
const plain = html.replace(/&#160;/g, " ").replace(/<[^>]+>/g, " ");
no(/EPOD101 FOK\s+[0-9]+ days late/.test(plain), "EPOD101 FOK no longer reads as N days late");
no(/EPOD301 FOK\s+[0-9]+ days late/.test(plain), "EPOD301 FOK no longer reads as N days late");
ok(/SB DB - BMS Signal Checking[\s\S]{0,80}6 days late/.test(plain), "Gapit is still chased, so nothing is softened away");

// ---------- AI facts sheet must agree with the rendered email ----------
const facts = String(buildMorningAiFacts(d, cfg));
ok(/ITSELF HELD/.test(facts), "the model is told the blocker is itself held");
ok(/do not direct action at Schneider/.test(facts), "the model is instructed not to chase the wrong company");
ok(/cannot start before 2026-08-08/.test(facts), "the model has the feasible start");

console.log("morning held-vs-late harness: " + n + " assertions passed");
