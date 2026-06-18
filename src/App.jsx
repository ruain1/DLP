import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadAll, syncCollections, userOp, signOut, subscribeAll, updateBranding, uploadLogo, applyBrandToTab } from "./data";

const KEY = "fin04_app_v3";
const DAYMS = 86400000;
const DEFAULT_LEVELS = {
  L1: { name: "Factory", color: "#64748B" },
  L2: { name: "Site install & static", color: "#0E9384" },
  L3: { name: "Energise / startup / functional", color: "#D97706" },
  L4: { name: "Performance", color: "#7C3AED" },
};
const tintOf = (hex) => { try { let h = (hex || "#64748B").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, mix = (c) => Math.round(c + (255 - c) * 0.86); return `rgb(${mix(r)},${mix(g)},${mix(b)})`; } catch (e) { return "#EEF1F5"; } };
const lvOf = (levels, k) => (levels && levels[k]) || (levels && Object.values(levels)[0]) || DEFAULT_LEVELS.L2;
const THEMES = {
  light: { ink: "#16202E", paper: "#F7F8FA", card: "#FFFFFF", line: "#DCE1E8", muted: "#6B7785", accent: "#1E5FCC", weekend: "#EFF1F5", todcell: "#F0F5FE", todhead: "#E8EFFB", hover: "#EAF0F9", chipbg: "#E8EFFB" },
  dark: { ink: "#E6EAF0", paper: "#10151C", card: "#1A222D", line: "#2A3543", muted: "#8A97A6", accent: "#6B9BF2", weekend: "#161D26", todcell: "#18222F", todhead: "#1B2737", hover: "#202B38", chipbg: "#22324A" },
};

const css = `
.lk{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--paper);
  height:100%;width:100%;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}
.lk *{box-sizing:border-box}
.mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
.lk-bar{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.lk-title{font-weight:700;font-size:16px;letter-spacing:-0.01em}
.lk-sub{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:0.12em;margin-top:2px}
.lk-nav{display:flex;align-items:center;gap:4px}
.lk-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--card);color:var(--ink);
  border-radius:8px;padding:7px 10px;font-size:12.5px;cursor:pointer;font-weight:500;transition:.12s}
.lk-btn:hover{border-color:var(--muted)}.lk-btn.icon{padding:7px 8px}
.lk-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.lk-btn.on{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.lk-btn:disabled{opacity:.45;cursor:not-allowed}
.lk-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--card)}
.lk-seg button{border:0;background:transparent;padding:7px 11px;font-size:12px;cursor:pointer;color:var(--muted);font-weight:600}
.lk-seg button.sel{background:var(--ink);color:var(--paper)}
.lk-spacer{flex:1}
.lk-sel{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:6px 9px;font-size:12.5px;font-family:inherit;cursor:pointer}
.lk-who{display:flex;align-items:center;gap:7px;font-size:12px}
.lk-pill{font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:5px}
.lk-pill.admin{background:#7C3AED;color:#fff}.lk-pill.member{background:var(--chipbg);color:var(--accent)}
.lk-metrics{display:flex;border-bottom:1px solid var(--line);background:var(--card);overflow-x:auto}
.lk-metric{padding:10px 20px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:2px;min-width:118px}
.lk-metric .v{font-size:21px;font-weight:700;line-height:1}
.lk-metric .l{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
.lk-metric .sub{font-size:10.5px;color:var(--muted)}
.lk-board{flex:1;overflow:auto;position:relative}
.lk-head{display:grid;position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:1px solid var(--line)}
.lk-wk{border-right:1px solid var(--line);padding:6px 9px 3px;font-size:10.5px;font-weight:700;letter-spacing:.04em;border-bottom:1px solid var(--line)}
.lk-wk .wc{color:var(--muted);font-weight:500;margin-left:5px}
.lk-day{padding:4px 0 5px;text-align:center;border-right:1px solid var(--line);font-size:9.5px;color:var(--muted)}
.lk-day .wd{text-transform:uppercase;letter-spacing:.06em}
.lk-day .dn{font-size:12.5px;color:var(--ink);font-weight:600;margin-top:1px}
.lk-day.we{background:var(--weekend)}.lk-day.tod{background:var(--todhead)}.lk-day.tod .dn{color:var(--accent)}
.lk-lane{display:grid;border-bottom:1px solid var(--line)}
.lk-llbl{position:sticky;left:0;z-index:4;background:var(--paper);border-right:1px solid var(--line);padding:9px 11px;
  display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600}
.lk-llbl .cnt{font-size:9.5px;color:var(--muted);font-weight:500}
.lk-llbl .sw{width:8px;height:8px;border-radius:2px;flex:none}
.lk-track{position:relative}
.lk-under{position:absolute;inset:0;display:grid;z-index:0}
.lk-cell{border-right:1px solid var(--line);cursor:cell}
.lk-cell.we{background:var(--weekend)}.lk-cell.tod{background:var(--todcell);border-left:2px solid var(--accent)}
.lk-cell:hover{background:var(--hover)}.lk-cell.nodrop{cursor:not-allowed}
.lk-tk{position:relative;z-index:1;display:grid;padding:6px 0;gap:6px;pointer-events:none}
.lk-ticket{pointer-events:auto;background:var(--card);border:1px solid var(--line);border-left-width:4px;border-radius:7px;
  padding:6px 9px 10px;font-size:11.5px;cursor:grab;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06);min-width:0;
  display:flex;flex-direction:column;justify-content:flex-start;gap:3px;transition:box-shadow .12s}
.lk-ticket:hover{box-shadow:0 3px 10px rgba(0,0,0,.16)}.lk-ticket:active{cursor:grabbing}
.lk-ticket.ro{cursor:default;border-style:dotted}
.lk-ticket .desc{flex:0 0 auto;font-weight:600;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lk-ticket .meta{flex:0 0 auto;font-size:10px;line-height:1.3;color:var(--muted);display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden}
.lk-ticket .dot{width:7px;height:7px;border-radius:50%;flex:none}
.lk-ticket.constrained{border-left-style:dashed}
.lk-ticket.complete{opacity:.5}.lk-ticket.complete .desc{text-decoration:line-through}
.lk-ticket.dim{opacity:.16;filter:grayscale(.6)}
.lk-ticket.spot{box-shadow:0 0 0 2px #E0A106,0 4px 14px rgba(224,161,6,.28)}
.lk-chip{font-size:8.5px;font-weight:700;letter-spacing:.04em;padding:1px 5px;border-radius:4px;text-transform:uppercase}
.lk-chip.commit{background:var(--chipbg);color:var(--accent)}
.lk-chip.cstr{background:#FBEFD6;color:#9A6A00;display:inline-flex;align-items:center;gap:3px}
.lk-chip.late{background:#F6D6D3;color:#9B1C16}
.lk-chip.wit{background:#E7E0FB;color:#5B33C7}
.lk-ms{pointer-events:auto;display:flex;align-items:center;gap:5px;cursor:grab;overflow:visible;align-self:center;z-index:2}
.lk-ms .dia{width:12px;height:12px;transform:rotate(45deg);flex:none;border:1px solid rgba(0,0,0,.2)}
.lk-ms .mslbl{font-size:10.5px;font-weight:600;white-space:nowrap;pointer-events:none}
.lk-grow{display:grid}
.lk-grow .gl{position:sticky;left:0;z-index:3;background:var(--paper);border-right:1px solid var(--line);border-bottom:1px solid var(--line);
  padding:7px 11px;display:flex;align-items:center;gap:8px;font-size:11.5px}
.lk-grow .gl .sw{width:9px;height:9px;border-radius:2px;flex:none}
.lk-grow .gl .nm{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lk-grow .gl .cm{font-size:10px;color:var(--muted);white-space:nowrap}
.lk-empty{padding:54px 20px;color:var(--muted);font-size:13px;text-align:center}
.lk-legend{display:flex;gap:14px;align-items:center;padding:8px 20px;border-top:1px solid var(--line);font-size:10.5px;color:var(--muted);flex-wrap:wrap;background:var(--card)}
.lk-legend .it{display:flex;align-items:center;gap:6px}.lk-legend .sw{width:11px;height:11px;border-radius:3px}
.lk-pv{font-size:10.5px;color:var(--muted);padding:6px 20px;background:var(--card);border-top:1px solid var(--line);display:flex;align-items:center;gap:8px}
.lk-bg{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:20;display:flex;justify-content:flex-end}
.lk-drawer{width:400px;max-width:94vw;height:100%;overflow:auto;background:var(--paper);box-shadow:-8px 0 30px rgba(0,0,0,.3);display:flex;flex-direction:column}
.lk-dh{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--paper);z-index:2}
.lk-dh h3{margin:0;font-size:15px;font-weight:700}
.lk-db{padding:16px 18px;display:flex;flex-direction:column;gap:13px}
.lk-f{display:flex;flex-direction:column;gap:5px}
.lk-f label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600}
.lk-in,.lk-select{border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:13px;background:var(--card);color:var(--ink);font-family:inherit;width:100%}
.lk-in:focus,.lk-select:focus{outline:2px solid var(--accent);outline-offset:-1px}
.lk-in:disabled{opacity:.6}
.lk-row{display:flex;gap:10px}.lk-row>*{flex:1}
.lk-levels{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.lk-lvl{border:1px solid var(--line);border-radius:8px;padding:8px;cursor:pointer;font-size:11.5px;font-weight:600;display:flex;align-items:center;gap:7px;background:var(--card)}
.lk-lvl.sel{box-shadow:inset 0 0 0 2px var(--ink)}.lk-lvl .sw{width:10px;height:10px;border-radius:3px;flex:none}
.lk-cstr{display:flex;align-items:center;gap:8px;font-size:12.5px}
.lk-cstr input{width:16px;height:16px;accent-color:var(--accent)}.lk-cstr .t{flex:1}.lk-cstr .t.done{text-decoration:line-through;color:var(--muted)}
.lk-cstr button{border:0;background:transparent;color:var(--muted);cursor:pointer}
.lk-add{display:flex;gap:6px}
.lk-tog{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);border-radius:8px;padding:9px 11px;background:var(--card);font-size:13px;font-weight:600;cursor:pointer}
.lk-tog.on{border-color:var(--accent)}
.lk-sw2{width:34px;height:19px;border-radius:10px;background:var(--line);position:relative;transition:.15s;flex:none}
.lk-sw2::after{content:"";position:absolute;width:15px;height:15px;border-radius:50%;background:#fff;top:2px;left:2px;transition:.15s}
.lk-tog.on .lk-sw2{background:var(--accent)}.lk-tog.on .lk-sw2::after{left:17px}
.lk-status{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;width:100%}
.lk-status button{border:0;background:transparent;padding:7px 0;flex:1;font-size:11.5px;cursor:pointer;color:var(--muted);font-weight:600}
.lk-status button.sel{background:var(--ink);color:var(--paper)}
.lk-df{padding:13px 18px;border-top:1px solid var(--line);display:flex;gap:10px;position:sticky;bottom:0;background:var(--paper)}
.lk-tabs{display:flex;gap:4px;padding:10px 18px 0;flex-wrap:wrap}
.lk-tabs button{border:1px solid var(--line);background:var(--card);color:var(--muted);border-radius:7px;padding:6px 10px;font-size:11.5px;font-weight:600;cursor:pointer}
.lk-tabs button.sel{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.lk-list{display:flex;flex-direction:column;gap:6px}
.lk-li{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--card);font-size:12.5px}
.lk-li .g{flex:1;min-width:0}.lk-li .g .s{font-size:10.5px;color:var(--muted)}
.lk-li button{border:0;background:transparent;color:var(--muted);cursor:pointer;padding:2px}
.lk-audit{font-size:11.5px;display:flex;flex-direction:column;gap:1px;border-bottom:1px solid var(--line);padding:7px 0}
.lk-audit .a{font-weight:600}.lk-audit .m{color:var(--muted);font-size:10.5px}
`;

