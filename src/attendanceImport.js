// REV326: Morning meeting attendance. Parses the Teams attendance export and
// aggregates participants into company presence via domain mapping. Two export
// shapes are handled: the post-meeting attendance report (sectioned key-value
// summary plus a participants table with emails) and the legacy in-meeting
// participant list (Full Name / User Action / Timestamp, no emails). Detection
// is structural, not textual, so localised headers (Finnish, Polish, and so on)
// parse identically to English ones. Pure module: no app state, no DOM, fully
// harnessed headless.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- decoding ----------
function td(label) { return new TextDecoder(label); }
export function decodeAttendanceBuffer(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (b.length >= 2 && b[0] === 0xFF && b[1] === 0xFE) return td("utf-16le").decode(b.subarray(2));
  if (b.length >= 2 && b[0] === 0xFE && b[1] === 0xFF) {
    try { return td("utf-16be").decode(b.subarray(2)); }
    catch (e) { const sw = new Uint8Array(b.length - 2); for (let i = 2; i + 1 < b.length; i += 2) { sw[i - 2] = b[i + 1]; sw[i - 1] = b[i]; } return td("utf-16le").decode(sw); }
  }
  if (b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return td("utf-8").decode(b.subarray(3));
  let nul = 0; const n = Math.min(b.length, 800);
  for (let i = 0; i < n; i++) if (b[i] === 0) nul++;
  if (nul > n / 8) return td("utf-16le").decode(b);
  return td("utf-8").decode(b);
}

// ---------- delimited text ----------
export function sniffDelimiter(text) {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim()).slice(0, 30);
  const count = (ch) => lines.reduce((s, l) => s + (l.split(ch).length - 1), 0);
  const t = count("\t"), c = count(","), sc = count(";");
  if (t >= c && t >= sc && t > 0) return "\t";
  if (sc > c && sc > 0) return ";";
  return c > 0 ? "," : "\t";
}

export function parseDelimited(text, delim) {
  const rows = []; let row = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = ""; rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c2) => String(c2).trim()));
}

// ---------- datetime and duration ----------
// Teams localises datetimes: "7/22/26, 7:05:12 AM", "22.7.2026 7.05.12",
// "22/07/2026, 07:05:12". Day-first vs month-first is decided once per file:
// any value whose first number exceeds 12 proves day-first; any whose second
// number exceeds 12 proves month-first; unresolved files default day-first
// (European locale, which this deployment runs in).
const DT_RE = /^(\d{1,4})[./-](\d{1,2})[./-](\d{2,4})[,\s]+(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?(?:\s*([AP])\.?M\.?)?$/i;
export function looksLikeDt(s) { return DT_RE.test(String(s || "").trim()); }

export function makeDtParser(samples) {
  let dayFirst = null;
  (samples || []).forEach((s) => {
    const m = DT_RE.exec(String(s || "").trim());
    if (!m) return;
    const a = +m[1], b = +m[2];
    if (a > 31) { dayFirst = false; return; }        // year-first (yyyy-mm-dd)
    if (a > 12 && a <= 31) dayFirst = (dayFirst == null) ? true : dayFirst;
    if (b > 12 && b <= 31) dayFirst = (dayFirst == null) ? false : dayFirst;
  });
  if (dayFirst == null) dayFirst = true;
  return (s) => {
    const m = DT_RE.exec(String(s || "").trim());
    if (!m) { const raw = String(s || "").trim(); if (!/\d{1,4}[./-]\d/.test(raw)) return null; const t = Date.parse(raw); return isNaN(t) ? null : new Date(t); }
    let d, mo, y;
    const a = +m[1], b = +m[2], c = +m[3];
    if (a > 31) { y = a; mo = b; d = c; }             // yyyy-mm-dd
    else if (dayFirst) { d = a; mo = b; y = c; }
    else { mo = a; d = b; y = c; }
    if (y < 100) y += 2000;
    let hh = +m[4]; const mm = +m[5], ss = +(m[6] || 0);
    const ap = (m[7] || "").toUpperCase();
    if (ap === "P" && hh < 12) hh += 12;
    if (ap === "A" && hh === 12) hh = 0;
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
    // Teams exports wall-clock local time. Interpret as Europe/Helsinki by
    // finding the UTC instant whose Helsinki rendering matches (DST-safe).
    return utcForHelsinkiWall(y, mo, d, hh, mm, ss);
  };
}

// Wall-clock Helsinki -> UTC Date, correct across DST, no external deps.
export function utcForHelsinkiWall(y, mo, d, hh, mm, ss) {
  let t = Date.UTC(y, mo - 1, d, hh, mm, ss || 0);
  for (let i = 0; i < 3; i++) {
    const p = helWall(new Date(t));
    const want = Date.UTC(y, mo - 1, d, hh, mm, ss || 0);
    const got = Date.UTC(p.y, p.mo - 1, p.d, p.hh, p.mm, p.ss);
    if (got === want) break;
    t += want - got;
  }
  return new Date(t);
}
function helWall(dt) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const g = {}; f.formatToParts(dt).forEach((p2) => { g[p2.type] = p2.value; });
  return { y: +g.year, mo: +g.month, d: +g.day, hh: +g.hour === 24 ? 0 : +g.hour, mm: +g.minute, ss: +g.second };
}
export function helDateOf(dt) {
  const p = helWall(dt);
  return p.y + "-" + String(p.mo).padStart(2, "0") + "-" + String(p.d).padStart(2, "0");
}
export function helTimeOf(iso) {
  if (!iso) return "";
  const p = helWall(new Date(iso));
  return String(p.hh).padStart(2, "0") + ":" + String(p.mm).padStart(2, "0");
}

