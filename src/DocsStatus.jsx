// DocsStatus.jsx
// REV139: Documentation Tracker. Equipment-type x document matrix driven by
// FINO4_Docs_Master_LIVE.xlsm (sheet "Documentation status"), populated by the
// same SharePoint sync as Asset Status (see sharepoint.js, reused unchanged).
// Columns are keyed by a composite level + header, never by header alone,
// because "PQM Data" appears under two tag levels; a header-only key would
// silently merge them. The header renders as a single measured canvas so long
// labels are never covered by a neighbouring cell, at 90, 60, or 45 degrees.
import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadDocsStatus, saveDocsMatrix, saveDocsStatusConfig, saveDocsOverride, deleteDocsOverride, computeDocsConflicts } from "./data";

/* ---------- constants ---------- */
const TAGC = { L1: "#E2564E", L2: "#E0A106", L3: "#18B69B", L4: "#4F8DF9", L5: "#94A3B8" };
const STAGE_NAME = { L1: "Red Tag", L2: "Yellow Tag", L3: "Green Tag", L4: "Blue Tag", L5: "White Tag" };
const STAGE_ORDER = ["L1", "L2", "L3", "L4", "L5"];
const RESP_DEF = { "VEN": "Vendor", "VEN/CON": "Vendor / Contractor", "GC CON": "General Contractor - Construction", "GC QC": "General Contractor - Quality Control", "GC CX": "General Contractor - Commissioning", "GC DES": "General Contractor - Design", "ELEC CON": "Electrical Contractor", "MECH CON": "Mechanical Contractor", "BMS CON": "BMS Contractor", "EPMS CON": "EPMS Contractor", "IR CON": "Infrared (Thermography) Contractor", "CON": "Contractor (general)", "CxA": "Commissioning Authority" };
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------- shared parser (upload + SharePoint) ----------
   Input: 2D array of raw cell values.
   Output: { rows, columns, warnings }.
   The header row is the one whose first cell is "Equipment Type". The row below
   it carries the tag levels (L1 RED TAG .. L5 WHITE TAG), forward-filled across
   merged cells; the row below that carries the responsible party per column.
   Data rows follow until the first blank equipment name. The Overall sign-off
   column has no header, so it is found by content: the cell holding a tick or a
   cross. Cell codes: 'y' received (TRUE), 'n' outstanding (FALSE), 'a' not
   applicable (n/a). */
function txt(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") { if (v.result !== undefined) v = v.result; else if (v.text !== undefined) v = v.text; else if (v.richText) v = v.richText.map((t) => t.text).join(""); }
  return String(v).trim();
}
function cellCode(v) {
  if (v === true) return "y";
  if (v === false) return "n";
  const s = txt(v).toLowerCase();
  if (s === "true") return "y";
  if (s === "false") return "n";
  if (s === "n/a" || s === "na" || s === "") return "a";
  return "a";
}
const TICK = /[\u2714\u2713\u2611]/;   // check marks
export function parseDocsValues(values) {
  const warnings = [];
  const rows = [], columns = [];
  if (!values || !values.length) return { rows, columns, warnings: ["Empty sheet."] };
  let hi = -1;
  for (let i = 0; i < values.length; i++) { if (/^equipment type$/i.test(txt((values[i] || [])[0]))) { hi = i; break; } }
  if (hi === -1) return { rows, columns, warnings: ["Header row (Equipment Type) not found."] };
  const hdr = values[hi] || [], tagRow = values[hi + 1] || [], respRow = values[hi + 2] || [];
  // forward-fill the tag levels across merged cells
  let curLvl = null; const lvlAt = [];
  for (let c = 0; c < hdr.length; c++) {
    const m = txt(tagRow[c]).match(/L([1-5])/i);
    if (m) curLvl = "L" + m[1];
    lvlAt[c] = curLvl;
  }
  // doc columns are the non-empty headers from column B onward that sit under a level
  let sort = 0, lastDocCol = 0;
  for (let c = 1; c < hdr.length; c++) {
    const name = txt(hdr[c]);
    if (!name) continue;
    const level = lvlAt[c];
    if (!level) continue;   // beyond the last tag band (e.g. the headerless Overall column)
    const responsible = txt(respRow[c]);
    columns.push({ doc_key: level + "|" + name, doc_name: name, level, responsible, sort_order: sort++, col: c });
    lastDocCol = c;
  }
  if (!columns.length) warnings.push("No document columns detected under the tag bands.");
  // data rows until the first blank equipment name
  for (let r = hi + 3; r < values.length; r++) {
    const row = values[r] || [];
    const equip = txt(row[0]);
    if (!equip) break;
    const status = {};
    columns.forEach((col) => { status[col.doc_key] = cellCode(row[col.col]); });
    // Overall: scan the cells after the last doc column for a tick / cross.
    let overall = false;
    for (let c = lastDocCol + 1; c < row.length; c++) { const t = txt(row[c]); if (t) { overall = TICK.test(t); break; } }
    rows.push({ equip_type: equip, status, overall, sort_order: r - (hi + 3) });
  }
  if (!rows.length) warnings.push("No equipment rows detected.");
  return { rows, columns, warnings };
}

/* ---------- label measuring (browser canvas, char-count fallback for jsdom) ---------- */
let _measCanvas = null;
function measureLabel(t) {
  try {
    _measCanvas = _measCanvas || document.createElement("canvas");
    const ctx = _measCanvas.getContext("2d");
    if (!ctx) return t.length * 6.2;
    ctx.font = '700 11px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    return ctx.measureText(t).width || t.length * 6.2;
  } catch (e) { return t.length * 6.2; }
}