const I = {
  plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  cl: <polyline points="15 18 9 12 15 6"/>, cr: <polyline points="9 18 15 12 9 6"/>,
  alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  check: <polyline points="20 6 9 17 4 12"/>,
  trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
  cross: <><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></>,
  cal: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
};
const Icon = ({ n, s = 16 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{I[n]}</svg>;

const todayMid = () => new Date().setHours(0, 0, 0, 0);
const parseD = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtISO = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const addDays = (dt, n) => { const x = new Date(dt); x.setDate(x.getDate() + n); return x; };
const mondayOf = (dt) => { const x = new Date(dt); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };
const isoWeek = (dt) => { const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const ft = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); const fd = (ft.getUTCDay() + 6) % 7; ft.setUTCDate(ft.getUTCDate() - fd + 3); return 1 + Math.round((t - ft) / 6048e5); };
const openCount = (a) => a.constraints.filter((c) => !c.done).length;
const uid = (p) => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
const csvCell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCSV = (headers, rows) => [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
const downloadFile = (name, text) => { try { const url = URL.createObjectURL(new Blob([text], { type: "text/csv" })); const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (e) {} };
const SUBSEP = " \u203A "; // area › sub-area, used as the lane key when grouping by sub-area
const laneOfArea = (a) => a.area ? (a.subArea ? a.area + SUBSEP + a.subArea : a.area) : "Unassigned";

function defaults() {
  const anchor = mondayOf(new Date());
  const companies = [
    { id: "co1", name: "Nordic EPOD" }, { id: "co2", name: "Mecwide" }, { id: "co3", name: "Eaton" },
    { id: "co4", name: "Baudouin" }, { id: "co5", name: "Daikin" }, { id: "co6", name: "IKM" },
  ];
  return {
    theme: "light", view: "swimlane", grain: "day", laneBy: "company", currentUserId: "u1",
    companies,
    users: [
      { id: "u1", name: "R Burrows (QMC)", role: "admin", companyId: null },
      { id: "u2", name: "EPOD planner", role: "member", companyId: "co1" },
      { id: "u3", name: "Mecwide planner", role: "member", companyId: "co2" },
    ],
    areas: ["Data Hall 1", "Data Hall 2", "MV Room", "Electrical Room", "Generator Yard", "Cooling Plant", "Pump Room"],
    systems: ["MV Switchgear", "LV Distribution", "Generators", "UPS", "Chilled Water", "CRAH/CRAC", "BMS", "EPMS"],
    settings: { weeks: 4, makeReadyDays: 7 },
    levels: JSON.parse(JSON.stringify(DEFAULT_LEVELS)),
    audit: [],
    activities: [
      { id: "a1", desc: "MV switchgear primary energisation", companyId: "co1", area: "MV Room", system: "MV Switchgear", level: "L3", start: fmtISO(addDays(anchor, 1)), duration: 1, committed: true, status: "planned", constraints: [{ id: "c1", text: "Energisation authorisation", done: false }, { id: "c2", text: "BMS/EPMS ready", done: false }, { id: "c3", text: "Client witness confirmed", done: false }] },
      { id: "a2", desc: "Chilled water ring flushing, loop A", companyId: "co2", area: "Cooling Plant", system: "Chilled Water", level: "L2", start: fmtISO(addDays(anchor, 5)), duration: 4, committed: false, status: "planned", constraints: [{ id: "c4", text: "Approved flushing work pack", done: false }, { id: "c5", text: "RAMS approved", done: false }] },
      { id: "a3", desc: "UPS module SAT", companyId: "co3", area: "Electrical Room", system: "UPS", level: "L3", start: fmtISO(addDays(anchor, 9)), duration: 2, committed: true, status: "planned", constraints: [{ id: "c6", text: "Green tag complete", done: false }] },
      { id: "a4", desc: "Generator load bank performance test", companyId: "co4", area: "Generator Yard", system: "Generators", level: "L4", start: fmtISO(addDays(anchor, 20)), duration: 2, committed: false, status: "planned", constraints: [{ id: "c7", text: "Load banks on site", done: false }, { id: "c8", text: "L3 functional complete", done: false }] },
      { id: "a5", desc: "Installation inspection, busbar runs", companyId: "co1", area: "Electrical Room", system: "LV Distribution", level: "L2", start: fmtISO(addDays(anchor, 2)), duration: 3, committed: true, status: "in_progress", actualStart: fmtISO(addDays(anchor, 3)), actualFinish: "", constraints: [] },
      { id: "a6", desc: "First MV energisation gate", companyId: "co1", area: "MV Room", system: "MV Switchgear", level: "L3", start: fmtISO(addDays(anchor, 7)), duration: 1, committed: true, status: "planned", isMilestone: true, actualStart: "", actualFinish: "", constraints: [] },
    ],
  };
}

export default function App({ session }) {
  const [S, setS] = useState(null);
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));
  const [makeReady, setMakeReady] = useState(false);
  const [editing, setEditing] = useState(null);
  const [admin, setAdmin] = useState(false);
  const dragId = useRef(null);

  const prefs = () => { try { return JSON.parse(localStorage.getItem("fin04_prefs") || "{}"); } catch { return {}; } };
  const refresh = async () => {
    try {
      const data = await loadAll(session);
      const p = prefs();
      setS({ ...data, currentUserId: session.user.id, theme: p.theme || "light", view: p.view || "swimlane", grain: p.grain || "day", laneBy: p.laneBy || "company" });
    } catch (e) { console.error("Load failed:", e); }
  };
  useEffect(() => { refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const ch = subscribeAll(refresh); return () => { try { ch.unsubscribe(); } catch (e) {} }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (S?.brand) applyBrandToTab(S.brand); }, [S?.brand]);

  const PREF_KEYS = ["theme", "view", "grain", "laneBy"];
  const cu = S && (S.users.find((u) => u.id === S.currentUserId) || { id: session.user.id, name: session.user.email, role: "member", companyId: null });
  const update = (producer) => setS((prev) => {
    const n = producer(prev);
    if (PREF_KEYS.some((k) => n[k] !== prev[k])) { try { localStorage.setItem("fin04_prefs", JSON.stringify({ theme: n.theme, view: n.view, grain: n.grain, laneBy: n.laneBy })); } catch (e) {} }
    syncCollections(prev, n, session);
    return n;
  });

  const DAYS = S ? S.settings.weeks * 7 : 28;
  const WEEKS = S ? S.settings.weeks : 4;
  const todayOffset = useMemo(() => Math.round((todayMid() - anchor) / DAYMS), [anchor]);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(anchor, i)), [anchor, DAYS]);
  const coName = (id) => (S.companies.find((c) => c.id === id) || {}).name || "Unassigned";

  const visible = useMemo(() => !S ? [] : S.activities.map((a) => {
    const ps = parseD(a.start);
    const startOff = Math.round((ps - anchor) / DAYMS);
    const endOff = startOff + a.duration - 1;
    const pf = addDays(ps, a.duration - 1);
    const as = a.actualStart ? parseD(a.actualStart) : null;
    const af = a.actualFinish ? parseD(a.actualFinish) : null;
    let delayDays = 0;
    if (a.status === "complete" && af) delayDays = Math.round((af - pf) / DAYMS);
    else if (as) delayDays = Math.round((as - ps) / DAYMS);
    else if (a.status !== "complete" && todayMid() > pf.getTime()) delayDays = Math.round((todayMid() - pf.getTime()) / DAYMS);
    return { ...a, startOff, endOff, inWin: endOff >= 0 && startOff < DAYS, open: openCount(a), delayDays, delayed: delayDays > 0 };
  }), [S, anchor, DAYS]);

  if (!S) return <div className="lk" style={cssVars("light")}><style>{css}</style><div className="lk-empty">Loading board…</div></div>;
  const LV = S.levels || DEFAULT_LEVELS;

  const isAdmin = cu.role === "admin";
  const canEdit = (a) => isAdmin || a.companyId === cu.companyId;
  const mk = S.settings.makeReadyDays;
  const inWindow = visible.filter((a) => a.inWin);
  const ready = inWindow.filter((a) => a.open === 0 && a.status !== "complete");
  const needMR = inWindow.filter((a) => a.open > 0 && a.status !== "complete");
  const urgentMR = needMR.filter((a) => a.startOff < mk);
  const committedWk = visible.filter((a) => a.committed && a.startOff >= 0 && a.startOff < 7);
  const delayedList = inWindow.filter((a) => a.delayed);

  const laneOf = (a) => S.laneBy === "level" ? a.level : S.laneBy === "area" ? (a.area || "Unassigned") : S.laneBy === "subarea" ? laneOfArea(a) : coName(a.companyId);
  const lanesList = (() => {
    if (S.laneBy === "level") return Object.keys(LV);
    if (S.laneBy === "area") { const s = [...new Set(S.activities.map((a) => a.area).filter(Boolean))].sort(); return s.length ? s : ["Unassigned"]; }
    if (S.laneBy === "subarea") { const s = [...new Set(S.activities.filter((a) => a.area).map(laneOfArea))].sort(); return s.length ? s : ["Unassigned"]; }
    return [...new Set(S.activities.map((a) => coName(a.companyId)))].sort();
  })();

  const saveActivity = (a, isNew) => {
    update((p) => ({ ...p, activities: isNew ? [...p.activities, a] : p.activities.map((x) => x.id === a.id ? a : x) }),
      { action: isNew ? "Create activity" : "Edit activity", detail: `${a.desc} (${coName(a.companyId)})` });
    setEditing(null);
  };
  const removeActivity = (a) => { update((p) => ({ ...p, activities: p.activities.filter((x) => x.id !== a.id) }), { action: "Delete activity", detail: a.desc }); setEditing(null); };
  const moveActivity = (id, dayIdx, lane) => {
    const a = S.activities.find((x) => x.id === id); if (!a || !canEdit(a)) { dragId.current = null; return; }
    update((p) => ({ ...p, activities: p.activities.map((x) => {
      if (x.id !== id) return x;
      const u = { ...x, start: fmtISO(addDays(anchor, dayIdx)) };
      if (lane != null) { if (p.laneBy === "level") u.level = lane; else if (p.laneBy === "area") u.area = lane; else if (p.laneBy === "subarea") { const [ar, sub] = lane.split(SUBSEP); u.area = ar; u.subArea = sub || ""; } else { const c = p.companies.find((c) => c.name === lane); if (isAdmin && c) u.companyId = c.id; } }
      return u;
    }) }), { action: "Move activity", detail: `${a.desc} to ${fmtISO(addDays(anchor, dayIdx))}` });
    dragId.current = null;
  };
  const newActivity = (lane, dayIdx) => {
    const base = { id: uid("a"), desc: "", companyId: isAdmin ? (S.companies[0] || {}).id : cu.companyId, area: "", subArea: "", tier3: "", system: "", level: "L2",
      start: fmtISO(addDays(anchor, Math.max(0, dayIdx ?? Math.max(0, todayOffset)))), duration: 1, committed: false, status: "planned", isMilestone: false, witnessInvite: false, notes: "", actualStart: "", actualFinish: "", constraints: [] };
    if (lane) { if (S.laneBy === "level") base.level = lane; else if (S.laneBy === "area") base.area = lane; else if (S.laneBy === "subarea") { const [ar, sub] = lane.split(SUBSEP); base.area = ar; base.subArea = sub || ""; } else if (isAdmin) { const c = S.companies.find((c) => c.name === lane); if (c) base.companyId = c.id; } }
    setEditing(base);
  };
  const exportActivities = () => {
    const headers = ["Activity ID", "Description", "Company", "Area", "Sub-area", "Tier 3 Area", "System", "Level", "Milestone", "Witness invite", "Planned start", "Planned finish", "Duration (d)", "Actual start", "Actual finish", "Delay (d)", "Status", "Committed", "Open constraints", "Constraints", "Notes"];
    const rows = visible.map((a) => [a.id, a.desc, coName(a.companyId), a.area, a.subArea || "", a.tier3 || "", a.system, a.level, a.isMilestone ? "Yes" : "No", a.witnessInvite ? "Yes" : "No", a.start, fmtISO(addDays(parseD(a.start), a.duration - 1)), a.duration, a.actualStart || "", a.actualFinish || "", a.delayDays || 0, a.status, a.committed ? "Yes" : "No", a.open, a.constraints.map((c) => (c.done ? "[x] " : "[ ] ") + c.text).join("; "), a.notes || ""]);
    downloadFile(`FIN04-lookahead-${fmtISO(new Date())}.csv`, toCSV(headers, rows));
    update((p) => p, { action: "Export activities", detail: `${rows.length} rows` });
  };

  const grain = S.grain || "day";
  const cols = grain === "day" ? DAYS : WEEKS;
  const colMin = grain === "day" ? 32 : 90;
  const unitDate = (i) => addDays(anchor, grain === "day" ? i : i * 7);
  const unitWeekend = (i) => { if (grain !== "day") return false; const d = unitDate(i); return d.getDay() === 0 || d.getDay() === 6; };
  const todayUnit = grain === "day" ? todayOffset : Math.floor(todayOffset / 7);
  const dropDay = (i) => grain === "day" ? i : i * 7;
  const sU = (a) => grain === "day" ? a.startOff : Math.floor(a.startOff / 7);
  const eU = (a) => grain === "day" ? a.endOff : Math.floor(a.endOff / 7);
  const gridCols = `220px repeat(${cols}, minmax(${colMin}px, 1fr))`;
  const minW = 220 + cols * colMin;
  const fmtWC = (d) => `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })}`;

  const Ticket = ({ a, row }) => {
    const s = Math.max(0, sU(a)), e = Math.min(cols - 1, eU(a));
    const lv = lvOf(LV, a.level);
    const editable = canEdit(a);
    if (a.isMilestone) {
      return <div className="lk-ms" style={{ gridColumn: `${s + 1} / ${s + 2}`, gridRow: row + 1 }}
        draggable={editable} onDragStart={() => editable && (dragId.current = a.id)} onClick={() => setEditing({ ...a })}>
        <span className="dia" style={{ background: a.delayed ? "#C0392B" : lv.color }} title={a.desc} />
        <span className="mslbl">{a.desc || "Milestone"}{a.delayed ? ` +${a.delayDays}d` : ""}</span>
      </div>;
    }
    const constrained = a.open > 0 && a.status !== "complete";
    const spot = makeReady && constrained && a.startOff < mk;
    const dim = makeReady && !spot;
    return (
      <div className={"lk-ticket" + (constrained ? " constrained" : "") + (a.status === "complete" ? " complete" : "") + (dim ? " dim" : "") + (spot ? " spot" : "") + (!editable ? " ro" : "")}
        style={{ gridColumn: `${s + 1} / ${e + 2}`, gridRow: row + 1, borderLeftColor: lv.color, background: a.status === "complete" ? "var(--card)" : (S.theme === "dark" ? "var(--card)" : tintOf(lv.color)) }}
        draggable={editable} onDragStart={() => editable && (dragId.current = a.id)} onClick={() => setEditing({ ...a })}>
        <div className="desc">{a.desc || "Untitled activity"}</div>
        <div className="meta">
          <span className="dot" style={{ background: a.status === "complete" ? "#9AA6B2" : constrained ? "#E0A106" : "#0E9384" }} />
          {a.committed && <span className="lk-chip commit">will</span>}
          {a.witnessInvite && <span className="lk-chip wit" title="Witness invite">WIT</span>}
          {constrained && <span className="lk-chip cstr"><Icon n="alert" s={9} />{a.open}</span>}
          {a.delayed && <span className="lk-chip late">+{a.delayDays}d</span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{S.laneBy === "company" ? (a.area + (a.subArea ? SUBSEP + a.subArea : "") + (a.tier3 ? SUBSEP + a.tier3 : "")) : coName(a.companyId)}</span>
        </div>
      </div>);
  };

  const ActualBar = ({ a, row }) => {
    if (a.isMilestone || !a.actualStart) return null;
    const as = parseD(a.actualStart);
    const ae = a.actualFinish ? parseD(a.actualFinish) : (a.status === "complete" ? as : new Date(todayMid()));
    const so = Math.round((as - anchor) / DAYMS), eo = Math.round((ae - anchor) / DAYMS);
    if (eo < 0 || so >= DAYS) return null;
    const su = grain === "day" ? so : Math.floor(so / 7), eu = grain === "day" ? eo : Math.floor(eo / 7);
    const s = Math.max(0, su), e = Math.min(cols - 1, eu);
    return <div title="Actual progress" style={{ gridColumn: `${s + 1} / ${e + 2}`, gridRow: row + 1, alignSelf: "end", height: 5, margin: "0 2px 3px", borderRadius: 3, background: a.delayed ? "#C0392B" : "#0E9384", zIndex: 2, pointerEvents: "none" }} />;
  };

  const Underlay = ({ lane }) => (
    <div className="lk-under" style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}>
      {Array.from({ length: cols }, (_, i) => (
        <div key={i} className={"lk-cell" + (unitWeekend(i) ? " we" : "") + (i === todayUnit ? " tod" : "")}
          onClick={() => newActivity(lane, dropDay(i))} onDragOver={(e) => e.preventDefault()} onDrop={() => moveActivity(dragId.current, dropDay(i), lane)} />))}
    </div>);

  return (
    <div className="lk" style={cssVars(S.theme)}><style>{css}</style>
      <div className="lk-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {S.brand?.logoUrl && <img src={S.brand.logoUrl} alt="" style={{ height: 30, maxWidth: 130, objectFit: "contain" }} />}
          <div><div className="lk-title">{(S.brand?.projectName || "FIN04")} {(S.brand?.appName || "DLP")}</div><div className="lk-sub">{S.brand?.tagline || "Collaborative Digital Planning"}</div></div>
        </div>
        <div className="lk-nav">
          <button className="lk-btn icon" onClick={() => setAnchor(addDays(anchor, -7))}><Icon n="cl" /></button>
          <button className="lk-btn" onClick={() => setAnchor(mondayOf(new Date()))}><Icon n="cal" s={14} />Today</button>
          <button className="lk-btn icon" onClick={() => setAnchor(addDays(anchor, 7))}><Icon n="cr" /></button>
        </div>
        <div className="lk-seg">
          {[["swimlane", "Swimlane"], ["gantt", "Gantt"]].map(([k, l]) => (
            <button key={k} className={S.view === k ? "sel" : ""} onClick={() => update((p) => ({ ...p, view: k }))}>{l}</button>))}
        </div>
        <div className="lk-seg">
          {[["day", "Day"], ["week", "Week"]].map(([k, l]) => (
            <button key={k} className={grain === k ? "sel" : ""} onClick={() => update((p) => ({ ...p, grain: k }))}>{l}</button>))}
        </div>
        {S.view === "swimlane" && <div className="lk-seg">
          {[["company", "Company"], ["area", "Area"], ["subarea", "Sub-area"], ["level", "Level"]].map(([k, l]) => (
            <button key={k} className={S.laneBy === k ? "sel" : ""} onClick={() => update((p) => ({ ...p, laneBy: k }))}>{l}</button>))}
        </div>}
        <button className={"lk-btn" + (makeReady ? " on" : "")} onClick={() => setMakeReady((v) => !v)}><Icon n="cross" s={14} />Make-ready</button>
        <button className="lk-btn icon" onClick={() => update((p) => ({ ...p, theme: p.theme === "dark" ? "light" : "dark" }))}><Icon n={S.theme === "dark" ? "sun" : "moon"} s={15} /></button>
        <button className="lk-btn" onClick={exportActivities}><Icon n="download" s={14} />Export</button>
        <div className="lk-spacer" />
        <div className="lk-who">
          <span style={{ fontWeight: 600 }}>{cu.name}</span>
          <span className={"lk-pill " + cu.role}>{cu.role === "admin" ? "Admin" : coName(cu.companyId)}</span>
          <button className="lk-btn" onClick={() => signOut()}>Sign out</button>
        </div>
        {isAdmin && <button className="lk-btn" onClick={() => setAdmin(true)}><Icon n="shield" s={14} />Admin</button>}
        <button className="lk-btn primary" onClick={() => newActivity()}><Icon n="plus" s={15} />Activity</button>
      </div>

      <div className="lk-metrics">
        <div className="lk-metric"><span className="v mono">{inWindow.length}</span><span className="l">In lookahead</span></div>
        <div className="lk-metric"><span className="v mono" style={{ color: "#0E9384" }}>{ready.length}</span><span className="l">Ready to run</span></div>
        <div className="lk-metric"><span className="v mono" style={{ color: "#D97706" }}>{needMR.length}</span><span className="l">Need make-ready</span><span className="sub">{urgentMR.length} within {mk}d</span></div>
        <div className="lk-metric"><span className="v mono" style={{ color: "var(--accent)" }}>{committedWk.length}</span><span className="l">Committed this week</span></div>
        <div className="lk-metric"><span className="v mono" style={{ color: "#C0392B" }}>{delayedList.length}</span><span className="l">Delayed</span></div>
      </div>

      <div className="lk-board">
        <div className="lk-head" style={{ gridTemplateColumns: gridCols, minWidth: minW }}>
          {grain === "day" ? <>
            <div style={{ borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }} />
            {Array.from({ length: WEEKS }, (_, w) => (
              <div key={"w" + w} className="lk-wk" style={{ gridColumn: `${2 + w * 7} / span 7` }}>WK {isoWeek(addDays(anchor, w * 7))}<span className="wc">w/c {fmtWC(addDays(anchor, w * 7))}</span></div>))}
            <div style={{ gridColumn: "1 / 2", gridRow: 2, borderRight: "1px solid var(--line)" }} />
            {days.map((d, i) => { const we = d.getDay() === 0 || d.getDay() === 6, tod = i === todayOffset;
              return <div key={i} className={"lk-day" + (we ? " we" : "") + (tod ? " tod" : "")} style={{ gridRow: 2 }}>
                <div className="wd">{d.toLocaleString("en-GB", { weekday: "short" }).slice(0, 2)}</div><div className="dn mono">{d.getDate()}</div></div>; })}
          </> : <>
            <div style={{ borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }} />
            {Array.from({ length: cols }, (_, i) => (
              <div key={i} className={"lk-day" + (i === todayUnit ? " tod" : "")} style={{ padding: "8px 0 9px", borderBottom: "1px solid var(--line)" }}>
                <div className="wd">WK {isoWeek(unitDate(i))}</div><div className="dn mono">w/c {fmtWC(unitDate(i))}</div></div>))}
          </>}
        </div>

        {inWindow.length === 0 && <div className="lk-empty">Nothing planned in this window. Click a cell or press Activity to add one.</div>}

        {S.view === "swimlane" && lanesList.map((lane) => {
          const la = visible.filter((a) => a.inWin && laneOf(a) === lane).sort((a, b) => a.startOff - b.startOff);
          if (S.laneBy !== "level" && la.length === 0) return null;
          const rows = []; la.forEach((a) => { const su = sU(a), eu = eU(a); let r = rows.findIndex((end) => end < su); if (r < 0) { r = rows.length; rows.push(eu); } else rows[r] = eu; a._row = r; });
          const sw = S.laneBy === "level" ? lvOf(LV, lane).color : "var(--muted)";
          return (
            <div key={lane} className="lk-lane" style={{ gridTemplateColumns: gridCols, minWidth: minW }}>
              <div className="lk-llbl"><span className="sw" style={{ background: sw }} />
                <div>{S.laneBy === "level" ? `${lane} · ${lvOf(LV, lane).name}` : lane}<div className="cnt mono">{la.length} act</div></div></div>
              <div className="lk-track" style={{ gridColumn: `2 / span ${DAYS}` }}>
                <Underlay lane={lane} />
                <div className="lk-tk" style={{ gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: `repeat(${Math.max(1, rows.length)},minmax(48px,auto))` }}>
                  {la.map((a) => <Ticket key={a.id} a={a} row={a._row} />)}
                  {la.map((a) => <ActualBar key={"ab" + a.id} a={a} row={a._row} />)}
                </div>
              </div>
            </div>);
        })}

        {S.view === "gantt" && visible.filter((a) => a.inWin).sort((a, b) => a.startOff - b.startOff || a.level.localeCompare(b.level)).map((a) => {
          const lv = lvOf(LV, a.level);
          return (
            <div key={a.id} className="lk-grow" style={{ gridTemplateColumns: gridCols, minWidth: minW }}>
              <div className="gl"><span className="sw" style={{ background: lv.color }} />
                <div style={{ minWidth: 0 }}><div className="nm">{a.desc || "Untitled"}</div><div className="cm">{coName(a.companyId)} · {a.level}</div></div></div>
              <div className="lk-track" style={{ gridColumn: `2 / span ${DAYS}` }}>
                <Underlay lane={null} />
                <div className="lk-tk" style={{ gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: "minmax(48px,auto)" }}>
                  <Ticket a={a} row={0} />
                  <ActualBar a={a} row={0} />
                </div>
              </div>
            </div>);
        })}
      </div>

      <div className="lk-legend">
        {Object.entries(LV).map(([k, v]) => <span key={k} className="it"><span className="sw" style={{ background: v.color }} />{k} {v.name}</span>)}
        <span className="it"><span className="dot" style={{ width: 9, height: 9, borderRadius: "50%", background: "#0E9384" }} />ready</span>
        <span className="it"><span className="dot" style={{ width: 9, height: 9, borderRadius: "50%", background: "#E0A106" }} />constrained</span>
        <span className="it"><span className="lk-chip commit">will</span>committed promise</span>
        <span className="it"><span style={{ height: 5, width: 16, borderRadius: 3, background: "#0E9384" }} />actual progress</span>
        <span className="it"><span className="lk-chip late">+d</span>delayed</span>
      </div>

      {editing && <Drawer act={editing} S={S} canEdit={canEdit(editing)} isAdmin={isAdmin} onSave={saveActivity} onClose={() => setEditing(null)} onDelete={removeActivity} />}
      {admin && <AdminPanel S={S} update={update} onClose={() => setAdmin(false)} exportActivities={exportActivities} />}
    </div>);
}

