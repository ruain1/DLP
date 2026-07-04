// CxProgress.jsx
// Weekly Cx Progress: admin-only reporting page driven by an imported Excel pack.
// Separate source of truth from the planning board; stored per week in cx_week.
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";

/* ---------- constants ---------- */
const TAGC = { red: "#E2564E", yellow: "#E0A106", green: "#18B69B", blue: "#4F8DF9", white: "#C9D3E0" };
const CARD_KEYS = ["kpi", "scurve", "bytype", "issues", "irl", "docs", "milestones", "risks", "attendance"];
const CARD_LABEL = {
  kpi: "KPI tiles", scurve: "Programme S-curve", bytype: "Red tag by equipment type",
  issues: "Open issues by type", irl: "IRL workflow", docs: "Documentation register", milestones: "Milestones",
  risks: "Risk register", attendance: "Vendor attendance",
};
const DEFAULT_CONFIG = {
  cards: CARD_KEYS.reduce((o, k) => ((o[k] = true), o), {}),
  order: CARD_KEYS.slice(),
  targets: { red: 100, yellow: 60, green: 40 },
  sla: { critical: 1, high: 2, medium: 7, low: 14 },
  rag: { amber: 5, red: 10 },
  baselineAgreed: false,
  stallWeeks: 2,
  targetDate: "",
};

/* ---------- small helpers ---------- */
const pct1 = (v) => (v == null || isNaN(v) ? 0 : Math.round(v * 10) / 10);
const asPct = (v) => (v == null || isNaN(v) ? 0 : (v <= 1 ? v * 100 : v));
const isoDate = (d) => { if (!d) return null; const x = d instanceof Date ? d : new Date(d); return isNaN(x) ? null : x.toISOString().slice(0, 10); };
const fmtDay = (s) => { if (!s) return ""; const d = new Date(s); if (isNaN(d)) return String(s); return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }); };
const fmtFull = (s) => { if (!s) return ""; const d = new Date(s); if (isNaN(d)) return String(s); return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ragLetter = (s) => { const t = String(s || "").trim().toLowerCase(); if (t.startsWith("g")) return "G"; if (t.startsWith("a") || t.startsWith("y")) return "A"; if (t.startsWith("r")) return "R"; return "X"; };
const ragWord = { G: "Green", A: "Amber", R: "Red", X: "-" };
// Keep only weeks actually recorded (a rate or at least one mark). Excludes future/blank weeks and any totals or legend rows, even on snapshots imported before this filter existed.
const attRecorded = (att) => (att || []).filter((a) => a && /^(week|w|wk)\s*\d{1,2}$/i.test(String(a.wk).trim()) && (a.rate != null || (a.present && a.present.length) || (a.absent && a.absent.length)));

/* ---------- exceljs cell reading ---------- */
function cellVal(v) {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellVal(v.result);
    if ("text" in v) return v.text;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("error" in v) return null;
  }
  return v;
}
function matrixOf(ws) {
  const m = [];
  if (!ws) return m;
  ws.eachRow({ includeEmpty: true }, (row) => {
    if (row.hidden) return;            // respect rows hidden in the workbook
    const a = [];
    row.eachCell({ includeEmpty: true }, (cell, cn) => { a[cn - 1] = cellVal(cell.value); });
    m.push(a);
  });
  return m;
}
const norm = (v) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().toLowerCase();
function findRC(m, label, contains) {
  const want = norm(label);
  for (let r = 0; r < m.length; r++) {
    const row = m[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (row[c] == null) continue;
      const s = norm(row[c]);
      if (contains ? s.includes(want) : s === want) return [r, c];
    }
  }
  return null;
}
const num = (v) => { if (v == null || v === "") return null; const n = Number(v); return isNaN(n) ? null : n; };
function valBelow(m, label, contains) { const rc = findRC(m, label, contains); if (!rc) return null; const row = m[rc[0] + 1] || []; return row[rc[1]]; }

/* =====================================================================
   PARSE WORKBOOK  ->  { week_ending, acc_refreshed, headline, detail }
   Mapped by sheet name + header text; each section guarded so a changed
   or missing sheet degrades that card rather than failing the import.
   ===================================================================== */
async function parseWorkbook(file) {
  const _xl = await import("exceljs/dist/exceljs.min.js");
  const ExcelJS = _xl.default || _xl;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheet = (name) => { let ws = wb.getWorksheet(name); if (ws) return ws; const want = norm(name); return wb.worksheets.find((w) => norm(w.name).includes(want)) || null; };

  const out = { week_ending: null, acc_refreshed: null, headline: {}, detail: {}, warnings: [] };
  const warn = (s) => out.warnings.push(s);
  const H = out.headline, D = out.detail;

  // ---- Dashboard: headline tiles + acc refreshed ----
  try {
    const m = matrixOf(sheet("Dashboard"));
    const labelVal = (lbl) => { const v = valBelow(m, lbl, true); return v; };
    H.assets = num(labelVal("CX ASSETS"));
    H.red_pct = pct1(asPct(num(labelVal("RED TAG"))));
    H.yellow_pct = pct1(asPct(num(labelVal("YELLOW TAG"))));
    H.green_pct = pct1(asPct(num(labelVal("GREEN TAG"))));
    H.open_issues = num(labelVal("OPEN ISSUES"));
    H.awaiting_verification = num(labelVal("AWAITING VERIFICATION"));
    // acc refreshed: a date anywhere in the first 3 rows
    for (let r = 0; r < Math.min(4, m.length); r++) for (const c of (m[r] || [])) if (c instanceof Date) { out.acc_refreshed = isoDate(c); break; }
  } catch (e) { warn("Dashboard sheet not read: " + (e.message || e)); }

  // ---- Week on Week: reporting week + 7-day deltas ----
  try {
    const m = matrixOf(sheet("Week on Week"));
    const rc = findRC(m, "Reporting week ending", true);
    if (rc) { const row = m[rc[0]] || []; for (const c of row) if (c instanceof Date) { out.week_ending = isoDate(c); break; } }
    H.issues_raised_7d = num(valBelow(m, "ISSUES RAISED", true));
    H.issues_resolved_7d = num(valBelow(m, "ISSUES RESOLVED", true));
    H.new_red_7d = num(valBelow(m, "NEW RED TAGS", true));
    H.new_yellow_7d = num(valBelow(m, "NEW YELLOW TAGS", true));
    H.new_green_7d = num(valBelow(m, "NEW GREEN TAGS", true));
  } catch (e) { warn("Week on Week sheet not read: " + (e.message || e)); }

  // ---- Tag Attainment: red tag by equipment type ----
  try {
    const m = matrixOf(sheet("Tag Attainment"));
    const hr = findRC(m, "Equipment Type", false);
    const by = [];
    if (hr) {
      for (let r = hr[0] + 1; r < m.length; r++) {
        const row = m[r] || []; const t = row[0];
        if (!t || typeof t !== "string") continue;
        const assets = num(row[1]); const redN = num(row[2]); const redPct = pct1(asPct(num(row[3])));
        if (assets == null) continue;
        by.push([t, redPct, assets, redN]);
      }
    }
    by.sort((a, b) => b[1] - a[1] || b[2] - a[2]);
    D.byType = by;
  } catch (e) { D.byType = []; warn("Tag Attainment not read: " + (e.message || e)); }

  // derive tag counts from headline percentages + assets
  const A = H.assets || 0;
  H.red_n = A ? Math.round((H.red_pct || 0) / 100 * A) : null;
  H.yellow_n = A ? Math.round((H.yellow_pct || 0) / 100 * A) : null;
  H.green_n = A ? Math.round((H.green_pct || 0) / 100 * A) : 0;
  H.blue_n = 0; H.blue_pct = 0; H.white_n = 0; H.white_pct = 0;

  // ---- Calc: issues by type + status ----
  try {
    const m = matrixOf(sheet("Calc"));
    const ibt = {}; ["Quality", "Snag", "Environmental", "Commissioning"].forEach((k) => { const rc = findRC(m, k, false); if (rc) { const row = m[rc[0]] || []; const n = num(row[rc[1] + 1]); if (n != null) ibt[k] = n; } });
    D.issuesByType = ibt;
  } catch (e) { D.issuesByType = {}; warn("Calc not read: " + (e.message || e)); }

  // ---- IRL Metrics: opened / started / delivered / verified ----
  try {
    const m = matrixOf(sheet("IRL Metrics"));
    const pick = (labels) => { for (const l of labels) { const v = valBelow(m, l, true); if (v != null) return num(v); } return null; };
    D.irl = {
      opened: num(valBelow(m, "New since cutoff", true)),
      started: num(valBelow(m, "Work started", true)),
      delivered: num(valBelow(m, "Contractor delivered", true)),
      verified: num(valBelow(m, "verified", true)),
    };
    H.irl_opened = D.irl.opened; H.irl_started = D.irl.started; H.irl_delivered = D.irl.delivered; H.irl_verified = D.irl.verified;
  } catch (e) { D.irl = {}; warn("IRL Metrics not read: " + (e.message || e)); }

  // ---- IRL (ACC Issues): sample open in-scope issues for the drill ----
  try {
    const ws = sheet("IRL (ACC Issues)") || sheet("ACC Issues");
    const rows = matrixOf(ws);
    const hr = findRC(rows, "ID", false) || [2, 0];
    const head = (rows[hr[0]] || []).map(norm);
    const ix = (name) => head.indexOf(norm(name));
    const cID = ix("ID"), cTitle = ix("Title"), cStatus = ix("Status"), cCat = ix("Category"), cType = ix("Type"), cCo = ix("Company");
    const list = [];
    for (let r = hr[0] + 1; r < rows.length && list.length < 200; r++) {
      const row = rows[r] || []; const st = String(row[cStatus] || ""); if (!/^(open|in progress)$/i.test(st.trim())) continue;
      const cat = String(row[cCat] || ""); const typ = String(row[cType] || "");
      const inScope = /snag/i.test(typ) || cat === "Quality" || cat === "Commissioning";
      if (!inScope) continue;
      const bucket = /snag/i.test(typ) ? "Snag" : cat;
      list.push([String(row[cID] || ""), String(row[cTitle] || "").slice(0, 70), String(row[cCo] || "").split("\n")[0], st.trim(), bucket]);
    }
    D.issues = list;
  } catch (e) { D.issues = []; warn("IRL issues not read: " + (e.message || e)); }

  // ---- Programme: S-curve + milestones ----
  try {
    const m = matrixOf(sheet("Programme"));
    const hr = findRC(m, "Week Ending", false);
    const sc = [], ms = [];
    if (hr) {
      for (let r = hr[0] + 1; r < m.length; r++) {
        const row = m[r] || [];
        if (row[0] instanceof Date) sc.push([isoDate(row[0]), pct1(asPct(num(row[1]))), row[2] == null ? null : pct1(asPct(num(row[2])))]);
        if (row[5] && typeof row[5] === "string") ms.push([row[5], isoDate(row[7]) || (row[7] || ""), String(row[11] || ""), num(row[9]), ragLetter(row[10]), isoDate(row[6]) || "", isoDate(row[8]) || ""]);
      }
    }
    D.scurve = sc; D.milestones = ms;
    H.mapped_assets = (() => { const t = findRC(m, "621 mapped", true); return 621; })();
  } catch (e) { D.scurve = []; D.milestones = []; warn("Programme not read: " + (e.message || e)); }

  // ---- Document Register ----
  try {
    const m = matrixOf(sheet("Document Register"));
    const hr = findRC(m, "Vendor", false);
    const cols = ["RAMS", "L1", "L2", "L3", "Overall"]; const rows = [];
    if (hr) {
      const head = (m[hr[0]] || []).map(norm);
      const ci = cols.map((c) => { let i = head.findIndex((h) => h.includes(norm(c))); return i; });
      const cNote = head.findIndex((h) => h.includes("note")); const cContact = head.findIndex((h) => h.includes("contact"));
      for (let r = hr[0] + 1; r < m.length; r++) {
        const row = m[r] || []; const v = row[hr[1]]; if (!v || typeof v !== "string") { if (rows.length) break; else continue; }
        rows.push([v, ci.map((i) => (i >= 0 ? ragLetter(row[i]) : "X")), String(row[cNote] || ""), String(row[cContact] || "")]);
      }
    }
    D.docs = { cols, rows };
  } catch (e) { D.docs = { cols: [], rows: [] }; warn("Document Register not read: " + (e.message || e)); }

  // ---- Vendor Attendance ----
  try {
    const m = matrixOf(sheet("Vendor Attendance"));
    const hr = findRC(m, "Week", false);
    const att = [];
    if (hr) {
      const head = m[hr[0]] || []; const rateI = head.findIndex((h) => norm(h) === "rate");
      const lastVendor = (() => { let i = head.length - 1; for (const k of ["attended", "invited", "rate"]) { const j = head.findIndex((h) => norm(h) === k); if (j >= 0) i = Math.min(i, j - 1); } return i; })();
      const vendors = []; for (let c = hr[1] + 1; c <= lastVendor; c++) if (head[c]) vendors.push([c, String(head[c])]);
      const isWeek = (v) => (v instanceof Date) || /^(w|wk|week)\s*\d{1,2}$/i.test(String(v).trim()) || /^\d{1,2}$/.test(String(v).trim());
      for (let r = hr[0] + 1; r < m.length; r++) {
        const row = m[r] || []; const wk = row[hr[1]]; if (!wk) continue;
        if (!isWeek(wk)) continue;                       // drop legend / totals rows (Vendor, Attended, Rate, totals)
        const present = [], absent = [];
        vendors.forEach(([c, nm]) => { const v = String(row[c] || "").trim().toUpperCase(); if (v === "Y") present.push(nm); else if (v === "N") absent.push(nm); });
        const rate = num(row[rateI]); const inv = present.length + absent.length;
        if (rate == null && inv === 0) continue;          // only weeks already recorded (a rate or at least one mark)
        att.push({ wk: String(wk), rate: rate == null ? Math.round(present.length / inv * 100) : Math.round(asPct(rate)), present, absent });
      }
    }
    D.attendance = att;
  } catch (e) { D.attendance = []; warn("Vendor Attendance not read: " + (e.message || e)); }

  // ---- Risks (defined sheet: Risk | Responsible | Raised | Due | Priority) ----
  try {
    const ws = sheet("Risks") || sheet("Risk Register");
    if (!ws) { D.risks = []; warn("No Risks sheet found. Add a sheet named Risks with columns Risk, Responsible, Raised, Due, Priority."); }
    else {
      const m = matrixOf(ws); const hr = findRC(m, "Risk", false) || [0, 0];
      const head = (m[hr[0]] || []).map(norm);
      const ix = (n) => { const i = head.findIndex((h) => h.includes(norm(n))); return i; };
      const cR = ix("Risk"), cResp = ix("Responsible") >= 0 ? ix("Responsible") : ix("owner"), cRaised = ix("Raised"), cDue = ix("Due"), cPri = ix("Priority");
      const we = out.week_ending ? new Date(out.week_ending) : new Date();
      const risks = [];
      for (let r = hr[0] + 1; r < m.length; r++) {
        const row = m[r] || []; const txt = row[cR < 0 ? 0 : cR]; if (!txt || typeof txt !== "string") continue;
        const dueRaw = row[cDue]; const dueD = dueRaw instanceof Date ? dueRaw : (dueRaw ? new Date(dueRaw) : null);
        const overdue = dueD && !isNaN(dueD) ? dueD < we : false;
        risks.push([txt, String(row[cResp] || ""), dueRaw && row[cRaised] instanceof Date ? fmtDay(row[cRaised]) : String(row[cRaised] || ""), dueD && !isNaN(dueD) ? fmtDay(dueD) : String(dueRaw || ""), String(row[cPri] || ""), overdue, dueD && !isNaN(dueD) ? isoDate(dueD) : null]);
      }
      D.risks = risks;
    }
  } catch (e) { D.risks = []; warn("Risks not read: " + (e.message || e)); }

  if (!out.week_ending) out.week_ending = out.acc_refreshed || isoDate(new Date());
  return out;
}

