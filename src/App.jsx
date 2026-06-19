import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadAll, syncCollections, userOp, signOut, subscribeAll, updateBranding, uploadLogo, applyBrandToTab } from "./data";
import SetPassword from "./SetPassword.jsx";

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
  min-height:100vh;width:100%;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}
.lk *{box-sizing:border-box}
.mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
.lk-bar{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--line);flex-wrap:wrap;position:sticky;top:0;z-index:30;background:var(--paper)}
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
.lk-bg{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:80;display:flex;justify-content:flex-end}
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
.lk-shell{display:flex;min-height:100vh;padding-left:56px}
.lk-rail{position:fixed;left:0;top:0;bottom:0;width:56px;background:#1d2530;z-index:50;display:flex;flex-direction:column;padding:14px 0}
.lk-rail-inner{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;width:100%}
.lk-rail button{width:40px;height:40px;border:0;border-radius:10px;background:transparent;color:#9aa7b8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .12s,color .12s}
.lk-rail button:hover{background:#2a333f;color:#dfe6ef}
.lk-rail button.on{background:var(--accent);color:#fff}
.lk-page{flex:1;min-width:0;display:flex;flex-direction:column}
.lk-rep{padding:18px 22px;max-width:1100px}
.lk-adminwrap{max-width:780px;width:100%;padding:6px 22px 52px}
.lk-adminwrap .lk-db{padding:14px 0 0}
.lk-adminwrap .lk-tabs{padding:6px 0 0}
.lk-help{height:calc(100vh - 62px)}
.lk-help iframe{width:100%;height:100%;border:0;display:block;background:#fff}
.lk-ugroup{margin-top:12px;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.lk-ughead{display:flex;align-items:center;gap:8px;width:100%;font-weight:700;font-size:12.5px;padding:9px 12px;background:var(--card);border:0;color:var(--ink);cursor:pointer;text-align:left;font-family:inherit}
.lk-ughead .cnt{font-weight:500;color:var(--muted);font-size:11px}
.lk-ughead .chev{display:inline-block;transition:transform .12s;color:var(--muted);font-size:10px}
.lk-ufilter{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin-bottom:6px}
.lk-rep h2{font-size:17px;font-weight:700;margin:0 0 2px}
.lk-rep .sub{color:var(--muted);font-size:12px;margin-bottom:16px}
.lk-rep-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin-bottom:14px;position:sticky;top:62px;z-index:20;background:var(--paper);padding:10px 0;border-bottom:1px solid var(--line)}
.lk-rep-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(135px,1fr));gap:10px;margin-bottom:22px}
.lk-rep-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 14px}
.lk-rep-card .v{font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1}
.lk-rep-card .l{font-size:11px;color:var(--muted);margin-top:5px;display:block;text-transform:uppercase;letter-spacing:.04em}
.lk-rep-sec{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:15px 16px;margin-bottom:16px}
.lk-rep-sec h3{font-size:13px;font-weight:700;margin:0 0 12px}
.lk-bar-row{display:grid;grid-template-columns:140px 1fr 42px;align-items:center;gap:10px;margin-bottom:7px;font-size:12px}
.lk-bar-track{height:16px;background:var(--hover);border-radius:5px;overflow:hidden}
.lk-bar-fill{height:100%;border-radius:5px}
.lk-bar-row .n{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}
.lk-tbl{width:100%;border-collapse:collapse;font-size:12px}
.lk-tbl th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600;padding:7px 8px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--paper)}
.lk-tbl td{padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.lk-tbl tr:hover td{background:var(--hover)}
.lk-tbl .lnk{color:var(--accent);cursor:pointer;font-weight:600}
.lk-tbl .lnk:hover{text-decoration:underline}
.lk-cdone{text-decoration:line-through;color:var(--muted)}
.lk-day.addday{position:relative;cursor:cell}
.lk-day.addday .addp{position:absolute;top:2px;right:3px;opacity:0;color:var(--accent);transition:opacity .12s;display:flex}
.lk-day.addday:hover .addp{opacity:1}
.lk-day.addday:hover{background:var(--hover)}
.lk-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:80;display:flex;align-items:flex-start;justify-content:center;padding:46px 16px;overflow:auto}
.lk-modal{background:var(--paper);border:1px solid var(--line);border-radius:14px;max-width:660px;width:100%;color:var(--ink);box-shadow:0 20px 60px rgba(0,0,0,.35)}
.lk-modal .bd{padding:18px 20px;display:flex;flex-direction:column;gap:14px}
.lk-modal ul{margin:6px 0 0;padding-left:18px;font-size:12.5px;line-height:1.65;color:var(--ink)}
.lk-modal .ref{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-size:12px}
.lk-modal .ref b{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);display:block;margin-bottom:4px}
.lk-tag{display:inline-block;background:var(--chipbg);border:1px solid var(--line);border-radius:6px;padding:2px 7px;margin:2px 4px 2px 0;font-size:11.5px}
.lk-res-ok{background:#0E93841a;border:1px solid #0E9384;color:var(--ink);border-radius:9px;padding:10px 12px;font-size:12.5px}
.lk-res-err{background:#C0392B14;border:1px solid #C0392B;border-radius:9px;padding:10px 12px;font-size:12px}
.lk-res-err ul{max-height:200px;overflow:auto;color:#C0392B}
.lk-foot{position:fixed;right:10px;bottom:8px;z-index:40;pointer-events:none;display:flex;align-items:center;font-size:10px;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:8px;padding:5px 12px;opacity:.9;white-space:nowrap;max-width:calc(100vw - 20px);overflow:hidden;line-height:1}
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
  board: <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></>,
  chart: <><line x1="3" y1="21" x2="21" y2="21"/><rect x="5" y="10" width="3.2" height="8"/><rect x="10.4" y="6" width="3.2" height="12"/><rect x="15.8" y="13" width="3.2" height="5"/></>,
  list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
  clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  cog: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  help: <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
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
const toCSV = (headers, rows) => "\uFEFF" + [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
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
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState("board");
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
  useEffect(() => { const t = THEMES[S?.theme] || THEMES.light; document.documentElement.style.background = t.paper; document.body.style.background = t.paper; }, [S?.theme]);

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
  const locCode = (a) => [(S.brand && S.brand.projectName) || "FIN04", a.area, a.subArea, a.tier3].filter(Boolean).join(".");

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
  if (cu.mustReset) return <SetPassword forced onDone={() => setS((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === cu.id ? { ...u, mustReset: false } : u)) }))} />;
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
  const ppcAll = (() => { const c = S.activities.filter((a) => a.committed); return c.length ? Math.round(c.filter((a) => a.status === "complete").length / c.length * 100) : null; })();

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
    if (!isAdmin && a.committed) { dragId.current = null; return; }
    if (!isAdmin && S.laneBy === "company" && lane != null) { const c = S.companies.find((c) => c.name === lane); if (c && c.id !== a.companyId) { dragId.current = null; return; } }
    update((p) => ({ ...p, activities: p.activities.map((x) => {
      if (x.id !== id) return x;
      const u = { ...x, start: fmtISO(addDays(anchor, dayIdx)) };
      if (lane != null) { if (p.laneBy === "level") u.level = lane; else if (p.laneBy === "area") u.area = lane; else if (p.laneBy === "subarea") { const [ar, sub] = lane.split(SUBSEP); u.area = ar; u.subArea = sub || ""; } else { const c = p.companies.find((c) => c.name === lane); if (isAdmin && c) u.companyId = c.id; } }
      return u;
    }) }), { action: "Move activity", detail: `${a.desc} to ${fmtISO(addDays(anchor, dayIdx))}` });
    dragId.current = null;
  };
  const newActivity = (lane, dayIdx) => {
    const base = { id: uid("a"), desc: "", companyId: isAdmin ? (S.companies[0] || {}).id : cu.companyId, area: "", subArea: "", tier3: "", asset: "", system: "", level: "L2",
      start: fmtISO(addDays(anchor, Math.max(0, dayIdx ?? Math.max(0, todayOffset)))), duration: 1, committed: false, status: "planned", isMilestone: false, witnessInvite: false, witnessAt: "", notes: "", actualStart: "", actualFinish: "", constraints: [] };
    if (lane) { if (S.laneBy === "level") base.level = lane; else if (S.laneBy === "area") base.area = lane; else if (S.laneBy === "subarea") { const [ar, sub] = lane.split(SUBSEP); base.area = ar; base.subArea = sub || ""; } else if (isAdmin) { const c = S.companies.find((c) => c.name === lane); if (c) base.companyId = c.id; } }
    setEditing(base);
  };
  const exportActivities = () => {
    const headers = ["Activity ID", "Description", "Company", "Location code", "Building", "Level", "Zone / Room", "Asset", "System", "Cx Stage", "Milestone", "Witness invite", "Planned start", "Planned finish", "Duration (d)", "Actual start", "Actual finish", "Delay (d)", "Status", "Committed", "Open constraints", "Constraints", "Notes"];
    const rows = visible.map((a) => [a.id, a.desc, coName(a.companyId), locCode(a), a.area, a.subArea || "", a.tier3 || "", a.asset || "", a.system, a.level, a.isMilestone ? "Yes" : "No", a.witnessInvite ? "Yes" : "No", a.start, fmtISO(addDays(parseD(a.start), a.duration - 1)), a.duration, a.actualStart || "", a.actualFinish || "", a.delayDays || 0, a.status, a.committed ? "Yes" : "No", a.open, a.constraints.map((c) => (c.done ? "[x] " : "[ ] ") + c.text).join("; "), a.notes || ""]);
    downloadFile(`FIN04-lookahead-${fmtISO(new Date())}.csv`, toCSV(headers, rows));
    update((p) => p, { action: "Export activities", detail: `${rows.length} rows` });
  };
  const fmtWitnessAt = (s) => { if (!s) return ""; const d = new Date(s); if (isNaN(d)) return s; return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
  const exportWitness = () => {
    const pad = (n) => String(n).padStart(2, "0");
    const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const WIT_MINUTES = 60;
    const wit = visible.filter((a) => a.witnessInvite && a.witnessAt).sort((a, b) => (a.witnessAt || "").localeCompare(b.witnessAt || ""));
    const headers = ["Subject", "Start Date", "Start Time", "End Date", "End Time", "All Day Event", "Location", "Description", "Start ISO", "End ISO", "Company", "Cx Stage", "System", "Activity ID"];
    const rows = wit.map((a) => {
      const sd = new Date(a.witnessAt); const ed = new Date(sd.getTime() + WIT_MINUTES * 60000);
      const loc = locCode(a);
      const subject = `Witness: ${a.desc || "Activity"}${loc ? " - " + loc : ""}`;
      const open = (a.constraints || []).filter((c) => !c.done).length;
      const body = `${a.desc || ""}. Cx Stage ${a.level} on ${a.system || "system"}. Performing: ${coName(a.companyId)}. Planned start ${a.start}.${a.notes ? " Notes: " + a.notes : ""}${open ? ` (${open} open constraint${open === 1 ? "" : "s"})` : ""}`;
      const dmy = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
      const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      return [subject, dmy(sd), hm(sd), dmy(ed), hm(ed), "False", loc, body, localISO(sd), localISO(ed), coName(a.companyId), a.level, a.system || "", a.id];
    });
    downloadFile(`FIN04-witness-invites-${fmtISO(new Date())}.csv`, toCSV(headers, rows));
    update((p) => p, { action: "Export witness invites", detail: `${rows.length} activities` });
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
    const movable = isAdmin || (editable && !a.committed);
    if (a.isMilestone) {
      return <div className="lk-ms" style={{ gridColumn: `${s + 1} / ${s + 2}`, gridRow: row + 1 }}
        draggable={movable} onDragStart={() => movable && (dragId.current = a.id)} onClick={() => setEditing({ ...a })}>
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
        draggable={movable} onDragStart={() => movable && (dragId.current = a.id)} onClick={() => setEditing({ ...a })}>
        <div className="desc">{a.desc || "Untitled activity"}</div>
        <div className="meta">
          <span className="dot" style={{ background: a.status === "complete" ? "#9AA6B2" : constrained ? "#E0A106" : "#0E9384" }} />
          {a.committed && <span className="lk-chip commit">will</span>}
          {a.witnessInvite && <span className="lk-chip wit" title="Witness invite">WIT</span>}
          {constrained && <span className="lk-chip cstr"><Icon n="alert" s={9} />{a.open}</span>}
          {a.delayed && <span className="lk-chip late">+{a.delayDays}d</span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{S.laneBy === "company" ? locCode(a) : coName(a.companyId)}</span>
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
      <div className="lk-shell">
      <nav className="lk-rail"><div className="lk-rail-inner">
        <button title="Planning board" className={page === "board" ? "on" : ""} onClick={() => setPage("board")}><Icon n="board" s={20} /></button>
        <button title="Constraints log" className={page === "constraints" ? "on" : ""} onClick={() => setPage("constraints")}><Icon n="list" s={20} /></button>
        <button title="Reports & metrics" className={page === "reports" ? "on" : ""} onClick={() => setPage("reports")}><Icon n="chart" s={20} /></button>
        <button title="Help & quick reference" className={page === "help" ? "on" : ""} onClick={() => setPage("help")}><Icon n="help" s={20} /></button>
        {isAdmin && <button title="Admin settings" className={page === "admin" ? "on" : ""} onClick={() => setPage("admin")}><Icon n="cog" s={20} /></button>}
        <div style={{ marginTop: "auto", textAlign: "center", color: "#9aa7b8" }}>
          <div style={{ fontSize: 9, letterSpacing: ".1em" }}>PPC</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: ppcAll == null ? "#9aa7b8" : (ppcAll >= 80 ? "#34D399" : ppcAll >= 50 ? "#FBBF24" : "#F87171") }}>{ppcAll == null ? "\u2014" : ppcAll + "%"}</div>
        </div>
      </div></nav>
      <div className="lk-page">
      {page === "board" && <>
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
          {[["company", "Company"], ["area", "Building"], ["subarea", "Level"], ["level", "Cx Stage"]].map(([k, l]) => (
            <button key={k} className={S.laneBy === k ? "sel" : ""} onClick={() => update((p) => ({ ...p, laneBy: k }))}>{l}</button>))}
        </div>}
        <button className={"lk-btn" + (makeReady ? " on" : "")} onClick={() => setMakeReady((v) => !v)}><Icon n="cross" s={14} />Make-ready</button>
        <button className="lk-btn icon" onClick={() => update((p) => ({ ...p, theme: p.theme === "dark" ? "light" : "dark" }))}><Icon n={S.theme === "dark" ? "sun" : "moon"} s={15} /></button>
        <button className="lk-btn" onClick={() => setShowImport(true)}><Icon n="upload" s={14} />Import</button>
        <button className="lk-btn" onClick={exportActivities}><Icon n="download" s={14} />Export</button>
        <div className="lk-spacer" />
        <div className="lk-who">
          <span style={{ fontWeight: 600 }}>{cu.name}</span>
          <span className={"lk-pill " + cu.role}>{cu.role === "admin" ? "Admin" : coName(cu.companyId)}</span>
          <button className="lk-btn" onClick={() => signOut()}>Sign out</button>
        </div>
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
              return <div key={i} className={"lk-day addday" + (we ? " we" : "") + (tod ? " tod" : "")} style={{ gridRow: 2 }} title="Add an activity on this day" onClick={() => newActivity(undefined, i)}>
                <div className="wd">{d.toLocaleString("en-GB", { weekday: "short" }).slice(0, 2)}</div><div className="dn mono">{d.getDate()}</div><span className="addp"><Icon n="plus" s={11} /></span></div>; })}
          </> : <>
            <div style={{ borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }} />
            {Array.from({ length: cols }, (_, i) => (
              <div key={i} className={"lk-day addday" + (i === todayUnit ? " tod" : "")} style={{ padding: "8px 0 9px", borderBottom: "1px solid var(--line)" }} title="Add an activity in this week" onClick={() => newActivity(undefined, dropDay(i))}>
                <div className="wd">WK {isoWeek(unitDate(i))}</div><div className="dn mono">w/c {fmtWC(unitDate(i))}</div><span className="addp"><Icon n="plus" s={11} /></span></div>))}
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
      </>}
      {page !== "board" && <div className="lk-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {S.brand?.logoUrl && <img src={S.brand.logoUrl} alt="" style={{ height: 30, maxWidth: 130, objectFit: "contain" }} />}
          <div><div className="lk-title">{(S.brand?.projectName || "FIN04")} {(S.brand?.appName || "DLP")}</div><div className="lk-sub">{S.brand?.tagline || "Collaborative Digital Planning"}</div></div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, marginLeft: 6 }}>{page === "constraints" ? "Constraints log" : page === "reports" ? "Reports & metrics" : page === "admin" ? "Admin settings" : page === "help" ? "Help & quick reference" : ""}</div>
        <div className="lk-spacer" />
        <div className="lk-who">
          <span style={{ fontWeight: 600 }}>{cu.name}</span>
          <span className={"lk-pill " + cu.role}>{cu.role === "admin" ? "Admin" : coName(cu.companyId)}</span>
          <button className="lk-btn" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>}
      {page === "constraints" && <ConstraintsPage S={S} update={update} canEdit={canEdit} coName={coName} onOpen={(a) => { setPage("board"); setEditing({ ...a }); }} />}
      {page === "reports" && <ReportsPage S={S} LV={LV} coName={coName} exportActivities={exportActivities} exportWitness={exportWitness} />}
      {page === "admin" && isAdmin && <AdminPanel S={S} cu={cu} update={update} exportActivities={exportActivities} />}
      {page === "help" && <HelpPage />}
      </div>
      </div>

      <div className="lk-foot">DLP by QMC Cx Software Solutions{"\u2122"} {"\u00B7"} {"\u00A9"} {new Date().getFullYear()} Quantum Mission Critical. All rights reserved.</div>
      {editing && <Drawer act={editing} S={S} canEdit={canEdit(editing)} isAdmin={isAdmin} onSave={saveActivity} onClose={() => setEditing(null)} onDelete={removeActivity} />}
      {showImport && <UserImport S={S} cu={cu} isAdmin={isAdmin} LV={LV} update={update} onClose={() => setShowImport(false)} />}
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
  const hasLevels = !!a.area && (S.subAreas || []).some((s) => s.area === a.area);
  const hasZones = !!a.subArea && (S.tier3s || []).some((t) => t.area === a.area && t.subArea === a.subArea);
  const missing = [];
  if (!a.desc.trim()) missing.push("activity description");
  if (!a.area) missing.push("building");
  if (hasLevels && !a.subArea) missing.push("level");
  if (hasZones && !a.tier3) missing.push("zone / room");
  if (!a.system) missing.push("system");
  if (a.witnessInvite && !a.witnessAt) missing.push("witness date & time");
  const incomplete = missing.length > 0;
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
            <div className="lk-f"><label>Building</label>
              <select className="lk-select" value={a.area} disabled={dis} onChange={(e) => { set("area", e.target.value); set("subArea", ""); set("tier3", ""); }}>
                <option value="">--</option>{S.areas.map((x) => <option key={x}>{x}</option>)}</select></div>
          </div>
          <div className="lk-f"><label>Level</label>
            <select className="lk-select" value={a.subArea || ""} disabled={dis || !a.area} onChange={(e) => { set("subArea", e.target.value); set("tier3", ""); }}>
              <option value="">--</option>{(S.subAreas || []).filter((s) => s.area === a.area).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}</select>
            {a.area && (S.subAreas || []).filter((s) => s.area === a.area).length === 0 && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>No levels defined for {a.area}. Add them in Admin, Locations.</span>}</div>
          <div className="lk-f"><label>Zone / Room</label>
            <select className="lk-select" value={a.tier3 || ""} disabled={dis || !a.subArea} onChange={(e) => set("tier3", e.target.value)}>
              <option value="">--</option>{(S.tier3s || []).filter((t) => t.area === a.area && t.subArea === a.subArea).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}</select>
            {a.subArea && (S.tier3s || []).filter((t) => t.area === a.area && t.subArea === a.subArea).length === 0 && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>No zones or rooms defined for {a.subArea}. Add them in Admin, Locations.</span>}</div>
          <div className="lk-f"><label>System</label>
            <select className="lk-select" value={a.system} disabled={dis} onChange={(e) => set("system", e.target.value)}>
              <option value="">--</option>{S.systems.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="lk-f"><label>Asset (optional)</label>
            <input className="lk-in" value={a.asset || ""} disabled={dis} placeholder="e.g. EPOD108.DB001.U003" onChange={(e) => set("asset", e.target.value)} /></div>
          <div className="lk-f"><label>Cx Stage</label>
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
          {a.witnessInvite && <div className="lk-f"><label>Witness date &amp; time <span style={{ color: "#C0392B" }}>*</span></label>
            <input className="lk-in mono" type="datetime-local" value={a.witnessAt || ""} disabled={dis} onChange={(e) => set("witnessAt", e.target.value)} />
            {!a.witnessAt && <span style={{ fontSize: 11, color: "#C0392B" }}>A witness time is required before this activity can be saved.</span>}</div>}
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
          <div className="lk-spacer" />{incomplete && <span style={{ fontSize: 11, color: "var(--muted)", alignSelf: "center", marginRight: 8 }} title={"Still needed: " + missing.join(", ")}>Needs {missing.length} field{missing.length > 1 ? "s" : ""}</span>}<button className="lk-btn" onClick={onClose}>Cancel</button>
          <button className="lk-btn primary" onClick={() => onSave(a, isNew)} disabled={incomplete}><Icon n="check" s={15} />Save</button>
        </div>}
      </div>
    </div>);
}

