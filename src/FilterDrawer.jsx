// REV332: shared ACC-style filter drawer for schedule surfaces. First consumer is the
// Schedule page (Gantt, Calendar, Workload and all four exports). Self-contained: the
// pure filter engine lives here so it can be harnessed in Node without a DOM, and the
// drawer carries its own scoped styles (fdw- prefix) reading the app's CSS variables.
// No em or en dashes anywhere in this file.
import { useMemo, useState } from "react";

// ---- filter state ----
export const emptyFilters = () => ({
  companies: [], stages: [], statuses: [], areas: [], subAreas: [], tier3s: [],
  systems: [], assetQ: "", disciplines: [], crews: [],
  committed: "any", witness: "any", milestone: "any",
  pctMin: "", pctMax: "", startFrom: "", startTo: "",
  lateOnly: false, openConstraints: false, hasPreds: false,
});

// How many sections carry a non-default value; drives the toolbar badge.
export function countActiveFilters(f) {
  if (!f) return 0;
  let n = 0;
  ["companies", "stages", "statuses", "areas", "subAreas", "tier3s", "systems", "disciplines", "crews"].forEach((k) => { if ((f[k] || []).length) n++; });
  if ((f.assetQ || "").trim()) n++;
  if (f.committed !== "any") n++;
  if (f.witness !== "any") n++;
  if (f.milestone !== "any") n++;
  if (f.pctMin !== "" || f.pctMax !== "") n++;
  if (f.startFrom || f.startTo) n++;
  if (f.lateOnly) n++;
  if (f.openConstraints) n++;
  if (f.hasPreds) n++;
  return n;
}

// ---- the pure engine. OR within a section, AND across sections. ----
const pctVal = (a) => (a && a.percent != null) ? Math.max(0, Math.min(100, Math.round(a.percent))) : ((a && a.status === "complete") ? 100 : 0);
const statusBucket = (a) => a.outcome === "failed" ? "failed" : (a.status === "complete" ? "complete" : (a.status === "in_progress" ? "in_progress" : "planned"));
const finishISO = (a) => {
  if (!a.start) return "";
  const d = new Date(a.start + "T00:00:00");
  d.setDate(d.getDate() + Math.max(1, a.duration || 1) - 1);
  const p = (x) => String(x).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
};
const inList = (sel, v) => !sel.length || sel.includes(v || "");
const anyOf = (sel, arr) => !sel.length || (arr || []).some((x) => sel.includes(x));

export function applyActivityFilters(list, f, todayIso) {
  if (!f) return list;
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const aq = (f.assetQ || "").trim().toLowerCase();
  return list.filter((a) => {
    if (!inList(f.companies, a.companyId)) return false;
    if (!inList(f.stages, a.level)) return false;
    if (f.statuses.length && !f.statuses.includes(statusBucket(a))) return false;
    if (!inList(f.areas, a.area)) return false;
    if (!inList(f.subAreas, a.subArea)) return false;
    if (!inList(f.tier3s, a.tier3)) return false;
    if (!inList(f.systems, a.system)) return false;
    if (aq && !(a.asset || "").toLowerCase().includes(aq)) return false;
    if (!anyOf(f.disciplines, a.discipline)) return false;
    if (!anyOf(f.crews, a.crew)) return false;
    if (f.committed === "will" && !a.committed) return false;
    if (f.committed === "unc" && a.committed) return false;
    if (f.witness === "points" && !a.witnessInvite) return false;
    if (f.witness === "sent" && !(a.witnessInvite && a.witnessSentAt)) return false;
    if (f.witness === "nosent" && !(a.witnessInvite && !a.witnessSentAt)) return false;
    if (f.milestone === "only" && !a.isMilestone) return false;
    if (f.milestone === "hide" && a.isMilestone) return false;
    const p = pctVal(a);
    if (f.pctMin !== "" && p < Number(f.pctMin)) return false;
    if (f.pctMax !== "" && p > Number(f.pctMax)) return false;
    if (f.startFrom && (a.start || "") < f.startFrom) return false;
    if (f.startTo && (a.start || "") > f.startTo) return false;
    if (f.lateOnly) { const fin = finishISO(a); const b = statusBucket(a); if (!fin || fin >= today || b === "complete" || b === "failed") return false; }
    if (f.openConstraints && !(a.constraints || []).some((c) => !c.done)) return false;
    if (f.hasPreds && !(a.predecessors || []).length) return false;
    return true;
  });
}