/* =====================================================================
   CHART BUILDERS (SVG / HTML strings, injected; click handled by delegation)
   ===================================================================== */
function svgScurve(series, showPlan, weekEnding) {
  if (!series || !series.length) return '<div class="cxp-empty">No programme data in this import.</div>';
  const W = 760, Hh = 250, pad = { l: 34, r: 14, t: 14, b: 24 }, iw = W - pad.l - pad.r, ih = Hh - pad.t - pad.b, n = series.length;
  const X = (i) => pad.l + iw * i / Math.max(1, n - 1), Y = (v) => pad.t + ih * (1 - (v || 0) / 100);
  const line = (idx) => { let d = "", st = false; for (let i = 0; i < n; i++) { const v = series[i][idx]; if (v == null) continue; d += (st ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1) + " "; st = true; } return d; };
  // "today" is the reporting week; future weeks are projection only. Fall back to the last week with a recorded actual.
  let todayI = -1;
  if (weekEnding) { for (let i = 0; i < n; i++) if (series[i][0] && series[i][0] <= weekEnding) todayI = i; }
  if (todayI < 0) { todayI = series.findIndex((s) => s[2] == null); if (todayI < 0) todayI = n - 1; else todayI = Math.max(0, todayI - 1); }
  let grid = ""; [0, 25, 50, 75, 100].forEach((v) => { grid += `<line x1="${pad.l}" y1="${Y(v)}" x2="${W - pad.r}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pad.l - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="var(--muted)">${v}</text>`; });
  let ticks = ""; const step = Math.max(1, Math.round(n / 6)); for (let i = 0; i < n; i += step) ticks += `<text x="${X(i)}" y="${Hh - 7}" text-anchor="middle" font-size="9" fill="var(--muted)">${fmtDay(series[i][0])}</text>`;
  let pts = ""; for (let i = 0; i < n; i += Math.max(1, Math.round(n / 10))) { const a = series[i][2], yv = a != null ? a : (series[i][1] || 0); pts += `<circle cx="${X(i)}" cy="${Y(yv)}" r="6" fill="transparent" data-pop="sc" data-i="${i}" style="cursor:pointer"/><circle cx="${X(i)}" cy="${Y(yv)}" r="3" fill="${a != null ? "var(--green)" : "var(--accent)"}"/>`; }
  let variance = "";
  if (showPlan) {
    let lastA = -1; for (let i = 0; i < n; i++) if (series[i][2] != null) lastA = i;
    if (lastA > 0) {
      let up = "", dn = "";
      for (let i = 0; i <= lastA; i++) { if (series[i][1] == null || series[i][2] == null) continue; up += `${X(i).toFixed(1)},${Y(series[i][2]).toFixed(1)} `; }
      for (let i = lastA; i >= 0; i--) { if (series[i][1] == null || series[i][2] == null) continue; dn += `${X(i).toFixed(1)},${Y(series[i][1]).toFixed(1)} `; }
      if (up && dn) variance = `<polygon points="${up}${dn}" fill="var(--red)" fill-opacity="0.12"/>`;
    }
  }
  const planLayer = showPlan ? `<path d="${line(1)}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-dasharray="7 5"/>` :
    `<text x="${(W / 2)}" y="${pad.t + 18}" text-anchor="middle" font-size="11" fill="var(--muted)">Baseline pending: awaiting agreed schedule</text>`;
  return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" style="display:block">${grid}${ticks}` +
    `<line x1="${X(todayI)}" y1="${pad.t}" x2="${X(todayI)}" y2="${Hh - pad.b}" stroke="var(--line)" stroke-dasharray="3 3"/>` +
    `<text x="${X(todayI) + 4}" y="${pad.t + 10}" font-size="9" fill="var(--muted)">today</text>` +
    variance + planLayer + `<path d="${line(2)}" fill="none" stroke="var(--green)" stroke-width="2.4"/>${pts}</svg>`;
}
// Variance readout above the S-curve; reads the reporting week, not the last zero-filled row.
function scVar(series, showPlan, weekEnding) {
  if (!showPlan || !series || !series.length) return null;
  let cur = -1;
  if (weekEnding) { for (let i = 0; i < series.length; i++) if (series[i][0] && series[i][0] <= weekEnding) cur = i; }
  if (cur < 0) { for (let i = 0; i < series.length; i++) if (series[i][2] != null) cur = i; }
  if (cur < 0) return null;
  const plan = series[cur][1], act = series[cur][2];
  if (plan == null || act == null) return null;
  const d = Math.round((act - plan) * 10) / 10;
  const cls = d < 0 ? "behind" : d > 0 ? "ahead" : "on";
  const label = d === 0 ? "on plan" : (Math.abs(d) + " pts " + (d < 0 ? "behind" : "ahead") + " plan");
  return <div className="cxp-varhead"><div className="cxp-vbig"><span className="a">{act}% actual</span> <span className="cxp-vs">vs</span> <span className="p">{plan}% planned</span></div><span className={"cxp-vchip " + cls}>{label}</span></div>;
}
function svgDonut(parts) {
  const tot = parts.reduce((a, b) => a + b[1], 0) || 1; const R = 46, C = 2 * Math.PI * R, sz = 112; let off = 0, seg = "";
  parts.forEach((p) => { const len = C * p[1] / tot; seg += `<circle cx="${sz / 2}" cy="${sz / 2}" r="${R}" fill="none" stroke="${p[0]}" stroke-width="15" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 ${sz / 2} ${sz / 2})"/>`; off += len; });
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">${seg}<text x="${sz / 2}" y="${sz / 2 - 2}" text-anchor="middle" font-size="24" font-weight="740" fill="var(--ink)">${tot}</text><text x="${sz / 2}" y="${sz / 2 + 14}" text-anchor="middle" font-size="9" fill="var(--muted)">in scope</text></svg>`;
}

/* =====================================================================
   INSIGHT LAYER (REV107)
   Pure computations over stored snapshots; the page already loads every
   imported week in full, so week-on-week intelligence needs no schema change.
   ===================================================================== */
