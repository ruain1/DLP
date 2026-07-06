// AssetStatus.jsx
// REV115: Asset Status. Equipment status matrix driven by the Asset Cx Register,
// populated by workbook upload or by live SharePoint sync (see sharepoint.js).
// One shared parser serves both entrances, mapping columns by HEADER NAME, never
// by position: between W25 and W26 the register dropped SFAT and W3 and renamed
// FAT/DOF, QC and CYT, which would have silently corrupted a positional parser.
import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadAssetStatus, saveAssetRegister, saveStepReference, saveAssetStatusConfig } from "./data";

/* ---------- constants ---------- */
const TAGC = { L1: "#E2564E", L2: "#E0A106", L3: "#18B69B", L4: "#4F8DF9", L5: "#94A3B8" };
const STAGE_NAME = { L1: "Red Tag", L2: "Yellow Tag", L3: "Green Tag", L4: "Blue Tag", L5: "White Tag" };
const STAGE_ORDER = ["L1", "L2", "L3", "L4", "L5"];
const todayISO = () => new Date().toISOString().slice(0, 10);

/* ---------- shared register parser (upload + SharePoint) ----------
   Input: 2D array of raw cell values including the band row and header row.
   Output: { assets, stepDefs, warnings }.
   Rules: the header row is the one containing "Asset Tag". The row above it
   carries the stage bands (L1 CX .. L5 CX), forward-filled across merged cells.
   A column is a checkpoint if its band matches L1-L5 CX, its header does not end
   Planned/Actual, it is not a meta column, and it is not a FOK milestone flag
   (FOK progress lives in the date columns and renders in the drawer instead).
   Values: YES -> 2, NO -> 1, blank -> 0 (not applicable / not reached). */
export function parseRegisterValues(values) {
  const norm = (v) => String(v == null ? "" : v).trim();
  const hi = (values || []).findIndex((r) => (r || []).some((c) => norm(c).toLowerCase() === "asset tag"));
  if (hi < 0) throw new Error("Could not find the header row (no cell reads Asset Tag). Check the sheet name and layout.");
  const hdr = (values[hi] || []).map(norm);
  const bandRaw = hi > 0 ? (values[hi - 1] || []).map(norm) : [];
  let cur = "";
  const bands = hdr.map((_, i) => { if (bandRaw[i]) cur = bandRaw[i]; return cur; });
  const META = new Set(["asset tag", "equipment name", "type", "m/e", "mapped hall", "mapping confidence"]);
  const idx = {};
  hdr.forEach((h, i) => { if (h && idx[h.toLowerCase()] === undefined) idx[h.toLowerCase()] = i; });
  const col = (n) => idx[n.toLowerCase()];
  for (const req of ["asset tag", "equipment name", "type", "m/e"]) {
    if (col(req) === undefined) throw new Error('Required column "' + req + '" is missing from the register header.');
  }
  const stepCols = [], dateCols = [], warnings = [];
  hdr.forEach((h, i) => {
    if (!h) return;
    const hl = h.toLowerCase();
    if (META.has(hl)) return;
    if (/(planned|actual)$/i.test(h)) { dateCols.push({ h, i }); return; }
    const m = (bands[i] || "").match(/L([1-5])\s*CX/i);
    if (m && !/fok/i.test(h)) stepCols.push({ h, i, stage: "L" + m[1], isTag: /tag$/i.test(h) });
    else if (!m && !/fok/i.test(h)) warnings.push('Column "' + h + '" sits under no L1-L5 stage band and was skipped.');
  });
  if (!stepCols.length) throw new Error("No checkpoint columns found under L1-L5 stage bands. The register layout may have changed shape.");
  const stVal = (v) => { const s = norm(v).toUpperCase(); return s === "YES" ? 2 : (s === "NO" ? 1 : 0); };
  const dtVal = (v) => {
    if (v == null || v === "") return "";
    if (v instanceof Date) return isNaN(v) ? "" : v.toISOString().slice(0, 10);
    const s = String(v); const m = s.match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1];
    const n = Number(v);
    if (isFinite(n) && n > 20000 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
    const d = new Date(s); return isNaN(d) ? "" : d.toISOString().slice(0, 10);
  };
  const assets = [];
  for (let r = hi + 1; r < values.length; r++) {
    const row = values[r] || [];
    const tag = norm(row[col("asset tag")]);
    if (!tag) continue;
    const steps = {}; stepCols.forEach((c) => { steps[c.h] = stVal(row[c.i]); });
    const dates = {}; dateCols.forEach((c) => { const d = dtVal(row[c.i]); if (d) dates[c.h] = d; });
    const parts = tag.split(".");
    assets.push({
      tag,
      name: norm(row[col("equipment name")]),
      type: norm(row[col("type")]),
      discipline: norm(row[col("m/e")]).toUpperCase(),
      level: parts.length > 2 ? parts[2] : "",
      hall: col("mapped hall") !== undefined ? norm(row[col("mapped hall")]) : "",
      steps, dates,
    });
  }
  if (!assets.length) throw new Error("The header row was found but no asset rows followed it.");
  const stepDefs = stepCols.map((c, k) => ({ step_key: c.h, stage: c.stage, sort_order: k, is_tag: c.isTag }));
  return { assets, stepDefs, warnings };
}

/* ---------- derived helpers ---------- */
const plannedKeyFor = (stepKey, dates) => {
  const want = stepKey.toLowerCase() + " planned";
  return Object.keys(dates || {}).find((k) => k.toLowerCase() === want) || null;
};
const actualKeyFor = (stepKey, dates) => {
  const want = stepKey.toLowerCase() + " actual";
  return Object.keys(dates || {}).find((k) => k.toLowerCase() === want) || null;
};

function enrichAssets(assets, stepDefs) {
  const today = todayISO();
  const tagSteps = stepDefs.filter((s) => s.is_tag);
  return assets.map((a) => {
    let done = 0, applicable = 0;
    stepDefs.forEach((s) => { const v = (a.steps || {})[s.step_key] || 0; if (v > 0) { applicable++; if (v === 2) done++; } });
    const pct = applicable ? Math.round((done / applicable) * 100) : 0;
    const overdue = [];
    tagSteps.forEach((s) => {
      const pk = plannedKeyFor(s.step_key, a.dates);
      if (pk && a.dates[pk] < today && (a.steps || {})[s.step_key] !== 2) overdue.push(s.stage);
    });
    return { ...a, hall: a.hall || "Unmapped", pct, done, applicable, overdue, started: stepDefs.some((s) => (a.steps || {})[s.step_key] === 2) };
  });
}

