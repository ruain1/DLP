import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadAll, syncCollections, userOp, signOut, subscribeAll, updateBranding, uploadLogo, uploadCompanyLogo, applyBrandToTab, fetchUserStatus, heartbeat, loadPresence, fetchActivityAudit } from "./data";
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
.lk-colead{height:22px;max-width:96px;object-fit:contain;display:block;border-radius:3px}
.lk-pill{font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:5px}
.lk-pill.admin{background:#7C3AED;color:#fff}.lk-pill.member{background:var(--chipbg);color:var(--accent)}
.lk-metrics{display:flex;border-bottom:1px solid var(--line);background:var(--card);overflow-x:auto}
.lk-metric{padding:10px 20px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:2px;min-width:118px}
.lk-metric .v{font-size:21px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}
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
.lk-lanelogo{height:24px;max-width:124px;object-fit:contain;object-position:left center;display:block;margin-bottom:3px}
.lk-track{position:relative}
.lk-under{position:absolute;inset:0;display:grid;z-index:0}
.lk-cell{border-right:1px solid var(--line);cursor:cell}
.lk-cell.we{background:var(--weekend)}.lk-cell.tod{background:var(--todcell);border-left:2px solid var(--accent)}
.lk-cell:hover{background:var(--hover)}.lk-cell.nodrop{cursor:not-allowed}
.lk-tk{position:relative;z-index:1;display:grid;padding:6px 0;gap:6px;pointer-events:none}
.lk-ticket{pointer-events:auto;background:var(--card);border:1px solid var(--line);border-left-width:4px;border-radius:12px;
  padding:9px 12px 10px;font-size:12px;cursor:grab;overflow:hidden;box-shadow:none;min-width:0;
  display:flex;flex-direction:column;justify-content:flex-start;gap:3px;transition:box-shadow .12s,border-color .12s}
.lk-ticket:hover{box-shadow:0 3px 10px rgba(0,0,0,.16)}.lk-ticket:active{cursor:grabbing}
.lk-ticket.ro{cursor:default;border-style:dotted}
.lk-ticket .desc{flex:0 0 auto;font-weight:600;font-size:13px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lk-ticket .meta{flex:0 0 auto;font-size:10.5px;line-height:1.3;color:var(--muted);display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden}
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
.lk-chip.knock{background:#FBEFD6;color:#9A6A00;text-transform:none}
.lk-fc{align-self:stretch;margin:3px 2px;border:1.5px dashed #E0A106;background:rgba(224,161,6,.10);border-radius:6px;z-index:0;pointer-events:none}
.lk-ms{position:relative;pointer-events:auto;display:flex;align-items:center;justify-content:center;cursor:grab;overflow:visible;align-self:center;z-index:2}
.lk-ms .dia{width:12px;height:12px;transform:rotate(45deg);flex:none;border:1px solid rgba(0,0,0,.2)}
.lk-ms .mslbl{position:absolute;top:50%;left:calc(50% + 11px);transform:translateY(-50%);font-size:10.5px;font-weight:600;white-space:nowrap;pointer-events:none}
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
.lk-dh{display:flex;align-items:center;justify-content:space-between;padding:15px 18px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--paper);z-index:2;flex:none}
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
.lk-cstr2{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--line)}
.lk-cstr2>input[type=checkbox]{width:16px;height:16px;accent-color:var(--accent);margin-top:3px;flex:0 0 auto}
.lk-cstr2 .cmain{flex:1;display:flex;flex-direction:column;gap:5px;min-width:0}
.lk-cstr2 .cmain .t{font-weight:500}.lk-cstr2 .cmain .t.done{text-decoration:line-through;color:var(--muted)}
.lk-cstr2 .crow{display:flex;gap:6px;flex-wrap:wrap}
.lk-cstr2>button{border:0;background:transparent;color:var(--muted);cursor:pointer;margin-top:3px;flex:0 0 auto}
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
.lk-urow{display:grid;grid-template-columns:minmax(150px,1fr) 96px minmax(130px,1.2fr) 132px auto;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;padding:7px 10px;background:var(--card);font-size:12.5px}
.lk-urow button{border:0;background:transparent;color:var(--muted);cursor:pointer;padding:2px}
.lk-uacts{display:flex;align-items:center;gap:5px;justify-content:flex-end}
.lk-acc{display:flex;align-items:center;gap:7px;width:100%;background:transparent;border:0;cursor:pointer;color:var(--ink);font-weight:600;font-size:12.5px;padding:6px 0}
.lk-acc .car{font-size:11px;color:var(--muted);width:12px}
.lk-audhist{border:1px solid var(--line);border-radius:8px;background:var(--card);max-height:230px;overflow:auto;margin-top:2px}
.lk-audempty{padding:12px;font-size:12px;color:var(--muted)}
.lk-audrow{display:flex;flex-direction:column;gap:3px;padding:8px 11px;border-bottom:1px solid var(--line)}
.lk-audrow:last-child{border-bottom:0}
.lk-audtop{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center}
.lk-auddet{font-size:11px;color:var(--muted);line-height:1.45;word-break:break-word}
.lk-audact{font-weight:600;color:var(--ink);font-size:12px}
.lk-audwho{color:var(--muted);font-size:11.5px;white-space:nowrap}
.lk-audwhen{color:var(--muted);font-size:11px;white-space:nowrap}
.lk-audit{font-size:11.5px;display:flex;flex-direction:column;gap:1px;border-bottom:1px solid var(--line);padding:7px 0}
.lk-audit .a{font-weight:600}.lk-audit .m{color:var(--muted);font-size:10.5px}
.lk-shell{display:flex;min-height:100vh;padding-left:56px;transition:padding-left .14s ease}
.lk-shell.navopen{padding-left:212px}
.lk-rail{position:fixed;left:0;top:0;bottom:0;width:56px;background:#1d2530;z-index:50;display:flex;flex-direction:column;padding:14px 0;transition:width .14s ease}
.lk-rail.open{width:212px}
.lk-rail-inner{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;width:100%}
.lk-rail.open .lk-rail-inner{align-items:stretch;padding:0 12px}
.lk-rail button{width:40px;height:40px;border:0;border-radius:10px;background:transparent;color:#9aa7b8;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .12s,color .12s;flex-shrink:0}
.lk-rail.open button{width:100%;height:40px;justify-content:flex-start;gap:13px;padding:0 11px}
.lk-rail button:hover{background:#2a333f;color:#dfe6ef}
.lk-rail button.on{background:var(--accent);color:#fff}
.lk-rail button svg{flex-shrink:0}
.lk-rail .lbl{display:none}
.lk-rail.open .lbl{display:inline;font-size:13px;font-weight:600;white-space:nowrap}
.lk-railtog{color:#67768a!important;margin-bottom:6px}
.lk-railtog:hover{color:#dfe6ef!important}
.lk-railppc{text-align:center}
.lk-rail.open .lk-railppc{text-align:left;padding:0 13px}
.lk-barright{margin-left:auto;display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:flex-end}
.lk-rep-card.clickable{cursor:pointer;transition:border-color .12s,background .12s}
.lk-rep-card.clickable:hover{border-color:var(--accent);background:var(--hover)}
.lk-bar-row.clickable{cursor:pointer;border-radius:6px;transition:background .12s}
.lk-bar-row.clickable:hover{background:var(--hover)}
.ytt.drill{width:min(780px,96vw)}
.drill-body{overflow:auto;flex:1;padding:10px 12px}
.drill-row{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line);border-left:3px solid #64748B;border-radius:9px;background:var(--card);padding:8px 11px;margin-bottom:7px;cursor:pointer}
.drill-row:hover{background:var(--hover)}
.drill-main{min-width:0;display:flex;flex-direction:column;gap:2px}
.drill-desc{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.drill-sub{font-size:11px;color:var(--muted)}
.drill-tags{display:flex;align-items:center;gap:5px;flex-shrink:0}
@media print{
  body.rep-print .lk-rail,body.rep-print .lk-foot,body.rep-print .lk-rep-filters{display:none!important}
  body.rep-print .lk-bar button,body.rep-print .lk-bar .lk-who,body.rep-print .lk-bar .lk-barright{display:none!important}
  body.rep-print .lk-shell{padding-left:0!important}
  body.rep-print .lk-rep{max-width:none!important;padding:6px 12px!important}
  body.rep-print .lk-rep-sec,body.rep-print .lk-rep-card,body.rep-print .lk-rep-2col{break-inside:avoid}
}
.lk-page{flex:1;min-width:0;display:flex;flex-direction:column}
.lk-rep{padding:18px 22px;max-width:1400px}
.lk-adminwrap{max-width:780px;width:100%;padding:6px 22px 52px}
.lk-adminwrap .lk-db{padding:14px 0 0}
.lk-adminwrap .lk-tabs{padding:6px 0 0}
.lk-adminwrap2{display:flex;gap:24px;width:100%;padding:10px 22px 52px;align-items:flex-start}
.lk-subnav{flex:0 0 188px;display:flex;flex-direction:column;gap:14px;position:sticky;top:10px}
.lk-subnav .grp{display:flex;flex-direction:column;gap:2px}
.lk-subnav .grphd{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:0 8px 3px}
.lk-subnav button{text-align:left;border:1px solid transparent;background:transparent;color:var(--ink);border-radius:7px;padding:7px 10px;font-size:12.5px;font-weight:600;cursor:pointer}
.lk-subnav button:hover{background:var(--hover)}
.lk-subnav button.sel{background:var(--ink);color:var(--paper)}
.lk-subbody{flex:1;min-width:0;max-width:760px}
.lk-subbody.wide{max-width:1320px}
.lk-userwrap .lk-ufilter{position:sticky;top:62px;z-index:20;background:var(--paper);padding:10px 0 8px;margin-bottom:4px;border-bottom:1px solid var(--line)}
.lk-rep-2col{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
.cal-head{display:flex;align-items:center;gap:8px;padding:12px 14px}
.cal-head h3{font-size:15px;color:var(--ink)}
.ytt{background:var(--paper);color:var(--ink);width:min(1240px,96vw);max-height:92vh;margin:auto;border-radius:14px;border:1px solid var(--line);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.28)}
.ytt-head{display:flex;align-items:center;justify-content:space-between;padding:13px 18px;border-bottom:1px solid var(--line);flex-shrink:0}
.ytt-sub{font-size:11.5px;color:var(--muted);margin-left:4px}
.ytt-cols{display:grid;grid-template-columns:repeat(3,1fr);overflow:auto;flex:1}
.ytt-col{border-right:1px solid var(--line);display:flex;flex-direction:column;min-width:0}
.ytt-col:last-child{border-right:0}
.ytt-col.today{background:rgba(37,99,235,.045)}
.ytt-colhead{position:sticky;top:0;background:var(--card);border-bottom:1px solid var(--line);padding:10px 13px;display:flex;align-items:baseline;justify-content:space-between;z-index:1}
.ytt-lab{font-weight:800;font-size:13px;color:var(--ink)}
.ytt-col.today .ytt-lab{color:var(--accent)}
.ytt-date{font-size:11px;color:var(--muted)}
.ytt-list{padding:10px;display:flex;flex-direction:column;gap:9px}
.ytt-empty{font-size:12px;color:var(--muted);padding:8px 4px}
.ytt-card{border:1px solid var(--line);border-left:3px solid #64748B;border-radius:9px;background:var(--card);padding:9px 11px}
.ytt-card-desc{font-weight:700;font-size:13px;line-height:1.3;cursor:pointer}
.ytt-card-desc:hover{text-decoration:underline}
.ytt-card-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:5px;font-size:11px;color:var(--muted)}
.ytt-card-meta .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.ytt-loc{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ytt-cons{margin-top:8px;border-top:1px dashed var(--line);padding-top:7px;display:flex;flex-direction:column;gap:6px}
.ytt-con{display:flex;align-items:flex-start;gap:7px;font-size:12px;color:var(--ink);cursor:pointer;line-height:1.35}
.ytt-con input{margin-top:2px;flex-shrink:0}
.ytt-meta2{color:var(--muted)}
.ytt-due{color:#C0392B}
.ytt-ready{margin-top:7px;font-size:11px;font-weight:700;color:#0E9384}
@media (max-width:760px){.ytt-cols{grid-template-columns:1fr}.ytt-col{border-right:0;border-bottom:1px solid var(--line)}}
.cal-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:1px solid var(--line);border-left:1px solid var(--line)}
.cal-dow{padding:6px 8px;font-size:10.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;border-right:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--card)}
.cal-cell{min-height:104px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:4px;display:flex;flex-direction:column;gap:3px;background:var(--paper);min-width:0}
.cal-cell.off{background:var(--card);opacity:.5}
.cal-cell.today{background:rgba(37,99,235,.08)}
.cal-daynum{font-size:11px;font-weight:600;color:var(--muted)}
.cal-cell.today .cal-daynum{color:var(--accent);font-weight:800}
.cal-chip{display:block;width:100%;max-width:100%;text-align:left;border:0;border-left:3px solid #64748B;background:var(--hover);color:var(--ink);font-size:11px;line-height:1.3;padding:2px 5px;border-radius:4px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cal-more{font-size:10px;color:var(--muted);padding-left:3px}
.wl-wrap{padding:14px 16px}
.wl-bars{display:flex;align-items:flex-end;gap:10px;overflow-x:auto;padding:6px 2px 4px}
.wl-col{display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0}
.wl-stack{display:flex;flex-direction:column;width:30px;border-radius:5px 5px 0 0;overflow:hidden;background:var(--hover)}
.wl-seg{width:100%}
.wl-lab{font-size:10px;color:var(--muted);white-space:nowrap}
.wl-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;color:var(--ink)}
@media (max-width:860px){.lk-rep-2col{grid-template-columns:1fr}}
.lk-subbody .lk-db{padding:2px 0 0}
.lk-help{flex:1;min-height:0}
.lk-userwrap{display:flex;gap:18px;align-items:flex-start}
.lk-usermain{flex:1;min-width:0}
.lk-userside{width:300px;flex-shrink:0;position:sticky;top:74px}
.lk-online{border:1px solid var(--line);border-radius:12px;background:var(--card);overflow:hidden}
.lk-online-h{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid var(--line);font-weight:700;font-size:13px;color:var(--ink)}
.lk-online-now{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:700;color:#0E9F6E;background:rgba(16,185,129,.12);padding:3px 9px 3px 7px;border-radius:20px;text-transform:none;letter-spacing:0}
.lk-online-list{max-height:440px;overflow:auto}
.lk-online-row{display:flex;align-items:center;gap:9px;padding:8px 14px;border-bottom:1px solid var(--line);font-size:12.5px}
.lk-online-row:last-child{border-bottom:0}
.lk-online-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;color:var(--ink)}
.lk-online-time{font-size:11px;color:var(--muted);white-space:nowrap}
.lk-online-empty{padding:16px 14px;font-size:12px;color:var(--muted)}
.lk-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;display:inline-block}
.lk-dot.off{background:#F59E0B}
.lk-dot.on{background:#10B981;animation:lkpulse 2s infinite}
@keyframes lkpulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,.45)}70%{box-shadow:0 0 0 6px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}
@media (max-width:900px){.lk-userwrap{flex-direction:column}.lk-userside{width:100%;position:static}}
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
.lk-tblwrap{width:100%}
.lk-sch{width:100%;display:flex;flex-direction:column;height:calc(100vh - 110px)}
.lk-sch-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--card)}
.lk-sch-bar .grp{display:flex;flex-direction:column;gap:2px}
.lk-sch-bar .grp>label{font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700}
.lk-sch-bar .seg{display:flex;border:1px solid var(--line);border-radius:7px;overflow:hidden}
.lk-sch-bar .seg button{border:0;background:var(--card);color:var(--muted);padding:5px 11px;font-size:11.5px;font-weight:600;cursor:pointer}
.lk-sch-bar .seg button.on{background:var(--ink);color:var(--paper)}
.lk-sch-scroll{flex:1;overflow:auto;background:#fff}
.lk-tblscroll{overflow-x:auto;padding:8px 16px 64px}
.lk-grid{border-collapse:collapse;width:100%;font-size:11.5px;min-width:1040px}
.lk-grid th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;padding:8px 7px;border-bottom:1px solid var(--line);white-space:nowrap;position:sticky;top:0;background:var(--paper);z-index:1}
.lk-grid td{padding:4px 7px;border-bottom:1px solid var(--line);vertical-align:middle;color:var(--ink)}
.lk-grid tr.ed{background:var(--hover)}
.lk-grid td button{background:transparent;border:0;cursor:pointer;color:var(--muted);display:inline-flex;padding:3px;border-radius:6px}
.lk-grid td button:hover:not(:disabled){background:var(--hover);color:var(--ink)}
.lk-grid td button:disabled{cursor:not-allowed}
.lk-grid .lk-in,.lk-grid .lk-select{width:100%}
.lk-day.addday{position:relative;cursor:cell}
.lk-day.addday .addp{position:absolute;top:2px;right:3px;opacity:0;color:var(--accent);transition:opacity .12s;display:flex}
.lk-day.addday:hover .addp{opacity:1}
.lk-day.addday:hover{background:var(--hover)}
.lk-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:80;display:flex;align-items:flex-start;justify-content:center;padding:46px 16px;overflow:auto}
.lk-modal{background:var(--paper);border:1px solid var(--line);border-radius:14px;max-width:660px;width:100%;color:var(--ink);box-shadow:0 20px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;max-height:calc(100vh - 92px);overflow:hidden}
.rep-fld{margin-bottom:13px}.rep-fld>label{display:block;font-size:12px;font-weight:600;margin-bottom:6px}
.rep-mut{font-weight:400;color:var(--muted)}
.rep-seg{display:inline-flex;border:1px solid var(--line);border-radius:9px;overflow:hidden}
.rep-seg button{background:var(--paper);border:0;padding:8px 14px;font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer}
.rep-seg button.on{background:var(--accent);color:#fff}
.rep-hint{font-size:12px;color:var(--muted);margin:-4px 0 13px}
.rep-dates{display:flex;gap:12px;margin-bottom:13px}
.rep-sum{width:100%;resize:vertical;font-family:inherit;line-height:1.5}
.rep-check{display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer}
.rep-foot{display:flex;justify-content:flex-end;gap:10px;padding:14px 18px;border-top:1px solid var(--line)}
.lk-modal .bd{padding:18px 20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1 1 auto}
.lk-modal ul{margin:6px 0 0;padding-left:18px;font-size:12.5px;line-height:1.65;color:var(--ink)}
.lk-modal .ref{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-size:12px}
.lk-modal .ref b{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);display:block;margin-bottom:4px}
.lk-tag{display:inline-block;background:var(--chipbg);border:1px solid var(--line);border-radius:6px;padding:2px 7px;margin:2px 4px 2px 0;font-size:11.5px}
.lk-res-ok{background:#0E93841a;border:1px solid #0E9384;color:var(--ink);border-radius:9px;padding:10px 12px;font-size:12.5px}
.lk-res-err{background:#C0392B14;border:1px solid #C0392B;border-radius:9px;padding:10px 12px;font-size:12px}
.lk-res-err ul{max-height:200px;overflow:auto;color:#C0392B}
.lk-foot{flex-shrink:0;width:100%;margin-top:auto;border-top:1px solid var(--line);background:var(--paper);color:var(--muted);font-size:10.5px;line-height:1;padding:9px 18px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;

const I = {
  plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  grid: <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></>,
  gantt: <><line x1="4" y1="6" x2="13" y2="6"/><line x1="7" y1="12" x2="18" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/></>,
  pen: <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>,
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
const nextCode = (acts) => (acts || []).reduce((m, a) => Math.max(m, a.code || 0), 0) + 1;
const SLIP_REASONS = ["Prerequisite work incomplete", "Materials / equipment", "Labour / resources", "Design / information / RFI", "Access / permit / approval", "Weather / environment", "Rework / quality / defect", "Changed priorities", "Safety", "Other"];
const CHANGELOG = [
  { rev: "REV46", date: "2026-06-21", items: ["Schedule Gantt: clicking a bar or milestone now opens the activity card popup (like the Calendar and Workload views) instead of jumping straight to the Planning Board. Open the card to go to the board"] },
  { rev: "REV45", date: "2026-06-21", items: ["Fix: blank page on load introduced in REV44. The theme-aware customer logo was being read before data finished loading, which threw on first render. Now guarded"] },
  { rev: "REV44", date: "2026-06-21", items: ["Logos now support separate light-mode and dark-mode versions, for both the customer logo and each company logo. The board, headers and lane labels show the right one for the current theme. If you upload only one, it is used in both modes. Admin upload boxes preview the dark version on a dark background"] },
  { rev: "REV43", date: "2026-06-21", items: ["Planning Board: when grouped by Company, each swimlane label now shows the company logo (if uploaded) with the company name underneath"] },
  { rev: "REV42", date: "2026-06-21", items: ["Admin can upload a logo per company (Project setup, Companies). The logo replaces the company name text in the header beside each user's name, between the name and Sign out. Remove the logo to fall back to the text"] },
  { rev: "REV41", date: "2026-06-21", items: ["Planning Board swimlane grouping now offers Level and Zone instead of Building (Building only appears when a project has more than one building); dragging a card between Level or Zone lanes re-tags its Level or Zone", "Import window: the title bar now stays fixed to the top of the popup and only the content below it scrolls, instead of the banner sticking to the browser window"] },
  { rev: "REV40", date: "2026-06-21", items: ["Admin Users: new Invite filter (All, Pending, Accepted) to quickly find who still has not accepted their invite"] },
  { rev: "REV39", date: "2026-06-21", items: ["Light/dark theme toggle now sits next to your name on every page, not just the Planning Board", "Admin: the Project setup submenu Settings is now called Lookahead (lookahead length and make-ready window)"] },
  { rev: "REV38", date: "2026-06-20", items: ["New admin-only Weekly DLP Report on the Analytics page: one click opens a styled, print-ready report (PPC and promise reliability, open constraints with owners and need-by dates, non-completion reasons, by contractor, by Cx stage, committed next week, milestones) built from live data, ready to Save as PDF", "Report config window: defaults to the week just ended, optional custom date range, an auto-drafted editable executive summary, and an optional 4 week schedule snapshot"] },
  { rev: "REV37", date: "2026-06-20", items: ["Schedule Calendar and Workload now open the same drill-down popup as Analytics: click a calendar day or a workload bar (or a company segment) to list those activities, then click one to open it", "Workload bars and segments are now interactive"] },
  { rev: "REV36", date: "2026-06-20", items: ["Per-activity audit history now records what actually changed on each edit (field by field, old value to new value) instead of a generic Edit activity; needs the activity-audit-detail.sql migration"] },
  { rev: "REV35", date: "2026-06-20", items: ["Milestone diamonds now sit centred in their day column instead of on the left gridline, so they read on the correct day", "Board metric numbers use the same font as Analytics (no more slashed zeros)"] },
  { rev: "REV34", date: "2026-06-20", items: ["Hardened predecessor logic: a link only orders work and can push a successor later if needed; it can never pull a successor earlier than its own planned start, and the card always sits on its planned date"] },
  { rev: "REV33", date: "2026-06-20", items: ["Planning board activity cards restyled to match the Analytics cards: same rounded corners, flat resting card, roomier padding and text scale, keeping the coloured Cx-stage edge"] },
  { rev: "REV32", date: "2026-06-20", items: ["Analytics is now interactive: click any KPI card, the PPC gauge, a trend point, a reason, a status segment, a company or a Cx stage to open a drill-down listing the exact activities behind that number; click an activity there to jump into it"] },
  { rev: "REV31", date: "2026-06-20", items: ["Analytics gained download options: a multi-sheet Excel of the metrics behind every chart (PPC, KPIs, weekly trend, reasons, by company, by Cx stage, status mix) and a Print to PDF of the dashboard, both honouring the active filters"] },
  { rev: "REV30", date: "2026-06-20", items: ["Sidebar PPC now left-aligns when the menu is expanded", "The Activity button stays pinned to the right of the board bar instead of wrapping to the left"] },
  { rev: "REV29", date: "2026-06-20", items: ["Sidebar now shows section labels beside each icon and collapses back to icons only, remembered across refreshes", "Order changed so Constraints Log sits above Schedule; Reports relabelled Analytics; Schedule tooltip no longer mentions Gantt"] },
  { rev: "REV28", date: "2026-06-20", items: ["Admin-only audit history on each activity: a collapsible section under Notes in the editor showing who created, edited or touched that activity and when"] },
  { rev: "REV27", date: "2026-06-20", items: ["Add-constraint button restyled to the blue primary look matching Save", "Activity editor titles set in Title Case (New Activity, Edit Activity)"] },
  { rev: "REV26", date: "2026-06-20", items: ["Building is now locked for members in the activity editor (fixed for the project); admins can still change it", "Admins can create a new Level, Zone, System or Company inline from the activity editor without leaving the popout"] },
  { rev: "REV25", date: "2026-06-20", items: ["User management rows aligned onto a fixed grid so name, role, company, status and actions line up column to column"] },
  { rev: "REV24", date: "2026-06-20", items: ["YTT stand-up panel renamed YTT Focus", "Clearing a constraint from YTT Focus is now admin-only"] },
  { rev: "REV23", date: "2026-06-20", items: ["Reports gained a Period filter: all time or a custom date range, scoping every metric, card and chart; the weekly trend clips to the range"] },
  { rev: "REV22", date: "2026-06-20", items: ["New YTT Focus button on the board: a yesterday/today/tomorrow stand-up panel listing each day's activities with their open constraints, ticked off in place; yesterday flags missed commitments"] },
  { rev: "REV21", date: "2026-06-20", items: ["Schedule page is now a suite with a view switcher", "New Calendar (month) view", "New Workload view: activities per week stacked by company to spot over-commitment"] },
  { rev: "REV20", date: "2026-06-20", items: ["User management tables widened and the user search and filters stay frozen while scrolling", "Reports laid out as a two-column dashboard to fill the page"] },
  { rev: "REV19", date: "2026-06-20", items: ["Constraints log now uses the full page width", "Page titles enlarged and set in Title Case"] },
  { rev: "REV18", date: "2026-06-20", items: ["A page refresh keeps you on the current view instead of dropping back to the board"] },
  { rev: "REV17", date: "2026-06-20", items: ["Latest online: a live presence panel in admin showing who is online now and everyone's last-online time, driven by a lightweight heartbeat"] },
  { rev: "REV16", date: "2026-06-19", items: ["The footer is a proper full-width bar on every page rather than a floating badge that overlapped content"] },
  { rev: "REV15", date: "2026-06-19", items: ["Refreshed, wider in-app Help page that follows light and dark mode"] },
  { rev: "REV14", date: "2026-06-19", items: ["Constraints log date and owner columns widened so they no longer wrap", "Admin Changelog added under a new About section"] },
  { rev: "REV13", date: "2026-06-19", items: ["JSON project import now opens a review screen: overwrite, ignore or clone each clashing item, with a global default and per-section bulk actions", "Company references and predecessor links from the file are remapped on import; cloned Cx stages carry their activities onto the new key", "Override import still replaces the whole project wholesale"] },
  { rev: "REV12", date: "2026-06-19", items: ["Admin Import / Export got its own importer, separate from the member one: set Company per row to load work for every contractor at once", "Admin Excel template with dropdowns that allow new values, which are created on import; admin importer now reads .xlsx directly", "Witness date and time now import from CSV and Excel"] },
  { rev: "REV11", date: "2026-06-19", items: ["Reason for non-completion stays editable on a late-but-complete activity, the one exception to the complete-lock"] },
  { rev: "REV10", date: "2026-06-19", items: ["Completed activities lock on every field except status; an admin reopens by setting status back", "Witness and Witness time added as table columns; column choice plus filters can be saved as your default view", "Cx stages are now add and delete, not just rename; systems are renamable and migrate their activities", "Audit log gained a search box; help page dark mode fixed for the sample card and chips"] },
  { rev: "REV9", date: "2026-06-19", items: ["Constraints log gained inline editing of wording, owner and need-by", "Activity table gained show/hide columns and Building and Cx Stage filters", "Schedule and Help now follow dark mode"] },
  { rev: "REV8", date: "2026-06-19", items: ["Reasons for non-completion captured on misses and charted as a Pareto in Reports", "PPC tightened to on-time completion across the gauge and weekly trend", "Activity short-codes (#N) now assigned by a database sequence and immutable, removing collision risk"] },
  { rev: "REV7", date: "2026-06-19", items: ["Schedule fixes: dependency arrows draw over group headers (dashed across groups), collapsed groups show a rollup summary bar, responsible label no longer clashes with link arrows, routing handles reordered rows"] },
  { rev: "REV6", date: "2026-06-19", items: ["New P6-style Schedule (Gantt) view: day/week/month zoom, grouping, colour-by, dependency arrows, forecast tail, responsible labels", "Exports to PNG, JPG, PDF and Excel"] },
  { rev: "REV5", date: "2026-06-19", items: ["Constraint owner and need-by date added throughout, with overdue highlighting", "At-risk metric tile for predecessor knock-on"] },
  { rev: "REV4", date: "2026-06-19", items: ["Predecessors and non-destructive forecast: a slip upstream shows a dashed knock-on overlay without moving the baseline", "Activity short-codes, prepopulated single building, foldable audit log", "Settings reorganised into a left sub-navigation; users show accepted/pending and last-seen with a jump to their audit trail", "New Activity table (spreadsheet) view with per-row inline editing"] },
  { rev: "REV1-REV3", date: "2026-06-19", items: ["Day-by-day four-week Last Planner board with swimlanes, make-ready readiness, committed promises and witness flags", "Admin-configurable branding, Cx stages, systems, three-tier locations and companies", "User management: direct create, bulk CSV with set-password links, resets; Supabase auth, RLS, realtime and a secured admin edge function", "CSV and JSON import/export with downloadable templates; database-written, tamper-proof audit log"] },
];
const relTime = (iso) => { if (!iso) return ""; const d = new Date(iso); const s = Math.floor((Date.now() - d.getTime()) / 1000); if (s < 60) return "just now"; const m = Math.floor(s / 60); if (m < 60) return m + "m ago"; const h = Math.floor(m / 60); if (h < 24) return h + "h ago"; const dd = Math.floor(h / 24); if (dd < 30) return dd + "d ago"; return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
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
  const [ytt, setYtt] = useState(false);
  const [navOpen, setNavOpen] = useState(() => { try { return localStorage.getItem("fin04_nav") !== "0"; } catch (e) { return true; } });
  const toggleNav = () => setNavOpen((o) => { const n = !o; try { localStorage.setItem("fin04_nav", n ? "1" : "0"); } catch (e) {} return n; });
  useEffect(() => { if (!ytt) return; const h = (e) => { if (e.key === "Escape") setYtt(false); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [ytt]);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(() => { try { const p = localStorage.getItem("fin04_page"); return ["board", "table", "schedule", "constraints", "reports", "help", "admin"].includes(p) ? p : "board"; } catch (e) { return "board"; } });
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
  useEffect(() => { heartbeat(); const t = setInterval(heartbeat, 60000); const onVis = () => { if (document.visibilityState === "visible") heartbeat(); }; document.addEventListener("visibilitychange", onVis); return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); }; }, []);
  useEffect(() => { if (S?.brand) applyBrandToTab(S.brand); }, [S?.brand]);
  useEffect(() => { const t = THEMES[S?.theme] || THEMES.light; document.documentElement.style.background = t.paper; document.body.style.background = t.paper; }, [S?.theme]);
  useEffect(() => { try { localStorage.setItem("fin04_page", page); } catch (e) {} }, [page]);
  useEffect(() => { if (!S) return; const me = S.users.find((u) => u.id === S.currentUserId); if (page === "admin" && !(me && me.role === "admin")) setPage("board"); }, [S, page]);

  const PREF_KEYS = ["theme", "view", "grain", "laneBy"];
  const cu = S && (S.users.find((u) => u.id === S.currentUserId) || { id: session.user.id, name: session.user.email, role: "member", companyId: null });
  // Audit is written entirely by database triggers (see schema.sql), so the
  // optional { action, detail } some callers pass as a second argument is
  // intentionally ignored and kept only as inline documentation of intent.
  const update = (producer, _meta) => setS((prev) => {
    const n = producer(prev);
    if (PREF_KEYS.some((k) => n[k] !== prev[k])) { try { localStorage.setItem("fin04_prefs", JSON.stringify({ theme: n.theme, view: n.view, grain: n.grain, laneBy: n.laneBy })); } catch (e) {} }
    syncCollections(prev, n, session);
    return n;
  });

  const DAYS = S ? S.settings.weeks * 7 : 28;
  const WEEKS = S ? S.settings.weeks : 4;
  const todayOffset = useMemo(() => Math.round((todayMid() - anchor) / DAYMS), [anchor]);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(anchor, i)), [anchor, DAYS]);
  const pickLogo = (o) => !o ? "" : (S.theme === "dark" ? (o.logoDark || o.logoUrl || "") : (o.logoUrl || o.logoDark || ""));
  const coName = (id) => (S.companies.find((c) => c.id === id) || {}).name || "Unassigned";
  const coLogo = (id) => pickLogo(S.companies.find((c) => c.id === id));
  const brandLogo = pickLogo(S && S.brand);
  const locCode = (a) => [(S.brand && S.brand.projectName) || "FIN04", a.area, a.subArea, a.tier3].filter(Boolean).join(".");

  const visible = useMemo(() => {
    if (!S) return [];
    const base = S.activities.map((a) => {
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
      return { ...a, startOff, endOff, span: a.duration - 1, delayDays, delayed: delayDays > 0, open: openCount(a) };
    });
    // ---- non-destructive forward pass: project dates down the predecessor chain ----
    const byId = Object.fromEntries(base.map((a) => [a.id, a]));
    const memo = {}, stack = {};
    const projEnd = (id) => {
      const a = byId[id];
      if (!a) return null;                       // predecessor was deleted
      if (memo[id] !== undefined) return memo[id];
      if (stack[id]) return a.endOff;            // cycle guard: ignore the back-edge
      stack[id] = true;
      const own = Math.max(0, a.delayDays);      // the activity's own slip so far
      let st = a.actualStart ? Math.round((parseD(a.actualStart) - anchor) / DAYMS) : a.startOff + own;
      a._base = st;
      (a.predecessors || []).forEach((pid) => { const pe = projEnd(pid); if (pe != null) st = Math.max(st, pe + 1); });
      st = Math.max(st, a._base);  // a predecessor only orders work; it pushes a successor later if needed, but never earlier than its own planned start
      const pe = (a.status === "complete" && a.actualFinish) ? Math.round((parseD(a.actualFinish) - anchor) / DAYMS) : st + a.span;
      a._ps = st; a._pe = pe;
      stack[id] = false; memo[id] = pe; return pe;
    };
    base.forEach((a) => projEnd(a.id));
    base.forEach((a) => {
      a.projStartOff = a._ps != null ? a._ps : a.startOff;
      a.projEndOff = a._pe != null ? a._pe : a.endOff;
      a.knockOn = Math.max(0, a.projStartOff - (a._base != null ? a._base : a.startOff));  // pushed by predecessors, beyond its own slip
      a.totalShift = Math.max(0, a.projStartOff - a.startOff);
      a.inWin = a.endOff >= 0 && a.startOff < DAYS;
      delete a._ps; delete a._pe; delete a._base;
    });
    return base;
  }, [S, anchor, DAYS]);

  if (!S) return <div className="lk" style={cssVars("light")}><style>{css}</style><div className="lk-empty">Loading board…</div></div>;
  if (cu.mustReset) return <SetPassword forced onDone={() => setS((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === cu.id ? { ...u, mustReset: false } : u)) }))} />;
  const LV = S.levels || DEFAULT_LEVELS;

  const isAdmin = cu.role === "admin";
  const canEdit = (a) => isAdmin || a.companyId === cu.companyId;
  const toggleConstraint = (actId, cId) => { const a = S.activities.find((x) => x.id === actId); if (!a || !isAdmin) return; update((p) => ({ ...p, activities: p.activities.map((x) => x.id === actId ? { ...x, constraints: (x.constraints || []).map((c) => c.id === cId ? { ...c, done: !c.done } : c) } : x) }), { action: "Clear constraint", detail: a.desc }); };
  const addOption = (kind, name, ctx) => {
    if (!isAdmin) return ""; name = (name || "").trim(); if (!name) return ""; const lc = name.toLowerCase(); ctx = ctx || {};
    if (kind === "company") { const ex = S.companies.find((c) => c.name.toLowerCase() === lc); if (ex) return ex.id; const id = uid("co"); update((p) => ({ ...p, companies: [...p.companies, { id, name }] }), { action: "Add company", detail: name }); return id; }
    if (kind === "system") { const ex = S.systems.find((s) => s.toLowerCase() === lc); if (ex) return ex; update((p) => ({ ...p, systems: [...p.systems, name] }), { action: "Add system", detail: name }); return name; }
    if (kind === "subArea") { if (!ctx.area) return ""; const ex = (S.subAreas || []).find((s) => s.area === ctx.area && s.name.toLowerCase() === lc); if (ex) return ex.name; update((p) => ({ ...p, subAreas: [...(p.subAreas || []), { area: ctx.area, name }] }), { action: "Add level", detail: ctx.area + " / " + name }); return name; }
    if (kind === "tier3") { if (!ctx.area || !ctx.subArea) return ""; const ex = (S.tier3s || []).find((t) => t.area === ctx.area && t.subArea === ctx.subArea && t.name.toLowerCase() === lc); if (ex) return ex.name; update((p) => ({ ...p, tier3s: [...(p.tier3s || []), { area: ctx.area, subArea: ctx.subArea, name }] }), { action: "Add zone", detail: ctx.area + " / " + ctx.subArea + " / " + name }); return name; }
    return "";
  };
  const mk = S.settings.makeReadyDays;
  const inWindow = visible.filter((a) => a.inWin);
  const ready = inWindow.filter((a) => a.open === 0 && a.status !== "complete");
  const needMR = inWindow.filter((a) => a.open > 0 && a.status !== "complete");
  const urgentMR = needMR.filter((a) => a.startOff < mk);
  const committedWk = visible.filter((a) => a.committed && a.startOff >= 0 && a.startOff < 7);
  const delayedList = inWindow.filter((a) => a.delayed);
  const atRiskList = inWindow.filter((a) => a.knockOn > 0 && a.status !== "complete" && !a.delayed);
  const ppcAll = (() => { const c = S.activities.filter((a) => a.committed); return c.length ? Math.round(c.filter((a) => a.status === "complete").length / c.length * 100) : null; })();

  const laneOf = (a) => S.laneBy === "level" ? a.level : S.laneBy === "area" ? (a.area || "Unassigned") : S.laneBy === "subarea" ? (a.subArea || "Unassigned") : S.laneBy === "tier3" ? (a.tier3 || "Unassigned") : coName(a.companyId);
  const lanesList = (() => {
    if (S.laneBy === "level") return Object.keys(LV);
    if (S.laneBy === "area") { const s = [...new Set(S.activities.map((a) => a.area).filter(Boolean))].sort(); return s.length ? s : ["Unassigned"]; }
    if (S.laneBy === "subarea") { const s = [...new Set(S.activities.map((a) => a.subArea).filter(Boolean))].sort(); return s.length ? s : ["Unassigned"]; }
    if (S.laneBy === "tier3") { const s = [...new Set(S.activities.map((a) => a.tier3).filter(Boolean))].sort(); return s.length ? s : ["Unassigned"]; }
    return [...new Set(S.activities.map((a) => coName(a.companyId)))].sort();
  })();

  const saveActivity = (a, isNew) => {
    update((p) => ({ ...p, activities: isNew ? [...p.activities, a] : p.activities.map((x) => x.id === a.id ? a : x) }),
      { action: isNew ? "Create activity" : "Edit activity", detail: `${a.desc} (${coName(a.companyId)})` });
    setEditing(null);
  };
  const removeActivity = (a) => { update((p) => ({ ...p, activities: p.activities.filter((x) => x.id !== a.id).map((x) => (x.predecessors && x.predecessors.includes(a.id)) ? { ...x, predecessors: x.predecessors.filter((pid) => pid !== a.id) } : x) }), { action: "Delete activity", detail: a.desc }); setEditing(null); };
  const moveActivity = (id, dayIdx, lane) => {
    const a = S.activities.find((x) => x.id === id); if (!a || !canEdit(a)) { dragId.current = null; return; }
    if (!isAdmin && a.committed) { dragId.current = null; return; }
    if (!isAdmin && S.laneBy === "company" && lane != null) { const c = S.companies.find((c) => c.name === lane); if (c && c.id !== a.companyId) { dragId.current = null; return; } }
    update((p) => ({ ...p, activities: p.activities.map((x) => {
      if (x.id !== id) return x;
      const u = { ...x, start: fmtISO(addDays(anchor, dayIdx)) };
      if (lane != null) { if (p.laneBy === "level") u.level = lane; else if (p.laneBy === "area") u.area = lane; else if (p.laneBy === "subarea") u.subArea = lane === "Unassigned" ? "" : lane; else if (p.laneBy === "tier3") u.tier3 = lane === "Unassigned" ? "" : lane; else { const c = p.companies.find((c) => c.name === lane); if (isAdmin && c) u.companyId = c.id; } }
      return u;
    }) }), { action: "Move activity", detail: `${a.desc} to ${fmtISO(addDays(anchor, dayIdx))}` });
    dragId.current = null;
  };
  const newActivity = (lane, dayIdx) => {
    const base = { id: uid("a"), code: nextCode(S.activities), predecessors: [], desc: "", companyId: isAdmin ? (S.companies[0] || {}).id : cu.companyId, area: (S.areas && S.areas.length === 1) ? S.areas[0] : "", subArea: "", tier3: "", asset: "", system: "", level: "L2",
      start: fmtISO(addDays(anchor, Math.max(0, dayIdx ?? Math.max(0, todayOffset)))), duration: 1, committed: false, status: "planned", isMilestone: false, witnessInvite: false, witnessAt: "", notes: "", slipReason: "", actualStart: "", actualFinish: "", constraints: [] };
    if (lane) { if (S.laneBy === "level") base.level = lane; else if (S.laneBy === "area") base.area = lane; else if (S.laneBy === "subarea") { if (lane !== "Unassigned") base.subArea = lane; } else if (S.laneBy === "tier3") { if (lane !== "Unassigned") base.tier3 = lane; } else if (isAdmin) { const c = S.companies.find((c) => c.name === lane); if (c) base.companyId = c.id; } }
    setEditing(base);
  };
  const exportActivities = () => {
    const headers = ["Code", "Description", "Company", "Location code", "Building", "Level", "Zone / Room", "Asset", "System", "Cx Stage", "Milestone", "Witness invite", "Predecessors", "Planned start", "Planned finish", "Duration (d)", "Actual start", "Actual finish", "Delay (d)", "Forecast start", "Forecast finish", "Knock-on (d)", "Status", "Committed", "Reason for non-completion", "Open constraints", "Constraints", "Notes"];
    const predCodes = (a) => (a.predecessors || []).map((pid) => { const p = S.activities.find((x) => x.id === pid); return p && p.code != null ? "#" + p.code : null; }).filter(Boolean).join("; ");
    const rows = visible.map((a) => [a.code != null ? "#" + a.code : "", a.desc, coName(a.companyId), locCode(a), a.area, a.subArea || "", a.tier3 || "", a.asset || "", a.system, a.level, a.isMilestone ? "Yes" : "No", a.witnessInvite ? "Yes" : "No", predCodes(a), a.start, fmtISO(addDays(parseD(a.start), a.duration - 1)), a.duration, a.actualStart || "", a.actualFinish || "", a.delayDays || 0, fmtISO(addDays(anchor, a.projStartOff)), fmtISO(addDays(anchor, a.projEndOff)), a.knockOn || 0, a.status, a.committed ? "Yes" : "No", a.slipReason || "", a.open, a.constraints.map((c) => (c.done ? "[x] " : "[ ] ") + c.text).join("; "), a.notes || ""]);
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
        <span className="mslbl">{a.desc || "Milestone"}{a.delayed ? ` +${a.delayDays}d` : (a.knockOn > 0 ? ` (forecast +${a.knockOn}d)` : "")}</span>
      </div>;
    }
    const constrained = a.open > 0 && a.status !== "complete";
    const spot = makeReady && constrained && a.startOff < mk;
    const dim = makeReady && !spot;
    return (
      <div className={"lk-ticket" + (constrained ? " constrained" : "") + (a.status === "complete" ? " complete" : "") + (dim ? " dim" : "") + (spot ? " spot" : "") + (!editable ? " ro" : "")}
        style={{ gridColumn: `${s + 1} / ${e + 2}`, gridRow: row + 1, zIndex: 1, borderLeftColor: lv.color, background: a.status === "complete" ? "var(--card)" : (S.theme === "dark" ? "var(--card)" : tintOf(lv.color)) }}
        draggable={movable} onDragStart={() => movable && (dragId.current = a.id)} onClick={() => setEditing({ ...a })}>
        <div className="desc">{a.desc || "Untitled activity"}</div>
        <div className="meta">
          <span className="dot" style={{ background: a.status === "complete" ? "#9AA6B2" : constrained ? "#E0A106" : "#0E9384" }} />
          {a.committed && <span className="lk-chip commit">will</span>}
          {a.witnessInvite && <span className="lk-chip wit" title="Witness invite">WIT</span>}
          {constrained && <span className="lk-chip cstr"><Icon n="alert" s={9} />{a.open}</span>}
          {a.delayed && <span className="lk-chip late">+{a.delayDays}d</span>}
          {a.knockOn > 0 && a.status !== "complete" && <span className="lk-chip knock" title="Projected start pushed later by a predecessor">{"\u25B8+"}{a.knockOn}d</span>}
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

  const Forecast = ({ a, row }) => {
    if (a.isMilestone || a.status === "complete" || a.totalShift <= 0) return null;
    const so = grain === "day" ? a.projStartOff : Math.floor(a.projStartOff / 7);
    const eo = grain === "day" ? a.projEndOff : Math.floor(a.projEndOff / 7);
    if (eo < 0 || so >= cols) return null;
    const s = Math.max(0, so), e = Math.min(cols - 1, eo);
    return <div className="lk-fc" title={`Forecast: projected to start ${a.totalShift} day${a.totalShift === 1 ? "" : "s"} later than plan`} style={{ gridColumn: `${s + 1} / ${e + 2}`, gridRow: row + 1 }} />;
  };

  const Underlay = ({ lane }) => (
    <div className="lk-under" style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}>
      {Array.from({ length: cols }, (_, i) => (
        <div key={i} className={"lk-cell" + (unitWeekend(i) ? " we" : "") + (i === todayUnit ? " tod" : "")}
          onClick={() => newActivity(lane, dropDay(i))} onDragOver={(e) => e.preventDefault()} onDrop={() => moveActivity(dragId.current, dropDay(i), lane)} />))}
    </div>);

  return (
    <div className="lk" style={cssVars(S.theme)}><style>{css}</style>
      <div className={"lk-shell" + (navOpen ? " navopen" : "")}>
      <nav className={"lk-rail" + (navOpen ? " open" : "")}><div className="lk-rail-inner">
        <button className="lk-railtog" title={navOpen ? "Collapse menu" : "Expand menu"} onClick={toggleNav}><Icon n={navOpen ? "cl" : "cr"} s={18} /><span className="lbl">Collapse</span></button>
        <button title="Planning Board" className={page === "board" ? "on" : ""} onClick={() => setPage("board")}><Icon n="board" s={20} /><span className="lbl">Planning Board</span></button>
        <button title="Activity Table" className={page === "table" ? "on" : ""} onClick={() => setPage("table")}><Icon n="grid" s={20} /><span className="lbl">Activity Table</span></button>
        <button title="Constraints Log" className={page === "constraints" ? "on" : ""} onClick={() => setPage("constraints")}><Icon n="list" s={20} /><span className="lbl">Constraints Log</span></button>
        <button title="Schedule" className={page === "schedule" ? "on" : ""} onClick={() => setPage("schedule")}><Icon n="gantt" s={20} /><span className="lbl">Schedule</span></button>
        <button title="Analytics" className={page === "reports" ? "on" : ""} onClick={() => setPage("reports")}><Icon n="chart" s={20} /><span className="lbl">Analytics</span></button>
        <button title="Help" className={page === "help" ? "on" : ""} onClick={() => setPage("help")}><Icon n="help" s={20} /><span className="lbl">Help</span></button>
        {isAdmin && <button title="Admin" className={page === "admin" ? "on" : ""} onClick={() => setPage("admin")}><Icon n="cog" s={20} /><span className="lbl">Admin</span></button>}
        <div className="lk-railppc" style={{ marginTop: "auto", color: "#9aa7b8" }}>
          <div style={{ fontSize: 9, letterSpacing: ".1em" }}>PPC</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: ppcAll == null ? "#9aa7b8" : (ppcAll >= 80 ? "#34D399" : ppcAll >= 50 ? "#FBBF24" : "#F87171") }}>{ppcAll == null ? "\u2014" : ppcAll + "%"}</div>
        </div>
      </div></nav>
      <div className="lk-page">
      {page === "board" && <>
      <div className="lk-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {brandLogo && <img src={brandLogo} alt="" style={{ height: 30, maxWidth: 130, objectFit: "contain" }} />}
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
          {[["company", "Company"], ...(S.areas.length > 1 ? [["area", "Building"]] : []), ["subarea", "Level"], ["tier3", "Zone"], ["level", "Cx Stage"]].map(([k, l]) => (
            <button key={k} className={S.laneBy === k ? "sel" : ""} onClick={() => update((p) => ({ ...p, laneBy: k }))}>{l}</button>))}
        </div>}
        <button className={"lk-btn" + (makeReady ? " on" : "")} onClick={() => setMakeReady((v) => !v)}><Icon n="cross" s={14} />Make-ready</button>
        <button className={"lk-btn" + (ytt ? " on" : "")} title="YTT Focus: yesterday, today and tomorrow with open constraints" onClick={() => setYtt((v) => !v)}><Icon n="cross" s={14} />YTT</button>
        <button className="lk-btn" onClick={() => setShowImport(true)}><Icon n="upload" s={14} />Import</button>
        <button className="lk-btn" onClick={exportActivities}><Icon n="download" s={14} />Export</button>
        <div className="lk-barright">
          <div className="lk-who">
            <button className="lk-btn icon" title={S.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => update((p) => ({ ...p, theme: p.theme === "dark" ? "light" : "dark" }))}><Icon n={S.theme === "dark" ? "sun" : "moon"} s={15} /></button>
            <span style={{ fontWeight: 600 }}>{cu.name}</span>
            {cu.role === "admin" ? <span className="lk-pill admin">Admin</span> : (coLogo(cu.companyId) ? <img className="lk-colead" src={coLogo(cu.companyId)} alt={coName(cu.companyId)} title={coName(cu.companyId)} /> : <span className="lk-pill member">{coName(cu.companyId)}</span>)}
            <button className="lk-btn" onClick={() => signOut()}>Sign out</button>
          </div>
          <button className="lk-btn primary" onClick={() => newActivity()}><Icon n="plus" s={15} />Activity</button>
        </div>
      </div>

      <div className="lk-metrics">
        <div className="lk-metric"><span className="v">{inWindow.length}</span><span className="l">In lookahead</span></div>
        <div className="lk-metric"><span className="v" style={{ color: "#0E9384" }}>{ready.length}</span><span className="l">Ready to run</span></div>
        <div className="lk-metric"><span className="v" style={{ color: "#D97706" }}>{needMR.length}</span><span className="l">Need make-ready</span><span className="sub">{urgentMR.length} within {mk}d</span></div>
        <div className="lk-metric"><span className="v" style={{ color: "var(--accent)" }}>{committedWk.length}</span><span className="l">Committed this week</span></div>
        <div className="lk-metric"><span className="v" style={{ color: "#C0392B" }}>{delayedList.length}</span><span className="l">Delayed</span></div>
        <div className="lk-metric"><span className="v" style={{ color: "#E0A106" }}>{atRiskList.length}</span><span className="l">At risk</span><span className="sub">predecessor knock-on</span></div>
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
          const co = S.laneBy === "company" ? S.companies.find((c) => c.name === lane) : null;
          const laneLogo = pickLogo(co);
          return (
            <div key={lane} className="lk-lane" style={{ gridTemplateColumns: gridCols, minWidth: minW }}>
              <div className="lk-llbl">{!laneLogo && <span className="sw" style={{ background: sw }} />}
                <div style={{ minWidth: 0 }}>{laneLogo && <img className="lk-lanelogo" src={laneLogo} alt={lane} />}<div className="lanenm">{S.laneBy === "level" ? `${lane} · ${lvOf(LV, lane).name}` : lane}</div><div className="cnt mono">{la.length} act</div></div></div>
              <div className="lk-track" style={{ gridColumn: `2 / span ${DAYS}` }}>
                <Underlay lane={lane} />
                <div className="lk-tk" style={{ gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: `repeat(${Math.max(1, rows.length)},minmax(48px,auto))` }}>
                  {la.map((a) => <Forecast key={"fc" + a.id} a={a} row={a._row} />)}
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
                  <Forecast a={a} row={0} />
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
        <span className="it"><span style={{ height: 12, width: 16, borderRadius: 4, border: "1.5px dashed #E0A106", background: "rgba(224,161,6,.10)" }} />forecast (knock-on)</span>
      </div>
      </>}
      {page !== "board" && <div className="lk-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {brandLogo && <img src={brandLogo} alt="" style={{ height: 30, maxWidth: 130, objectFit: "contain" }} />}
          <div><div className="lk-title">{(S.brand?.projectName || "FIN04")} {(S.brand?.appName || "DLP")}</div><div className="lk-sub">{S.brand?.tagline || "Collaborative Digital Planning"}</div></div>
        </div>
        <div style={{ fontWeight: 700, fontSize: 17, marginLeft: 6 }}>{page === "table" ? "Activity Table" : page === "schedule" ? "Schedule" : page === "constraints" ? "Constraints Log" : page === "reports" ? "Reports & Metrics" : page === "admin" ? "Admin Settings" : page === "help" ? "Help & Quick Reference" : ""}</div>
        <div className="lk-spacer" />
        <div className="lk-who">
          <button className="lk-btn icon" title={S.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => update((p) => ({ ...p, theme: p.theme === "dark" ? "light" : "dark" }))}><Icon n={S.theme === "dark" ? "sun" : "moon"} s={15} /></button>
          <span style={{ fontWeight: 600 }}>{cu.name}</span>
          {cu.role === "admin" ? <span className="lk-pill admin">Admin</span> : (coLogo(cu.companyId) ? <img className="lk-colead" src={coLogo(cu.companyId)} alt={coName(cu.companyId)} title={coName(cu.companyId)} /> : <span className="lk-pill member">{coName(cu.companyId)}</span>)}
          <button className="lk-btn" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>}
      {page === "table" && <TablePage S={S} cu={cu} isAdmin={isAdmin} canEdit={canEdit} update={update} coName={coName} />}
      {page === "schedule" && <SchedulePage S={S} coName={coName} onOpen={(a) => { setPage("board"); setEditing({ ...a }); }} />}
      {page === "constraints" && <ConstraintsPage S={S} update={update} canEdit={canEdit} coName={coName} onOpen={(a) => { setPage("board"); setEditing({ ...a }); }} />}
      {page === "reports" && <ReportsPage S={S} LV={LV} coName={coName} exportActivities={exportActivities} exportWitness={exportWitness} isAdmin={isAdmin} by={cu.name} onOpen={(a) => { setPage("board"); setEditing({ ...a }); }} />}
      {page === "admin" && isAdmin && <AdminPanel S={S} cu={cu} update={update} exportActivities={exportActivities} />}
      {page === "help" && <HelpPage dark={S.theme === "dark"} />}
      <div className="lk-foot">DLP by QMC Cx Software Solutions{"\u2122"} {"\u00B7"} {"\u00A9"} {new Date().getFullYear()} Quantum Mission Critical. All rights reserved.</div>
      </div>
      </div>

      {editing && <Drawer act={editing} S={S} canEdit={canEdit(editing)} isAdmin={isAdmin} onAdd={addOption} onSave={saveActivity} onClose={() => setEditing(null)} onDelete={removeActivity} />}
      {showImport && <UserImport S={S} cu={cu} isAdmin={isAdmin} LV={LV} update={update} onClose={() => setShowImport(false)} />}
      {page === "board" && ytt && (() => {
        const cols = [["Yesterday", todayOffset - 1], ["Today", todayOffset], ["Tomorrow", todayOffset + 1]];
        const onDay = (off) => visible.filter((a) => a.isMilestone ? a.startOff === off : (a.startOff <= off && a.endOff >= off))
          .map((a) => ({ a, open: (a.constraints || []).filter((c) => !c.done) }))
          .sort((x, y) => (y.open.length > 0) - (x.open.length > 0) || (y.a.committed ? 1 : 0) - (x.a.committed ? 1 : 0));
        return (
          <div className="lk-bg" onClick={() => setYtt(false)}>
            <div className="ytt" style={cssVars(S.theme)} onClick={(e) => e.stopPropagation()}>
              <div className="ytt-head">
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Icon n="cross" s={18} /><h3 style={{ margin: 0, fontSize: 16 }}>YTT Focus</h3><span className="ytt-sub">Yesterday, today and tomorrow, with open constraints. Tick a constraint to clear it.</span></div>
                <button className="lk-btn icon" onClick={() => setYtt(false)}><Icon n="x" /></button>
              </div>
              <div className="ytt-cols">
                {cols.map(([label, off]) => { const d = addDays(anchor, off); const list = onDay(off); const isToday = off === todayOffset;
                  return <div key={label} className={"ytt-col" + (isToday ? " today" : "")}>
                    <div className="ytt-colhead"><span className="ytt-lab">{label}</span><span className="ytt-date">{d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}</span></div>
                    <div className="ytt-list">
                      {list.length === 0 ? <div className="ytt-empty">Nothing scheduled.</div> :
                        list.map(({ a, open }) => { const lv = lvOf(LV, a.level); const missed = label === "Yesterday" && a.committed && a.status !== "complete";
                          return <div key={a.id} className="ytt-card" style={{ borderLeftColor: lv.color }}>
                            <div className="ytt-card-desc" onClick={() => setEditing({ ...a })}>{a.isMilestone ? "\u25C6 " : ""}{a.desc || "Untitled"}</div>
                            <div className="ytt-card-meta">
                              <span className="dot" style={{ background: a.status === "complete" ? "#9AA6B2" : open.length ? "#E0A106" : "#0E9384" }} />
                              {missed && <span className="lk-chip late">missed</span>}
                              {a.committed && <span className="lk-chip commit">will</span>}
                              {a.witnessInvite && <span className="lk-chip wit">WIT</span>}
                              {a.status === "complete" && <span style={{ color: "#0E9384", fontWeight: 700 }}>done</span>}
                              <span className="ytt-loc">{coName(a.companyId)} {"\u00b7"} {locCode(a)}</span>
                            </div>
                            {open.length > 0
                              ? <div className="ytt-cons">{open.map((c) => <label key={c.id} className="ytt-con">
                                  <input type="checkbox" disabled={!isAdmin} checked={false} onChange={() => toggleConstraint(a.id, c.id)} title={isAdmin ? "Mark cleared" : "Only admins can clear constraints here"} />
                                  <span>{c.text}{c.owner ? <span className="ytt-meta2"> {"\u00b7"} {c.owner}</span> : ""}{c.due ? <span className="ytt-due"> {"\u00b7"} need {c.due}</span> : ""}</span>
                                </label>)}</div>
                              : (a.status !== "complete" && <div className="ytt-ready">No open constraints</div>)}
                          </div>; })}
                    </div>
                  </div>; })}
              </div>
            </div>
          </div>);
      })()}
    </div>);
}

function cssVars(theme) { const t = THEMES[theme] || THEMES.light; return { "--ink": t.ink, "--paper": t.paper, "--card": t.card, "--line": t.line, "--muted": t.muted, "--accent": t.accent, "--weekend": t.weekend, "--todcell": t.todcell, "--todhead": t.todhead, "--hover": t.hover, "--chipbg": t.chipbg }; }

function Drawer({ act, S, canEdit, isAdmin, onAdd, onSave, onClose, onDelete }) {
  const [a, setA] = useState(act);
  const [addKind, setAddKind] = useState(null);
  const [addText, setAddText] = useState("");
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [auditRows, setAuditRows] = useState([]);
  const [cText, setCText] = useState("");
  const [cOwner, setCOwner] = useState("");
  const [cDue, setCDue] = useState("");
  const setC = (id, k, v) => set("constraints", a.constraints.map((x) => x.id === id ? { ...x, [k]: v } : x));
  const locked = a.status === "complete";
  const set = (k, v) => { if (!canEdit || locked) return; setA((p) => ({ ...p, [k]: v })); };
  const setReason = (v) => { if (!canEdit) return; setA((p) => ({ ...p, slipReason: v })); };
  const isNew = !act.desc && act.constraints.length === 0;
  const addC = () => { if (!cText.trim()) return; set("constraints", [...a.constraints, { id: uid("c"), text: cText.trim(), done: false, owner: cOwner.trim(), due: cDue }]); setCText(""); setCOwner(""); setCDue(""); };
  const dis = !canEdit || locked;
  const cancelAdd = () => { setAddKind(null); setAddText(""); };
  const confirmAdd = (kind, ctx) => { const v = onAdd && onAdd(kind, addText, ctx); if (!v) { cancelAdd(); return; } if (kind === "company") set("companyId", v); else if (kind === "subArea") { set("subArea", v); set("tier3", ""); } else if (kind === "tier3") set("tier3", v); else if (kind === "system") set("system", v); cancelAdd(); };
  const renderAdd = (kind, placeholder, ctx) => addKind !== kind ? null : (
    <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
      <input className="lk-in" autoFocus value={addText} placeholder={placeholder} style={{ fontSize: 12, padding: "5px 8px" }} onChange={(e) => setAddText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmAdd(kind, ctx); } if (e.key === "Escape") cancelAdd(); }} />
      <button className="lk-btn primary" title="Create and select" onClick={() => confirmAdd(kind, ctx)}><Icon n="check" s={14} /></button>
      <button className="lk-btn" title="Cancel" onClick={cancelAdd}><Icon n="x" s={14} /></button>
    </div>);
  const ADD_OPT = <option value="__add__">{"\uFF0B Add new\u2026"}</option>;
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
  // predecessor options: exclude self and anything downstream of this activity (prevents cycles)
  const descend = new Set();
  (function walk(id) { (S.activities || []).forEach((x) => { if ((x.predecessors || []).includes(id) && !descend.has(x.id)) { descend.add(x.id); walk(x.id); } }); })(a.id);
  const predOptions = (S.activities || []).filter((x) => x.id !== a.id && !descend.has(x.id) && !(a.predecessors || []).includes(x.id));
  const predLabel = (id) => { const x = (S.activities || []).find((p) => p.id === id); return x ? `#${x.code ?? "?"} ${x.desc || "Untitled"}` : "(removed)"; };
  return (
    <div className="lk-bg" onClick={onClose}><style>{css}</style>
      <div className="lk-drawer" style={cssVars(S.theme)} onClick={(e) => e.stopPropagation()}>
        <div className="lk-dh"><h3>{isNew ? "New Activity" : canEdit ? "Edit Activity" : "Activity (View Only)"}</h3><button className="lk-btn icon" onClick={onClose}><Icon n="x" /></button></div>
        <div className="lk-db">
          {!canEdit && <div className="lk-pv" style={{ borderRadius: 8, border: "1px solid var(--line)" }}><Icon n="alert" s={13} />This activity belongs to another company. You can view it but not change it.</div>}
          <div className="lk-f"><label>What is the activity{a.code != null ? <span style={{ fontWeight: 400, color: "var(--muted)" }}> &middot; #{a.code}</span> : null}</label><input className="lk-in" value={a.desc} disabled={dis} placeholder="e.g. UPS module SAT" autoFocus onChange={(e) => set("desc", e.target.value)} /></div>
          <div className="lk-row">
            <div className="lk-f"><label>Company (performing)</label>
              <select className="lk-select" value={a.companyId || ""} disabled={dis || !isAdmin} onChange={(e) => { if (e.target.value === "__add__") { setAddText(""); setAddKind("company"); } else set("companyId", e.target.value); }}>
                {S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}{isAdmin && !dis && ADD_OPT}
              </select>{!isAdmin && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>Members add only for their own company.</span>}
              {renderAdd("company", "New company name", {})}</div>
            <div className="lk-f"><label>Building</label>
              <select className="lk-select" value={a.area} disabled={dis || !isAdmin} onChange={(e) => { set("area", e.target.value); set("subArea", ""); set("tier3", ""); }}>
                <option value="">--</option>{S.areas.map((x) => <option key={x}>{x}</option>)}</select>
              {!isAdmin && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>Building is fixed for the project.</span>}</div>
          </div>
          <div className="lk-f"><label>Level</label>
            <select className="lk-select" value={a.subArea || ""} disabled={dis || !a.area} onChange={(e) => { if (e.target.value === "__add__") { setAddText(""); setAddKind("subArea"); } else { set("subArea", e.target.value); set("tier3", ""); } }}>
              <option value="">--</option>{(S.subAreas || []).filter((s) => s.area === a.area).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}{isAdmin && !dis && a.area && ADD_OPT}</select>
            {!isAdmin && a.area && (S.subAreas || []).filter((s) => s.area === a.area).length === 0 && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>No levels defined for {a.area}.</span>}
            {renderAdd("subArea", "New level name", { area: a.area })}</div>
          <div className="lk-f"><label>Zone / Room</label>
            <select className="lk-select" value={a.tier3 || ""} disabled={dis || !a.subArea} onChange={(e) => { if (e.target.value === "__add__") { setAddText(""); setAddKind("tier3"); } else set("tier3", e.target.value); }}>
              <option value="">--</option>{(S.tier3s || []).filter((t) => t.area === a.area && t.subArea === a.subArea).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}{isAdmin && !dis && a.subArea && ADD_OPT}</select>
            {!isAdmin && a.subArea && (S.tier3s || []).filter((t) => t.area === a.area && t.subArea === a.subArea).length === 0 && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>No zones or rooms defined for {a.subArea}.</span>}
            {renderAdd("tier3", "New zone / room name", { area: a.area, subArea: a.subArea })}</div>
          <div className="lk-f"><label>System</label>
            <select className="lk-select" value={a.system} disabled={dis} onChange={(e) => { if (e.target.value === "__add__") { setAddText(""); setAddKind("system"); } else set("system", e.target.value); }}>
              <option value="">--</option>{S.systems.map((x) => <option key={x}>{x}</option>)}{isAdmin && !dis && ADD_OPT}</select>
            {renderAdd("system", "New system name", {})}</div>
          <div className="lk-f"><label>Asset (optional)</label>
            <input className="lk-in" value={a.asset || ""} disabled={dis} placeholder="e.g. EPOD108.DB001.U003" onChange={(e) => set("asset", e.target.value)} /></div>
          <div className="lk-f"><label>Cx Stage</label>
            <div className="lk-levels">{Object.entries(S.levels).map(([k, v]) => <div key={k} className={"lk-lvl" + (a.level === k ? " sel" : "")} onClick={() => set("level", k)}><span className="sw" style={{ background: v.color }} />{k}</div>)}</div></div>
          <div className="lk-row">
            <div className="lk-f"><label>Start</label><input className="lk-in mono" type="date" value={a.start} disabled={dis} onChange={(e) => set("start", e.target.value)} /></div>
            <div className="lk-f"><label>Days</label><input className="lk-in mono" type="number" min="1" value={a.duration} disabled={dis} onChange={(e) => set("duration", Math.max(1, +e.target.value || 1))} /></div>
          </div>
          <div className="lk-f"><label>Predecessors <span style={{ fontWeight: 400, color: "var(--muted)" }}>(this starts after these finish; a slip upstream pushes this forward)</span></label>
            {(a.predecessors || []).map((pid) => <div key={pid} className="lk-cstr"><span className="t">{predLabel(pid)}</span>{!dis && <button onClick={() => set("predecessors", a.predecessors.filter((x) => x !== pid))}><Icon n="trash" s={13} /></button>}</div>)}
            {(a.predecessors || []).length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>None. Not waiting on another activity.</div>}
            {!dis && predOptions.length > 0 && <div className="lk-add"><select className="lk-select" value="" onChange={(e) => { if (e.target.value) set("predecessors", [...(a.predecessors || []), e.target.value]); }}><option value="">Add a predecessor…</option>{predOptions.map((x) => <option key={x.id} value={x.id}>#{x.code ?? "?"} - {x.desc || "Untitled"}</option>)}</select></div>}
          </div>
          <div className="lk-f"><label>Constraints to clear (make-ready)</label>
            {a.constraints.map((c) => <div key={c.id} className="lk-cstr2">
              <input type="checkbox" checked={c.done} disabled={dis} onChange={() => setC(c.id, "done", !c.done)} />
              <div className="cmain">
                <span className={"t" + (c.done ? " done" : "")}>{c.text}</span>
                {!dis && <div className="crow">
                  <input className="lk-in" style={{ fontSize: 11.5, padding: "4px 7px" }} placeholder="Owner" value={c.owner || ""} onChange={(e) => setC(c.id, "owner", e.target.value)} />
                  <input className="lk-in mono" style={{ fontSize: 11.5, padding: "4px 7px", maxWidth: 150 }} type="date" title="Need-by date" value={c.due || ""} onChange={(e) => setC(c.id, "due", e.target.value)} />
                </div>}
                {dis && (c.owner || c.due) && <div className="crow" style={{ fontSize: 11, color: "var(--muted)" }}>{c.owner ? "Owner: " + c.owner : ""}{c.owner && c.due ? " \u00b7 " : ""}{c.due ? "need-by " + c.due : ""}</div>}
              </div>
              {!dis && <button onClick={() => set("constraints", a.constraints.filter((x) => x.id !== c.id))}><Icon n="trash" s={13} /></button>}
            </div>)}
            {a.constraints.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>No constraints. Reads as ready to run.</div>}
            {!dis && <div className="lk-add" style={{ flexWrap: "wrap" }}>
              <input className="lk-in" style={{ flex: "1 1 100%" }} placeholder="Add a constraint…" value={cText} onChange={(e) => setCText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addC()} />
              <input className="lk-in" style={{ flex: 1, minWidth: 100 }} placeholder="Owner (optional)" value={cOwner} onChange={(e) => setCOwner(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addC()} />
              <input className="lk-in mono" style={{ maxWidth: 150 }} type="date" title="Need-by date (optional)" value={cDue} onChange={(e) => setCDue(e.target.value)} />
              <button className="lk-btn primary" title="Add constraint" onClick={addC}><Icon n="plus" s={15} /></button>
            </div>}</div>
          <div className={"lk-tog" + (a.committed ? " on" : "")} onClick={() => set("committed", !a.committed)}><span>Committed for this week <span style={{ fontWeight: 400, color: "var(--muted)" }}>(a reliable promise)</span></span><span className="lk-sw2" /></div>
          <div className={"lk-tog" + (a.witnessInvite ? " on" : "")} onClick={() => set("witnessInvite", !a.witnessInvite)}><span>Witness invite <span style={{ fontWeight: 400, color: "var(--muted)" }}>(client or third-party witness required)</span></span><span className="lk-sw2" /></div>
          {a.witnessInvite && <div className="lk-f"><label>Witness date &amp; time <span style={{ color: "#C0392B" }}>*</span></label>
            <input className="lk-in mono" type="datetime-local" value={a.witnessAt || ""} disabled={dis} onChange={(e) => set("witnessAt", e.target.value)} />
            {!a.witnessAt && <span style={{ fontSize: 11, color: "#C0392B" }}>A witness time is required before this activity can be saved.</span>}</div>}
          <div className={"lk-tog" + (a.isMilestone ? " on" : "")} onClick={() => set("isMilestone", !a.isMilestone)}><span>Milestone <span style={{ fontWeight: 400, color: "var(--muted)" }}>(a point in time, shown as a diamond)</span></span><span className="lk-sw2" /></div>
          {locked && canEdit && <div className="lk-pv" style={{ borderRadius: 8, border: "1px solid var(--line)" }}><Icon n="alert" s={13} />Marked complete, so the fields are locked. Set the status back to In progress or Planned to edit them. The reason for non-completion can still be recorded.</div>}
          <div className="lk-f"><label>Status</label><div className="lk-status">{[["planned", "Planned"], ["in_progress", "In progress"], ["complete", "Complete"]].map(([k, l]) => <button key={k} className={a.status === k ? "sel" : ""} disabled={!canEdit} onClick={() => setA((p) => { const n = { ...p, status: k }; if (k === "in_progress" && !n.actualStart) n.actualStart = fmtISO(new Date()); if (k === "complete") { if (!n.actualStart) n.actualStart = fmtISO(new Date()); if (!n.actualFinish) n.actualFinish = fmtISO(new Date()); } return n; })}>{l}</button>)}</div></div>
          <div className="lk-row">
            <div className="lk-f"><label>Actual start</label><input className="lk-in mono" type="date" value={a.actualStart || ""} disabled={dis} onChange={(e) => set("actualStart", e.target.value)} /></div>
            <div className="lk-f"><label>Actual finish</label><input className="lk-in mono" type="date" value={a.actualFinish || ""} disabled={dis} onChange={(e) => set("actualFinish", e.target.value)} /></div>
          </div>
          {(() => { const ps = parseD(a.start), pf = addDays(ps, a.duration - 1); let d = null, lbl = ""; if (a.status === "complete" && a.actualFinish) { d = Math.round((parseD(a.actualFinish) - pf) / DAYMS); lbl = "Finish vs plan"; } else if (a.actualStart) { d = Math.round((parseD(a.actualStart) - ps) / DAYMS); lbl = "Start vs plan"; } if (d == null) return null; return <div style={{ fontSize: 12.5, fontWeight: 600, color: d > 0 ? "#C0392B" : "#0E9384" }}>{lbl}: {d > 0 ? "+" + d : d} day{Math.abs(d) === 1 ? "" : "s"} {d > 0 ? "late" : d < 0 ? "early" : "on plan"}</div>; })()}
          {(() => { const pf = addDays(parseD(a.start), a.duration - 1); const made = a.status === "complete" && (!a.actualFinish || parseD(a.actualFinish) <= pf); const miss = a.committed && !made && (pf.getTime() < todayMid() || (a.status === "complete" && a.actualFinish && parseD(a.actualFinish) > pf)); if (!miss) return null; return <div className="lk-f"><label>Reason for non-completion <span style={{ fontWeight: 400, color: "var(--muted)" }}>(this committed activity missed its promised finish)</span></label>
            <select className="lk-select" value={a.slipReason || ""} disabled={!canEdit} onChange={(e) => setReason(e.target.value)}>
              <option value="">-- record why it slipped --</option>{SLIP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>; })()}
          <div className="lk-f"><label>Notes / comment</label>
            <textarea className="lk-in" value={a.notes || ""} disabled={dis} placeholder="Anything the team should know: access, sequencing, contacts, risks…" rows={3} style={{ resize: "vertical", minHeight: 60, fontFamily: "inherit" }} onChange={(e) => set("notes", e.target.value)} /></div>
          {isAdmin && !isNew && <div className="lk-f" style={{ marginTop: 2 }}>
            <button type="button" className="lk-acc" onClick={() => { const n = !auditOpen; setAuditOpen(n); if (n && !auditLoaded) { setAuditLoaded(true); fetchActivityAudit(a.id).then(setAuditRows).catch(() => {}); } }}>
              <span className="car">{auditOpen ? "\u25BE" : "\u25B8"}</span>Audit history{auditLoaded && auditRows.length ? " (" + auditRows.length + ")" : ""}<span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 11 }}>admin only</span>
            </button>
            {auditOpen && <div className="lk-audhist">
              {!auditLoaded ? <div className="lk-audempty">Loading…</div>
                : auditRows.length === 0 ? <div className="lk-audempty">No history recorded for this activity yet.</div>
                : auditRows.map((e) => <div key={e.id} className="lk-audrow">
                    <div className="lk-audtop">
                      <span className="lk-audact">{e.action}</span>
                      <span className="lk-audwho">{e.user || "Unknown"}</span>
                      <span className="lk-audwhen" title={new Date(e.ts).toLocaleString("en-GB")}>{relTime(new Date(e.ts).getTime())}</span>
                    </div>
                    {e.detail && e.detail !== "No field changes" && <div className="lk-auddet">{e.detail}</div>}
                  </div>)}
            </div>}
          </div>}
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
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditQ, setAuditQ] = useState("");
  const [lvKey, setLvKey] = useState("");
  const [lvName, setLvName] = useState("");
  const [lvColor, setLvColor] = useState("#64748B");
  const [jsonPreview, setJsonPreview] = useState(null);
  const [ustat, setUstat] = useState({});
  useEffect(() => { fetchUserStatus().then(setUstat).catch(() => {}); }, []);
  const [pres, setPres] = useState({});
  useEffect(() => { let on = true; const go = () => loadPresence().then((p) => { if (on) setPres(p); }).catch(() => {}); go(); const t = setInterval(go, 30000); return () => { on = false; clearInterval(t); }; }, []);
  const [brandMsg, setBrandMsg] = useState("");
  const [impMode, setImpMode] = useState("append");
  const [impMsg, setImpMsg] = useState("");
  const [userMsg, setUserMsg] = useState("");
  const [nu, setNu] = useState({ email: "", name: "", role: "member", companyId: S.companies[0]?.id || "" });
  const [uq, setUq] = useState("");
  const [uCo, setUCo] = useState("all");
  const [uRole, setURole] = useState("all");
  const [uInvite, setUInvite] = useState("all");
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
  const renameSystem = (oldName, raw) => { const name = (raw || "").trim(); if (!name || name === oldName) return; if (S.systems.some((s) => s !== oldName && s.toLowerCase() === name.toLowerCase())) { alert(`System "${name}" already exists.`); return; } update((p) => ({ ...p, systems: p.systems.map((s) => s === oldName ? name : s), activities: p.activities.map((a) => a.system === oldName ? { ...a, system: name } : a) }), { action: "Rename system", detail: `${oldName} -> ${name}` }); };
  const addLevel = () => { const used = Object.keys(S.levels); let key = (lvKey || "").trim().toUpperCase().replace(/\s+/g, ""); if (!key) { let n = used.length + 1; key = "L" + n; while (S.levels[key]) { n++; key = "L" + n; } } if (S.levels[key]) { alert(`Cx stage "${key}" already exists.`); return; } const name = (lvName || "").trim() || "New stage"; update((p) => ({ ...p, levels: { ...p.levels, [key]: { name, color: lvColor || "#64748B", sort: Object.keys(p.levels).length } } }), { action: "Add Cx stage", detail: `${key} ${name}` }); setLvKey(""); setLvName(""); setLvColor("#64748B"); };
  const delLevel = (k) => { const keys = Object.keys(S.levels); if (keys.length <= 1) { alert("Keep at least one Cx stage."); return; } const fallback = keys.find((x) => x !== k); const used = S.activities.filter((a) => a.level === k).length; if (used && !window.confirm(`${used} activit${used === 1 ? "y" : "ies"} use ${k}. Delete it and move them to ${fallback}?`)) return; update((p) => { const lv = { ...p.levels }; delete lv[k]; return { ...p, levels: lv, activities: p.activities.map((a) => a.level === k ? { ...a, level: fallback } : a) }; }, { action: "Delete Cx stage", detail: k }); };
  const downloadCsvTemplate = () => { const headers = ["Description", "Company", "Area", "Sub-area", "Tier 3 Area", "System", "Level", "Planned start", "Duration (d)", "Committed", "Witness invite", "Witness date & time", "Notes"]; const example = ["UPS module SAT", (S.companies[0] || {}).name || "", S.areas[0] || "", "", "", S.systems[0] || "", Object.keys(S.levels)[0] || "L2", fmtISO(new Date()), "2", "No", "No", "", "Example row - delete before importing"]; downloadFile("FIN04-activities-template.csv", toCSV(headers, [example])); };
  const [tplBusy, setTplBusy] = useState(false);
  const downloadAdminTemplate = async () => {
    setTplBusy(true);
    try {
      const _xl = await import("exceljs/dist/exceljs.min.js"); const ExcelJS = _xl.default || _xl;
      const colLetter = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Activities");
      const lists = wb.addWorksheet("Lists"); lists.state = "veryHidden";
      const companyList = S.companies.map((c) => c.name);
      const buildings = S.areas.slice();
      const levels = [...new Set((S.subAreas || []).map((s) => s.name))];
      const zones = [...new Set((S.tier3s || []).map((t) => t.name))];
      const systems = S.systems.slice();
      const stages = Object.keys(S.levels);
      [["Buildings", buildings], ["Levels", levels], ["Zones", zones], ["Systems", systems], ["Cx stages", stages], ["Companies", companyList]].forEach(([title, arr], cIdx) => { lists.getCell(1, cIdx + 1).value = title; arr.forEach((v, rIdx) => { lists.getCell(rIdx + 2, cIdx + 1).value = v; }); });
      const headers = ["Description", "Company", "Building", "Level", "Zone / Room", "Asset", "System", "Cx Stage", "Planned start", "Duration (d)", "Committed", "Witness invite", "Witness date & time", "Notes"];
      const exA = S.areas[0] || ""; const exSub = (S.subAreas || []).find((s) => s.area === exA); const exT3 = exSub ? (S.tier3s || []).find((t) => t.area === exA && t.subArea === exSub.name) : null;
      const sub = exSub ? exSub.name : ""; const t3 = exT3 ? exT3.name : ""; const sys = S.systems[0] || ""; const lv = stages[0] || "L2";
      const start = fmtISO(new Date()); const pad = (n) => String(n).padStart(2, "0");
      const wit = (() => { const d = new Date(); d.setDate(d.getDate() + 5); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`; })();
      const ex1 = ["Example 1: terminate cables (DELETE before importing)", companyList[0] || "", exA, sub, t3, "", sys, lv, start, 3, "No", "No", "", "Set Company to whichever contractor owns the work. Delete this row"];
      const ex2 = ["Example 2: MV switchgear test (DELETE before importing)", companyList[1] || companyList[0] || "", exA, sub, t3, "EPOD108.DB001.U003", sys, lv, start, 2, "Yes", "Yes", wit, "Witness invite Yes needs a date and time. Delete this row"];
      ws.addRow(headers); ws.addRow(ex1); ws.addRow(ex2);
      ws.getRow(1).font = { bold: true };
      ws.columns.forEach((c, i) => { c.width = Math.max(12, String(headers[i] || "").length + 3); });
      const LAST = 400;
      [["Company", companyList.length, 6], ["Building", buildings.length, 1], ["Level", levels.length, 2], ["Zone / Room", zones.length, 3], ["System", systems.length, 4], ["Cx Stage", stages.length, 5]].forEach(([name, count, listCol]) => {
        const ci = headers.indexOf(name) + 1; if (ci < 1 || count < 1) return;
        const cl = colLetter(ci); const ll = colLetter(listCol);
        for (let r = 2; r <= LAST; r++) ws.getCell(`${cl}${r}`).dataValidation = { type: "list", allowBlank: true, showErrorMessage: false, formulae: [`Lists!$${ll}$2:$${ll}$${count + 1}`] };
      });
      const buf = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = "FIN04-activities-admin-template.xlsx"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { alert("Template failed: " + (e && e.message ? e.message : e)); }
    setTplBusy(false);
  };
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
      try { const res = await userOp({ op: "invite", email, name, role, company_id, redirect: window.location.origin }); out.push({ email, name, role, company: co ? co.name : "", link: res.link || "", status: "Created" + (res.link ? "" : " (link unavailable)") }); }
      catch (e) { out.push({ email, name, status: "Failed: " + (e.message || e) }); }
      setBulkResults([...out]);
    }
    setBulkBusy(false);
  };
  const downloadBulk = () => { const rows = (bulkResults || []).map((r) => [r.name || "", r.email, r.link || "", r.role || "", r.company || "", r.status]); downloadFile("FIN04-user-logins.csv", toCSV(["Name", "Email", "Set password link", "Role", "Company", "Status"], rows)); };
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
        if (obj.activities) { let c = obj.activities.reduce((m, a) => Math.max(m, a.code || 0), 0); n.activities = obj.activities.map((a) => ({ ...a, id: a.id || uid("a"), predecessors: Array.isArray(a.predecessors) ? a.predecessors : [], code: a.code != null ? a.code : ++c })); }
      } else {
        const map = {};
        if (obj.companies) { const companies = [...n.companies]; obj.companies.forEach((c) => { const ex = companies.find((x) => x.name.toLowerCase() === (c.name || "").toLowerCase()); if (ex) map[c.id] = ex.id; else { const nid = uid("co"); companies.push({ id: nid, name: c.name }); map[c.id] = nid; } }); n.companies = companies; }
        if (obj.areas) n.areas = [...new Set([...n.areas, ...obj.areas])];
        if (obj.subAreas) { const cur = [...(n.subAreas || [])]; obj.subAreas.forEach((s) => { if (!cur.some((x) => x.area === s.area && x.name === s.name)) cur.push({ area: s.area, name: s.name }); }); n.subAreas = cur; }
        if (obj.tier3s) { const cur = [...(n.tier3s || [])]; obj.tier3s.forEach((t) => { if (!cur.some((x) => x.area === t.area && x.subArea === t.subArea && x.name === t.name)) cur.push({ area: t.area, subArea: t.subArea, name: t.name }); }); n.tier3s = cur; }
        if (obj.systems) n.systems = [...new Set([...n.systems, ...obj.systems])];
        if (obj.activities) { const idMap = {}; obj.activities.forEach((a) => { idMap[a.id] = uid("a"); }); let c = nextCode(n.activities) - 1; const mapped = obj.activities.map((a) => ({ ...a, id: idMap[a.id], companyId: map[a.companyId] || a.companyId, predecessors: (Array.isArray(a.predecessors) ? a.predecessors : []).map((pid) => idMap[pid]).filter(Boolean), code: ++c })); n.activities = [...n.activities, ...mapped]; }
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
    const ci = { desc: idx(["description", "activity description", "activity", "desc"]), company: idx(["company", "contractor", "vendor"]), area: idx(["building", "area"]), subarea: idx(["level", "floor", "sub-area", "sub area", "subarea"]), tier3: idx(["zone", "room", "tier 3 area", "tier3 area", "tier 3", "tier3"]), asset: idx(["asset", "equipment", "tag"]), system: idx(["system"]), level: idx(["cx stage", "cx", "stage"]), ms: idx(["milestone"]), wit: idx(["witness invite", "witness"]), witat: idx(["witness date", "witness time", "witness date & time"]), notes: idx(["notes", "comment", "comments"]), pstart: idx(["planned start", "start"]), pfin: idx(["planned finish", "finish", "end"]), dur: idx(["duration", "days"]), astart: idx(["actual start"]), afin: idx(["actual finish"]), status: idx(["status"]), commit: idx(["committed", "commit"]), cons: idx(["constraints", "constraint"]) };
    const normDT = (s) => { if (!s) return ""; const d = new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) ? s.replace(" ", "T") : s); if (isNaN(d)) return ""; const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
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
      const newActs = []; let codeC = impMode === "override" ? 0 : p.activities.reduce((m, a) => Math.max(m, a.code || 0), 0);
      for (let r = 1; r < rows.length; r++) { const row = rows[r]; const g = (i) => (i >= 0 && i < row.length ? row[i].trim() : "");
        const desc = g(ci.desc); if (!desc) continue;
        const companyId = findCo(g(ci.company)); const area = g(ci.area); ensure(areas, area); const subArea = g(ci.subarea); ensureSub(area, subArea); const tier3 = g(ci.tier3); ensureT3(area, subArea, tier3); const asset = g(ci.asset); const system = g(ci.system); ensure(systems, system);
        let level = g(ci.level).toUpperCase(); if (!S.levels[level]) level = Object.keys(S.levels)[0] || "L2";
        const start = normDate(g(ci.pstart)); const pfin = normDate(g(ci.pfin)); const durRaw = g(ci.dur);
        let duration = 1; if (durRaw && +durRaw > 0) duration = +durRaw; else if (start && pfin) duration = Math.max(1, Math.round((parseD(pfin) - parseD(start)) / DAYMS) + 1);
        const consText = g(ci.cons); const constraints = consText ? consText.split(";").map((x) => x.trim()).filter(Boolean).map((x) => ({ id: uid("c"), text: x.replace(/^\[[ xX]\]\s*/, ""), done: /^\[[xX]\]/.test(x) })) : [];
        const yes = (v) => /^(y|yes|true|1)$/i.test(v);
        newActs.push({ id: uid("a"), code: ++codeC, predecessors: [], desc, companyId, area, subArea, tier3, asset, system, level, isMilestone: yes(g(ci.ms)), witnessInvite: yes(g(ci.wit)), witnessAt: normDT(g(ci.witat)), notes: g(ci.notes), start: start || fmtISO(new Date()), duration, committed: yes(g(ci.commit)), status: (g(ci.status) || "planned").toLowerCase().replace(/\s+/g, "_"), actualStart: normDate(g(ci.astart)), actualFinish: normDate(g(ci.afin)), constraints });
      }
      const activities = impMode === "override" ? newActs : [...p.activities, ...newActs];
      return { ...p, companies, areas, subAreas, tier3s, systems, activities };
    }, { action: `Import CSV (${impMode})`, detail: `${rows.length - 1} rows` });
    setImpMsg(`Imported ${rows.length - 1} CSV rows (${impMode}).`);
  };
  const cellToStr = (v) => { if (v == null) return ""; if (v instanceof Date) { const p = (n) => String(n).padStart(2, "0"); const dd = `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`; const hh = v.getUTCHours(), mm = v.getUTCMinutes(); return (hh || mm) ? `${dd}T${p(hh)}:${p(mm)}` : dd; } if (typeof v === "object") { if (v.text != null) return String(v.text); if (v.result != null) return String(v.result); if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join(""); if (v.hyperlink) return String(v.hyperlink); return ""; } return String(v); };
  const rowsToCSV = (rows) => rows.map((r) => r.map((c) => { const s = cellToStr(c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\n");
  const handleImportFile = async (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".xlsx")) {
        const _xl = await import("exceljs/dist/exceljs.min.js"); const ExcelJS = _xl.default || _xl;
        const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
        const ws = wb.getWorksheet("Activities") || wb.worksheets[0];
        const rows = []; ws.eachRow({ includeEmpty: false }, (row) => { const arr = []; row.eachCell({ includeEmpty: true }, (cell) => arr.push(cell.value)); rows.push(arr); });
        importCSV(rowsToCSV(rows));
      } else {
        const txt = (await file.text()).replace(/^\uFEFF/, "");
        if (name.endsWith(".json")) { const parsed = JSON.parse(txt); if (impMode === "override") importJSON(parsed); else setJsonPreview(parsed); } else importCSV(txt);
      }
    } catch (err) { setImpMsg("Import failed: " + (err && err.message ? err.message : "could not read file")); }
    e.target.value = "";
  };
  const navGroups = [
    ["Project setup", [["branding", "Branding"], ["levels", "Cx Stages"], ["systems", "Systems"], ["areas", "Locations"], ["companies", "Companies"], ["settings", "Lookahead"]]],
    ["User management", [["users", "Users"]]],
    ["Audit log", [["audit", "Audit"]]],
    ["Advanced", [["data", "Import / Export"]]],
    ["About", [["changelog", "Changelog"]]],
  ];
  return (
    <div className="lk-adminwrap2" style={cssVars(S.theme)}><style>{css}</style>
        <div className="lk-subnav">
          {navGroups.map(([g, items]) => <div key={g} className="grp"><div className="grphd">{g}</div>{items.map(([k, l]) => <button key={k} className={tab === k ? "sel" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>)}
        </div>
        <div className={"lk-subbody" + (tab === "users" || tab === "audit" ? " wide" : "")}><div className="lk-db">
          {(tab === "companies" || tab === "systems") && (() => {
            const label = tab === "companies" ? "company" : tab.slice(0, -1);
            const items = tab === "companies" ? S.companies.map((c) => [c.id, c.name, c.logoUrl || "", c.logoDark || ""]) : S[tab].map((x) => [x, x]);
            return <>
              <div className="lk-list">{items.map(([id, name, logo, logoDark]) => <div key={id} className="lk-li" style={tab === "companies" ? { flexWrap: "wrap", gap: 6 } : undefined}>{tab === "systems"
                ? <input className="lk-in" key={"sys:" + name} defaultValue={name} style={{ flex: 1 }} title="Rename system (updates every activity using it)" onKeyDown={(e) => { if (e.key === "Enter") { renameSystem(name, e.target.value); e.target.blur(); } else if (e.key === "Escape") { e.target.value = name; e.target.blur(); } }} onBlur={(e) => renameSystem(name, e.target.value)} />
                : <><span className="g" style={{ flex: 1, minWidth: 90 }}>{name}</span>
                  {[["light", "Light", logo], ["dark", "Dark", logoDark]].map(([k, lbl, url]) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--line)", borderRadius: 7, padding: "2px 4px 2px 7px", background: k === "dark" ? "#0f172a" : "transparent" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 10.5, color: k === "dark" ? "#cbd5e1" : "var(--muted)" }} title={"Upload the " + lbl.toLowerCase() + "-mode logo for " + name}>
                      {url ? <img src={url} alt="" style={{ height: 18, maxWidth: 56, objectFit: "contain" }} /> : <Icon n="upload" s={11} />}<span>{lbl}</span>
                      <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; try { const u = await uploadCompanyLogo(f, id); update((p) => ({ ...p, companies: p.companies.map((c) => c.id === id ? { ...c, [k === "dark" ? "logoDark" : "logoUrl"]: u } : c) }), { action: "Company logo set", detail: name + " (" + lbl + ")" }); } catch (x) { alert("Logo upload failed: " + (x.message || x)); } e.target.value = ""; }} />
                    </label>
                    {url && <button title={"Remove " + lbl.toLowerCase() + " logo"} style={{ padding: 2 }} onClick={() => update((p) => ({ ...p, companies: p.companies.map((c) => c.id === id ? { ...c, [k === "dark" ? "logoDark" : "logoUrl"]: "" } : c) }), { action: "Company logo removed", detail: name + " (" + lbl + ")" })}><Icon n="x" s={11} /></button>}
                  </span>)}
                </>}<button onClick={() => delList(tab, id, label)}><Icon n="trash" s={14} /></button></div>)}</div>
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
          {tab === "users" && <div className="lk-userwrap"><div className="lk-usermain">
            <div className="lk-ufilter">
              <div className="lk-f" style={{ minWidth: 150, flex: 1 }}><label>Search</label><input className="lk-in" placeholder="Name or email…" value={uq} onChange={(e) => setUq(e.target.value)} /></div>
              <div className="lk-f" style={{ minWidth: 150 }}><label>Company</label><select className="lk-select" value={uCo} onChange={(e) => setUCo(e.target.value)}><option value="all">All companies</option><option value="none">No company</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="lk-f" style={{ minWidth: 100 }}><label>Role</label><select className="lk-select" value={uRole} onChange={(e) => setURole(e.target.value)}><option value="all">All roles</option><option value="member">Members</option><option value="admin">Admins</option></select></div>
              <div className="lk-f" style={{ minWidth: 110 }}><label>Invite</label><select className="lk-select" value={uInvite} onChange={(e) => setUInvite(e.target.value)}><option value="all">All</option><option value="pending">Pending</option><option value="accepted">Accepted</option></select></div>
            </div>
            {(() => {
              const cn = (id) => (S.companies.find((c) => c.id === id) || {}).name || "";
              const q = uq.trim().toLowerCase();
              const filtered = S.users.filter((u) => {
                if (uRole !== "all" && u.role !== uRole) return false;
                if (uCo === "none") { if (u.companyId) return false; } else if (uCo !== "all" && u.companyId !== uCo) return false;
                if (uInvite !== "all") { const accepted = !!(ustat[u.id] && ustat[u.id].lastSignIn); if (uInvite === "accepted" && !accepted) return false; if (uInvite === "pending" && accepted) return false; }
                if (q && !(`${u.name || ""} ${cn(u.companyId)}`.toLowerCase().includes(q))) return false;
                return true;
              });
              const groups = {};
              filtered.forEach((u) => { const key = u.role === "admin" ? "\u0000Admins" : (cn(u.companyId) || "\uffffNo company"); (groups[key] = groups[key] || []).push(u); });
              const renderRow = (u) => { const seen = ustat[u.id] && ustat[u.id].lastSignIn; return <div key={u.id} className="lk-urow">
                <input className="lk-in" key={u.id + ":" + u.name} defaultValue={u.name} title={u.id === S.currentUserId ? "Your display name" : "Display name"} placeholder="Name"
                  style={{ width: "100%", minWidth: 0, padding: "5px 8px", fontSize: 12, border: u.id === S.currentUserId ? "1px solid var(--accent)" : undefined }}
                  onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== u.name) userOp({ op: "update", id: u.id, name: v }).then(() => setUserMsg("Name updated")).catch((x) => setUserMsg("Failed: " + (x.message || x))); }} />
                <select className="lk-select" style={{ width: "100%", padding: "5px 7px", fontSize: 11.5 }} value={u.role} onChange={(e) => userOp({ op: "update", id: u.id, role: e.target.value, company_id: e.target.value === "admin" ? null : u.companyId }).catch((x) => setUserMsg("Failed: " + (x.message || x)))}><option value="member">Member</option><option value="admin">Admin</option></select>
                <select className="lk-select" style={{ width: "100%", minWidth: 0, padding: "5px 7px", fontSize: 11.5 }} value={u.companyId || ""} disabled={u.role === "admin"} onChange={(e) => userOp({ op: "update", id: u.id, company_id: e.target.value }).catch((x) => setUserMsg("Failed: " + (x.message || x)))}><option value="">--</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                <span style={{ justifySelf: "start" }}>{seen
                  ? <span className="lk-chip" style={{ background: "#DBF3EC", color: "#0E6B5C", textTransform: "none", whiteSpace: "nowrap" }} title={"Last seen " + new Date(seen).toLocaleString("en-GB")}>accepted &middot; {relTime(seen)}</span>
                  : <span className="lk-chip" style={{ background: "#FBEFD6", color: "#9A6A00", textTransform: "none" }} title="Invite not yet accepted (no sign-in recorded)">pending</span>}</span>
                <div className="lk-uacts">
                  <button title="View this user's audit trail" onClick={() => { setAuditUser(u.name); setAuditOpen(true); setTab("audit"); }} style={{ fontSize: 13, lineHeight: 1 }}>{"\uD83D\uDCDC"}</button>
                  <button title="Get a fresh set-password link" onClick={() => sendLink(u.id, u.name)} style={{ fontSize: 13, lineHeight: 1 }}>🔗</button>
                  <button title="Reset password" onClick={() => resetPw(u.id, u.name)} style={{ fontSize: 14, lineHeight: 1 }}>↻</button>
                  {u.id !== S.currentUserId ? <button title="Remove user" onClick={() => delUser(u.id, u.name)}><Icon n="trash" s={14} /></button> : <span style={{ width: 20 }} />}
                </div>
              </div>; };
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
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 8 }}>Format per line: email, name, role, company. Role is member or admin (defaults to member). Company must match a contractor name exactly; leave blank for admins. Each person gets their own set-password link in the downloadable CSV. No email is sent from here, mail-merge the CSV from Outlook.</div>
              <button className="lk-btn primary" disabled={bulkBusy} onClick={bulkCreate}>{bulkBusy ? `Creating… (${(bulkResults || []).length})` : "Create all"}</button>
              {bulkResults && <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{bulkResults.filter((r) => r.status.startsWith("Created")).length} created, {bulkResults.filter((r) => !r.status.startsWith("Created")).length} need attention</div>
                <div className="lk-list" style={{ maxHeight: 200, overflow: "auto" }}>{bulkResults.map((r, i) => <div key={i} className="lk-li" style={{ fontSize: 11 }}><span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{r.email}</span><span style={{ fontSize: 10, color: r.status.startsWith("Created") ? (r.link ? "var(--muted)" : "#E0A106") : "#C0392B" }}>{r.status.startsWith("Created") ? (r.link ? "link ready" : "no link") : r.status}</span></div>)}</div>
                <button className="lk-btn" style={{ marginTop: 8 }} disabled={bulkBusy} onClick={downloadBulk}><Icon n="download" s={13} />Download logins CSV (set-password links)</button>
              </div>}
            </div>
            </div>
            <div className="lk-userside"><LatestOnline users={S.users} ustat={ustat} pres={pres} /></div>
          </div>}
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
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
                {[["light", "Light mode", S.brand?.logoUrl, false, "#ffffff"], ["dark", "Dark mode", S.brand?.logoDark, true, "#0f172a"]].map(([k, lbl, url, dark, bg]) => <div key={k} style={{ flex: "1 1 170px" }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4 }}>{lbl}</div>
                  <div style={{ background: bg, border: "1px solid var(--line)", borderRadius: 8, padding: 8, minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {url ? <img src={url} alt="" style={{ height: 40, maxWidth: 160, objectFit: "contain" }} /> : <span style={{ fontSize: 11, color: "#94a3b8" }}>none</span>}
                  </div>
                  <input className="lk-in" style={{ marginTop: 6 }} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={async (e) => {
                    const f = e.target.files && e.target.files[0]; if (!f) return;
                    setBrandMsg("Uploading " + lbl + " logo…");
                    try { const u = await uploadLogo(f, dark); update((p) => ({ ...p, brand: { ...p.brand, [dark ? "logoDark" : "logoUrl"]: u } })); setBrandMsg(lbl + " logo updated"); }
                    catch (x) { setBrandMsg("Failed: " + (x.message || x)); }
                    e.target.value = "";
                  }} />
                  {url && <button className="lk-btn" style={{ marginTop: 6, fontSize: 11 }} onClick={async () => { try { await updateBranding({ [dark ? "logo_url_dark" : "logo_url"]: null }); update((p) => ({ ...p, brand: { ...p.brand, [dark ? "logoDark" : "logoUrl"]: null } })); setBrandMsg(lbl + " logo removed"); } catch (x) { setBrandMsg("Failed: " + (x.message || x)); } }}>Remove</button>}
                </div>)}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>PNG, JPG, SVG or WebP, wide transparent PNG looks best. Set one for each theme; if you set only one, it is used in both modes.</div>
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
              <span style={{ fontWeight: 700, fontSize: 11, width: 28 }}>{k}</span>
              <input className="lk-in" value={v.name} onChange={(e) => update((p) => ({ ...p, levels: { ...p.levels, [k]: { ...p.levels[k], name: e.target.value } } }))} />
              <button title="Delete Cx stage" onClick={() => delLevel(k)}><Icon n="trash" s={14} /></button>
            </div>)}
            <div className="lk-add" style={{ marginTop: 4 }}>
              <input type="color" value={lvColor} onChange={(e) => setLvColor(e.target.value)} style={{ width: 36, height: 30, padding: 0, border: "1px solid var(--line)", borderRadius: 6, background: "transparent", cursor: "pointer" }} />
              <input className="lk-in mono" placeholder="Key (e.g. L5 or L4a)" value={lvKey} onChange={(e) => setLvKey(e.target.value)} style={{ maxWidth: 130 }} onKeyDown={(e) => e.key === "Enter" && addLevel()} />
              <input className="lk-in" placeholder="Name (e.g. Integrated systems test)" value={lvName} onChange={(e) => setLvName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLevel()} />
              <button className="lk-btn primary" onClick={addLevel}><Icon n="plus" s={15} /></button>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 4 }}>Add as many Cx stages or sub-steps as the project needs. Leave the key blank to auto-number, or set your own (L5, L4a, IST). Deleting a stage moves any activities on it to the first remaining stage.</div>
          </div>}
          {tab === "data" && <>
            <div className="lk-f"><label>Templates</label>
              <div className="lk-row" style={{ flexWrap: "wrap" }}>
                <button className="lk-btn primary" disabled={tplBusy} onClick={downloadAdminTemplate}><Icon n="download" s={14} />{tplBusy ? "Building…" : "Excel template (with dropdowns)"}</button>
                <button className="lk-btn" onClick={downloadCsvTemplate}><Icon n="download" s={14} />CSV template</button>
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5, marginTop: 6 }}>Admin import: set the <b style={{ color: "var(--ink)" }}>Company</b> column per row, so you can load work for every contractor in one file. The Excel template carries dropdowns for Company, Building, Level, Zone / Room, System and Cx stage pre-loaded with this project's values, but you may type new ones too: any Building, Level, Zone / Room or System that does not yet exist is created on import. Required on every row: Description, Building, System and Planned start. Dates use YYYY-MM-DD; Witness invite Yes needs a Witness date &amp; time (YYYY-MM-DD HH:MM). Delete the two example rows before importing. Choose Append to merge or Override to replace below.</div>
            </div>
            <div className="lk-f"><label>Export</label>
              <div className="lk-row"><button className="lk-btn" onClick={exportActivities}><Icon n="download" s={14} />Activities (CSV)</button>
                <button className="lk-btn" onClick={exportProject}><Icon n="download" s={14} />Project (JSON)</button></div></div>
            <div className="lk-f"><label>Import mode</label>
              <div className="lk-status"><button className={impMode === "append" ? "sel" : ""} onClick={() => setImpMode("append")}>Append</button><button className={impMode === "override" ? "sel" : ""} onClick={() => setImpMode("override")}>Override</button></div></div>
            <div className="lk-f"><label>Import file (.xlsx or .csv activities, or .json project)</label>
              <input className="lk-in" type="file" accept=".json,.csv,.xlsx" onChange={handleImportFile} /></div>
            <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>JSON sets up the whole project: companies, buildings, levels, zones/rooms, systems, Cx stages, settings and activities. CSV imports activities and auto-creates any new company, building, level, zone/room or system it names, so a CSV alone can stand a project up. Columns are Building, Level, Zone / Room and Cx Stage. Override replaces the project wholesale; Append in JSON opens a review screen where you overwrite, ignore or clone each clashing item.</div>
            {impMsg && <div className="lk-pv" style={{ borderRadius: 8, border: "1px solid var(--line)" }}><Icon n="alert" s={13} />{impMsg}</div>}
          </>}
          {tab === "audit" && <>
            <div className="lk-pv" style={{ borderRadius: 8, border: "1px solid var(--line)" }}><Icon n="alert" s={13} />Complete history of every action by every user, admin only. In production the database writes this on every change and it cannot be edited here.</div>
            <div className="lk-f"><label>Filter by user</label>
              <select className="lk-select" value={auditUser} onChange={(e) => setAuditUser(e.target.value)}>
                <option value="all">All users ({S.audit.length})</option>
                {S.users.map((u) => <option key={u.id} value={u.name}>{u.name} ({S.audit.filter((e) => e.user === u.name).length})</option>)}
              </select></div>
            <div className="lk-f"><label>Search</label><input className="lk-in" placeholder="Search action, detail or user…" value={auditQ} onChange={(e) => setAuditQ(e.target.value)} /></div>
            {(() => { const qq = auditQ.trim().toLowerCase();
              const flt = (e) => (auditUser === "all" || e.user === auditUser) && (!qq || `${e.action || ""} ${e.detail || ""} ${e.user || ""}`.toLowerCase().includes(qq));
              const list = S.audit.filter(flt);
              return <>
                <button className="lk-btn" onClick={() => { const rows = list.map((e) => [e.ts, e.user, e.action, e.detail]); downloadFile(`FIN04-audit-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(["Timestamp", "User", "Action", "Detail"], rows)); }}><Icon n="download" s={14} />Export audit (CSV)</button>
                <button className="lk-btn" style={{ marginTop: 4 }} onClick={() => setAuditOpen((o) => !o)}><span style={{ display: "inline-flex", transform: auditOpen ? "rotate(90deg)" : "none", transition: "transform .12s" }}><Icon n="cr" s={13} /></span>{auditOpen ? "Hide" : "Show"} log ({list.length} {list.length === 1 ? "entry" : "entries"})</button>
                {auditOpen && (list.length === 0
                  ? <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>No actions match this selection.</div>
                  : <div style={{ marginTop: 8 }}>{list.map((e) => <div key={e.id} className="lk-audit"><span className="a">{e.action}: <span style={{ fontWeight: 400 }}>{e.detail}</span></span><span className="m">{e.user} · {new Date(e.ts).toLocaleString("en-GB")}</span></div>)}</div>)}
              </>; })()}
          </>}
          {tab === "changelog" && <>
            <div className="lk-pv" style={{ borderRadius: 8, border: "1px solid var(--line)" }}><Icon n="alert" s={13} />What changed in DLP, newest first. Each revision lists the changes shipped in it. Admin only.</div>
            <div style={{ marginTop: 6 }}>{CHANGELOG.map((r) => <div key={r.rev} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                <span className="mono" style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{r.rev}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{r.date}</span>
                <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>{r.items.map((it, i) => <li key={i} style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.5 }}>{it}</li>)}</ul>
            </div>)}</div>
          </>}
        </div></div>
      {jsonPreview && <ImportReview obj={jsonPreview} S={S} onClose={() => setJsonPreview(null)} onApply={(producer, detail) => { update(producer, { action: "Import JSON (merge)", detail }); setJsonPreview(null); setImpMsg("Imported JSON with your conflict choices."); }} />}
    </div>);
}

