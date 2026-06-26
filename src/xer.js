// src/xer.js
// Minimal, dependency-free Primavera P6 XER parser for DLP baselines.
// Parses the tab-delimited %T/%F/%R structure and returns a compact baseline:
//   { meta, wbs, activities }
// Dates are normalised to "YYYY-MM-DD". Milestones are flagged.
// Read the file as an ArrayBuffer and decode windows-1252 before passing the text in
// (XER is cp1252, not UTF-8); see decodeXer() below.

export function decodeXer(arrayBuffer) {
  try {
    return new TextDecoder("windows-1252").decode(new Uint8Array(arrayBuffer));
  } catch (e) {
    // Fallback if the runtime lacks the windows-1252 label
    return new TextDecoder("utf-8").decode(new Uint8Array(arrayBuffer));
  }
}

function splitTables(text) {
  const T = {};
  let cur = null;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i].replace(/\r$/, "");
    if (!ln) continue;
    const tab = ln.indexOf("\t");
    const tag = tab === -1 ? ln : ln.slice(0, tab);
    const parts = ln.split("\t");
    if (tag === "%T") { cur = parts[1]; T[cur] = { f: [], r: [] }; }
    else if (tag === "%F" && cur) { T[cur].f = parts.slice(1); }
    else if (tag === "%R" && cur) { T[cur].r.push(parts.slice(1)); }
  }
  return T;
}

function asDicts(tbl) {
  if (!tbl) return [];
  const f = tbl.f;
  return tbl.r.map((row) => { const o = {}; for (let i = 0; i < f.length; i++) o[f[i]] = row[i] != null ? row[i] : ""; return o; });
}

const day = (s) => (s ? String(s).split(" ")[0] : "");

export function parseXER(text) {
  if (!text || text.indexOf("ERMHDR") !== 0) throw new Error("Not a valid XER file (missing ERMHDR header).");
  const T = splitTables(text);
  if (!T.TASK) throw new Error("No TASK table found in this XER.");

  const proj = asDicts(T.PROJECT)[0] || {};
  const wbsRows = asDicts(T.PROJWBS);
  const taskRows = asDicts(T.TASK);

  const wbs = {};
  wbsRows.forEach((w) => { wbs[w.wbs_id] = { name: w.wbs_name || "", parent: w.parent_wbs_id || "" }; });

  const activities = taskRows.map((t) => {
    const isMile = (t.task_type || "").indexOf("Mile") !== -1;
    const start = day(t.target_start_date) || day(t.early_start_date) || day(t.act_start_date);
    let end = day(t.target_end_date) || day(t.early_end_date) || day(t.act_end_date);
    if (isMile && !end) end = start;
    let tf = null;
    if (t.total_float_hr_cnt !== "" && t.total_float_hr_cnt != null) { const n = parseFloat(t.total_float_hr_cnt); if (!isNaN(n)) tf = Math.round((n / 8) * 10) / 10; }
    const crit = t.driving_path_flag === "Y" || (tf != null && tf <= 0);
    return { pid: t.task_id, code: t.task_code || "", name: t.task_name || "", wbs: t.wbs_id || "", ms: isMile, start: start, end: isMile ? end : (end || start), status: t.status_code || "", tf: tf, crit: crit };
  });

  const withDates = activities.filter((a) => a.start && a.end);
  const spanEnd = withDates.length ? withDates.map((a) => a.end).sort().slice(-1)[0] : "";
  const spanStart = withDates.length ? withDates.map((a) => a.start).sort()[0] : "";

  const meta = {
    project: proj.proj_short_name || "",
    dataDate: day(proj.last_recalc_date) || day(proj.apply_actuals_date) || "",
    planStart: day(proj.plan_start_date) || spanStart,
    planEnd: day(proj.scd_end_date) || day(proj.plan_end_date) || spanEnd,
    spanStart: spanStart,
    spanEnd: spanEnd,
    counts: { activities: activities.length, milestones: activities.filter((a) => a.ms).length, wbs: wbsRows.length, relationships: T.TASKPRED ? T.TASKPRED.r.length : 0 },
  };

  return { meta, wbs, activities };
}

// Resolve a WBS id to its name path (root -> leaf), using a parsed baseline's wbs map.
export function wbsPath(wbs, id, maxDepth) {
  const out = []; const seen = {}; let cur = id; let d = 0; const cap = maxDepth || 12;
  while (cur && wbs[cur] && !seen[cur] && d < cap) { seen[cur] = 1; out.push(wbs[cur].name); cur = wbs[cur].parent; d++; }
  return out.reverse();
}
