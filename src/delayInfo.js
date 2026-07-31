// REV361: the single delay classification. Delay logic had been reimplemented independently in
// the board, the weekly report builder, the Reports page, the Gantt narrative drawer and the
// morning digest, and the divergence caused the REV343 and REV344 defects. This module is the
// one rule; every surface adopting it must import, never copy.
//
// The defect it exists to fix: an activity that cannot start because its own predecessor is
// still open was reported as "N days late" against the company that owns it. On FIN04 that put
// Schneider's name on an 8-day red chip for EPOD101 FOK, which is held behind the atnorth B3 MV
// energisation and cannot lawfully start before it. Planned dates are deliberately left alone,
// because they are the Last Planner baseline that PPC is scored against; what changes is
// classification and attribution.
//
// Three states for an open activity:
//   late  - past its planned dates with no open predecessor holding it. The owner can act.
//   held  - an open predecessor makes the planned start infeasible. The drift is upstream.
//   clear - neither.
// A closed activity (complete, failed-terminal, or reported 100 percent) is never either.

const DAY = 86400000;
const pD = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");
const iso = (d) => d.toISOString().slice(0, 10);
const addD = (d, n) => new Date(d.getTime() + n * DAY);
const dayNum = (s) => Math.round(pD(s).getTime() / DAY);

// Mirrors the closure rule used across the reporting surfaces since REV335: percent and status
// are decoupled, so a member with percent-only rights can report 100 without the status ever
// flipping. All three forms close an activity for delay purposes.
export function isClosedActivity(a) {
  if (!a) return true;
  const pct = a.percent != null ? Math.max(0, Math.min(100, Math.round(a.percent))) : (a.status === "complete" ? 100 : 0);
  return a.status === "complete" || String(a.outcome || "").toLowerCase() === "failed" || pct >= 100;
}

// REV352 identity rule, preserved. predecessors stores activity id UUIDs. Integer codes are also
// accepted because a UUID can never collide with an integer, so older rows keep working. Links
// that resolve to nothing return an empty list, which leaves an activity classified as an
// ordinary slip: missing link data can only ever leave an item flagged, never hide one.
export function openPredecessors(a, activities) {
  const preds = (a && Array.isArray(a.predecessors) ? a.predecessors : []).map(String);
  if (!preds.length) return [];
  return (activities || []).filter((x) => x && !isClosedActivity(x)
    && (preds.includes(String(x.id)) || (x.code != null && preds.includes(String(x.code)))));
}

const durOf = (a) => (a && a.isMilestone) ? 1 : Math.max(1, (a && a.duration) || 1);
const plannedFinishOf = (a) => (a && a.start) ? iso(addD(pD(a.start), durOf(a) - 1)) : null;

// An activity is underway once work has demonstrably begun. A started activity cannot be held:
// whatever the predecessor state says, the crew is on it, so any lateness is its own.
function isUnderway(a) {
  if (!a) return false;
  const pct = a.percent != null ? Math.round(a.percent) : 0;
  return !!a.actualStart || a.status === "in_progress" || pct > 0;
}

/**
 * One forward pass over the predecessor graph for the whole activity set.
 *
 * Returns { get(idOrActivity) } yielding, per dated open activity:
 *   state          "late" | "held" | "clear" | "closed" | "undated"
 *   days           late: days past planned finish (or days of late start, whichever is larger).
 *                  held: days of forecast drift, planned start to earliest feasible start.
 *   plannedStart / plannedFinish / forecastStart / forecastFinish   ISO dates
 *   driver         the binding open predecessor, latest-finishing, or null
 *   rootDriver     the topmost open predecessor in the chain that is not itself held, or null
 *   holdChain      driver ids from this activity up to the root, for cycle-safe display
 *   underway       whether work has demonstrably started
 *
 * todayIso is passed in rather than read from the clock so the harness and any historic
 * report run are deterministic.
 */