// ---- option helpers: counts computed against all OTHER active sections, ACC style ----
const countsFor = (acts, f, dropKey, today) => {
  const g = { ...f, [dropKey]: Array.isArray(f[dropKey]) ? [] : (dropKey === "assetQ" ? "" : "any") };
  return applyActivityFilters(acts, g, today);
};

const css = `
.fdw-scrim{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:70}
.fdw{position:fixed;top:0;right:0;height:100vh;width:372px;max-width:94vw;background:var(--card);border-left:1px solid var(--line);box-shadow:-14px 0 40px rgba(0,0,0,.45);z-index:71;display:flex;flex-direction:column;color:var(--ink)}
.fdw-stick{border-bottom:1px solid var(--line);padding:13px 16px 11px;background:var(--paper)}
.fdw-top{display:flex;align-items:center;gap:10px;margin-bottom:9px}
.fdw-top h3{margin:0;font-size:14px;flex:1;color:var(--ink)}
.fdw-count{font-size:12px;color:var(--st-done);font-weight:600;white-space:nowrap}
.fdw-x{background:none;border:0;color:var(--muted);font-size:17px;cursor:pointer;line-height:1}
.fdw-search{width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:7px 11px;font-size:12.5px;margin-bottom:9px}
.fdw-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.fdw-chip{display:inline-flex;align-items:center;gap:6px;background:color-mix(in srgb, #3b82f6 22%, var(--card));color:var(--ink);border-radius:99px;padding:3px 10px;font-size:11.5px;font-weight:600}
.fdw-chip b{cursor:pointer;font-weight:700;color:var(--muted)}
.fdw-clear{background:none;border:0;color:var(--muted);font-size:11.5px;cursor:pointer;text-decoration:underline;padding:0;margin-left:auto}
.fdw-body{flex:1;overflow:auto;padding:4px 0 16px}
.fdw-sec{border-bottom:1px solid var(--line)}
.fdw-sec summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:12.5px;font-weight:700;color:var(--ink)}
.fdw-sec summary::-webkit-details-marker{display:none}
.fdw-sec summary::before{content:"\\25B8";color:var(--muted);font-size:10px}
.fdw-sec[open] summary::before{content:"\\25BE"}
.fdw-on{margin-left:auto;font-size:10.5px;font-weight:700;color:#3b82f6}
.fdw-opts{padding:2px 16px 12px 30px;display:flex;flex-direction:column;gap:7px}
.fdw-opt{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--ink);cursor:pointer}
.fdw-cb{width:14px;height:14px;border:1.5px solid var(--line);border-radius:4px;flex:none;position:relative}
.fdw-cb.on{background:#3b82f6;border-color:#3b82f6}
.fdw-cb.on::after{content:"\\2713";color:#fff;font-size:10px;position:absolute;top:-1px;left:2px}
.fdw-n{margin-left:auto;color:var(--muted);font-size:11px}
.fdw-pills{display:flex;gap:6px;padding:2px 16px 12px 30px;flex-wrap:wrap}
.fdw-pill{border:1px solid var(--line);border-radius:99px;padding:4px 12px;font-size:11.5px;cursor:pointer;color:var(--ink);display:inline-flex;align-items:center;gap:6px;background:none}
.fdw-pill.sel{background:#3b82f6;border-color:#3b82f6;color:#fff;font-weight:600}
.fdw-sw{display:inline-block;width:9px;height:9px;border-radius:2px}
.fdw-rng{display:flex;gap:8px;align-items:center;padding:2px 16px 12px 30px;font-size:12px;color:var(--muted);flex-wrap:wrap}
.fdw-rng input{background:var(--card);border:1px solid var(--line);color:var(--ink);border-radius:7px;padding:5px 8px;font-size:12px}
.fdw-foot{border-top:1px solid var(--line);padding:11px 16px;display:flex;gap:10px;background:var(--paper)}
.fdw-foot .lk-btn{flex:1;justify-content:center}
`;