function ImportReview({ obj, S, onClose, onApply }) {
  const lc = (s) => (s || "").toLowerCase();
  const akey = (a) => [lc(a.desc), lc(a.area), lc(a.subArea), lc(a.system), a.start || ""].join("|");
  const [def, setDef] = useState("overwrite");
  const [lvlCh, setLvlCh] = useState({});
  const [actCh, setActCh] = useState({});
  const [setCh, setSetCh] = useState("overwrite");

  const newCompanies = (obj.companies || []).filter((c) => !S.companies.some((x) => lc(x.name) === lc(c.name)));
  const newAreas = (obj.areas || []).filter((a) => !S.areas.some((x) => lc(x) === lc(a)));
  const newSubs = (obj.subAreas || []).filter((s) => !(S.subAreas || []).some((x) => x.area === s.area && lc(x.name) === lc(s.name)));
  const newT3 = (obj.tier3s || []).filter((t) => !(S.tier3s || []).some((x) => x.area === t.area && x.subArea === t.subArea && lc(x.name) === lc(t.name)));
  const newSystems = (obj.systems || []).filter((s) => !S.systems.some((x) => lc(x) === lc(s)));
  const inLevels = obj.levels ? Object.entries(obj.levels) : [];
  const lvlConf = inLevels.filter(([k]) => S.levels[k]);
  const lvlNew = inLevels.filter(([k]) => !S.levels[k]);
  const exActByKey = new Map(S.activities.map((a) => [akey(a), a]));
  const inActs = obj.activities || [];
  const actConf = inActs.filter((a) => exActByKey.has(akey(a)));
  const actNew = inActs.filter((a) => !exActByKey.has(akey(a)));
  const hasSettings = !!obj.settings;
  const setDiff = hasSettings && (obj.settings.weeks !== S.settings.weeks || obj.settings.makeReadyDays !== S.settings.makeReadyDays);

  const eff = (map, key) => map[key] || def;
  const Seg = ({ value, onChange, three = true }) => <div className="lk-status" style={{ display: "inline-flex" }}>{[["overwrite", "Overwrite"], ["ignore", "Ignore"], ...(three ? [["clone", "Clone"]] : [])].map(([v, l]) => <button key={v} className={value === v ? "sel" : ""} style={{ fontSize: 11, padding: "3px 9px" }} onClick={() => onChange(v)}>{l}</button>)}</div>;
  const coName = (id) => (S.companies.find((c) => c.id === id) || {}).name || "";

  const apply = () => {
    onApply((p) => {
      let n = { ...p };
      const companies = [...n.companies]; const coMap = {};
      (obj.companies || []).forEach((c) => { const ex = companies.find((x) => lc(x.name) === lc(c.name)); if (ex) coMap[c.id] = ex.id; else { const nid = uid("co"); companies.push({ id: nid, name: c.name }); coMap[c.id] = nid; } });
      n.companies = companies;
      n.areas = [...new Set([...n.areas, ...(obj.areas || [])])];
      { const cur = [...(n.subAreas || [])]; (obj.subAreas || []).forEach((s) => { if (!cur.some((x) => x.area === s.area && lc(x.name) === lc(s.name))) cur.push({ area: s.area, name: s.name }); }); n.subAreas = cur; }
      { const cur = [...(n.tier3s || [])]; (obj.tier3s || []).forEach((t) => { if (!cur.some((x) => x.area === t.area && x.subArea === t.subArea && lc(x.name) === lc(t.name))) cur.push({ area: t.area, subArea: t.subArea, name: t.name }); }); n.tier3s = cur; }
      n.systems = [...new Set([...n.systems, ...(obj.systems || [])])];
      const lv = { ...n.levels }; const lvMap = {};
      inLevels.forEach(([k, v]) => { if (!lv[k]) { lv[k] = { name: v.name, color: v.color, sort: Object.keys(lv).length }; lvMap[k] = k; } else { const c = eff(lvlCh, k); if (c === "overwrite") { lv[k] = { ...lv[k], name: v.name, color: v.color }; lvMap[k] = k; } else if (c === "ignore") { lvMap[k] = k; } else { let nk = k + "b"; let i = 2; while (lv[nk]) { i++; nk = k + String.fromCharCode(96 + i); } lv[nk] = { name: v.name + " (imported)", color: v.color, sort: Object.keys(lv).length }; lvMap[k] = nk; } } });
      n.levels = lv;
      const idMap = {}; let codeC = n.activities.reduce((m, a) => Math.max(m, a.code || 0), 0); const replaceMap = {}; const toAdd = [];
      inActs.forEach((a) => { const key = akey(a); const ex = exActByKey.get(key); if (!ex) { const nid = uid("a"); idMap[a.id] = nid; toAdd.push({ src: a, id: nid }); } else { const c = eff(actCh, key); if (c === "ignore") { idMap[a.id] = ex.id; } else if (c === "overwrite") { idMap[a.id] = ex.id; replaceMap[ex.id] = a; } else { const nid = uid("a"); idMap[a.id] = nid; toAdd.push({ src: a, id: nid }); } } });
      const build = (src, id, code) => ({ ...src, id, companyId: coMap[src.companyId] || src.companyId, level: lvMap[src.level] || src.level, predecessors: (Array.isArray(src.predecessors) ? src.predecessors : []).map((pid) => idMap[pid]).filter(Boolean), code, constraints: Array.isArray(src.constraints) ? src.constraints : [] });
      let acts = n.activities.map((a) => { const src = replaceMap[a.id]; return src ? build(src, a.id, a.code) : a; });
      toAdd.forEach(({ src, id }) => acts.push(build(src, id, ++codeC)));
      n.activities = acts;
      if (hasSettings && setCh !== "ignore") n.settings = { ...n.settings, ...obj.settings };
      return n;
    }, `${actNew.length} added, ${actConf.length} matched activities`);
  };

  const conflicts = lvlConf.length + actConf.length + (setDiff ? 1 : 0);
  const Row = ({ children }) => <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 12.5 }}>{children}</div>;

  return (
    <div className="lk-bg" onClick={onClose}><style>{css}</style>
      <div style={{ background: "var(--card)", color: "var(--ink)", borderRadius: 14, border: "1px solid var(--line)", width: "min(720px,94vw)", maxHeight: "88vh", overflow: "auto", padding: "20px 22px", margin: "auto", ...cssVars(S.theme) }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><h3 style={{ margin: 0 }}>Review project import</h3><button className="lk-btn icon" onClick={onClose}><Icon n="x" /></button></div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55, marginBottom: 12 }}>New project setup data is merged in automatically. Where the file collides with something already here, choose what to do. Overwrite replaces the existing item, Ignore keeps what you have, Clone adds the incoming one alongside under a new name.</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Default for conflicts</span>
          <Seg value={def} onChange={setDef} />
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{conflicts} conflict{conflicts === 1 ? "" : "s"} found</span>
        </div>

        <div style={{ background: "var(--hover)", borderRadius: 8, padding: "9px 12px", fontSize: 12, marginBottom: 14 }}>
          <b style={{ color: "var(--ink)" }}>Added automatically:</b> {newCompanies.length} compan{newCompanies.length === 1 ? "y" : "ies"}, {newAreas.length} building{newAreas.length === 1 ? "" : "s"}, {newSubs.length} level{newSubs.length === 1 ? "" : "s"}, {newT3.length} zone{newT3.length === 1 ? "" : "s"}, {newSystems.length} system{newSystems.length === 1 ? "" : "s"}, {lvlNew.length} new Cx stage{lvlNew.length === 1 ? "" : "s"}, {actNew.length} new activit{actNew.length === 1 ? "y" : "ies"}. Existing matches are left as-is unless you choose otherwise below.
        </div>

        {lvlConf.length > 0 && <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 4 }}>Cx stages already on the project ({lvlConf.length})</div>
          {lvlConf.map(([k, v]) => <Row key={k}><span><span className="mono" style={{ fontWeight: 700 }}>{k}</span> &middot; file: {v.name}{S.levels[k] && S.levels[k].name !== v.name ? <span style={{ color: "var(--muted)" }}> (here: {S.levels[k].name})</span> : null}</span><Seg value={eff(lvlCh, k)} onChange={(val) => setLvlCh((m) => ({ ...m, [k]: val }))} /></Row>)}
        </div>}

        {actConf.length > 0 && <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700 }}>Activities that match existing work ({actConf.length})</span>
            <span style={{ display: "inline-flex", gap: 5 }}>{[["overwrite", "All overwrite"], ["ignore", "All ignore"], ["clone", "All clone"]].map(([v, l]) => <button key={v} className="lk-btn" style={{ fontSize: 10.5, padding: "2px 7px" }} onClick={() => { const m = {}; actConf.forEach((a) => { m[akey(a)] = v; }); setActCh(m); }}>{l}</button>)}</span>
          </div>
          <div style={{ maxHeight: 260, overflow: "auto" }}>
            {actConf.map((a) => { const key = akey(a); return <Row key={key}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{a.desc || "Untitled"} <span style={{ color: "var(--muted)" }}>&middot; {coName(a.companyId) || a.companyId} &middot; {[a.area, a.subArea, a.tier3].filter(Boolean).join(" / ")}</span></span><Seg value={eff(actCh, key)} onChange={(val) => setActCh((m) => ({ ...m, [key]: val }))} /></Row>; })}
          </div>
        </div>}

        {setDiff && <div style={{ marginBottom: 14 }}>
          <Row><span><b>Project settings</b> <span style={{ color: "var(--muted)" }}>(lookahead {obj.settings.weeks}w, make-ready {obj.settings.makeReadyDays}d vs here {S.settings.weeks}w / {S.settings.makeReadyDays}d)</span></span><Seg value={setCh} onChange={setSetCh} three={false} /></Row>
        </div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <button className="lk-btn" onClick={onClose}>Cancel</button>
          <button className="lk-btn primary" onClick={apply}><Icon n="check" s={15} />Apply import</button>
        </div>
      </div>
    </div>);
}