/* ---------- component ---------- */
export default function AssetStatusPage({ projectId, isAdmin, theme, cu }) {
  const [assets, setAssets] = useState([]);
  const [stepDefs, setStepDefs] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState(null);   // { source, read, added, updated, unchanged, warnings, fileName, lastModified }
  const [spAcct, setSpAcct] = useState("");

  // view state
  const [q, setQ] = useState("");
  const [fMe, setFMe] = useState("");
  const [fHall, setFHall] = useState("");
  const [fLvl, setFLvl] = useState("");
  const [fType, setFType] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [grpBy, setGrpBy] = useState("type");
  const [bandsOn, setBandsOn] = useState({ L1: true, L2: true, L3: true, L4: true, L5: true });
  const [cellMode, setCellMode] = useState("dots");
  const [hideDone, setHideDone] = useState(false);
  const [closed, setClosed] = useState({});
  const [focus, setFocus] = useState(null);        // step_key
  const [focusMode, setFocusMode] = useState("out");
  const [tagFilter, setTagFilter] = useState(null); // stage key L1..L5
  const [drawer, setDrawer] = useState(null);       // asset
  const [refOpen, setRefOpen] = useState(false);
  const [refEdit, setRefEdit] = useState(null);     // { step_key, definition, executed_by, signed_off_by }
  const [syncOpen, setSyncOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const fileRef = useRef(null);

  const reload = async () => {
    setLoading(true);
    const r = await loadAssetStatus(projectId);
    if (r.error) setErr(r.error);
    setAssets(r.assets.map((row) => ({ tag: row.tag, name: row.name, type: row.type, discipline: row.discipline, level: row.level, hall: row.hall, steps: row.steps || {}, dates: row.dates || {}, synced_at: row.synced_at, source: row.source })));
    setStepDefs(r.steps || []);
    setConfig(r.config);
    setLoading(false);
    try {
      const sp = await import("./sharepoint");
      sp.initSharePoint(r.config || undefined);
      const a = await sp.sharePointAccount();
      if (a) setSpAcct(a.username || "");
    } catch (e) { /* sharepoint module optional at this point */ }
  };
  useEffect(() => { reload(); }, [projectId]);

  const stepsSorted = useMemo(() => stepDefs.slice().sort((a, b) => a.sort_order - b.sort_order), [stepDefs]);
  const bands = useMemo(() => STAGE_ORDER.map((st) => ({ stage: st, name: STAGE_NAME[st], color: TAGC[st], steps: stepsSorted.filter((s) => s.stage === st) })).filter((b) => b.steps.length), [stepsSorted]);
  const tagStepByStage = useMemo(() => { const o = {}; stepsSorted.forEach((s) => { if (s.is_tag) o[s.stage] = s.step_key; }); return o; }, [stepsSorted]);
  const enriched = useMemo(() => enrichAssets(assets, stepsSorted), [assets, stepsSorted]);

  const halls = useMemo(() => [...new Set(enriched.map((a) => a.hall))].sort(), [enriched]);
  const lvls = useMemo(() => [...new Set(enriched.map((a) => a.level).filter(Boolean))].sort(), [enriched]);
  const types = useMemo(() => [...new Set(enriched.map((a) => a.type).filter(Boolean))].sort(), [enriched]);

  const baseFiltered = useMemo(() => {
    const ql = q.toLowerCase();
    return enriched.filter((a) => {
      if (ql && !(a.tag.toLowerCase().includes(ql) || a.name.toLowerCase().includes(ql) || a.type.toLowerCase().includes(ql) || a.hall.toLowerCase().includes(ql))) return false;
      if (fMe && a.discipline !== fMe) return false;
      if (fHall && a.hall !== fHall) return false;
      if (fLvl && a.level !== fLvl) return false;
      if (fType && a.type !== fType) return false;
      if (hideDone && a.pct === 100) return false;
      if (fStatus === "overdue" && !a.overdue.length) return false;
      if (fStatus === "prog" && (!a.started || a.pct === 100)) return false;
      if (fStatus === "ns" && a.started) return false;
      return true;
    });
  }, [enriched, q, fMe, fHall, fLvl, fType, fStatus, hideDone]);

  const list = useMemo(() => {
    let l = baseFiltered;
    if (tagFilter && tagStepByStage[tagFilter]) l = l.filter((a) => (a.steps || {})[tagStepByStage[tagFilter]] === 2);
    if (focus) {
      if (focusMode === "done") l = l.filter((a) => (a.steps || {})[focus] === 2);
      else if (focusMode === "out") l = l.filter((a) => (a.steps || {})[focus] === 1);
    }
    return l;
  }, [baseFiltered, tagFilter, tagStepByStage, focus, focusMode]);

  const groups = useMemo(() => {
    const key = (a) => grpBy === "type" ? (a.type || "?") : grpBy === "hall" ? a.hall : grpBy === "lvl" ? (a.level || "?") : grpBy === "me" ? (a.discipline === "M" ? "Mechanical" : "Electrical") : "All Assets";
    const g = {};
    list.forEach((a) => { const k = key(a); (g[k] = g[k] || []).push(a); });
    return Object.keys(g).sort().map((k) => ({ key: k, rows: g[k] }));
  }, [list, grpBy]);

  const tagCount = (stage, arr) => { const sk = tagStepByStage[stage]; return sk ? arr.filter((a) => (a.steps || {})[sk] === 2).length : 0; };
  const overdueCount = useMemo(() => list.filter((a) => a.overdue.length).length, [list]);
  const syncedAt = useMemo(() => { const t = assets.map((a) => a.synced_at).filter(Boolean).sort(); return t.length ? t[t.length - 1] : null; }, [assets]);

  /* ---------- imports ---------- */
  const applyParsed = async (parsed, source, extra) => {
    const r = await saveAssetRegister(projectId, parsed.assets, parsed.stepDefs, source);
    if (r.error) { setErr("Import failed: " + r.error); return; }
    setSummary({ source, ...r, warnings: parsed.warnings, ...(extra || {}) });
    await reload();
  };
  const onUpload = async (file) => {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const _xl = await import("exceljs/dist/exceljs.min.js");
      const ExcelJS = _xl.default || _xl;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      let ws = wb.getWorksheet((config && config.sheet_name) || "Asset Cx Register");
      if (!ws) ws = wb.worksheets.find((w) => /asset cx register/i.test(w.name));
      if (!ws) throw new Error('Worksheet "' + ((config && config.sheet_name) || "Asset Cx Register") + '" not found in the workbook.');
      const values = [];
      ws.eachRow({ includeEmpty: true }, (row) => {
        const arr = [];
        row.eachCell({ includeEmpty: true }, (cell, cn) => {
          let v = cell.value;
          if (v && typeof v === "object") { if (v.result !== undefined) v = v.result; else if (v.text !== undefined) v = v.text; else if (v.richText) v = v.richText.map((t) => t.text).join(""); }
          arr[cn - 1] = v;
        });
        values.push(arr);
      });
      await applyParsed(parseRegisterValues(values), "upload");
    } catch (e) { setErr("Import failed: " + (e && e.message ? e.message : e)); }
    setBusy(false);
  };
  const onSync = async () => {
    setBusy(true); setErr("");
    try {
      const sp = await import("./sharepoint");
      sp.initSharePoint(config || undefined);
      const fileUrl = config && config.file_url;
      if (!fileUrl) throw new Error("No SharePoint file URL is configured. Open Sync Settings and paste the file's browser URL.");
      const r = await sp.readSharePointRegister(fileUrl, (config && config.sheet_name) || "Asset Cx Register");
      await applyParsed(parseRegisterValues(r.values), "sharepoint", { fileName: r.fileName, lastModified: r.lastModified });
      setSyncOpen(false);
    } catch (e) { setErr("Sync failed: " + (e && e.message ? e.message : e)); }
    setBusy(false);
  };
  const onConnectSp = async () => {
    try { const sp = await import("./sharepoint"); sp.initSharePoint(config || undefined); await sp.connectSharePoint(); }
    catch (e) { setErr("Connect failed: " + (e && e.message ? e.message : e)); }
  };

  /* ---------- export ---------- */
  const onExport = async () => {
    try {
      const _xl = await import("exceljs/dist/exceljs.min.js");
      const ExcelJS = _xl.default || _xl;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Asset Status");
      const cols = [{ header: "Asset Tag", key: "tag", width: 30 }, { header: "Equipment", key: "name", width: 30 }, { header: "Type", key: "type", width: 12 }, { header: "M/E", key: "me", width: 6 }, { header: "Level", key: "lvl", width: 7 }, { header: "Hall", key: "hall", width: 10 }];
      stepsSorted.forEach((s) => cols.push({ header: s.step_key, key: s.step_key, width: 10 }));
      cols.push({ header: "Progress %", key: "pct", width: 11 }, { header: "Overdue Stages", key: "ov", width: 16 });
      ws.columns = cols;
      ws.getRow(1).font = { bold: true };
      list.forEach((a) => {
        const row = { tag: a.tag, name: a.name, type: a.type, me: a.discipline, lvl: a.level, hall: a.hall, pct: a.pct, ov: a.overdue.map((s) => STAGE_NAME[s]).join(", ") };
        stepsSorted.forEach((s) => { const v = (a.steps || {})[s.step_key] || 0; row[s.step_key] = v === 2 ? "YES" : v === 1 ? "NO" : ""; });
        ws.addRow(row);
      });
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = "FIN04-asset-status-" + todayISO() + ".xlsx"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setErr("Export failed: " + (e && e.message ? e.message : e)); }
  };

  /* ---------- small render helpers ---------- */
  const focusStats = useMemo(() => {
    if (!focus) return null;
    const app = baseFiltered.filter((a) => ((a.steps || {})[focus] || 0) > 0);
    const done = app.filter((a) => a.steps[focus] === 2).length;
    const band = bands.find((b) => b.steps.some((s) => s.step_key === focus));
    return { app: app.length, done, out: app.length - done, na: baseFiltered.length - app.length, color: band ? band.color : "var(--accent)" };
  }, [focus, baseFiltered, bands]);

  const dot = (v, color, ov, title) => {
    const cls = v === 2 ? "ast-d y" : v === 1 ? "ast-d n" : "ast-d na";
    return <span className={cls + (ov ? " ov" : "")} style={v === 2 ? { background: color } : undefined} title={title} />;
  };

  const drawerRows = (a) => {
    const rows = [];
    stepsSorted.filter((s) => s.is_tag).forEach((s) => {
      const pk = plannedKeyFor(s.step_key, a.dates), ak = actualKeyFor(s.step_key, a.dates);
      rows.push({ name: s.step_key, planned: pk ? a.dates[pk] : "", actual: ak ? a.dates[ak] : "", done: (a.steps || {})[s.step_key] === 2 });
    });
    Object.keys(a.dates || {}).forEach((k) => {
      if (/fok planned$/i.test(k)) {
        const base = k.replace(/ planned$/i, "");
        const ak = Object.keys(a.dates).find((x) => x.toLowerCase() === (base + " actual").toLowerCase());
        rows.push({ name: base, planned: a.dates[k], actual: ak ? a.dates[ak] : "", done: false });
      }
    });
    return rows;
  };

  if (loading) return <div className={"ast" + (theme === "dark" ? " ast-dark" : "")}><style>{AST_CSS}</style><div className="ast-empty">Loading Asset Status&hellip;</div></div>;

  const empty = !assets.length;
  const today = todayISO();

  return (
    <div className={"ast" + (theme === "dark" ? " ast-dark" : "")}>
      <style>{AST_CSS}</style>

      <div className="ast-top">
        <div className="ast-title">Asset Status<small>Equipment commissioning matrix from the Asset Cx Register.{syncedAt ? " Data as of " + new Date(syncedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) + (assets[0] && assets[0].source === "sharepoint" ? " (SharePoint sync)" : " (workbook upload)") : ""}</small></div>
        <div style={{ flex: 1 }} />
        {isAdmin && <label className="ast-btn"><input ref={fileRef} type="file" accept=".xlsx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; onUpload(f); }} />{busy ? "Working\u2026" : "Import Workbook"}</label>}
        {isAdmin && <button className="ast-btn admin" onClick={() => setSyncOpen(true)}>{"\u21BB"} Sync From SharePoint</button>}
        <button className="ast-btn" onClick={onExport} disabled={empty}>Export</button>
      </div>

      {err && <div className="ast-err">{err}<button onClick={() => setErr("")}>{"\u00D7"}</button></div>}

      {empty ? (
        <div className="ast-empty">No register loaded yet.{isAdmin ? " Import the Cx Master workbook or run Sync From SharePoint to populate this page." : " An admin needs to import the register."}</div>
      ) : (<>

      <div className="ast-kpis">
        <div className="ast-kpi"><div className="v">{list.length}</div><div className="l">Assets In View</div><div className="s">{list.filter((a) => a.discipline === "M").length} Mech / {list.filter((a) => a.discipline !== "M").length} Elec</div></div>
        {STAGE_ORDER.filter((st) => tagStepByStage[st]).map((st) => (
          <div key={st} className="ast-kpi"><div className="v">{tagCount(st, list)}</div><div className="l">{STAGE_NAME[st]}ged</div><div className="s">{list.length ? Math.round(tagCount(st, list) / list.length * 100) : 0}% of view</div></div>
        )).slice(0, 3)}
        <div className={"ast-kpi warn click" + (fStatus === "overdue" ? " on" : "")} onClick={() => setFStatus(fStatus === "overdue" ? "" : "overdue")}><div className="v">{overdueCount}</div><div className="l">Overdue Vs Plan</div><div className="s">Planned tag date passed</div></div>
      </div>

      <div className="ast-pipe">
        {STAGE_ORDER.filter((st) => tagStepByStage[st]).map((st, i) => (
          <React.Fragment key={st}>
            {i > 0 && <div className="ast-arrow">{"\u2192"}</div>}
            <div className={"ast-stage" + (tagFilter === st ? " active" : "")} title="Show only assets holding this tag" onClick={() => setTagFilter(tagFilter === st ? null : st)}>
              <div className="sn"><span className="dot" style={{ background: TAGC[st] }} />{STAGE_NAME[st]}</div>
              <div className="cnt">{tagCount(st, baseFiltered)} <small>/ {baseFiltered.length}</small></div>
              <div className="bar"><i style={{ width: (baseFiltered.length ? tagCount(st, baseFiltered) / baseFiltered.length * 100 : 0) + "%", background: TAGC[st] }} /></div>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="ast-tools">
        <div className="ast-f"><span>Search</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tag, name, type, hall..." /></div>
        <div className="ast-f"><span>Discipline</span><div className="ast-seg">{[["", "All"], ["M", "Mech"], ["E", "Elec"]].map(([v, l]) => <button key={v} className={fMe === v ? "sel" : ""} onClick={() => setFMe(v)}>{l}</button>)}</div></div>
        <div className="ast-f"><span>Hall</span><select value={fHall} onChange={(e) => setFHall(e.target.value)}><option value="">All halls</option>{halls.map((h) => <option key={h}>{h}</option>)}</select></div>
        <div className="ast-f"><span>Level</span><select value={fLvl} onChange={(e) => setFLvl(e.target.value)}><option value="">All levels</option>{lvls.map((h) => <option key={h}>{h}</option>)}</select></div>
        <div className="ast-f"><span>Type</span><select value={fType} onChange={(e) => setFType(e.target.value)}><option value="">All types</option>{types.map((h) => <option key={h}>{h}</option>)}</select></div>
        <div className="ast-f"><span>Status</span><select value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">All statuses</option><option value="overdue">Overdue vs plan</option><option value="prog">In progress</option><option value="ns">Not started</option></select></div>
        <div className="ast-f"><span>Group By</span><select value={grpBy} onChange={(e) => { setGrpBy(e.target.value); setClosed({}); }}><option value="type">Type</option><option value="hall">Hall</option><option value="lvl">Level</option><option value="me">Discipline</option><option value="">None</option></select></div>
        <div className="ast-f ast-rel"><span>&nbsp;</span><button className="ast-btn" onClick={() => setColsOpen(!colsOpen)}>Columns {"\u25BE"}</button>
          {colsOpen && <div className="ast-pop" onClick={(e) => e.stopPropagation()}>
            <div className="cap">Stage Bands</div>
            {bands.map((b) => <label key={b.stage}><input type="checkbox" checked={!!bandsOn[b.stage]} onChange={(e) => setBandsOn({ ...bandsOn, [b.stage]: e.target.checked })} /> {b.stage} {b.name}</label>)}
            <div className="cap">Cell Content</div>
            <label><input type="radio" checked={cellMode === "dots"} onChange={() => setCellMode("dots")} /> Status dots</label>
            <label><input type="radio" checked={cellMode === "dates"} onChange={() => setCellMode("dates")} /> Planned dates on tag columns</label>
          </div>}
        </div>
        <div className="ast-f"><span>&nbsp;</span><button className={"ast-btn" + (hideDone ? " on" : "")} onClick={() => setHideDone(!hideDone)}>Hide Complete</button></div>
        <div className="ast-f"><span>&nbsp;</span><button className="ast-btn" onClick={() => { const anyOpen = groups.some((g) => !closed[g.key]); const c = {}; groups.forEach((g) => { c[g.key] = anyOpen; }); setClosed(c); }}>{groups.some((g) => !closed[g.key]) ? "Collapse All" : "Expand All"}</button></div>
        {isAdmin && <div className="ast-f"><span>&nbsp;</span><button className="ast-btn" onClick={() => setCfgOpen(true)}>Sync Settings</button></div>}
      </div>

      {focus && focusStats && <div className="ast-focus">
        <span className="fdot" style={{ background: focusStats.color }} />
        <b>{focus}</b>
        <span className="stats">{focusStats.done} of {focusStats.app} applicable complete ({focusStats.app ? Math.round(focusStats.done / focusStats.app * 100) : 0}%) {"\u00B7"} {focusStats.out} outstanding {"\u00B7"} {focusStats.na} not applicable</span>
        <div className="ast-seg">{[["out", "Outstanding"], ["done", "Complete"], ["all", "All"]].map(([v, l]) => <button key={v} className={focusMode === v ? "sel" : ""} onClick={() => setFocusMode(v)}>{l}</button>)}</div>
        <button className="ast-btn" style={{ marginLeft: "auto" }} onClick={() => setFocus(null)}>Clear Focus {"\u00D7"}</button>
      </div>}

      <div className="ast-wrap" onClick={() => setColsOpen(false)}>
        <table className="ast-mx">
          <thead>
            <tr className="bands">
              <th className="first" />
              {bands.filter((b) => bandsOn[b.stage]).map((b) => <th key={b.stage} className="bandcell" colSpan={b.steps.length} style={{ background: b.color }}>{b.stage} Cx - {b.name}</th>)}
              <th style={{ background: "var(--paper)" }} />
            </tr>
            <tr className="cols">
              <th className="colh first"><span className="firstin">Asset ({list.length})<button className="ast-info" title="What each Cx step means, who executes, who signs off" onClick={(e) => { e.stopPropagation(); setRefOpen(true); }}>i</button></span></th>
              {bands.filter((b) => bandsOn[b.stage]).map((b) => b.steps.map((s) => (
                <th key={s.step_key} className={"colh step" + (focus === s.step_key ? " focused" : "")} title={"Click to focus on " + s.step_key} onClick={() => { if (focus === s.step_key) { setFocus(null); } else { setFocus(s.step_key); setFocusMode("out"); } }}>{s.step_key}</th>
              )))}
              <th className="colh" style={{ minWidth: 130 }}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {!list.length && <tr><td colSpan={3 + bands.filter((b) => bandsOn[b.stage]).reduce((n, b) => n + b.steps.length, 0)}><div className="ast-empty">No assets match the current filters. Clear a filter, the step focus, or the tag filter to widen the view.</div></td></tr>}
            {groups.map((g) => {
              const isClosed = !!closed[g.key];
              return (
                <React.Fragment key={g.key}>
                  <tr className={"grp" + (isClosed ? " closed" : "")} onClick={() => setClosed({ ...closed, [g.key]: !isClosed })}>
                    <td className="idcell grpcell"><span className="gname"><span className="chev">{"\u25BC"}</span>{g.key} <span className="gcount">{g.rows.length} assets</span></span></td>
                    <td colSpan={bands.filter((b) => bandsOn[b.stage]).reduce((n, b) => n + b.steps.length, 0)}>
                      <div className="minibars">{bands.filter((b) => bandsOn[b.stage]).map((b) => { const n = tagStepByStage[b.stage] ? g.rows.filter((a) => (a.steps || {})[tagStepByStage[b.stage]] === 2).length : 0; return <span key={b.stage} className="mb"><span className="t"><i style={{ width: (g.rows.length ? n / g.rows.length * 100 : 0) + "%", background: b.color }} /></span>{n}</span>; })}</div>
                    </td>
                    <td />
                  </tr>
                  {!isClosed && g.rows.map((a) => (
                    <tr key={a.tag} className="arow" onClick={() => setDrawer(a)}>
                      <td className="idcell"><div className="tg">{a.tag}</div><div className="nm">{a.name} {"\u00B7"} {a.hall}</div></td>
                      {bands.filter((b) => bandsOn[b.stage]).map((b) => b.steps.map((s) => {
                        const v = (a.steps || {})[s.step_key] || 0;
                        const ov = s.is_tag && a.overdue.includes(b.stage);
                        const fc = focus === s.step_key ? " fcol" : "";
                        if (cellMode === "dates" && s.is_tag) {
                          const pk = plannedKeyFor(s.step_key, a.dates), ak = actualKeyFor(s.step_key, a.dates);
                          const d = ak && a.dates[ak] ? a.dates[ak] : (pk ? a.dates[pk] : "");
                          return <td key={s.step_key} className={"cp" + fc}><span className={"datecell" + (ov ? " ov" : "")}>{d ? d.slice(5) : "-"}</span></td>;
                        }
                        return <td key={s.step_key} className={"cp" + fc}>{dot(v, b.color, ov, s.step_key + ": " + (v === 2 ? "Complete" : v === 1 ? "Outstanding" : "Not applicable / not reached") + (ov ? " - OVERDUE vs plan" : ""))}</td>;
                      }))}
                      <td className="cp" style={{ textAlign: "left", paddingLeft: 8 }}><span className="prog"><i style={{ width: a.pct + "%" }} /></span><span className="pctxt">{a.pct}%</span></td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      </>)}

      {/* drawer */}
      {drawer && <><div className="ast-scrim" onClick={() => setDrawer(null)} />
        <div className="ast-drawer">
          <div className="dhead"><button className="dclose" onClick={() => setDrawer(null)}>{"\u2715"}</button><h3>{drawer.tag}</h3><div className="sub">{drawer.name} {"\u00B7"} {drawer.type} {"\u00B7"} {drawer.discipline === "M" ? "Mechanical" : "Electrical"} {"\u00B7"} {drawer.hall} {"\u00B7"} {drawer.level}</div></div>
          <div className="dsec"><h4>Checkpoint Status By Stage</h4>
            {bands.map((b) => (
              <div key={b.stage} className="stgrow"><span className="sd" style={{ background: b.color }} /><span className="sn2">{b.name}</span>
                <span className="chips">{b.steps.map((s) => { const v = (drawer.steps || {})[s.step_key] || 0; return <span key={s.step_key} className={"chip" + (v === 2 ? " yes" : "")}>{s.step_key}{v === 2 ? " \u2713" : v === 1 ? "" : " -"}</span>; })}</span>
              </div>
            ))}
          </div>
          <div className="dsec"><h4>Planned Vs Actual</h4>
            <table className="dtbl"><thead><tr><th>Milestone</th><th>Planned</th><th>Actual</th></tr></thead><tbody>
              {drawerRows(drawer).map((r) => { const ov = r.planned && r.planned < today && !r.actual && !r.done; return <tr key={r.name}><td className="mn">{r.name}</td><td>{r.planned || "-"}{ov && <span className="ovchip">OVERDUE</span>}</td><td>{r.actual || (r.done ? <span className="okchip">DONE</span> : "-")}</td></tr>; })}
            </tbody></table>
          </div>
          <div className="dsec"><h4>Overall</h4>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="prog" style={{ width: 180, height: 9 }}><i style={{ width: drawer.pct + "%" }} /></span><b>{drawer.pct}%</b><span style={{ color: "var(--muted)" }}>{drawer.done} of {drawer.applicable} applicable checkpoints</span></div>
          </div>
        </div></>}

      {/* step reference popup */}
      {refOpen && <><div className="ast-scrim" onClick={() => { setRefOpen(false); setRefEdit(null); }} />
        <div className="ast-modal wide">
          <div className="mhead"><h3>Cx Step Reference</h3><button className="dclose stat" onClick={() => { setRefOpen(false); setRefEdit(null); }}>{"\u2715"}</button></div>
          <div className="mbody">
            {isAdmin && <div className="notebox">Click a row to edit its definition, executing party, and sign-off authority. Imports refresh the structure but never touch this content.</div>}
            <table className="reftbl"><thead><tr><th>Step</th><th>Stage</th><th>What It Is</th><th>Executed By</th><th>Signed Off By</th></tr></thead><tbody>
              {stepsSorted.map((s) => refEdit && refEdit.step_key === s.step_key ? (
                <tr key={s.step_key} className="editing"><td><span className="stcell"><span className="dot" style={{ background: TAGC[s.stage] }} />{s.step_key}</span></td><td>{s.stage} {STAGE_NAME[s.stage]}</td>
                  <td><textarea value={refEdit.definition} onChange={(e) => setRefEdit({ ...refEdit, definition: e.target.value })} rows={2} /></td>
                  <td><input value={refEdit.executed_by} onChange={(e) => setRefEdit({ ...refEdit, executed_by: e.target.value })} /></td>
                  <td><input value={refEdit.signed_off_by} onChange={(e) => setRefEdit({ ...refEdit, signed_off_by: e.target.value })} />
                    <div className="editbtns"><button className="ast-btn on" onClick={async () => { const m = await saveStepReference(projectId, s.step_key, refEdit); if (m) setErr("Save failed: " + m); else { setStepDefs(stepDefs.map((x) => x.step_key === s.step_key ? { ...x, ...refEdit } : x)); setRefEdit(null); } }}>Save</button><button className="ast-btn" onClick={() => setRefEdit(null)}>Cancel</button></div></td></tr>
              ) : (
                <tr key={s.step_key} className={isAdmin ? "clickable" : ""} onClick={() => { if (isAdmin) setRefEdit({ step_key: s.step_key, definition: s.definition || "", executed_by: s.executed_by || "", signed_off_by: s.signed_off_by || "" }); }}>
                  <td><span className="stcell"><span className="dot" style={{ background: TAGC[s.stage] }} />{s.step_key}</span></td><td>{s.stage} {STAGE_NAME[s.stage]}</td>
                  <td>{s.definition || <span className="pend">Definition to follow</span>}</td><td>{s.executed_by || <span className="pend">To follow</span>}</td><td>{s.signed_off_by || <span className="pend">To follow</span>}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div></>}

      {/* sync modal */}
      {syncOpen && <><div className="ast-scrim" onClick={() => setSyncOpen(false)} />
        <div className="ast-modal">
          <div className="mhead"><h3>Sync From SharePoint</h3><button className="dclose stat" onClick={() => setSyncOpen(false)}>{"\u2715"}</button></div>
          <div className="mbody">
            <div className="notebox">Reads the Asset Cx Register directly from the Cx Master on SharePoint (Quantum MC tenant) and updates this page. Connection: {spAcct ? <b>connected as {spAcct}</b> : <b>not connected</b>}.</div>
            {!spAcct && <p className="ast-p">The sync runs as your Quantum MC identity, separate from the Outlook connection. Press Connect SharePoint for a quick full-page sign-in redirect, then reopen this window and run the sync.</p>}
            <div className="modalbtns">
              {!spAcct && <button className="ast-btn admin" onClick={onConnectSp}>Connect SharePoint</button>}
              <button className="ast-btn" onClick={() => setSyncOpen(false)}>Cancel</button>
              <button className="ast-btn on" disabled={busy || !spAcct} onClick={onSync}>{busy ? "Syncing\u2026" : "Run Sync"}</button>
            </div>
          </div>
        </div></>}

      {/* sync settings */}
      {cfgOpen && <><div className="ast-scrim" onClick={() => setCfgOpen(false)} />
        <div className="ast-modal">
          <div className="mhead"><h3>Sync Settings</h3><button className="dclose stat" onClick={() => setCfgOpen(false)}>{"\u2715"}</button></div>
          <div className="mbody">
            <div className="notebox">Paste the file's browser URL; no folder path is needed. Changing the tenant or client id takes effect after a page reload.</div>
            <CfgForm config={config} onSave={async (c) => { const m = await saveAssetStatusConfig(projectId, c); if (m) setErr("Save failed: " + m); else { setConfig({ ...(config || {}), ...c, project_id: projectId }); setCfgOpen(false); } }} onCancel={() => setCfgOpen(false)} />
          </div>
        </div></>}

      {/* import summary */}
      {summary && <><div className="ast-scrim" onClick={() => setSummary(null)} />
        <div className="ast-modal">
          <div className="mhead"><h3>{summary.source === "sharepoint" ? "Sync Complete" : "Import Complete"}</h3><button className="dclose stat" onClick={() => setSummary(null)}>{"\u2715"}</button></div>
          <div className="mbody">
            {summary.fileName && <p className="ast-p"><b>{summary.fileName}</b>{summary.lastModified ? ", last modified " + new Date(summary.lastModified).toLocaleString("en-GB") : ""}</p>}
            <table className="dtbl sum"><tbody>
              <tr><td className="mn">Rows read</td><td>{summary.read}</td></tr>
              <tr><td className="mn">Added</td><td>{summary.added}</td></tr>
              <tr><td className="mn">Updated</td><td>{summary.updated}</td></tr>
              <tr><td className="mn">Unchanged</td><td>{summary.unchanged}</td></tr>
            </tbody></table>
            {summary.warnings && summary.warnings.length > 0 && <div className="warnbox">{summary.warnings.map((w, i) => <div key={i}>{w}</div>)}</div>}
            <div className="modalbtns"><button className="ast-btn on" onClick={() => setSummary(null)}>Close</button></div>
          </div>
        </div></>}
    </div>
  );
}

function CfgForm({ config, onSave, onCancel }) {
  const [c, setC] = useState({ tenant_id: (config && config.tenant_id) || "", client_id: (config && config.client_id) || "", file_url: (config && config.file_url) || "", sheet_name: (config && config.sheet_name) || "Asset Cx Register" });
  const f = (k, label, ph) => <div className="ast-f full"><span>{label}</span><input value={c[k]} placeholder={ph || ""} onChange={(e) => setC({ ...c, [k]: e.target.value })} /></div>;
  return <div>
    {f("file_url", "SharePoint File URL", "https://...sharepoint.com/...")}
    {f("sheet_name", "Worksheet Name")}
    {f("tenant_id", "Tenant ID (Directory ID)")}
    {f("client_id", "Client ID (Application ID)")}
    <div className="modalbtns"><button className="ast-btn" onClick={onCancel}>Cancel</button><button className="ast-btn on" onClick={() => onSave(c)}>Save Settings</button></div>
  </div>;
}

/* ---------- CSS ---------- */
const AST_CSS = `
.ast{--ink:#16202c;--muted:#5d6b7c;--faint:#94a1b1;--accent:#3b82f6;--green:#18b69b;--amber:#e0a106;--red:#e2564e;--paper:#f7f8fa;--card:#ffffff;--card2:#f7f9fc;--line:#e3e8ef;--chipbg:#eef3fb;--hover:#eef3f9;--head:#2563EB;color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:13px;min-height:100%}
.ast.ast-dark{--ink:#e9eff6;--muted:#93a1b3;--faint:#5d6a7a;--paper:#10151C;--card:#1A222D;--card2:#141d29;--line:#2A3543;--chipbg:#22324A;--hover:#202B38;--head:#7FB0FF}
.ast-top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 18px;background:var(--card);border-bottom:1px solid var(--line)}
.ast-title{font-size:18px;font-weight:800;color:var(--head)}
.ast-title small{display:block;font-size:11.5px;font-weight:500;color:var(--muted);margin-top:2px}
.ast-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:7px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap}
.ast-btn:hover{background:var(--hover)}
.ast-btn.on{background:var(--accent);border-color:var(--accent);color:#fff}
.ast-btn.admin{border-color:#7C3AED;color:#7C3AED}
.ast-btn.admin:hover{background:rgba(124,58,237,.08)}
.ast-btn:disabled{opacity:.5;cursor:not-allowed}
.ast-err{display:flex;align-items:center;gap:10px;margin:10px 18px;padding:9px 13px;border:1px solid var(--red);border-radius:9px;color:var(--red);font-weight:600;background:var(--card)}
.ast-err button{margin-left:auto;border:0;background:transparent;color:var(--red);font-size:15px;cursor:pointer}
.ast-empty{padding:60px 20px;text-align:center;color:var(--muted)}
.ast-kpis{display:flex;border-bottom:1px solid var(--line);background:var(--card);overflow-x:auto}
.ast-kpi{padding:12px 20px;border-right:1px solid var(--line);min-width:128px}
.ast-kpi .v{font-size:22px;font-weight:800;line-height:1.1}
.ast-kpi .l{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin-top:2px}
.ast-kpi .s{font-size:11px;color:var(--muted);margin-top:2px}
.ast-kpi.warn .v{color:var(--red)}
.ast-kpi.click{cursor:pointer}
.ast-kpi.click:hover,.ast-kpi.on{background:var(--hover)}
.ast-pipe{display:flex;gap:8px;padding:12px 18px;background:var(--card);border-bottom:1px solid var(--line);overflow-x:auto}
.ast-stage{flex:1;min-width:148px;border:1px solid var(--line);border-radius:10px;padding:9px 12px;cursor:pointer;background:var(--paper)}
.ast-stage:hover{background:var(--hover)}
.ast-stage.active{box-shadow:0 0 0 2px var(--accent);background:var(--chipbg)}
.ast-stage .sn{display:flex;align-items:center;gap:7px;font-weight:800;font-size:12px}
.ast-stage .dot{width:11px;height:11px;border-radius:50%;flex:none}
.ast-stage .cnt{font-size:19px;font-weight:800;margin-top:4px}
.ast-stage .cnt small{font-size:11px;font-weight:600;color:var(--muted)}
.ast-stage .bar{height:5px;border-radius:3px;background:var(--line);margin-top:7px;overflow:hidden}
.ast-stage .bar i{display:block;height:100%;border-radius:3px}
.ast-arrow{align-self:center;color:var(--muted);font-size:15px;flex:none}
.ast-tools{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--line);background:var(--card)}
.ast-f{display:flex;flex-direction:column;gap:3px}
.ast-f.full{margin-bottom:10px}
.ast-f.full input{width:100%}
.ast-f>span{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.ast-f input,.ast-f select,.ast-f textarea{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:7px 9px;font-size:12.5px;font-family:inherit}
.ast-f input{width:200px}
.ast-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--card)}
.ast-seg button{border:0;background:transparent;padding:7px 11px;font-size:12px;cursor:pointer;color:var(--muted);font-weight:600;font-family:inherit}
.ast-seg button.sel{background:var(--ink);color:var(--paper)}
.ast-rel{position:relative}
.ast-pop{position:absolute;top:calc(100% + 6px);left:0;background:var(--card);border:1px solid var(--line);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:12px 14px;z-index:50;min-width:230px}
.ast-pop label{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px;font-weight:600;cursor:pointer}
.ast-pop .cap{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:8px 0 3px}
.ast-focus{display:flex;align-items:center;gap:12px;padding:9px 18px;background:var(--chipbg);border-bottom:1px solid var(--line)}
.ast-focus .fdot{width:12px;height:12px;border-radius:50%}
.ast-focus b{font-size:13px}
.ast-focus .stats{color:var(--muted);font-size:12.5px}
.ast-wrap{overflow:auto;max-height:calc(100vh - 130px)}
.ast-mx{border-collapse:separate;border-spacing:0;min-width:100%}
.ast-mx th,.ast-mx td{padding:0;font-size:12px}
.ast-mx thead th{position:sticky;background:var(--paper);z-index:20}
.ast-mx thead tr.bands th{top:0;height:26px}
.ast-mx thead tr.cols th{top:26px;border-bottom:2px solid var(--line);height:36px}
.bandcell{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#fff;text-align:center;border-right:2px solid var(--paper)}
.colh{font-size:10px;font-weight:700;color:var(--muted);text-align:center;min-width:48px;padding:4px 3px;border-right:1px solid var(--line);white-space:nowrap}
.colh.step{cursor:pointer}
.colh.step:hover{background:var(--hover);color:var(--ink)}
.colh.focused{background:var(--accent);color:#fff}
.colh.first{min-width:296px;text-align:left;padding:0 12px;position:sticky;left:0;z-index:22;background:var(--paper);border-right:2px solid var(--line)}
.ast-mx thead tr.bands th.first{position:sticky;left:0;z-index:22;background:var(--paper);border-right:2px solid var(--line)}
.firstin{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ast-info{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--accent);color:var(--accent);background:var(--card);font-size:11px;font-weight:800;cursor:pointer;font-family:Georgia,serif;font-style:italic;line-height:1;flex:none}
.ast-info:hover{background:var(--accent);color:#fff}
tr.grp td{background:var(--card2);border-bottom:1px solid var(--line);border-top:1px solid var(--line);cursor:pointer;padding:7px 10px}
tr.grp:hover td{background:var(--hover)}
tr.grp .gname{font-weight:800;font-size:12.5px;display:flex;align-items:center;gap:8px}
tr.grp .chev{transition:transform .15s;display:inline-block;font-size:10px;color:var(--muted)}
tr.grp.closed .chev{transform:rotate(-90deg)}
tr.grp .gcount{font-weight:600;color:var(--muted);font-size:11px}
.minibars{display:flex;gap:5px;align-items:center}
.mb{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--muted);font-weight:700}
.mb .t{width:44px;height:5px;border-radius:3px;background:var(--line);overflow:hidden}
.mb .t i{display:block;height:100%}
tr.arow td{border-bottom:1px solid var(--line);height:34px}
tr.arow:hover td{background:var(--hover)}
tr.arow{cursor:pointer}
.idcell{position:sticky;left:0;background:var(--card);border-right:2px solid var(--line);padding:4px 12px !important;z-index:10;min-width:296px;max-width:296px}
.idcell.grpcell{background:var(--card2)}
tr.arow:hover .idcell{background:var(--hover)}
.idcell .tg{font-weight:700;font-size:11.5px;font-family:ui-monospace,Menlo,Consolas,monospace}
.idcell .nm{font-size:10.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cp{text-align:center;border-right:1px solid var(--line)}
.cp.fcol{background:var(--chipbg)}
.ast-d{display:inline-block;width:13px;height:13px;border-radius:50%;vertical-align:middle}
.ast-d.y{position:relative}
.ast-d.y::after{content:"";position:absolute;left:4px;top:1px;width:3px;height:7px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(40deg)}
.ast-d.n{background:transparent;border:2px solid var(--line);width:11px;height:11px}
.ast-d.na{width:8px;height:2px;border-radius:1px;background:var(--line)}
.ast-d.ov{box-shadow:0 0 0 2px var(--red)}
.datecell{font-size:10px;color:var(--muted);font-family:ui-monospace,Menlo,Consolas,monospace}
.datecell.ov{color:var(--red);font-weight:700}
.prog{width:70px;height:6px;border-radius:3px;background:var(--line);display:inline-block;vertical-align:middle;overflow:hidden}
.prog i{display:block;height:100%;background:var(--accent)}
.pctxt{font-size:10.5px;font-weight:700;color:var(--muted);margin-left:6px}
.ast-scrim{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:60}
.ast-drawer{position:fixed;top:0;right:0;width:440px;max-width:92vw;height:100vh;background:var(--card);border-left:1px solid var(--line);z-index:61;overflow-y:auto;box-shadow:-12px 0 34px rgba(0,0,0,.18)}
.dhead{padding:16px 18px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--card);z-index:2}
.dhead h3{margin:0;font-size:14px;color:var(--head);font-family:ui-monospace,Menlo,Consolas,monospace}
.dhead .sub{color:var(--muted);font-size:12px;margin-top:3px}
.dclose{position:absolute;right:14px;top:14px;border:0;background:transparent;font-size:17px;cursor:pointer;color:var(--muted)}
.dclose.stat{position:static;margin-left:auto}
.dsec{padding:14px 18px;border-bottom:1px solid var(--line)}
.dsec h4{margin:0 0 9px;font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--accent)}
.stgrow{display:flex;align-items:center;gap:10px;padding:7px 0}
.stgrow .sd{width:12px;height:12px;border-radius:50%;flex:none}
.stgrow .sn2{font-weight:700;font-size:12px;width:88px;flex:none}
.stgrow .chips{display:flex;flex-wrap:wrap;gap:4px}
.chip{font-size:10px;font-weight:700;border-radius:5px;padding:2.5px 6px;border:1px solid var(--line);color:var(--muted)}
.chip.yes{background:var(--chipbg);color:var(--accent);border-color:transparent}
.dtbl{width:100%;border-collapse:collapse;font-size:11.5px}
.dtbl th{text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:4px 6px;border-bottom:1px solid var(--line)}
.dtbl td{padding:5px 6px;border-bottom:1px solid var(--line);font-family:ui-monospace,Menlo,Consolas,monospace}
.dtbl td.mn{font-family:inherit;font-weight:600}
.dtbl.sum td{font-size:13px}
.ovchip{background:var(--red);color:#fff;border-radius:5px;font-size:9.5px;font-weight:800;padding:2px 5px;margin-left:5px;font-family:inherit}
.okchip{background:var(--green);color:#fff;border-radius:5px;font-size:9.5px;font-weight:800;padding:2px 5px;margin-left:5px;font-family:inherit}
.ast-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.3);z-index:62;max-width:560px;width:94vw;max-height:86vh;overflow:auto}
.ast-modal.wide{max-width:900px}
.mhead{padding:15px 20px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--card);display:flex;align-items:center;gap:10px;z-index:2}
.mhead h3{margin:0;font-size:15px;color:var(--head)}
.mbody{padding:16px 20px}
.notebox{background:var(--chipbg);border-radius:8px;padding:10px 13px;font-size:12px;color:var(--accent);margin-bottom:14px;font-weight:600}
.warnbox{background:rgba(224,161,6,.12);border:1px solid var(--amber);border-radius:8px;padding:10px 13px;font-size:12px;color:var(--amber);margin-top:12px;font-weight:600}
.ast-p{font-size:12.5px;color:var(--muted);margin:0 0 12px}
.modalbtns{display:flex;gap:10px;margin-top:16px;justify-content:flex-end}
.reftbl{width:100%;border-collapse:collapse;font-size:12px}
.reftbl th{text-align:left;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);padding:7px 9px;border-bottom:2px solid var(--line)}
.reftbl td{padding:8px 9px;border-bottom:1px solid var(--line);vertical-align:top}
.reftbl tr.clickable{cursor:pointer}
.reftbl tr.clickable:hover td{background:var(--hover)}
.reftbl tr.editing td{background:var(--chipbg)}
.reftbl textarea,.reftbl input{width:100%;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:6px;padding:5px 7px;font-size:12px;font-family:inherit;box-sizing:border-box}
.stcell{display:flex;align-items:center;gap:7px;font-weight:700;white-space:nowrap}
.stcell .dot{width:9px;height:9px;border-radius:50%;flex:none}
.pend{color:var(--faint);font-style:italic}
.editbtns{display:flex;gap:6px;margin-top:6px}
`;