function AdminPanel({ S, cu, update, exportActivities }) {
  const [tab, setTab] = useState("companies");
  const [nv, setNv] = useState("");
  const [auditUser, setAuditUser] = useState("all");
  const [brandMsg, setBrandMsg] = useState("");
  const [impMode, setImpMode] = useState("append");
  const [impMsg, setImpMsg] = useState("");
  const [userMsg, setUserMsg] = useState("");
  const [nu, setNu] = useState({ email: "", name: "", role: "member", companyId: S.companies[0]?.id || "" });
  const [uq, setUq] = useState("");
  const [uCo, setUCo] = useState("all");
  const [uRole, setURole] = useState("all");
  const [openGroups, setOpenGroups] = useState({});
  const [subInput, setSubInput] = useState({});
  const [t3Input, setT3Input] = useState({});
  const [copyFrom, setCopyFrom] = useState({});
  const addList = (key, label) => { if (!nv.trim()) return; update((p) => ({ ...p, [key]: key === "companies" ? [...p.companies, { id: uid("co"), name: nv.trim() }] : [...p[key], nv.trim()] }), { action: "Add " + label, detail: nv.trim() }); setNv(""); };
  const delList = (key, val, label) => update((p) => {
    const n = { ...p };
    if (key === "companies") n.companies = p.companies.filter((c) => c.id !== val);
    else n[key] = p[key].filter((x) => x !== val);
    if (key === "areas") { n.subAreas = (p.subAreas || []).filter((s) => s.area !== val); n.tier3s = (p.tier3s || []).filter((t) => t.area !== val); }
    return n;
  }, { action: "Remove " + label, detail: typeof val === "string" ? val : (S.companies.find((c) => c.id === val) || {}).name });
  const addSub = (area) => { const name = (subInput[area] || "").trim(); if (!name) return; update((p) => ({ ...p, subAreas: [...(p.subAreas || []), { area, name }].filter((s, i, arr) => arr.findIndex((x) => x.area === s.area && x.name === s.name) === i) }), { action: "Add level", detail: `${area} / ${name}` }); setSubInput({ ...subInput, [area]: "" }); };
  const delSub = (area, name) => update((p) => ({ ...p, subAreas: (p.subAreas || []).filter((s) => !(s.area === area && s.name === name)), tier3s: (p.tier3s || []).filter((t) => !(t.area === area && t.subArea === name)) }), { action: "Remove level", detail: `${area} / ${name}` });
  const addT3 = (area, subArea) => { const key = area + "\u0001" + subArea; const name = (t3Input[key] || "").trim(); if (!name) return; update((p) => ({ ...p, tier3s: [...(p.tier3s || []), { area, subArea, name }].filter((t, i, arr) => arr.findIndex((x) => x.area === t.area && x.subArea === t.subArea && x.name === t.name) === i) }), { action: "Add zone / room", detail: `${area} / ${subArea} / ${name}` }); setT3Input({ ...t3Input, [key]: "" }); };
  const delT3 = (area, subArea, name) => update((p) => ({ ...p, tier3s: (p.tier3s || []).filter((t) => !(t.area === area && t.subArea === subArea && t.name === name)) }), { action: "Remove zone / room", detail: `${area} / ${subArea} / ${name}` });
  const renameArea = (oldName, raw) => { const name = (raw || "").trim(); if (!name || name === oldName) return; if (S.areas.some((a) => a !== oldName && a.toLowerCase() === name.toLowerCase())) { alert(`A building named "${name}" already exists.`); return; } update((p) => ({ ...p, areas: p.areas.map((a) => (a === oldName ? name : a)), subAreas: (p.subAreas || []).map((s) => (s.area === oldName ? { ...s, area: name } : s)), tier3s: (p.tier3s || []).map((t) => (t.area === oldName ? { ...t, area: name } : t)), activities: p.activities.map((a) => (a.area === oldName ? { ...a, area: name } : a)) }), { action: "Rename building", detail: `${oldName} -> ${name}` }); };
  const renameSub = (area, oldName, raw) => { const name = (raw || "").trim(); if (!name || name === oldName) return; if ((S.subAreas || []).some((s) => s.area === area && s.name !== oldName && s.name.toLowerCase() === name.toLowerCase())) { alert(`Level "${name}" already exists in ${area}.`); return; } update((p) => ({ ...p, subAreas: (p.subAreas || []).map((s) => (s.area === area && s.name === oldName ? { ...s, name } : s)), tier3s: (p.tier3s || []).map((t) => (t.area === area && t.subArea === oldName ? { ...t, subArea: name } : t)), activities: p.activities.map((a) => (a.area === area && a.subArea === oldName ? { ...a, subArea: name } : a)) }), { action: "Rename level", detail: `${area} / ${oldName} -> ${name}` }); };
  const renameT3 = (area, subArea, oldName, raw) => { const name = (raw || "").trim(); if (!name || name === oldName) return; if ((S.tier3s || []).some((t) => t.area === area && t.subArea === subArea && t.name !== oldName && t.name.toLowerCase() === name.toLowerCase())) { alert(`Zone / room "${name}" already exists in ${area} / ${subArea}.`); return; } update((p) => ({ ...p, tier3s: (p.tier3s || []).map((t) => (t.area === area && t.subArea === subArea && t.name === oldName ? { ...t, name } : t)), activities: p.activities.map((a) => (a.area === area && a.subArea === subArea && a.tier3 === oldName ? { ...a, tier3: name } : a)) }), { action: "Rename zone / room", detail: `${area} / ${subArea} / ${oldName} -> ${name}` }); };
  const copyZones = (area, fromSub, toSub) => { if (!fromSub || !toSub || fromSub === toSub) return; const src = (S.tier3s || []).filter((t) => t.area === area && t.subArea === fromSub); if (!src.length) return; update((p) => { const cur = [...(p.tier3s || [])]; src.forEach((t) => { if (!cur.some((x) => x.area === area && x.subArea === toSub && x.name.toLowerCase() === t.name.toLowerCase())) cur.push({ area, subArea: toSub, name: t.name }); }); return { ...p, tier3s: cur }; }, { action: "Copy zones / rooms", detail: `${area}: ${fromSub} -> ${toSub} (${src.length})` }); setCopyFrom({ ...copyFrom, [area + "\u0001" + toSub]: "" }); };
  const [newCred, setNewCred] = useState(null);
  const addUser = async () => {
    if (!nu.email.trim()) { setUserMsg("Email required."); return; }
    setUserMsg("Creating account…"); setNewCred(null);
    try { const res = await userOp({ op: "invite", email: nu.email.trim(), name: nu.name.trim() || nu.email.trim(), role: nu.role, company_id: nu.role === "admin" ? null : nu.companyId, redirect: window.location.origin });
      setNewCred({ who: nu.email.trim(), pw: res.tempPassword, link: res.link, title: "Account created" }); setUserMsg(""); setNu({ email: "", name: "", role: "member", companyId: S.companies[0]?.id || "" }); }
    catch (e) { setUserMsg("Failed: " + (e.message || e)); }
  };
  const resetPw = async (id, who) => { setUserMsg("Resetting password…"); setNewCred(null); try { const res = await userOp({ op: "resetpw", id }); setNewCred({ who, pw: res.tempPassword, title: "New password set" }); setUserMsg(""); } catch (e) { setUserMsg("Failed: " + (e.message || e)); } };
  const sendLink = async (id, who) => { setUserMsg("Generating link…"); setNewCred(null); try { const res = await userOp({ op: "link", id, redirect: window.location.origin }); setNewCred({ who, link: res.link, title: "Set-password link" }); setUserMsg(""); } catch (e) { setUserMsg("Failed: " + (e.message || e)); } };
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const bulkCreate = async () => {
    const lines = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setBulkBusy(true); setBulkResults(null);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(",").map((s) => s.trim());
      const email = parts[0]; const name = parts[1] || (email || "");
      const role = (parts[2] || "member").toLowerCase() === "admin" ? "admin" : "member";
      const coName = parts[3] || ""; const co = S.companies.find((c) => c.name.toLowerCase() === coName.toLowerCase());
      const company_id = role === "admin" ? null : (co ? co.id : null);
      if (!email || !/.+@.+\..+/.test(email)) { out.push({ email: email || "(blank)", name, status: "Skipped: invalid email" }); setBulkResults([...out]); continue; }
      try { const res = await userOp({ op: "invite", email, name, role, company_id, redirect: window.location.origin }); out.push({ email, name, role, company: co ? co.name : "", pw: res.tempPassword, link: res.link || "", status: "Created" + (res.link ? "" : " (link unavailable, use password)") }); }
      catch (e) { out.push({ email, name, status: "Failed: " + (e.message || e) }); }
      setBulkResults([...out]);
    }
    setBulkBusy(false);
  };
  const downloadBulk = () => { const rows = (bulkResults || []).map((r) => [r.name || "", r.email, r.link || "", r.pw || "", r.role || "", r.company || "", r.status]); downloadFile("FIN04-user-logins.csv", toCSV(["Name", "Email", "Set password link", "Temporary password", "Role", "Company", "Status"], rows)); };
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
    const ci = { desc: idx(["description", "activity description", "activity", "desc"]), company: idx(["company", "contractor", "vendor"]), area: idx(["building", "area"]), subarea: idx(["level", "floor", "sub-area", "sub area", "subarea"]), tier3: idx(["zone", "room", "tier 3 area", "tier3 area", "tier 3", "tier3"]), asset: idx(["asset", "equipment", "tag"]), system: idx(["system"]), level: idx(["cx stage", "cx", "stage"]), ms: idx(["milestone"]), wit: idx(["witness invite", "witness"]), notes: idx(["notes", "comment", "comments"]), pstart: idx(["planned start", "start"]), pfin: idx(["planned finish", "finish", "end"]), dur: idx(["duration", "days"]), astart: idx(["actual start"]), afin: idx(["actual finish"]), status: idx(["status"]), commit: idx(["committed", "commit"]), cons: idx(["constraints", "constraint"]) };
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
        const companyId = findCo(g(ci.company)); const area = g(ci.area); ensure(areas, area); const subArea = g(ci.subarea); ensureSub(area, subArea); const tier3 = g(ci.tier3); ensureT3(area, subArea, tier3); const asset = g(ci.asset); const system = g(ci.system); ensure(systems, system);
        let level = g(ci.level).toUpperCase(); if (!S.levels[level]) level = Object.keys(S.levels)[0] || "L2";
        const start = normDate(g(ci.pstart)); const pfin = normDate(g(ci.pfin)); const durRaw = g(ci.dur);
        let duration = 1; if (durRaw && +durRaw > 0) duration = +durRaw; else if (start && pfin) duration = Math.max(1, Math.round((parseD(pfin) - parseD(start)) / DAYMS) + 1);
        const consText = g(ci.cons); const constraints = consText ? consText.split(";").map((x) => x.trim()).filter(Boolean).map((x) => ({ id: uid("c"), text: x.replace(/^\[[ xX]\]\s*/, ""), done: /^\[[xX]\]/.test(x) })) : [];
        const yes = (v) => /^(y|yes|true|1)$/i.test(v);
        newActs.push({ id: uid("a"), desc, companyId, area, subArea, tier3, asset, system, level, isMilestone: yes(g(ci.ms)), witnessInvite: yes(g(ci.wit)), notes: g(ci.notes), start: start || fmtISO(new Date()), duration, committed: yes(g(ci.commit)), status: (g(ci.status) || "planned").toLowerCase().replace(/\s+/g, "_"), actualStart: normDate(g(ci.astart)), actualFinish: normDate(g(ci.afin)), constraints });
      }
      const activities = impMode === "override" ? newActs : [...p.activities, ...newActs];
      return { ...p, companies, areas, subAreas, tier3s, systems, activities };
    }, { action: `Import CSV (${impMode})`, detail: `${rows.length - 1} rows` });
    setImpMsg(`Imported ${rows.length - 1} CSV rows (${impMode}).`);
  };
  const handleImportFile = (e) => { const file = e.target.files && e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const txt = String(reader.result).replace(/^\uFEFF/, ""); if (file.name.toLowerCase().endsWith(".json")) importJSON(JSON.parse(txt)); else importCSV(txt); } catch (err) { setImpMsg("Import failed: " + (err && err.message ? err.message : "could not read file")); } }; reader.readAsText(file); e.target.value = ""; };
  const tabs = [["companies", "Companies"], ["areas", "Locations"], ["systems", "Systems"], ["levels", "Cx Stages"], ["branding", "Branding"], ["users", "Users"], ["settings", "Settings"], ["data", "Import / Export"], ["audit", "Audit"]];
  return (
    <div className="lk-adminwrap" style={cssVars(S.theme)}><style>{css}</style>
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
                <div className="lk-li" style={{ borderBottom: 0, gap: 6 }}><input className="lk-in" key={"a:" + area} defaultValue={area} style={{ fontWeight: 600, flex: 1 }} title="Rename building (updates every activity using it)" onKeyDown={(e) => { if (e.key === "Enter") { renameArea(area, e.target.value); e.target.blur(); } else if (e.key === "Escape") { e.target.value = area; e.target.blur(); } }} onBlur={(e) => renameArea(area, e.target.value)} /><button title="Delete building" onClick={() => delList("areas", area, "area")}><Icon n="trash" s={14} /></button></div>
                <div style={{ paddingLeft: 14 }}>
                  {subs.map((sn) => { const t3 = (S.tier3s || []).filter((t) => t.area === area && t.subArea === sn).map((t) => t.name).sort(); const k = area + "\u0001" + sn; const sibs = subs.filter((x) => x !== sn && (S.tier3s || []).some((t) => t.area === area && t.subArea === x)); return <div key={sn} style={{ paddingBottom: 4 }}>
                    <div className="lk-li" style={{ borderBottom: 0, gap: 6, flexWrap: "wrap" }}><span style={{ fontSize: 12, color: "var(--muted)" }}>↳</span><input className="lk-in" key={"s:" + area + ":" + sn} defaultValue={sn} style={{ flex: 1, fontSize: 12, minWidth: 80 }} title="Rename level" onKeyDown={(e) => { if (e.key === "Enter") { renameSub(area, sn, e.target.value); e.target.blur(); } else if (e.key === "Escape") { e.target.value = sn; e.target.blur(); } }} onBlur={(e) => renameSub(area, sn, e.target.value)} />
                      {sibs.length > 0 && <><select className="lk-select" style={{ fontSize: 11, maxWidth: 150 }} value={copyFrom[k] || ""} onChange={(e) => setCopyFrom({ ...copyFrom, [k]: e.target.value })}><option value="">Copy zones from…</option>{sibs.map((x) => <option key={x} value={x}>{x} ({(S.tier3s || []).filter((t) => t.area === area && t.subArea === x).length})</option>)}</select><button className="lk-btn" style={{ fontSize: 11 }} title="Copy every zone / room from the chosen level into this one" disabled={!copyFrom[k]} onClick={() => copyZones(area, copyFrom[k], sn)}>Copy</button></>}
                      <button title="Delete level" onClick={() => delSub(area, sn)}><Icon n="trash" s={13} /></button></div>
                    <div style={{ paddingLeft: 16 }}>
                      {t3.map((tn) => <div key={tn} className="lk-li" style={{ borderBottom: 0, gap: 6 }}><span style={{ fontSize: 11.5, color: "var(--muted)" }}>↳↳</span><input className="lk-in" key={"t:" + area + ":" + sn + ":" + tn} defaultValue={tn} style={{ flex: 1, fontSize: 11.5, minWidth: 80 }} title="Rename zone / room" onKeyDown={(e) => { if (e.key === "Enter") { renameT3(area, sn, tn, e.target.value); e.target.blur(); } else if (e.key === "Escape") { e.target.value = tn; e.target.blur(); } }} onBlur={(e) => renameT3(area, sn, tn, e.target.value)} /><button title="Delete zone / room" onClick={() => delT3(area, sn, tn)}><Icon n="trash" s={12} /></button></div>)}
                      <div className="lk-add"><input className="lk-in" placeholder="Add zone / room…" value={t3Input[k] || ""} onChange={(e) => setT3Input({ ...t3Input, [k]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addT3(area, sn)} /><button className="lk-btn" onClick={() => addT3(area, sn)}><Icon n="plus" s={14} /></button></div>
                    </div>
                  </div>; })}
                  <div className="lk-add"><input className="lk-in" placeholder="Add level (floor)…" value={subInput[area] || ""} onChange={(e) => setSubInput({ ...subInput, [area]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addSub(area)} /><button className="lk-btn" onClick={() => addSub(area)}><Icon n="plus" s={15} /></button></div>
                </div>
              </div>;
            })}</div>
            <div className="lk-add"><input className="lk-in" placeholder="Add building…" value={nv} onChange={(e) => setNv(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addList("areas", "area")} /><button className="lk-btn primary" onClick={() => addList("areas", "area")}><Icon n="plus" s={15} /></button></div>
          </>}
          {tab === "users" && <>
            <div className="lk-ufilter">
              <div className="lk-f" style={{ minWidth: 150, flex: 1 }}><label>Search</label><input className="lk-in" placeholder="Name or email…" value={uq} onChange={(e) => setUq(e.target.value)} /></div>
              <div className="lk-f" style={{ minWidth: 150 }}><label>Company</label><select className="lk-select" value={uCo} onChange={(e) => setUCo(e.target.value)}><option value="all">All companies</option><option value="none">No company</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="lk-f" style={{ minWidth: 100 }}><label>Role</label><select className="lk-select" value={uRole} onChange={(e) => setURole(e.target.value)}><option value="all">All roles</option><option value="member">Members</option><option value="admin">Admins</option></select></div>
            </div>
            {(() => {
              const cn = (id) => (S.companies.find((c) => c.id === id) || {}).name || "";
              const q = uq.trim().toLowerCase();
              const filtered = S.users.filter((u) => {
                if (uRole !== "all" && u.role !== uRole) return false;
                if (uCo === "none") { if (u.companyId) return false; } else if (uCo !== "all" && u.companyId !== uCo) return false;
                if (q && !(`${u.name || ""} ${cn(u.companyId)}`.toLowerCase().includes(q))) return false;
                return true;
              });
              const groups = {};
              filtered.forEach((u) => { const key = u.role === "admin" ? "\u0000Admins" : (cn(u.companyId) || "\uffffNo company"); (groups[key] = groups[key] || []).push(u); });
              const renderRow = (u) => <div key={u.id} className="lk-li">
                <input className="lk-in" key={u.id + ":" + u.name} defaultValue={u.name} title={u.id === S.currentUserId ? "Your display name" : "Display name"} placeholder="Name"
                  style={{ flex: "1 1 96px", minWidth: 80, padding: "5px 8px", fontSize: 12, border: u.id === S.currentUserId ? "1px solid var(--accent)" : undefined }}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== u.name) userOp({ op: "update", id: u.id, name: v }).then(() => setUserMsg("Name updated")).catch((x) => setUserMsg("Failed: " + (x.message || x))); }} />
                <select className="lk-select" style={{ width: 86, padding: "5px 7px", fontSize: 11.5 }} value={u.role} onChange={(e) => userOp({ op: "update", id: u.id, role: e.target.value, company_id: e.target.value === "admin" ? null : u.companyId }).catch((x) => setUserMsg("Failed: " + (x.message || x)))}><option value="member">Member</option><option value="admin">Admin</option></select>
                <select className="lk-select" style={{ flex: 1, minWidth: 70, padding: "5px 7px", fontSize: 11.5 }} value={u.companyId || ""} disabled={u.role === "admin"} onChange={(e) => userOp({ op: "update", id: u.id, company_id: e.target.value }).catch((x) => setUserMsg("Failed: " + (x.message || x)))}><option value="">--</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <button title="Get a fresh set-password link" onClick={() => sendLink(u.id, u.name)} style={{ fontSize: 13, lineHeight: 1 }}>🔗</button>
                <button title="Reset password" onClick={() => resetPw(u.id, u.name)} style={{ fontSize: 14, lineHeight: 1 }}>↻</button>
                {u.id !== S.currentUserId && <button title="Remove user" onClick={() => delUser(u.id, u.name)}><Icon n="trash" s={14} /></button>}
              </div>;
              if (!filtered.length) return <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>No users match these filters.</div>;
              return Object.keys(groups).sort().map((k) => { const open = !!openGroups[k] || !!q; return <div key={k} className="lk-ugroup">
                <button className="lk-ughead" style={{ borderBottom: open ? "1px solid var(--line)" : 0 }} onClick={() => setOpenGroups((g) => ({ ...g, [k]: !g[k] }))}>
                  <span className="chev" style={{ transform: open ? "rotate(90deg)" : "none" }}>{"\u25B6"}</span>
                  {k === "\u0000Admins" ? "Admins" : (k === "\uffffNo company" ? "No company" : k)} <span className="cnt">({groups[k].length})</span>
                </button>
                {open && <div className="lk-list" style={{ padding: "4px 8px" }}>{groups[k].map(renderRow)}</div>}
              </div>; });
            })()}
            <div className="lk-f"><label>Add user (email required)</label><input className="lk-in" placeholder="Email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></div>
            <div className="lk-f"><input className="lk-in" placeholder="Name (optional)" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></div>
            <div className="lk-row">
              <select className="lk-select" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}><option value="member">Member</option><option value="admin">Admin</option></select>
              <select className="lk-select" value={nu.companyId} disabled={nu.role === "admin"} onChange={(e) => setNu({ ...nu, companyId: e.target.value })}>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <button className="lk-btn primary" onClick={addUser}><Icon n="plus" s={15} />Create user</button>
            {newCred && <div style={{ marginTop: 8, padding: 11, border: "1px solid var(--accent)", borderRadius: 8, background: "var(--chipbg)", fontSize: 12.5 }}>
              <div style={{ fontWeight: 700, marginBottom: 5 }}>{newCred.title}. Share with the person:</div>
              <div style={{ marginBottom: 2 }}>User: <span className="mono" style={{ userSelect: "all" }}>{newCred.who}</span></div>
              {newCred.link && <div style={{ marginBottom: 2, wordBreak: "break-all" }}>Set-password link: <span className="mono" style={{ userSelect: "all" }}>{newCred.link}</span></div>}
              {newCred.pw && <div>Temporary password: <span className="mono" style={{ userSelect: "all", fontWeight: 700 }}>{newCred.pw}</span></div>}
              <button className="lk-btn" style={{ marginTop: 8 }} onClick={() => { try { navigator.clipboard.writeText(newCred.link ? `Email: ${newCred.who}\nSet your DLP password: ${newCred.link}` : `Site: ${window.location.origin}\nEmail: ${newCred.who}\nPassword: ${newCred.pw}`); setUserMsg("Copied to clipboard"); } catch (e) { setUserMsg("Copy not available; select the text manually."); } }}><Icon n="download" s={13} />Copy {newCred.link ? "invite" : "login"} details</button>
              <button className="lk-btn" style={{ marginTop: 8, marginLeft: 6 }} onClick={() => setNewCred(null)}>Done</button>
              <div style={{ marginTop: 7, color: "var(--muted)" }}>{newCred.link ? "The link lets them set their own password and signs them straight in. It is valid for 30 days; use the link button on their row to issue a fresh one. No email is sent automatically." : "They can keep this password. To issue a new one later, use the ↻ button on their row. No email is sent."}</div>
            </div>}
            {userMsg && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>{userMsg}</div>}
            <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <div className="lk-f"><label>Bulk add users</label>
                <textarea className="lk-in" rows={5} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={"One per line:  email, name, role, company\njdoe@acme.com, John Doe, member, ABB\nmsmith@acme.com, Mary Smith, member, Schneider"} style={{ resize: "vertical", minHeight: 92, fontFamily: "inherit" }} /></div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 8 }}>Format per line: email, name, role, company. Role is member or admin (defaults to member). Company must match a contractor name exactly; leave blank for admins. Each person gets their own set-password link (and a fallback temporary password) in the downloadable CSV. No email is sent from here, mail-merge the CSV from Outlook.</div>
              <button className="lk-btn primary" disabled={bulkBusy} onClick={bulkCreate}>{bulkBusy ? `Creating… (${(bulkResults || []).length})` : "Create all"}</button>
              {bulkResults && <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{bulkResults.filter((r) => r.status.startsWith("Created")).length} created, {bulkResults.filter((r) => !r.status.startsWith("Created")).length} need attention</div>
                <div className="lk-list" style={{ maxHeight: 200, overflow: "auto" }}>{bulkResults.map((r, i) => <div key={i} className="lk-li" style={{ fontSize: 11 }}><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{r.email}</span><span style={{ fontSize: 10, color: r.status.startsWith("Created") ? (r.link ? "var(--muted)" : "#E0A106") : "#C0392B" }}>{r.status.startsWith("Created") ? (r.link ? "link ready" : "no link") : r.status}</span></div>)}</div>
                <button className="lk-btn" style={{ marginTop: 8 }} disabled={bulkBusy} onClick={downloadBulk}><Icon n="download" s={13} />Download logins CSV (links + passwords)</button>
              </div>}
            </div>
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
            <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>JSON sets up the whole project: companies, buildings, levels, zones/rooms, systems, Cx stages, settings and activities. CSV imports activities and auto-creates any new company, building, level, zone/room or system it names, so a CSV alone can stand a project up. Columns are Building, Level, Zone / Room and Cx Stage. Override replaces, Append merges.</div>
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
    </div>);
}