function DrillModal({ title, items, S, LV, coName, onOpen, onClose }) {
  return (
    <div className="lk-bg" onClick={onClose}>
      <div className="ytt drill" style={cssVars(S.theme)} onClick={(e) => e.stopPropagation()}>
        <div className="ytt-head">
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}><Icon n="chart" s={17} /><h3 style={{ margin: 0, fontSize: 15.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h3><span className="ytt-sub">{items.length} activit{items.length === 1 ? "y" : "ies"}</span></div>
          <button className="lk-btn icon" onClick={onClose}><Icon n="x" /></button>
        </div>
        <div className="drill-body">
          {items.length === 0 ? <div className="ytt-empty" style={{ padding: 16 }}>No activities in this slice.</div>
            : items.slice().sort((a, b) => (a.start || "").localeCompare(b.start || "")).map((a) => { const lv = lvOf(LV, a.level); const open = (a.constraints || []).filter((c) => !c.done).length;
              return <div key={a.id} className="drill-row" style={{ borderLeftColor: lv.color }} onClick={() => onOpen && onOpen(a)} title="Open activity">
                <div className="drill-main">
                  <span className="drill-desc">{a.desc || "Untitled"}</span>
                  <span className="drill-sub">{coName(a.companyId)} {"\u00b7"} {a.level || "-"} {"\u00b7"} {a.start || "no date"}{a.duration ? " (" + a.duration + "d)" : ""}</span>
                </div>
                <div className="drill-tags">
                  {a.status === "complete" ? <span className="lk-chip" style={{ background: "#DBF3EC", color: "#0E6B5C", textTransform: "none" }}>done</span> : open ? <span className="lk-chip" style={{ background: "#FBEFD6", color: "#9A6A00", textTransform: "none" }}>{open} open</span> : null}
                  {a.committed && <span className="lk-chip commit">will</span>}
                  {a.witnessInvite && <span className="lk-chip wit">WIT</span>}
                </div>
              </div>; })}
        </div>
      </div>
    </div>);
}

function SchedulePage({ S, coName, onOpen }) {
  const [zoom, setZoom] = useState("week");
  const [groupBy, setGroupBy] = useState("level");
  const [colorBy, setColorBy] = useState("level");
  const [showResp, setShowResp] = useState(true);
  const [showDeps, setShowDeps] = useState(true);
  const [compact, setCompact] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [view, setView] = useState("gantt");
  const [drill, setDrill] = useState(null);
  const openDrill = (title, items) => setDrill({ title, items: items || [] });
  const svgRef = useRef(null);
  const LV = S.levels || {};
  const dark = S.theme === "dark";
  const P = dark
    ? { bg: "#10151C", grid: "#222C39", gridStrong: "#2E3B4B", band: "#1E2733", band2: "#222C39", header: "#202B38", row: "#151D27", sep: "#1B232E", line: "#2E3B4B", ink: "#E6EAF0", mut: "#8A97A6", rollup: "#9FB0C3", today: "#6B9BF2" }
    : { bg: "#FFFFFF", grid: "#EAEEF4", gridStrong: "#D6DCE6", band: "#EEF1F6", band2: "#F4F6FA", header: "#EEF1F6", row: "#FBFCFE", sep: "#F0F3F8", line: "#C9D2DE", ink: "#0F1419", mut: "#8A93A2", rollup: "#334155", today: "#2563EB" };

  const acts = S.activities.filter((a) => a.start);
  const byId = Object.fromEntries(acts.map((a) => [a.id, a]));
  const PAL = ["#2563EB", "#0E9384", "#D97706", "#7C3AED", "#DB2777", "#0891B2", "#65A30D", "#DC2626", "#475569"];
  const coColor = (id) => { if (!id) return "#94A3B8"; let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return PAL[h % PAL.length]; };
  const colorOf = (a) => colorBy === "company" ? coColor(a.companyId) : colorBy === "status" ? (a.status === "complete" ? "#0E9384" : a.status === "in_progress" ? "#2563EB" : "#94A3B8") : ((LV[a.level] || {}).color || "#64748B");
  const pct = (a) => a.status === "complete" ? 100 : a.status === "in_progress" ? (a.actualStart ? Math.min(95, Math.max(5, Math.round((todayMid() - parseD(a.actualStart).getTime()) / DAYMS / Math.max(1, a.duration) * 100))) : 50) : 0;
  const groupKey = (a) => groupBy === "none" ? "" : groupBy === "company" ? coName(a.companyId) : groupBy === "area" ? (a.area || "Unassigned") : groupBy === "system" ? (a.system || "Unassigned") : (a.level + " " + ((LV[a.level] || {}).name || ""));

  // timeline bounds (snapped to whole weeks)
  let t0, t1;
  if (acts.length) {
    const starts = acts.map((a) => parseD(a.start).getTime());
    const ends = acts.map((a) => addDays(parseD(a.start), a.duration - 1).getTime());
    t0 = mondayOf(new Date(Math.min(...starts)));
    t1 = new Date(Math.max(...ends));
  } else { t0 = mondayOf(new Date()); t1 = addDays(t0, 28); }
  // forward pass for projected (forecast) ends, in day-offsets from t0
  const dayOff = (d) => Math.round((d.getTime() - t0.getTime()) / DAYMS);
  const proj = {}; { const memo = {}, stk = {}; const pe = (id) => { const a = byId[id]; if (!a) return null; if (memo[id] !== undefined) return memo[id]; const planEnd = dayOff(addDays(parseD(a.start), a.duration - 1)); if (stk[id]) return planEnd; stk[id] = true; let so = dayOff(parseD(a.start)); (a.predecessors || []).forEach((pid) => { const e = pe(pid); if (e != null) so = Math.max(so, e + 1); }); const eo = (a.status === "complete" && a.actualFinish) ? dayOff(parseD(a.actualFinish)) : so + (a.duration - 1); stk[id] = false; proj[id] = { so, eo }; memo[id] = eo; return eo; }; acts.forEach((a) => pe(a.id)); acts.forEach((a) => { if (!proj[a.id]) proj[a.id] = { so: dayOff(parseD(a.start)), eo: dayOff(addDays(parseD(a.start), a.duration - 1)) }; t1 = new Date(Math.max(t1.getTime(), addDays(t0, proj[a.id].eo).getTime())); }); }
  t1 = addDays(mondayOf(addDays(t1, 7)), 6); // pad to end of week
  const N = Math.max(7, dayOff(t1) + 1);

  const ppd = zoom === "day" ? 30 : zoom === "week" ? 9.6 : 4.4;
  const rowH = compact ? 22 : 30, headH = 46, leftW = 300;
  const tlW = N * ppd, W = leftW + tlW;

  // ordered rows: group headers + tasks
  const rows = [];
  const groupTasks = {};
  if (groupBy === "none") {
    acts.slice().sort((a, b) => (a.start || "").localeCompare(b.start || "")).forEach((a) => rows.push({ t: "task", a }));
  } else {
    acts.forEach((a) => { const k = groupKey(a); (groupTasks[k] = groupTasks[k] || []).push(a); });
    Object.keys(groupTasks).sort().forEach((k) => { rows.push({ t: "grp", k, n: groupTasks[k].length }); if (!collapsed[k]) groupTasks[k].slice().sort((a, b) => (a.start || "").localeCompare(b.start || "")).forEach((a) => rows.push({ t: "task", a })); });
  }
  const H = headH + rows.length * rowH + 8;

  // set of activities that are a predecessor of something (have outgoing links)
  const hasOut = new Set(); acts.forEach((a) => (a.predecessors || []).forEach((pid) => hasOut.add(pid)));

  // geometry per task id
  const geo = {};
  rows.forEach((r, i) => { if (r.t !== "task") return; const a = r.a; const y = headH + i * rowH; const pS = dayOff(parseD(a.start)); const x = leftW + pS * ppd; const w = Math.max(a.duration * ppd, 5); geo[a.id] = { x, w, y, yc: y + rowH / 2, pE: pS + a.duration - 1, ms: !!a.isMilestone }; });

  const xOf = (off) => leftW + off * ppd;
  const todayX = leftW + dayOff(new Date(todayMid())) * ppd;

  // month + unit gridlines
  const months = []; { let d = new Date(t0.getFullYear(), t0.getMonth(), 1); while (d <= t1) { const next = new Date(d.getFullYear(), d.getMonth() + 1, 1); const xs = xOf(Math.max(0, dayOff(d < t0 ? t0 : d))); const xe = xOf(dayOff(next > t1 ? t1 : next)); months.push({ label: d.toLocaleString("en-GB", { month: "short", year: "2-digit" }), xs, xe }); d = next; } }
  const ticks = []; { for (let i = 0; i <= N; i++) { const d = addDays(t0, i); const isMon = d.getDay() === 1; const first = d.getDate() === 1; if (zoom === "day") { ticks.push({ x: xOf(i), label: String(d.getDate()), strong: isMon }); } else if (zoom === "week") { if (isMon) ticks.push({ x: xOf(i), label: String(d.getDate()), strong: false }); } else { if (first) ticks.push({ x: xOf(i), label: "", strong: true }); } } }

  const text = (x, y, s, o = {}) => <text x={x} y={y} fontFamily="Segoe UI, Arial, sans-serif" fill={o.fill || P.ink} fontSize={o.size || 11} fontWeight={o.weight || 400} textAnchor={o.anchor || "start"} dominantBaseline={o.baseline || "middle"} style={{ pointerEvents: "none" }}>{s}</text>;
  const drawArrow = (g1, g2, dashed, key) => {
    const ax1 = g1.ms ? g1.x + 6 : g1.x + g1.w, ay1 = g1.yc, tip = g2.ms ? g2.x - 6 : g2.x, ay2 = g2.yc, gap = 8;
    let d;
    if (tip >= ax1 + gap + 8) { d = `M ${ax1} ${ay1} H ${ax1 + gap} V ${ay2} H ${tip - 5}`; }
    else { const backY = ay1 + (ay2 >= ay1 ? rowH / 2 : -rowH / 2); d = `M ${ax1} ${ay1} H ${ax1 + gap} V ${backY} H ${tip - gap} V ${ay2} H ${tip - 5}`; }
    return <g key={key} style={{ pointerEvents: "none" }}><path d={d} fill="none" stroke="#7A8494" strokeWidth="1.1" strokeDasharray={dashed ? "3 2" : undefined} /><polygon points={`${tip - 5},${ay2 - 3} ${tip},${ay2} ${tip - 5},${ay2 + 3}`} fill="#7A8494" /></g>;
  };

  const svgString = () => { const c = svgRef.current.cloneNode(true); c.setAttribute("xmlns", "http://www.w3.org/2000/svg"); return new XMLSerializer().serializeToString(c); };
  const rasterize = (cb) => { const str = svgString(); const img = new Image(); img.onload = () => { const sc = 2; const cv = document.createElement("canvas"); cv.width = W * sc; cv.height = H * sc; const ctx = cv.getContext("2d"); ctx.fillStyle = P.bg; ctx.fillRect(0, 0, cv.width, cv.height); ctx.scale(sc, sc); ctx.drawImage(img, 0, 0); cb(cv); }; img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(str))); };
  const exportImg = (type) => rasterize((cv) => { const url = cv.toDataURL(type === "jpg" ? "image/jpeg" : "image/png", 0.92); const a = document.createElement("a"); a.href = url; a.download = `FIN04-schedule-${fmtISO(new Date())}.${type}`; a.click(); });
  const exportPdf = () => { const w = window.open("", "_blank"); if (!w) return; w.document.write(`<!DOCTYPE html><html><head><title>FIN04 Schedule</title><style>@page{size:landscape}body{margin:0}svg{width:100%;height:auto}</style></head><body>${svgString()}</body></html>`); w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch (e) {} }, 350); };
  const exportXlsx = async () => { try { const mod = await import("exceljs/dist/exceljs.min.js"); const ExcelJS = mod.default || mod; const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Schedule"); ws.columns = [{ header: "#", key: "code", width: 6 }, { header: "Activity", key: "desc", width: 38 }, { header: "Group", key: "grp", width: 18 }, { header: "Company", key: "co", width: 16 }, { header: "Cx", key: "cx", width: 6 }, { header: "Start", key: "s", width: 12 }, { header: "Finish", key: "f", width: 12 }, { header: "Days", key: "d", width: 6 }, { header: "Forecast finish", key: "ff", width: 15 }, { header: "%", key: "p", width: 6 }, { header: "Status", key: "st", width: 12 }, { header: "Predecessors", key: "pre", width: 18 }]; ws.getRow(1).font = { bold: true }; acts.slice().sort((a, b) => (a.start || "").localeCompare(b.start || "")).forEach((a) => ws.addRow({ code: a.code != null ? "#" + a.code : "", desc: a.desc, grp: groupKey(a), co: coName(a.companyId), cx: a.level, s: a.start, f: fmtISO(addDays(parseD(a.start), a.duration - 1)), d: a.duration, ff: fmtISO(addDays(t0, proj[a.id].eo)), p: pct(a), st: a.status.replace("_", " "), pre: (a.predecessors || []).map((pid) => { const x = byId[pid]; return x && x.code != null ? "#" + x.code : ""; }).filter(Boolean).join(", ") })); const buf = await wb.xlsx.writeBuffer(); const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })); const a = document.createElement("a"); a.href = url; a.download = `FIN04-schedule-${fmtISO(new Date())}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (e) { alert("Excel export failed: " + (e && e.message ? e.message : e)); } };

  return (
    <div className="lk-sch" style={cssVars(S.theme)}><style>{css}</style>
      <div className="lk-sch-bar">
        <div className="grp"><label>View</label><div className="seg">{[["gantt", "Gantt"], ["calendar", "Calendar"], ["workload", "Workload"]].map(([k, l]) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{l}</button>)}</div></div>
        {view === "gantt" && <>
        <div className="grp"><label>Zoom</label><div className="seg">{[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([k, l]) => <button key={k} className={zoom === k ? "on" : ""} onClick={() => setZoom(k)}>{l}</button>)}</div></div>
        <div className="grp"><label>Group by</label><select className="lk-select" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}><option value="none">None</option><option value="company">Company</option><option value="area">Building</option><option value="level">Cx Stage</option><option value="system">System</option></select></div>
        <div className="grp"><label>Colour by</label><select className="lk-select" value={colorBy} onChange={(e) => setColorBy(e.target.value)}><option value="level">Cx Stage</option><option value="company">Company</option><option value="status">Status</option></select></div>
        <button className={"lk-btn" + (showResp ? " on" : "")} onClick={() => setShowResp((v) => !v)}>Responsible</button>
        <button className={"lk-btn" + (showDeps ? " on" : "")} onClick={() => setShowDeps((v) => !v)}>Links</button>
        <button className={"lk-btn" + (compact ? " on" : "")} onClick={() => setCompact((v) => !v)}>Compact</button>
        <div style={{ flex: 1 }} />
        <button className="lk-btn" onClick={() => exportImg("png")}><Icon n="download" s={13} />PNG</button>
        <button className="lk-btn" onClick={() => exportImg("jpg")}><Icon n="download" s={13} />JPG</button>
        <button className="lk-btn" onClick={exportPdf}><Icon n="download" s={13} />PDF</button>
        <button className="lk-btn" onClick={exportXlsx}><Icon n="download" s={13} />Excel</button>
        </>}
      </div>
      {view === "gantt" && <div className="lk-sch-scroll" style={{ background: P.bg }}>
        {acts.length === 0 ? <div className="lk-empty">No activities with dates yet.</div> :
        <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{ background: P.bg, fontFamily: "Segoe UI, Arial, sans-serif" }}>
          <rect x={0} y={0} width={W} height={H} fill={P.bg} />
          {/* month band */}
          {months.map((m, i) => <g key={"m" + i}><rect x={m.xs} y={0} width={Math.max(0, m.xe - m.xs)} height={22} fill={i % 2 ? P.band2 : P.band} />{(m.xe - m.xs) > 26 && text((m.xs + m.xe) / 2, 11, m.label, { anchor: "middle", size: 10.5, weight: 700, fill: P.mut })}</g>)}
          {/* unit gridlines + labels */}
          {ticks.map((t, i) => <g key={"t" + i}><line x1={t.x} y1={22} x2={t.x} y2={H} stroke={t.strong ? P.gridStrong : P.grid} strokeWidth="1" />{t.label && zoom !== "month" && text(t.x + 2, 34, t.label, { size: 9.5, fill: P.mut })}</g>)}
          <line x1={leftW} y1={0} x2={leftW} y2={H} stroke={P.line} strokeWidth="1" />
          <line x1={0} y1={headH} x2={W} y2={headH} stroke={P.line} strokeWidth="1" />
          {/* today line */}
          {todayX >= leftW && todayX <= W && <g><line x1={todayX} y1={22} x2={todayX} y2={H} stroke={P.today} strokeWidth="1.5" strokeDasharray="3 3" />{text(todayX + 3, headH - 4, "today", { size: 9, fill: P.today, weight: 700 })}</g>}

          {/* LAYER 1 - backgrounds, group headers, left-column text */}
          {rows.map((r, i) => {
            const y = headH + i * rowH;
            if (r.t === "grp") {
              const open = !collapsed[r.k];
              return <g key={"gb" + r.k} style={{ cursor: "pointer" }} onClick={() => setCollapsed((c) => ({ ...c, [r.k]: !c[r.k] }))}>
                <rect x={0} y={y} width={W} height={rowH} fill={P.header} />
                <text x={10} y={y + rowH / 2} fontSize="10" fill={P.mut} dominantBaseline="middle">{open ? "\u25BC" : "\u25B6"}</text>
                {text(24, y + rowH / 2, `${r.k}  (${r.n})`, { weight: 700, size: 11.5, fill: P.ink })}
              </g>;
            }
            const a = r.a, nm = a.desc || "Untitled";
            return <g key={"tb" + a.id}>
              {i % 2 === 0 && <rect x={0} y={y} width={W} height={rowH} fill={P.row} />}
              <line x1={0} y1={y + rowH} x2={W} y2={y + rowH} stroke={P.sep} strokeWidth="1" />
              {text(10, y + rowH / 2, a.code != null ? "#" + a.code : "", { size: 9.5, fill: P.mut })}
              <text x={42} y={y + rowH / 2} fontSize="11.5" fill={P.ink} dominantBaseline="middle" style={{ pointerEvents: "none" }}>{nm.length > 34 ? nm.slice(0, 33) + "\u2026" : nm}</text>
            </g>;
          })}

          {/* LAYER 2 - dependency arrows (on top of headers; dashed when crossing groups) */}
          {showDeps && rows.map((r) => r.t === "task" ? (r.a.predecessors || []).map((pid) => { const g2 = geo[r.a.id], g1 = geo[pid]; if (!g1 || !g2) return null; const dashed = groupBy !== "none" && byId[pid] && groupKey(byId[pid]) !== groupKey(r.a); return drawArrow(g1, g2, dashed, pid + ">" + r.a.id); }) : null)}

          {/* LAYER 3 - bars, milestones, responsible, collapsed rollups */}
          {rows.map((r, i) => {
            const y = headH + i * rowH, yc = y + rowH / 2;
            if (r.t === "grp") {
              if (!collapsed[r.k]) return null;
              const ts = groupTasks[r.k] || []; if (!ts.length) return null;
              const s0 = Math.min(...ts.map((a) => dayOff(parseD(a.start))));
              const e0 = Math.max(...ts.map((a) => Math.max(dayOff(addDays(parseD(a.start), a.duration - 1)), proj[a.id] ? proj[a.id].eo : 0)));
              const rx = xOf(s0), rw = Math.max(xOf(e0 + 1) - rx, 6);
              const cos = [...new Set(ts.map((a) => a.companyId).filter(Boolean))];
              return <g key={"gr" + r.k} style={{ pointerEvents: "none" }}>
                <rect x={rx} y={yc - 3} width={rw} height={6} fill={P.rollup} />
                <polygon points={`${rx},${yc + 3} ${rx},${yc + 8} ${rx + 6},${yc + 3}`} fill={P.rollup} />
                <polygon points={`${rx + rw},${yc + 3} ${rx + rw},${yc + 8} ${rx + rw - 6},${yc + 3}`} fill={P.rollup} />
                {showResp && cos.length > 0 && text(rx + rw + 8, yc, cos.length === 1 ? coName(cos[0]) : "Various", { size: 10, fill: P.mut, weight: 600 })}
              </g>;
            }
            const a = r.a, g = geo[a.id]; const col = colorOf(a); const p = pct(a); const barH = rowH - 12, barY = y + (rowH - barH) / 2;
            const projE = proj[a.id] ? proj[a.id].eo : g.pE; const delay = projE > g.pE;
            const dx1 = xOf(g.pE + 1), dx2 = xOf(projE + 1);
            const respBase = delay ? dx2 : g.x + g.w;
            const respX = respBase + ((showDeps && hasOut.has(a.id) && !delay) ? 16 : 6);
            return <g key={"tf" + a.id} style={{ cursor: "pointer" }} onClick={() => openDrill(a.desc || "Activity", [a])}>
              {a.isMilestone
                ? <polygon points={`${g.x},${yc - 6} ${g.x + 6},${yc} ${g.x},${yc + 6} ${g.x - 6},${yc}`} fill={col} />
                : <g>
                    <rect x={g.x} y={barY} width={g.w} height={barH} rx={3} fill={col} opacity={0.30} />
                    <rect x={g.x} y={barY} width={g.w * p / 100} height={barH} rx={3} fill={col} />
                    <rect x={g.x} y={barY} width={g.w} height={barH} rx={3} fill="none" stroke={col} strokeWidth="1" />
                    {delay && <rect x={dx1} y={barY + 1} width={Math.max(2, dx2 - dx1)} height={barH - 2} rx={2} fill="none" stroke="#C0392B" strokeWidth="1.2" strokeDasharray="3 2" />}
                  </g>}
              {showResp && coName(a.companyId) && text(respX, yc, coName(a.companyId), { size: 10, fill: P.mut })}
            </g>;
          })}
        </svg>}
      </div>}
      {view === "calendar" && <CalendarView S={S} coName={coName} onDrill={openDrill} LV={LV} P={P} dark={dark} />}
      {view === "workload" && <WorkloadView S={S} coName={coName} onDrill={openDrill} P={P} dark={dark} />}
      {drill && <DrillModal title={drill.title} items={drill.items} S={S} LV={LV} coName={coName} onOpen={onOpen} onClose={() => setDrill(null)} />}
    </div>);
}