function cssVars(theme) { const t = THEMES[theme] || THEMES.light; return { "--ink": t.ink, "--paper": t.paper, "--card": t.card, "--line": t.line, "--muted": t.muted, "--accent": t.accent, "--weekend": t.weekend, "--todcell": t.todcell, "--todhead": t.todhead, "--hover": t.hover, "--chipbg": t.chipbg }; }

function Drawer({ act, S, canEdit, isAdmin, onSave, onClose, onDelete }) {
  const [a, setA] = useState(act);
  const [cText, setCText] = useState("");
  const set = (k, v) => canEdit && setA((p) => ({ ...p, [k]: v }));
  const isNew = !act.desc && act.constraints.length === 0;
  const addC = () => { if (!cText.trim()) return; set("constraints", [...a.constraints, { id: uid("c"), text: cText.trim(), done: false }]); setCText(""); };
  const dis = !canEdit;
  return (
    <div className="lk-bg" onClick={onClose}><style>{css}</style>
      <div className="lk-drawer" style={cssVars(S.theme)} onClick={(e) => e.stopPropagation()}>
        <div className="lk-dh"><h3>{isNew ? "New activity" : canEdit ? "Edit activity" : "Activity (view only)"}</h3><button className="lk-btn icon" onClick={onClose}><Icon n="x" /></button></div>
        <div className="lk-db">
          {!canEdit && <div className="lk-pv" style={{ borderRadius: 8, border: "1px solid var(--line)" }}><Icon n="alert" s={13} />This activity belongs to another company. You can view it but not change it.</div>}
          <div className="lk-f"><label>What is the activity</label><input className="lk-in" value={a.desc} disabled={dis} placeholder="e.g. UPS module SAT" autoFocus onChange={(e) => set("desc", e.target.value)} /></div>
          <div className="lk-row">
            <div className="lk-f"><label>Company (performing)</label>
              <select className="lk-select" value={a.companyId || ""} disabled={dis || !isAdmin} onChange={(e) => set("companyId", e.target.value)}>
                {S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>{!isAdmin && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>Members add only for their own company.</span>}</div>
            <div className="lk-f"><label>Area</label>
              <select className="lk-select" value={a.area} disabled={dis} onChange={(e) => { set("area", e.target.value); set("subArea", ""); set("tier3", ""); }}>
                <option value="">--</option>{S.areas.map((x) => <option key={x}>{x}</option>)}</select></div>
          </div>
          <div className="lk-f"><label>Sub-area (optional)</label>
            <select className="lk-select" value={a.subArea || ""} disabled={dis || !a.area} onChange={(e) => { set("subArea", e.target.value); set("tier3", ""); }}>
              <option value="">--</option>{(S.subAreas || []).filter((s) => s.area === a.area).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}</select>
            {a.area && (S.subAreas || []).filter((s) => s.area === a.area).length === 0 && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>No sub-areas defined for {a.area}. Add them in Admin, Areas.</span>}</div>
          <div className="lk-f"><label>Tier 3 Area (optional)</label>
            <select className="lk-select" value={a.tier3 || ""} disabled={dis || !a.subArea} onChange={(e) => set("tier3", e.target.value)}>
              <option value="">--</option>{(S.tier3s || []).filter((t) => t.area === a.area && t.subArea === a.subArea).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}</select>
            {a.subArea && (S.tier3s || []).filter((t) => t.area === a.area && t.subArea === a.subArea).length === 0 && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>No Tier 3 Areas defined for {a.subArea}. Add them in Admin, Areas.</span>}</div>
          <div className="lk-f"><label>System</label>
            <select className="lk-select" value={a.system} disabled={dis} onChange={(e) => set("system", e.target.value)}>
              <option value="">--</option>{S.systems.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="lk-f"><label>Commissioning level</label>
            <div className="lk-levels">{Object.entries(S.levels).map(([k, v]) => <div key={k} className={"lk-lvl" + (a.level === k ? " sel" : "")} onClick={() => set("level", k)}><span className="sw" style={{ background: v.color }} />{k}</div>)}</div></div>
          <div className="lk-row">
            <div className="lk-f"><label>Start</label><input className="lk-in mono" type="date" value={a.start} disabled={dis} onChange={(e) => set("start", e.target.value)} /></div>
            <div className="lk-f"><label>Days</label><input className="lk-in mono" type="number" min="1" value={a.duration} disabled={dis} onChange={(e) => set("duration", Math.max(1, +e.target.value || 1))} /></div>
          </div>
          <div className="lk-f"><label>Constraints to clear (make-ready)</label>
            {a.constraints.map((c) => <div key={c.id} className="lk-cstr"><input type="checkbox" checked={c.done} disabled={dis} onChange={() => set("constraints", a.constraints.map((x) => x.id === c.id ? { ...x, done: !x.done } : x))} /><span className={"t" + (c.done ? " done" : "")}>{c.text}</span>{!dis && <button onClick={() => set("constraints", a.constraints.filter((x) => x.id !== c.id))}><Icon n="trash" s={13} /></button>}</div>)}
            {a.constraints.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>No constraints. Reads as ready to run.</div>}
            {!dis && <div className="lk-add"><input className="lk-in" placeholder="Add a constraint…" value={cText} onChange={(e) => setCText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addC()} /><button className="lk-btn" onClick={addC}><Icon n="plus" s={15} /></button></div>}</div>
          <div className={"lk-tog" + (a.committed ? " on" : "")} onClick={() => set("committed", !a.committed)}><span>Committed for this week <span style={{ fontWeight: 400, color: "var(--muted)" }}>(a reliable promise)</span></span><span className="lk-sw2" /></div>
          <div className={"lk-tog" + (a.witnessInvite ? " on" : "")} onClick={() => set("witnessInvite", !a.witnessInvite)}><span>Witness invite <span style={{ fontWeight: 400, color: "var(--muted)" }}>(client or third-party witness required)</span></span><span className="lk-sw2" /></div>
          <div className={"lk-tog" + (a.isMilestone ? " on" : "")} onClick={() => set("isMilestone", !a.isMilestone)}><span>Milestone <span style={{ fontWeight: 400, color: "var(--muted)" }}>(a point in time, shown as a diamond)</span></span><span className="lk-sw2" /></div>
          <div className="lk-f"><label>Status</label><div className="lk-status">{[["planned", "Planned"], ["in_progress", "In progress"], ["complete", "Complete"]].map(([k, l]) => <button key={k} className={a.status === k ? "sel" : ""} disabled={dis} onClick={() => setA((p) => { const n = { ...p, status: k }; if (k === "in_progress" && !n.actualStart) n.actualStart = fmtISO(new Date()); if (k === "complete") { if (!n.actualStart) n.actualStart = fmtISO(new Date()); if (!n.actualFinish) n.actualFinish = fmtISO(new Date()); } return n; })}>{l}</button>)}</div></div>
          <div className="lk-row">
            <div className="lk-f"><label>Actual start</label><input className="lk-in mono" type="date" value={a.actualStart || ""} disabled={dis} onChange={(e) => set("actualStart", e.target.value)} /></div>
            <div className="lk-f"><label>Actual finish</label><input className="lk-in mono" type="date" value={a.actualFinish || ""} disabled={dis} onChange={(e) => set("actualFinish", e.target.value)} /></div>
          </div>
          {(() => { const ps = parseD(a.start), pf = addDays(ps, a.duration - 1); let d = null, lbl = ""; if (a.status === "complete" && a.actualFinish) { d = Math.round((parseD(a.actualFinish) - pf) / DAYMS); lbl = "Finish vs plan"; } else if (a.actualStart) { d = Math.round((parseD(a.actualStart) - ps) / DAYMS); lbl = "Start vs plan"; } if (d == null) return null; return <div style={{ fontSize: 12.5, fontWeight: 600, color: d > 0 ? "#C0392B" : "#0E9384" }}>{lbl}: {d > 0 ? "+" + d : d} day{Math.abs(d) === 1 ? "" : "s"} {d > 0 ? "late" : d < 0 ? "early" : "on plan"}</div>; })()}
          <div className="lk-f"><label>Notes / comment</label>
            <textarea className="lk-in" value={a.notes || ""} disabled={dis} placeholder="Anything the team should know: access, sequencing, contacts, risks…" rows={3} style={{ resize: "vertical", minHeight: 60, fontFamily: "inherit" }} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
        {canEdit && <div className="lk-df">
          {!isNew && <button className="lk-btn" onClick={() => onDelete(a)} style={{ color: "#C0392B" }}><Icon n="trash" s={14} />Delete</button>}
          <div className="lk-spacer" /><button className="lk-btn" onClick={onClose}>Cancel</button>
          <button className="lk-btn primary" onClick={() => onSave(a, isNew)} disabled={!a.desc.trim()}><Icon n="check" s={15} />Save</button>
        </div>}
      </div>
    </div>);
}

function AdminPanel({ S, update, onClose, exportActivities }) {
  const [tab, setTab] = useState("companies");
  const [nv, setNv] = useState("");
  const [auditUser, setAuditUser] = useState("all");
  const [brandMsg, setBrandMsg] = useState("");
  const [impMode, setImpMode] = useState("append");
  const [impMsg, setImpMsg] = useState("");
  const [userMsg, setUserMsg] = useState("");
  const [nu, setNu] = useState({ email: "", name: "", role: "member", companyId: S.companies[0]?.id || "" });
  const [subInput, setSubInput] = useState({});
  const [t3Input, setT3Input] = useState({});
  const addList = (key, label) => { if (!nv.trim()) return; update((p) => ({ ...p, [key]: key === "companies" ? [...p.companies, { id: uid("co"), name: nv.trim() }] : [...p[key], nv.trim()] }), { action: "Add " + label, detail: nv.trim() }); setNv(""); };
  const delList = (key, val, label) => update((p) => {
    const n = { ...p };
    if (key === "companies") n.companies = p.companies.filter((c) => c.id !== val);
    else n[key] = p[key].filter((x) => x !== val);
    if (key === "areas") { n.subAreas = (p.subAreas || []).filter((s) => s.area !== val); n.tier3s = (p.tier3s || []).filter((t) => t.area !== val); }
    return n;
  }, { action: "Remove " + label, detail: typeof val === "string" ? val : (S.companies.find((c) => c.id === val) || {}).name });
  const addSub = (area) => { const name = (subInput[area] || "").trim(); if (!name) return; update((p) => ({ ...p, subAreas: [...(p.subAreas || []), { area, name }].filter((s, i, arr) => arr.findIndex((x) => x.area === s.area && x.name === s.name) === i) }), { action: "Add sub-area", detail: `${area} / ${name}` }); setSubInput({ ...subInput, [area]: "" }); };
  const delSub = (area, name) => update((p) => ({ ...p, subAreas: (p.subAreas || []).filter((s) => !(s.area === area && s.name === name)), tier3s: (p.tier3s || []).filter((t) => !(t.area === area && t.subArea === name)) }), { action: "Remove sub-area", detail: `${area} / ${name}` });
  const addT3 = (area, subArea) => { const key = area + "\u0001" + subArea; const name = (t3Input[key] || "").trim(); if (!name) return; update((p) => ({ ...p, tier3s: [...(p.tier3s || []), { area, subArea, name }].filter((t, i, arr) => arr.findIndex((x) => x.area === t.area && x.subArea === t.subArea && x.name === t.name) === i) }), { action: "Add Tier 3 Area", detail: `${area} / ${subArea} / ${name}` }); setT3Input({ ...t3Input, [key]: "" }); };
  const delT3 = (area, subArea, name) => update((p) => ({ ...p, tier3s: (p.tier3s || []).filter((t) => !(t.area === area && t.subArea === subArea && t.name === name)) }), { action: "Remove Tier 3 Area", detail: `${area} / ${subArea} / ${name}` });
  const [newCred, setNewCred] = useState(null);
  const addUser = async () => {
    if (!nu.email.trim()) { setUserMsg("Email required."); return; }
    setUserMsg("Creating account…"); setNewCred(null);
    try { const res = await userOp({ op: "invite", email: nu.email.trim(), name: nu.name.trim() || nu.email.trim(), role: nu.role, company_id: nu.role === "admin" ? null : nu.companyId });
      setNewCred({ who: nu.email.trim(), pw: res.tempPassword, title: "Account created" }); setUserMsg(""); setNu({ email: "", name: "", role: "member", companyId: S.companies[0]?.id || "" }); }
    catch (e) { setUserMsg("Failed: " + (e.message || e)); }
  };
  const resetPw = async (id, who) => { setUserMsg("Resetting password…"); setNewCred(null); try { const res = await userOp({ op: "resetpw", id }); setNewCred({ who, pw: res.tempPassword, title: "New password set" }); setUserMsg(""); } catch (e) { setUserMsg("Failed: " + (e.message || e)); } };
  const delUser = async (id, name) => { setUserMsg("Removing…"); try { await userOp({ op: "delete", id }); setUserMsg("Removed " + name); } catch (e) { setUserMsg("Failed: " + (e.message || e)); } };
  const exportProject = () => downloadFile(`FIN04-project-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ companies: S.companies, areas: S.areas, subAreas: S.subAreas || [], tier3s: S.tier3s || [], systems: S.systems, levels: S.levels, settings: S.settings, activities: S.activities }, null, 2));
  const parseCSV = (text) => { const rows = []; let row = [], cur = "", q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else { if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else if (c === "\r") {} else cur += c; } } if (cur !== "" || row.length) { row.push(cur); rows.push(row); } return rows; };
  const normDate = (s) => { if (!s) return ""; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = new Date(s); return isNaN(d) ? "" : fmtISO(d); };
  const importJSON = (obj) => {
    update((p) => { let n = { ...p };
      if (impMode === "override") {
        if (obj.companies) n.companies = obj.companies;
        if (obj.areas) n.areas = obj.areas;
        if (obj.subAreas) n.subAreas = obj.subAreas;
        if (obj.tier3s) n.tier3s = obj.tier3s;
        if (obj.systems) n.systems = obj.systems;
        if (obj.levels) n.levels = obj.levels;
        if (obj.settings) n.settings = { ...n.settings, ...obj.settings };
        if (obj.activities) n.activities = obj.activities.map((a) => ({ ...a, id: a.id || uid("a") }));
      } else {
        const map = {};
        if (obj.companies) { const companies = [...n.companies]; obj.companies.forEach((c) => { const ex = companies.find((x) => x.name.toLowerCase() === (c.name || "").toLowerCase()); if (ex) map[c.id] = ex.id; else { const nid = uid("co"); companies.push({ id: nid, name: c.name }); map[c.id] = nid; } }); n.companies = companies; }
        if (obj.areas) n.areas = [...new Set([...n.areas, ...obj.areas])];
        if (obj.subAreas) { const cur = [...(n.subAreas || [])]; obj.subAreas.forEach((s) => { if (!cur.some((x) => x.area === s.area && x.name === s.name)) cur.push({ area: s.area, name: s.name }); }); n.subAreas = cur; }
        if (obj.tier3s) { const cur = [...(n.tier3s || [])]; obj.tier3s.forEach((t) => { if (!cur.some((x) => x.area === t.area && x.subArea === t.subArea && x.name === t.name)) cur.push({ area: t.area, subArea: t.subArea, name: t.name }); }); n.tier3s = cur; }
        if (obj.systems) n.systems = [...new Set([...n.systems, ...obj.systems])];
        if (obj.activities) n.activities = [...n.activities, ...obj.activities.map((a) => ({ ...a, id: uid("a"), companyId: map[a.companyId] || a.companyId }))];
      }
      return n;
    }, { action: `Import JSON (${impMode})`, detail: `${(obj.activities || []).length} activities` });
    setImpMsg(`Imported project JSON (${impMode}).`);
  };
  const importCSV = (text) => {
    const rows = parseCSV(text).filter((r) => r.length && r.some((c) => c.trim() !== ""));
    if (rows.length < 2) { setImpMsg("CSV has no data rows."); return; }
    const hdr = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (names) => { for (const nm of names) { const i = hdr.findIndex((h) => h === nm || h.includes(nm)); if (i >= 0) return i; } return -1; };
    const ci = { desc: idx(["description", "activity description", "activity", "desc"]), company: idx(["company", "contractor", "vendor"]), area: idx(["area", "location"]), subarea: idx(["sub-area", "sub area", "subarea"]), tier3: idx(["tier 3 area", "tier3 area", "tier 3", "tier3"]), system: idx(["system"]), level: idx(["level"]), ms: idx(["milestone"]), wit: idx(["witness invite", "witness"]), notes: idx(["notes", "comment", "comments"]), pstart: idx(["planned start", "start"]), pfin: idx(["planned finish", "finish", "end"]), dur: idx(["duration", "days"]), astart: idx(["actual start"]), afin: idx(["actual finish"]), status: idx(["status"]), commit: idx(["committed", "commit"]), cons: idx(["constraints", "constraint"]) };
    update((p) => {
      let companies = impMode === "override" ? [] : [...p.companies];
      let areas = impMode === "override" ? [] : [...p.areas];
      let systems = impMode === "override" ? [] : [...p.systems];
      let subAreas = impMode === "override" ? [] : [...(p.subAreas || [])];
      let tier3s = impMode === "override" ? [] : [...(p.tier3s || [])];
      const findCo = (name) => { if (!name) return (companies[0] || {}).id || null; let c = companies.find((x) => x.name.toLowerCase() === name.toLowerCase()); if (!c) { c = { id: uid("co"), name }; companies.push(c); } return c.id; };
      const ensure = (arr, val) => { if (val && !arr.some((x) => x.toLowerCase() === val.toLowerCase())) arr.push(val); };
      const ensureSub = (area, name) => { if (area && name && !subAreas.some((s) => s.area === area && s.name.toLowerCase() === name.toLowerCase())) subAreas.push({ area, name }); };
      const ensureT3 = (area, subArea, name) => { if (area && subArea && name && !tier3s.some((t) => t.area === area && t.subArea === subArea && t.name.toLowerCase() === name.toLowerCase())) tier3s.push({ area, subArea, name }); };
      const newActs = [];
      for (let r = 1; r < rows.length; r++) { const row = rows[r]; const g = (i) => (i >= 0 && i < row.length ? row[i].trim() : "");
        const desc = g(ci.desc); if (!desc) continue;
        const companyId = findCo(g(ci.company)); const area = g(ci.area); ensure(areas, area); const subArea = g(ci.subarea); ensureSub(area, subArea); const tier3 = g(ci.tier3); ensureT3(area, subArea, tier3); const system = g(ci.system); ensure(systems, system);
        let level = g(ci.level).toUpperCase(); if (!S.levels[level]) level = Object.keys(S.levels)[0] || "L2";
        const start = normDate(g(ci.pstart)); const pfin = normDate(g(ci.pfin)); const durRaw = g(ci.dur);
        let duration = 1; if (durRaw && +durRaw > 0) duration = +durRaw; else if (start && pfin) duration = Math.max(1, Math.round((parseD(pfin) - parseD(start)) / DAYMS) + 1);
        const consText = g(ci.cons); const constraints = consText ? consText.split(";").map((x) => x.trim()).filter(Boolean).map((x) => ({ id: uid("c"), text: x.replace(/^\[[ xX]\]\s*/, ""), done: /^\[[xX]\]/.test(x) })) : [];
        const yes = (v) => /^(y|yes|true|1)$/i.test(v);
        newActs.push({ id: uid("a"), desc, companyId, area, subArea, tier3, system, level, isMilestone: yes(g(ci.ms)), witnessInvite: yes(g(ci.wit)), notes: g(ci.notes), start: start || fmtISO(new Date()), duration, committed: yes(g(ci.commit)), status: (g(ci.status) || "planned").toLowerCase().replace(/\s+/g, "_"), actualStart: normDate(g(ci.astart)), actualFinish: normDate(g(ci.afin)), constraints });
      }
      const activities = impMode === "override" ? newActs : [...p.activities, ...newActs];
      return { ...p, companies, areas, subAreas, tier3s, systems, activities };
    }, { action: `Import CSV (${impMode})`, detail: `${rows.length - 1} rows` });
    setImpMsg(`Imported ${rows.length - 1} CSV rows (${impMode}).`);
  };
  const handleImportFile = (e) => { const file = e.target.files && e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const txt = String(reader.result); if (file.name.toLowerCase().endsWith(".json")) importJSON(JSON.parse(txt)); else importCSV(txt); } catch (err) { setImpMsg("Import failed: " + (err && err.message ? err.message : "could not read file")); } }; reader.readAsText(file); e.target.value = ""; };
  const tabs = [["companies", "Companies"], ["areas", "Areas"], ["systems", "Systems"], ["levels", "Levels"], ["branding", "Branding"], ["users", "Users"], ["settings", "Settings"], ["data", "Import / Export"], ["audit", "Audit"]];
  return (
    <div className="lk-bg" onClick={onClose}><style>{css}</style>
      <div className="lk-drawer" style={cssVars(S.theme)} onClick={(e) => e.stopPropagation()}>
        <div className="lk-dh"><h3>Admin</h3><button className="lk-btn icon" onClick={onClose}><Icon n="x" /></button></div>
        <div className="lk-tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? "sel" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
        <div className="lk-db">
          {(tab === "companies" || tab === "systems") && (() => {
            const label = tab === "companies" ? "company" : tab.slice(0, -1);
            const items = tab === "companies" ? S.companies.map((c) => [c.id, c.name]) : S[tab].map((x) => [x, x]);
            return <>
              <div className="lk-list">{items.map(([id, name]) => <div key={id} className="lk-li"><span className="g">{name}</span><button onClick={() => delList(tab, id, label)}><Icon n="trash" s={14} /></button></div>)}</div>
              <div className="lk-add"><input className="lk-in" placeholder={`Add ${label}…`} value={nv} onChange={(e) => setNv(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addList(tab, label)} /><button className="lk-btn primary" onClick={() => addList(tab, label)}><Icon n="plus" s={15} /></button></div>
            </>;
          })()}
          {tab === "areas" && <>
            <div className="lk-list">{S.areas.map((area) => {
              const subs = (S.subAreas || []).filter((s) => s.area === area).map((s) => s.name).sort();
              return <div key={area} style={{ borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
                <div className="lk-li" style={{ borderBottom: 0 }}><span className="g" style={{ fontWeight: 600 }}>{area}</span><button onClick={() => delList("areas", area, "area")}><Icon n="trash" s={14} /></button></div>
                <div style={{ paddingLeft: 14 }}>
                  {subs.map((sn) => { const t3 = (S.tier3s || []).filter((t) => t.area === area && t.subArea === sn).map((t) => t.name).sort(); const k = area + "\u0001" + sn; return <div key={sn} style={{ paddingBottom: 4 }}>
                    <div className="lk-li" style={{ borderBottom: 0 }}><span className="g" style={{ fontSize: 12, color: "var(--muted)" }}>↳ {sn}</span><button onClick={() => delSub(area, sn)}><Icon n="trash" s={13} /></button></div>
                    <div style={{ paddingLeft: 16 }}>
                      {t3.map((tn) => <div key={tn} className="lk-li" style={{ borderBottom: 0 }}><span className="g" style={{ fontSize: 11.5, color: "var(--muted)" }}>↳↳ {tn}</span><button onClick={() => delT3(area, sn, tn)}><Icon n="trash" s={12} /></button></div>)}
                      <div className="lk-add"><input className="lk-in" placeholder="Add Tier 3 Area…" value={t3Input[k] || ""} onChange={(e) => setT3Input({ ...t3Input, [k]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addT3(area, sn)} /><button className="lk-btn" onClick={() => addT3(area, sn)}><Icon n="plus" s={14} /></button></div>
                    </div>
                  </div>; })}
                  <div className="lk-add"><input className="lk-in" placeholder="Add sub-area…" value={subInput[area] || ""} onChange={(e) => setSubInput({ ...subInput, [area]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addSub(area)} /><button className="lk-btn" onClick={() => addSub(area)}><Icon n="plus" s={15} /></button></div>
                </div>
              </div>;
            })}</div>
            <div className="lk-add"><input className="lk-in" placeholder="Add area…" value={nv} onChange={(e) => setNv(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addList("areas", "area")} /><button className="lk-btn primary" onClick={() => addList("areas", "area")}><Icon n="plus" s={15} /></button></div>
          </>}
          {tab === "users" && <>
            <div className="lk-list">{S.users.map((u) => <div key={u.id} className="lk-li">
              <input className="lk-in" key={u.id + ":" + u.name} defaultValue={u.name} title={u.id === S.currentUserId ? "Your display name" : "Display name"} placeholder="Name"
                style={{ flex: "1 1 96px", minWidth: 80, padding: "5px 8px", fontSize: 12, border: u.id === S.currentUserId ? "1px solid var(--accent)" : undefined }}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== u.name) userOp({ op: "update", id: u.id, name: v }).then(() => setUserMsg("Name updated")).catch((x) => setUserMsg("Failed: " + (x.message || x))); }} />
              <select className="lk-select" style={{ width: 86, padding: "5px 7px", fontSize: 11.5 }} value={u.role} onChange={(e) => userOp({ op: "update", id: u.id, role: e.target.value, company_id: e.target.value === "admin" ? null : u.companyId }).catch((x) => setUserMsg("Failed: " + (x.message || x)))}><option value="member">Member</option><option value="admin">Admin</option></select>
              <select className="lk-select" style={{ flex: 1, minWidth: 70, padding: "5px 7px", fontSize: 11.5 }} value={u.companyId || ""} disabled={u.role === "admin"} onChange={(e) => userOp({ op: "update", id: u.id, company_id: e.target.value }).catch((x) => setUserMsg("Failed: " + (x.message || x)))}><option value="">--</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <button title="Reset password" onClick={() => resetPw(u.id, u.name)} style={{ fontSize: 14, lineHeight: 1 }}>↻</button>
              {u.id !== S.currentUserId && <button title="Remove user" onClick={() => delUser(u.id, u.name)}><Icon n="trash" s={14} /></button>}
            </div>)}</div>
            <div className="lk-f"><label>Add user (email required)</label><input className="lk-in" placeholder="Email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></div>
            <div className="lk-f"><input className="lk-in" placeholder="Name (optional)" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></div>
            <div className="lk-row">
              <select className="lk-select" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}><option value="member">Member</option><option value="admin">Admin</option></select>
              <select className="lk-select" value={nu.companyId} disabled={nu.role === "admin"} onChange={(e) => setNu({ ...nu, companyId: e.target.value })}>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <button className="lk-btn primary" onClick={addUser}><Icon n="plus" s={15} />Create user</button>
            {newCred && <div style={{ marginTop: 8, padding: 11, border: "1px solid var(--accent)", borderRadius: 8, background: "var(--chipbg)", fontSize: 12.5 }}>
              <div style={{ fontWeight: 700, marginBottom: 5 }}>{newCred.title}. Share these with the person:</div>
              <div style={{ marginBottom: 2 }}>User: <span className="mono" style={{ userSelect: "all" }}>{newCred.who}</span></div>
              <div>Temporary password: <span className="mono" style={{ userSelect: "all", fontWeight: 700 }}>{newCred.pw}</span></div>
              <button className="lk-btn" style={{ marginTop: 8 }} onClick={() => { try { navigator.clipboard.writeText(`Site: ${window.location.origin}\nEmail: ${newCred.who}\nPassword: ${newCred.pw}`); setUserMsg("Copied to clipboard"); } catch (e) { setUserMsg("Copy not available; select the text manually."); } }}><Icon n="download" s={13} />Copy login details</button>
              <button className="lk-btn" style={{ marginTop: 8, marginLeft: 6 }} onClick={() => setNewCred(null)}>Done</button>
              <div style={{ marginTop: 7, color: "var(--muted)" }}>They can keep this password. To issue a new one later, use the ↻ button on their row. No email is sent.</div>
            </div>}
            {userMsg && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>{userMsg}</div>}
          </>}
          {tab === "branding" && <>
            <div className="lk-f"><label>Project name</label>
              <input className="lk-in" value={S.brand?.projectName || ""} placeholder="FIN04" onChange={(e) => update((p) => ({ ...p, brand: { ...p.brand, projectName: e.target.value } }))} /></div>
            <div className="lk-f"><label>App name</label>
              <input className="lk-in" value={S.brand?.appName || ""} placeholder="DLP" onChange={(e) => update((p) => ({ ...p, brand: { ...p.brand, appName: e.target.value } }))} /></div>
            <div className="lk-f"><label>Tagline</label>
              <input className="lk-in" value={S.brand?.tagline || ""} placeholder="Collaborative Digital Planning" onChange={(e) => update((p) => ({ ...p, brand: { ...p.brand, tagline: e.target.value } }))} /></div>
            <button className="lk-btn primary" onClick={async () => {
              setBrandMsg("Saving…");
              try { await updateBranding({ project_name: S.brand.projectName, app_name: S.brand.appName, tagline: S.brand.tagline }); setBrandMsg("Text saved"); }
              catch (e) { setBrandMsg("Failed: " + (e.message || e)); }
            }}><Icon n="check" s={15} />Save text</button>
            <div className="lk-f" style={{ marginTop: 14 }}><label>Customer logo</label>
              {S.brand?.logoUrl && <img src={S.brand.logoUrl} alt="" style={{ height: 44, maxWidth: 180, objectFit: "contain", margin: "4px 0 8px", display: "block" }} />}
              <input className="lk-in" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={async (e) => {
                const f = e.target.files && e.target.files[0]; if (!f) return;
                setBrandMsg("Uploading logo…");
                try { const url = await uploadLogo(f); update((p) => ({ ...p, brand: { ...p.brand, logoUrl: url } })); setBrandMsg("Logo updated"); }
                catch (x) { setBrandMsg("Failed: " + (x.message || x)); }
                e.target.value = "";
              }} />
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>PNG, JPG, SVG or WebP. A wide transparent PNG looks best in the bar.</div>
            </div>
            {brandMsg && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{brandMsg}</div>}
          </>}
          {tab === "settings" && <>
            <div className="lk-f"><label>Lookahead length</label>
              <div className="lk-status">{[2, 4, 6].map((w) => <button key={w} className={S.settings.weeks === w ? "sel" : ""} onClick={() => update((p) => ({ ...p, settings: { ...p.settings, weeks: w } }), { action: "Change setting", detail: `Lookahead ${w} weeks` })}>{w} weeks</button>)}</div></div>
            <div className="lk-f"><label>Make-ready window (days)</label>
              <input className="lk-in mono" type="number" min="1" value={S.settings.makeReadyDays} onChange={(e) => update((p) => ({ ...p, settings: { ...p.settings, makeReadyDays: Math.max(1, +e.target.value || 1) } }))} /></div>
          </>}
          {tab === "levels" && <div className="lk-list">
            {Object.entries(S.levels).map(([k, v]) => <div key={k} className="lk-li">
              <input type="color" value={v.color} onChange={(e) => update((p) => ({ ...p, levels: { ...p.levels, [k]: { ...p.levels[k], color: e.target.value } } }), { action: "Edit level", detail: `${k} colour` })} style={{ width: 36, height: 30, padding: 0, border: "1px solid var(--line)", borderRadius: 6, background: "transparent", cursor: "pointer" }} />
              <span style={{ fontWeight: 700, fontSize: 11, width: 22 }}>{k}</span>
              <input className="lk-in" value={v.name} onChange={(e) => update((p) => ({ ...p, levels: { ...p.levels, [k]: { ...p.levels[k], name: e.target.value } } }))} />
            </div>)}
          </div>}
          {tab === "data" && <>
            <div className="lk-f"><label>Export</label>
              <div className="lk-row"><button className="lk-btn" onClick={exportActivities}><Icon n="download" s={14} />Activities (CSV)</button>
                <button className="lk-btn" onClick={exportProject}><Icon n="download" s={14} />Project (JSON)</button></div></div>
            <div className="lk-f"><label>Import mode</label>
              <div className="lk-status"><button className={impMode === "append" ? "sel" : ""} onClick={() => setImpMode("append")}>Append</button><button className={impMode === "override" ? "sel" : ""} onClick={() => setImpMode("override")}>Override</button></div></div>
            <div className="lk-f"><label>Import file (.json project or .csv activities)</label>
              <input className="lk-in" type="file" accept=".json,.csv" onChange={handleImportFile} /></div>
            <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>JSON sets up the whole project: companies, areas, sub-areas, Tier 3 Areas, systems, levels, settings and activities. CSV imports activities and auto-creates any new company, area, sub-area, Tier 3 Area or system it names, so a CSV alone can stand a project up. Add "Sub-area" and "Tier 3 Area" columns to the CSV to populate them. Override replaces, Append merges.</div>
            {impMsg && <div className="lk-pv" style={{ borderRadius: 8, border: "1px solid var(--line)" }}><Icon n="alert" s={13} />{impMsg}</div>}
          </>}
          {tab === "audit" && <>
            <div className="lk-pv" style={{ borderRadius: 8, border: "1px solid var(--line)" }}><Icon n="alert" s={13} />Complete history of every action by every user, admin only. In production the database writes this on every change and it cannot be edited here.</div>
            <div className="lk-f"><label>Filter by user</label>
              <select className="lk-select" value={auditUser} onChange={(e) => setAuditUser(e.target.value)}>
                <option value="all">All users ({S.audit.length})</option>
                {S.users.map((u) => <option key={u.id} value={u.name}>{u.name} ({S.audit.filter((e) => e.user === u.name).length})</option>)}
              </select></div>
            <button className="lk-btn" onClick={() => { const rows = (auditUser === "all" ? S.audit : S.audit.filter((e) => e.user === auditUser)).map((e) => [e.ts, e.user, e.action, e.detail]); downloadFile(`FIN04-audit-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(["Timestamp", "User", "Action", "Detail"], rows)); }}><Icon n="download" s={14} />Export audit (CSV)</button>
            {(() => { const list = auditUser === "all" ? S.audit : S.audit.filter((e) => e.user === auditUser);
              return <div>{list.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>No actions logged for this selection.</div>}
                {list.map((e) => <div key={e.id} className="lk-audit"><span className="a">{e.action}: <span style={{ fontWeight: 400 }}>{e.detail}</span></span><span className="m">{e.user} · {new Date(e.ts).toLocaleString("en-GB")}</span></div>)}</div>; })()}
          </>}
        </div>
      </div>
    </div>);
}