function ConstraintsPage({ S, update, canEdit, coName, onOpen }) {
  const [co, setCo] = useState("all");
  const [ar, setAr] = useState("all");
  const [openOnly, setOpenOnly] = useState(true);
  const [q, setQ] = useState("");
  const toggle = (actId, cId) => update((p) => ({ ...p, activities: p.activities.map((a) => a.id === actId ? { ...a, constraints: a.constraints.map((c) => c.id === cId ? { ...c, done: !c.done } : c) } : a) }), { action: "Update constraint" });
  const rows = [];
  S.activities.forEach((a) => {
    if (co !== "all" && a.companyId !== co) return;
    if (ar !== "all" && a.area !== ar) return;
    (a.constraints || []).forEach((c) => {
      if (openOnly && c.done) return;
      if (q && !(`${a.desc} ${c.text}`.toLowerCase().includes(q.toLowerCase()))) return;
      rows.push({ a, c });
    });
  });
  rows.sort((x, y) => (x.a.start || "").localeCompare(y.a.start || ""));
  const totalOpen = S.activities.reduce((n, a) => n + (a.constraints || []).filter((c) => !c.done).length, 0);
  const exportCsv = () => { const headers = ["Activity", "Company", "Location code", "Building", "Level", "Zone / Room", "Cx Stage", "Planned start", "Constraint", "Status"]; const data = rows.map(({ a, c }) => [a.desc, coName(a.companyId), [(S.brand && S.brand.projectName) || "FIN04", a.area, a.subArea, a.tier3].filter(Boolean).join("."), a.area, a.subArea || "", a.tier3 || "", a.level, a.start, c.text, c.done ? "Cleared" : "Open"]); downloadFile(`FIN04-constraints-${fmtISO(new Date())}.csv`, toCSV(headers, data)); };
  return (
    <div className="lk-rep">
      <div className="sub" style={{ marginTop: 2 }}>Every make-ready constraint across the project. Tick one to clear it; the board updates straight away.</div>
      <div className="lk-rep-filters">
        <div className="lk-f" style={{ minWidth: 150 }}><label>Company</label><select className="lk-select" value={co} onChange={(e) => setCo(e.target.value)}><option value="all">All companies</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 150 }}><label>Building</label><select className="lk-select" value={ar} onChange={(e) => setAr(e.target.value)}><option value="all">All buildings</option>{S.areas.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 180 }}><label>Search</label><input className="lk-in" placeholder="Activity or constraint…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className={"lk-btn" + (openOnly ? " on" : "")} onClick={() => setOpenOnly((v) => !v)}>{openOnly ? "Open only" : "Showing all"}</button>
        <button className="lk-btn" onClick={exportCsv}><Icon n="download" s={14} />Export</button>
      </div>
      <div className="lk-rep-sec" style={{ padding: 0, overflow: "auto" }}>
        <table className="lk-tbl"><thead><tr><th style={{ width: 34 }} /><th>Activity</th><th>Company</th><th>Location</th><th>Cx Stage</th><th>Start</th><th>Constraint</th></tr></thead>
          <tbody>
            {rows.map(({ a, c }) => <tr key={a.id + c.id}>
              <td><input type="checkbox" checked={c.done} disabled={!canEdit(a)} onChange={() => toggle(a.id, c.id)} /></td>
              <td><span className="lnk" onClick={() => onOpen(a)}>{a.desc || "Untitled"}</span></td>
              <td>{coName(a.companyId)}</td>
              <td className="mono">{[(S.brand && S.brand.projectName) || "FIN04", a.area, a.subArea, a.tier3].filter(Boolean).join(".")}</td>
              <td>{a.level}</td>
              <td className="mono">{a.start}</td>
              <td className={c.done ? "lk-cdone" : ""}>{c.text}</td>
            </tr>)}
            {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 14, color: "var(--muted)" }}>No constraints match these filters.</td></tr>}
          </tbody></table>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{rows.length} shown · {totalOpen} open across the whole project</div>
    </div>);
}