function CalendarView({ S, coName, onDrill, LV, P }) {
  const [m, setM] = useState(() => { const d = new Date(todayMid()); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const acts = S.activities.filter((a) => a.start);
  const items = acts.map((a) => ({ a, s: parseD(a.start).getTime(), e: addDays(parseD(a.start), Math.max(1, a.duration) - 1).getTime() }));
  const first = new Date(m.getFullYear(), m.getMonth(), 1);
  const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
  const weeks = []; let cur = mondayOf(first);
  while (cur.getTime() <= last.getTime()) { const days = []; for (let d = 0; d < 7; d++) days.push(addDays(cur, d)); weeks.push(days); cur = addDays(cur, 7); }
  const today = todayMid();
  const onDay = (day) => { const t = day.getTime(); return items.filter((it) => t >= it.s && t <= it.e).sort((x, y) => (x.a.start || "").localeCompare(y.a.start || "")); };
  const step = (n) => setM(new Date(m.getFullYear(), m.getMonth() + n, 1));
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div style={{ flex: 1, overflow: "auto", background: "var(--paper)" }}>
      <div className="cal-head">
        <button className="lk-btn" onClick={() => step(-1)}>{"\u2039"}</button>
        <button className="lk-btn" onClick={() => setM(() => { const d = new Date(todayMid()); return new Date(d.getFullYear(), d.getMonth(), 1); })}>Today</button>
        <button className="lk-btn" onClick={() => step(1)}>{"\u203A"}</button>
        <h3 style={{ margin: "0 0 0 6px" }}>{m.toLocaleString("en-GB", { month: "long", year: "numeric" })}</h3>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{acts.length} dated activit{acts.length === 1 ? "y" : "ies"}</span>
      </div>
      <div className="cal-grid">
        {dow.map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {weeks.flat().map((day, i) => { const inM = day.getMonth() === m.getMonth(); const isToday = day.getTime() === today; const da = onDay(day); return (
          <div key={i} className={"cal-cell" + (inM ? "" : " off") + (isToday ? " today" : "")} onClick={da.length ? () => onDrill(day.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }), da.map((x) => x.a)) : undefined} style={da.length ? { cursor: "pointer" } : undefined}>
            <div className="cal-daynum">{day.getDate()}</div>
            {da.slice(0, 4).map(({ a }) => <span key={a.id} className="cal-chip" style={{ borderLeftColor: (LV[a.level] || {}).color || "#64748B" }} title={`${a.desc || "Untitled"} \u00b7 ${coName(a.companyId)} \u00b7 ${a.level}`}>{a.desc || "Untitled"}</span>)}
            {da.length > 4 && <div className="cal-more">+{da.length - 4} more</div>}
          </div>); })}
      </div>
    </div>);
}

