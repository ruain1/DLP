// CxProgress.jsx
// Weekly Cx Progress: admin-only reporting page driven by an imported Excel pack.
// Separate source of truth from the planning board; stored per week in cx_week.
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { supabase } from "./supabaseClient";

/* ---------- constants ---------- */
const TAGC = { red: "#E2564E", yellow: "#E0A106", green: "#18B69B", blue: "#4F8DF9", white: "#C9D3E0" };
const CARD_KEYS = ["kpi", "scurve", "funnel", "bytype", "issues", "irl", "docs", "milestones", "risks", "attendance"];
const CARD_LABEL = {
  kpi: "KPI tiles", scurve: "Programme S-curve", funnel: "Tag attainment funnel", bytype: "Red tag by equipment type",
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
  ws.eachRow({ includeEmpty: true }, (row, rn) => {
    const a = [];
    row.eachCell({ includeEmpty: true }, (cell, cn) => { a[cn - 1] = cellVal(cell.value); });
    m[rn - 1] = a;
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
        const row = m[r] || []; const v = row[hr[1]]; if (!v || typeof v !== "string") continue;
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
      for (let r = hr[0] + 1; r < m.length; r++) {
        const row = m[r] || []; const wk = row[hr[1]]; if (!wk) continue;
        const present = [], absent = [];
        vendors.forEach(([c, nm]) => { const v = String(row[c] || "").trim().toUpperCase(); if (v === "Y") present.push(nm); else if (v === "N") absent.push(nm); });
        const rate = num(row[rateI]); const inv = present.length + absent.length;
        att.push({ wk: String(wk), rate: rate == null ? (inv ? Math.round(present.length / inv * 100) : null) : Math.round(asPct(rate)), present, absent });
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
        risks.push([txt, String(row[cResp] || ""), dueRaw && row[cRaised] instanceof Date ? fmtDay(row[cRaised]) : String(row[cRaised] || ""), dueD && !isNaN(dueD) ? fmtDay(dueD) : String(dueRaw || ""), String(row[cPri] || ""), overdue]);
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
function svgScurve(series, showPlan) {
  if (!series || !series.length) return '<div class="cxp-empty">No programme data in this import.</div>';
  const W = 760, Hh = 250, pad = { l: 34, r: 14, t: 14, b: 24 }, iw = W - pad.l - pad.r, ih = Hh - pad.t - pad.b, n = series.length;
  const X = (i) => pad.l + iw * i / Math.max(1, n - 1), Y = (v) => pad.t + ih * (1 - (v || 0) / 100);
  const line = (idx) => { let d = "", st = false; for (let i = 0; i < n; i++) { const v = series[i][idx]; if (v == null) continue; d += (st ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1) + " "; st = true; } return d; };
  let todayI = series.findIndex((s) => s[2] == null); if (todayI < 0) todayI = n - 1; else todayI = Math.max(0, todayI - 1);
  let grid = ""; [0, 25, 50, 75, 100].forEach((v) => { grid += `<line x1="${pad.l}" y1="${Y(v)}" x2="${W - pad.r}" y2="${Y(v)}" stroke="var(--line)"/><text x="${pad.l - 6}" y="${Y(v) + 3}" text-anchor="end" font-size="9" fill="var(--muted)">${v}</text>`; });
  let ticks = ""; const step = Math.max(1, Math.round(n / 6)); for (let i = 0; i < n; i += step) ticks += `<text x="${X(i)}" y="${Hh - 7}" text-anchor="middle" font-size="9" fill="var(--muted)">${fmtDay(series[i][0])}</text>`;
  let pts = ""; for (let i = 0; i < n; i += Math.max(1, Math.round(n / 10))) { const a = series[i][2], yv = a != null ? a : (series[i][1] || 0); pts += `<circle cx="${X(i)}" cy="${Y(yv)}" r="6" fill="transparent" data-pop="sc" data-i="${i}" style="cursor:pointer"/><circle cx="${X(i)}" cy="${Y(yv)}" r="3" fill="${a != null ? "var(--green)" : "var(--accent)"}"/>`; }
  const planLayer = showPlan ? `<path d="${line(1)}" fill="none" stroke="var(--accent)" stroke-width="2"/>` :
    `<text x="${(W / 2)}" y="${pad.t + 18}" text-anchor="middle" font-size="11" fill="var(--muted)">Baseline pending: awaiting agreed schedule</text>`;
  return `<svg viewBox="0 0 ${W} ${Hh}" width="100%" style="display:block">${grid}${ticks}` +
    `<line x1="${X(todayI)}" y1="${pad.t}" x2="${X(todayI)}" y2="${Hh - pad.b}" stroke="var(--line)" stroke-dasharray="3 3"/>` +
    `<text x="${X(todayI) + 4}" y="${pad.t + 10}" font-size="9" fill="var(--muted)">today</text>` +
    planLayer + `<path d="${line(2)}" fill="none" stroke="var(--green)" stroke-width="2.4"/>${pts}</svg>`;
}
function svgDonut(parts) {
  const tot = parts.reduce((a, b) => a + b[1], 0) || 1; const R = 46, C = 2 * Math.PI * R, sz = 112; let off = 0, seg = "";
  parts.forEach((p) => { const len = C * p[1] / tot; seg += `<circle cx="${sz / 2}" cy="${sz / 2}" r="${R}" fill="none" stroke="${p[0]}" stroke-width="15" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 ${sz / 2} ${sz / 2})"/>`; off += len; });
  return `<svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">${seg}<text x="${sz / 2}" y="${sz / 2 - 2}" text-anchor="middle" font-size="24" font-weight="740" fill="var(--ink)">${tot}</text><text x="${sz / 2}" y="${sz / 2 + 14}" text-anchor="middle" font-size="9" fill="var(--muted)">in scope</text></svg>`;
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
    return { t: r[0] + "  -  Red tag " + r[1] + "%", b: `<b>${red}</b> of ${r[2]} ${esc(r[0])} assets have earned the Red (L1) tag, ${r[2] - red} still to clear L1.`, calc: `${red} / ${r[2]} = ${r[1]}%`, src: "Tag Attainment", dt: ptable(["Metric", "Value"], [["Assets", r[2]], ["Red-tagged", red], ["Remaining", r[2] - red], ["Attainment", r[1] + "%"]]) }; }
  if (k.indexOf("is-") === 0) { const c = k.slice(3); const n = (D.issuesByType || {})[c] || 0; const rows = (D.issues || []).filter((x) => x[4] === c).map((x) => [x[0], esc(x[1]), esc(x[2] || "-"), x[3]]);
    return { t: c + " issues  -  " + n + " open", b: `In-scope open issues in the ${esc(c)} category (status Open or In progress).`, calc: n + " open", src: "IRL (ACC Issues)", dt: rows.length ? ptable(["ID", "Title", "Company", "Status"], rows) : pnote("Row detail for this category was not in the import.") }; }
  if (k === "doc") { const r = (D.docs && D.docs.rows || [])[+ds.vi]; if (!r) return null; const cols = (D.docs && D.docs.cols) || []; const ci = +ds.ci; const rag = r[1][ci];
    return { t: r[0] + "  -  " + cols[ci], b: `<b>${ragWord[rag]}</b>. ${esc(r[2] || "")}${r[3] ? " Contact " + esc(r[3]) + "." : ""}`, calc: cols[ci] + " status: " + ragWord[rag], src: "Document Register", dt: ptable(["Level", "Status"], cols.map((cc, i) => [cc, ragWord[r[1][i]]])) }; }
  if (k === "sc") { const s = (D.scurve || [])[+ds.i]; if (!s) return null; const plan = s[1], act = s[2]; const av = act == null ? "no data yet" : act + "%"; const vr = act == null ? "-" : ((act - plan >= 0 ? "+" : "") + (act - plan).toFixed(1) + " pts");
    const base = (data.config && data.config.baselineAgreed); const rng = []; const all = D.scurve || []; const i = +ds.i; for (let j = Math.max(0, i - 2); j <= Math.min(all.length - 1, i + 2); j++) rng.push([fmtFull(all[j][0]), base ? all[j][1] + "%" : "pending", all[j][2] == null ? "-" : all[j][2] + "%"]);
    return { t: "Week ending " + fmtFull(s[0]), b: base ? "Planned is the agreed baseline; Actual is recorded L1-L3 tag attainment over the mapped assets." : "Actual is recorded L1-L3 tag attainment. Planned is dormant until the schedule baseline is agreed and instructed.", calc: base ? `Planned ${plan}%   |   Actual ${av}   |   Variance ${vr}` : `Actual ${av}   |   Baseline pending`, src: "Programme", dt: ptable(["Week", "Planned", "Actual"], rng) }; }
  if (k.indexOf("att-") === 0) { const a = (D.attendance || [])[+k.replace("att-", "")]; if (!a) return null;
    if (a.rate == null) return { t: a.wk + "  -  in progress", b: "Attendance for this week has not been marked yet.", calc: "Attended / Invited = pending", src: "Vendor Attendance", dt: pnote("No marks recorded for this week.") };
    const inv = a.present.length + a.absent.length;
    return { t: a.wk + "  -  " + a.rate + "%", b: `<b>Present:</b> ${esc(a.present.join(", ")) || "-"}.<br><b>Absent:</b> ${esc(a.absent.join(", ")) || "-"}.`, calc: a.present.length + " of " + inv + " invited = " + a.rate + "%", src: "Vendor Attendance", dt: ptable(["Vendor", "Attended"], a.present.map((p) => [esc(p), "Y"]).concat(a.absent.map((p) => [esc(p), "N"]))) }; }
  if (k.indexOf("ms-") === 0) { const r = (D.milestones || [])[+k.replace("ms-", "")]; if (!r) return null;
    return { t: esc(r[0]), b: "Programme milestone (provisional until the baseline is agreed).", calc: `Baseline ${r[5] ? fmtFull(r[5]) : "-"}  -  Forecast ${fmtFull(r[1])}  -  Slip ${r[3] == null ? "-" : "+" + r[3] + "d"}  -  ${r[2]}`, src: "Programme", dt: ptable(["Field", "Value"], [["Baseline", r[5] ? fmtFull(r[5]) : "-"], ["Forecast", fmtFull(r[1])], ["Actual", r[6] ? fmtFull(r[6]) : "not set"], ["Slip", r[3] == null ? "-" : "+" + r[3] + " days"], ["Status", r[2]], ["RAG", ragWord[r[4]]]]) }; }
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
    "kpi-issues": { t: "Open Issues (Q+C)", b: "Open or In progress issues in scope (Quality, Commissioning, Snag).", calc: "Open issues = " + (H.open_issues == null ? "-" : H.open_issues), src: "IRL (ACC Issues)", dt: (D.issues || []).length ? ptable(["ID", "Title", "Company", "Status"], (D.issues || []).slice(0, 12).map((x) => [x[0], esc(x[1]), esc(x[2] || "-"), x[3]])) : pnote("No issue rows in this import.") },
    "kpi-verify": { t: "Awaiting verification", b: "Completed by the contractor, not yet Closed by CTS.", calc: "Awaiting verification = " + (H.awaiting_verification == null ? "-" : H.awaiting_verification), src: "IRL (ACC Issues)", dt: pnote((H.awaiting_verification || 0) + " issues Completed and awaiting CTS close.") },
    "fn-red": { t: "L1 Red", b: "Assets that have earned the L1 tag, broken down by type.", calc: (H.red_n || 0) + " of " + A + " = " + (H.red_pct || 0) + "%", src: "Tag Attainment", dt: ptable(["Type", "Assets", "Red #", "Red %"], typeT()) },
    "fn-yellow": { t: "L2 Yellow", b: "Assets that have cleared L2.", calc: (H.yellow_n || 0) + " of " + A, src: "Asset Cx Register", dt: pnote((H.yellow_n || 0) + " assets at L2.") },
    "fn-green": { t: "L3 Green", b: "Assets at L3.", calc: (H.green_n || 0) + " of " + A, src: "Asset Cx Register", dt: pnote((H.green_n || 0) + " assets at L3.") },
    "fn-blue": { t: "L4 Blue", b: "Assets at L4 (FPT). Manual entry.", calc: "0 of " + A, src: "Asset Cx Register", dt: pnote("No assets at L4 yet.") },
    "fn-white": { t: "L5 White", b: "Assets at L5 (handover). Manual entry.", calc: "0 of " + A, src: "Asset Cx Register", dt: pnote("No assets at L5 yet.") },
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
export default function CxProgressPage({ projectId, isAdmin, theme, cu }) {
  const [weeks, setWeeks] = useState([]);          // [{week_ending, ...headline}]
  const [snap, setSnap] = useState(null);          // current full snapshot row
  const [cfg, setCfg] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pop, setPop] = useState(null);            // {t,b,calc,src,dt}
  const [popTab, setPopTab] = useState(0);
  const [cfgOpen, setCfgOpen] = useState(false);
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
    if (!file) return; setBusy(true); setErr("");
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
      if (parsed.warnings.length) setErr("Imported with notes: " + parsed.warnings.join(" | "));
      await loadWeeks(parsed.week_ending);
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

  if (!isAdmin) return <div className="cxp"><div className="cxp-empty">This page is available to administrators only.</div></div>;

  return (
    <div className="cxp" onClick={onDrill}>
      <style>{CXP_CSS}</style>

      <div className="cxp-top">
        <div className="cxp-title">Weekly Cx Progress<small>Asset-based commissioning attainment. Reporting source, separate from the planning board.</small></div>
        <div style={{ flex: 1 }} />
        {snap && <span className="cxp-pill"><span className="cxp-dot" style={{ background: "var(--green)" }} /> ACC refreshed <b>{snap.acc_refreshed ? fmtFull(snap.acc_refreshed) : "-"}</b></span>}
        <select className="cxp-wk" value={(snap && snap.week_ending) || ""} onChange={(e) => setSnap(weeks.find((w) => w.week_ending === e.target.value) || null)}>
          {weeks.length === 0 && <option value="">No imports yet</option>}
          {weeks.map((w) => <option key={w.week_ending} value={w.week_ending}>Week ending {fmtFull(w.week_ending)}</option>)}
        </select>
        <label className="cxp-btn"><input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; onImport(f); }} />{busy ? "Importing\u2026" : "Import workbook"}</label>
        <button className="cxp-btn prime" onClick={(e) => { e.stopPropagation(); setCfgOpen(true); }}>Configure</button>
      </div>

      {err && <div className="cxp-err">{err}</div>}
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
        if (key === "kpi") return <KPIs key="kpi" s={snap} />;
        if (key === "scurve" || key === "funnel") {
          if (key === "funnel") return null; // rendered with scurve as a pair
          return (
            <div className="cxp-grid" key="row1">
              {show("scurve") && <Panel title="Programme S-curve  -  planned vs actual (L1-L3)" right={<Legend />}><div dangerouslySetInnerHTML={{ __html: svgScurve(snap.detail.scurve, cfg.baselineAgreed) }} /></Panel>}
              {show("funnel") && <Funnel s={snap} />}
            </div>
          );
        }
        if (key === "bytype" || key === "issues" || key === "irl") {
          if (key !== "bytype") return null;
          return (
            <div className="cxp-grid3" key="row2">
              {show("bytype") && <ByType s={snap} />}
              {show("issues") && <Issues s={snap} />}
              {show("irl") && <IRL s={snap} />}
            </div>
          );
        }
        if (key === "docs" || key === "milestones") {
          if (key !== "docs") return null;
          return (
            <div className="cxp-grid" key="row3">
              {show("docs") && <Docs s={snap} />}
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
          <div className="cxp-ph"><h4 dangerouslySetInnerHTML={{ __html: pop.t }} /><button className="cxp-x" onClick={() => setPop(null)}>{"\u2715"}</button></div>
          <div className="cxp-ptabs"><button className={"cxp-pt" + (popTab === 0 ? " on" : "")} onClick={() => setPopTab(0)}>Overview</button><button className={"cxp-pt" + (popTab === 1 ? " on" : "")} onClick={() => setPopTab(1)}>Underlying data</button></div>
          <div className="cxp-pbody" dangerouslySetInnerHTML={{ __html: popTab === 0 ? (pop.b + (pop.calc ? '<div class="cxp-calc">' + pop.calc.replace(/\n/g, "<br>") + "</div>" : "")) : (pop.dt || pnote("No row-level detail.")) }} />
          <div className="cxp-psrc"><span>Source</span> <span className="cxp-lk">{pop.src}</span> sheet</div>
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

function KPIs({ s }) {
  const tiles = [
    ["kpi-assets", "Cx Assets", (s.assets || 0).toLocaleString(), "var(--accent)", (s.mapped_assets || 0) + " mapped to programme", null],
    ["kpi-red", "Red tag (L1)", (s.red_pct || 0) + "%", TAGC.red, (s.new_red_7d ? "+" + s.new_red_7d + " in last 7d" : "L1 attainment"), "up"],
    ["kpi-yellow", "Yellow tag (L2)", (s.yellow_pct || 0) + "%", TAGC.yellow, (s.yellow_n || 0) + " of " + (s.assets || 0), null],
    ["kpi-green", "Green tag (L3)", (s.green_pct || 0) + "%", TAGC.green, "L3 SAT", null],
    ["kpi-issues", "Open Issues (Q+C)", s.open_issues == null ? "-" : s.open_issues, "var(--accent)", (s.issues_raised_7d != null ? "+" + s.issues_raised_7d + " raised / " + (s.issues_resolved_7d || 0) + " resolved" : ""), null],
    ["kpi-verify", "Awaiting verification", s.awaiting_verification == null ? "-" : s.awaiting_verification, TAGC.yellow, "contractor done, CTS to close", null],
  ];
  return <div className="cxp-kpis">{tiles.map(([k, lab, val, col, sub]) => (
    <div className="cxp-kpi" data-pop={k} key={k}><span className="cxp-ab" style={{ background: col }} /><div className="cxp-lab">{lab}</div><div className="cxp-val" style={{ color: col }}>{val}</div><div className="cxp-sub">{sub}</div></div>
  ))}</div>;
}
function Funnel({ s }) {
  const A = s.assets || 0; const rows = [["red", "L1 Red", s.red_n, s.red_pct], ["yellow", "L2 Yellow", s.yellow_n, s.yellow_pct], ["green", "L3 Green", s.green_n, s.green_pct], ["blue", "L4 Blue", s.blue_n || 0, s.blue_pct || 0], ["white", "L5 White", s.white_n || 0, s.white_pct || 0]];
  return <div className="cxp-panel"><div className="cxp-phead"><h3>Tag attainment funnel</h3><div className="cxp-meta">of {A.toLocaleString()} assets</div></div>
    <div className="cxp-funnel">{rows.map(([k, nm, n, p]) => (
      <div className="cxp-frow" data-pop={"fn-" + k} key={k}><div className="cxp-fnm">{nm}</div><div className="cxp-bar"><i style={{ width: Math.max(1.5, p || 0) + "%", background: TAGC[k] }} /><span className="cxp-pc">{p || 0}%</span></div><div className="cxp-tn">{n || 0}</div></div>
    ))}</div>
    <div className="cxp-note">A tag is earned when every activity for that level reads YES across the asset.</div></div>;
}
function ByType({ s }) {
  const by = (s.detail.byType || []).slice(0, 9);
  return <div className="cxp-panel"><div className="cxp-phead"><h3>Red tag by equipment type</h3><div className="cxp-meta">top movers</div></div>
    {by.length === 0 ? <div className="cxp-note">No tag-by-type data.</div> : by.map((r, i) => (
      <div className="cxp-tbar" data-pop="ty" data-i={i} key={r[0]}><div className="cxp-fnm">{r[0]}</div><div className="cxp-track"><i style={{ width: (r[1] || 0) + "%" }} /></div><div className="cxp-tm">{r[1]}% &middot; {r[2]} assets</div></div>
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
function Docs({ s }) {
  const d = s.detail.docs || { cols: [], rows: [] };
  return <div className="cxp-panel"><div className="cxp-phead"><h3>Documentation register</h3><div className="cxp-meta">RAG by vendor and level</div></div>
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
  return <div className="cxp-panel"><div className="cxp-phead"><h3>Risk register</h3><div className="cxp-meta">{rk.length} open{overdue ? " \u00B7 " + overdue + " overdue" : ""}</div></div>
    {rk.length === 0 ? <div className="cxp-note">No Risks sheet in the import. Add a sheet named Risks with columns Risk, Responsible, Raised, Due, Priority.</div> :
      <table className="cxp-rtable"><tbody><tr><th>Risk</th><th>Responsible</th><th>Raised</th><th>Due</th><th>Priority</th></tr>
        {rk.map((r, i) => (
          <tr data-pop="rk" data-ri={i} key={i}><td className="cxp-rk">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td className={r[5] ? "cxp-od" : ""}>{r[3]}</td><td><span className={"cxp-tag t-" + (/crit/i.test(r[4]) ? "r" : /high/i.test(r[4]) ? "a" : "g")}>{r[4] || "-"}</span></td></tr>
        ))}</tbody></table>}</div>;
}
function Attendance({ s }) {
  const att = s.detail.attendance || []; const max = 100;
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
.cxp{padding:18px 20px 40px;color:var(--ink);font-family:var(--body)}
.cxp-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.cxp-title{font-size:20px;font-weight:750;letter-spacing:-.01em}
.cxp-title small{display:block;font-size:11.5px;font-weight:500;color:var(--muted);margin-top:2px}
.cxp-pill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:5px 11px}
.cxp-pill b{color:var(--ink);font-weight:600}
.cxp-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.cxp-btn,.cxp-wk{font-family:inherit;font-size:12.5px;font-weight:600;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:9px;padding:8px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.cxp-btn:hover{border-color:var(--accent)}
.cxp-btn.prime{background:var(--accent);border-color:var(--accent);color:#fff}
.cxp-err{background:rgba(224,161,6,.12);border:1px solid var(--amber);color:var(--ink);border-radius:10px;padding:10px 13px;font-size:12.5px;margin-bottom:14px}
.cxp-empty{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:34px;text-align:center;color:var(--ink)}
.cxp-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:14px}
.cxp-kpi{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 14px;position:relative;overflow:hidden;cursor:pointer}
.cxp-kpi:hover{border-color:var(--accent)}
.cxp-ab{position:absolute;left:0;top:0;bottom:0;width:3px}
.cxp-lab{font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.cxp-val{font-size:28px;font-weight:760;letter-spacing:-.02em;margin-top:7px;line-height:1}
.cxp-sub{font-size:11px;color:var(--muted);margin-top:8px}
.cxp-grid{display:grid;grid-template-columns:1.55fr 1fr;gap:14px;margin-bottom:14px}
.cxp-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px}
.cxp-panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:15px 16px;min-width:0}
.cxp-phead{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px}
.cxp-phead h3{margin:0;font-size:13.5px;font-weight:680}
.cxp-meta{font-size:11px;color:var(--muted)}
.cxp-legend{display:flex;gap:12px;font-size:11px;color:var(--muted)}
.cxp-legend span{display:inline-flex;align-items:center;gap:6px}
.cxp-legend i{width:11px;height:3px;border-radius:2px}
.cxp-note{font-size:11px;color:var(--muted);margin-top:12px;line-height:1.5}
.cxp-funnel{display:flex;flex-direction:column;gap:10px}
.cxp-frow{display:grid;grid-template-columns:72px 1fr 56px;align-items:center;gap:10px;cursor:pointer}
.cxp-frow:hover .cxp-bar,.cxp-tbar:hover .cxp-track{outline:1px solid var(--accent);outline-offset:2px}
.cxp-fnm{font-size:11.5px;font-weight:600}
.cxp-tn{font-size:11.5px;color:var(--muted);text-align:right}
.cxp-bar{height:22px;border-radius:7px;background:var(--chipbg);position:relative;overflow:hidden;border:1px solid var(--line)}
.cxp-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:7px}
.cxp-pc{position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:10.5px;font-weight:700;color:var(--ink)}
.cxp-tbar{display:grid;grid-template-columns:84px 1fr 96px;align-items:center;gap:9px;margin-bottom:8px;cursor:pointer}
.cxp-track{height:9px;border-radius:5px;background:var(--chipbg);border:1px solid var(--line);overflow:hidden}
.cxp-track i{display:block;height:100%;border-radius:5px;background:${TAGC.red}}
.cxp-tm{font-size:10.5px;color:var(--muted);text-align:right}
.cxp-donutwrap{display:flex;align-items:center;gap:16px}
.cxp-dleg{display:flex;flex-direction:column;gap:7px;font-size:11.5px}
.cxp-dleg span{display:flex;align-items:center;gap:7px;color:var(--muted);cursor:pointer}
.cxp-dleg b{color:var(--ink);margin-left:auto}
.cxp-dleg span:hover{color:var(--ink)}
.cxp-flow{display:flex;gap:8px}
.cxp-fstep{flex:1;background:var(--chipbg);border:1px solid var(--line);border-radius:10px;padding:11px 8px;text-align:center;position:relative;cursor:pointer}
.cxp-fstep:hover{border-color:var(--accent)}
.cxp-n{font-size:22px;font-weight:740;line-height:1}
.cxp-fl{font-size:10px;color:var(--muted);margin-top:5px;text-transform:uppercase;letter-spacing:.03em}
.cxp-arr{position:absolute;right:-9px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px}
.cxp-matrix{width:100%;border-collapse:separate;border-spacing:0 5px;font-size:11.5px}
.cxp-matrix th{font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600;text-align:center;padding-bottom:4px}
.cxp-matrix td{text-align:center;padding:0 2px}
.cxp-matrix td.cxp-nm{text-align:left;font-weight:600;padding-right:8px}
.cxp-cell{display:inline-flex;align-items:center;justify-content:center;width:100%;height:26px;border-radius:7px;font-weight:700;font-size:10.5px;cursor:pointer}
.c-g{background:rgba(24,182,155,.16);color:var(--green)} .c-a{background:rgba(224,161,6,.16);color:var(--amber)} .c-r{background:rgba(226,86,78,.16);color:var(--red)} .c-x{background:var(--chipbg);color:var(--muted)}
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
.cxp-spark{display:flex;align-items:flex-end;gap:5px;height:42px}
.cxp-spark i{flex:1;background:var(--accent);border-radius:3px 3px 0 0;min-height:4px;cursor:pointer;opacity:.85}
.cxp-spark i.open{background:var(--line)}
.cxp-spark i:hover{opacity:1}
.cxp-attmeta{display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);margin-top:6px}
.cxp-foot{font-size:11px;color:var(--muted);margin-top:6px}
.cxp-scrim{position:fixed;inset:0;background:rgba(4,8,14,.5);opacity:0;pointer-events:none;transition:.15s;z-index:60}
.cxp-scrim.show{opacity:1;pointer-events:auto}
.cxp-pop{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:460px;max-width:calc(100vw - 32px);background:var(--paper);border:1px solid var(--line);border-radius:16px;z-index:61;box-shadow:0 30px 70px rgba(0,0,0,.4)}
.cxp-ph{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px 8px}
.cxp-ph h4{margin:0;font-size:15px;font-weight:720;line-height:1.3}
.cxp-x{background:none;border:0;color:var(--muted);font-size:16px;cursor:pointer}
.cxp-ptabs{display:flex;gap:4px;padding:2px 18px 0}
.cxp-pt{flex:1;font-family:inherit;font-size:11.5px;font-weight:650;color:var(--muted);background:var(--chipbg);border:1px solid var(--line);border-bottom:0;border-radius:8px 8px 0 0;padding:7px;cursor:pointer}
.cxp-pt.on{color:var(--ink);background:var(--paper)}
.cxp-pbody{padding:10px 18px 6px;font-size:12.8px;line-height:1.6}
.cxp-calc{margin-top:11px;background:var(--chipbg);border:1px solid var(--line);border-radius:9px;padding:9px 11px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:var(--muted)}
.cxp-pnote{font-size:12px;color:var(--muted);line-height:1.6;padding:4px 0}
.cxp-pt2,.cxp-pt{}
.cxp-psrc{padding:11px 18px 16px;font-size:10.5px;color:var(--muted);border-top:1px solid var(--line);margin-top:10px}
.cxp-lk{color:var(--accent)}
.cxp-pt-table{}
table.cxp-pt{width:100%;border-collapse:collapse;font-size:11px;margin-top:2px}
table.cxp-pt th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:600;padding:5px 7px;border-bottom:1px solid var(--line)}
table.cxp-pt td{padding:6px 7px;border-bottom:1px solid var(--line);vertical-align:top}
table.cxp-pt tr:last-child td{border-bottom:0}
table.cxp-pt td:first-child{font-family:ui-monospace,Menlo,Consolas,monospace;color:var(--muted);white-space:nowrap}
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