const DUR_RE = /(\d+)\s*(h|hr|hrs|hour|hours|t)\b|(\d+)\s*(m|min|mins|minute|minutes)\b|(\d+)\s*(s|sec|secs|second|seconds)\b/gi;
export function parseDurMin(s) {
  const str = String(s || "").trim();
  if (!str) return null;
  const hm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(str);
  if (hm) return (+hm[1]) * 60 + (+hm[2]) + Math.round((+(hm[3] || 0)) / 60);
  let h = 0, m = 0, sec = 0, hit = false, mt;
  DUR_RE.lastIndex = 0;
  while ((mt = DUR_RE.exec(str))) {
    hit = true;
    if (mt[1] != null) h += +mt[1];
    else if (mt[3] != null) m += +mt[3];
    else if (mt[5] != null) sec += +mt[5];
  }
  if (!hit) return null;
  return h * 60 + m + Math.round(sec / 60);
}
export function looksLikeDur(s) { return parseDurMin(s) != null && !looksLikeDt(s); }

// ---------- structural parse ----------
function splitBlocks(rows) {
  const blocks = []; let cur = [];
  rows.forEach((r) => {
    const empty = r.every((c) => !c);
    if (empty) { if (cur.length) { blocks.push(cur); cur = []; } }
    else cur.push(r);
  });
  if (cur.length) blocks.push(cur);
  return blocks;
}

function colScores(dataRows, width) {
  const out = [];
  for (let ci = 0; ci < width; ci++) {
    let em = 0, dt = 0, du = 0, filled = 0;
    dataRows.forEach((r) => {
      const v = (r[ci] || "").trim();
      if (!v) return;
      filled++;
      if (EMAIL_RE.test(v)) em++;
      if (looksLikeDt(v)) dt++;
      else if (looksLikeDur(v)) du++;
    });
    const f = Math.max(1, filled);
    out.push({ email: em / f, dt: dt / f, dur: du / f, filled });
  }
  return out;
}