function WorkloadView({ S, coName, onDrill }) {
  const acts = S.activities.filter((a) => a.start);
  if (!acts.length) return <div className="lk-empty" style={{ flex: 1 }}>No activities with dates yet.</div>;
  const PAL = ["#2563EB", "#0E9384", "#D97706", "#7C3AED", "#DB2777", "#0891B2", "#65A30D", "#DC2626", "#475569"];
  const coColor = (id) => { if (!id) return "#94A3B8"; let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return PAL[h % PAL.length]; };
  const span = (a) => ({ s: parseD(a.start).getTime(), e: addDays(parseD(a.start), Math.max(1, a.duration) - 1).getTime() });
  const weekActs = (wk, c) => { const ws = wk.getTime(), we = addDays(wk, 6).getTime(); return acts.filter((a) => { const { s, e } = span(a); return s <= we && e >= ws && (!c || a.companyId === c); }); };
  const wkLabel = (wk) => "Week of " + wk.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const starts = acts.map((a) => parseD(a.start).getTime());
  const ends = acts.map((a) => span(a).e);
  let w = mondayOf(new Date(Math.min(...starts))); const lastW = mondayOf(new Date(Math.max(...ends)));
  const weeks = []; while (w.getTime() <= lastW.getTime()) { weeks.push(new Date(w)); w = addDays(w, 7); }
  const comps = [...new Set(acts.map((a) => a.companyId))].sort((a, b) => coName(a).localeCompare(coName(b)));
  const data = weeks.map((wk) => { const ws = wk.getTime(), we = addDays(wk, 6).getTime(); const counts = {}; let total = 0; acts.forEach((a) => { const { s, e } = span(a); if (s <= we && e >= ws) { counts[a.companyId] = (counts[a.companyId] || 0) + 1; total++; } }); return { wk, counts, total }; });
  const maxTotal = Math.max(1, ...data.map((d) => d.total));
  const peak = data.reduce((m, d) => (d.total > m.total ? d : m), data[0]);
  const barMax = 240;
  return (
    <div style={{ flex: 1, overflow: "auto", background: "var(--paper)" }} className="wl-wrap">
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>Activities running each week, stacked by company. The taller the week, the more is in flight at once. Busiest week is <b style={{ color: "var(--ink)" }}>{peak.wk.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</b> with <b style={{ color: "var(--ink)" }}>{peak.total}</b> activit{peak.total === 1 ? "y" : "ies"}.</div>
      <div className="wl-bars">
        {data.map((d, i) => { const isW = d.wk.getTime() === mondayOf(new Date(todayMid())).getTime(); return (
          <div key={i} className="wl-col">
            <span className="wl-lab" style={{ color: d.total ? "var(--ink)" : "var(--muted)", fontWeight: d.total ? 700 : 400 }}>{d.total || ""}</span>
            <div className="wl-stack" style={{ height: barMax, justifyContent: "flex-end", outline: isW ? "2px solid var(--accent)" : "none", cursor: d.total ? "pointer" : "default" }} onClick={d.total ? () => onDrill(wkLabel(d.wk), weekActs(d.wk)) : undefined} title={d.total ? "Click for this week's activities" : ""}>
              {comps.map((c) => d.counts[c] ? <div key={c} className="wl-seg" style={{ height: (d.counts[c] / maxTotal) * barMax, background: coColor(c), cursor: "pointer" }} title={`${coName(c)}: ${d.counts[c]} \u00b7 click to list`} onClick={(ev) => { ev.stopPropagation(); onDrill(wkLabel(d.wk) + " \u00b7 " + (coName(c) || "Unassigned"), weekActs(d.wk, c)); }} /> : null)}
            </div>
            <span className="wl-lab" style={{ fontWeight: isW ? 700 : 400, color: isW ? "var(--accent)" : "var(--muted)", cursor: d.total ? "pointer" : "default" }} onClick={d.total ? () => onDrill(wkLabel(d.wk), weekActs(d.wk)) : undefined}>{d.wk.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
          </div>); })}
      </div>
      <div className="wl-legend">{comps.map((c) => <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: coColor(c) }} />{coName(c) || "Unassigned"}</span>)}</div>
    </div>);
}