export default function DocsStatusPage({ projectId, isAdmin, theme, cu, canEditDocs, usersById }) {
  const [matrix, setMatrix] = useState([]);
  const [columns, setColumns] = useState([]);
  const [config, setConfig] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [vendors, setVendors] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [spAcct, setSpAcct] = useState("");

  const [q, setQ] = useState("");
  const [fLevel, setFLevel] = useState("");
  const [fResp, setFResp] = useState("");
  const [fVendor, setFVendor] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [grpBy, setGrpBy] = useState("none");
  const [closed, setClosed] = useState({});
  const [tagFilter, setTagFilter] = useState(null);
  const [focus, setFocus] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [deg, setDeg] = useState(() => { const v = Number(typeof localStorage !== "undefined" && localStorage.getItem("docsHeaderAngle")); return v === 90 || v === 45 ? v : 60; });
  const [syncOpen, setSyncOpen] = useState(false);
  const [refOpen, setRefOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [cfgUrl, setCfgUrl] = useState("");
  const [cfgSheet, setCfgSheet] = useState("Documentation status");

  useEffect(() => { try { localStorage.setItem("docsHeaderAngle", String(deg)); } catch (e) { /* noop */ } }, [deg]);

  const reload = async () => {
    setLoading(true);
    const r = await loadDocsStatus(projectId);
    if (r.error) setErr(r.error);
    const ovByType = {};
    (r.overrides || []).forEach((o) => { (ovByType[o.equip_type] = ovByType[o.equip_type] || {})[o.doc_key] = o; });
    setMatrix((r.matrix || []).map((row) => {
      const status = { ...(row.status || {}) };
      let overall = !!row.overall;
      const om = ovByType[row.equip_type] || {};
      Object.keys(om).forEach((k) => { if (k === "__overall__") overall = om[k].value === "y"; else status[k] = om[k].value; });
      return { equip_type: row.equip_type, status, overall, sort_order: row.sort_order || 0, ovr: om };
    }).sort((a, b) => a.sort_order - b.sort_order || a.equip_type.localeCompare(b.equip_type)));
    setColumns((r.columns || []).slice().sort((a, b) => a.sort_order - b.sort_order));
    setOverrides(r.overrides || []);
    const vm = {}; (r.vendors || []).forEach((v) => { vm[v.equip_type] = v.vendor; });
    setVendors(vm);
    setConfig(r.config);
    setCfgUrl((r.config && r.config.file_url) || "");
    setCfgSheet((r.config && r.config.sheet_name) || "Documentation status");
    setLoading(false);
    try { const sp = await import("./sharepoint"); sp.initSharePoint(r.config || undefined); const a = await sp.sharePointAccount(); if (a) setSpAcct(a.username || ""); } catch (e) { /* optional */ }
  };
  useEffect(() => { reload(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- import / sync ---------- */
  const applyParsed = async (parsed, source, extra) => {
    const r = await saveDocsMatrix(projectId, parsed.rows, parsed.columns, source);
    if (r.error) { setErr("Import failed: " + r.error); return; }
    const conflicts = computeDocsConflicts(overrides, parsed.rows);
    setSummary({ source, ...r, warnings: parsed.warnings, conflicts, ...(extra || {}) });
    await reload();
  };
  const onSync = async () => {
    setBusy(true); setErr("");
    try {
      const sp = await import("./sharepoint");
      sp.initSharePoint(config || undefined);
      const fileUrl = config && config.file_url;
      if (!fileUrl) throw new Error("No SharePoint file URL is configured. Open Sync Settings and paste the file's browser URL.");
      const r = await sp.readSharePointRegister(fileUrl, (config && config.sheet_name) || "Documentation status");
      await applyParsed(parseDocsValues(r.values), "sharepoint", { fileName: r.fileName, lastModified: r.lastModified });
      setSyncOpen(false);
    } catch (e) { setErr("Sync failed: " + (e && e.message ? e.message : e)); }
    setBusy(false);
  };
  const onUpload = async (file) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const _xl = await import("exceljs/dist/exceljs.min.js");
      const ExcelJS = _xl.default || _xl;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      let ws = wb.getWorksheet((config && config.sheet_name) || "Documentation status");
      if (!ws) ws = wb.worksheets.find((w) => /documentation status/i.test(w.name));
      if (!ws) throw new Error('Worksheet "Documentation status" not found in the workbook.');
      const values = [];
      ws.eachRow({ includeEmpty: true }, (row) => { const arr = []; row.eachCell({ includeEmpty: true }, (cell, cn) => { arr[cn - 1] = cell.value; }); values.push(arr); });
      await applyParsed(parseDocsValues(values), "upload");
    } catch (e) { setErr("Import failed: " + (e && e.message ? e.message : e)); }
    setBusy(false);
  };
  const onConnectSp = async () => { try { const sp = await import("./sharepoint"); sp.initSharePoint(config || undefined); await sp.connectSharePoint(); const a = await sp.sharePointAccount(); if (a) setSpAcct(a.username || ""); } catch (e) { setErr("Connect failed: " + (e && e.message ? e.message : e)); } };
  const onSaveCfg = async () => { setBusy(true); const msg = await saveDocsStatusConfig(projectId, { file_url: cfgUrl.trim(), sheet_name: cfgSheet.trim() || "Documentation status" }); setBusy(false); if (msg) { setErr(msg); return; } await reload(); };

  /* ---------- edit mode (admin) ---------- */
  const cyc = (c) => (c === "y" ? "n" : c === "n" ? "a" : "y");
  const applyLocalCell = (equip, docKey, value) => setMatrix((prev) => prev.map((r) => r.equip_type === equip ? { ...r, status: { ...r.status, [docKey]: value }, ovr: { ...(r.ovr || {}), [docKey]: { value, set_by: cu && cu.id, set_at: new Date().toISOString() } } } : r));
  const applyLocalOverall = (equip, value) => setMatrix((prev) => prev.map((r) => r.equip_type === equip ? { ...r, overall: value === "y", ovr: { ...(r.ovr || {}), __overall__: { value, set_by: cu && cu.id, set_at: new Date().toISOString() } } } : r));
  const writeCell = async (equip, docKey, value) => { applyLocalCell(equip, docKey, value); const msg = await saveDocsOverride(projectId, equip, docKey, value); if (msg) { setErr("Could not save: " + msg); await reload(); } };
  const writeOverall = async (equip, value) => { applyLocalOverall(equip, value); const msg = await saveDocsOverride(projectId, equip, "__overall__", value); if (msg) { setErr("Could not save: " + msg); await reload(); } };
  const onCellClick = (e, row, col) => { e.stopPropagation(); if (!(canEditDocs && editMode)) return; writeCell(row.equip_type, col.doc_key, cyc(row.status[col.doc_key] || "a")); };
  const onOverallClick = (e, row) => { e.stopPropagation(); if (!(canEditDocs && editMode)) return; writeOverall(row.equip_type, row.overall ? "n" : "y"); };
  const applyConflictDecisions = async (dec) => { setBusy(true); for (const k of Object.keys(dec)) { if (dec[k] === "override") { const i = k.indexOf("||"); await deleteDocsOverride(projectId, k.slice(0, i), k.slice(i + 2)); } } setBusy(false); setSummary(null); await reload(); };

  /* ---------- derived ---------- */
  const resps = useMemo(() => [...new Set(columns.map((c) => c.resp || c.responsible).filter(Boolean))].sort(), [columns]);
  const vendorList = useMemo(() => [...new Set(matrix.map((r) => vendors[r.equip_type] || "TBC"))].sort(), [matrix, vendors]);
  const visibleCols = useMemo(() => columns.filter((c) => (!fLevel || c.level === fLevel) && (!fResp || (c.resp || c.responsible) === fResp)), [columns, fLevel, fResp]);
  const rowStats = (r) => { let y = 0, ap = 0; columns.forEach((c) => { const s = r.status[c.doc_key]; if (s && s !== "a") { ap++; if (s === "y") y++; } }); return { y, ap, pct: ap ? Math.round(100 * y / ap) : 0, out: ap - y }; };
  const colPct = (c) => { let y = 0, ap = 0; matrix.forEach((r) => { const s = r.status[c.doc_key]; if (s && s !== "a") { ap++; if (s === "y") y++; } }); return ap ? Math.round(100 * y / ap) : 0; };
  const levelStat = (lv) => { let y = 0, ap = 0; const keys = columns.filter((c) => c.level === lv).map((c) => c.doc_key); matrix.forEach((r) => keys.forEach((k) => { const s = r.status[k]; if (s && s !== "a") { ap++; if (s === "y") y++; } })); return { y, ap, pct: ap ? Math.round(100 * y / ap) : 0 }; };

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return matrix.filter((r) => {
      const vend = vendors[r.equip_type] || "TBC";
      if (ql && !(r.equip_type.toLowerCase().includes(ql) || vend.toLowerCase().includes(ql) || columns.some((c) => c.doc_name.toLowerCase().includes(ql)))) return false;
      if (fVendor && vend !== fVendor) return false;
      const st = rowStats(r);
      if (fStatus === "out" && st.out === 0) return false;
      if (fStatus === "signed" && !r.overall) return false;
      if (fStatus === "notsigned" && r.overall) return false;
      if (tagFilter) { const keys = columns.filter((c) => c.level === tagFilter).map((c) => c.doc_key); if (!keys.some((k) => r.status[k] && r.status[k] !== "a")) return false; }
      return true;
    });
  }, [matrix, q, fVendor, fStatus, tagFilter, columns, vendors]); // eslint-disable-line react-hooks/exhaustive-deps

  const leadLevel = (r) => { for (const lv of STAGE_ORDER) { const keys = columns.filter((c) => c.level === lv).map((c) => c.doc_key); if (keys.some((k) => r.status[k] === "n")) return lv + " " + STAGE_NAME[lv]; } return "All received"; };
  const groups = useMemo(() => {
    if (grpBy === "none") return null;
    const g = {}; filtered.forEach((r) => { const k = grpBy === "vendor" ? (vendors[r.equip_type] || "Vendor TBC") : leadLevel(r); (g[k] = g[k] || []).push(r); });
    return Object.keys(g).sort().map((k) => ({ key: k, rows: g[k] }));
  }, [filtered, grpBy, vendors, columns]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- measured canvas header geometry ---------- */
  const geom = useMemo(() => {
    const rad = deg * Math.PI / 180, si = Math.sin(rad), co = Math.cos(rad), f = 14, PAD = 14, W = 32, OVW = 48;
    let maxW = 0; visibleCols.forEach((c) => { const w = measureLabel(c.doc_name); if (w > maxW) maxW = w; });
    if (!maxW) maxW = 120;
    const H = Math.ceil(maxW * si + f * co) + 8 + PAD;
    const S = Math.ceil(maxW * co + f * si) + PAD;
    return { H, S, W, OVW };
  }, [visibleCols, deg]);

  const kpis = useMemo(() => {
    let y = 0, ap = 0, out = 0, signed = 0, tbc = 0;
    filtered.forEach((r) => { const s = rowStats(r); y += s.y; ap += s.ap; out += s.out; if (r.overall) signed++; if ((vendors[r.equip_type] || "TBC") === "TBC") tbc++; });
    return { types: filtered.length, pct: ap ? Math.round(100 * y / ap) : 0, y, ap, out, signed, tbc };
  }, [filtered, columns, vendors]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncedAt = useMemo(() => (config && config.updated_at) || null, [config]);
  const dark = theme === "dark";

  const onExport = async () => {
    try {
      const _xl = await import("exceljs/dist/exceljs.min.js");
      const ExcelJS = _xl.default || _xl;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Documentation status");
      const cols = [{ header: "Equipment Type", key: "equip", width: 34 }, { header: "Vendor", key: "vendor", width: 14 }];
      visibleCols.forEach((c) => cols.push({ header: c.level + " " + c.doc_name, key: c.doc_key, width: 12 }));
      cols.push({ header: "Overall", key: "overall", width: 9 });
      ws.columns = cols; ws.getRow(1).font = { bold: true };
      filtered.forEach((r) => { const row = { equip: r.equip_type, vendor: vendors[r.equip_type] || "TBC", overall: r.overall ? "Y" : "N" }; visibleCols.forEach((c) => { const s = r.status[c.doc_key]; row[c.doc_key] = s === "y" ? "TRUE" : s === "n" ? "FALSE" : "n/a"; }); ws.addRow(row); });
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = "FIN04-documentation-status-" + todayISO() + ".xlsx"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setErr("Export failed: " + (e && e.message ? e.message : e)); }
  };

  if (loading) return <div className={"dts" + (dark ? " dts-dark" : "")}><style>{DOCS_CSS}</style><div className="dts-empty">Loading Documentation Tracker&hellip;</div></div>;

  const empty = !matrix.length;
  const dotCls = { y: "dts-d yes", n: "dts-d no", a: "dts-d na" };

  /* ---------- header canvas ---------- */
  const bands = []; { let cur = null; visibleCols.forEach((c) => { if (!cur || cur.lv !== c.level) { cur = { lv: c.level, n: 1 }; bands.push(cur); } else cur.n++; }); }
  const renderRow = (r) => {
    const st = rowStats(r); const vend = vendors[r.equip_type] || "TBC"; const vset = vend && vend !== "TBC";
    const [tag, ...rest] = r.equip_type.split(" - ");
    return (
      <tr className="dts-erow" key={r.equip_type}>
        <td className="dts-id">
          <div className="dts-idtop"><span className="tg">{tag}</span><span className="idsub">{rest.join(" - ")}</span></div>
          <div className="dts-idbot"><span className={"vchip " + (vset ? "set" : "tbc")}>{vset ? vend : "Vendor TBC"}</span><span className="rowpct">{st.pct}% received, {st.out} outstanding</span></div>
        </td>
        {visibleCols.map((c) => { const s = r.status[c.doc_key] || "a"; const ov = r.ovr && r.ovr[c.doc_key]; return (
          <td key={c.doc_key} className={"dts-cp" + (focus === c.doc_key ? " fcol" : "") + (canEditDocs && editMode ? " editable" : "")} onClick={(e) => onCellClick(e, r, c)} title={ov ? "Manual override" : undefined}><span className={dotCls[s]} /></td>
        ); })}
        <td className={"dts-ov " + (r.overall ? "yes" : "no") + (canEditDocs && editMode ? " editable" : "")} onClick={(e) => onOverallClick(e, r)}>{r.overall ? "\u2714" : "\u2718"}</td>
        <td className="dts-sp" />
      </tr>
    );
  };

  return (
    <div className={"dts" + (dark ? " dts-dark" : "")}>
      <style>{DOCS_CSS}</style>

      <div className="dts-top">
        <div className="dts-title">Documentation Tracker<small>Equipment documentation matrix from the Cx Master.{syncedAt ? " Data as of " + new Date(syncedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</small></div>
        <div style={{ flex: 1 }} />
        {isAdmin && <label className="dts-btn"><input type="file" accept=".xlsx,.xlsm" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; onUpload(f); }} />{busy ? "Working\u2026" : "Import Workbook"}</label>}
        {isAdmin && <button className="dts-btn" onClick={() => setSyncOpen(true)}>{"\u21BB"} Sync From SharePoint</button>}
        <button className="dts-btn" onClick={onExport} disabled={empty}>Export</button>
        <button className="dts-btn" onClick={() => setRefOpen(true)}>Reference</button>
        {canEditDocs && <button className={"dts-btn admin" + (editMode ? " on" : "")} onClick={() => setEditMode((v) => !v)}>Edit Mode</button>}
      </div>

      {err && <div className="dts-err">{err}<button onClick={() => setErr("")}>{"\u00D7"}</button></div>}

      {empty ? (
        <div className="dts-empty">
          <p>No documentation data yet.</p>
          {isAdmin ? <p>Import the workbook, or open Sync From SharePoint to pull FINO4_Docs_Master_LIVE.xlsm.</p> : <p>Ask an administrator to sync the Documentation Tracker.</p>}
        </div>
      ) : (
        <>
          <div className="dts-kpis">
            <div className="dts-kpi"><div className="v">{kpis.types}</div><div className="l">Equipment Types</div><div className="s">in view</div></div>
            <div className={"dts-kpi " + (kpis.pct >= 66 ? "good" : kpis.pct < 33 ? "warn" : "")}><div className="v">{kpis.pct}%</div><div className="l">Received</div><div className="s">{kpis.y} of {kpis.ap} applicable</div></div>
            <div className={"dts-kpi " + (kpis.out ? "warn" : "good")}><div className="v">{kpis.out}</div><div className="l">Outstanding</div><div className="s">applicable, not received</div></div>
            <div className="dts-kpi"><div className="v">{kpis.signed} / {kpis.types}</div><div className="l">Signed Off</div><div className="s">overall flag set</div></div>
            <div className={"dts-kpi " + (kpis.tbc ? "amber" : "good")}><div className="v">{kpis.tbc}</div><div className="l">Vendor TBC</div><div className="s">set in Settings, Vendors</div></div>
          </div>

          <div className="dts-pipe">
            {STAGE_ORDER.map((lv) => { const s = levelStat(lv); const on = tagFilter === lv; return (
              <div key={lv} className={"dts-stage" + (on ? " active" : "")} onClick={() => { setTagFilter(on ? null : lv); setFLevel(on ? "" : lv); }}>
                <div className="sn"><span className="dot" style={{ background: TAGC[lv] }} />{lv} {STAGE_NAME[lv]}</div>
                <div className="cnt">{s.pct}% <small>received</small></div>
                <div className="bar"><i style={{ width: s.pct + "%", background: TAGC[lv] }} /></div>
                <div className="sub2">{s.y} / {s.ap} applicable</div>
              </div>
            ); })}
          </div>

          <div className="dts-legend">
            <span className="li"><span className="dts-d yes" />Received</span>
            <span className="li"><span className="dts-d no" />Outstanding</span>
            <span className="li"><span className="dts-d na" />Not applicable</span>
            <span style={{ marginLeft: "auto" }}>Column completion = received / applicable. Overall = manual sign-off flag.</span>
          </div>

          <div className="dts-tools">
            <div className="dts-f"><span>Search</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type, vendor or document..." /></div>
            <div className="dts-f"><span>Level</span><select value={fLevel} onChange={(e) => { setFLevel(e.target.value); setTagFilter(e.target.value || null); }}><option value="">All levels</option>{STAGE_ORDER.map((lv) => <option key={lv} value={lv}>{lv} {STAGE_NAME[lv]}</option>)}</select></div>
            <div className="dts-f"><span>Responsible</span><select value={fResp} onChange={(e) => setFResp(e.target.value)}><option value="">All parties</option>{resps.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            <div className="dts-f"><span>Vendor</span><select value={fVendor} onChange={(e) => setFVendor(e.target.value)}><option value="">All vendors</option>{vendorList.map((v) => <option key={v} value={v}>{v}</option>)}</select></div>
            <div className="dts-f"><span>Status</span><select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">All rows</option><option value="out">Has outstanding</option><option value="signed">Signed off</option><option value="notsigned">Not signed off</option></select></div>
            <div className="dts-f"><span>Group by</span><div className="dts-seg">{[["none", "None"], ["level", "Lead level"], ["vendor", "Vendor"]].map(([g, lbl]) => <button key={g} className={grpBy === g ? "sel" : ""} onClick={() => { setGrpBy(g); setClosed({}); }}>{lbl}</button>)}</div></div>
            <div className="dts-f"><span>Header angle</span><div className="dts-seg">{[90, 60, 45].map((d) => <button key={d} className={deg === d ? "sel" : ""} onClick={() => setDeg(d)}>{d}</button>)}</div></div>
          </div>

          {canEditDocs && editMode && <div className="dts-editbar"><b>Edit Mode active</b><span>Click a cell to cycle Received, Outstanding, Not applicable. Click Overall to toggle sign-off. Vendor is edited in Settings, Vendors. Manual edits survive the next sync unless the Master overrides them.</span></div>}

          <div className="dts-wrap">
            <table className="dts-mx" style={{ "--hh": geom.H + "px", "--hh2": (geom.H + 24) + "px" }}>
              <colgroup>
                <col style={{ width: "330px" }} />
                {visibleCols.map((c) => <col key={c.doc_key} style={{ width: geom.W + "px" }} />)}
                <col style={{ width: geom.OVW + "px" }} />
                <col style={{ width: geom.S + "px" }} />
              </colgroup>
              <thead>
                <tr className="names">
                  <th className="first" style={{ height: geom.H + "px" }}><div className="firstin"><span className="firstlbl">Equipment Type &amp; Vendor</span><button className="dts-info" onClick={() => setRefOpen(true)} title="Responsible party key">i</button></div></th>
                  <th className="canvas" colSpan={visibleCols.length + 2} style={{ height: geom.H + "px" }}>
                    {visibleCols.map((c, i) => { const x = i * geom.W; const lx = deg === 90 ? x + Math.round(geom.W / 2) + 5 : x + 13; return (
                      <React.Fragment key={c.doc_key}>
                        <div className="gl" style={{ left: x + "px", height: geom.H + "px" }} />
                        <div className="pb" style={{ left: (x + 1) + "px", width: (geom.W - 2) + "px" }}><i style={{ width: colPct(c) + "%" }} /></div>
                        <div className={"lbl" + (focus === c.doc_key ? " lf" : "")} style={{ left: lx + "px", transform: "rotate(-" + deg + "deg)" }} title={c.doc_name + " (" + (c.resp || c.responsible) + ")"} onClick={() => setFocus(focus === c.doc_key ? null : c.doc_key)}>{c.doc_name}</div>
                      </React.Fragment>
                    ); })}
                    <div className="gl" style={{ left: (visibleCols.length * geom.W) + "px", height: geom.H + "px" }} />
                    <div className="ovlbl" style={{ left: (visibleCols.length * geom.W + 8) + "px" }}>Overall</div>
                  </th>
                </tr>
                <tr className="bands">
                  <th className="first" />
                  {bands.map((b, i) => <th key={i} className="bandcell" colSpan={b.n} style={{ background: TAGC[b.lv] }}>{b.lv} {STAGE_NAME[b.lv]}</th>)}
                  <th className="ovh2" /><th className="dts-sp" />
                </tr>
                <tr className="resp">
                  <th className="first" />
                  {visibleCols.map((c) => <th key={c.doc_key} className="resph" title={RESP_DEF[c.resp || c.responsible] || (c.resp || c.responsible)}>{c.resp || c.responsible}</th>)}
                  <th className="ovh2">Sign-off</th><th className="dts-sp" />
                </tr>
              </thead>
              <tbody>
                {groups ? groups.map((g) => (
                  <React.Fragment key={g.key}>
                    <tr className={"dts-grp" + (closed[g.key] ? " closed" : "")} onClick={() => setClosed((c) => ({ ...c, [g.key]: !c[g.key] }))}>
                      <td colSpan={visibleCols.length + 3}><div className="gname"><span className="chev">{"\u25BC"}</span>{g.key}<span className="gcount">{g.rows.length} type{g.rows.length > 1 ? "s" : ""}</span></div></td>
                    </tr>
                    {!closed[g.key] && g.rows.map(renderRow)}
                  </React.Fragment>
                )) : filtered.map(renderRow)}
                {!filtered.length && <tr><td colSpan={visibleCols.length + 3}><div className="dts-empty">No equipment types match the current filters.</div></td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {refOpen && (
        <div className="dts-scrim" onClick={() => setRefOpen(false)}>
          <div className="dts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><h3>Responsible Party Reference</h3><button onClick={() => setRefOpen(false)}>{"\u00D7"}</button></div>
            <div className="mbody">
              <div className="notebox">Each document column is owned by one responsible party. The five colour bands are the commissioning tag levels. VEN (Vendor) maps to the vendor set in Settings, Vendors.</div>
              <table className="reftbl"><thead><tr><th>Abbreviation</th><th>Responsible party</th></tr></thead><tbody>{Object.keys(RESP_DEF).map((k) => <tr key={k}><td className="abbr">{k}</td><td>{RESP_DEF[k]}</td></tr>)}</tbody></table>
            </div>
          </div>
        </div>
      )}

      {syncOpen && (
        <div className="dts-scrim" onClick={() => setSyncOpen(false)}>
          <div className="dts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><h3>Sync From SharePoint</h3><button onClick={() => setSyncOpen(false)}>{"\u00D7"}</button></div>
            <div className="mbody">
              <div className="notebox">Reads the workbook live from SharePoint using the same connection as Asset Status. Paste the file's browser URL and the sheet name, then Sync.</div>
              <label className="fld"><span>File URL</span><input value={cfgUrl} onChange={(e) => setCfgUrl(e.target.value)} placeholder="https://...sharepoint.com/.../FINO4_Docs_Master_LIVE.xlsm" /></label>
              <label className="fld"><span>Sheet name</span><input value={cfgSheet} onChange={(e) => setCfgSheet(e.target.value)} /></label>
              <div className="frow">
                <button className="dts-btn" onClick={onSaveCfg} disabled={busy}>Save Settings</button>
                <span className="acct">{spAcct ? "Connected: " + spAcct : "Not connected"}</span>
                <button className="dts-btn" onClick={onConnectSp}>Connect Account</button>
                <div style={{ flex: 1 }} />
                <button className="dts-btn admin on" onClick={onSync} disabled={busy || !cfgUrl}>{busy ? "Syncing\u2026" : "Sync Now"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="dts-scrim" onClick={() => setSummary(null)}>
          <div className="dts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><h3>Sync Summary</h3><button onClick={() => setSummary(null)}>{"\u00D7"}</button></div>
            <div className="mbody">
              <p className="sumline">{summary.firstSync ? "First import. " : ""}Read {summary.read} equipment types: {summary.added} added, {summary.updated} updated, {summary.unchanged} unchanged, {summary.removed} removed. Received cells gained {summary.cellsGained}, lost {summary.cellsLost}.</p>
              {summary.fileName && <p className="sumsrc">Source: {summary.fileName}{summary.lastModified ? ", modified " + new Date(summary.lastModified).toLocaleString("en-GB") : ""}</p>}
              {(summary.warnings || []).map((w, i) => <p key={i} className="sumwarn">{w}</p>)}
              {summary.conflicts && summary.conflicts.length ? <ConflictList conflicts={summary.conflicts} onApply={applyConflictDecisions} busy={busy} /> : <p className="sumok">No manual overrides clash with this import.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConflictList({ conflicts, onApply, busy }) {
  const [dec, setDec] = useState({});
  const keyOf = (c) => c.equip_type + "||" + c.doc_key;
  const label = (v) => (v === "y" ? "Received" : v === "n" ? "Outstanding" : "Not applicable");
  return (
    <div className="conf">
      <p className="confhead">{conflicts.length} manual override{conflicts.length > 1 ? "s" : ""} differ from the incoming file. Keep yours, or let the Master overwrite.</p>
      <table className="conftbl"><thead><tr><th>Equipment</th><th>Document</th><th>Yours</th><th>Master</th><th>Action</th></tr></thead>
        <tbody>{conflicts.map((c) => { const k = keyOf(c); return (
          <tr key={k}><td>{c.equip_type}</td><td>{c.doc_key === "__overall__" ? "Overall sign-off" : c.doc_key.split("|")[1]}</td><td>{label(c.mine)}</td><td>{label(c.incoming)}</td>
            <td><select value={dec[k] || "keep"} onChange={(e) => setDec((d) => ({ ...d, [k]: e.target.value }))}><option value="keep">Keep mine</option><option value="override">Use Master</option></select></td>
          </tr>
        ); })}</tbody>
      </table>
      <button className="dts-btn admin on" disabled={busy} onClick={() => onApply(dec)}>Apply Decisions</button>
    </div>
  );
}

const DOCS_CSS = `
.dts{--ink:#16202c;--muted:#5d6b7c;--faint:#94a1b1;--accent:#3b82f6;--green:#18b69b;--amber:#e0a106;--red:#e2564e;--paper:#f7f8fa;--card:#fff;--card2:#f7f9fc;--line:#e3e8ef;--chipbg:#eef3fb;--hover:#eef3f9;--head:#2563EB;color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:13px;display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--paper)}
.dts-dark{--ink:#e9eff6;--muted:#93a1b3;--faint:#5d6a7a;--paper:#10151C;--card:#1A222D;--card2:#141d29;--line:#2A3543;--chipbg:#22324A;--hover:#202B38;--head:#7FB0FF}
.dts *{box-sizing:border-box}
.dts-top{flex:none;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 18px;background:var(--card);border-bottom:1px solid var(--line);z-index:30}
.dts-title{font-size:18px;font-weight:800;color:var(--head)}
.dts-title small{display:block;font-size:11.5px;font-weight:500;color:var(--muted);margin-top:2px}
.dts-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:7px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap}
.dts-btn:hover{background:var(--hover)}
.dts-btn:disabled{opacity:.5;cursor:default}
.dts-btn.admin{border-color:#7C3AED;color:#7C3AED}
.dts-btn.admin.on{background:#7C3AED;border-color:#7C3AED;color:#fff}
.dts-err{flex:none;display:flex;justify-content:space-between;gap:10px;padding:8px 18px;background:rgba(226,86,78,.1);border-bottom:1px solid var(--red);color:var(--red);font-size:12.5px;font-weight:600}
.dts-err button{border:0;background:transparent;color:var(--red);font-size:16px;cursor:pointer}
.dts-kpis{flex:none;display:flex;border-bottom:1px solid var(--line);background:var(--card);overflow-x:auto}
.dts-kpi{padding:12px 20px;border-right:1px solid var(--line);min-width:134px}
.dts-kpi .v{font-size:22px;font-weight:800;line-height:1.1}
.dts-kpi .l{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-top:2px}
.dts-kpi .s{font-size:11px;color:var(--muted);margin-top:2px}
.dts-kpi.warn .v{color:var(--red)} .dts-kpi.good .v{color:var(--green)} .dts-kpi.amber .v{color:var(--amber)}
.dts-pipe{flex:none;display:flex;gap:8px;padding:12px 18px;background:var(--card);border-bottom:1px solid var(--line);overflow-x:auto}
.dts-stage{flex:1;min-width:150px;border:1px solid var(--line);border-radius:10px;padding:9px 12px;cursor:pointer;background:var(--paper)}
.dts-stage:hover{background:var(--hover)} .dts-stage.active{box-shadow:0 0 0 2px var(--accent);background:var(--chipbg)}
.dts-stage .sn{display:flex;align-items:center;gap:7px;font-weight:800;font-size:12px}
.dts-stage .dot{width:11px;height:11px;border-radius:50%;flex:none}
.dts-stage .cnt{font-size:19px;font-weight:800;margin-top:4px} .dts-stage .cnt small{font-size:11px;font-weight:600;color:var(--muted)}
.dts-stage .bar{height:5px;border-radius:3px;background:var(--line);margin-top:7px;overflow:hidden} .dts-stage .bar i{display:block;height:100%;border-radius:3px}
.dts-stage .sub2{font-size:10.5px;color:var(--muted);margin-top:5px}
.dts-legend{flex:none;display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--muted);padding:8px 18px;background:var(--card);border-bottom:1px solid var(--line);align-items:center}
.dts-legend .li{display:inline-flex;align-items:center;gap:6px;font-weight:600}
.dts-tools{flex:none;display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--line);background:var(--card)}
.dts-f{display:flex;flex-direction:column;gap:3px}
.dts-f>span{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.dts-f input,.dts-f select{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:7px 9px;font-size:12.5px;font-family:inherit}
.dts-f input{width:200px}
.dts-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--card)}
.dts-seg button{border:0;background:transparent;padding:7px 11px;font-size:12px;cursor:pointer;color:var(--muted);font-weight:600;font-family:inherit}
.dts-seg button.sel{background:var(--ink);color:var(--paper)}
.dts-editbar{flex:none;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:8px 18px;background:rgba(124,58,237,.08);border-bottom:1px solid #7C3AED}
.dts-editbar b{font-size:12.5px;color:#7C3AED} .dts-editbar span{font-size:11px;color:var(--muted)}
.dts-wrap{flex:1;min-height:0;overflow:auto}
.dts-mx{border-collapse:separate;border-spacing:0;table-layout:fixed}
.dts-mx th,.dts-mx td{padding:0;font-size:12px}
.dts-mx thead th{position:sticky;background:var(--paper);z-index:20}
.dts-mx thead tr.names th{top:0;vertical-align:bottom}
.dts-mx thead tr.bands th{top:var(--hh);height:24px}
.dts-mx thead tr.resp th{top:var(--hh2);height:24px;border-bottom:2px solid var(--line)}
.canvas{position:relative;background:var(--paper);vertical-align:bottom;overflow:visible;padding:0}
.canvas .lbl{position:absolute;bottom:8px;transform-origin:0 100%;white-space:nowrap;font-size:11px;font-weight:700;color:var(--muted);line-height:1;cursor:pointer}
.canvas .lbl:hover,.canvas .lbl.lf{color:var(--ink)}
.canvas .gl{position:absolute;top:0;width:1px;background:var(--line)}
.canvas .pb{position:absolute;bottom:0;height:3px;background:var(--line)} .canvas .pb i{display:block;height:100%;background:var(--accent)}
.canvas .ovlbl{position:absolute;bottom:8px;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.bandcell{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#fff;text-align:center;border-right:2px solid var(--paper)}
.resph{font-size:8.5px;font-weight:800;color:var(--muted);text-align:center;border-right:1px solid var(--line);text-transform:uppercase;padding:2px 1px;white-space:nowrap;overflow:hidden}
.ovh2{text-align:center;border-left:2px solid var(--line);font-size:9px;font-weight:800;color:var(--muted);text-transform:uppercase;padding:0 2px 6px;vertical-align:bottom}
.dts-sp{background:var(--paper);border:0}
.dts-mx thead tr.names th.first,.dts-mx thead tr.bands th.first,.dts-mx thead tr.resp th.first{text-align:left;padding:0 12px;position:sticky;left:0;z-index:22;background:var(--paper);border-right:2px solid var(--line)}
.firstin{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;height:100%;padding-bottom:8px}
.firstlbl{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.dts-info{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--accent);color:var(--accent);background:var(--card);font-size:11px;font-weight:800;cursor:pointer;font-family:Georgia,serif;font-style:italic;line-height:1;flex:none}
.dts-info:hover{background:var(--accent);color:#fff}
tr.dts-grp td{background:var(--card2);border-bottom:1px solid var(--line);border-top:1px solid var(--line);cursor:pointer;padding:7px 12px}
tr.dts-grp:hover td{background:var(--hover)}
tr.dts-grp .gname{font-weight:800;font-size:12.5px;display:flex;align-items:center;gap:8px}
tr.dts-grp .chev{display:inline-block;font-size:10px;color:var(--muted);transition:transform .15s} tr.dts-grp.closed .chev{transform:rotate(-90deg)}
tr.dts-grp .gcount{font-weight:600;color:var(--muted);font-size:11px}
tr.dts-erow td{border-bottom:1px solid var(--line);height:36px} tr.dts-erow:hover td{background:var(--hover)}
.dts-id{position:sticky;left:0;background:var(--card);border-right:2px solid var(--line);padding:5px 12px !important;z-index:10;overflow:hidden}
tr.dts-erow:hover .dts-id{background:var(--hover)}
.dts-idtop{display:flex;align-items:center;gap:8px} .dts-id .tg{font-weight:700;font-size:12px;white-space:nowrap}
.idsub{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dts-idbot{display:flex;align-items:center;gap:8px;margin-top:2px}
.vchip{display:inline-flex;align-items:center;font-size:9.5px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;border-radius:5px;padding:2px 6px;border:1px solid var(--line);color:var(--muted);white-space:nowrap}
.vchip.set{background:var(--chipbg);color:var(--accent);border-color:transparent}
.vchip.tbc{color:var(--amber);border-color:var(--amber);background:rgba(224,161,6,.08)}
.rowpct{font-size:10px;font-weight:700;color:var(--muted);white-space:nowrap}
.dts-cp{text-align:center;border-right:1px solid var(--line);position:relative}
.dts-cp.fcol{background:var(--chipbg)}
.dts-cp.editable{cursor:pointer;box-shadow:inset 0 0 0 2px rgba(124,58,237,.2);border-radius:6px} .dts-cp.editable:hover{box-shadow:inset 0 0 0 2px #7C3AED}
.dts-d{display:inline-block;width:13px;height:13px;border-radius:50%;vertical-align:middle}
.dts-d.yes{background:var(--green);position:relative}
.dts-d.yes::after{content:"";position:absolute;left:4px;top:1px;width:3px;height:7px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(40deg)}
.dts-d.no{background:transparent;border:2px solid var(--red);width:11px;height:11px;opacity:.75}
.dts-d.na{width:8px;height:2px;border-radius:1px;background:var(--faint)}
.dts-ov{text-align:center;border-left:2px solid var(--line);font-size:15px;font-weight:800}
.dts-ov.yes{color:var(--green)} .dts-ov.no{color:var(--faint)}
.dts-ov.editable{cursor:pointer} .dts-ov.editable:hover{background:var(--hover)}
.dts-empty{padding:50px 20px;text-align:center;color:var(--muted)}
.dts-scrim{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:60;display:flex;align-items:center;justify-content:center}
.dts-modal{background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.3);max-width:720px;width:94vw;max-height:86vh;overflow:auto;color:var(--ink)}
.mhead{padding:15px 20px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--card);display:flex;align-items:center;z-index:2}
.mhead h3{margin:0;font-size:15px;color:var(--head)} .mhead button{margin-left:auto;border:0;background:transparent;font-size:18px;cursor:pointer;color:var(--muted)}
.mbody{padding:16px 20px}
.notebox{background:var(--chipbg);border-radius:8px;padding:10px 13px;font-size:12px;color:var(--accent);margin-bottom:14px;font-weight:600}
.reftbl,.conftbl{width:100%;border-collapse:collapse;font-size:12.5px}
.reftbl th,.conftbl th{text-align:left;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding:7px 9px;border-bottom:2px solid var(--line)}
.reftbl td,.conftbl td{padding:8px 9px;border-bottom:1px solid var(--line)}
.reftbl td.abbr{font-weight:800;color:var(--accent);white-space:nowrap}
.fld{display:block;margin-bottom:12px} .fld span{display:block;font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px}
.fld input{width:100%;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:8px 10px;font-size:12.5px;font-family:inherit}
.frow{display:flex;align-items:center;gap:10px;flex-wrap:wrap} .acct{font-size:11.5px;color:var(--muted)}
.sumline{font-size:13px;font-weight:600} .sumsrc{font-size:11.5px;color:var(--muted)} .sumwarn{font-size:12px;color:var(--amber);font-weight:600} .sumok{font-size:12.5px;color:var(--green);font-weight:600}
.confhead{font-size:12.5px;font-weight:600;margin-top:6px} .conf select{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:6px;padding:4px 6px;font-size:12px;font-family:inherit}
`;