export function parseAttendanceText(text, filename) {
  const warnings = [];
  const delim = sniffDelimiter(text);
  const rows = parseDelimited(text, delim);   // empty rows are kept: they are the block separators
  const blocks = splitBlocks(rows);

  // classify blocks
  const kvRows = [];       // [label, value] pairs from summary-style blocks
  let bestTable = null, bestScore = -1;
  blocks.forEach((blk) => {
    const wide = blk.filter((r) => r.filter((c) => c).length >= 3);
    if (wide.length >= 2) {
      // candidate table: header row is the first wide row
      const hi = blk.indexOf(wide[0]);
      const width = Math.max(...blk.slice(hi).map((r) => r.length));
      const data = blk.slice(hi + 1).filter((r) => r.some((c) => c));
      if (!data.length) return;
      const sc = colScores(data, width);
      const emailCols = sc.filter((s) => s.email > 0.5).length;
      const dtCols = sc.filter((s) => s.dt > 0.5).length;
      const score = emailCols * 3 + dtCols + data.length / 1000;
      if ((emailCols || dtCols) && score > bestScore) { bestScore = score; bestTable = { header: blk[hi], data, sc, width }; }
    }
    blk.forEach((r) => {
      const nz = r.filter((c) => c);
      if (nz.length === 2 && !wide.includes(r)) kvRows.push([nz[0], nz[1]]);
    });
  });

  if (!bestTable) return { ok: false, warnings: ["No participant table found in the file. Is this a Teams attendance export?"] };

  const { data, sc, width } = bestTable;
  const dtParser = makeDtParser(
    data.flatMap((r) => r.filter((v) => looksLikeDt(v))).concat(kvRows.map((k) => k[1]).filter((v) => looksLikeDt(v)))
  );

  // column roles
  let emailCol = -1, best = 0.5;
  sc.forEach((s, i) => { if (s.email > best) { best = s.email; emailCol = i; } });
  const dtColIdx = []; sc.forEach((s, i) => { if (s.dt > 0.5) dtColIdx.push(i); });
  let durCol = -1; best = 0.5;
  sc.forEach((s, i) => { if (s.dur > best) { best = s.dur; durCol = i; } });
  let nameCol = 0;
  if (nameCol === emailCol || dtColIdx.includes(nameCol)) {
    for (let i = 0; i < width; i++) { if (i !== emailCol && !dtColIdx.includes(i) && i !== durCol) { nameCol = i; break; } }
  }

  const legacy = emailCol < 0 && dtColIdx.length === 1 && width <= 4;
  let participants = [];

  if (legacy) {
    // Full Name / User Action / Timestamp: aggregate joins and leaves per name.
    // The action column is whichever remaining column has few distinct values.
    let actionCol = -1;
    for (let i = 0; i < width; i++) {
      if (i === nameCol || dtColIdx.includes(i)) continue;
      const distinct = new Set(data.map((r) => (r[i] || "").toLowerCase()).filter(Boolean));
      if (distinct.size >= 1 && distinct.size <= 4) { actionCol = i; break; }
    }
    const tsCol = dtColIdx[0];
    const byName = {};
    data.forEach((r) => {
      const nm = r[nameCol]; if (!nm) return;
      const t = dtParser(r[tsCol]); if (!t) return;
      const rec = (byName[nm] = byName[nm] || { name: nm, email: "", first: null, last: null });
      if (!rec.first || t < rec.first) rec.first = t;
      if (!rec.last || t > rec.last) rec.last = t;
    });
    if (actionCol < 0) warnings.push("No join/leave action column recognised; durations are last-seen minus first-seen.");
    participants = Object.values(byName).map((r) => ({
      name: r.name, email: "",
      firstJoinISO: r.first ? r.first.toISOString() : null,
      lastLeaveISO: r.last ? r.last.toISOString() : null,
      durationMin: r.first && r.last ? Math.max(1, Math.round((r.last - r.first) / 60000)) : null,
    }));
    warnings.push("Legacy in-meeting list: no email addresses in this export, so company matching falls back to member names.");
  } else {
    const joinCol = dtColIdx[0] != null ? dtColIdx[0] : -1;
    const leaveCol = dtColIdx[1] != null ? dtColIdx[1] : -1;
    const seen = {};
    data.forEach((r) => {
      const name = r[nameCol] || "";
      const email = emailCol >= 0 ? (r[emailCol] || "").toLowerCase() : "";
      if (!name && !email) return;
      const fj = joinCol >= 0 ? dtParser(r[joinCol]) : null;
      const ll = leaveCol >= 0 ? dtParser(r[leaveCol]) : null;
      let dur = durCol >= 0 ? parseDurMin(r[durCol]) : null;
      if (dur == null && fj && ll) dur = Math.max(1, Math.round((ll - fj) / 60000));
      const key = email || name.toLowerCase();
      const rec = (seen[key] = seen[key] || { name, email, first: null, last: null, dur: 0, hasDur: false });
      if (!rec.name && name) rec.name = name;
      if (fj && (!rec.first || fj < rec.first)) rec.first = fj;
      if (ll && (!rec.last || ll > rec.last)) rec.last = ll;
      if (dur != null) { rec.dur += dur; rec.hasDur = true; }
    });
    participants = Object.values(seen).map((r) => ({
      name: r.name, email: r.email,
      firstJoinISO: r.first ? r.first.toISOString() : null,
      lastLeaveISO: r.last ? r.last.toISOString() : null,
      durationMin: r.hasDur ? r.dur : (r.first && r.last ? Math.max(1, Math.round((r.last - r.first) / 60000)) : null),
    }));
    if (emailCol < 0) warnings.push("No email column recognised; company matching falls back to member names.");
  }

  if (!participants.length) return { ok: false, warnings: ["The participant table parsed empty."] };

  // meeting meta from key-value rows; fall back to participant joins
  const kvDts = kvRows.filter((k) => looksLikeDt(k[1])).map((k) => dtParser(k[1])).filter(Boolean).sort((a, b) => a - b);
  const joins = participants.map((p) => p.firstJoinISO && new Date(p.firstJoinISO)).filter(Boolean).sort((a, b) => a - b);
  const leaves = participants.map((p) => p.lastLeaveISO && new Date(p.lastLeaveISO)).filter(Boolean).sort((a, b) => a - b);
  const start = kvDts[0] || joins[0] || null;
  const end = kvDts.length > 1 ? kvDts[kvDts.length - 1] : (leaves.length ? leaves[leaves.length - 1] : null);
  let durationMin = null;
  const kvDur = kvRows.map((k) => (looksLikeDt(k[1]) ? null : parseDurMin(k[1]))).filter((v) => v != null);
  if (kvDur.length) durationMin = kvDur[0];
  else if (start && end) durationMin = Math.max(1, Math.round((end - start) / 60000));

  let title = "";
  for (const [, v] of kvRows) {
    if (v && !looksLikeDt(v) && parseDurMin(v) == null && !/^\d+$/.test(v) && !EMAIL_RE.test(v)) { title = v; break; }
  }
  if (!title) title = String(filename || "").replace(/\.[a-z0-9]+$/i, "");

  return {
    ok: true,
    shape: legacy ? "legacy" : "report",
    meetingTitle: title,
    meetingStartISO: start ? start.toISOString() : null,
    meetingDate: start ? helDateOf(start) : null,
    durationMin,
    participants,
    warnings,
  };
}