const TBL_COLS = [["code", "#"], ["company", "Company"], ["building", "Building"], ["level", "Level"], ["zone", "Zone / Room"], ["system", "System"], ["cx", "Cx"], ["start", "Start"], ["days", "Days"], ["committed", "Committed"], ["status", "Status"], ["witness", "Witness"], ["witnessat", "Witness time"], ["notes", "Notes"]];
const TBL_DEFAULT_COLS = Object.fromEntries(TBL_COLS.map(([k]) => [k, k !== "witness" && k !== "witnessat"]));
function TablePage({ S, cu, isAdmin, canEdit, update, coName }) {
  const savedView = (() => { try { return JSON.parse(localStorage.getItem("fin04_tblview") || "null") || {}; } catch (e) { return {}; } })();
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [q, setQ] = useState("");
  const [fCo, setFCo] = useState(savedView.fCo || "all");
  const [fStatus, setFStatus] = useState(savedView.fStatus || "all");
  const [fAr, setFAr] = useState(savedView.fAr || "all");
  const [fLv, setFLv] = useState(savedView.fLv || "all");
  const [colsOpen, setColsOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [cols, setCols] = useState(() => ({ ...TBL_DEFAULT_COLS, ...(savedView.cols || {}) }));
  const cn = (id) => (S.companies.find((c) => c.id === id) || {}).name || "";
  const rowEditable = (a) => a.status === "complete" ? isAdmin : (isAdmin || (canEdit(a) && !a.committed));
  const begin = (a) => { setEditId(a.id); setDraft({ ...a }); };
  const cancel = () => { setEditId(null); setDraft(null); };
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setStatus = (v) => setDraft((d) => { const n = { ...d, status: v }; if (v === "in_progress" && !n.actualStart) n.actualStart = fmtISO(new Date()); if (v === "complete") { if (!n.actualStart) n.actualStart = fmtISO(new Date()); if (!n.actualFinish) n.actualFinish = fmtISO(new Date()); } return n; });
  const save = () => { if (!draft.desc.trim()) return; const d = draft; update((p) => ({ ...p, activities: p.activities.map((x) => x.id === d.id ? d : x) }), { action: "Edit activity (table)", detail: `${d.desc} (${coName(d.companyId)})` }); cancel(); };
  const saveView = () => { try { localStorage.setItem("fin04_tblview", JSON.stringify({ cols, fCo, fAr, fLv, fStatus })); setSavedMsg("Saved as your default view"); setTimeout(() => setSavedMsg(""), 2200); } catch (e) {} };
  const resetView = () => { setCols({ ...TBL_DEFAULT_COLS }); setFCo("all"); setFAr("all"); setFLv("all"); setFStatus("all"); try { localStorage.removeItem("fin04_tblview"); } catch (e) {} setSavedMsg("Reset to defaults"); setTimeout(() => setSavedMsg(""), 2200); };
  const subsFor = (area) => (S.subAreas || []).filter((s) => s.area === area);
  const zonesFor = (area, sub) => (S.tier3s || []).filter((t) => t.area === area && t.subArea === sub);
  const list = S.activities.filter((a) => {
    if (fStatus !== "all" && a.status !== fStatus) return false;
    if (fCo === "none") { if (a.companyId) return false; } else if (fCo !== "all" && a.companyId !== fCo) return false;
    if (fAr !== "all" && a.area !== fAr) return false;
    if (fLv !== "all" && a.level !== fLv) return false;
    if (q.trim() && !(`${a.desc || ""} ${cn(a.companyId)} ${a.system || ""}`.toLowerCase().includes(q.trim().toLowerCase()))) return false;
    return true;
  }).sort((a, b) => (a.start || "").localeCompare(b.start || "") || (a.code || 0) - (b.code || 0));
  const cell = { padding: "5px 7px", fontSize: 11.5 };
  const C = (k) => cols[k];
  const visCount = 2 + TBL_COLS.filter(([k]) => cols[k]).length;
  return (
    <div className="lk-tblwrap" style={cssVars(S.theme)}><style>{css}</style>
      <div className="lk-ufilter" style={{ padding: "10px 16px 0", alignItems: "flex-end" }}>
        <div className="lk-f" style={{ minWidth: 150, flex: 1 }}><label>Search</label><input className="lk-in" placeholder="Activity, company, system…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="lk-f" style={{ minWidth: 130 }}><label>Company</label><select className="lk-select" value={fCo} onChange={(e) => setFCo(e.target.value)}><option value="all">All companies</option><option value="none">No company</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 120 }}><label>Building</label><select className="lk-select" value={fAr} onChange={(e) => setFAr(e.target.value)}><option value="all">All buildings</option>{S.areas.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 90 }}><label>Cx Stage</label><select className="lk-select" value={fLv} onChange={(e) => setFLv(e.target.value)}><option value="all">All</option>{Object.keys(S.levels).map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 105 }}><label>Status</label><select className="lk-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="all">All statuses</option><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="complete">Complete</option></select></div>
        <div style={{ position: "relative" }}>
          <button className={"lk-btn" + (colsOpen ? " on" : "")} onClick={() => setColsOpen((v) => !v)}><Icon n="grid" s={14} />Columns</button>
          {colsOpen && <><div style={{ position: "fixed", inset: 0, zIndex: 30 }} onClick={() => setColsOpen(false)} />
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 31, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "8px 6px", minWidth: 190, boxShadow: "0 10px 30px rgba(0,0,0,.18)" }}>
              {TBL_COLS.map(([k, l]) => <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 9px", fontSize: 12.5, cursor: "pointer", borderRadius: 6 }}><input type="checkbox" checked={!!cols[k]} onChange={(e) => setCols((c) => ({ ...c, [k]: e.target.checked }))} />{l}</label>)}
              <div style={{ display: "flex", gap: 6, padding: "6px 9px 2px", borderTop: "1px solid var(--line)", marginTop: 4 }}>
                <button className="lk-btn" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => setCols(Object.fromEntries(TBL_COLS.map(([k]) => [k, true])))}>All</button>
                <button className="lk-btn" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => setCols(Object.fromEntries(TBL_COLS.map(([k]) => [k, false])))}>None</button>
              </div>
              <div style={{ display: "flex", gap: 6, padding: "4px 9px 2px" }}>
                <button className="lk-btn primary" style={{ fontSize: 11, padding: "3px 8px", flex: 1 }} onClick={saveView}>Save as default</button>
                <button className="lk-btn" style={{ fontSize: 11, padding: "3px 8px" }} onClick={resetView}>Reset</button>
              </div>
            </div></>}
        </div>
      </div>
      {savedMsg && <div style={{ padding: "4px 16px 0", fontSize: 11.5, color: "var(--muted)" }}>{savedMsg}</div>}
      <div className="lk-tblscroll">
        <table className="lk-grid">
          <thead><tr>
            <th style={{ width: 56 }}></th>{C("code") && <th>#</th>}<th>Activity</th>{C("company") && <th>Company</th>}{C("building") && <th>Building</th>}{C("level") && <th>Level</th>}{C("zone") && <th>Zone / Room</th>}{C("system") && <th>System</th>}{C("cx") && <th>Cx</th>}{C("start") && <th>Start</th>}{C("days") && <th>Days</th>}{C("committed") && <th>Committed</th>}{C("status") && <th>Status</th>}{C("witness") && <th>Witness</th>}{C("witnessat") && <th>Witness time</th>}{C("notes") && <th>Notes</th>}
          </tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={visCount} style={{ padding: 14, color: "var(--muted)", fontSize: 12 }}>No activities match these filters.</td></tr>}
            {list.map((a) => {
              const ed = editId === a.id; const d = ed ? draft : a; const canRow = rowEditable(a); const lk = ed && d.status === "complete";
              return <tr key={a.id} className={ed ? "ed" : ""}>
                <td>{ed
                  ? <span style={{ display: "inline-flex", gap: 2 }}><button title="Save" onClick={save}><Icon n="check" s={14} /></button><button title="Cancel" onClick={cancel}><Icon n="x" s={14} /></button></span>
                  : <button title={canRow ? "Edit this row" : (a.status === "complete" ? "Complete: only an admin can reopen it" : a.committed ? "Committed: locked" : "Only your own company's activities are editable")} disabled={!canRow} onClick={() => begin(a)} style={{ opacity: canRow ? 1 : 0.3 }}><Icon n="pen" s={13} /></button>}</td>
                {C("code") && <td className="mono">#{a.code ?? "?"}</td>}
                <td>{ed ? <input className="lk-in" style={cell} value={d.desc} disabled={lk} onChange={(e) => set("desc", e.target.value)} /> : (a.desc || "Untitled")}</td>
                {C("company") && <td>{ed ? <select className="lk-select" style={cell} value={d.companyId || ""} disabled={!isAdmin || lk} onChange={(e) => set("companyId", e.target.value)}>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : cn(a.companyId)}</td>}
                {C("building") && <td>{ed ? <select className="lk-select" style={cell} value={d.area || ""} disabled={lk} onChange={(e) => { set("area", e.target.value); set("subArea", ""); set("tier3", ""); }}><option value="">--</option>{S.areas.map((x) => <option key={x}>{x}</option>)}</select> : a.area}</td>}
                {C("level") && <td>{ed ? <select className="lk-select" style={cell} value={d.subArea || ""} disabled={!d.area || lk} onChange={(e) => { set("subArea", e.target.value); set("tier3", ""); }}><option value="">--</option>{subsFor(d.area).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}</select> : a.subArea}</td>}
                {C("zone") && <td>{ed ? <select className="lk-select" style={cell} value={d.tier3 || ""} disabled={!d.subArea || lk} onChange={(e) => set("tier3", e.target.value)}><option value="">--</option>{zonesFor(d.area, d.subArea).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}</select> : a.tier3}</td>}
                {C("system") && <td>{ed ? <select className="lk-select" style={cell} value={d.system || ""} disabled={lk} onChange={(e) => set("system", e.target.value)}><option value="">--</option>{S.systems.map((x) => <option key={x}>{x}</option>)}</select> : a.system}</td>}
                {C("cx") && <td>{ed ? <select className="lk-select" style={cell} value={d.level} disabled={lk} onChange={(e) => set("level", e.target.value)}>{Object.keys(S.levels).map((k) => <option key={k} value={k}>{k}</option>)}</select> : a.level}</td>}
                {C("start") && <td>{ed ? <input className="lk-in mono" style={cell} type="date" value={d.start} disabled={lk} onChange={(e) => set("start", e.target.value)} /> : a.start}</td>}
                {C("days") && <td>{ed ? <input className="lk-in mono" style={{ ...cell, width: 54 }} type="number" min="1" value={d.duration} disabled={lk} onChange={(e) => set("duration", Math.max(1, +e.target.value || 1))} /> : a.duration}</td>}
                {C("committed") && <td style={{ textAlign: "center" }}>{ed ? <input type="checkbox" checked={!!d.committed} disabled={lk} onChange={(e) => set("committed", e.target.checked)} /> : (a.committed ? "Yes" : "")}</td>}
                {C("status") && <td>{ed ? <select className="lk-select" style={cell} value={d.status} onChange={(e) => setStatus(e.target.value)}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="complete">Complete</option></select> : a.status.replace("_", " ")}</td>}
                {C("witness") && <td style={{ textAlign: "center" }}>{ed ? <input type="checkbox" checked={!!d.witnessInvite} disabled={lk} onChange={(e) => set("witnessInvite", e.target.checked)} /> : (a.witnessInvite ? "Yes" : "")}</td>}
                {C("witnessat") && <td>{ed ? <input className="lk-in mono" style={cell} type="datetime-local" value={d.witnessAt || ""} disabled={lk || !d.witnessInvite} onChange={(e) => set("witnessAt", e.target.value)} /> : (a.witnessAt ? a.witnessAt.replace("T", " ") : "")}</td>}
                {C("notes") && <td style={{ minWidth: 150 }}>{ed ? <input className="lk-in" style={cell} value={d.notes || ""} disabled={lk} onChange={(e) => set("notes", e.target.value)} /> : <span style={{ color: "var(--muted)" }}>{a.notes || ""}</span>}</td>}
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>);
}

function ConstraintsPage({ S, update, canEdit, coName, onOpen }) {
  const [co, setCo] = useState("all");
  const [ar, setAr] = useState("all");
  const [openOnly, setOpenOnly] = useState(true);
  const [q, setQ] = useState("");
  const [editKey, setEditKey] = useState(null);
  const [cd, setCd] = useState(null);
  const toggle = (actId, cId) => update((p) => ({ ...p, activities: p.activities.map((a) => a.id === actId ? { ...a, constraints: a.constraints.map((c) => c.id === cId ? { ...c, done: !c.done } : c) } : a) }), { action: "Update constraint" });
  const beginC = (a, c) => { setEditKey(a.id + c.id); setCd({ ...c }); };
  const cancelC = () => { setEditKey(null); setCd(null); };
  const saveC = (a) => { const d = cd; if (!d.text.trim()) return; update((p) => ({ ...p, activities: p.activities.map((x) => x.id === a.id ? { ...x, constraints: x.constraints.map((y) => y.id === d.id ? d : y) } : x) }), { action: "Edit constraint", detail: a.desc }); cancelC(); };
  const setD = (k, v) => setCd((d) => ({ ...d, [k]: v }));
  const cell = { padding: "5px 7px", fontSize: 11.5 };
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
  const exportCsv = () => { const headers = ["Activity", "Company", "Location code", "Building", "Level", "Zone / Room", "Cx Stage", "Planned start", "Constraint", "Owner", "Need-by", "Status"]; const data = rows.map(({ a, c }) => [a.desc, coName(a.companyId), [(S.brand && S.brand.projectName) || "FIN04", a.area, a.subArea, a.tier3].filter(Boolean).join("."), a.area, a.subArea || "", a.tier3 || "", a.level, a.start, c.text, c.owner || "", c.due || "", c.done ? "Cleared" : "Open"]); downloadFile(`FIN04-constraints-${fmtISO(new Date())}.csv`, toCSV(headers, data)); };
  return (
    <div className="lk-rep" style={{ maxWidth: "none" }}>
      <div className="sub" style={{ marginTop: 2 }}>Every make-ready constraint across the project. Tick one to clear it; the board updates straight away. Use the pen to edit a constraint's wording, owner or need-by date.</div>
      <div className="lk-rep-filters">
        <div className="lk-f" style={{ minWidth: 150 }}><label>Company</label><select className="lk-select" value={co} onChange={(e) => setCo(e.target.value)}><option value="all">All companies</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 150 }}><label>Building</label><select className="lk-select" value={ar} onChange={(e) => setAr(e.target.value)}><option value="all">All buildings</option>{S.areas.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 180 }}><label>Search</label><input className="lk-in" placeholder="Activity or constraint…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className={"lk-btn" + (openOnly ? " on" : "")} onClick={() => setOpenOnly((v) => !v)}>{openOnly ? "Open only" : "Showing all"}</button>
        <button className="lk-btn" onClick={exportCsv}><Icon n="download" s={14} />Export</button>
      </div>
      <div className="lk-rep-sec" style={{ padding: 0, overflow: "auto" }}>
        <table className="lk-tbl lk-grid"><thead><tr><th style={{ width: 44 }} /><th style={{ width: 30 }} /><th>Activity</th><th>Company</th><th>Location</th><th>Cx Stage</th><th style={{ minWidth: 96, whiteSpace: "nowrap" }}>Start</th><th>Constraint</th><th style={{ minWidth: 130 }}>Owner</th><th style={{ minWidth: 112, whiteSpace: "nowrap" }}>Need-by</th></tr></thead>
          <tbody>
            {rows.map(({ a, c }) => { const ed = editKey === (a.id + c.id); const can = canEdit(a); const overdue = c.due && !c.done && c.due < fmtISO(new Date()); return <tr key={a.id + c.id} className={ed ? "ed" : ""}>
              <td>{ed
                ? <span style={{ display: "inline-flex", gap: 2 }}><button title="Save" onClick={() => saveC(a)}><Icon n="check" s={14} /></button><button title="Cancel" onClick={cancelC}><Icon n="x" s={14} /></button></span>
                : <button title={can ? "Edit this constraint" : "Only your own company's constraints are editable"} disabled={!can} onClick={() => beginC(a, c)} style={{ opacity: can ? 1 : 0.3 }}><Icon n="pen" s={13} /></button>}</td>
              <td><input type="checkbox" checked={c.done} disabled={!can} onChange={() => toggle(a.id, c.id)} /></td>
              <td><span className="lnk" onClick={() => onOpen(a)}>{a.desc || "Untitled"}</span></td>
              <td>{coName(a.companyId)}</td>
              <td className="mono">{[(S.brand && S.brand.projectName) || "FIN04", a.area, a.subArea, a.tier3].filter(Boolean).join(".")}</td>
              <td>{a.level}</td>
              <td className="mono" style={{ whiteSpace: "nowrap" }}>{a.start}</td>
              <td className={c.done ? "lk-cdone" : ""} style={{ minWidth: 160 }}>{ed ? <input className="lk-in" style={cell} value={cd.text} onChange={(e) => setD("text", e.target.value)} /> : c.text}</td>
              <td style={{ minWidth: 130 }}>{ed ? <input className="lk-in" style={{ ...cell, minWidth: 110 }} placeholder="Owner" value={cd.owner || ""} onChange={(e) => setD("owner", e.target.value)} /> : (c.owner || "")}</td>
              <td className="mono" style={{ whiteSpace: "nowrap", color: overdue ? "#C0392B" : undefined, fontWeight: overdue ? 700 : undefined }}>{ed ? <input className="lk-in mono" style={{ ...cell, maxWidth: 140 }} type="date" value={cd.due || ""} onChange={(e) => setD("due", e.target.value)} /> : (c.due || "")}</td>
            </tr>; })}
            {rows.length === 0 && <tr><td colSpan={10} style={{ padding: 14, color: "var(--muted)" }}>No constraints match these filters.</td></tr>}
          </tbody></table>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{rows.length} shown · {totalOpen} open across the whole project</div>
    </div>);
}