function HelpPage() {
  return (
    <div className="lk-help">
      <iframe title="DLP Board Quick Reference" src="help.html" />
    </div>
  );
}

function Gauge({ value, size = 150, label = "PPC" }) {
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  const frac = value == null ? 0 : Math.max(0, Math.min(1, value / 100));
  const col = value == null ? "var(--muted)" : value >= 80 ? "#0E9384" : value >= 50 ? "#D97706" : "#C0392B";
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--hover)" strokeWidth="14" />
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} />
    <text x={cx} y={cy + 4} textAnchor="middle" fontSize={size * 0.27} fontWeight="700" fill="var(--ink)" fontFamily="inherit">{value == null ? "\u2014" : value + "%"}</text>
    <text x={cx} y={cy + size * 0.19} textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="inherit" style={{ letterSpacing: "0.12em" }}>{label}</text>
  </svg>;
}
function Donut({ data, size = 150 }) {
  const total = data.reduce((s, d) => s + d.n, 0);
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r; let off = 0;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--hover)" strokeWidth="14" />
    {total > 0 && data.filter((d) => d.n > 0).map((d, i) => { const frac = d.n / total; const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="14" strokeDasharray={`${C * frac} ${C}`} strokeDashoffset={-C * off} transform={`rotate(-90 ${cx} ${cy})`} />; off += frac; return el; })}
    <text x={cx} y={cy} textAnchor="middle" fontSize={size * 0.27} fontWeight="700" fill="var(--ink)" fontFamily="inherit">{total}</text>
    <text x={cx} y={cy + size * 0.16} textAnchor="middle" fontSize="10.5" fill="var(--muted)" fontFamily="inherit">activities</text>
  </svg>;
}
function Trend({ points, h = 168 }) {
  const w = Math.max(440, points.length * 60);
  const padL = 26, padR = 14, padT = 14, padB = 24, iw = w - padL - padR, ih = h - padT - padB;
  const xs = (i) => padL + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const ys = (v) => padT + ih - (v / 100) * ih;
  const valid = points.map((p, i) => ({ ...p, i })).filter((p) => p.value != null);
  const line = valid.map((p, k) => `${k === 0 ? "M" : "L"}${xs(p.i)},${ys(p.value)}`).join(" ");
  const area = valid.length ? `${line} L${xs(valid[valid.length - 1].i)},${padT + ih} L${xs(valid[0].i)},${padT + ih} Z` : "";
  return <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ height: "auto", display: "block" }}>
    <defs><linearGradient id="ppcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
    {[0, 25, 50, 75, 100].map((g) => <g key={g}><line x1={padL} y1={ys(g)} x2={w - padR} y2={ys(g)} stroke="var(--line)" strokeWidth="1" /><text x={2} y={ys(g) + 3} fontSize="9" fill="var(--muted)" fontFamily="inherit">{g}</text></g>)}
    {area && <path d={area} fill="url(#ppcg)" />}
    {line && <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
    {valid.map((p) => <circle key={p.i} cx={xs(p.i)} cy={ys(p.value)} r="3.5" fill="var(--accent)" />)}
    {points.map((p, i) => <text key={i} x={xs(i)} y={h - 7} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="inherit">{p.label}</text>)}
  </svg>;
}
const RepBar = ({ label, n, max, color }) => <div className="lk-bar-row"><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span><div className="lk-bar-track"><div className="lk-bar-fill" style={{ width: `${Math.round((n / max) * 100)}%`, background: color || "var(--accent)" }} /></div><span className="n">{n}</span></div>;