export function parseAttendanceFile(buf, filename) {
  return parseAttendanceText(decodeAttendanceBuffer(buf), filename);
}

// ---------- company aggregation ----------
export function normName(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
export function emailDomain(email) {
  const at = String(email || "").lastIndexOf("@");
  return at < 0 ? "" : String(email).slice(at + 1).toLowerCase().replace(/\.$/, "");
}
export function domainMatches(dom, listed) {
  const a = String(dom || "").toLowerCase(), b2 = String(listed || "").toLowerCase();
  return !!a && !!b2 && (a === b2 || a.endsWith("." + b2));
}

const LATE_MIN = 5;

// parsed: { meetingTitle, meetingStartISO, meetingDate, durationMin, participants }
// companies: [{ name, domains: [] }]  (the invited list from the morning config)
// nameIndex: { normName -> companyName } for participants without an email
export function aggregateAttendance(parsed, companies, nameIndex) {
  const cos = (companies || []).filter((c) => c && c.name);
  const start = parsed.meetingStartISO ? new Date(parsed.meetingStartISO) : null;
  const byCo = {};
  cos.forEach((c) => { byCo[c.name] = { name: c.name, domains: (c.domains || []).filter(Boolean), count: 0, names: [], first: null }; });
  const unmatched = [];
  (parsed.participants || []).forEach((p) => {
    const dom = emailDomain(p.email);
    let hit = null;
    if (dom) hit = cos.find((c) => (c.domains || []).some((d) => domainMatches(dom, d)));
    if (!hit && nameIndex) {
      const coName = nameIndex[normName(p.name)];
      if (coName && byCo[coName]) hit = { name: coName };
    }
    const fj = p.firstJoinISO ? new Date(p.firstJoinISO) : null;
    if (hit) {
      const rec = byCo[hit.name];
      rec.count++;
      if (p.name) rec.names.push(p.name);
      if (fj && (!rec.first || fj < rec.first)) rec.first = fj;
    } else {
      unmatched.push({ name: p.name || p.email || "?", email: p.email || "", domain: dom, firstJoinISO: p.firstJoinISO || null, durationMin: p.durationMin });
    }
  });
  const rows = [], absent = [];
  cos.forEach((c) => {
    const rec = byCo[c.name];
    if (rec.count > 0) rows.push({
      name: rec.name, count: rec.count, names: rec.names,
      firstJoinISO: rec.first ? rec.first.toISOString() : null,
      late: !!(start && rec.first && (rec.first - start) > LATE_MIN * 60000),
    });
    else absent.push({ name: c.name, domains: rec.domains });
  });
  rows.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  absent.sort((a, b) => a.name.localeCompare(b.name));
  return {
    meetingTitle: parsed.meetingTitle || "",
    meetingStartISO: parsed.meetingStartISO || null,
    meetingDate: parsed.meetingDate || null,
    durationMin: parsed.durationMin == null ? null : parsed.durationMin,
    totals: { people: (parsed.participants || []).length, invited: cos.length, present: rows.length, absent: absent.length, unmatched: unmatched.length },
    rows, absent, unmatched,
  };
}

// Newest record whose meeting falls within the window before the send boundary.
// records: rows from morning_attendance (meeting_date, meeting_start). 26 hours
// covers a same-morning meeting plus yesterday's if today's upload is missing.
export function pickAttendanceFor(records, due, windowH) {
  const W = (windowH || 26) * 3600000;
  const dueT = due instanceof Date ? due.getTime() : new Date(due).getTime();
  let bestRec = null, bestT = -1;
  (records || []).forEach((r) => {
    let t = r.meeting_start ? new Date(r.meeting_start).getTime() : NaN;
    if (isNaN(t) && r.meeting_date) t = new Date(String(r.meeting_date) + "T09:00:00Z").getTime();
    if (isNaN(t)) return;
    if (t <= dueT && t >= dueT - W && t > bestT) { bestT = t; bestRec = r; }
  });
  return bestRec;
}