function LatestOnline({ users, ustat, pres }) {
  const now = Date.now();
  const ONLINE_MS = 150000; // online if a heartbeat landed in the last 2.5 min
  const rows = users.map((u) => {
    const seen = ustat[u.id] && ustat[u.id].lastSignIn;
    if (!seen) return null; // invite not yet accepted -> no status, not listed
    const p = pres[u.id] ? new Date(pres[u.id]).getTime() : 0;
    const last = Math.max(p, new Date(seen).getTime());
    return { id: u.id, name: u.name || "Unknown", last, online: p > 0 && (now - p) < ONLINE_MS };
  }).filter(Boolean).sort((a, b) => b.last - a.last);
  const onlineCount = rows.filter((r) => r.online).length;
  const fmt = (t) => new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="lk-online">
      <div className="lk-online-h"><span>Latest online</span>{onlineCount > 0 && <span className="lk-online-now"><span className="lk-dot on" />{onlineCount} online now</span>}</div>
      {rows.length === 0
        ? <div className="lk-online-empty">No one has accepted their invite yet.</div>
        : <div className="lk-online-list">{rows.map((r) => <div key={r.id} className="lk-online-row">
            <span className={"lk-dot " + (r.online ? "on" : "off")} />
            <span className="lk-online-name" title={r.name}>{r.name}</span>
            <span className="lk-online-time" title={"Last online " + new Date(r.last).toLocaleString("en-GB")}>{r.online ? "online now" : fmt(r.last)}</span>
          </div>)}</div>}
    </div>);
}

function HelpPage({ dark }) {
  return (
    <div className="lk-help" style={{ background: dark ? "#10151C" : undefined }}>
      <iframe title="DLP Board Quick Reference" src={dark ? "help.html?theme=dark" : "help.html"} style={{ background: dark ? "#10151C" : "#fff" }} />
    </div>
  );
}

function Gauge({ value, size = 150, label = "PPC", onClick }) {
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  const frac = value == null ? 0 : Math.max(0, Math.min(1, value / 100));
  const col = value == null ? "var(--muted)" : value >= 80 ? "#0E9384" : value >= 50 ? "#D97706" : "#C0392B";
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--hover)" strokeWidth="14" />
    <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} />
    <text x={cx} y={cy + 4} textAnchor="middle" fontSize={size * 0.27} fontWeight="700" fill="var(--ink)" fontFamily="inherit">{value == null ? "\u2014" : value + "%"}</text>
    <text x={cx} y={cy + size * 0.19} textAnchor="middle" fontSize="11" fill="var(--muted)" fontFamily="inherit" style={{ letterSpacing: "0.12em" }}>{label}</text>
  </svg>;
}
function Donut({ data, size = 150, onSlice }) {
  const total = data.reduce((s, d) => s + d.n, 0);
  const r = size / 2 - 14, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r; let off = 0;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--hover)" strokeWidth="14" />
    {total > 0 && data.filter((d) => d.n > 0).map((d, i) => { const frac = d.n / total; const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="14" strokeDasharray={`${C * frac} ${C}`} strokeDashoffset={-C * off} transform={`rotate(-90 ${cx} ${cy})`} onClick={onSlice ? () => onSlice(d) : undefined} style={onSlice ? { cursor: "pointer" } : undefined} />; off += frac; return el; })}
    <text x={cx} y={cy} textAnchor="middle" fontSize={size * 0.27} fontWeight="700" fill="var(--ink)" fontFamily="inherit">{total}</text>
    <text x={cx} y={cy + size * 0.16} textAnchor="middle" fontSize="10.5" fill="var(--muted)" fontFamily="inherit">activities</text>
  </svg>;
}
function Trend({ points, h = 168, onPoint }) {
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
    {onPoint && valid.map((p) => <circle key={"h" + p.i} cx={xs(p.i)} cy={ys(p.value)} r="12" fill="transparent" style={{ cursor: "pointer" }} onClick={() => onPoint(p.i)}><title>{p.label + ": " + p.value + "%"}</title></circle>)}
    {points.map((p, i) => <text key={i} x={xs(i)} y={h - 7} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="inherit">{p.label}</text>)}
  </svg>;
}
const RepBar = ({ label, n, max, color, onClick }) => <div className={"lk-bar-row" + (onClick ? " clickable" : "")} onClick={onClick}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span><div className="lk-bar-track"><div className="lk-bar-fill" style={{ width: `${Math.round((n / max) * 100)}%`, background: color || "var(--accent)" }} /></div><span className="n">{n}</span></div>;

// ==== Weekly DLP Report generator =========================================
const ATNORTH_LOGO = "data:image/png;base64,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";
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function fmtD(d){ return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short"}); }
function fmtDoW(d){ return d.toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short"}); }
function fmtFull(d){ return d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); }

function computeReport({ S, LV, coName, start, end }){
  const acts = S.activities;
  const finishOf = (a) => addDays(parseD(a.start), (a.duration || 1) - 1);
  const made = (a) => a.status === "complete" && (!a.actualFinish || parseD(a.actualFinish) <= finishOf(a));
  const openCs = (a) => (a.constraints || []).filter((c) => !c.done);
  const openOf = (a) => openCs(a).length;
  const isDelayed = (a) => { if (!a.start) return false; const ps = parseD(a.start); const pf = addDays(ps,(a.duration||1)-1); if (a.status==="complete"&&a.actualFinish) return parseD(a.actualFinish)>pf; if (a.actualStart) return parseD(a.actualStart)>ps; return false; };
  const today = new Date(todayMid());
  const sMs = start.getTime(), eMs = end.getTime();
  const dated = acts.filter((a) => a.start);
  const dueInWk = (a) => { const f = finishOf(a).getTime(); return f >= sMs && f <= eMs; };
  const due = dated.filter((a) => a.committed && dueInWk(a));
  const kept = due.filter(made);
  const missed = due.filter((a) => !made(a));
  const ppc = due.length ? Math.round(kept.length / due.length * 100) : null;
  // 4-week PPC trend ending at the report week
  const trend = [];
  const mon = mondayOf(start);
  for (let i = 3; i >= 0; i--){ const w0 = addDays(mon, -7*i); const w0ms = w0.getTime(), w1ms = addDays(w0,6).getTime();
    const d = dated.filter((a)=>a.committed && finishOf(a).getTime()>=w0ms && finishOf(a).getTime()<=w1ms);
    trend.push({ label:"W"+isoWeek(w0), value: d.length ? Math.round(d.filter(made).length/d.length*100) : null }); }
  // lookahead window (4 weeks from today)
  const la0 = today.getTime(), la1 = addDays(today,27).getTime();
  const inLA = (a)=>{ if(!a.start) return false; const s=parseD(a.start).getTime(), f=finishOf(a).getTime(); return s<=la1 && f>=la0; };
  const la = dated.filter(inLA);
  const kpis = {
    lookahead: la.length,
    committed: due.length,
    completed: dated.filter((a)=>dueInWk(a)&&a.status==="complete").length,
    inProgress: acts.filter((a)=>a.status==="in_progress").length,
    ready: la.filter((a)=>openOf(a)===0&&a.status!=="complete").length,
    makeReady: la.filter((a)=>openOf(a)>0&&a.status!=="complete").length,
    delayed: la.filter(isDelayed).length,
    witness: la.filter((a)=>a.witnessInvite).length,
  };
  const cards = la.filter((a)=>openOf(a)>0)
    .map((a)=>({ a, cons: openCs(a).slice().sort((x,y)=>(x.due||"9999").localeCompare(y.due||"9999")) }))
    .sort((x,y)=>(x.cons[0]?.due||"9999").localeCompare(y.cons[0]?.due||"9999")).slice(0,8);
  const rt = {}; missed.forEach((a)=>{ const r=a.slipReason||"Unattributed"; rt[r]=(rt[r]||0)+1; });
  const reasons = Object.entries(rt).map(([name,n])=>({name,n})).sort((a,b)=>b.n-a.n);
  const byCompany = S.companies.map((c)=>({name:c.name,n:la.filter((a)=>a.companyId===c.id).length})).filter((x)=>x.n>0).sort((a,b)=>b.n-a.n).slice(0,8);
  const byCx = Object.keys(LV).map((k)=>({name:k+" "+LV[k].name,color:LV[k].color,n:la.filter((a)=>a.level===k).length})).filter((x)=>x.n>0);
  const nw0 = addDays(end,1).getTime(), nw1 = addDays(end,7).getTime();
  const nextWeek = dated.filter((a)=>a.committed && parseD(a.start).getTime()>=nw0 && parseD(a.start).getTime()<=nw1)
    .sort((a,b)=>(a.start||"").localeCompare(b.start||"")).slice(0,10);
  const milestones = dated.filter((a)=>a.isMilestone && finishOf(a).getTime()>=la0)
    .sort((a,b)=>(a.start||"").localeCompare(b.start||"")).slice(0,6);
  const schedule = la.filter((a)=>a.committed||a.status==="in_progress"||openOf(a)>0)
    .sort((a,b)=>(a.start||"").localeCompare(b.start||"")).slice(0,18);
  return { start, end, ppc, due, kept, missed, trend, kpis, cards, reasons, byCompany, byCx, nextWeek, milestones, schedule,
           today, laStart:today, laEnd:addDays(today,27), finishOf, openOf, openCs, coName, LV };
}

function draftSummary(r){
  if (!r) return "";
  const t = r.trend.filter((p)=>p.value!=null);
  const dir = t.length<2 ? "held" : (t[t.length-1].value>t[t.length-2].value?"rose":t[t.length-1].value<t[t.length-2].value?"fell":"held");
  let s;
  if (r.ppc==null) s = "No commitments fell due this week";
  else s = `Commitment reliability ${dir} to ${r.ppc}% PPC, with ${r.kept.length} of ${r.due.length} committed activit${r.due.length===1?"y":"ies"} completed on time`;
  s += ". ";
  s += r.cards.length ? `${r.cards.length} activit${r.cards.length===1?"y carries":"ies carry"} open constraints in the lookahead. ` : "No open constraints remain in the lookahead. ";
  if (r.reasons[0] && r.reasons[0].name !== "Unattributed") s += `The main driver of non-completion was ${r.reasons[0].name.toLowerCase()}. `;
  const atRisk = r.milestones.find((m)=>r.openOf(m)>0);
  if (atRisk) s += `The ${atRisk.desc||"next"} milestone on ${fmtD(r.finishOf(atRisk))} is at risk pending open constraints.`;
  else if (r.milestones[0]) s += `Next milestone: ${r.milestones[0].desc||"milestone"} on ${fmtD(r.finishOf(r.milestones[0]))}.`;
  return s.trim();
}

function buildWeeklyReportHTML({ r, summary, includeSchedule, by, mode }){
  const dueColor = (d) => { if(!d) return "ok"; const t=parseD(d).getTime(), now=r.today.getTime(); if(t<now) return "over"; if(t<=addDays(r.today,2).getTime()) return "soon"; return "ok"; };
  const dueLabel = (d) => { if(!d) return ["set","need by"]; const t=parseD(d).getTime(); return [fmtD(parseD(d)), t<r.today.getTime()?"overdue":"need by"]; };
  // KPI tiles
  const K = r.kpis;
  const kpiTiles = [
    ["In lookahead", K.lookahead, ""],
    ["Committed this week", K.committed, ""],
    ["Completed", K.completed, "var(--green)"],
    ["In progress", K.inProgress, ""],
    ["Ready to run", K.ready, "var(--green)"],
    ["Need make-ready", K.makeReady, "var(--amber)"],
    ["Delayed", K.delayed, "var(--red)"],
    ["Witness required", K.witness, "#6D3BD0"],
  ].map(([l,v,c])=>`<div class="kpi"><div class="v num"${c?` style="color:${c}"`:""}>${v}</div><div class="l">${l}</div></div>`).join("");
  // promise cells
  const cells = r.due.length
    ? r.kept.map(()=>`<div class="cell kept"></div>`).join("") + r.missed.map(()=>`<div class="cell miss"></div>`).join("")
    : `<div class="cell" style="background:var(--line-2)"></div>`;
  // trend sparkline
  const tv = r.trend.map((p,i)=>({i,v:p.value})).filter((p)=>p.v!=null);
  let spark = `<span class="lab">Not enough committed history</span>`;
  if (tv.length>=2){ const W=220,H=36,pad=6; const xs=(i)=>pad+ (i/(r.trend.length-1))*(W-2*pad); const ys=(v)=>H-pad-(v/100)*(H-2*pad);
    const pts = tv.map((p)=>`${xs(p.i).toFixed(0)},${ys(p.v).toFixed(0)}`).join(" ");
    const dots = tv.map((p)=>`<circle cx="${xs(p.i).toFixed(0)}" cy="${ys(p.v).toFixed(0)}" r="3" fill="var(--signal)"/>`).join("");
    const first=tv[0], last=tv[tv.length-1];
    spark = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none"><polyline points="${pts}" stroke="var(--signal)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg><span class="lab num">${r.trend[first.i].label} ${first.v}% &rarr; ${r.trend[last.i].label} ${last.v}%</span>`; }
  // constraint cards
  const cardsHtml = r.cards.length ? r.cards.map(({a,cons})=>{
    const loc = [a.area,a.subArea,a.tier3].filter(Boolean).join(" / ");
    const lv = r.LV[a.level]? a.level+" "+r.LV[a.level].name : (a.level||"");
    const badges = (a.committed?`<span class="badge b-will">WILL &middot; ${fmtD(parseD(a.start))}</span>`:"") + (a.witnessInvite?`<span class="badge b-wit">WIT</span>`:"");
    const lis = cons.map((c)=>{ const cl=dueColor(c.due); const [d,dl]=dueLabel(c.due);
      return `<li class="con"><span class="pip ${cl}"></span><div><div class="ctext">${esc(c.text||"Constraint")}</div>${c.owner?`<div class="who">Owner: ${esc(c.owner)}</div>`:""}</div><div class="due ${cl}"><div class="d num">${d}</div><div class="dl">${dl}</div></div></li>`; }).join("");
    return `<div class="ccard"><div class="top"><div><div class="title">${esc(a.desc||"Untitled")}</div><div class="meta">${esc(r.coName(a.companyId)||"")}${lv?" &nbsp;|&nbsp; Cx Stage "+esc(lv):""}${loc?" &nbsp;|&nbsp; "+esc(loc):""}</div></div><div style="display:flex;gap:7px;align-items:flex-start">${badges}</div></div><ul class="cons">${lis}</ul></div>`;
  }).join("") : `<div class="empty">No open constraints in the lookahead window.</div>`;
  // reasons
  const maxR = Math.max(1, ...r.reasons.map((x)=>x.n));
  const reasonsHtml = r.reasons.length ? r.reasons.map((x)=>`<div class="barrow"><span class="nm">${esc(x.name)}</span><div class="track"><div class="fill" style="width:${Math.round(x.n/maxR*100)}%;background:var(--red)"></div></div><span class="ct num">${x.n}</span></div>`).join("")
    : `<div class="empty">No missed commitments this week.</div>`;
  // by contractor / cx
  const maxC = Math.max(1, ...r.byCompany.map((x)=>x.n));
  const coHtml = r.byCompany.map((x)=>`<div class="barrow"><span class="nm">${esc(x.name)}</span><div class="track"><div class="fill" style="width:${Math.round(x.n/maxC*100)}%;background:var(--signal)"></div></div><span class="ct num">${x.n}</span></div>`).join("") || `<div class="empty">No activities in the lookahead.</div>`;
  const maxX = Math.max(1, ...r.byCx.map((x)=>x.n));
  const cxHtml = r.byCx.map((x)=>`<div class="barrow"><span class="nm">${esc(x.name)}</span><div class="track"><div class="fill" style="width:${Math.round(x.n/maxX*100)}%;background:var(--green)"></div></div><span class="ct num">${x.n}</span></div>`).join("") || `<div class="empty">No activities in the lookahead.</div>`;
  // committed next week
  const nwHtml = r.nextWeek.length ? r.nextWeek.map((a)=>{ const ready=r.openOf(a)===0; const lv = r.LV[a.level]?a.level+" "+r.LV[a.level].name:(a.level||"");
    return `<div class="lrow"><div><div class="nm">${esc(a.desc||"Untitled")}</div><div class="sub">${esc(r.coName(a.companyId)||"")}${lv?" &middot; Cx "+esc(lv):""}${a.witnessInvite?" &middot; witness":""}</div></div><span class="pill ${ready?"ontrack":"risk"}">${ready?"Ready":"Make-ready"}</span><span class="when num">${fmtDoW(parseD(a.start))}</span></div>`; }).join("")
    : `<div class="empty">Nothing committed for the following week yet.</div>`;
  // milestones
  const msHtml = r.milestones.length ? r.milestones.map((a)=>{ const risk=r.openOf(a)>0;
    return `<div class="lrow"><div class="ms"><span class="dia" style="background:${risk?"var(--amber)":"var(--green)"}"></span><div><div class="nm">${esc(a.desc||"Milestone")}</div><div class="sub">${risk?r.openOf(a)+" open constraint"+(r.openOf(a)===1?"":"s"):"on programme"}</div></div></div><span class="pill ${risk?"risk":"ontrack"}">${risk?"At risk":"On track"}</span><span class="when num">${fmtD(r.finishOf(a))}</span></div>`; }).join("")
    : `<div class="empty">No milestones in the lookahead.</div>`;
  // schedule snapshot (28-day lookahead mini gantt)
  let scheduleSection = "";
  if (includeSchedule){
    const win0 = r.laStart.getTime(), span = 28*86400000;
    const weekMarks = [0,1,2,3].map((i)=>`<div class="g-wk" style="left:${(i/4*100).toFixed(2)}%">${fmtD(addDays(r.laStart,i*7))}</div>`).join("");
    const rows = r.schedule.map((a)=>{ const s=parseD(a.start).getTime(); const dur=Math.max(1,a.duration||1);
      let left=(s-win0)/span*100; let width=dur/28*100; if(left<0){ width+=left; left=0; } if(left>100){left=100;width=0;} if(left+width>100) width=100-left; width=Math.max(width,1.4);
      const col = a.status==="complete"?"var(--green)":a.status==="in_progress"?"var(--signal)":r.openOf(a)>0?"var(--amber)":"#7C8BA0";
      const lv = a.level||"";
      const bar = a.isMilestone ? `<span class="g-dia" style="left:${left.toFixed(2)}%;background:${col}"></span>`
        : `<div class="g-bar" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%;background:${col}"></div>`;
      return `<div class="g-row"><div class="g-lab"><span class="g-nm">${esc(a.desc||"Untitled")}</span><span class="g-sub">${esc(r.coName(a.companyId)||"")}${lv?" &middot; "+esc(lv):""}</span></div><div class="g-track">${bar}</div></div>`; }).join("");
    scheduleSection = `<section class="snap"><div class="sec-head"><span class="eyebrow">08</span><h2>Schedule snapshot</h2><div class="rule"></div></div>
      <div class="gantt"><div class="g-head"><div class="g-lab"></div><div class="g-track g-grid">${weekMarks}</div></div>${rows||'<div class="empty">No committed or active work in the lookahead.</div>'}</div>
      <div class="g-legend"><span><i class="dot" style="background:var(--signal)"></i>In progress</span><span><i class="dot" style="background:var(--amber)"></i>Make-ready</span><span><i class="dot" style="background:var(--green)"></i>Complete</span><span><i class="dot" style="background:#7C8BA0"></i>Planned</span></div></section>`;
  }
  const weekNo = isoWeek(r.start);
  const periodLabel = mode==="range"
    ? `${fmtFull(r.start)} to ${fmtFull(r.end)}`
    : `Week ${weekNo} &nbsp;|&nbsp; commencing ${r.start.toLocaleDateString("en-GB",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}`;
  const sumHtml = esc(summary).replace(/\n+/g,"<br>");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FIN04 Weekly DLP Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#0F1E2E;--ink-2:#33485C;--muted:#647689;--paper:#FFFFFF;--backdrop:#E9EDF1;--line:#E0E6EC;--line-2:#EEF2F6;--signal:#1E63D6;--green:#0E9384;--amber:#C07A00;--red:#C0392B;--display:"Space Grotesk","Inter",system-ui,sans-serif;--body:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{background:var(--backdrop);font-family:var(--body);color:var(--ink);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px}