function ReportsPage({ S, LV, coName, exportActivities, exportWitness }) {
  const [co, setCo] = useState("all");
  const [ar, setAr] = useState("all");
  const [lv, setLv] = useState("all");
  const acts = S.activities.filter((a) => (co === "all" || a.companyId === co) && (ar === "all" || a.area === ar) && (lv === "all" || a.level === lv));
  const openOf = (a) => (a.constraints || []).filter((c) => !c.done).length;
  const isDelayed = (a) => { if (!a.start) return false; const ps = parseD(a.start); const pf = addDays(ps, (a.duration || 1) - 1); if (a.status === "complete" && a.actualFinish) return parseD(a.actualFinish) > pf; if (a.actualStart) return parseD(a.actualStart) > ps; return false; };
  const committed = acts.filter((a) => a.committed);
  const ppc = committed.length ? Math.round(committed.filter((a) => a.status === "complete").length / committed.length * 100) : null;
  const complete = acts.filter((a) => a.status === "complete").length;
  const cards = [
    { v: acts.length, l: "Total activities" },
    { v: committed.length, l: "Committed" },
    { v: complete, l: "Complete", c: "#0E9384" },
    { v: acts.filter((a) => a.status === "in_progress").length, l: "In progress" },
    { v: acts.filter((a) => openOf(a) === 0 && a.status !== "complete").length, l: "Ready to run", c: "#0E9384" },
    { v: acts.filter((a) => openOf(a) > 0 && a.status !== "complete").length, l: "Need make-ready", c: "#D97706" },
    { v: acts.filter(isDelayed).length, l: "Delayed", c: "#C0392B" },
    { v: acts.filter((a) => a.witnessInvite).length, l: "Witness required", c: "#5B33C7" },
  ];
  const byCompany = S.companies.map((c) => ({ name: c.name, n: acts.filter((a) => a.companyId === c.id).length, open: acts.filter((a) => a.companyId === c.id).reduce((s, a) => s + openOf(a), 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const byLevel = Object.keys(LV).map((k) => ({ name: `${k} ${LV[k].name}`, color: LV[k].color, n: acts.filter((a) => a.level === k).length })).filter((x) => x.n > 0);
  const statusData = [{ k: "planned", name: "Planned", color: "#94A3B8" }, { k: "in_progress", name: "In progress", color: "#2563EB" }, { k: "complete", name: "Complete", color: "#0E9384" }].map((s) => ({ ...s, n: acts.filter((a) => a.status === s.k).length }));
  const maxCo = Math.max(1, ...byCompany.map((x) => x.n));
  const maxLv = Math.max(1, ...byLevel.map((x) => x.n));
  // weekly PPC trend, committed activities grouped by the week of their planned finish
  const finishOf = (a) => addDays(parseD(a.start), (a.duration || 1) - 1);
  const withDates = acts.filter((a) => a.start);
  const points = [];
  if (withDates.length) {
    let cur = mondayOf(new Date(Math.min(...withDates.map((a) => parseD(a.start).getTime()))));
    const end = mondayOf(new Date(Math.max(...withDates.map((a) => finishOf(a).getTime()))));
    let guard = 0;
    while (cur.getTime() <= end.getTime() && guard < 60) {
      const wk = new Date(cur);
      const due = withDates.filter((a) => mondayOf(finishOf(a)).getTime() === wk.getTime());
      const comm = due.filter((a) => a.committed);
      points.push({ label: "W" + isoWeek(wk), value: comm.length ? Math.round(comm.filter((a) => a.status === "complete").length / comm.length * 100) : null });
      cur = addDays(cur, 7); guard++;
    }
  }
  const hasTrend = points.some((p) => p.value != null);
  return (
    <div className="lk-rep">
      <div className="sub" style={{ marginTop: 2 }}>Project health across the whole plan, not just the lookahead window. Filter, then export.</div>
      <div className="lk-rep-filters">
        <div className="lk-f" style={{ minWidth: 150 }}><label>Company</label><select className="lk-select" value={co} onChange={(e) => setCo(e.target.value)}><option value="all">All companies</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 150 }}><label>Building</label><select className="lk-select" value={ar} onChange={(e) => setAr(e.target.value)}><option value="all">All buildings</option>{S.areas.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 130 }}><label>Cx Stage</label><select className="lk-select" value={lv} onChange={(e) => setLv(e.target.value)}><option value="all">All Cx stages</option>{Object.keys(LV).map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
        <button className="lk-btn" onClick={exportActivities}><Icon n="download" s={14} />Export all activities</button>
        <button className="lk-btn" onClick={exportWitness}><Icon n="download" s={14} />Export witness invites</button>
      </div>
      <div className="lk-rep-sec" style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
        <Gauge value={ppc} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ marginBottom: 8 }}>Percent Plan Complete</h3>
          <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
            {committed.length ? <>Of <b style={{ color: "var(--ink)" }}>{committed.length}</b> committed activities, <b style={{ color: "#0E9384" }}>{committed.filter((a) => a.status === "complete").length}</b> are complete. PPC is the reliability of promises kept, the core Last Planner metric.</> : <>No activities are committed yet, so PPC cannot be calculated. Toggle "Committed for this week" on the promises your teams make, and this fills in.</>}
          </div>
        </div>
      </div>
      <div className="lk-rep-cards">
        {cards.map((c, i) => <div key={i} className="lk-rep-card"><span className="v" style={{ color: c.c || "var(--ink)" }}>{c.v}</span><span className="l">{c.l}</span></div>)}
      </div>
      <div className="lk-rep-sec"><h3>Weekly PPC trend</h3>{hasTrend ? <Trend points={points} /> : <div style={{ fontSize: 12, color: "var(--muted)" }}>Needs committed activities across weeks to plot a trend.</div>}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
        <div className="lk-rep-sec"><h3>Status mix</h3><div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}><Donut data={statusData} /><div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{statusData.map((s) => <div key={s.k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: s.color }} />{s.name}<span style={{ color: "var(--muted)" }}>{s.n}</span></div>)}</div></div></div>
        <div className="lk-rep-sec"><h3>Activities by company</h3>{byCompany.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted)" }}>No activities.</div> : byCompany.map((x) => <RepBar key={x.name} label={`${x.name}${x.open ? ` (${x.open} open)` : ""}`} n={x.n} max={maxCo} />)}</div>
      </div>
      <div className="lk-rep-sec"><h3>By Cx stage</h3>{byLevel.map((x) => <RepBar key={x.name} label={x.name} n={x.n} max={maxLv} color={x.color} />)}</div>
    </div>);
}