export function delayIndex(activities, todayIso) {
  const acts = (activities || []).filter(Boolean);
  const today = String(todayIso || "").slice(0, 10);
  const todayN = today ? dayNum(today) : 0;
  const byId = {};
  const byCode = {};
  acts.forEach((a) => {
    if (a.id != null) byId[String(a.id)] = a;
    if (a.code != null) byCode[String(a.code)] = a;
  });
  const resolve = (ref) => byId[String(ref)] || byCode[String(ref)] || null;

  // Forecast finish for an open predecessor, memoised, cycle-guarded. A cycle falls back to the
  // planned finish rather than throwing: a bad link must never blank a report.
  const fcCache = {};
  const visiting = {};
  function forecastFinishN(a) {
    if (!a || !a.start) return null;
    const key = String(a.id != null ? a.id : a.code);
    if (fcCache[key] !== undefined) return fcCache[key];
    if (visiting[key]) return dayNum(plannedFinishOf(a));
    visiting[key] = 1;
    const pfN = dayNum(plannedFinishOf(a));
    let out = pfN;
    if (!isClosedActivity(a)) {
      const esN = earliestStartN(a);
      if (esN != null) out = Math.max(out, esN + durOf(a) - 1);
      // An open activity cannot have finished in the past, so its forecast finish is never
      // earlier than today. This is what makes a chain of held activities cascade correctly.
      if (todayN) out = Math.max(out, todayN);
    }
    delete visiting[key];
    fcCache[key] = out;
    return out;
  }

  const esCache = {};
  function earliestStartN(a) {
    if (!a || !a.start) return null;
    const key = String(a.id != null ? a.id : a.code);
    if (esCache[key] !== undefined) return esCache[key];
    esCache[key] = dayNum(a.start); // provisional value breaks cycles
    const preds = (Array.isArray(a.predecessors) ? a.predecessors : []).map(resolve).filter(Boolean);
    let out = dayNum(a.start);
    preds.forEach((p) => {
      if (isClosedActivity(p)) return;
      const pf = forecastFinishN(p);
      if (pf != null) out = Math.max(out, pf + 1);
    });
    esCache[key] = out;
    return out;
  }

  const brief = (p) => p ? {
    id: p.id, code: p.code != null ? p.code : null, desc: p.desc || "Untitled",
    companyId: p.companyId || null,
    plannedFinish: plannedFinishOf(p),
    forecastFinish: p.start ? iso(new Date(forecastFinishN(p) * DAY)) : null,
  } : null;

  const cache = {};
  const compute = (a) => {
    const base = {
      state: "clear", days: 0, underway: isUnderway(a),
      plannedStart: a && a.start ? String(a.start).slice(0, 10) : null,
      plannedFinish: plannedFinishOf(a),
      forecastStart: null, forecastFinish: null,
      driver: null, rootDriver: null, holdChain: [],
    };
    if (!a || !a.start) return { ...base, state: "undated" };
    if (isClosedActivity(a)) return { ...base, state: "closed" };

    const psN = dayNum(a.start);
    const pfN = dayNum(base.plannedFinish);
    const esN = earliestStartN(a);
    const feN = esN + durOf(a) - 1;
    base.forecastStart = iso(new Date(esN * DAY));
    base.forecastFinish = iso(new Date(feN * DAY));

    // Binding predecessor: the open one that finishes latest, since that is the one whose
    // movement moves this activity.
    const openPreds = openPredecessors(a, acts);
    let driver = null, driverFN = -Infinity;
    openPreds.forEach((p) => {
      const f = forecastFinishN(p);
      if (f != null && f > driverFN) { driverFN = f; driver = p; }
    });
    base.driver = brief(driver);

    // Root driver: climb the binding chain until an open predecessor is reached that is not
    // itself held. That is the activity the meeting must actually clear.
    if (driver) {
      const seen = {};
      let cur = driver;
      const chain = [];
      while (cur && !seen[String(cur.id)]) {
        seen[String(cur.id)] = 1;
        chain.push(cur.id);
        const up = openPredecessors(cur, acts);
        if (!up.length) break;
        let nxt = null, nxtF = -Infinity;
        up.forEach((p) => { const f = forecastFinishN(p); if (f != null && f > nxtF) { nxtF = f; nxt = p; } });
        if (!nxt || (cur.start && earliestStartN(cur) <= dayNum(cur.start))) break;
        cur = nxt;
      }
      base.holdChain = chain;
      base.rootDriver = brief(cur);
    }

    // Held only when a start is genuinely infeasible and work has not already begun.
    if (esN > psN && !base.underway && driver) {
      return { ...base, state: "held", days: esN - psN };
    }
    const lateStart = a.actualStart ? Math.max(0, dayNum(a.actualStart) - psN) : 0;
    const overdue = todayN && todayN > pfN ? todayN - pfN : 0;
    const d = Math.max(lateStart, overdue);
    if (d > 0) return { ...base, state: "late", days: d, lateKind: overdue >= lateStart ? "overdue" : "lateStart" };
    return base;
  };

  return {
    get(ref) {
      const a = (ref && typeof ref === "object") ? ref : resolve(ref);
      if (!a) return null;
      const key = String(a.id != null ? a.id : a.code);
      if (!cache[key]) cache[key] = compute(a);
      return cache[key];
    },
    all() {
      const out = {};
      acts.forEach((a) => { const k = String(a.id != null ? a.id : a.code); out[k] = this.get(a); });
      return out;
    },
  };
}

// Wording used by the digest, the drawer and any future surface, so the three never drift apart.
export function delayPhrase(info, fmtDate) {
  if (!info) return "";
  const f = fmtDate || ((s) => s);
  const dw = (n) => n + (n === 1 ? " day" : " days");
  if (info.state === "held") {
    const who = info.driver ? info.driver.desc : "an open predecessor";
    return "Held by " + who + "; can start " + f(info.forecastStart) + ", " + dw(info.days) + " adrift of plan, driven upstream.";
  }
  if (info.state === "late") {
    return info.lateKind === "lateStart"
      ? "Started " + dw(info.days) + " late against its planned start."
      : "Running " + dw(info.days) + " past its planned finish.";
  }
  return "";
}