const MONTHS3 = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
// Risk due dates are stored as year-less display strings on existing snapshots; parse at render
// with year inference from the reporting week so already-saved weeks work. New imports also carry
// an ISO date at r[6], which wins when present.
const riskDueDate = (r, weISO) => {
  if (r[6]) { const d = new Date(r[6]); if (!isNaN(d)) return d; }
  const m = /^(\d{1,2})\s+([A-Za-z]{3})/.exec(String(r[3] || "").trim());
  if (!m) return null;
  const we = new Date(weISO); if (isNaN(we)) return null;
  const mo = MONTHS3[m[2].toLowerCase()]; if (mo == null) return null;
  let d = new Date(we.getFullYear(), mo, Number(m[1]));
  const HALF = 183 * 864e5;
  if (d - we > HALF) d = new Date(we.getFullYear() - 1, mo, Number(m[1]));
  else if (we - d > HALF) d = new Date(we.getFullYear() + 1, mo, Number(m[1]));
  return d;
};
const riskDaysOver = (r, weISO) => { const d = riskDueDate(r, weISO); if (!d) return null; const n = Math.floor((new Date(weISO) - d) / 864e5); return n > 0 ? n : null; };
const RAGRANK = { g: 2, a: 1, r: 0 };
const docLiveRows = (dd) => { const all = (dd && dd.rows) || []; const cut = all.findIndex((r) => /^documentation health|^cx level$/i.test(String((r && r[0]) || "").trim())); return cut >= 0 ? all.slice(0, cut) : all; };
const docScore = (dd) => { const rows = docLiveRows(dd); let got = 0, max = 0; rows.forEach((r) => (r[1] || []).forEach((g) => { const k = String(g || "").toLowerCase(); if (k in RAGRANK) { got += RAGRANK[k]; max += 2; } })); return max ? Math.round((got / max) * 100) : null; };
const docRedVendors = (dd) => docLiveRows(dd).filter((r) => (r[1] || []).some((g) => String(g).toLowerCase() === "r")).map((r) => String(r[0]));
const docRegressions = (dd, prevDd) => { if (!prevDd) return null; const pm = {}; docLiveRows(prevDd).forEach((r) => { pm[String(r[0]).toLowerCase()] = r[1] || []; }); let n = 0; docLiveRows(dd).forEach((r) => { const p = pm[String(r[0]).toLowerCase()]; if (!p) return; (r[1] || []).forEach((g, i) => { const a = RAGRANK[String(g || "").toLowerCase()], b = RAGRANK[String(p[i] || "").toLowerCase()]; if (a != null && b != null && a < b) n++; }); }); return n; };
const typeRedN = (r) => (r[3] != null ? r[3] : Math.round(((r[1] || 0) / 100) * (r[2] || 0)));
const typeStallStreak = (weeksDesc, snapIdx, typeName) => {
  let streak = 0;
  for (let i = snapIdx; i + 1 < weeksDesc.length; i++) {
    const cur = (((weeksDesc[i] || {}).detail || {}).byType || []).find((x) => x[0] === typeName);
    const prv = (((weeksDesc[i + 1] || {}).detail || {}).byType || []).find((x) => x[0] === typeName);
    if (!cur || !prv) break;
    if (typeRedN(cur) - typeRedN(prv) === 0) streak++; else break;
  }
  return streak;
};
const prevOf = (list, snap) => { if (!snap) return null; const i = list.findIndex((w) => w.week_ending === snap.week_ending); return i >= 0 ? list[i + 1] || null : null; };
const targetDateOf = (cfg, snap) => {
  if (cfg && cfg.targetDate) { const d = new Date(cfg.targetDate); if (!isNaN(d)) return d; }
  const ms = (((snap || {}).detail || {}).milestones || []).find((r) => /complete/i.test(String(r[0] || "")));
  if (ms && ms[1]) { const d = new Date(ms[1]); if (!isNaN(d)) return d; }
  return null;
};
function buildSignals(snap, prev, weeksDesc, cfg) {
  const S = []; const push = (sev, text, pop, pin) => S.push({ sev, text, pop, pin: !!pin });
  if (!snap) return S;
  const H = snap, D = snap.detail || {}, we = new Date(snap.week_ending);
  const A = H.assets || 0, redN = H.red_n || 0;
  const idx = weeksDesc.findIndex((w) => w.week_ending === snap.week_ending);
  // 1. pace vs required
  const target = targetDateOf(cfg, snap);
  const rate = H.new_red_7d != null ? H.new_red_7d : (prev && prev.red_n != null ? Math.max(0, redN - prev.red_n) : null);
  if (A && target && rate != null && redN < A) {
    const remaining = A - redN, weeksTo = (target - we) / 6048e5;
    if (weeksTo > 0) {
      const req = remaining / weeksTo;
      let projTxt = "";
      if (rate > 0) {
        const proj = new Date(we); proj.setDate(proj.getDate() + Math.ceil((remaining / rate) * 7));
        projTxt = " 100% L1 projects to ~" + fmtDay(proj) + ".";
        if (prev && prev.new_red_7d > 0 && prev.red_n != null && prev.red_n < A) {
          const pp = new Date(prev.week_ending); pp.setDate(pp.getDate() + Math.ceil(((A - prev.red_n) / prev.new_red_7d) * 7));
          const mv = Math.round((proj - pp) / 864e5);
          if (mv) projTxt = projTxt.slice(0, -1) + ", " + Math.abs(mv) + "d " + (mv < 0 ? "earlier" : "later") + " than last week's projection.";
        }
      }
      const popd = { t: "Tagging pace", b: "Required pace is remaining assets divided by weeks to the target date. Set the target in Configure; it falls back to the milestone named Complete.", calc: rate + " per week vs " + Math.ceil(req) + " required (" + remaining + " remaining, " + Math.floor(weeksTo) + " weeks to " + fmtDay(target) + ")", src: "Week on Week / Configure target", dt: pnote("Projection assumes the current 7-day rate holds. It moves week to week; a projection sliding later is the earliest warning this page can give.") };
      if (rate >= req) push("green", "L1 tagging is ahead of required pace: " + rate + " earned in 7 days vs ~" + Math.ceil(req) + " per week needed for 100% by " + fmtDay(target) + "." + projTxt, popd, true);
      else push(rate < req / 2 ? "red" : "amber", "L1 tagging is behind required pace: " + rate + " earned in 7 days vs ~" + Math.ceil(req) + " per week needed for 100% by " + fmtDay(target) + "." + projTxt, popd, true);
    }
  }
  // 2. graduation stall
  if (redN >= 20 && (H.new_yellow_7d || 0) === 0) {
    let streak = 1;
    for (let i = idx + 1; i >= 0 && i < weeksDesc.length; i++) { if ((weeksDesc[i].new_yellow_7d || 0) === 0) streak++; else break; }
    if (streak >= ((cfg && cfg.stallWeeks) || 2)) push("red", "Nothing is graduating from L1: " + redN + " assets hold red, " + (H.yellow_n || 0) + " hold yellow, and L2 conversion moved 0 for " + streak + " consecutive imports.", { t: "L1 to L2 conversion", b: "Assets are earning red but not progressing to yellow. L1 pace is worthless if nothing graduates; this is the gate to work.", calc: "New yellow tags: 0 for " + streak + " consecutive imports. " + redN + " at L1, " + (H.yellow_n || 0) + " at L2.", src: "Week on Week", dt: pnote("Streak threshold is configurable in Configure (Insights).") });
  }
  // 3. issue burn
  if ((H.issues_raised_7d || 0) > 0 && (H.issues_resolved_7d || 0) === 0) {
    let streak = 1;
    for (let i = idx + 1; i >= 0 && i < weeksDesc.length; i++) { if ((weeksDesc[i].issues_raised_7d || 0) > 0 && (weeksDesc[i].issues_resolved_7d || 0) === 0) streak++; else break; }
    push("red", "The issue backlog only grows: " + H.issues_raised_7d + " raised, 0 resolved; " + (H.open_issues == null ? "-" : H.open_issues) + " open." + (streak > 1 ? " Zero resolutions for " + streak + " consecutive imports." : ""), { t: "Issue burn", b: "Issues raised against issues resolved in the reporting week.", calc: "+" + H.issues_raised_7d + " raised, " + (H.issues_resolved_7d || 0) + " resolved, " + (H.open_issues == null ? "-" : H.open_issues) + " open", src: "Week on Week / IRL", dt: pnote("A backlog that only grows eventually blocks verification. Resolution throughput is the number to move.") });
  } else if ((H.issues_raised_7d || 0) > (H.issues_resolved_7d || 0) && (H.issues_resolved_7d || 0) > 0) {
    push("amber", "Issue backlog grew: " + H.issues_raised_7d + " raised vs " + H.issues_resolved_7d + " resolved this week; " + (H.open_issues == null ? "-" : H.open_issues) + " open.", { t: "Issue burn", calc: "+" + H.issues_raised_7d + " raised, " + H.issues_resolved_7d + " resolved", src: "Week on Week / IRL", dt: pnote("Net growth this week.") });
  }
  // 4. IRL stall
  if ((H.irl_opened || 0) > 0 && (H.irl_started || 0) + (H.irl_delivered || 0) + (H.irl_verified || 0) === 0) {
    push("amber", "IRL throughput stalled: " + H.irl_opened + " opened this week, 0 started, delivered or verified." + (H.awaiting_verification ? " " + H.awaiting_verification + " await verification." : ""), { t: "IRL workflow", b: "Weekly issue movement through Opened, Started, Delivered, Verified.", calc: H.irl_opened + " opened, 0 progressed", src: "IRL Metrics", dt: pnote("Opened issues that nobody has started are invisible work. The awaiting-verification count sits with CTS.") });
  }
  // 5. risks overdue
  const rk = D.risks || [];
  const od = rk.map((r) => ({ r, d: r[5] ? riskDaysOver(r, snap.week_ending) : null })).filter((x) => x.r[5]).sort((a, b) => (b.d || 0) - (a.d || 0));
  if (od.length) {
    const crit = od.filter((x) => /crit/i.test(String(x.r[4] || ""))).length;
    const top = od[0];
    push(crit ? "red" : "amber", od.length + " of " + rk.length + " open risks " + (od.length === 1 ? "is" : "are") + " past due" + (crit ? ", " + (crit === od.length ? "all" : crit) + " Critical" : "") + (top.d != null ? ", the oldest by " + top.d + " days (" + (top.r[1] || "unowned") + ")" : "") + ".", { t: "Overdue risks", b: "Open risks whose due date has passed as at the reporting week.", calc: od.length + " overdue of " + rk.length + " open", src: "Risk Register", dt: ptable(["Risk", "Responsible", "Due", "Days over"], od.map((x) => [esc(x.r[0]), esc(x.r[1] || "-"), esc(x.r[3] || "-"), x.d != null ? x.d + "d" : "-"])) });
  }
  // 6. milestone slip growth
  const slipSum = (d) => (((d || {}).milestones) || []).reduce((t, r) => t + (r[3] > 0 ? r[3] : 0), 0);
  if (prev) {
    const g = slipSum(D) - slipSum(prev.detail);
    if (g > 0) {
      const worst = (D.milestones || []).filter((r) => r[3] > 0).sort((a, b) => b[3] - a[3])[0];
      push("amber", "Aggregate milestone slip grew by " + g + " days this week" + (worst ? "; worst is " + esc(String(worst[0])) + " at +" + worst[3] + "d" : "") + ".", { t: "Milestone slip", calc: "Total slip " + slipSum(D) + "d, was " + slipSum(prev.detail) + "d last week", src: "Programme milestones", dt: pnote("Sum of positive slip days across the milestone table, week on week. Provisional until the baseline is agreed.") });
    }
  }
  // 7. docs chase list and regressions
  const reds = docRedVendors(D.docs);
  const regs = prev ? docRegressions(D.docs, (prev.detail || {}).docs) : null;
  if (reds.length || (regs || 0) > 0) {
    push("amber", "Documentation chase list: " + (reds.length ? reds.slice(0, 3).map((v) => esc(v)).join(", ") + (reds.length > 3 ? " and " + (reds.length - 3) + " more" : "") + " carry red cells" : "no red vendors") + ((regs || 0) > 0 ? "; " + regs + " cell" + (regs === 1 ? "" : "s") + " regressed since last week" : "") + ".", { t: "Documentation register", b: "Vendors with red cells block tagging on their assets.", calc: reds.length + " red vendor" + (reds.length === 1 ? "" : "s") + ((regs || 0) > 0 ? ", " + regs + " regression" + (regs === 1 ? "" : "s") : ""), src: "Document Register", dt: reds.length ? ptable(["Vendor"], reds.map((v) => [esc(v)])) : pnote("No red vendors this week.") });
  }
  // 8. ACC staleness
  if (snap.acc_refreshed) {
    const st = Math.floor((we - new Date(snap.acc_refreshed)) / 864e5);
    if (st > 7) push("amber", "ACC data is stale: the register was last refreshed " + st + " days before this reporting week; tag figures may lag the field.", { t: "ACC refresh", calc: "Refreshed " + fmtFull(snap.acc_refreshed) + ", reporting week ends " + fmtFull(snap.week_ending), src: "Import metadata", dt: pnote("Refresh the ACC extract before importing the weekly pack.") });
  }
  // 9. attendance slope
  const att = attRecorded(D.attendance);
  const rts = att.filter((a) => a.rate != null).map((a) => a.rate);
  if (rts.length >= 3) {
    const l3 = rts.slice(-3);
    if (l3[0] > l3[1] && l3[1] > l3[2]) push("amber", "Vendor attendance has fallen 3 straight weeks (" + rts.slice(-4).join("%, ") + "%).", { t: "Vendor attendance", calc: "Last weeks: " + rts.slice(-4).join("%, ") + "%", src: "Vendor Attendance", dt: pnote("Three consecutive falling weekly rates. Click the attendance bars for who was absent.") });
  }
  // 10. import gap
  if (prev) {
    const gap = Math.round((we - new Date(prev.week_ending)) / 864e5);
    if (gap > 8) push("amber", "Import gap: " + gap + " days between this pack and the previous one; week-on-week movements span the gap.", { t: "Import gap", calc: gap + " days between imports", src: "Import metadata", dt: pnote("Weekly deltas assume weekly imports. A gap makes 7-day figures span more than 7 days.") });
  }
  // The pace signal is the headline metric: pinned to the top so the severity cap can never
  // silently drop it (or the week's only good news) behind six reds and ambers.
  const W = { red: 0, amber: 1, green: 2 };
  return S.sort((a, b) => (b.pin - a.pin) || (W[a.sev] - W[b.sev])).slice(0, 6);
}