function UserImport({ S, cu, isAdmin, LV, update, onClose }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const parseCSV = (text) => { const rows = []; let row = [], cur = "", q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else { if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else if (c === "\r") {} else cur += c; } } if (cur !== "" || row.length) { row.push(cur); rows.push(row); } return rows; };
  const normDate = (s) => { if (!s) return ""; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = new Date(s); return isNaN(d) ? "" : fmtISO(d); };
  const normDT = (s) => { if (!s) return ""; const d = new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) ? s.replace(" ", "T") : s); if (isNaN(d)) return ""; const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const cellToStr = (v) => { if (v == null) return ""; if (v instanceof Date) { const p = (n) => String(n).padStart(2, "0"); const dd = `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`; const hh = v.getUTCHours(), mm = v.getUTCMinutes(); return (hh || mm) ? `${dd}T${p(hh)}:${p(mm)}` : dd; } if (typeof v === "object") { if (v.text != null) return String(v.text); if (v.result != null) return String(v.result); if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join(""); if (v.hyperlink) return String(v.hyperlink); return ""; } return String(v); };
  const colLetter = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const downloadTemplate = async () => {
    setBusy(true); setResult(null);
    try {
      const _xl = await import("exceljs/dist/exceljs.min.js"); const ExcelJS = _xl.default || _xl;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Activities");
      const lists = wb.addWorksheet("Lists"); lists.state = "veryHidden";
      const myCo = (S.companies.find((c) => c.id === cu.companyId) || {}).name || "";
      const co = myCo;
      const companyList = myCo ? [myCo] : [];
      const buildings = S.areas.slice();
      const levels = [...new Set((S.subAreas || []).map((s) => s.name))];
      const zones = [...new Set((S.tier3s || []).map((t) => t.name))];
      const systems = S.systems.slice();
      const stages = Object.keys(LV);
      [["Buildings", buildings], ["Levels", levels], ["Zones", zones], ["Systems", systems], ["Cx stages", stages], ["Companies", companyList]].forEach(([title, arr], cIdx) => { lists.getCell(1, cIdx + 1).value = title; arr.forEach((v, rIdx) => { lists.getCell(rIdx + 2, cIdx + 1).value = v; }); });
      const headers = ["Description", "Company", "Building", "Level", "Zone / Room", "Asset", "System", "Cx Stage", "Planned start", "Duration (d)", "Committed", "Witness invite", "Witness date & time", "Notes"];
      const exA = S.areas[0] || ""; const exSub = (S.subAreas || []).find((s) => s.area === exA); const exT3 = exSub ? (S.tier3s || []).find((t) => t.area === exA && t.subArea === exSub.name) : null;
      const sub = exSub ? exSub.name : ""; const t3 = exT3 ? exT3.name : ""; const sys = S.systems[0] || ""; const lv = stages[0] || "L2";
      const start = fmtISO(new Date()); const p = (n) => String(n).padStart(2, "0");
      const wit = (() => { const d = new Date(); d.setDate(d.getDate() + 5); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T09:00`; })();
      const ex1 = ["Example 1: terminate cables (DELETE before importing)", co, exA, sub, t3, "", sys, lv, start, 3, "No", "No", "", "Delete this example row"].filter((x) => x !== null);
      const ex2 = ["Example 2: MV switchgear test (DELETE before importing)", co, exA, sub, t3, "EPOD108.DB001.U003", sys, lv, start, 2, "Yes", "Yes", wit, "Asset is free text and optional. Witness invite Yes needs a date and time. Delete this row"].filter((x) => x !== null);
      ws.addRow(headers); ws.addRow(ex1); ws.addRow(ex2);
      ws.getRow(1).font = { bold: true };
      ws.columns.forEach((c, i) => { c.width = Math.max(12, String(headers[i] || "").length + 3); });
      const LAST = 300;
      [["Company", companyList.length, 6], ["Building", buildings.length, 1], ["Level", levels.length, 2], ["Zone / Room", zones.length, 3], ["System", systems.length, 4], ["Cx Stage", stages.length, 5]].forEach(([name, count, listCol]) => {
        const ci = headers.indexOf(name) + 1; if (ci < 1 || count < 1) return;
        const cl = colLetter(ci); const ll = colLetter(listCol);
        const allowBlank = name !== "Company";
        for (let r = 2; r <= LAST; r++) ws.getCell(`${cl}${r}`).dataValidation = { type: "list", allowBlank, formulae: [`Lists!$${ll}$2:$${ll}$${count + 1}`] };
      });
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "DLP-activity-import-template.xlsx"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) { setResult({ imported: 0, errors: ["Could not build the Excel template: " + (err && err.message ? err.message : "unknown error")] }); }
    setBusy(false);
  };
  const validate = (rows) => {
    rows = rows.filter((r) => r && r.length && r.some((c) => String(c == null ? "" : c).trim() !== ""));
    if (rows.length < 2) return { imported: 0, errors: ["The file has no activity rows under the header."] };
    const hdr = rows[0].map((h) => String(h == null ? "" : h).trim().toLowerCase());
    const idx = (names) => { for (const nm of names) { const i = hdr.findIndex((h) => h === nm || h.includes(nm)); if (i >= 0) return i; } return -1; };
    const ci = { desc: idx(["description", "activity description", "activity", "desc"]), company: idx(["company", "contractor"]), area: idx(["building", "area"]), subarea: idx(["level", "floor", "sub-area", "sub area", "subarea"]), tier3: idx(["zone", "room", "tier 3 area", "tier3 area", "tier 3", "tier3"]), asset: idx(["asset", "equipment", "tag"]), system: idx(["system"]), level: idx(["cx stage", "cx", "stage"]), ms: idx(["milestone"]), wit: idx(["witness invite", "witness"]), witat: idx(["witness date", "witness time", "witness at"]), notes: idx(["notes", "comment"]), pstart: idx(["planned start", "start"]), pfin: idx(["planned finish", "finish", "end"]), dur: idx(["duration", "days"]), status: idx(["status"]), commit: idx(["committed", "commit"]), cons: idx(["constraints", "constraint"]) };
    if (ci.desc < 0 || ci.area < 0 || ci.system < 0) return { imported: 0, errors: ["The header is missing one of Description, Building or System. Download the template and keep its header row."] };
    const areaMap = new Map(S.areas.map((a) => [a.toLowerCase(), a]));
    const sysMap = new Map(S.systems.map((s) => [s.toLowerCase(), s]));
    const subSet = new Set((S.subAreas || []).map((s) => `${s.area.toLowerCase()}|${s.name.toLowerCase()}`));
    const t3Set = new Set((S.tier3s || []).map((t) => `${t.area.toLowerCase()}|${t.subArea.toLowerCase()}|${t.name.toLowerCase()}`));
    const coByName = new Map(S.companies.map((c) => [c.name.toLowerCase(), c]));
    const myCoName = (S.companies.find((c) => c.id === cu.companyId) || {}).name || "";
    const lvKeys = Object.keys(LV);
    const yes = (v) => /^(y|yes|true|1)$/i.test(v);
    const errors = [], staged = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const g = (i) => (i >= 0 && i < row.length && row[i] != null ? String(row[i]).trim() : ""); const ln = r + 1; const e = [];
      const desc = g(ci.desc); if (!desc) e.push("missing Description");
      let companyId = cu.companyId; const coRaw = g(ci.company);
      if (coRaw) { const c = coByName.get(coRaw.toLowerCase()); if (!c) e.push(`company "${coRaw}" does not exist`); else if (c.id !== cu.companyId) e.push(`you can only import activities for your own company (${myCoName || "your company"})`); }
      if (!companyId) e.push("your account has no company assigned; ask an admin to set one before importing");
      const areaRaw = g(ci.area); let area = ""; if (!areaRaw) e.push("missing Building"); else { const m = areaMap.get(areaRaw.toLowerCase()); if (!m) e.push(`building "${areaRaw}" does not exist`); else area = m; }
      const subRaw = g(ci.subarea); let subArea = ""; if (subRaw) { if (area && subSet.has(`${area.toLowerCase()}|${subRaw.toLowerCase()}`)) subArea = subRaw; else e.push(`level "${subRaw}" does not exist under building "${areaRaw}"`); }
      const t3Raw = g(ci.tier3); let tier3 = ""; if (t3Raw) { if (area && subArea && t3Set.has(`${area.toLowerCase()}|${subArea.toLowerCase()}|${t3Raw.toLowerCase()}`)) tier3 = t3Raw; else e.push(`zone/room "${t3Raw}" does not exist under "${areaRaw}" / "${subRaw}"`); }
      const sysRaw = g(ci.system); let system = ""; if (!sysRaw) e.push("missing System"); else { const m = sysMap.get(sysRaw.toLowerCase()); if (!m) e.push(`system "${sysRaw}" does not exist`); else system = m; }
      const lvRaw = g(ci.level).toUpperCase(); let level = lvKeys[0] || "L2"; if (lvRaw) { if (lvKeys.includes(lvRaw)) level = lvRaw; else e.push(`Cx stage "${lvRaw}" is not one of ${lvKeys.join(", ")}`); }
      const start = normDate(g(ci.pstart)); const pfin = normDate(g(ci.pfin)); const durRaw = g(ci.dur);
      if (!start) e.push("missing or invalid Planned start (use YYYY-MM-DD)");
      let duration = 1; if (durRaw && +durRaw > 0) duration = +durRaw; else if (start && pfin) duration = Math.max(1, Math.round((parseD(pfin) - parseD(start)) / DAYMS) + 1);
      const witInvite = yes(g(ci.wit)); const witAt = normDT(g(ci.witat));
      if (witInvite && !witAt) e.push("Witness invite is Yes, so a valid Witness date & time is required (YYYY-MM-DD HH:MM)");
      const cons = g(ci.cons); const constraints = cons ? cons.split(";").map((x) => x.trim()).filter(Boolean).map((x) => ({ id: uid("c"), text: x.replace(/^\[[ xX]\]\s*/, ""), done: /^\[[xX]\]/.test(x) })) : [];
      if (e.length) { errors.push(`Row ${ln}: ${e.join("; ")}`); continue; }
      staged.push({ id: uid("a"), desc, companyId, area, subArea, tier3, asset: g(ci.asset), system, level, isMilestone: yes(g(ci.ms)), witnessInvite: witInvite, witnessAt: witInvite ? witAt : "", notes: g(ci.notes), start, duration, committed: yes(g(ci.commit)), status: (g(ci.status) || "planned").toLowerCase().replace(/\s+/g, "_"), actualStart: "", actualFinish: "", constraints });
    }
    if (errors.length) return { imported: 0, errors };
    if (!staged.length) return { imported: 0, errors: ["No activity rows found."] };
    update((p) => ({ ...p, activities: [...p.activities, ...staged] }), { action: "Import activities", detail: `${staged.length} rows` });
    return { imported: staged.length, errors: [] };
  };
  const onFile = async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    setBusy(true); setResult(null);
    try {
      const nm = f.name.toLowerCase(); let rows;
      if (nm.endsWith(".xlsx") || nm.endsWith(".xlsm")) {
        const _xl = await import("exceljs/dist/exceljs.min.js"); const ExcelJS = _xl.default || _xl;
        const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await f.arrayBuffer());
        const ws = wb.getWorksheet("Activities") || wb.worksheets[0]; rows = [];
        ws.eachRow({ includeEmpty: false }, (rw) => { const vals = rw.values; const arr = []; for (let i = 1; i < vals.length; i++) arr.push(cellToStr(vals[i])); rows.push(arr); });
      } else {
        rows = parseCSV(String(await f.text()).replace(/^\uFEFF/, ""));
      }
      setResult(validate(rows));
    } catch (err) { setResult({ imported: 0, errors: ["Could not read the file: " + (err && err.message ? err.message : "unknown error")] }); }
    setBusy(false); e.target.value = "";
  };
  return (
    <div className="lk-modal-bg" onClick={onClose}>
      <div className="lk-modal" style={cssVars(S.theme)} onClick={(e) => e.stopPropagation()}>
        <div className="lk-dh"><h3>Import activities</h3><button className="lk-btn icon" onClick={onClose}><Icon n="x" /></button></div>
        <div className="bd">
          <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>Bulk add activities from the Excel template. Everything you import is added under your own company.</div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>The rules</div>
            <ul>
              <li><b>Do not change the Company column.</b> It is pre-set to your company. Activities can only be imported for your own company; any other value is rejected.</li>
              <li>The <b>Excel template has dropdowns</b> for Building, Level, Zone / Room, System and Cx Stage, pre-loaded with this project's current values. Pick from them rather than typing.</li>
              <li><b>Those values must already exist</b> on the project. Anything that does not match is rejected, it is not created for you.</li>
              <li>Matching ignores case but the spelling must be exact. The dropdowns do not enforce which Level belongs to which Building, so the app still checks that on import.</li>
              <li>If any single row is invalid, <b>nothing is imported</b>. You get a list of what to fix, then re-upload.</li>
              <li>Dates use YYYY-MM-DD. Committed and Witness invite take Yes or No.</li>
              <li>If <b>Witness invite</b> is Yes, a <b>Witness date &amp; time</b> is required, format YYYY-MM-DD HH:MM (see example 2).</li>
              <li>The template has <b>two example rows</b>. Delete them and import only your own activities.</li>
              <li>Description, Building, System and Planned start are required on every row. You can upload the filled .xlsx, or a .csv if you prefer.</li>
            </ul>
          </div>
          <div className="ref"><b>Valid buildings</b>{S.areas.length ? S.areas.map((a) => <span key={a} className="lk-tag">{a}</span>) : <span style={{ color: "var(--muted)" }}>none defined yet</span>}</div>
          <div className="ref"><b>Valid levels (floors)</b>{(S.subAreas || []).length ? [...new Set((S.subAreas || []).map((s) => s.name))].map((n) => <span key={n} className="lk-tag">{n}</span>) : <span style={{ color: "var(--muted)" }}>none defined yet</span>}</div>
          <div className="ref"><b>Valid zones / rooms</b>{(S.tier3s || []).length ? [...new Set((S.tier3s || []).map((t) => t.name))].map((n) => <span key={n} className="lk-tag">{n}</span>) : <span style={{ color: "var(--muted)" }}>none defined yet</span>}</div>
          <div className="ref"><b>Valid systems</b>{S.systems.length ? S.systems.map((s) => <span key={s} className="lk-tag">{s}</span>) : <span style={{ color: "var(--muted)" }}>none defined yet</span>}</div>
          <div className="ref"><b>Valid Cx stages</b>{Object.keys(LV).map((k) => <span key={k} className="lk-tag">{k} {LV[k].name}</span>)}</div>
          <div className="lk-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button className="lk-btn" onClick={downloadTemplate} disabled={busy}><Icon n="download" s={14} />Download Excel template</button>
            <label className={"lk-btn primary" + (busy ? " disabled" : "")} style={{ cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}><Icon n="upload" s={14} />Choose file (.xlsx or .csv)<input type="file" accept=".xlsx,.xlsm,.csv" disabled={busy} style={{ display: "none" }} onChange={onFile} /></label>
            {busy && <span style={{ fontSize: 12, color: "var(--muted)" }}>Working…</span>}
          </div>
          {result && (result.errors.length
            ? <div className="lk-res-err"><b>Nothing was imported.</b> Fix {result.errors.length} row{result.errors.length === 1 ? "" : "s"} and upload again:<ul>{result.errors.map((er, i) => <li key={i}>{er}</li>)}</ul></div>
            : <div className="lk-res-ok">Imported {result.imported} activit{result.imported === 1 ? "y" : "ies"}. They are on your board now.</div>)}
        </div>
      </div>
    </div>);
}