.num{font-variant-numeric:tabular-nums lining-nums}
.bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 18px;background:var(--ink);color:#fff}
.bar .hint{font-size:12.5px;color:#A9BBCD}.bar button{font-family:var(--body);font-size:13px;font-weight:600;border:0;border-radius:8px;background:var(--signal);color:#fff;padding:9px 16px;cursor:pointer}
.bar button:hover{filter:brightness(1.08)}
.sheet{max-width:880px;margin:26px auto;background:var(--paper);box-shadow:0 18px 50px rgba(15,30,46,.14);border-radius:4px;overflow:hidden}
.mast{background:#001C26;color:#fff;padding:26px 38px 22px;position:relative}
.mast::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--signal) 0 38%,var(--green) 38% 64%,var(--amber) 64% 86%,var(--red) 86% 100%)}
.mast-top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.brand{display:flex;align-items:center;gap:13px}.brand .logo{height:52px;width:auto;display:block}
.brand .proj{border-left:1px solid rgba(255,255,255,.22);padding-left:13px;margin-left:2px}
.brand .proj .p1{font-weight:600;font-size:14px}.brand .proj .p2{font-size:11.5px;color:#9DB0C2;margin-top:1px}
.mast .issued{text-align:right;font-size:11.5px;color:#9DB0C2;line-height:1.55}.mast .issued b{color:#fff;font-weight:600}
.mast h1{font-family:var(--display);font-weight:600;font-size:27px;letter-spacing:-.015em;margin:20px 0 0}
.mast .wk{margin-top:5px;font-size:13.5px;color:#C6D3DF}
.eyebrow{font-size:10.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
.body{padding:30px 38px 12px}section{margin:0 0 30px}
.sec-head{display:flex;align-items:center;gap:12px;margin:0 0 14px}.sec-head .eyebrow{color:var(--signal)}
.sec-head h2{font-family:var(--display);font-weight:600;font-size:16.5px;letter-spacing:-.01em;margin:0}.sec-head .rule{flex:1;height:1px;background:var(--line)}
.lede{font-size:14.5px;color:var(--ink-2);line-height:1.6;margin:0 0 20px;max-width:64ch}.lede b{color:var(--ink);font-weight:600}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.kpi{background:var(--paper);padding:13px 15px}.kpi .v{font-family:var(--display);font-weight:600;font-size:25px;line-height:1}
.kpi .l{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-top:7px}
.hero{display:grid;grid-template-columns:200px 1fr;gap:30px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:24px 26px;background:linear-gradient(180deg,#FBFCFD,#fff)}
.hero .big{font-family:var(--display);font-weight:700;font-size:74px;line-height:.9;letter-spacing:-.03em}.hero .big small{font-size:30px;font-weight:600;color:var(--muted)}
.hero .caplabel{margin-top:6px}.hero .caplabel .eyebrow{color:var(--signal)}.hero .caplabel .sub{font-size:12px;color:var(--muted);margin-top:3px}
.promise{display:flex;flex-direction:column;gap:11px}.promise .row{display:flex;justify-content:space-between;align-items:baseline}.promise .row .t{font-size:13px;color:var(--ink-2)}.promise .row .t b{color:var(--ink)}
.cells{display:flex;gap:5px}.cell{flex:1;height:30px;border-radius:5px}.cell.kept{background:var(--green)}.cell.miss{background:var(--red)}
.spark{display:flex;align-items:center;gap:12px;margin-top:3px}.spark .lab{font-size:11.5px;color:var(--muted)}
.legend{display:flex;gap:16px;font-size:11.5px;color:var(--muted)}.legend span{display:inline-flex;align-items:center;gap:6px}.dot{width:10px;height:10px;border-radius:3px;display:inline-block}
.cards{display:flex;flex-direction:column;gap:12px}.ccard{border:1px solid var(--line);border-radius:11px;overflow:hidden}
.ccard .top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:13px 16px;background:var(--line-2);border-bottom:1px solid var(--line)}
.ccard .top .title{font-weight:600;font-size:14.5px}.ccard .top .meta{font-size:11.5px;color:var(--muted);margin-top:3px}
.badge{font-size:10.5px;font-weight:700;letter-spacing:.04em;padding:4px 9px;border-radius:999px;white-space:nowrap}.b-will{background:#E7EEFB;color:var(--signal)}.b-wit{background:#EFE9FB;color:#6D3BD0}
.cons{list-style:none;margin:0;padding:6px 8px}.con{display:grid;grid-template-columns:14px 1fr auto;gap:11px;align-items:center;padding:9px 10px;border-radius:8px}.con+.con{border-top:1px solid var(--line-2)}
.con .pip{width:9px;height:9px;border-radius:50%}.con .ctext{font-size:13px}.con .who{font-size:11.5px;color:var(--muted);margin-top:2px}
.con .due{text-align:right;white-space:nowrap}.con .due .d{font-weight:600;font-size:12.5px}.con .due .dl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.due.ok .d{color:var(--ink-2)}.pip.ok{background:var(--green)}.due.soon .d{color:var(--amber)}.pip.soon{background:var(--amber)}.due.over .d{color:var(--red)}.pip.over{background:var(--red)}
.twocol{display:grid;grid-template-columns:1fr 1fr;gap:26px}.bars{display:flex;flex-direction:column;gap:10px}
.barrow{display:grid;grid-template-columns:140px 1fr 26px;gap:10px;align-items:center;font-size:12.5px}.barrow .nm{color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.track{height:9px;background:var(--line-2);border-radius:999px;overflow:hidden}.fill{height:100%;border-radius:999px}.barrow .ct{text-align:right;font-weight:600}
.rows{border:1px solid var(--line);border-radius:11px;overflow:hidden}.lrow{display:grid;grid-template-columns:1fr auto auto;gap:14px;align-items:center;padding:11px 16px}.lrow+.lrow{border-top:1px solid var(--line)}
.lrow .nm{font-weight:600;font-size:13.5px}.lrow .sub{font-size:11.5px;color:var(--muted);margin-top:2px}.lrow .when{font-size:12.5px;color:var(--ink-2);white-space:nowrap;font-weight:600}
.pill{font-size:10.5px;font-weight:700;letter-spacing:.04em;padding:3px 9px;border-radius:999px;white-space:nowrap}.pill.ontrack{background:#E2F2EF;color:var(--green)}.pill.risk{background:#FBEFD6;color:var(--amber)}
.ms{display:flex;align-items:center;gap:12px}.ms .dia{width:13px;height:13px;transform:rotate(45deg);flex:none}
.empty{font-size:12.5px;color:var(--muted);padding:14px 4px}
.gantt{border:1px solid var(--line);border-radius:11px;padding:6px 14px 12px}
.g-head{position:relative;height:18px;margin-bottom:4px}.g-row{display:grid;grid-template-columns:200px 1fr;gap:12px;align-items:center;padding:5px 0;border-top:1px solid var(--line-2)}
.g-lab{display:flex;flex-direction:column;min-width:0}.g-nm{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.g-sub{font-size:10px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g-track{position:relative;height:16px}.g-grid{height:18px;border-left:1px solid var(--line);border-right:1px solid var(--line)}
.g-wk{position:absolute;top:2px;font-size:9.5px;color:var(--muted);transform:translateX(3px);border-left:1px solid var(--line-2);padding-left:3px;height:14px}
.g-bar{position:absolute;top:3px;height:10px;border-radius:3px;min-width:3px}.g-dia{position:absolute;top:3px;width:10px;height:10px;transform:translateX(-5px) rotate(45deg)}
.g-legend{display:flex;gap:16px;font-size:11px;color:var(--muted);margin-top:10px}.g-legend span{display:inline-flex;align-items:center;gap:6px}
footer{padding:18px 38px 30px;border-top:1px solid var(--line);margin-top:10px;font-size:11px;color:var(--muted)}footer b{color:var(--ink-2);font-weight:600}
@media (max-width:720px){.hero{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,1fr)}.twocol{grid-template-columns:1fr}.g-row,.g-head{grid-template-columns:120px 1fr}.body,.mast,footer{padding-left:20px;padding-right:20px}}
@page{size:A4;margin:13mm 12mm}
@media print{body{background:#fff}.bar{display:none}.sheet{max-width:none;margin:0;box-shadow:none;border-radius:0}.mast{padding:0 0 16px}.body{padding:18px 0 0}footer{padding:14px 0 0}section,.ccard,.hero,.kpis,.rows,.barrow,.g-row{break-inside:avoid}.sec-head{break-after:avoid}}
</style></head><body>
<div class="bar"><div class="hint">Weekly DLP Report. Click Download PDF, then choose "Save as PDF".</div><button onclick="window.print()">Download PDF</button></div>
<div class="sheet">
<div class="mast"><div class="mast-top">
<div class="brand"><img class="logo" src="${ATNORTH_LOGO}" alt="atNorth"><div class="proj"><div class="p1">FIN04 Data Centre</div><div class="p2">Koski, Finland</div></div></div>
<div class="issued">Issued <b>${fmtFull(r.today)}</b><br>${esc(by||"")}</div></div>
<h1>Weekly DLP Report</h1><div class="wk num">${periodLabel} &nbsp;|&nbsp; lookahead to ${fmtFull(r.laEnd)}</div></div>
<div class="body">
<section><p class="lede">${sumHtml}</p>
<div class="kpis">${kpiTiles}</div></section>
<section><div class="sec-head"><span class="eyebrow">01</span><h2>Plan reliability</h2><div class="rule"></div></div>
<div class="hero"><div><div class="big num">${r.ppc==null?"&ndash;":r.ppc}<small>${r.ppc==null?"":"%"}</small></div><div class="caplabel"><div class="eyebrow">Percent plan complete</div><div class="sub">${r.ppc==null?"no commitments due":r.kept.length+" of "+r.due.length+" commitments kept"}</div></div></div>
<div class="promise"><div class="row"><span class="t">This week's commitments &nbsp;<b>(WILL)</b></span><span class="t"><b>${r.kept.length}</b> kept &nbsp; <b>${r.missed.length}</b> missed</span></div>
<div class="cells">${cells}</div>
<div class="spark">${spark}<div style="flex:1"></div><div class="legend"><span><i class="dot" style="background:var(--green)"></i>Kept</span><span><i class="dot" style="background:var(--red)"></i>Missed</span></div></div></div></div></section>
<section><div class="sec-head"><span class="eyebrow">02</span><h2>Open constraints</h2><div class="rule"></div></div><div class="cards">${cardsHtml}</div></section>
<section><div class="twocol"><div><div class="sec-head"><span class="eyebrow">03</span><h2>Why work slipped</h2><div class="rule"></div></div><div class="bars">${reasonsHtml}</div></div>
<div><div class="sec-head"><span class="eyebrow">04</span><h2>By contractor</h2><div class="rule"></div></div><div class="bars">${coHtml}</div></div></div></section>
<section><div class="sec-head"><span class="eyebrow">05</span><h2>By Cx stage</h2><div class="rule"></div></div><div class="bars">${cxHtml}</div></section>
<section><div class="sec-head"><span class="eyebrow">06</span><h2>Committed next week</h2><div class="rule"></div></div><div class="rows">${nwHtml}</div></section>
<section><div class="sec-head"><span class="eyebrow">07</span><h2>Milestones ahead</h2><div class="rule"></div></div><div class="rows">${msHtml}</div></section>
${scheduleSection}
</div>
<footer>Generated from DLP &middot; dlp-pi.vercel.app &middot; FIN04 commissioning lookahead</footer>
</div></body></html>`;
}

function ReportsPage({ S, LV, coName, exportActivities, exportWitness, onOpen, isAdmin, by }) {
  const [co, setCo] = useState("all");
  const [ar, setAr] = useState("all");
  const [lv, setLv] = useState("all");
  const [drill, setDrill] = useState(null);
  const openDrill = (title, items) => setDrill({ title, items: items || [] });
  const [period, setPeriod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // weekly report config
  const defWeek = useMemo(() => { const t = new Date(todayMid()); const dow = t.getDay(); const back = (dow - 5 + 7) % 7; const fri = addDays(t, -back); const mon = mondayOf(fri); return { start: mon, end: addDays(mon, 6) }; }, []);
  const [repOpen, setRepOpen] = useState(false);
  const [repMode, setRepMode] = useState("week");
  const [repFrom, setRepFrom] = useState(fmtISO(defWeek.start));
  const [repTo, setRepTo] = useState(fmtISO(defWeek.end));
  const [repSummary, setRepSummary] = useState(null);
  const [repSchedule, setRepSchedule] = useState(true);
  const repStart = repMode === "week" ? defWeek.start : (repFrom ? parseD(repFrom) : defWeek.start);
  const repEnd = repMode === "week" ? defWeek.end : (repTo ? parseD(repTo) : defWeek.end);
  const repData = useMemo(() => repOpen ? computeReport({ S, LV, coName, start: repStart, end: repEnd }) : null, [repOpen, S, LV, repStart.getTime(), repEnd.getTime()]);
  const repSummaryVal = repSummary != null ? repSummary : (repData ? draftSummary(repData) : "");
  const generateReport = () => {
    const html = buildWeeklyReportHTML({ r: repData, summary: repSummaryVal, includeSchedule: repSchedule, by, mode: repMode });
    const w = window.open("", "_blank");
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    else { const url = URL.createObjectURL(new Blob([html], { type: "text/html" })); const a = document.createElement("a"); a.href = url; a.download = `FIN04-weekly-report-${fmtISO(repStart)}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
    setRepOpen(false);
  };
  const finishOf = (a) => addDays(parseD(a.start), (a.duration || 1) - 1);
  const inPeriod = (a) => { if (period === "all") return true; if (!a.start) return false; const s = parseD(a.start).getTime(), e = finishOf(a).getTime(); if (from && e < parseD(from).getTime()) return false; if (to && s > parseD(to).getTime()) return false; return true; };
  const acts = S.activities.filter((a) => (co === "all" || a.companyId === co) && (ar === "all" || a.area === ar) && (lv === "all" || a.level === lv) && inPeriod(a));
  const made = (a) => a.status === "complete" && (!a.actualFinish || parseD(a.actualFinish) <= finishOf(a));
  const openOf = (a) => (a.constraints || []).filter((c) => !c.done).length;
  const isDelayed = (a) => { if (!a.start) return false; const ps = parseD(a.start); const pf = addDays(ps, (a.duration || 1) - 1); if (a.status === "complete" && a.actualFinish) return parseD(a.actualFinish) > pf; if (a.actualStart) return parseD(a.actualStart) > ps; return false; };
  const committed = acts.filter((a) => a.committed);
  const ppc = committed.length ? Math.round(committed.filter(made).length / committed.length * 100) : null;
  const complete = acts.filter((a) => a.status === "complete").length;
  const cardDefs = [
    { l: "Total activities", f: () => true },
    { l: "Committed", f: (a) => a.committed },
    { l: "Complete", c: "#0E9384", f: (a) => a.status === "complete" },
    { l: "In progress", f: (a) => a.status === "in_progress" },
    { l: "Ready to run", c: "#0E9384", f: (a) => openOf(a) === 0 && a.status !== "complete" },
    { l: "Need make-ready", c: "#D97706", f: (a) => openOf(a) > 0 && a.status !== "complete" },
    { l: "Delayed", c: "#C0392B", f: isDelayed },
    { l: "Witness required", c: "#5B33C7", f: (a) => a.witnessInvite },
  ];
  const cards = cardDefs.map((d) => ({ ...d, v: acts.filter(d.f).length }));
  const byCompany = S.companies.map((c) => ({ id: c.id, name: c.name, n: acts.filter((a) => a.companyId === c.id).length, open: acts.filter((a) => a.companyId === c.id).reduce((s, a) => s + openOf(a), 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const byLevel = Object.keys(LV).map((k) => ({ k, name: `${k} ${LV[k].name}`, color: LV[k].color, n: acts.filter((a) => a.level === k).length })).filter((x) => x.n > 0);
  const statusData = [{ k: "planned", name: "Planned", color: "#94A3B8" }, { k: "in_progress", name: "In progress", color: "#2563EB" }, { k: "complete", name: "Complete", color: "#0E9384" }].map((s) => ({ ...s, n: acts.filter((a) => a.status === s.k).length }));
  const maxCo = Math.max(1, ...byCompany.map((x) => x.n));
  const maxLv = Math.max(1, ...byLevel.map((x) => x.n));
  // weekly PPC trend, committed activities grouped by the week of their planned finish
  const withDates = acts.filter((a) => a.start);
  const points = [];
  if (withDates.length) {
    let cur = mondayOf(new Date(Math.min(...withDates.map((a) => parseD(a.start).getTime()))));
    let end = mondayOf(new Date(Math.max(...withDates.map((a) => finishOf(a).getTime()))));
    if (period === "range") { if (from) cur = new Date(Math.max(cur.getTime(), mondayOf(parseD(from)).getTime())); if (to) end = new Date(Math.min(end.getTime(), mondayOf(parseD(to)).getTime())); }
    let guard = 0;
    while (cur.getTime() <= end.getTime() && guard < 60) {
      const wk = new Date(cur);
      const due = withDates.filter((a) => mondayOf(finishOf(a)).getTime() === wk.getTime());
      const comm = due.filter((a) => a.committed);
      points.push({ label: "W" + isoWeek(wk), value: comm.length ? Math.round(comm.filter(made).length / comm.length * 100) : null, items: comm });
      cur = addDays(cur, 7); guard++;
    }
  }
  const hasTrend = points.some((p) => p.value != null);
  // reasons for non-completion: committed activities, due to date, not made on time
  const today0 = todayMid();
  const misses = committed.filter((a) => a.start && !made(a) && finishOf(a).getTime() < today0);
  const reasonTally = {}; misses.forEach((a) => { const r = a.slipReason || "Unattributed"; reasonTally[r] = (reasonTally[r] || 0) + 1; });
  const reasonRows = Object.entries(reasonTally).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
  const maxR = Math.max(1, ...reasonRows.map((x) => x.n));
  const printPdf = () => { document.body.classList.add("rep-print"); setTimeout(() => { try { window.print(); } finally { setTimeout(() => document.body.classList.remove("rep-print"), 300); } }, 60); };
  const exportMetrics = async () => {
    try {
      const mod = await import("exceljs/dist/exceljs.min.js"); const ExcelJS = mod.default || mod;
      const wb = new ExcelJS.Workbook(); const head = (ws) => { ws.getRow(1).font = { bold: true }; };
      const s = wb.addWorksheet("Summary"); s.columns = [{ header: "Metric", key: "m", width: 30 }, { header: "Value", key: "v", width: 18 }]; head(s);
      s.addRow({ m: "Generated", v: new Date().toLocaleString("en-GB") });
      s.addRow({ m: "Company filter", v: co === "all" ? "All companies" : coName(co) });
      s.addRow({ m: "Building filter", v: ar === "all" ? "All buildings" : ar });
      s.addRow({ m: "Cx stage filter", v: lv === "all" ? "All Cx stages" : lv });
      s.addRow({ m: "Period", v: period === "all" ? "All time" : ((from || "start") + " to " + (to || "end")) });
      s.addRow({ m: "PPC (committed done on time)", v: ppc == null ? "n/a" : ppc + "%" });
      s.addRow({});
      cards.forEach((c) => s.addRow({ m: c.l, v: c.v }));
      const w = wb.addWorksheet("Weekly PPC"); w.columns = [{ header: "Week", key: "wk", width: 12 }, { header: "PPC %", key: "p", width: 10 }]; head(w);
      points.forEach((p) => w.addRow({ wk: p.label, p: p.value == null ? "" : p.value }));
      const r = wb.addWorksheet("Non-completion"); r.columns = [{ header: "Reason", key: "n", width: 34 }, { header: "Count", key: "c", width: 10 }]; head(r);
      reasonRows.length ? reasonRows.forEach((x) => r.addRow({ n: x.name, c: x.n })) : r.addRow({ n: "No missed commitments in scope", c: 0 });
      const bc = wb.addWorksheet("By company"); bc.columns = [{ header: "Company", key: "n", width: 26 }, { header: "Activities", key: "a", width: 12 }, { header: "Open constraints", key: "o", width: 16 }]; head(bc);
      byCompany.forEach((x) => bc.addRow({ n: x.name, a: x.n, o: x.open }));
      const bl = wb.addWorksheet("By Cx stage"); bl.columns = [{ header: "Cx stage", key: "n", width: 26 }, { header: "Activities", key: "a", width: 12 }]; head(bl);
      byLevel.forEach((x) => bl.addRow({ n: x.name, a: x.n }));
      const st = wb.addWorksheet("Status mix"); st.columns = [{ header: "Status", key: "n", width: 18 }, { header: "Count", key: "c", width: 10 }]; head(st);
      statusData.forEach((x) => st.addRow({ n: x.name, c: x.n }));
      const buf = await wb.xlsx.writeBuffer(); const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = `FIN04-analytics-${fmtISO(new Date())}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { alert("Excel export failed: " + (e && e.message ? e.message : e)); }
  };
  return (
    <div className="lk-rep">
      <div className="sub" style={{ marginTop: 2 }}>Project health across the whole plan, not just the lookahead window. Filter, then export.</div>
      <div className="lk-rep-filters">
        <div className="lk-f" style={{ minWidth: 150 }}><label>Company</label><select className="lk-select" value={co} onChange={(e) => setCo(e.target.value)}><option value="all">All companies</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 150 }}><label>Building</label><select className="lk-select" value={ar} onChange={(e) => setAr(e.target.value)}><option value="all">All buildings</option>{S.areas.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 130 }}><label>Cx Stage</label><select className="lk-select" value={lv} onChange={(e) => setLv(e.target.value)}><option value="all">All Cx stages</option>{Object.keys(LV).map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 120 }}><label>Period</label><select className="lk-select" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">All time</option><option value="range">Date range</option></select></div>
        {period === "range" && <div className="lk-f" style={{ minWidth: 132 }}><label>From</label><input className="lk-in mono" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>}
        {period === "range" && <div className="lk-f" style={{ minWidth: 132 }}><label>To</label><input className="lk-in mono" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>}
        <button className="lk-btn" onClick={exportActivities}><Icon n="download" s={14} />Export all activities</button>
        <button className="lk-btn" onClick={exportWitness}><Icon n="download" s={14} />Export witness invites</button>
        {isAdmin && <button className="lk-btn primary" onClick={() => { setRepMode("week"); setRepFrom(fmtISO(defWeek.start)); setRepTo(fmtISO(defWeek.end)); setRepSummary(null); setRepSchedule(true); setRepOpen(true); }}><Icon n="chart" s={14} />Weekly Report</button>}
        <button className="lk-btn" onClick={exportMetrics}><Icon n="download" s={14} />Metrics (Excel)</button>
        <button className="lk-btn" onClick={printPdf}><Icon n="download" s={14} />PDF</button>
      </div>
      {period === "range" && <div style={{ fontSize: 12, color: "var(--muted)", margin: "-4px 0 12px" }}>Every metric below counts only activities whose planned dates fall within {from ? new Date(from).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "the start"} and {to ? new Date(to).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "the end"}. An activity counts if its planned window overlaps that range. <b>{acts.length}</b> match.</div>}
      <div className="lk-rep-2col">
      <div className="lk-rep-sec" style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
        <Gauge value={ppc} onClick={() => openDrill("PPC \u00b7 committed activities", committed)} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ marginBottom: 8 }}>Percent Plan Complete</h3>
          <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
            {committed.length ? <>Of <b style={{ color: "var(--ink)" }}>{committed.length}</b> committed activities, <b style={{ color: "#0E9384" }}>{committed.filter(made).length}</b> were completed on or before their promised finish. PPC is the reliability of promises kept, the core Last Planner metric.</> : <>No activities are committed yet, so PPC cannot be calculated. Toggle "Committed for this week" on the promises your teams make, and this fills in.</>}
          </div>
        </div>
      </div>
      <div className="lk-rep-cards">
        {cards.map((c, i) => <div key={i} className="lk-rep-card clickable" onClick={() => openDrill(c.l, acts.filter(c.f))}><span className="v" style={{ color: c.c || "var(--ink)" }}>{c.v}</span><span className="l">{c.l}</span></div>)}
      </div>
      </div>
      <div className="lk-rep-2col">
      <div className="lk-rep-sec"><h3>Weekly PPC trend</h3>{hasTrend ? <Trend points={points} onPoint={(i) => openDrill("Week " + points[i].label + " \u00b7 committed due", points[i].items)} /> : <div style={{ fontSize: 12, color: "var(--muted)" }}>Needs committed activities across weeks to plot a trend.</div>}</div>
      <div className="lk-rep-sec"><h3>Reasons for non-completion</h3>
        {misses.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted)" }}>No missed commitments to date. Every committed activity whose promised finish has passed was completed on time.</div>
          : <><div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 10 }}><b style={{ color: "#C0392B" }}>{misses.length}</b> committed activit{misses.length === 1 ? "y" : "ies"} due to date {misses.length === 1 ? "was" : "were"} not completed as promised{reasonTally["Unattributed"] ? <>, of which <b style={{ color: "var(--ink)" }}>{reasonTally["Unattributed"]}</b> {reasonTally["Unattributed"] === 1 ? "has" : "have"} no reason recorded</> : ""}. Recording the reason on each miss turns this into a Pareto of what is actually breaking the plan.</div>
            {reasonRows.map((x) => <RepBar key={x.name} label={x.name} n={x.n} max={maxR} color={x.name === "Unattributed" ? "#94A3B8" : "#C0392B"} onClick={() => openDrill("Missed \u00b7 " + x.name, misses.filter((m) => (m.slipReason || "Unattributed") === x.name))} />)}</>}
      </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
        <div className="lk-rep-sec"><h3>Status mix</h3><div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}><Donut data={statusData} onSlice={(d) => openDrill(d.name, acts.filter((a) => a.status === d.k))} /><div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{statusData.map((s) => <div key={s.k} onClick={() => openDrill(s.name, acts.filter((a) => a.status === s.k))} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}><span style={{ width: 11, height: 11, borderRadius: 3, background: s.color }} />{s.name}<span style={{ color: "var(--muted)" }}>{s.n}</span></div>)}</div></div></div>
        <div className="lk-rep-sec"><h3>Activities by company</h3>{byCompany.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted)" }}>No activities.</div> : byCompany.map((x) => <RepBar key={x.name} label={`${x.name}${x.open ? ` (${x.open} open)` : ""}`} n={x.n} max={maxCo} onClick={() => openDrill(x.name, acts.filter((a) => a.companyId === x.id))} />)}</div>
      </div>
      <div className="lk-rep-sec"><h3>By Cx stage</h3>{byLevel.map((x) => <RepBar key={x.name} label={x.name} n={x.n} max={maxLv} color={x.color} onClick={() => openDrill(x.name, acts.filter((a) => a.level === x.k))} />)}</div>
      {repOpen && <div className="lk-modal-bg" onClick={() => setRepOpen(false)}>
        <div className="lk-modal" style={{ ...cssVars(S.theme), maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
          <div className="lk-dh"><h3>Generate Weekly DLP Report</h3><button className="lk-btn icon" onClick={() => setRepOpen(false)}><Icon n="x" /></button></div>
          <div className="bd">
            <div className="rep-fld"><label>Reporting period</label>
              <div className="rep-seg">
                <button className={repMode === "week" ? "on" : ""} onClick={() => { setRepMode("week"); setRepSummary(null); }}>Week just ended</button>
                <button className={repMode === "range" ? "on" : ""} onClick={() => { setRepMode("range"); setRepSummary(null); }}>Custom range</button>
              </div>
            </div>
            {repMode === "week"
              ? <div className="rep-hint">Week {isoWeek(defWeek.start)} {"\u00b7"} {fmtDoW(defWeek.start)} to {fmtDoW(defWeek.end)}</div>
              : <div className="rep-dates"><div className="lk-f"><label>From</label><input className="lk-in mono" type="date" value={repFrom} onChange={(e) => { setRepFrom(e.target.value); setRepSummary(null); }} /></div><div className="lk-f"><label>To</label><input className="lk-in mono" type="date" value={repTo} onChange={(e) => { setRepTo(e.target.value); setRepSummary(null); }} /></div></div>}
            <div className="rep-fld"><label>Executive summary <span className="rep-mut">(auto-drafted, editable)</span></label>
              <textarea className="lk-in rep-sum" rows={4} value={repSummaryVal} onChange={(e) => setRepSummary(e.target.value)} /></div>
            <label className="rep-check"><input type="checkbox" checked={repSchedule} onChange={(e) => setRepSchedule(e.target.checked)} /> Include schedule snapshot (4 week lookahead)</label>
          </div>
          <div className="rep-foot"><button className="lk-btn" onClick={() => setRepOpen(false)}>Cancel</button><button className="lk-btn primary" onClick={generateReport}><Icon n="chart" s={14} />Generate report</button></div>
        </div>
      </div>}
      {drill && <DrillModal title={drill.title} items={drill.items} S={S} LV={LV} coName={coName} onOpen={onOpen} onClose={() => setDrill(null)} />}
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