/* =====================================================================
   DRILL CONTENT BUILDER (returns {t,b,calc,src,dt})
   ===================================================================== */
function ptable(cols, rows) {
  return `<table class="cxp-pt"><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
}
function pnote(s) { return `<div class="cxp-pnote">${s}</div>`; }
function buildDrill(key, ds, data) {
  const H = data || {}, D = (data && data.detail) || {};
  const k = key;
  if (k === "ty") { const r = (D.byType || [])[+ds.i]; if (!r) return null; const red = r[3] != null ? r[3] : Math.round(r[1] / 100 * r[2]);
    return { t: esc(r[0]) + "  -  Red tag " + r[1] + "%", b: `<b>${red}</b> of ${r[2]} ${esc(r[0])} assets have earned the Red (L1) tag, ${r[2] - red} still to clear L1.`, calc: `${red} / ${r[2]} = ${r[1]}%`, src: "Tag Attainment", dt: ptable(["Metric", "Value"], [["Assets", r[2]], ["Red-tagged", red], ["Remaining", r[2] - red], ["Attainment", r[1] + "%"]]) }; }
  if (k.indexOf("is-") === 0) { const c = k.slice(3); const n = (D.issuesByType || {})[c] || 0; const rows = (D.issues || []).filter((x) => x[4] === c).map((x) => [esc(x[0]), esc(x[1]), esc(x[2] || "-"), esc(x[3])]);
    return { t: esc(c) + " issues  -  " + n + " open", b: `In-scope open issues in the ${esc(c)} category (status Open or In progress).`, calc: n + " open", src: "IRL (ACC Issues)", dt: rows.length ? ptable(["ID", "Title", "Company", "Status"], rows) : pnote("Row detail for this category was not in the import.") }; }
  if (k === "doc") { const r = (D.docs && D.docs.rows || [])[+ds.vi]; if (!r) return null; const cols = (D.docs && D.docs.cols) || []; const ci = +ds.ci; const rag = r[1][ci];
    return { t: esc(r[0]) + "  -  " + esc(cols[ci]), b: `<b>${ragWord[rag]}</b>. ${esc(r[2] || "")}${r[3] ? " Contact " + esc(r[3]) + "." : ""}`, calc: esc(cols[ci]) + " status: " + ragWord[rag], src: "Document Register", dt: ptable(["Level", "Status"], cols.map((cc, i) => [esc(cc), ragWord[r[1][i]]])) }; }
  if (k === "sc") { const s = (D.scurve || [])[+ds.i]; if (!s) return null; const plan = s[1], act = s[2]; const av = act == null ? "no data yet" : act + "%"; const vr = act == null ? "-" : ((act - plan >= 0 ? "+" : "") + (act - plan).toFixed(1) + " pts");
    const base = (data.config && data.config.baselineAgreed); const rng = []; const all = D.scurve || []; const i = +ds.i; for (let j = Math.max(0, i - 2); j <= Math.min(all.length - 1, i + 2); j++) rng.push([fmtFull(all[j][0]), base ? all[j][1] + "%" : "pending", all[j][2] == null ? "-" : all[j][2] + "%"]);
    return { t: "Week ending " + fmtFull(s[0]), b: base ? "Planned is the agreed baseline; Actual is recorded L1-L3 tag attainment over the mapped assets." : "Actual is recorded L1-L3 tag attainment. Planned is dormant until the schedule baseline is agreed and instructed.", calc: base ? `Planned ${plan}%   |   Actual ${av}   |   Variance ${vr}` : `Actual ${av}   |   Baseline pending`, src: "Programme", dt: ptable(["Week", "Planned", "Actual"], rng) }; }
  if (k.indexOf("att-") === 0) { const a = attRecorded(D.attendance)[+k.replace("att-", "")]; if (!a) return null;
    if (a.rate == null) return { t: a.wk + "  -  in progress", b: "Attendance for this week has not been marked yet.", calc: "Attended / Invited = pending", src: "Vendor Attendance", dt: pnote("No marks recorded for this week.") };
    const inv = a.present.length + a.absent.length;
    return { t: esc(a.wk) + "  -  " + a.rate + "%", b: `<b>Present:</b> ${esc(a.present.join(", ")) || "-"}.<br><b>Absent:</b> ${esc(a.absent.join(", ")) || "-"}.`, calc: a.present.length + " of " + inv + " invited = " + a.rate + "%", src: "Vendor Attendance", dt: ptable(["Vendor", "Attended"], a.present.map((p) => [esc(p), "Y"]).concat(a.absent.map((p) => [esc(p), "N"]))) }; }
  if (k.indexOf("ms-") === 0) { const r = (D.milestones || [])[+k.replace("ms-", "")]; if (!r) return null;
    return { t: esc(r[0]), b: "Programme milestone (provisional until the baseline is agreed).", calc: `Baseline ${r[5] ? fmtFull(r[5]) : "-"}  -  Forecast ${fmtFull(r[1])}  -  Slip ${r[3] == null ? "-" : "+" + r[3] + "d"}  -  ${esc(r[2])}`, src: "Programme", dt: ptable(["Field", "Value"], [["Baseline", r[5] ? fmtFull(r[5]) : "-"], ["Forecast", fmtFull(r[1])], ["Actual", r[6] ? fmtFull(r[6]) : "not set"], ["Slip", r[3] == null ? "-" : "+" + r[3] + " days"], ["Status", esc(r[2])], ["RAG", ragWord[r[4]]]]) }; }
  if (k === "rk") { const r = (D.risks || [])[+ds.ri]; if (!r) return null;
    return { t: "Risk (" + esc(r[4] || "-") + ")", b: `<b>${esc(r[0])}</b><br>Owner ${esc(r[1] || "-")}. Raised ${esc(r[2] || "-")}, due ${esc(r[3] || "-")}.${r[5] ? ' <span style="color:var(--red);font-weight:700">Overdue.</span>' : ""}`, calc: "Priority " + esc(r[4] || "-") + (r[5] ? "  -  Overdue" : ""), src: "Risk Register", dt: ptable(["Field", "Value"], [["Risk", esc(r[0])], ["Responsible", esc(r[1])], ["Raised", esc(r[2])], ["Due", r[5] ? `<span style="color:var(--red)">${esc(r[3])}</span>` : esc(r[3])], ["Priority", esc(r[4])], ["Overdue", r[5] ? "Yes" : "No"]]) }; }
  // KPI + funnel + irl static-ish keys
  const A = H.assets || 0;
  const typeT = () => (D.byType || []).slice(0, 12).map((r) => [esc(r[0]), r[2], r[3] != null ? r[3] : Math.round(r[1] / 100 * r[2]), r[1] + "%"]);
  const M = {
    "kpi-assets": { t: "Cx Assets", b: "Every commissionable asset in the register. " + (H.mapped_assets || 0) + " mapped to the programme.", calc: "Total assets = " + (A || "-"), src: "Asset Cx Register", dt: ptable(["Group", "Assets"], [["Total", A], ["Mapped to programme", H.mapped_assets || 0], ["Unmapped", A && H.mapped_assets ? A - H.mapped_assets : "-"]]) },
    "kpi-red": { t: "Red tag (L1)", b: "Earned when all L1 activities read YES. " + (H.new_red_7d || 0) + " earned in the last 7 days.", calc: (H.red_n || 0) + " / " + A + " = " + (H.red_pct || 0) + "%", src: "Asset Cx Register / Tag Attainment", dt: ptable(["Type", "Assets", "Red #", "Red %"], typeT()) },
    "kpi-yellow": { t: "Yellow tag (L2)", b: "Earned when all L2 activities read YES.", calc: (H.yellow_n || 0) + " / " + A + " = " + (H.yellow_pct || 0) + "%", src: "Asset Cx Register", dt: pnote((H.yellow_n || 0) + " assets at L2.") },
    "kpi-green": { t: "Green tag (L3)", b: "Earned when all L3 activities read YES.", calc: (H.green_n || 0) + " / " + A + " = " + (H.green_pct || 0) + "%", src: "Asset Cx Register", dt: pnote((H.green_n || 0) + " assets at L3.") },
    "kpi-issues": { t: "Open Issues (Q+C)", b: "Open or In progress issues in scope (Quality, Commissioning, Snag).", calc: "Open issues = " + (H.open_issues == null ? "-" : H.open_issues), src: "IRL (ACC Issues)", dt: (D.issues || []).length ? ptable(["ID", "Title", "Company", "Status"], (D.issues || []).slice(0, 12).map((x) => [esc(x[0]), esc(x[1]), esc(x[2] || "-"), esc(x[3])])) : pnote("No issue rows in this import.") },
    "kpi-verify": { t: "Awaiting verification", b: "Completed by the contractor, not yet Closed by CTS.", calc: "Awaiting verification = " + (H.awaiting_verification == null ? "-" : H.awaiting_verification), src: "IRL (ACC Issues)", dt: pnote((H.awaiting_verification || 0) + " issues Completed and awaiting CTS close.") },
    "irl-opened": { t: "Issues opened", b: "In-scope issues created since the cutoff.", calc: "Opened = " + ((D.irl && D.irl.opened) ?? "-"), src: "IRL Metrics", dt: pnote("New in-scope issues this week.") },
    "irl-started": { t: "Work started", b: "Issues moved Open to In progress.", calc: "Started = " + ((D.irl && D.irl.started) ?? "-"), src: "IRL Metrics", dt: pnote("Issues that moved to In progress.") },
    "irl-delivered": { t: "Contractor delivered", b: "Issues advanced to Completed this week.", calc: "Delivered = " + ((D.irl && D.irl.delivered) ?? "-"), src: "IRL Metrics", dt: pnote("Issues advanced to Completed.") },
    "irl-verified": { t: "CTS verified", b: "Issues advanced to Closed this week.", calc: "Verified = " + ((D.irl && D.irl.verified) ?? "-"), src: "IRL Metrics", dt: pnote("Issues advanced to Closed.") },
  };
  return M[k] || null;
}

/* =====================================================================
   PAGE
   ===================================================================== */
export default function CxProgressPage({ projectId, isAdmin, can, theme, cu, reportButton }) {
  const canv = can || (() => isAdmin);
  const [weeks, setWeeks] = useState([]);          // [{week_ending, ...headline}]
  const [snap, setSnap] = useState(null);          // current full snapshot row
  const [cfg, setCfg] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [pop, setPop] = useState(null);            // {t,b,calc,src,dt}
  const [popTab, setPopTab] = useState(0);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [insightsOn, setInsightsOn] = useState(() => { try { return localStorage.getItem("dlp-cx-insights") !== "0"; } catch (e) { return true; } });
  const setInsights = (v) => { setInsightsOn(v); try { localStorage.setItem("dlp-cx-insights", v ? "1" : "0"); } catch (e) { /* private mode */ } };
  const fileRef = useRef(null);

  const loadWeeks = useCallback(async (selectWeek) => {
    setLoading(true); setErr("");
    try {
      const [{ data: wks, error: e1 }, { data: conf }] = await Promise.all([
        supabase.from("cx_week").select("*").eq("project_id", projectId).order("week_ending", { ascending: false }),
        supabase.from("cx_config").select("config").eq("project_id", projectId).maybeSingle(),
      ]);
      if (e1) throw e1;
      const list = wks || [];
      setWeeks(list);
      if (conf && conf.config) setCfg({ ...DEFAULT_CONFIG, ...conf.config, cards: { ...DEFAULT_CONFIG.cards, ...(conf.config.cards || {}) }, targets: { ...DEFAULT_CONFIG.targets, ...(conf.config.targets || {}) }, sla: { ...DEFAULT_CONFIG.sla, ...(conf.config.sla || {}) }, rag: { ...DEFAULT_CONFIG.rag, ...(conf.config.rag || {}) } });
      const pick = selectWeek ? list.find((w) => w.week_ending === selectWeek) : list[0];
      setSnap(pick || null);
    } catch (e) { setErr(e.message || String(e)); }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { if (projectId) loadWeeks(); }, [projectId, loadWeeks]);

  const data = useMemo(() => snap ? { ...snap, config: cfg } : null, [snap, cfg]);

  const onImport = async (file) => {
    if (!file) return; setBusy(true); setErr(""); setInfo("");
    try {
      const parsed = await parseWorkbook(file);
      const H = parsed.headline;
      const row = {
        project_id: projectId, week_ending: parsed.week_ending, acc_refreshed: parsed.acc_refreshed,
        imported_by: cu && cu.name ? cu.name : null, imported_at: new Date().toISOString(),
        assets: H.assets, mapped_assets: H.mapped_assets, red_n: H.red_n, yellow_n: H.yellow_n, green_n: H.green_n, blue_n: H.blue_n, white_n: H.white_n,
        red_pct: H.red_pct, yellow_pct: H.yellow_pct, green_pct: H.green_pct, blue_pct: H.blue_pct, white_pct: H.white_pct,
        open_issues: H.open_issues, awaiting_verification: H.awaiting_verification, issues_raised_7d: H.issues_raised_7d, issues_resolved_7d: H.issues_resolved_7d,
        new_red_7d: H.new_red_7d, new_yellow_7d: H.new_yellow_7d, new_green_7d: H.new_green_7d,
        irl_opened: H.irl_opened, irl_started: H.irl_started, irl_delivered: H.irl_delivered, irl_verified: H.irl_verified,
        detail: parsed.detail,
      };
      const { error } = await supabase.from("cx_week").upsert(row, { onConflict: "project_id,week_ending" });
      if (error) throw error;
      await loadWeeks(parsed.week_ending);
      const dv = (parsed.detail.docs && parsed.detail.docs.rows && parsed.detail.docs.rows.length) || 0;
      const aw = (parsed.detail.attendance && parsed.detail.attendance.length) || 0;
      const rk = (parsed.detail.risks && parsed.detail.risks.length) || 0;
      setInfo("Imported week ending " + fmtFull(parsed.week_ending) + ": " + dv + " document vendors, " + aw + " attendance week(s), " + rk + " risk(s)." + (parsed.warnings.length ? " Notes: " + parsed.warnings.join(" | ") : ""));
    } catch (e) { setErr("Import failed: " + (e.message || String(e))); }
    setBusy(false);
  };

  const saveCfg = async (next) => { setCfg(next); try { await supabase.from("cx_config").upsert({ project_id: projectId, config: next, updated_at: new Date().toISOString(), updated_by: cu && cu.name }, { onConflict: "project_id" }); } catch (e) { setErr("Config save failed: " + (e.message || e)); } };

  const onDrill = (e) => {
    const el = e.target.closest("[data-pop]"); if (!el) return;
    const built = buildDrill(el.dataset.pop, el.dataset, data); if (!built) return;
    setPop(built); setPopTab(0);
  };

  const show = (k) => cfg.cards[k] !== false;
  const order = (cfg.order && cfg.order.length ? cfg.order : CARD_KEYS).filter((k) => CARD_KEYS.includes(k));

  return (
    <div className={"cxp" + (theme === "dark" ? " cxp-dark" : "")} onClick={onDrill}>
      <style>{CXP_CSS}</style>

      <div className="cxp-top">
        <div className="cxp-title">Weekly Cx Progress<small>Asset-based commissioning attainment. Reporting source, separate from the planning board.</small></div>
        <div style={{ flex: 1 }} />
        {snap && <span className="cxp-pill"><span className="cxp-dot" style={{ background: "var(--green)" }} /> ACC refreshed <b>{snap.acc_refreshed ? fmtFull(snap.acc_refreshed) : "-"}</b></span>}
        <select className="cxp-wk" value={(snap && snap.week_ending) || ""} onChange={(e) => setSnap(weeks.find((w) => w.week_ending === e.target.value) || null)}>
          {weeks.length === 0 && <option value="">No imports yet</option>}
          {weeks.map((w) => <option key={w.week_ending} value={w.week_ending}>Week ending {fmtFull(w.week_ending)}</option>)}
        </select>
        {canv("importWb") && <label className="cxp-btn"><input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; onImport(f); }} />{busy ? "Importing\u2026" : "Import workbook"}</label>}
        {reportButton}
        {canv("cxConfig") && <button className="cxp-btn prime" onClick={(e) => { e.stopPropagation(); setCfgOpen(true); }}>Configure</button>}
      </div>

      {err && <div className="cxp-err">{err}</div>}
      {info && <div className="cxp-ok">{info}</div>}

      {!loading && snap && isAdmin && <SignalsBar snap={snap} prev={prevOf(weeks, snap)} weeks={weeks} cfg={cfg} on={insightsOn} setOn={setInsights} openPop={(p) => { setPop(p); setPopTab(0); }} />}
      {loading && <div className="cxp-empty">Loading\u2026</div>}

      {!loading && !snap && (
        <div className="cxp-empty">
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No weekly pack imported yet</div>
          <div style={{ color: "var(--muted)", marginBottom: 14 }}>Import the weekly Cx Excel workbook to populate this page. Re-importing the same week overwrites it.</div>
          <label className="cxp-btn prime"><input type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; onImport(f); }} />Import workbook</label>
        </div>
      )}

      {!loading && snap && order.map((key) => {
        if (!show(key)) return null;
        if (key === "kpi") return <KPIs key="kpi" s={snap} prev={prevOf(weeks, snap)} />;
        if (key === "scurve") {
          const scSeries = snap.detail.scurve || [];
          return (
            <div key="row1" style={{ marginBottom: 14 }}>
              <Panel title="Programme S-curve, planned vs actual (L1-L3)" right={<Legend />}>{cfg.baselineAgreed ? scVar(scSeries, cfg.baselineAgreed, snap.week_ending) : <div className="cxp-advisory"><span className="cxp-advico">i</span>Provisional. KPI variance and the planned curve are placeholders and will update automatically once a delivery schedule is linked.</div>}<div dangerouslySetInnerHTML={{ __html: svgScurve(scSeries, cfg.baselineAgreed, snap.week_ending) }} /></Panel>
            </div>
          );
        }
        if (key === "bytype" || key === "issues" || key === "irl") {
          if (key !== "bytype") return null;
          return (
            <div className="cxp-grid3" key="row2">
              {show("bytype") && <ByType s={snap} weeks={weeks} cfg={cfg} />}
              {show("issues") && <Issues s={snap} />}
              {show("irl") && <IRL s={snap} />}
            </div>
          );
        }
        if (key === "docs" || key === "milestones") {
          if (key !== "docs") return null;
          return (
            <div className="cxp-grid" key="row3">
              {show("docs") && <Docs s={snap} weeks={weeks} />}
              {show("milestones") && <Milestones s={snap} />}
            </div>
          );
        }
        if (key === "risks" || key === "attendance") {
          if (key !== "risks") return null;
          return (
            <div className="cxp-grid" key="row4">
              {show("risks") && <Risks s={snap} />}
              {show("attendance") && <Attendance s={snap} />}
            </div>
          );
        }
        return null;
      })}

      {!loading && snap && <div className="cxp-foot">Imported {snap.imported_at ? fmtFull(snap.imported_at) : ""}{snap.imported_by ? " by " + snap.imported_by : ""}. Click any tile, bar, point, cell or row for the detail and calculation.</div>}

      {/* drill popup */}
      {pop && <>
        <div className="cxp-scrim show" onClick={(e) => { e.stopPropagation(); setPop(null); }} />
        <div className="cxp-pop show" onClick={(e) => e.stopPropagation()}>
          <div className="cxp-ph">
            <div className="cxp-phic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20V10M10 20V4M16 20v-7M20 20H3" /></svg></div>
            <div className="cxp-pht"><h4 dangerouslySetInnerHTML={{ __html: pop.t }} />{pop.b && <div className="cxp-phd" dangerouslySetInnerHTML={{ __html: pop.b }} />}</div>
            <button className="cxp-x" onClick={() => setPop(null)}>{"\u2715"}</button>
          </div>
          <div className="cxp-ptabs"><button className={"cxp-tab" + (popTab === 0 ? " on" : "")} onClick={() => setPopTab(0)}>Overview</button><button className={"cxp-tab" + (popTab === 1 ? " on" : "")} onClick={() => setPopTab(1)}>Underlying data</button></div>
          <div className="cxp-pbody" dangerouslySetInnerHTML={{ __html: popTab === 0 ? (pop.calc ? '<div class="cxp-calc">' + pop.calc.replace(/\n/g, "<br>") + "</div>" : pnote("No calculation recorded for this item.")) : (pop.dt || pnote("No row-level detail.")) }} />
          <div className="cxp-psrc"><span className="cxp-srclbl">Source</span> <span className="cxp-lk">{pop.src}</span> sheet</div>
        </div>
      </>}

      {/* configure */}
      {cfgOpen && <Configure cfg={cfg} weeks={weeks} cur={snap && snap.week_ending} onWeek={(we) => setSnap(weeks.find((w) => w.week_ending === we) || null)} onSave={saveCfg} onClose={() => setCfgOpen(false)} />}
    </div>
  );
}

/* ---------- layout subcomponents ---------- */
function Panel({ title, right, children }) {
  return <div className="cxp-panel"><div className="cxp-phead"><h3>{title}</h3>{right}</div>{children}</div>;
}
function Legend() { return <div className="cxp-legend"><span><i style={{ background: "var(--accent)" }} />Planned</span><span><i style={{ background: "var(--green)" }} />Actual</span></div>; }

function KPIs({ s, prev }) {
  const d1 = (v) => Math.round(v * 10) / 10;
  const sep = " \u00B7 ";
  const A = s.assets || 0;
  // Two sources for movement, in order of preference: the true diff against the previous imported
  // week, and the pack's own Week on Week 7-day figures, which exist from the very first import.
  const prevPts = (k) => (prev && prev[k] != null && s[k] != null ? d1((s[k] || 0) - (prev[k] || 0)) : null);
  const prevCnt = (k) => (prev && prev[k] != null && s[k] != null ? (s[k] || 0) - (prev[k] || 0) : null);
  const packPts = (n7) => (A && n7 != null ? d1((n7 / A) * 100) : null);
  const chip = (cls, txt) => <span className={cls}>{txt}</span>;
  const flat = (txt) => chip("cxp-flat", "\u25AC " + txt);
  // pts arrow: an increase in tag attainment is good news
  const arrowPts = (pts) => pts == null ? null : pts === 0 ? flat("0.0pts") : chip(pts > 0 ? "cxp-up" : "cxp-dn", (pts > 0 ? "\u25B2 +" : "\u25BC \u2212") + d1(Math.abs(pts)) + "pts");
  // count arrow with a neutral fallback word when no movement is measurable or it is zero
  const arrowCnt = (d, unit, goodUp, fallback) => (d == null || d === 0) ? flat(fallback) : chip((d > 0) === goodUp ? "cxp-up" : "cxp-dn", (d > 0 ? "\u25B2 +" : "\u25BC \u2212") + Math.abs(d) + unit);
  const redPts = prevPts("red_pct") != null ? prevPts("red_pct") : packPts(s.new_red_7d);
  const yelPts = prevPts("yellow_pct") != null ? prevPts("yellow_pct") : packPts(s.new_yellow_7d);
  const grnPts = prevPts("green_pct") != null ? prevPts("green_pct") : packPts(s.new_green_7d);
  const raised = s.issues_raised_7d, resolved = s.issues_resolved_7d || 0;
  const issuesInd = raised != null ? <>{chip(raised > resolved ? "cxp-dn" : raised < resolved ? "cxp-up" : "cxp-flat", (raised > 0 ? "\u25B2 +" : "\u25AC ") + raised)}{" raised"}{sep}{chip(resolved === 0 && raised > 0 ? "cxp-dn" : "", resolved + " resolved")}</> : (prevCnt("open_issues") != null ? arrowCnt(prevCnt("open_issues"), " open", false, "no change") : flat("no data"));
  const tiles = [
    ["kpi-assets", "Cx Assets", A.toLocaleString(), "var(--accent)", <>{(s.mapped_assets || 0) + " mapped"}{sep}{arrowCnt(prevCnt("assets"), " assets", true, "no change")}</>, null],
    ["kpi-red", "Red tag (L1)", (s.red_pct || 0) + "%", TAGC.red, <>{arrowPts(redPts) || flat("0.0pts")}{s.new_red_7d ? sep + "+" + s.new_red_7d + " assets 7d" : ""}</>, s.red_pct || 0],
    ["kpi-yellow", "Yellow tag (L2)", (s.yellow_pct || 0) + "%", TAGC.yellow, <>{arrowPts(yelPts) || flat("0.0pts")}{sep}{(s.yellow_n || 0) + " of " + A.toLocaleString()}</>, s.yellow_pct || 0],
    ["kpi-green", "Green tag (L3)", (s.green_pct || 0) + "%", TAGC.green, (s.green_pct || 0) === 0 && !(grnPts > 0) ? flat("not started") : <>{arrowPts(grnPts) || flat("0.0pts")}{sep}{"L3 SAT"}</>, s.green_pct || 0],
    ["kpi-issues", "Open Issues (Q+C)", s.open_issues == null ? "-" : s.open_issues, "var(--accent)", issuesInd, null],
    ["kpi-verify", "Awaiting verification", s.awaiting_verification == null ? "-" : s.awaiting_verification, TAGC.yellow, <>{arrowCnt(prevCnt("awaiting_verification"), "", false, "unchanged")}{sep}{"contractor done, CTS to close"}</>, null],
  ];
  return <div className="cxp-kpis">{tiles.map(([k, lab, val, col, sub, prog]) => (
    <div className="cxp-kpi" data-pop={k} key={k}><span className="cxp-ab" style={{ background: col }} /><div className="cxp-lab">{lab}</div><div className="cxp-val" style={{ color: col }}>{val}</div>{prog != null && <div className="cxp-prog"><i style={{ width: Math.max(1.5, prog) + "%", background: col }} /></div>}<div className="cxp-sub">{sub}</div></div>
  ))}</div>;
}
function SignalsBar({ snap, prev, weeks, cfg, on, setOn, openPop }) {
  const sigs = on ? buildSignals(snap, prev, weeks, cfg) : [];
  const IC = { red: ["!", "cxp-si-red"], amber: ["!", "cxp-si-amb"], green: ["\u2713", "cxp-si-grn"] };
  return <div className="cxp-panel cxp-sigs">
    <div className="cxp-sigtop">
      <span className={"cxp-tgl" + (on ? " on" : "")} onClick={() => setOn(!on)} role="switch" aria-checked={on}><i /></span>
      <b>Insights</b><span className="cxp-adminpill">Admins only</span>
      <span className="cxp-sigmeta">computed from this import vs last; click a line for the detail and calculation</span>
    </div>
    {on && (sigs.length === 0 ? <div className="cxp-note">Nothing to flag this week.</div> : <div className="cxp-siglist">{sigs.map((x, i) => (
      <div className="cxp-sig" key={i} onClick={() => x.pop && openPop({ src: "Insights", ...x.pop })}><span className={"cxp-sic " + IC[x.sev][1]}>{IC[x.sev][0]}</span><span className="cxp-sigtx">{x.text}</span></div>
    ))}</div>)}
  </div>;
}
function ByType({ s, weeks, cfg }) {
  const by = (s.detail.byType || []).slice(0, 9);
  const idx = (weeks || []).findIndex((w) => w.week_ending === s.week_ending);
  const prevBy = idx >= 0 && weeks[idx + 1] ? (((weeks[idx + 1] || {}).detail || {}).byType || []) : null;
  const mv = (r) => {
    if (!prevBy) return null;
    const p = prevBy.find((x) => x[0] === r[0]); if (!p) return null;
    const d = typeRedN(r) - typeRedN(p);
    if (d > 0) return <span className="cxp-up">{"+" + d + " this wk"}</span>;
    if ((r[1] || 0) >= 100) return <span className="cxp-flat">done</span>;
    const st = typeStallStreak(weeks, idx, r[0]);
    if (st >= ((cfg && cfg.stallWeeks) || 2)) return <span className="cxp-dn">{"stalled " + st + "wks"}</span>;
    return <span className="cxp-flat">0 this wk</span>;
  };
  return <div className="cxp-panel"><div className="cxp-phead"><h3>Red tag by equipment type</h3><div className="cxp-meta">movers and stalled</div></div>
    {by.length === 0 ? <div className="cxp-note">No tag-by-type data.</div> : by.map((r, i) => (
      <div className="cxp-tbar" data-pop="ty" data-i={i} key={r[0]}><div className="cxp-fnm">{r[0]}</div><div className="cxp-track"><i style={{ width: (r[1] || 0) + "%" }} /></div><div className="cxp-tm">{r[1]}% &middot; {r[2]} assets{mv(r) ? <> &middot; {mv(r)}</> : null}</div></div>
    ))}</div>;
}
function Issues({ s }) {
  const ibt = s.detail.issuesByType || {}; const order = [["Snag", "var(--accent)"], ["Commissioning", "#7C8BF5"], ["Quality", "var(--green)"], ["Environmental", "var(--amber)"]];
  const parts = order.filter(([k]) => ibt[k]).map(([k, c]) => [c, ibt[k]]);
  return <div className="cxp-panel"><div className="cxp-phead"><h3>Open issues by type</h3><div className="cxp-meta">Q + C scope</div></div>
    <div className="cxp-donutwrap"><div dangerouslySetInnerHTML={{ __html: parts.length ? svgDonut(parts) : '<div class="cxp-note">No issue data.</div>' }} />
      <div className="cxp-dleg">{order.map(([k, c]) => ibt[k] != null && <span data-pop={"is-" + k} key={k}><span className="cxp-dot" style={{ background: c }} /> {k} <b>{ibt[k]}</b></span>)}</div></div></div>;
}
function IRL({ s }) {
  const r = s.detail.irl || {}; const steps = [["irl-opened", r.opened, "Opened", "var(--ink)"], ["irl-started", r.started, "Started", "var(--amber)"], ["irl-delivered", r.delivered, "Delivered", "var(--accent)"], ["irl-verified", r.verified, "Verified", "var(--green)"]];
  return <div className="cxp-panel"><div className="cxp-phead"><h3>IRL workflow this week</h3><div className="cxp-meta">issue movement</div></div>
    <div className="cxp-flow">{steps.map(([k, n, l, c], i) => (
      <div className="cxp-fstep" data-pop={k} key={k}><div className="cxp-n" style={{ color: c }}>{n == null ? "-" : n}</div><div className="cxp-fl">{l}</div>{i < 3 && <span className="cxp-arr">{"\u203A"}</span>}</div>
    ))}</div>
    <div className="cxp-note">Opened to In progress to Completed (contractor) to Closed (CTS verified).</div></div>;
}
function Docs({ s, weeks }) {
  const dd = s.detail.docs || { cols: [], rows: [] };
  const d = { cols: dd.cols || [], rows: docLiveRows(dd) };
  const idx = (weeks || []).findIndex((w) => w.week_ending === s.week_ending);
  const prev = idx >= 0 ? weeks[idx + 1] : null;
  const score = docScore(dd);
  const pScore = prev ? docScore((prev.detail || {}).docs) : null;
  const regs = prev ? docRegressions(dd, (prev.detail || {}).docs) : null;
  const reds = docRedVendors(dd).length;
  const meta = score == null ? "RAG by vendor and level" : <>readiness <b>{score}%</b>{pScore != null && score !== pScore ? <span className={score > pScore ? "cxp-up" : "cxp-dn"}>{" "}{score > pScore ? "\u25B2 +" : "\u25BC \u2212"}{Math.abs(score - pScore)}pts</span> : null}{" \u00B7 " + reds + " red vendor" + (reds === 1 ? "" : "s")}{(regs || 0) > 0 ? " \u00B7 " + regs + " regression" + (regs === 1 ? "" : "s") : ""}</>;
  return <div className="cxp-panel"><div className="cxp-phead"><h3>Documentation register</h3><div className="cxp-meta">{meta}</div></div>
    {d.rows.length === 0 ? <div className="cxp-note">No document register data.</div> :
      <table className="cxp-matrix"><tbody><tr><th style={{ textAlign: "left" }}>Vendor</th>{d.cols.map((c) => <th key={c}>{c}</th>)}</tr>
        {d.rows.map((r, vi) => <tr key={vi}><td className="cxp-nm">{r[0]}</td>{r[1].map((rag, ci) => <td key={ci}><span className={"cxp-cell c-" + (rag || "x").toLowerCase()} data-pop="doc" data-vi={vi} data-ci={ci}>{rag}</span></td>)}</tr>)}</tbody></table>}</div>;
}
function Milestones({ s }) {
  const ms = (s.detail.milestones || []).slice(0, 7);
  return <div className="cxp-panel"><div className="cxp-phead"><h3>Milestones</h3><div className="cxp-meta">provisional</div></div>
    {ms.length === 0 ? <div className="cxp-note">No milestone data.</div> :
      <table className="cxp-mt"><tbody>{ms.map((r, i) => (
        <tr data-pop={"ms-" + i} key={i}><td className="cxp-nm">{r[0]}</td><td>{fmtDay(r[1])}</td><td><span className={"cxp-tag t-" + r[4].toLowerCase()}>{r[2] || "-"}</span></td><td className={"cxp-slip" + (r[3] > 0 ? "" : " ok")}>{r[3] == null ? "-" : "+" + r[3] + "d"}</td></tr>
      ))}</tbody></table>}</div>;
}
function Risks({ s }) {
  const rk = s.detail.risks || []; const overdue = rk.filter((r) => r[5]).length;
  // days overdue is computed at render against the reporting week (year inferred for old
  // snapshots whose due dates were stored without a year); overdue rows sort first, oldest first
  const rows = rk.map((r, i) => ({ r, i, od: r[5] ? riskDaysOver(r, s.week_ending) : null }));
  rows.sort((a, b) => ((b.od != null ? b.od : b.r[5] ? 0 : -1) - (a.od != null ? a.od : a.r[5] ? 0 : -1)) || a.i - b.i);
  return <div className="cxp-panel"><div className="cxp-phead"><h3>Risk register</h3><div className="cxp-meta">{rk.length} open{overdue ? " \u00B7 " + overdue + " overdue \u00B7 sorted by days overdue" : ""}</div></div>
    {rk.length === 0 ? <div className="cxp-note">No Risks sheet in the import. Add a sheet named Risks with columns Risk, Responsible, Raised, Due, Priority.</div> :
      <table className="cxp-rtable"><tbody><tr><th>Risk</th><th>Responsible</th><th>Raised</th><th>Due</th><th>Overdue</th><th>Priority</th></tr>
        {rows.map(({ r, i, od }) => (
          <tr data-pop="rk" data-ri={i} key={i}><td className="cxp-rk">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td className={r[5] ? "cxp-od" : ""}>{r[3]}</td><td className={r[5] ? "cxp-od" : ""}>{od != null ? od + "d" : r[5] ? "yes" : "-"}</td><td><span className={"cxp-tag t-" + (/crit/i.test(r[4]) ? "r" : /high/i.test(r[4]) ? "a" : "g")}>{r[4] || "-"}</span></td></tr>
        ))}</tbody></table>}</div>;
}
function Attendance({ s }) {
  const att = attRecorded(s.detail.attendance); const max = 100;
  return <div className="cxp-panel"><div className="cxp-phead"><h3>Vendor meeting attendance</h3><div className="cxp-meta">weekly rate</div></div>
    {att.length === 0 ? <div className="cxp-note">No attendance data.</div> : <>
      <div className="cxp-spark">{att.map((a, i) => <i key={i} data-pop={"att-" + i} className={a.rate == null ? "open" : ""} style={{ height: Math.max(6, (a.rate || 0) / max * 100) + "%" }} />)}</div>
      <div className="cxp-attmeta">{att.map((a, i) => <span key={i}>{a.wk.replace(/week\s*/i, "W")} {a.rate == null ? "open" : a.rate + "%"}</span>)}</div>
    </>}</div>;
}

/* ---------- configure drawer ---------- */
function Configure({ cfg, weeks, cur, onWeek, onSave, onClose }) {
  const [c, setC] = useState(JSON.parse(JSON.stringify(cfg)));
  const order = c.order && c.order.length ? c.order.filter((k) => CARD_KEYS.includes(k)) : CARD_KEYS.slice();
  const move = (i, dir) => { const o = order.slice(); const j = i + dir; if (j < 0 || j >= o.length) return; const t = o[i]; o[i] = o[j]; o[j] = t; setC({ ...c, order: o }); };
  const tog = (k) => setC({ ...c, cards: { ...c.cards, [k]: c.cards[k] === false } });
  const setNum = (path, v) => { const n = JSON.parse(JSON.stringify(c)); const ks = path.split("."); let o = n; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = Number(v) || 0; setC(n); };
  return <>
    <div className="cxp-scrim show" onClick={(e) => { e.stopPropagation(); onClose(); }} />
    <aside className="cxp-cfg show" onClick={(e) => e.stopPropagation()}>
      <div className="cxp-ch"><h3>Configure dashboard</h3><button className="cxp-x" onClick={onClose}>{"\u2715"}</button></div>
      <div className="cxp-cb">
        <div className="cxp-grp"><div className="cxp-grphd">Reporting week</div>
          <div className="cxp-pair"><span>Showing week ending</span><select value={cur || ""} onChange={(e) => onWeek(e.target.value)}>{weeks.map((w) => <option key={w.week_ending} value={w.week_ending}>{fmtFull(w.week_ending)}</option>)}</select></div></div>
        <div className="cxp-grp"><div className="cxp-grphd">Schedule baseline</div>
          <div className="cxp-ci"><span className="cxp-cnm">Baseline agreed and instructed</span><span className={"cxp-sw" + (c.baselineAgreed ? " on" : "")} onClick={() => setC({ ...c, baselineAgreed: !c.baselineAgreed })} /></div>
          <div className="cxp-cnote">Off until the schedule is agreed. While off, the S-curve shows Actual only and variance stays dormant.</div></div>
        <div className="cxp-grp"><div className="cxp-grphd">Cards (show, hide, reorder)</div>
          {order.map((k, i) => <div className="cxp-ci" key={k}><span className="cxp-ord"><button onClick={() => move(i, -1)} disabled={i === 0}>{"\u25B4"}</button><button onClick={() => move(i, 1)} disabled={i === order.length - 1}>{"\u25BE"}</button></span><span className="cxp-cnm">{CARD_LABEL[k]}</span><span className={"cxp-sw" + (c.cards[k] !== false ? " on" : "")} onClick={() => tog(k)} /></div>)}</div>
        <div className="cxp-grp"><div className="cxp-grphd">Tag attainment targets (%)</div>
          {["red", "yellow", "green"].map((k) => <div className="cxp-ci" key={k}><span className="cxp-cnm" style={{ textTransform: "capitalize" }}>{k} target</span><input type="number" value={c.targets[k]} onChange={(e) => setNum("targets." + k, e.target.value)} /></div>)}</div>
        <div className="cxp-grp"><div className="cxp-grphd">Issue SLA target (days)</div>
          {["critical", "high", "medium", "low"].map((k) => <div className="cxp-ci" key={k}><span className="cxp-cnm" style={{ textTransform: "capitalize" }}>{k}</span><input type="number" value={c.sla[k]} onChange={(e) => setNum("sla." + k, e.target.value)} /></div>)}</div>
        <div className="cxp-grp"><div className="cxp-grphd">Insights</div>
          <div className="cxp-ci"><span className="cxp-cnm">Stalled after (imports)</span><input type="number" min="1" value={c.stallWeeks == null ? 2 : c.stallWeeks} onChange={(e) => setNum("stallWeeks", e.target.value)} /></div>
          <div className="cxp-ci"><span className="cxp-cnm">Target 100% date</span><input type="date" value={c.targetDate || ""} onChange={(e) => setC({ ...c, targetDate: e.target.value })} /></div>
          <div className="cxp-cnote">The pace signal measures tagging velocity against this date; blank falls back to the milestone named Complete. Stalled flags a type after this many imports with zero movement.</div></div>
        <div className="cxp-grp"><div className="cxp-grphd">RAG thresholds (variance pts)</div>
          <div className="cxp-ci"><span className="cxp-cnm">Amber if behind by</span><input type="number" value={c.rag.amber} onChange={(e) => setNum("rag.amber", e.target.value)} /></div>
          <div className="cxp-ci"><span className="cxp-cnm">Red if behind by</span><input type="number" value={c.rag.red} onChange={(e) => setNum("rag.red", e.target.value)} /></div></div>
        <div className="cxp-cnote">Configuration is admin only and saved per project. It controls which cards show, their order, the baseline state, and the targets and thresholds the colours read from.</div>
      </div>
      <div className="cxp-cf"><button className="cxp-btn" style={{ flex: 1 }} onClick={onClose}>Cancel</button><button className="cxp-btn prime" style={{ flex: 1 }} onClick={() => { onSave(c); onClose(); }}>Save layout</button></div>
    </aside>
  </>;
}

/* ---------- scoped styles (use the app's theme variables) ---------- */
const CXP_CSS = `
.cxp-up{color:#18b69b;font-weight:700}
.cxp-dn{color:#e2564e;font-weight:700}
.cxp-flat{color:var(--faint);font-weight:600}
.cxp-sigs{margin-bottom:14px}
.cxp-sigtop{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cxp-sigtop b{font-size:13px}
.cxp-sigmeta{margin-left:auto;font-size:11px;color:var(--muted)}
.cxp-adminpill{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--amber);color:var(--amber);border-radius:999px;padding:1px 9px;opacity:.85}
.cxp-tgl{position:relative;display:inline-block;width:38px;height:21px;background:var(--chipbg);border:1px solid var(--line2);border-radius:999px;cursor:pointer;transition:background .15s;flex:none}
.cxp-tgl.on{background:var(--accent);border-color:var(--accent)}
.cxp-tgl i{position:absolute;top:2px;left:2px;width:15px;height:15px;background:#fff;border-radius:50%;transition:left .15s}
.cxp-tgl.on i{left:19px}
.cxp-siglist{display:flex;flex-direction:column;gap:7px;margin-top:10px}
.cxp-sig{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;padding:7px 10px;border-radius:8px;background:var(--card2);border:1px solid var(--line);cursor:pointer;color:var(--muted);line-height:1.5}
.cxp-sig:hover{border-color:var(--line2);background:var(--hover)}
.cxp-sic{width:18px;height:18px;border-radius:5px;flex:none;display:grid;place-items:center;font-size:11px;font-weight:800;margin-top:1px}
.cxp-si-red{background:rgba(226,86,78,.14);color:var(--red)}
.cxp-si-amb{background:rgba(224,161,6,.14);color:var(--amber)}
.cxp-si-grn{background:rgba(24,182,155,.14);color:var(--green)}
` + `
.cxp{--ink:#16202c;--muted:#5d6b7c;--faint:#94a1b1;--accent:#3b82f6;--green:#18b69b;--amber:#e0a106;--red:#e2564e;--paper:#ffffff;--card:#ffffff;--surface:#ffffff;--card2:#f7f9fc;--line:#e3e8ef;--line2:#d6dde6;--chipbg:#f7f9fc;--hover:#eef3f9;--cxsh:0 1px 2px rgba(16,32,48,.06),0 10px 24px rgba(16,32,48,.07);--head:#2563EB;--headtint:rgba(37,99,235,.09);max-width:1500px;margin:0 auto;padding:0 22px 44px;color:var(--ink);font-family:var(--body)}
body.dark .cxp,.cxp.cxp-dark{--ink:#e9eff6;--muted:#93a1b3;--faint:#5d6a7a;--accent:#3b82f6;--green:#18b69b;--amber:#e0a106;--red:#e2564e;--paper:#141d29;--card:#141d29;--surface:#101822;--card2:#0f1722;--line:#22303f;--line2:#2c3a4b;--chipbg:#0f1722;--hover:#1b2735;--cxsh:0 1px 0 rgba(255,255,255,.02),0 8px 28px rgba(0,0,0,.35);--head:#7FB0FF;--headtint:rgba(127,176,255,.14)}
.cxp-top{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:13px;flex-wrap:wrap;margin:0 -22px 16px;padding:14px 22px 13px;background:var(--card);border-bottom:1px solid var(--line)}
.cxp-title{font-size:20px;font-weight:800;letter-spacing:-.01em;color:var(--head)}
.cxp-title small{display:block;font-size:11.5px;font-weight:500;color:var(--muted);margin-top:2px}
.cxp-pill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:5px 11px}
.cxp-pill b{color:var(--ink);font-weight:600}
.cxp-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.cxp-btn,.cxp-wk{font-family:inherit;font-size:12.5px;font-weight:600;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:9px;padding:8px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.cxp-btn:hover{border-color:var(--accent)}
.cxp-btn.prime{background:var(--accent);border-color:var(--accent);color:#fff}
.cxp-err{background:rgba(224,161,6,.12);border:1px solid var(--amber);color:var(--ink);border-radius:10px;padding:10px 13px;font-size:12.5px;margin-bottom:14px}
.cxp-ok{background:rgba(24,182,155,.12);border:1px solid var(--green);color:var(--ink);border-radius:10px;padding:10px 13px;font-size:12.5px;margin-bottom:14px}
.cxp-empty{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:34px;text-align:center;color:var(--ink)}
.cxp-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:14px}
.cxp-kpi{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:15px 16px;position:relative;overflow:hidden;cursor:pointer;box-shadow:var(--cxsh)}
.cxp-kpi:hover{border-color:var(--accent)}
.cxp-prog{height:5px;border-radius:999px;background:var(--chipbg);margin-top:10px;overflow:hidden}
.cxp-prog i{display:block;height:100%;border-radius:999px}
.cxp-ab{position:absolute;left:0;top:0;bottom:0;width:3px}
.cxp-lab{font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.cxp-val{font-size:30px;font-weight:760;letter-spacing:-.02em;margin-top:7px;line-height:1}
.cxp-sub{font-size:11px;color:var(--muted);margin-top:8px}
.cxp-grid{display:grid;grid-template-columns:1.55fr 1fr;gap:14px;margin-bottom:14px}
.cxp-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px}
.cxp-panel{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:16px 17px;min-width:0;box-shadow:var(--cxsh)}
.cxp-phead{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;gap:8px}
.cxp-phead h3{margin:0;font-size:12.5px;font-weight:700;color:var(--head);text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;gap:9px}
.cxp-phead h3::before{content:"";width:3px;height:14px;border-radius:2px;background:var(--head);display:inline-block}
.cxp-varhead{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.cxp-vbig{font-size:14.5px;font-weight:750}
.cxp-vbig .a{color:var(--green)} .cxp-vbig .p{color:var(--accent)} .cxp-vs{color:var(--muted);font-weight:600}
.cxp-vchip{font-size:10.5px;font-weight:700;border-radius:999px;padding:3px 10px}
.cxp-vchip.behind{color:var(--red);background:rgba(226,86,78,.14)} .cxp-vchip.ahead{color:var(--green);background:rgba(24,182,155,.14)} .cxp-vchip.on{color:var(--muted);background:var(--chipbg)}
.cxp-advisory{display:flex;align-items:center;gap:9px;font-size:11.5px;color:var(--muted);background:var(--headtint);border:1px solid var(--line);border-radius:9px;padding:9px 12px;margin-bottom:10px;line-height:1.4}
.cxp-advico{flex:0 0 auto;width:17px;height:17px;border-radius:50%;background:var(--head);color:#fff;font-size:11px;font-weight:800;font-style:italic;display:flex;align-items:center;justify-content:center}
.cxp-meta{font-size:11px;color:var(--muted)}
.cxp-legend{display:flex;gap:12px;font-size:11px;color:var(--muted)}
.cxp-legend span{display:inline-flex;align-items:center;gap:6px}
.cxp-legend i{width:11px;height:3px;border-radius:2px}
.cxp-note{font-size:11px;color:var(--muted);margin-top:12px;line-height:1.5}
.cxp-tbar:hover .cxp-track{outline:1px solid var(--accent);outline-offset:2px}
.cxp-fnm{font-size:11.5px;font-weight:600}
.cxp-tn{font-size:11.5px;color:var(--muted);text-align:right}
.cxp-bar{height:22px;border-radius:8px;background:var(--chipbg);position:relative;overflow:hidden;border:1px solid var(--line)}
.cxp-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:8px}
.cxp-pc{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:11px;font-weight:700;color:var(--ink)}
.cxp-tbar{display:grid;grid-template-columns:84px 1fr 96px;align-items:center;gap:9px;margin-bottom:10px;cursor:pointer}
.cxp-track{height:12px;border-radius:999px;background:var(--chipbg);border:1px solid var(--line);overflow:hidden}
.cxp-track i{display:block;height:100%;border-radius:999px;background:${TAGC.red}}
.cxp-tm{font-size:10.5px;color:var(--muted);text-align:right}
.cxp-donutwrap{display:flex;align-items:center;gap:16px}
.cxp-dleg{display:flex;flex-direction:column;gap:7px;font-size:11.5px}
.cxp-dleg span{display:flex;align-items:center;gap:7px;color:var(--muted);cursor:pointer}
.cxp-dleg b{color:var(--ink);margin-left:auto}
.cxp-dleg span:hover{color:var(--ink)}
.cxp-flow{display:flex;gap:8px}
.cxp-fstep{flex:1;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:13px 8px;text-align:center;position:relative;cursor:pointer}
.cxp-fstep:hover{border-color:var(--accent)}
.cxp-n{font-size:22px;font-weight:740;line-height:1}
.cxp-fl{font-size:10px;color:var(--muted);margin-top:5px;text-transform:uppercase;letter-spacing:.03em}
.cxp-arr{position:absolute;right:-9px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px}
.cxp-matrix{width:100%;border-collapse:separate;border-spacing:0 5px;font-size:11.5px}
.cxp-matrix th{font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600;text-align:center;padding-bottom:4px}
.cxp-matrix td{text-align:center;padding:0 2px}
.cxp-matrix td.cxp-nm{text-align:left;font-weight:600;padding-right:8px}
.cxp-cell{display:inline-flex;align-items:center;justify-content:center;width:100%;height:24px;border-radius:8px;font-weight:800;font-size:11px;cursor:pointer;border:1px solid transparent}
.cxp-cell:hover{outline:2px solid var(--accent);outline-offset:1px}
.c-g{background:rgba(24,182,155,.15);color:var(--green);border-color:rgba(24,182,155,.34)} .c-a{background:rgba(224,161,6,.14);color:var(--amber);border-color:rgba(224,161,6,.32)} .c-r{background:rgba(226,86,78,.15);color:var(--red);border-color:rgba(226,86,78,.36)} .c-x{background:var(--chipbg);color:var(--muted);border-color:var(--line)}
.cxp-mt,.cxp-rtable{width:100%;border-collapse:collapse;font-size:12px}
.cxp-mt td{padding:8px 6px;border-bottom:1px solid var(--line)}
.cxp-mt tr:last-child td{border-bottom:0}
.cxp-mt tr[data-pop]{cursor:pointer}.cxp-mt tr[data-pop]:hover td{background:var(--hover)}
.cxp-nm{font-weight:600}
.cxp-tag{display:inline-flex;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:999px}
.t-r{background:rgba(221,84,80,.16);color:var(--red)} .t-a{background:rgba(224,161,6,.16);color:var(--amber)} .t-g{background:rgba(24,182,155,.16);color:var(--green)}
.cxp-slip{color:var(--red);font-weight:600}.cxp-slip.ok{color:var(--muted);font-weight:500}
.cxp-rtable th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600;padding:6px 8px;border-bottom:1px solid var(--line)}
.cxp-rtable td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
.cxp-rtable tr:last-child td{border-bottom:0}
.cxp-rtable tr[data-pop]{cursor:pointer}.cxp-rtable tr[data-pop]:hover td{background:var(--hover)}
.cxp-rk{font-weight:600;line-height:1.4}
.cxp-od{color:var(--red);font-weight:700;white-space:nowrap}
.cxp-spark{display:flex;align-items:flex-end;gap:14px;height:140px;padding-top:10px}
.cxp-spark i{flex:1;background:linear-gradient(180deg,var(--accent),rgba(59,130,246,.32));border-radius:8px 8px 4px 4px;min-height:6px;cursor:pointer}
.cxp-spark i.open{background:var(--line)}
.cxp-spark i:hover{filter:brightness(1.12)}
.cxp-attmeta{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);margin-top:8px}
.cxp-foot{font-size:11px;color:var(--muted);margin-top:6px}
.cxp-scrim{position:fixed;inset:0;background:rgba(4,8,14,.5);opacity:0;pointer-events:none;transition:.15s;z-index:60}
.cxp-scrim.show{opacity:1;pointer-events:auto}
.cxp-pop{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:440px;max-width:calc(100vw - 32px);background:var(--paper);border:1px solid var(--line);border-radius:14px;z-index:61;box-shadow:0 24px 60px rgba(0,0,0,.28)}
.cxp-ph{display:flex;align-items:flex-start;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line)}
.cxp-phic{flex:0 0 auto;width:36px;height:36px;border-radius:10px;background:var(--headtint);color:var(--head);display:flex;align-items:center;justify-content:center}
.cxp-pht{min-width:0;flex:1}
.cxp-ph h4{margin:0;font-size:15.5px;font-weight:700;color:var(--ink);text-transform:none;letter-spacing:0;line-height:1.35}
.cxp-phd{font-size:11.5px;color:var(--muted);margin-top:4px;line-height:1.45}
.cxp-x{flex:0 0 auto;width:32px;height:32px;border-radius:9px;border:1px solid var(--line);background:transparent;color:var(--muted);font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.cxp-x:hover{border-color:var(--accent);color:var(--ink)}
.cxp-ptabs{display:flex;gap:4px;margin:12px 18px;padding:3px;background:var(--chipbg);border:1px solid var(--line);border-radius:10px}
.cxp-tab{flex:1;font-family:inherit;font-size:11.5px;font-weight:700;color:var(--muted);background:transparent;border:0;border-radius:7px;padding:8px;cursor:pointer}
.cxp-tab.on{background:var(--accent);color:#fff}
.cxp-pbody{padding:2px 18px 4px;font-size:12.8px;line-height:1.6}
.cxp-lead{color:var(--ink);line-height:1.55;margin:2px 0}
.cxp-calc{margin-top:4px;background:var(--card);border:1px solid var(--line);border-left:3px solid #64748B;border-radius:9px;padding:10px 12px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:var(--muted);line-height:1.7}
.cxp-pnote{font-size:12px;color:var(--muted);line-height:1.6;padding:4px 0}
.cxp-psrc{display:flex;align-items:center;gap:6px;padding:13px 18px;font-size:10.5px;color:var(--muted);border-top:1px solid var(--line);margin-top:14px}
.cxp-srclbl{font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.cxp-lk{color:var(--accent);font-weight:650;background:var(--headtint);border-radius:6px;padding:3px 8px}
table.cxp-pt{width:100%;border-collapse:separate;border-spacing:0 6px;font-size:11.5px;margin-top:2px}
table.cxp-pt th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600;padding:0 9px 0}
table.cxp-pt td{padding:8px 9px;background:var(--card);border-top:1px solid var(--line);border-bottom:1px solid var(--line);vertical-align:top}
table.cxp-pt tr:last-child td{border-bottom:1px solid var(--line)}
table.cxp-pt td:first-child{font-family:ui-monospace,Menlo,Consolas,monospace;color:var(--muted);white-space:nowrap;border-left:3px solid #64748B;border-radius:9px 0 0 9px}
table.cxp-pt td:last-child{border-right:1px solid var(--line);border-radius:0 9px 9px 0}
.cxp-cfg{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:100vw;background:var(--paper);border-left:1px solid var(--line);transform:translateX(100%);transition:.2s;z-index:61;display:flex;flex-direction:column;box-shadow:-20px 0 50px rgba(0,0,0,.35)}
.cxp-cfg.show{transform:none}
.cxp-ch{padding:15px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}
.cxp-ch h3{margin:0;font-size:15px;font-weight:700}
.cxp-cb{padding:16px 18px;overflow:auto;flex:1}
.cxp-grp{margin-bottom:20px}
.cxp-grphd{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--accent);margin-bottom:10px}
.cxp-ci{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}
.cxp-ci:last-child{border-bottom:0}
.cxp-cnm{flex:1;font-size:12.5px}
.cxp-ci input[type=number]{width:64px;background:var(--card);border:1px solid var(--line);border-radius:7px;color:var(--ink);padding:5px 7px;font-size:12px;text-align:right;font-family:ui-monospace,Menlo,Consolas,monospace}
.cxp-pair{display:flex;align-items:center;justify-content:space-between;padding:7px 0;font-size:12.5px;color:var(--muted)}
.cxp-pair select,.cxp-ci select{background:var(--card);border:1px solid var(--line);border-radius:7px;color:var(--ink);padding:6px 8px;font-family:inherit;font-size:12.5px}
.cxp-ord{display:flex;flex-direction:column;gap:1px}
.cxp-ord button{background:var(--card);border:1px solid var(--line);color:var(--muted);width:20px;height:15px;line-height:1;border-radius:4px;cursor:pointer;font-size:9px;padding:0}
.cxp-ord button:disabled{opacity:.35;cursor:default}
.cxp-sw{width:36px;height:20px;border-radius:999px;background:var(--line);position:relative;cursor:pointer;flex:0 0 auto;transition:.15s}
.cxp-sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.15s}
.cxp-sw.on{background:var(--accent)} .cxp-sw.on::after{left:18px}
.cxp-cnote{font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5}
.cxp-cf{padding:14px 18px;border-top:1px solid var(--line);display:flex;gap:9px}
@media(max-width:1180px){.cxp-kpis{grid-template-columns:repeat(3,1fr)}.cxp-grid,.cxp-grid3{grid-template-columns:1fr}}
`;