const upd = (f, k, v) => ({ ...f, [k]: v });
const tgl = (f, k, v) => { const cur = f[k] || []; return { ...f, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] }; };
const seg = (f, k, v) => ({ ...f, [k]: f[k] === v ? "any" : v });

export default function FilterDrawer({ open, onClose, value, onChange, acts, coName, LV, shown, total }) {
  const [q, setQ] = useState("");
  const f = value || emptyFilters();
  const today = new Date().toISOString().slice(0, 10);
  const nq = q.trim().toLowerCase();
  const match = (label) => !nq || String(label).toLowerCase().includes(nq);

  // Distinct option lists derived from the data actually on the schedule, with
  // counts against the other active sections. Cascade: Level from selected
  // Buildings, Zone from selected Levels, as in the editor.
  const O = useMemo(() => {
    const uniq = (arr) => [...new Set(arr)].sort((a, b) => String(a).localeCompare(String(b)));
    const base = (k) => countsFor(acts, f, k, today);
    const opt = (k, pick) => { const pool = base(k); const cn = {}; pool.forEach((a) => { const vs = pick(a); (Array.isArray(vs) ? vs : [vs]).forEach((v) => { cn[v || ""] = (cn[v || ""] || 0) + 1; }); }); return cn; };
    const co = opt("companies", (a) => a.companyId);
    const st = opt("stages", (a) => a.level);
    const su = opt("statuses", (a) => statusBucket(a));
    const ar = opt("areas", (a) => a.area);
    const sa = opt("subAreas", (a) => a.subArea);
    const t3 = opt("tier3s", (a) => a.tier3);
    const sy = opt("systems", (a) => a.system);
    const di = opt("disciplines", (a) => a.discipline);
    const cr = opt("crews", (a) => a.crew);
    const areaOf = {}; const saOf = {};
    acts.forEach((a) => { if (a.subArea) areaOf[a.subArea] = a.area || ""; if (a.tier3) saOf[a.tier3] = a.subArea || ""; });
    const saKeys = uniq(Object.keys(sa)).filter((v) => v && (!f.areas.length || f.areas.includes(areaOf[v] || "")));
    const t3Keys = uniq(Object.keys(t3)).filter((v) => v && (!f.subAreas.length || f.subAreas.includes(saOf[v] || "")));
    return { co, st, su, ar, sa, t3, sy, di, cr, coKeys: uniq(Object.keys(co)), stKeys: uniq(Object.keys(st)).filter(Boolean), arKeys: uniq(Object.keys(ar)).filter(Boolean), saKeys, t3Keys, syKeys: uniq(Object.keys(sy)).filter(Boolean), diKeys: uniq(Object.keys(di)).filter(Boolean), crKeys: uniq(Object.keys(cr)).filter(Boolean) };
  }, [acts, f, today]);

  if (!open) return null;
  const set = (nf) => onChange(nf);
  const chips = [];
  f.companies.forEach((id) => chips.push({ k: "Company: " + (id ? (coName(id) || id) : "Unassigned"), un: () => set(tgl(f, "companies", id)) }));
  f.stages.forEach((s) => chips.push({ k: "Cx Stage: " + s, un: () => set(tgl(f, "stages", s)) }));
  f.statuses.forEach((s) => chips.push({ k: "Status: " + s.replace("_", " "), un: () => set(tgl(f, "statuses", s)) }));
  if (f.committed !== "any") chips.push({ k: f.committed === "will" ? "WILL only" : "Uncommitted", un: () => set(upd(f, "committed", "any")) });
  if (f.witness !== "any") chips.push({ k: "Witness: " + f.witness, un: () => set(upd(f, "witness", "any")) });
  if (f.milestone !== "any") chips.push({ k: f.milestone === "only" ? "Milestones only" : "Hide milestones", un: () => set(upd(f, "milestone", "any")) });
  if (f.lateOnly) chips.push({ k: "Late only", un: () => set(upd(f, "lateOnly", false)) });
  if (f.openConstraints) chips.push({ k: "Open constraints", un: () => set(upd(f, "openConstraints", false)) });
  const extra = f.areas.length + f.subAreas.length + f.tier3s.length + f.systems.length + f.disciplines.length + f.crews.length + (f.assetQ ? 1 : 0) + ((f.pctMin !== "" || f.pctMax !== "") ? 1 : 0) + ((f.startFrom || f.startTo) ? 1 : 0) + (f.hasPreds ? 1 : 0);

  const CheckSec = ({ title, keys, counts, selKey, label }) => {
    const vis = keys.filter((v) => match(label ? label(v) : v));
    if (nq && !vis.length) return null;
    return <details className="fdw-sec" open={!!(f[selKey] || []).length || !!nq}>
      <summary>{title}{(f[selKey] || []).length ? <span className="fdw-on">{f[selKey].length} selected</span> : null}</summary>
      <div className="fdw-opts">
        {vis.map((v) => <label key={v || "(none)"} className="fdw-opt" onClick={() => set(tgl(f, selKey, v))}>
          <span className={"fdw-cb" + ((f[selKey] || []).includes(v) ? " on" : "")} /> {label ? label(v) : (v || "Unassigned")} <span className="fdw-n">{counts[v] || 0}</span>
        </label>)}
        {!vis.length && <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Nothing on the schedule yet.</span>}
      </div>
    </details>;
  };

  return <>
    <style>{css}</style>
    <div className="fdw-scrim" onClick={onClose} />
    <div className="fdw" role="dialog" aria-label="Schedule filters">
      <div className="fdw-stick">
        <div className="fdw-top"><h3>Filters</h3><span className="fdw-count">{shown} of {total} shown</span><button className="fdw-x" onClick={onClose}>{"\u00d7"}</button></div>
        <input className="fdw-search" placeholder="Search all filters, e.g. CRAH, Velox, L3..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="fdw-chips">
          {chips.slice(0, 6).map((c, i) => <span key={i} className="fdw-chip">{c.k} <b onClick={c.un}>{"\u00d7"}</b></span>)}
          {(chips.length > 6 || extra > 0) && <span className="fdw-chip">+{Math.max(0, chips.length - 6) + extra} more</span>}
          {(chips.length > 0 || extra > 0) && <button className="fdw-clear" onClick={() => set(emptyFilters())}>Clear all</button>}
        </div>
      </div>
      <div className="fdw-body">
        <CheckSec title="Company" keys={O.coKeys} counts={O.co} selKey="companies" label={(v) => v ? (coName(v) || "Unknown") : "Unassigned"} />
        {(!nq || O.stKeys.some((s) => match(s) || match((LV[s] || {}).name || ""))) && <details className="fdw-sec" open={!!f.stages.length || !!nq}>
          <summary>Cx Stage{f.stages.length ? <span className="fdw-on">{f.stages.length} selected</span> : null}</summary>
          <div className="fdw-pills">{O.stKeys.map((s) => <button key={s} className={"fdw-pill" + (f.stages.includes(s) ? " sel" : "")} onClick={() => set(tgl(f, "stages", s))}><span className="fdw-sw" style={{ background: (LV[s] || {}).color || "#64748B" }} />{s}<span style={{ opacity: .7 }}>{O.st[s] || 0}</span></button>)}</div>
        </details>}
        {!nq && <details className="fdw-sec" open={!!f.statuses.length}>
          <summary>Status{f.statuses.length ? <span className="fdw-on">{f.statuses.length} selected</span> : null}</summary>
          <div className="fdw-pills">{[["planned", "Not started"], ["in_progress", "In progress"], ["complete", "Complete"], ["failed", "Failed"]].map(([k, l]) => <button key={k} className={"fdw-pill" + (f.statuses.includes(k) ? " sel" : "")} onClick={() => set(tgl(f, "statuses", k))}>{l}<span style={{ opacity: .7 }}>{O.su[k] || 0}</span></button>)}</div>
        </details>}
        <CheckSec title="Building" keys={O.arKeys} counts={O.ar} selKey="areas" />
        <CheckSec title="Level" keys={O.saKeys} counts={O.sa} selKey="subAreas" />
        <CheckSec title="Zone / Room" keys={O.t3Keys} counts={O.t3} selKey="tier3s" />
        <CheckSec title="System" keys={O.syKeys} counts={O.sy} selKey="systems" />
        {!nq && <details className="fdw-sec" open={!!f.assetQ}>
          <summary>Asset{f.assetQ ? <span className="fdw-on">filtered</span> : null}</summary>
          <div className="fdw-rng"><input style={{ width: "100%" }} placeholder="Search tags, e.g. GY01, CRAH..." value={f.assetQ} onChange={(e) => set(upd(f, "assetQ", e.target.value))} /></div>
        </details>}
        <CheckSec title="Discipline" keys={O.diKeys} counts={O.di} selKey="disciplines" />
        <CheckSec title="Crew" keys={O.crKeys} counts={O.cr} selKey="crews" />
        {!nq && <details className="fdw-sec" open={f.committed !== "any" || f.witness !== "any" || f.milestone !== "any"}>
          <summary>Commitment and witness</summary>
          <div className="fdw-pills">
            <button className={"fdw-pill" + (f.committed === "will" ? " sel" : "")} onClick={() => set(seg(f, "committed", "will"))}>Committed (WILL) only</button>
            <button className={"fdw-pill" + (f.committed === "unc" ? " sel" : "")} onClick={() => set(seg(f, "committed", "unc"))}>Uncommitted only</button>
          </div>
          <div className="fdw-pills">
            <button className={"fdw-pill" + (f.witness === "points" ? " sel" : "")} onClick={() => set(seg(f, "witness", "points"))}>Witness points only</button>
            <button className={"fdw-pill" + (f.witness === "sent" ? " sel" : "")} onClick={() => set(seg(f, "witness", "sent"))}>Invite sent</button>
            <button className={"fdw-pill" + (f.witness === "nosent" ? " sel" : "")} onClick={() => set(seg(f, "witness", "nosent"))}>No invite yet</button>
          </div>
          <div className="fdw-pills">
            <button className={"fdw-pill" + (f.milestone === "only" ? " sel" : "")} onClick={() => set(seg(f, "milestone", "only"))}>Milestones only</button>
            <button className={"fdw-pill" + (f.milestone === "hide" ? " sel" : "")} onClick={() => set(seg(f, "milestone", "hide"))}>Hide milestones</button>
          </div>
        </details>}
        {!nq && <details className="fdw-sec" open={f.pctMin !== "" || f.pctMax !== "" || !!f.startFrom || !!f.startTo || f.lateOnly || f.openConstraints || f.hasPreds}>
          <summary>Progress and dates</summary>
          <div className="fdw-rng">% done <input style={{ width: 58 }} type="number" min="0" max="100" placeholder="min" value={f.pctMin} onChange={(e) => set(upd(f, "pctMin", e.target.value))} /> to <input style={{ width: 58 }} type="number" min="0" max="100" placeholder="max" value={f.pctMax} onChange={(e) => set(upd(f, "pctMax", e.target.value))} /></div>
          <div className="fdw-rng">Start between <input type="date" value={f.startFrom} onChange={(e) => set(upd(f, "startFrom", e.target.value))} /> and <input type="date" value={f.startTo} onChange={(e) => set(upd(f, "startTo", e.target.value))} /></div>
          <div className="fdw-pills">
            <button className={"fdw-pill" + (f.lateOnly ? " sel" : "")} onClick={() => set(upd(f, "lateOnly", !f.lateOnly))}>Late only</button>
            <button className={"fdw-pill" + (f.openConstraints ? " sel" : "")} onClick={() => set(upd(f, "openConstraints", !f.openConstraints))}>Open constraints</button>
            <button className={"fdw-pill" + (f.hasPreds ? " sel" : "")} onClick={() => set(upd(f, "hasPreds", !f.hasPreds))}>Has predecessors</button>
          </div>
        </details>}
      </div>
      <div className="fdw-foot">
        <button className="lk-btn" onClick={() => set(emptyFilters())}>Clear all</button>
        <button className="lk-btn" style={{ background: "#2456A6", borderColor: "#2456A6", color: "#fff", fontWeight: 700 }} onClick={onClose}>Done</button>
      </div>
    </div>
  </>;
}
