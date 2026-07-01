import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadAll, loadProjects, loadProjectOverview, createProject, syncCollections, userOp, signOut, subscribeAll, updateBranding, uploadLogo, uploadCompanyLogo, applyBrandToTab, fetchUserStatus, heartbeat, loadPresence, fetchActivityAudit, fetchAccessRequests, decideAccessRequest, subscribeAccessRequests, submitInviteRequest, decideInviteRequest, createCompany, setCompanyDomain, loadProjectMembers, addMember, setMemberRole, removeMember, loadMembershipCounts, setPlatformRole, loadBaseline, saveBaseline, saveBaselineMappings, clearBaseline, loadReportRecipients, saveReportRecipients } from "./data";
import { parseXER, parseMSPDI, parseCSV, autodetectMapping, autodetectMsCol, tabularToBaseline, decodeXer, wbsPath } from "./xer";
import { ASSETS, ASSET_BY_TAG, parseAssetTag, deriveFromAssets, parseAssetField, joinAssetField } from "./assets";
import { DISCIPLINES, witnessRecipients } from "./witnessContacts";
import SetPassword from "./SetPassword.jsx";
import CxProgressPage from "./CxProgress.jsx";
import { supabase } from "./supabaseClient";

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
const QMC_LIGHT = "data:image/png;base64,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";
const QMC_DARK = "data:image/png;base64,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";
const QMC_FAV = "data:image/png;base64,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";
const THEMES = {
  light: { ink: "#16202E", paper: "#F7F8FA", card: "#FFFFFF", line: "#DCE1E8", muted: "#6B7785", accent: "#1E5FCC", weekend: "#EFF1F5", todcell: "#F0F5FE", todhead: "#E8EFFB", todedge: "#A3BEEC", hover: "#EAF0F9", chipbg: "#E8EFFB" },
  dark: { ink: "#E6EAF0", paper: "#10151C", card: "#1A222D", line: "#2A3543", muted: "#8A97A6", accent: "#6B9BF2", weekend: "#161D26", todcell: "#18222F", todhead: "#1B2737", todedge: "#476AA0", hover: "#202B38", chipbg: "#22324A" },
};

const AV_BG = ["#2C4A7A", "#3A6B5C", "#7A5230", "#5A4A7A", "#445C77", "#6B4A4A", "#3C6B45", "#7A6030"];
const avBg = (seed) => { const s = String(seed || "?"); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AV_BG[h % AV_BG.length]; };
const avInit = (n) => (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const MS_STEP = 22;   // vertical gap between stacked milestones (was 14, caused spillage)

const css = `
.lk{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--paper);
  min-height:100vh;width:100%;display:flex;flex-direction:column;-webkit-font-smoothing:antialiased}
.lk *{box-sizing:border-box}
.mono{font-variant-numeric:tabular-nums}
.lk-bar{display:flex;align-items:center;gap:12px;padding:0 18px;height:54px;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:30;background:var(--paper)}
.lk-brandlogo{display:block}
.lk-branddiv{width:1px;height:20px;background:var(--line);flex:none}
.lk-brandid{display:flex;align-items:baseline;gap:7px;min-width:0}
.lk-projname{font-weight:700;font-size:14px;letter-spacing:-.01em;white-space:nowrap}
.lk-appname{font-size:10.5px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.13em;white-space:nowrap}
.lk-toolbar{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--line);background:var(--card);position:sticky;top:54px;z-index:25}
.lk-title{font-weight:700;font-size:16px;letter-spacing:-0.01em}
.lk-sub{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:0.12em;margin-top:2px}
.lk-nav{display:flex;align-items:center;gap:4px}
.lk-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--card);color:var(--ink);
  border-radius:8px;padding:7px 10px;font-size:12.5px;cursor:pointer;font-weight:500;transition:.12s}
.lk-btn:hover{border-color:var(--muted)}.lk-btn.icon{padding:7px 8px}
.lk-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.lk-btn.on{background:var(--ink);border-color:var(--ink);color:var(--paper)}
.lk-btn.pill{border-radius:999px;padding:8px 14px}
.lk-btn.pill svg{color:var(--accent)}
.lk-btn.pill:hover{border-color:var(--accent)}
.lk-btn.pill.on{background:var(--accent);border-color:var(--accent);color:#fff}
.lk-btn.pill.on svg{color:#fff}
.lk-btn:disabled{opacity:.45;cursor:not-allowed}
.lk-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--card)}
.lk-seg button{border:0;background:transparent;padding:7px 11px;font-size:12px;cursor:pointer;color:var(--muted);font-weight:600}
.lk-seg button.sel{background:var(--ink);color:var(--paper)}
.lk-wsel{border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);font-size:12px;font-weight:600;font-family:inherit;padding:7px 9px;cursor:pointer}
.lk-wsel:hover{background:var(--hover)}
.lk-spacer{flex:1}
.lk-sel{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:6px 9px;font-size:12.5px;font-family:inherit;cursor:pointer}
.lk-who{display:flex;align-items:center;gap:7px;font-size:12px}
.lk-notifbtn{position:relative}
.lk-notifbadge{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:#E5484D;color:#fff;font-size:10px;font-weight:800;line-height:16px;text-align:center;box-shadow:0 0 0 2px var(--paper);pointer-events:none}
.lk-ment{position:absolute;left:0;top:calc(100% + 3px);z-index:60;background:var(--card);border:1px solid var(--line);border-radius:9px;box-shadow:0 10px 30px rgba(0,0,0,.2);min-width:210px;max-height:240px;overflow:auto;padding:4px}
.lk-ment-i{display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:6px;font-size:12px;cursor:pointer;color:var(--ink)}
.lk-ment-i:hover{background:var(--hover)}
.lk-ment-tag{margin-left:auto;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.lk-ncard{display:flex;flex-direction:column;gap:3px;padding:10px 12px;border:1px solid var(--line);border-left:3px solid #E0A106;border-radius:9px;background:var(--card);cursor:pointer}
.lk-ncard:hover{box-shadow:0 3px 10px rgba(0,0,0,.14)}
.lk-ncard.over{border-left-color:#C0392B}
.lk-colead{height:22px;max-width:96px;object-fit:contain;display:block;border-radius:3px}
.lk-pill{font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:2px 7px;border-radius:5px}
.lk-pill.admin{background:#7C3AED;color:#fff}.lk-pill.member{background:var(--chipbg);color:var(--accent)}
.lk-metrics{display:flex;border-bottom:1px solid var(--line);background:var(--card);overflow-x:auto}
.lk-metric{padding:10px 20px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:2px;min-width:118px}
.lk-metric .v{font-size:21px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}
.lk-metric .l{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em}
.lk-metric .sub{font-size:10.5px;color:var(--muted)}
.lk-metric.clickable{cursor:pointer;transition:background .12s}
.lk-metric.clickable:hover{background:var(--hover)}
.lk-board{flex:1;overflow:auto;position:relative}
.lk-boardpage{height:calc(100vh - 54px);display:flex;flex-direction:column;overflow:hidden}
.lk-head{display:grid;position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:1px solid var(--line)}
.lk-wk{border-right:1px solid var(--line);padding:6px 9px 3px;font-size:10.5px;font-weight:700;letter-spacing:.04em;border-bottom:1px solid var(--line)}
.lk-wk .wc{color:var(--muted);font-weight:500;margin-left:5px}
.lk-day{padding:4px 0 5px;text-align:center;border-right:1px solid var(--line);font-size:9.5px;color:var(--muted)}
.lk-day .wd{text-transform:uppercase;letter-spacing:.06em}
.lk-day .dn{font-size:12.5px;color:var(--ink);font-weight:600;margin-top:1px}
.lk-day.we{background:var(--weekend)}.lk-day.tod{background:var(--todhead);position:relative}.lk-day.tod .dn{color:var(--accent)}
.lk-lane{display:grid;border-bottom:1px solid var(--line)}
.lk-llbl{position:sticky;left:0;z-index:4;background:var(--paper);border-right:1px solid var(--line);padding:9px 11px;
  display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600}
.lk-llbl .cnt{font-size:9.5px;color:var(--muted);font-weight:500}
.lk-llbl .sw{width:8px;height:8px;border-radius:2px;flex:none}
.lk-lanelogo{height:24px;max-width:124px;object-fit:contain;object-position:left center;display:block;margin-bottom:3px}
.lk-track{position:relative}
.lk-under{position:absolute;inset:0;display:grid;z-index:0}
.lk-cell{border-right:1px solid var(--line);cursor:cell}
.lk-cell.we{background:var(--weekend)}.lk-cell.tod{background:var(--todcell);position:relative}
.lk-cell.tod::after{content:"";position:absolute;inset:0;border-left:1px solid var(--todedge);border-right:1px solid var(--todedge);pointer-events:none}
.lk-day.tod::after{content:"";position:absolute;inset:0;border-left:1px solid var(--todedge);border-right:1px solid var(--todedge);border-top:1px solid var(--todedge);pointer-events:none}
.lk-cell:hover{background:var(--hover)}.lk-cell.nodrop{cursor:not-allowed}
.lk-tk{position:relative;z-index:1;display:grid;padding:6px 0;row-gap:6px;column-gap:0;pointer-events:none}
.lk-ticket{position:relative;pointer-events:auto;background:var(--card);border:1px solid var(--line);border-left-width:4px;border-radius:12px;margin:0 2px;
  padding:9px 12px 10px;font-size:12px;cursor:grab;overflow:hidden;box-shadow:none;min-width:0;
  display:flex;flex-direction:column;justify-content:flex-start;gap:3px;transition:box-shadow .12s,border-color .12s}
.lk-ticket:hover{box-shadow:0 3px 10px rgba(0,0,0,.16)}.lk-ticket:active{cursor:grabbing}
.lk-ticket.ro{cursor:default;border-style:dotted}
.lk-rsz{position:absolute;top:0;bottom:0;width:10px;cursor:ew-resize;z-index:3}
.lk-rsz.l{left:0}.lk-rsz.r{right:0}
.lk-rsz::after{content:"";position:absolute;top:50%;transform:translateY(-50%);width:3px;height:42%;border-radius:2px;background:var(--muted);opacity:0;transition:opacity .12s}
.lk-rsz.l::after{left:2px}.lk-rsz.r::after{right:2px}
.lk-ticket:hover .lk-rsz::after{opacity:.45}.lk-rsz:hover::after{opacity:.9}
.lk-ticket.resizing{box-shadow:0 3px 12px rgba(0,0,0,.22);cursor:ew-resize}
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
.lk-ghost{opacity:.5;pointer-events:none;z-index:0}.lk-ghost.bar{align-self:stretch;margin:3px 2px;border:1.5px dashed var(--muted);border-radius:6px;background:transparent}.lk-ghost.ms{align-self:center;display:flex;align-items:center;justify-content:center}.lk-ghost.ms .dia{width:12px;height:12px;transform:rotate(45deg);border:1.5px dashed var(--muted);background:transparent}
.lk-rtrail{align-self:center;height:0;border-top:2px dotted #C0392B;z-index:0;pointer-events:none}
.lk-ms{position:relative;pointer-events:auto;display:flex;align-items:center;justify-content:center;cursor:grab;overflow:visible;align-self:center;z-index:2}
.lk-ms .dia{width:12px;height:12px;transform:rotate(45deg);flex:none;border:1px solid rgba(0,0,0,.2)}
.lk-ms .mslbl{position:absolute;top:50%;left:calc(50% + 11px);transform:translateY(-50%);font-size:10.5px;font-weight:600;white-space:nowrap;pointer-events:none}
.lk-ms.slip{display:block;overflow:visible}
.lk-ms .dia.ghost{background:transparent;border:1.5px dashed #6B7888}
.lk-ms .ms-conn{height:0;border-top:2px dashed var(--muted);transform:translateY(-1px);pointer-events:none}
.lk-ms .ms-head{display:flex;align-items:center;gap:6px;white-space:nowrap}
.lk-ms .ms-head .mslbl2{font-size:10.5px;font-weight:600}
.lk-ms .ms-chip{font-size:8.5px;font-weight:700;padding:1px 6px;border-radius:999px;line-height:1.5;letter-spacing:.2px}
.lk-ms .ms-chip.late{background:rgba(192,57,58,.2);color:#FCA89E}
.lk-ms .ms-chip.fore{background:rgba(224,161,6,.2);color:#F0C552}
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
input[type="date"]::-webkit-calendar-picker-indicator,input[type="datetime-local"]::-webkit-calendar-picker-indicator,input[type="time"]::-webkit-calendar-picker-indicator,input[type="month"]::-webkit-calendar-picker-indicator{filter:invert(var(--cal-invert,0));cursor:pointer;opacity:.8}
input[type="date"]::-webkit-calendar-picker-indicator:hover,input[type="datetime-local"]::-webkit-calendar-picker-indicator:hover{opacity:1}
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
.lk-urow{display:grid;grid-template-columns:34px minmax(140px,1fr) 122px 84px 48px 118px 90px;align-items:center;gap:10px;border:1px solid var(--line);border-radius:9px;padding:8px 11px;background:var(--card);font-size:12.5px}
.lk-uhead{display:grid;grid-template-columns:34px minmax(140px,1fr) 122px 84px 48px 118px 90px;align-items:center;gap:10px;padding:2px 13px 7px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted)}
.lk-uhead .ctr{text-align:center}
.lk-uava{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700;color:#fff;flex:none}
.lk-uname{min-width:0;display:flex;align-items:center;gap:7px}
.lk-uname b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lk-you{font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--accent);border:1px solid var(--accent);border-radius:999px;padding:1px 6px;flex:none}
.lk-mbtn{justify-self:end;background:var(--card);border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:7px 13px;font-size:12px;font-weight:600;cursor:pointer}
.lk-mbtn:hover{background:var(--hover)}
.lk-cohead{display:grid;grid-template-columns:48px minmax(150px,1fr) 64px 92px;align-items:center;gap:12px;padding:2px 14px 7px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted)}
.lk-cohead .ctr{text-align:center}
.lk-corow{display:grid;grid-template-columns:48px minmax(150px,1fr) 64px 92px;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:9px 14px}
.lk-cologo{width:48px;height:36px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none}
.lk-cologo.dk{background:#0d1422;border:1px solid var(--line)}
.lk-cologo.empty{background:var(--chipbg)}
.lk-cologo img{max-width:90%;max-height:80%;object-fit:contain}
.lk-cologo-ph{font-family:var(--display,inherit);font-weight:700;font-size:12px;color:#0b1320}
.lk-cologo.empty .lk-cologo-ph{color:var(--muted)}
.lk-cologo.dk .lk-cologo-ph{color:#dbe6f5}
.lk-cologo.sm{width:34px;height:26px;border-radius:6px}
.lk-coname{min-width:0}
.lk-coname b{font-weight:600;font-size:13.5px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lk-coname s{text-decoration:none;font-size:11.5px;color:var(--muted);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lk-codrop{height:72px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;border:1px solid var(--line);overflow:hidden}
.lk-codrop img{max-width:88%;max-height:78%;object-fit:contain}
.lk-coremove{position:absolute;top:5px;right:5px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1}
.lk-coremove:hover{background:rgba(0,0,0,.7)}
.lk-platbadge{justify-self:start;font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;padding:3px 9px;border-radius:999px;background:var(--chipbg);color:var(--muted);border:1px solid var(--line);white-space:nowrap}
.lk-platbadge[data-super="1"]{background:rgba(124,92,255,.16);color:#9B86FF;border-color:transparent}
.lk-urow button{border:0;background:transparent;color:var(--muted);cursor:pointer;padding:2px}
.lk-uacts{display:flex;align-items:center;gap:5px;justify-content:flex-end}
.lk-mrow{display:grid;grid-template-columns:34px minmax(140px,1fr) minmax(86px,128px) 104px 50px 116px 30px;align-items:center;gap:10px;border:1px solid var(--line);border-radius:9px;padding:8px 11px;background:var(--card);font-size:12.5px;margin-bottom:7px}
.lk-mhead{display:grid;grid-template-columns:34px minmax(140px,1fr) minmax(86px,128px) 104px 50px 116px 30px;align-items:center;gap:10px;padding:2px 13px 7px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted)}
.lk-mhead .ctr{text-align:center}
.lk-mav{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700;color:#fff;flex:none}
.lk-mrow .lk-mname{min-width:0;display:flex;align-items:center;gap:7px;overflow:hidden}
.lk-mrow .lk-mname b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lk-mrow .lk-you{font-size:9.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--accent);border:1px solid var(--accent);border-radius:999px;padding:1px 6px;flex:none}
.lk-cochip{justify-self:start;max-width:100%;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--chipbg);color:var(--muted);border:1px solid var(--line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lk-stat{justify-self:start;font-size:10px;font-weight:700;letter-spacing:.3px;padding:3px 9px;border-radius:999px;white-space:nowrap}
.lk-stat.act{background:rgba(31,182,166,.15);color:#54d6c6}
.lk-stat.pend{background:rgba(230,164,53,.15);color:#e6b766}
.lk-mpc{justify-self:center;font-variant-numeric:tabular-nums;font-weight:700}
.lk-mrow button{background:transparent;border:0;color:var(--muted);cursor:pointer;padding:4px;border-radius:6px;justify-self:end}
.lk-mrow button:hover{background:var(--hover);color:var(--red)}
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
.lk-railppc{text-align:center;cursor:pointer;border-radius:10px;padding:4px 0;transition:background .12s}
.lk-railppc:hover{background:#2a333f}
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
.lk-subnav .grphd{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);padding:0 8px 3px}
.lk-subnav button{text-align:left;border:1px solid transparent;background:transparent;color:var(--ink);border-radius:7px;padding:7px 10px;font-size:12.5px;font-weight:600;cursor:pointer}
.lk-subnav button:hover{background:var(--hover)}
.lk-subnav button.sel{background:var(--ink);color:var(--paper)}
.lk-subbody{flex:1;min-width:0;max-width:760px}
.lk-subbody.wide{max-width:1320px}
.lk-userwrap .lk-ufilter{position:sticky;top:54px;z-index:20;background:var(--card);padding:10px 0 8px;margin-bottom:4px;border-bottom:1px solid var(--line)}
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
.wsch-period{display:flex;align-items:center;gap:8px;padding:11px 18px;border-bottom:1px solid var(--line);font-size:12px;color:var(--muted);flex-shrink:0}
.wsch-period select{appearance:none;background:var(--card);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:6px 10px;font-size:12.5px;font-family:inherit}
.wsch-list{padding:12px 14px;overflow:auto;display:flex;flex-direction:column;gap:10px;flex:1}
.wsch-card{display:grid;grid-template-columns:118px 1fr;gap:13px;border:1px solid var(--line);border-left:3px solid #64748B;border-radius:10px;background:var(--card);padding:11px 13px}
.wsch-when{display:flex;flex-direction:column;gap:3px}
.wsch-day{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.wsch-time{font-size:18px;font-weight:800;line-height:1}
.wsch-durpill{display:inline-block;margin-top:3px;background:var(--chipbg);border:1px solid var(--line);border-radius:999px;padding:2px 8px;font-size:10.5px;color:var(--ink);width:max-content}
.wsch-name{font-weight:700;font-size:13.5px;line-height:1.3;cursor:pointer}
.wsch-name:hover{text-decoration:underline}
.wsch-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px;font-size:11px;color:var(--muted)}
.wsch-conhdr{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#E0A106;font-weight:700;margin-top:9px}
.wsch-con{display:flex;align-items:flex-start;gap:8px;font-size:12px;margin-top:5px;line-height:1.35}
.wsch-con .cdot{width:7px;height:7px;border-radius:50%;background:#E0A106;margin-top:5px;flex:0 0 auto}
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
.lk-online{border:1px solid var(--line);border-radius:14px;background:var(--card);overflow:hidden}
.lk-online-h{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-bottom:1px solid var(--line);font-weight:600;font-size:14px;color:var(--ink)}
.lk-online-now{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:#54d6c6;background:rgba(31,182,166,.13);padding:3px 9px;border-radius:999px;text-transform:none;letter-spacing:0}
.lk-online-now i{width:7px;height:7px;border-radius:50%;background:#2fd6c2;box-shadow:0 0 0 0 rgba(47,214,194,.5);animation:lkpulse 2s infinite}
.lk-online-empty{padding:16px 15px;font-size:12px;color:var(--muted)}
.lk-on-sub{font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);font-weight:700;padding:11px 15px 5px}
.lk-on-body{padding:0 8px 7px}
.lk-on-body.scroll{max-height:430px;overflow:auto}
.lk-on-hr{border:0;border-top:1px solid var(--line);margin:6px 12px 0}
.lk-on-row{display:flex;align-items:center;gap:11px;padding:7px;border-radius:9px}
.lk-on-row:hover{background:var(--hover)}
.lk-on-avwrap{position:relative;flex:none}
.lk-on-av{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:700;color:#fff}
.lk-on-dot{position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;border-radius:50%;border:2.5px solid var(--card)}
.lk-on-dot.on{background:#2fd6c2}
.lk-on-dot.rec{background:#E6A435}
.lk-on-dot.off{background:#5B6675}
.lk-on-nm{min-width:0;display:flex;flex-direction:column}
.lk-on-nm b{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lk-on-nm s{text-decoration:none;font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lk-on-nm s.on{color:#54d6c6;font-weight:600}
.lk-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;display:inline-block}
.lk-dot.off{background:#F59E0B}
.lk-dot.on{background:#10B981;animation:lkpulse 2s infinite}
@keyframes lkpulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,.45)}70%{box-shadow:0 0 0 6px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}
@media (max-width:900px){.lk-userwrap{flex-direction:column}.lk-userside{width:100%;position:static}}
.lk-help iframe{width:100%;height:100%;border:0;display:block;background:#fff}
.lk-helppage{height:calc(100vh - 54px);display:flex;flex-direction:column;overflow:hidden;background:var(--paper)}
.lk-helphero{flex:0 0 auto;margin:14px 18px 4px;border-radius:16px;padding:15px 22px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;background:linear-gradient(135deg,#1E1B4B 0%,#312E81 58%,#4338CA 100%);position:relative;overflow:hidden;box-shadow:0 14px 34px -20px rgba(49,46,129,.7)}
.lk-helphero::after{content:"";position:absolute;inset:0;background:radial-gradient(150px 150px at 92% -30%,rgba(255,255,255,.16),transparent 70%),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 1px,transparent 1px 56px);pointer-events:none}
.lk-helphero .hh{position:relative;z-index:1}
.lk-helphero .eyebrow{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:#C7C9F2;margin-bottom:5px}
.lk-helphero h1{font-size:21px;font-weight:700;margin:0;line-height:1.15}
.lk-helphero h1 b{color:#A5B4FC;font-weight:700}
.lk-helphero .lede{color:#CBD0E6;font-size:12px;margin-top:6px;max-width:64ch}
.lk-helphero .proj{position:relative;z-index:1;display:flex;flex-direction:column;align-items:flex-end;gap:6px;text-align:right}
.lk-helphero .proj img{height:30px;max-width:160px;object-fit:contain}
.lk-helphero .proj .pl{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:12px;color:#C7C9F2}
.lk-helpmain{flex:1;min-height:0;display:flex;gap:22px;padding:10px 18px 0;align-items:stretch}
.lk-helpnav{flex:0 0 200px;display:flex;flex-direction:column;gap:14px;overflow:auto;padding-bottom:16px}
.lk-helpnav .grp{display:flex;flex-direction:column;gap:2px}
.lk-helpnav .grphd{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);padding:0 8px 3px}
.lk-helpnav button{text-align:left;border:1px solid transparent;background:transparent;color:var(--ink);border-radius:7px;padding:7px 10px;font-size:12.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px}
.lk-helpnav button:hover{background:var(--hover)}
.lk-helpnav button.sel{background:var(--ink);color:var(--paper)}
.lk-helpnav .tag{margin-left:auto;font-size:8px;letter-spacing:.04em;font-family:ui-monospace,monospace;color:var(--accent);opacity:.7}
.lk-helpnav button.sel .tag{color:var(--paper);opacity:.6}
.lk-helppane{flex:1;min-width:0;border:1px solid var(--line);border-top-left-radius:14px;border-top-right-radius:14px;overflow:hidden;background:var(--paper)}
.lk-helppane iframe{width:100%;height:100%;border:0;display:block;background:var(--paper)}
@media(max-width:820px){.lk-helpmain{flex-direction:column}.lk-helpnav{flex:none;width:100%;flex-direction:row;flex-wrap:wrap;overflow:visible}.lk-helppane{min-height:60vh}}
.lk-ugroup{margin-top:12px;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.lk-ughead{display:flex;align-items:center;gap:8px;width:100%;font-weight:700;font-size:12.5px;padding:9px 12px;background:var(--card);border:0;color:var(--ink);cursor:pointer;text-align:left;font-family:inherit}
.lk-ughead .cnt{font-weight:500;color:var(--muted);font-size:11px}
.lk-ughead .chev{display:inline-block;transition:transform .12s;color:var(--muted);font-size:10px}
.lk-ufilter{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin-bottom:6px}
.lk-rep h2{font-size:17px;font-weight:700;margin:0 0 2px}
.lk-rep .sub{color:var(--muted);font-size:12px;margin-bottom:16px}
.lk-rep-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin:0 -22px 14px;position:sticky;top:54px;z-index:20;background:var(--card);padding:10px 22px;border-bottom:1px solid var(--line)}
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
.lk-tblwrap{width:100%;height:calc(100vh - 54px);min-height:0;display:flex;flex-direction:column}
.lk-sch{width:100%;display:flex;flex-direction:column;height:calc(100vh - 110px)}
.lk-sch-bar{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--line);background:var(--card);position:sticky;top:54px;z-index:25}
.lk-sch-bar .grp{display:flex;flex-direction:column;gap:4px}
.lk-sch-bar .grp>label{font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700}
.lk-sch-bar .seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--card)}
.lk-sch-bar .seg button{border:0;background:transparent;color:var(--muted);padding:7px 11px;font-size:12px;font-weight:600;cursor:pointer}
.lk-sch-bar .seg button.on{background:var(--ink);color:var(--paper)}
.lk-sch-scroll{flex:1;overflow:auto;background:#fff}
.lk-tblscroll{flex:1;min-height:0;overflow:auto;padding:0 16px 64px}
.lk-grid{border-collapse:collapse;width:100%;font-size:11.5px;min-width:1040px}
.lk-grid th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;padding:8px 7px;border-bottom:1px solid var(--line);white-space:nowrap;position:sticky;top:0;background:var(--paper);z-index:6}
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
.lk-reqbadge{display:inline-block;min-width:16px;height:16px;line-height:16px;padding:0 4px;margin-left:7px;border-radius:9px;background:#E5484D;color:#fff;font-size:10px;font-weight:800;text-align:center;vertical-align:middle}
.lk-req{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:14px 16px;margin-bottom:12px}
.lk-req .rtop{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
.lk-req .who{font-weight:600;font-size:14.5px}
.lk-req .rmeta{font-size:12.5px;color:var(--ink-2);margin-top:3px}
.lk-req .rmeta .org{color:var(--ink);font-weight:600}
.lk-req .rwhen{font-size:11.5px;color:var(--muted);white-space:nowrap}
.lk-req .rnote{font-size:13px;color:var(--ink-2);margin-top:10px;padding:9px 11px;background:var(--paper);border:1px solid var(--line);border-radius:9px}
.lk-req .rnote.empty{color:var(--muted);font-style:italic}
.lk-req .rflag{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--amber);margin-top:9px}
.lk-req .racts{display:flex;gap:10px;margin-top:13px}
.lk-rdecided{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 13px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;font-size:12.5px;background:var(--card)}
.lk-rstat{font-size:10.5px;font-weight:700;letter-spacing:.04em;padding:3px 9px;border-radius:999px;white-space:nowrap}
.lk-rstat.app{background:#E2F2EF;color:#0B6E63;border:1px solid #BFE3DC}
.lk-rstat.rej{background:#FBEBE9;color:#B23B2B;border:1px solid #F1CFC9}
body.dark .lk-rstat.app{background:rgba(47,182,166,.18);color:#7BE3D5;border-color:rgba(47,182,166,.40)}
body.dark .lk-rstat.rej{background:rgba(231,106,92,.22);color:#F6ADA3;border-color:rgba(231,106,92,.48)}
.lk-match{font-size:12px;border-radius:8px;padding:9px 11px;margin:2px 0 0;display:flex;align-items:center;gap:8px;line-height:1.35}
.lk-match.exact{background:#E2F2EF;color:#0B6E63}
.lk-match.fuzzy{background:#FBEFD6;color:#8A5A00}
body.dark .lk-match.exact{background:rgba(47,182,166,.16);color:#7BE3D5}
body.dark .lk-match.fuzzy{background:rgba(224,163,58,.18);color:#EAC178}
.lk-match.none{background:var(--card);color:var(--muted);border:1px solid var(--line)}
.lk-remember{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--ink-2);margin-top:10px;cursor:pointer}
.lk-remember input{width:16px;height:16px;accent-color:var(--accent);flex:none}
.lk-locked{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);background:var(--card);border-radius:8px;padding:9px 11px}
.lk-locked .lkv{font-weight:600;font-size:13px}.lk-locked .lkn{font-size:11px;color:var(--muted)}
/* ---- project switcher ---- */
.lk-switch{position:relative;margin-left:4px}
.lk-switch-back{position:fixed;inset:0;z-index:40}
.lk-switchbtn{display:flex;align-items:center;gap:7px;background:var(--chipbg);border:1px solid var(--line);border-radius:9px;padding:6px 10px;font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer}
.lk-switchdot{width:8px;height:8px;border-radius:50%;flex:none}
.lk-switchmenu{position:absolute;top:40px;left:0;z-index:41;width:270px;background:var(--card);border:1px solid var(--line);border-radius:11px;box-shadow:0 16px 44px rgba(8,14,22,.32);padding:6px}
.lk-switchitem{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:transparent;border:0;border-radius:7px;padding:9px 10px;font-size:12.5px;font-weight:600;color:var(--ink);cursor:pointer}
.lk-switchitem:hover{background:var(--hover)}
.lk-switchitem.on{background:var(--chipbg)}
.lk-switchitem.all{color:var(--accent)}
.lk-switchsub{font-weight:400;color:var(--muted);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lk-switchsep{height:1px;background:var(--line);margin:5px 4px}
/* ---- project portal ---- */
.lk-portal{min-height:100vh;background:var(--paper);color:var(--ink)}
.lk-pbar{display:flex;align-items:center;gap:12px;height:58px;padding:0 24px;background:var(--card);border-bottom:1px solid var(--line)}
.lk-pbrand{display:flex;align-items:center;gap:9px;font-size:17px;font-weight:800;letter-spacing:-.01em}
.lk-pglyph{width:26px;height:26px;border-radius:7px;background:var(--accent);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700}
.lk-psub{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:700}
.lk-pwrap{max-width:1180px;margin:0 auto;padding:30px 24px 60px}
.lk-phello{font-size:24px;font-weight:700;letter-spacing:-.02em}
.lk-psubhello{color:var(--muted);font-size:13px;margin-top:4px}
.lk-ptiles{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:22px 0 8px}
.lk-ptile{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:15px 17px}
.lk-ptile .k{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:700}
.lk-ptile .v{font-size:28px;font-weight:700;letter-spacing:-.02em;margin-top:6px;line-height:1}
.lk-pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:18px}
.lk-pcard{background:var(--card);border:1px solid var(--line);border-radius:15px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:transform .15s,box-shadow .15s,border-color .15s}
.lk-pcard:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(8,14,22,.18);border-color:var(--accent)}
.lk-pcardhead{height:6px}
.lk-pcardbody{padding:15px 16px;display:flex;flex-direction:column;gap:10px;flex:1}
.lk-pcode{font-size:10.5px;font-weight:800;letter-spacing:.1em;color:var(--muted)}
.lk-pname{font-size:16px;font-weight:700;letter-spacing:-.01em;line-height:1.2;margin-top:2px}
.lk-ploc{font-size:12px;color:var(--muted)}
.lk-pmid{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px}
.lk-pring{position:relative;width:48px;height:48px;flex:none}
.lk-pringlbl{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700}
.lk-pringlbl small{font-size:8px;color:var(--muted);margin-left:1px}
.lk-pkv{display:flex;gap:16px;flex:1;justify-content:center}
.lk-pkv div{font-size:10.5px;color:var(--muted);text-align:center}
.lk-pkv b{display:block;font-size:16px;font-weight:700;color:var(--ink)}
.lk-pkv b.warn{color:#D9534F}
.lk-prole{font-size:10px;font-weight:700;letter-spacing:.03em;padding:3px 9px;border-radius:999px;background:var(--chipbg);border:1px solid var(--line);color:var(--muted)}
.lk-prole.admin{background:var(--chipbg);color:var(--accent);border-color:transparent}
.lk-pcardfoot{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-top:1px solid var(--line);font-size:11.5px;color:var(--muted)}
.lk-penter{font-weight:700;color:var(--accent)}
.lk-pempty{grid-column:1/-1;text-align:center;color:var(--muted);padding:40px;border:1px dashed var(--line);border-radius:14px}
@media(max-width:880px){.lk-ptiles{grid-template-columns:1fr 1fr}.lk-pgrid{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.lk-pgrid,.lk-ptiles{grid-template-columns:1fr}}
.lk-psection{font-size:14px;font-weight:700;margin:28px 0 13px}
.lk-pnewcard{border:1.5px dashed var(--line);background:transparent;border-radius:15px;display:flex;align-items:center;justify-content:center;gap:8px;min-height:190px;cursor:pointer;color:var(--muted);font-weight:600;font-size:13px}
.lk-pnewcard:hover{border-color:var(--accent);color:var(--accent)}
.lk-feed{background:var(--card);border:1px solid var(--line);border-radius:13px;overflow:hidden}
.lk-frow{display:flex;align-items:center;gap:12px;padding:11px 15px;border-bottom:1px solid var(--line)}
.lk-frow:last-child{border-bottom:0}
.lk-fav{width:28px;height:28px;border-radius:50%;background:var(--chipbg);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--ink);flex:none;text-transform:uppercase}
.lk-ft{font-size:12.5px;flex:1;color:var(--ink)}
.lk-fdet{color:var(--ink);font-weight:600}
.lk-fw{font-size:11px;color:var(--muted);white-space:nowrap}
.lk-pmodback{position:fixed;inset:0;z-index:60;background:rgba(8,12,18,.55);display:flex;align-items:flex-start;justify-content:center;padding:8vh 16px}
.lk-pmod{width:480px;max-width:100%;background:var(--card);border:1px solid var(--line);border-radius:15px;padding:22px 22px 18px;box-shadow:0 24px 60px rgba(0,0,0,.4)}
.lk-pmodh{font-size:18px;font-weight:700}
.lk-pmodsub{font-size:12.5px;color:var(--muted);margin:4px 0 16px}
.lk-pml{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700;margin:12px 0 5px}
.lk-pmi{width:100%;background:var(--paper);border:1px solid var(--line);border-radius:9px;padding:9px 11px;font-family:inherit;font-size:13.5px;color:var(--ink)}
.lk-pmrow{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lk-pmsw{display:flex;gap:8px}
.lk-pmswatch{width:28px;height:28px;border-radius:8px;cursor:pointer;border:2px solid transparent}
.lk-pmswatch.on{border-color:var(--ink)}
.lk-pmerr{color:#D9534F;font-size:12px;margin-top:12px}
.lk-pmact{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}
.lk-pmod .lk-btn.primary{background:var(--accent);color:#fff;border-color:transparent}
.lk-portal .lk-btn.primary{background:var(--accent);color:#fff;border-color:transparent;font-weight:700}
.lk-pglyph-img{height:26px;width:auto;display:block}
.lk-pnav{display:flex;gap:2px;margin-left:14px;background:var(--chipbg);border:1px solid var(--line);border-radius:9px;padding:3px}
.lk-pnav button{background:transparent;border:0;border-radius:6px;padding:6px 13px;font-size:12.5px;font-weight:600;color:var(--muted);cursor:pointer}
.lk-pnav button.on{background:var(--card);color:var(--ink)}
.lk-ftag{font-size:10px;font-weight:800;letter-spacing:.04em;padding:3px 8px;border-radius:6px;background:var(--chipbg);color:var(--muted)}
.lk-psearch{display:flex;gap:10px;margin:18px 0 14px}
.lk-psearch input{flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 13px;font-family:inherit;font-size:13px;color:var(--ink)}
.lk-ptable{background:var(--card);border:1px solid var(--line);border-radius:13px;overflow:hidden}
.lk-pth,.lk-ptr{display:grid;grid-template-columns:2.4fr 1.3fr .9fr 1.1fr .7fr 1.5fr auto;gap:12px;align-items:center;padding:13px 18px}
.lk-pth{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700;background:var(--chipbg)}
.lk-ptr{border-top:1px solid var(--line);cursor:pointer}
.lk-ptr:hover{background:var(--hover)}
.lk-ptn{font-weight:600;font-size:13.5px}
.lk-ptc{font-size:11px;color:var(--muted)}
.lk-ptmut{font-size:12px;color:var(--muted)}
.lk-ptover{font-weight:700;font-size:15px;text-align:center}
.lk-ptbar{height:6px;border-radius:4px;background:var(--line);overflow:hidden}
.lk-ptbar i{display:block;height:100%;border-radius:4px}
@media(max-width:820px){.lk-pnav{display:none}}
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
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>,
  person: <><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></>,
  office: <><rect x="4" y="3" width="16" height="18" rx="1.5"/><line x1="9" y1="7" x2="9.01" y2="7"/><line x1="15" y1="7" x2="15.01" y2="7"/><line x1="9" y1="11" x2="9.01" y2="11"/><line x1="15" y1="11" x2="15.01" y2="11"/><line x1="9" y1="15" x2="9.01" y2="15"/><line x1="15" y1="15" x2="15.01" y2="15"/></>,
  play: <polygon points="6 4 20 12 6 20"/>,
  wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>,
  checkcircle: <><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></>,
  loader: <><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 4 21 9 16 9"/></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
};
const Icon = ({ n, s = 16 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{I[n]}</svg>;

const todayMid = () => new Date().setHours(0, 0, 0, 0);
const parseD = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtISO = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const addDays = (dt, n) => { const x = new Date(dt); x.setDate(x.getDate() + n); return x; };
const pctOf = (a) => (a && a.percent != null) ? Math.max(0, Math.min(100, Math.round(a.percent))) : ((a && a.status === "complete") ? 100 : 0);
const statusWord = (a) => a.status === "complete" ? "Complete" : a.status === "in_progress" ? "In progress" : "Planned";
const tipOf = (a) => `${a.desc || (a.isMilestone ? "Milestone" : "Untitled activity")} \u00B7 ${statusWord(a)} \u00B7 ${pctOf(a)}% complete`;
const mondayOf = (dt) => { const x = new Date(dt); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x; };
const isoWeek = (dt) => { const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const ft = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); const fd = (ft.getUTCDay() + 6) % 7; ft.setUTCDate(ft.getUTCDate() - fd + 3); return 1 + Math.round((t - ft) / 6048e5); };
const openCount = (a) => a.constraints.filter((c) => !c.done).length;
const uid = (p) => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
const nextCode = (acts) => (acts || []).reduce((m, a) => Math.max(m, a.code || 0), 0) + 1;
const SLIP_REASONS = ["Prerequisite work incomplete", "Materials / equipment", "Labour / resources", "Design / information / RFI", "Access / permit / approval", "Weather / environment", "Rework / quality / defect", "Changed priorities", "Safety", "Other"];
const CHANGELOG = [
  { rev: "REV68", date: "2026-06-29", items: ["Witness invite wording tidied: the subject and the opening line no longer wrap the activity name in quotes, the opening line reads as a normal sentence rather than capitals, each detail (Discipline, Cx Stage, Performing, Location, Planned start) sits on its own line, and the 'please forward' line now sits at the very bottom of the message"] },
  { rev: "REV67", date: "2026-06-29", items: ["New Witness Schedule button on the board (beside Make-ready and YTT): opens a popup listing the activities marked for witness in the selected period (this week, next 2 or 4 weeks, or all upcoming), each showing the date and time, the duration, the activity name and any open constraints", "Make-ready, YTT and Witness Schedule are now rounded pill buttons on the blue accent scheme, filling solid blue while their panel is open", "Dark mode: the calendar icon in the Witness date & time field (and any datetime field) is now light so it shows against the dark background", "The New / Edit Activity footer now warns in orange and lists exactly which required fields are still missing, rather than a quiet grey count", "When Witness invite is on and a discipline is chosen, the editor now lists the resolved invite recipients (Required and CC) so you can see who will be invited before saving"] },
  { rev: "REV66", date: "2026-06-29", items: ["New Discipline field on the activity Details tab (Mechanical, Electrical, BMS/EPMS, FLS; multi-select), required when Witness invite is on; it drives who the witness invite goes to", "New Witness duration field on Readiness; the witness invite end time is now start plus this duration rather than a fixed hour", "The witness export now carries the resolved Required and CC attendees, a discipline column and a Sent column, with the subject FIN04 - INVITE FOR \"activity\"", "Witness invites can be bulk-sent from classic Outlook with the supplied macro; a new admin Mark sent control stamps which invites have gone out so they are not sent twice"] },
  { rev: "REV64", date: "2026-06-22", items: ["Planning Board: the blue current-day line no longer touches the coloured left border of activity cards. It now sits a few pixels clear of the column edge so there is a clean gap between the today line and the card edge"] },
  { rev: "REV63", date: "2026-06-22", items: ["The Assigned To You popup now uses the YTT card format: constraints are grouped under their activity, and each has a tick box so you can acknowledge (clear) it directly in the popup. Acknowledging removes it from your list and drops the badge count. You can clear a constraint assigned to you or your company even if the activity belongs to another company; admins can clear any"] },
  { rev: "REV62", date: "2026-06-22", items: ["Dark mode: the calendar icon inside date fields was a dark glyph on a dark field and almost invisible. It is now inverted to a light icon in dark mode (and left as-is in light mode), driven by the theme so it follows the light/dark toggle"] },
  { rev: "REV61", date: "2026-06-22", items: ["Date fields (planned start, actual start and finish, constraint need-by, report range) now open the calendar picker as soon as you click anywhere on the field, not only on the small calendar icon"] },
  { rev: "REV60", date: "2026-06-22", items: ["Fix: the REV59 build caused a white screen on load. The notification calculations were written as React hooks placed after the app's loading guard, which violates the rules of hooks and crashed the app once data loaded. Rewritten as plain calculations; no behaviour change to the notifications feature"] },
  { rev: "REV59", date: "2026-06-22", items: ["Constraints can now be assigned to a person or a company: in the responsible field of a constraint (activity drawer and Constraints Log), type @ to pick from a list of project members and companies", "New envelope icon in the top bar, between the theme toggle and your name, with a red count badge showing how many open constraints are assigned to you or your company. Click it for a popup list; click any item to open the activity", "Admins receive notifications for constraints assigned to them personally and to the CSN company"] },
  { rev: "REV58", date: "2026-06-22", items: ["Planning Board: the actual-progress bar no longer overshoots the left edge of an activity card or cut across its coloured side border. When work started on plan, the bar now begins neatly under the readiness dot inside the card; bars whose actual start is a later day keep their exact position on the day grid"] },
  { rev: "REV57", date: "2026-06-22", items: ["Activity duration is calendar days, weekends included. The New / Edit Activity field is now labelled Days (Calendar) and shows the resulting finish date so it is clear weekends are counted (they were never skipped; this makes it explicit)", "The PPC figure at the foot of the left sidebar is now clickable and opens the Analytics page"] },
  { rev: "REV56", date: "2026-06-21", items: ["Planning Board KPI tiles (In Lookahead, Ready To Run, Need Make-Ready, Committed This Week, Delayed, At Risk) are now clickable and open the same activity-list popup as the Analytics cards. Click any activity in the list to open it", "Companies now have a short description (role & scope), editable inline in Admin > Companies. On the Planning Board grouped by Company, click a company's logo to see a popup card with that role & scope", "Quick Reference Guide refreshed: filtering no longer references Building on single-building projects (the Table's Building filter now hides unless there is more than one building), the YTT focus is explained, and a new 'The app at a glance' section gives a short purpose for each part of the app for users", "Activity Table: the Building filter only shows on projects with more than one building"] },
  { rev: "REV55", date: "2026-06-21", items: ["Weekly DLP Report: new Light / Dark choice in the report window. Light is unchanged; Dark renders the whole report on a dark sheet. To keep the dark background when saving to PDF, tick 'Background graphics' in the browser print dialog"] },
  { rev: "REV54", date: "2026-06-21", items: ["Planning Board (Day view): you can now drag the left or right edge of an activity to change its start or finish. Hover near an edge and the cursor becomes a resize arrow; drag in whole-day steps, minimum one day. Available to admins (and to members on their own activities that are not yet committed)"] },
  { rev: "REV53", date: "2026-06-21", items: ["Admin > Companies: company names are now editable inline, like buildings, levels, zones and systems. Type a new name and press Enter or click away; it updates everywhere the company is shown. Activities stay linked because they reference the company, not its name"] },
  { rev: "REV52", date: "2026-06-21", items: ["Changed atNorth to atnorth (lowercase) on the Help page and in the Weekly Report, to match the logo"] },
  { rev: "REV51", date: "2026-06-21", items: ["Restored the Project and App name (from Admin settings) to the top bar on every page, set just after the customer logo with a divider: project name in bold and app name as a small accent tag. The per-page title stays gone"] },
  { rev: "REV50", date: "2026-06-21", items: ["Constraints Log: Search now comes first, then the filters, matching the Activity Table", "Removed the descriptive sub-text lines from the Analytics and Constraints pages", "Title Case sweep: multi-word labels, titles and options in the popups (New/Edit Activity, Admin, Import, Weekly Report) are now capitalised consistently"] },
  { rev: "REV49", date: "2026-06-21", items: ["Consistent chrome across pages: one slim top bar everywhere holding the logo, your name, role or company logo and Sign out, with the page title removed (the sidebar shows where you are)", "Every page's filters now share one look: the board controls moved into a toolbar, and the Schedule, Analytics, Table and Users filter bars use the same card background, bottom border, labels and segmented-control style", "Constraints Log now uses a warning-triangle icon in the sidebar"] },
  { rev: "REV48", date: "2026-06-21", items: ["Delete confirmation now applies across Admin too. Deleting a company, building, level, zone, system, Cx stage or user asks 'Are you sure?' with Yes and No first. Cx stage still tells you how many activities will be moved"] },
  { rev: "REV47", date: "2026-06-21", items: ["New / Edit Activity: clicking the dimmed area outside the window no longer discards what you typed. The window stays put until you Save, Cancel, or close it with the X", "Deleting an activity now asks 'Delete this activity?' with Yes and No before removing it"] },
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

function portalVars(theme) {
  const D = { "--ink": "#E8EDF3", "--ink-2": "#B4C0CD", "--muted": "#8593A2", "--paper": "#161D26", "--backdrop": "#0C1116", "--card": "#141B24", "--line": "#27313D", "--line-2": "#1E2732", "--signal": "#5B9BF5", "--green": "#2FB6A6", "--amber": "#E0A33A", "--red": "#E76A5C", "--chip": "#1B232E", "--ring-track": "#26303B" };
  const L = { "--ink": "#0F1E2E", "--ink-2": "#33485C", "--muted": "#647689", "--paper": "#FFFFFF", "--backdrop": "#EEF1F5", "--card": "#FFFFFF", "--line": "#E2E7EE", "--line-2": "#EEF2F6", "--signal": "#1E63D6", "--green": "#0E9384", "--amber": "#C07A00", "--red": "#C0392B", "--chip": "#F2F5F9", "--ring-track": "#E6EBF1" };
  return { ...(theme === "dark" ? D : L), "--display": '"Space Grotesk","Inter",system-ui,sans-serif', "--body": '"Inter",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif' };
}
const PORTAL_CSS = `
.qp{min-height:100vh;background:var(--backdrop);color:var(--ink);font-family:var(--body);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}
.qp h2{font-family:var(--display);margin:0}
.qp .mono{font-variant-numeric:tabular-nums}
.qp .top{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:16px;height:74px;padding:0 22px;background:var(--paper);border-bottom:1px solid var(--line)}
.qp .brandmark{display:flex;align-items:center;gap:9px;font-weight:800;font-size:17px;letter-spacing:-.01em;font-family:var(--display)}
.qp .brandmark .glyphimg{height:52px;width:auto;display:block}
.qp .pvbar{display:flex;align-items:center;gap:14px;padding:10px 22px;background:var(--backdrop);border-bottom:1px solid var(--line)}
.qp .pvt{display:flex;gap:4px;background:var(--chip);border:1px solid var(--line);padding:3px;border-radius:10px}
.qp .pvt button{font-family:var(--body);font-size:13px;font-weight:600;border:0;background:transparent;color:var(--muted);padding:8px 15px;border-radius:7px;cursor:pointer}
.qp .pvt button:hover{color:var(--ink)}
.qp .pvt button.on{background:var(--paper);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.qp .ip-top{display:flex;align-items:center;gap:14px;color:#fff;border-radius:14px;padding:20px 24px;margin-bottom:16px}
.qp .ip-top .lg{width:54px;height:54px;border-radius:12px;background:#ffffff22;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;letter-spacing:.5px;flex:none}
.qp .ip-top h2{font-family:var(--display);font-size:23px;font-weight:600;line-height:1.1}
.qp .ip-top .m{font-size:13.5px;opacity:.9;margin-top:5px}
.qp .ip-top .ipleave{color:#fff;border-color:#ffffff55;background:#ffffff1a}
.qp .ip-top .ipleave:hover{background:#ffffff2e}
.qp .ip-top .ipboard{margin-left:auto;background:#ffffff;color:#10243f;border:0;font-weight:700}
.qp .ip-top .ipboard:hover{background:#eef2f7}
.qp .ip-board{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.qp .ip-toolbar{display:flex;gap:8px;padding:14px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.qp .seg{display:flex;background:var(--chip);border:1px solid var(--line);border-radius:9px;padding:3px}
.qp .seg span{font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:6px;color:var(--muted);cursor:pointer;user-select:none}
.qp .seg span.on{background:var(--paper);color:var(--ink)}
.qp .ip-empty{padding:36px 22px;text-align:center;font-size:13px;color:var(--muted)}
.qp .seg.dim{opacity:.4;pointer-events:none}
.qp .ip-axis{display:flex;align-items:center;height:24px;border-bottom:1px solid var(--line);padding:0 16px}
.qp .ip-axis .axsp{width:164px;flex:none}
.qp .ip-axis .axtrack{position:relative;flex:1;height:24px}
.qp .ip-axis .axtrack span{position:absolute;top:6px;transform:translateX(-50%);font-size:10.5px;font-weight:600;letter-spacing:.3px;color:var(--muted);white-space:nowrap}
.qp .lane{display:flex;align-items:flex-start;gap:14px;padding:9px 16px;border-bottom:1px solid var(--line)}
.qp .lane:last-child{border-bottom:0}
.qp .lh{width:150px;flex:none;padding-top:2px}
.qp .lh b{font-size:13px;font-weight:600;color:var(--ink);display:block;line-height:1.2}
.qp .lh .s{font-size:11px;color:var(--muted);margin-top:2px}
.qp .tracks{flex:1;display:flex;flex-direction:column;gap:4px;min-width:0}
.qp .track{position:relative;height:24px;background:var(--chip);border-radius:6px;overflow:hidden}
.qp .track .gl{position:absolute;top:0;bottom:0;width:1px;background:var(--line);opacity:.55;pointer-events:none}
.qp .track .gl.today{background:var(--accent);opacity:.85;width:2px}
.qp .ipnav{display:flex;align-items:center;gap:6px;margin-left:auto}
.qp .ipnav button{background:var(--chip);border:1px solid var(--line);color:var(--ink);border-radius:8px;padding:7px 10px;font-size:13px;font-weight:600;cursor:pointer;min-width:32px;line-height:1}
.qp .ipnav button:hover:not(:disabled){background:var(--paper)}
.qp .ipnav button:disabled{opacity:.4;cursor:default}
.qp .ipnav .iprange{font-size:12px;font-weight:600;color:var(--muted);min-width:120px;text-align:center;white-space:nowrap}
.qp .ipnav .todaybtn{padding:7px 12px;min-width:auto}
.qp .blk{position:absolute;top:3px;height:18px;border-radius:5px;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box;max-width:100%;cursor:pointer}
.qp .blk:hover{box-shadow:0 0 0 2px var(--accent) inset}
.qp .ms{position:absolute;top:3px;display:flex;align-items:center;gap:6px;max-width:70%;cursor:pointer}
.qp .ms .dia{width:12px;height:12px;transform:rotate(45deg);border-radius:2px;flex:none}
.qp .ms .mslabel{font-size:11px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qp .gantt{max-height:430px;overflow-y:auto;padding:4px 0}
.qp .grow{display:flex;align-items:center;gap:14px;padding:4px 16px;cursor:pointer}
.qp .grow:hover{background:var(--chip)}
.qp .grow .glh{width:150px;flex:none;font-size:12px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qp .grow .track{flex:1}
.qp .ip-foot{font-size:12px;color:var(--muted);margin-top:14px;text-align:center;line-height:1.5}
.qp .ovsel-back{position:fixed;inset:0;background:rgba(8,12,20,.5);display:flex;align-items:center;justify-content:center;z-index:60;padding:20px}
.qp .ovsel{width:340px;max-width:100%;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.35);overflow:hidden}
.qp .ovsel-h{display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line)}
.qp .ovsel-h b{flex:1;font-size:14px;font-weight:700;color:var(--ink);line-height:1.3}
.qp .ovsel-h button{border:0;background:transparent;color:var(--muted);font-size:20px;line-height:1;cursor:pointer;padding:0 2px}
.qp .ovsel-b{padding:4px 16px}
.qp .ovsel-b .r{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px solid var(--line);font-size:12.5px}
.qp .ovsel-b .r:last-child{border-bottom:0}
.qp .ovsel-b .r span{color:var(--muted)}
.qp .ovsel-b .r b{color:var(--ink);font-weight:600;display:flex;align-items:center;gap:7px}
.qp .ovsel-b .dot{width:9px;height:9px;border-radius:50%;display:inline-block}
.qp .ovsel-f{padding:12px 16px;border-top:1px solid var(--line);display:flex;justify-content:flex-end}
.qp .tile{cursor:pointer;transition:border-color .12s,transform .12s}
.qp .tile:hover{border-color:var(--accent);transform:translateY(-1px)}
.qp .ovsel.wide{width:460px}
.qp .ovsel-sub{font-size:12px;color:var(--muted);margin-top:3px;font-weight:500}
.qp .drillb{max-height:60vh;overflow-y:auto;padding:10px 12px}
.qp .drow{display:flex;align-items:center;gap:12px;justify-content:space-between;border:1px solid var(--line);border-radius:9px;background:var(--paper);padding:9px 11px;margin-bottom:7px;cursor:pointer}
.qp .drow:last-child{margin-bottom:0}
.qp .drow:hover{background:var(--chip)}
.qp .drow-m{min-width:0;display:flex;flex-direction:column;gap:2px;flex:1}
.qp .drow-m b{font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qp .drow-m span{font-size:11px;color:var(--muted)}
.qp .drow-bar{height:5px;border-radius:3px;background:var(--chip);overflow:hidden;margin-top:5px;width:140px}
.qp .drow-bar i{display:block;height:100%;background:#1FB6A6;border-radius:3px}
.qp .drow-chip{flex:none;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;border:1px solid;background:transparent;white-space:nowrap}
.qp .qp-foot{text-align:center;font-size:11.5px;color:var(--muted);padding:26px 22px 34px;border-top:1px solid var(--line);margin-top:34px}
.qp .brandmark .sub{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-left:2px}
.qp .switcher{position:relative;margin-left:6px}
.qp .switcher>button{display:flex;align-items:center;gap:9px;background:var(--chip);border:1px solid var(--line);border-radius:10px;padding:7px 12px;font-family:var(--body);font-size:13px;font-weight:600;color:var(--ink);cursor:pointer}
.qp .switcher .dot{width:8px;height:8px;border-radius:50%;background:var(--signal)}
.qp .swback{position:fixed;inset:0;z-index:39}
.qp .swmenu{position:absolute;top:46px;left:0;width:280px;background:var(--paper);border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 50px rgba(8,14,22,.28);padding:6px;z-index:40}
.qp .swmenu .it{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;font-size:13px}
.qp .swmenu .it:hover{background:var(--chip)}
.qp .swmenu .it .ac{width:9px;height:9px;border-radius:50%;flex:none}
.qp .swmenu .it .mt{font-size:11px;color:var(--muted)}
.qp .swmenu .sep{height:1px;background:var(--line);margin:6px 4px}
.qp .swmenu .all{font-weight:600;color:var(--signal)}
.qp .spacer{flex:1}
.qp .tbtn{width:36px;height:36px;border-radius:9px;border:1px solid var(--line);background:var(--paper);color:var(--ink-2);display:flex;align-items:center;justify-content:center;cursor:pointer}
.qp .user{display:flex;align-items:center;gap:10px}
.qp .user .av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3E5C82,#6A8CB8);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px}
.qp .user .nm{font-size:13px;font-weight:600;line-height:1.1}
.qp .user .rl{font-size:10px;color:var(--muted)}
.qp .pill-plat{font-size:9.5px;font-weight:800;letter-spacing:.06em;background:#7C4DFF1f;color:#9B7BFF;border-radius:999px;padding:3px 8px;text-transform:uppercase}
.qp .wrap{max-width:1240px;margin:0 auto;padding:26px 22px 60px}
.qp .scene{display:none}.qp .scene.on{display:block}
.qp .hello{font-size:24px;font-weight:700;letter-spacing:-.02em;font-family:var(--display)}
.qp .subhello{color:var(--muted);font-size:13px;margin-top:3px}
.qp .sech{display:flex;align-items:center;justify-content:space-between;margin:26px 0 13px}
.qp .sech h2{font-size:15px;font-weight:600}
.qp .sech .lk{font-size:12.5px;color:var(--signal);font-weight:600;cursor:pointer}
.qp .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.qp .tile{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 17px}
.qp .tile .k{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:700}
.qp .tile .v{font-family:var(--display);font-size:30px;font-weight:700;letter-spacing:-.02em;margin-top:7px;line-height:1}
.qp .tile .d{font-size:11.5px;color:var(--muted);margin-top:6px}
.qp .pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.qp .pcard{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;cursor:pointer;transition:.16s;display:flex;flex-direction:column}
.qp .pcard:hover{transform:translateY(-2px);box-shadow:0 14px 36px rgba(8,14,22,.16);border-color:var(--signal)}
.qp .pcard .head{height:7px}
.qp .pcard .body{padding:16px 17px;display:flex;flex-direction:column;gap:11px;flex:1}
.qp .pcard .code{font-size:10.5px;font-weight:800;letter-spacing:.1em;color:var(--muted)}
.qp .pcard .nm{font-size:16px;font-weight:700;letter-spacing:-.01em;line-height:1.2}
.qp .pcard .loc{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:5px}
.qp .pcard .midrow{display:flex;align-items:center;justify-content:space-between;margin-top:2px}
.qp .ring{position:relative;width:52px;height:52px}
.qp .ring svg{transform:rotate(-90deg)}
.qp .ring .lbl{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;font-weight:700}
.qp .ring .lbl small{font-size:8px;color:var(--muted);font-weight:600;letter-spacing:.05em}
.qp .kv{display:flex;gap:18px}
.qp .kv .c{font-size:11px;color:var(--muted)}
.qp .kv .c b{display:block;font-size:16px;color:var(--ink);font-weight:700;font-family:var(--display)}
.qp .kv .c b.warn{color:var(--red)}
.qp .rolechip{font-size:10px;font-weight:700;letter-spacing:.04em;padding:3px 9px;border-radius:999px;background:var(--chip);border:1px solid var(--line)}
.qp .rolechip.admin{background:#1E63D618;color:var(--signal);border-color:transparent}
.qp .pcard .foot{display:flex;align-items:center;justify-content:space-between;padding:11px 17px;border-top:1px solid var(--line);font-size:11.5px;color:var(--muted)}
.qp .enter{font-size:12.5px;font-weight:700;color:var(--signal);display:flex;align-items:center;gap:5px}
.qp .newcard{border:1.5px dashed var(--line);background:transparent;display:flex;align-items:center;justify-content:center;min-height:200px;cursor:pointer;border-radius:16px;color:var(--muted);font-weight:600;font-size:13px;gap:8px}
.qp .newcard:hover{border-color:var(--signal);color:var(--signal)}
.qp .feed{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px 4px}
.qp .frow{display:grid;grid-template-columns:28px minmax(0,1fr) 70px 78px 50px;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid var(--line-2)}
.qp .frow:last-child{border-bottom:0}
.qp .frow .fav{width:28px;height:28px;border-radius:50%;background:var(--chip);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--ink-2);flex:none;text-transform:uppercase}
.qp .frow .ft{font-size:12.5px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qp .frow .ft b{font-weight:600}
.qp .frow .ptag{justify-self:start;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px;background:var(--chip);color:var(--ink-2);white-space:nowrap}
.qp .frow .fw{justify-self:start;font-size:11px;color:var(--muted);white-space:nowrap}
.qp .frow .fview{justify-self:end;font-size:11.5px;font-weight:600;color:var(--accent);background:transparent;border:0;padding:4px 6px;border-radius:6px;cursor:pointer;min-height:22px}
.qp .frow button.fview:hover{background:var(--chip)}
.qp .ptable{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.qp .ptable .hd,.qp .ptable .row{display:grid;grid-template-columns:2.4fr 1.3fr 1fr 1.1fr 0.8fr 1.2fr auto;gap:12px;align-items:center;padding:13px 18px}
.qp .ptable .hd{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:700;background:var(--chip)}
.qp .ptable .row{border-top:1px solid var(--line);cursor:pointer}
.qp .ptable .row:hover{background:var(--chip)}
.qp .ptable .pn{font-weight:600;font-size:13.5px}.qp .ptable .pc{font-size:11px;color:var(--muted)}
.qp .ptable .bar{height:6px;border-radius:4px;background:var(--ring-track);overflow:hidden}
.qp .ptable .bar i{display:block;height:100%;border-radius:4px}
.qp .searchbar{display:flex;gap:10px;margin-bottom:14px;margin-top:18px}
.qp .searchbar input{flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 13px;font-family:inherit;font-size:13px;color:var(--ink)}
.qp .form{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:24px;max-width:760px;margin-top:18px}
.qp .frow2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.qp .f{margin-bottom:16px}
.qp .f label{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700;display:block;margin-bottom:6px}
.qp .f input,.qp .f select{width:100%;background:var(--paper);border:1px solid var(--line);border-radius:9px;padding:10px 12px;font-family:inherit;font-size:13.5px;color:var(--ink)}
.qp .f .hint{font-size:11px;color:var(--muted);margin-top:5px}
.qp .swatches{display:flex;gap:8px}
.qp .swatch{width:30px;height:30px;border-radius:8px;cursor:pointer;border:2px solid transparent}
.qp .swatch.sel{border-color:var(--ink)}
.qp .adminrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.qp .adminchip{font-size:12px;background:var(--chip);border:1px solid var(--line);border-radius:999px;padding:5px 11px;display:flex;align-items:center;gap:6px}
.qp .btn{font-family:var(--body);font-size:13.5px;font-weight:700;border-radius:10px;padding:11px 20px;cursor:pointer;border:1px solid transparent;background:var(--signal);color:#fff}
.qp .btn.ghost{background:var(--paper);color:var(--ink-2);border-color:var(--line)}
.qp .btn.sm{padding:8px 14px;font-size:12.5px}
.qp .err{color:var(--red);font-size:12.5px;margin:10px 0}
.qp .empty{color:var(--muted);text-align:center;padding:30px}
@media (max-width:900px){.qp .tiles{grid-template-columns:repeat(2,1fr)}.qp .pgrid{grid-template-columns:1fr 1fr}.qp .frow2{grid-template-columns:1fr}}
`;
function Portal({ projects, isSuper, userName, activity, theme: theme0, onEnter, onNew, onSignOut, onLoadOverview }) {
  const [theme, setTheme] = useState(theme0 || "light");
  const [scene, setScene] = useState("home");
  const [swOpen, setSwOpen] = useState(false);
  const [q, setQ] = useState("");
  const [nf, setNf] = useState({ name: "", code: "", client: "", location: "", startDate: "", targetDate: "", accent: "#1E63D6", copyFrom: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ov, setOv] = useState(null);
  const [ovGroup, setOvGroup] = useState("company");
  const [ovView, setOvView] = useState("swimlane");
  const [ovGran, setOvGran] = useState("day");
  const [ovWeeks, setOvWeeks] = useState(4);   // visible span in weeks; 0 = all dates
  const [ovAnchor, setOvAnchor] = useState(null);   // window start (ms, Monday); null = auto
  const [ovSel, setOvSel] = useState(null);
  const [tileSel, setTileSel] = useState(null);
  useEffect(() => {
    const v = portalVars(theme); document.body.style.background = v["--backdrop"];
    try { let l = document.querySelector("link[rel='icon']"); if (!l) { l = document.createElement("link"); l.rel = "icon"; document.head.appendChild(l); } l.type = "image/png"; l.href = QMC_FAV; } catch (e) {}
    try { if (!document.getElementById("qp-font")) { const f = document.createElement("link"); f.id = "qp-font"; f.rel = "stylesheet"; f.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700;800&display=swap"; document.head.appendChild(f); } } catch (e) {}
  }, [theme]);
  const toggleTheme = () => { const t = theme === "dark" ? "light" : "dark"; setTheme(t); try { const p = JSON.parse(localStorage.getItem("fin04_prefs") || "{}"); p.theme = t; localStorage.setItem("fin04_prefs", JSON.stringify(p)); } catch (e) {} };
  const first = (userName || "").trim().split(/\s+/)[0] || "there";
  const initials = (n) => (n || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const dstr = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const tot = projects.reduce((a, p) => ({ total: a.total + p.stats.total, overdue: a.overdue + p.stats.overdue, complete: a.complete + p.stats.complete, inProgress: a.inProgress + (p.stats.inProgress || 0) }), { total: 0, overdue: 0, complete: 0, inProgress: 0 });
  const pcomplete = tot.total ? Math.round(tot.complete / tot.total * 100) : 0;
  const clients = new Set(projects.map((p) => p.client).filter(Boolean)).size;
  const tileData = (() => {
    if (!tileSel) return null;
    if (tileSel === "active") return { title: "Active projects", sub: projects.length + " project" + (projects.length === 1 ? "" : "s") + (clients ? " across " + clients + " client" + (clients === 1 ? "" : "s") : ""), rows: projects.map((p) => ({ id: p.id, name: p.name, sub: (p.code || "") + (p.client ? " \u00B7 " + p.client : ""), chip: p.stats.total + " act", color: "var(--muted)" })) };
    if (tileSel === "progress") return { title: "Activities in progress", sub: tot.inProgress + " in progress portfolio-wide", rows: projects.filter((p) => (p.stats.inProgress || 0) > 0).sort((a, b) => (b.stats.inProgress || 0) - (a.stats.inProgress || 0)).map((p) => ({ id: p.id, name: p.name, sub: p.code || "", chip: (p.stats.inProgress || 0) + " in progress", color: "var(--accent)" })) };
    if (tileSel === "complete") return { title: "Complete", sub: pcomplete + "% \u00B7 " + tot.complete + " of " + tot.total + " activities complete", rows: projects.map((p) => { const pc = p.stats.total ? Math.round(p.stats.complete / p.stats.total * 100) : 0; return { id: p.id, name: p.name, sub: p.stats.complete + " of " + p.stats.total + " complete", chip: pc + "%", color: "#1FB6A6", bar: pc }; }) };
    if (tileSel === "overdue") return { title: "Overdue", sub: tot.overdue + " activit" + (tot.overdue === 1 ? "y" : "ies") + " need attention", rows: projects.filter((p) => p.stats.overdue > 0).sort((a, b) => b.stats.overdue - a.stats.overdue).map((p) => ({ id: p.id, name: p.name, sub: p.code || "", chip: p.stats.overdue + " overdue", color: "#C0392B" })) };
    return null;
  })();
  const fmtAgo = (ts) => { if (!ts) return ""; const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000); if (s < 60) return "just now"; const m = Math.floor(s / 60); if (m < 60) return m + "m ago"; const h = Math.floor(m / 60); if (h < 24) return h + "h ago"; const d = Math.floor(h / 24); if (d === 1) return "yesterday"; if (d < 7) return d + " days ago"; return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short" }); };
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "\u2014";
  const ringEl = (pct, accent) => { const r = 22, c = 2 * Math.PI * r, off = c * (1 - pct / 100); return (<div className="ring"><svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r={r} fill="none" stroke="var(--ring-track)" strokeWidth="5" /><circle cx="26" cy="26" r={r} fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} /></svg><div className="lbl">{pct}<small>%</small></div></div>); };
  const ql = q.trim().toLowerCase();
  const filtered = ql ? projects.filter((p) => (p.name + " " + p.code + " " + p.location + " " + p.client).toLowerCase().includes(ql)) : projects;
  const lastId = (() => { try { return localStorage.getItem("fin04_lastproj"); } catch { return null; } })();
  const ip = projects.find((p) => p.id === lastId) || projects[0];
  useEffect(() => {
    if (scene !== "inside" || !ip || !onLoadOverview) return;
    let live = true; setOv(null); setOvAnchor(null);
    onLoadOverview(ip.id).then((rows) => { if (live) setOv(rows || []); }).catch(() => { if (live) setOv([]); });
    return () => { live = false; };
  }, [scene, ip && ip.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const DAY = 86400000;
  const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d; };
  const mondayMs = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
  const today0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const ovWindow = (() => {
    const dated = (ov || []).filter((a) => a.start);
    let allMin = Infinity, allMax = -Infinity;
    dated.forEach((a) => { const s = new Date(a.start).getTime(); const e = addDays(a.start, Math.max(0, a.dur - 1)).getTime(); if (s < allMin) allMin = s; if (e > allMax) allMax = e; });
    if (!isFinite(allMin)) { allMin = today0; allMax = today0 + 28 * DAY; }
    if (ovWeeks === 0) return { min: allMin, max: allMax + DAY, anchored: false, anchor: null };
    const winLen = ovWeeks * 7 * DAY;
    let anchor;
    if (ovAnchor != null) anchor = ovAnchor;
    else { const tm = mondayMs(today0); const hit = dated.some((a) => { const s = new Date(a.start).getTime(); const e = addDays(a.start, Math.max(0, a.dur - 1)).getTime(); return s < tm + winLen && e >= tm; }); anchor = hit ? tm : mondayMs(allMin); }
    return { min: anchor, max: anchor + winLen, anchored: true, anchor };
  })();
  const inWin = (ov || []).filter((a) => { if (!a.start) return ovWeeks === 0; const s = new Date(a.start).getTime(); const e = addDays(a.start, Math.max(0, a.dur - 1)).getTime(); return s < ovWindow.max && e >= ovWindow.min; });
  const ovLanes = (() => {
    const groups = new Map();
    inWin.forEach((a) => { const k = a[ovGroup] || "Unassigned"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); });
    const lanes = Array.from(groups.entries()).map(([name, acts]) => ({ name, acts }));
    lanes.sort((x, y) => y.acts.length - x.acts.length || x.name.localeCompare(y.name));
    return { lanes, minMs: ovWindow.min, span: Math.max(DAY, ovWindow.max - ovWindow.min), today: today0 };
  })();
  const panWin = (dir) => { const cur = ovWindow.anchor != null ? ovWindow.anchor : ovWindow.min; setOvAnchor(cur + dir * ovWeeks * 7 * DAY); };
  const fmtShort = (ms) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const barFor = (a) => {
    const start = a.start ? new Date(a.start).getTime() : ovLanes.minMs;
    const finish = a.start ? addDays(a.start, Math.max(0, a.dur - 1)).getTime() : start + a.dur * DAY;
    const left = Math.max(0, Math.min(98, (start - ovLanes.minMs) / ovLanes.span * 100));
    let width = Math.max(5, (a.dur * DAY) / ovLanes.span * 100); if (left + width > 100) width = 100 - left;
    const overdue = a.status !== "complete" && a.start && finish < ovLanes.today;
    let bg = "var(--chip)", fg = "var(--muted)", border = "1px solid var(--line)";
    if (a.status === "complete") { bg = "#1FB6A6"; fg = "#06231f"; border = "0"; }
    else if (overdue) { bg = "repeating-linear-gradient(135deg,#C0392B 0 7px,#8C2A22 7px 14px)"; fg = "#fff"; border = "0"; }
    else if (a.status === "in_progress") { bg = "var(--accent)"; fg = "#fff"; border = "0"; }
    else if (a.committed) { bg = "#E6A435"; fg = "#241803"; border = "0"; }
    return { left, width, bg, fg, border };
  };
  const packRows = (acts) => {
    const items = acts.map((a) => ({ a, b: barFor(a) })).sort((p, q) => p.b.left - q.b.left);
    const rows = [];
    for (const it of items) {
      let placed = false;
      for (const row of rows) { const last = row[row.length - 1]; if (it.b.left >= last.b.left + last.b.width + 1) { row.push(it); placed = true; break; } }
      if (!placed) rows.push([it]);
    }
    return rows;
  };
  const isoWeek = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
    const ft = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    ft.setUTCDate(ft.getUTCDate() - ((ft.getUTCDay() + 6) % 7) + 3);
    return 1 + Math.round((d - ft) / (7 * 86400000));
  };
  const ovTicks = (() => {
    const minMs = ovLanes.minMs, maxMs = ovLanes.minMs + ovLanes.span, sp = Math.max(1, maxMs - minMs);
    const out = []; let g = 0;
    let d = new Date(minMs); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    while (d.getTime() <= maxMs && g++ < 130) {
      const pos = (d.getTime() - minMs) / sp * 100;
      if (pos >= -2 && pos <= 102) out.push({ pos: Math.max(0, Math.min(100, pos)), label: ovGran === "week" ? ("Wk " + isoWeek(d)) : d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) });
      d = new Date(d); d.setDate(d.getDate() + 7);
    }
    const cap = ovGran === "week" ? 18 : 13;
    if (out.length > cap) { const step = Math.ceil(out.length / cap); return out.filter((_, i) => i % step === 0); }
    return out;
  })();
  const gridEls = () => {
    const els = ovTicks.map((t, i) => <i key={"gl" + i} className="gl" style={{ left: t.pos + "%" }} />);
    const tp = (ovLanes.today - ovLanes.minMs) / ovLanes.span * 100;
    if (tp >= 0 && tp <= 100) els.push(<i key="today" className="gl today" style={{ left: tp + "%" }} />);
    return els;
  };
  const ovFlat = inWin.slice().sort((a, b) => (a.start || "9999").localeCompare(b.start || "9999") || a.label.localeCompare(b.label));
  const statusLabel = (a) => { if (a.status === "complete") return "Complete"; if (a.start && a.status !== "complete" && addDays(a.start, Math.max(0, a.dur - 1)).getTime() < ovLanes.today) return "Overdue"; if (a.status === "in_progress") return "In progress"; if (a.committed) return "Committed"; return "Planned"; };
  const statusDot = (a) => { if (a.status === "complete") return "#1FB6A6"; if (a.start && a.status !== "complete" && addDays(a.start, Math.max(0, a.dur - 1)).getTime() < ovLanes.today) return "#C0392B"; if (a.status === "in_progress") return "var(--accent)"; if (a.committed) return "#E6A435"; return "var(--muted)"; };
  const openNew = () => { setNf({ name: "", code: "", client: "", location: "", startDate: "", targetDate: "", accent: "#1E63D6", copyFrom: "" }); setErr(""); setScene("newproj"); };
  const submit = async () => { if (!nf.name.trim() || !nf.code.trim()) { setErr("Project name and code are required."); return; } setBusy(true); setErr(""); try { await onNew(nf); } catch (e) { setErr(e.message || String(e)); setBusy(false); } };
  const SW = ["#1E63D6", "#0E9384", "#7C4DFF", "#C07A00", "#C0392B"];
  const cardEl = (p) => { const pct = p.stats.total ? Math.round(p.stats.complete / p.stats.total * 100) : 0; return (
    <div key={p.id} className="pcard" onClick={() => onEnter(p.id)}>
      <div className="head" style={{ background: p.accent }} />
      <div className="body">
        <div><div className="code">{p.code}</div><div className="nm">{p.name}</div></div>
        {p.location && <div className="loc"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>{p.location}</div>}
        <div className="midrow">{ringEl(pct, p.accent)}<div className="kv"><div className="c">Activities<b>{p.stats.total}</b></div><div className="c">Overdue<b className={p.stats.overdue ? "warn" : ""}>{p.stats.overdue}</b></div></div><span className={"rolechip" + (p.role === "admin" ? " admin" : "")}>{p.role === "admin" ? "Admin" : "Member"}</span></div>
      </div>
      <div className="foot"><span>{p.startDate ? fmtDate(p.startDate) + (p.targetDate ? " \u2192 " + fmtDate(p.targetDate) : "") : (p.client || "\u00A0")}</span><span className="enter">Enter<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m9 18 6-6-6-6" /></svg></span></div>
    </div>); };
  return (
    <div className="qp" style={portalVars(theme)}><style>{PORTAL_CSS}</style>
      <div className="top">
        <div className="brandmark"><img className="glyphimg" src={theme === "dark" ? QMC_DARK : QMC_LIGHT} alt="QMC" />DLP<span className="sub">Platform</span></div>
        <div className="switcher">
          {swOpen && <div className="swback" onClick={() => setSwOpen(false)} />}
          <button onClick={() => setSwOpen((o) => !o)}><span className="dot" />All projects<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m6 9 6 6 6-6" /></svg></button>
          {swOpen && <div className="swmenu">
            <div className="it all" onClick={() => { setSwOpen(false); setScene("home"); }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>All projects</div>
            <div className="sep" />
            {projects.map((p) => <div key={p.id} className="it" onClick={() => { setSwOpen(false); onEnter(p.id); }}><span className="ac" style={{ background: p.accent }} /><div style={{ flex: 1 }}><div>{p.name}</div><div className="mt">{p.code} &middot; {p.role === "admin" ? "Admin" : "Member"}</div></div></div>)}
          </div>}
        </div>
        <div className="spacer" />
        <button className="tbtn" onClick={toggleTheme} title="Theme">{theme === "dark" ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg> : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" /></svg>}</button>
        <div className="user"><div className="av">{initials(userName)}</div><div><div className="nm">{userName}</div><div className="rl">{isSuper ? "Platform admin" : "Member"}</div></div>{isSuper && <span className="pill-plat">Super</span>}</div>
        <button className="btn ghost sm" onClick={onSignOut}>Sign out</button>
      </div>

      <div className="pvbar">
        <div className="pvt">
          <button className={scene === "home" ? "on" : ""} onClick={() => setScene("home")}>Home</button>
          <button className={scene === "projects" ? "on" : ""} onClick={() => setScene("projects")}>Projects</button>
          {isSuper && <button className={scene === "newproj" ? "on" : ""} onClick={openNew}>New project</button>}
          <button className={scene === "inside" ? "on" : ""} onClick={() => setScene("inside")}>Inside a project</button>
        </div>
      </div>

      <div className="wrap">
        <div className={"scene" + (scene === "home" ? " on" : "")}>
          <div className="hello">{greet}, {first}</div>
          <div className="subhello">{dstr} &middot; {isSuper ? "you can see every project" : ("you are on " + projects.length + " project" + (projects.length === 1 ? "" : "s"))}</div>
          <div className="tiles" style={{ marginTop: 20 }}>
            <div className="tile" onClick={() => setTileSel("active")}><div className="k">Active projects</div><div className="v mono">{projects.length}</div><div className="d">{clients ? "across " + clients + " client" + (clients === 1 ? "" : "s") : "\u00A0"}</div></div>
            <div className="tile" onClick={() => setTileSel("progress")}><div className="k">Activities in progress</div><div className="v mono" style={{ color: "var(--signal)" }}>{tot.inProgress}</div><div className="d">portfolio-wide</div></div>
            <div className="tile" onClick={() => setTileSel("complete")}><div className="k">Complete</div><div className="v mono" style={{ color: "var(--green)" }}>{pcomplete}%</div><div className="d">of all activities</div></div>
            <div className="tile" onClick={() => setTileSel("overdue")}><div className="k">Overdue</div><div className="v mono" style={{ color: "var(--red)" }}>{tot.overdue}</div><div className="d">need attention</div></div>
          </div>
          <div className="sech"><h2>Your projects</h2><span className="lk" onClick={() => setScene("projects")}>View all</span></div>
          <div className="pgrid">
            {projects.map(cardEl)}
            {isSuper && <div className="newcard" onClick={openNew}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>New project</div>}
            {projects.length === 0 && !isSuper && <div className="empty">You are not a member of any project yet.</div>}
          </div>
          {activity && activity.length > 0 && <>
            <div className="sech"><h2>Recent activity</h2></div>
            <div className="feed">
              {activity.map((e, i) => <div key={i} className="frow"><div className="fav">{initials(e.user)}</div><div className="ft"><b>{e.user}</b> {e.verb} {e.name ? <b>{e.name}</b> : "an activity"}</div><span className="ptag">{e.code || ""}</span><span className="fw">{fmtAgo(e.ts)}</span>{e.projId ? <button className="fview" onClick={() => onEnter(e.projId, e.actId)}>View</button> : <span className="fview" />}</div>)}
            </div>
          </>}
        </div>

        <div className={"scene" + (scene === "projects" ? " on" : "")}>
          <div className="hello">Your projects</div>
          <div className="subhello">{isSuper ? "Every project on the platform." : "You see only the projects you have been granted access to."}</div>
          <div className="searchbar"><input placeholder="Search projects by name, code or location\u2026" value={q} onChange={(e) => setQ(e.target.value)} />{isSuper && <button className="btn sm" onClick={openNew}>+ New project</button>}</div>
          <div className="ptable">
            <div className="hd"><div>Project</div><div>Location</div><div>Your role</div><div>Status</div><div>Overdue</div><div>Dates</div><div></div></div>
            {filtered.map((p) => { const pct = p.stats.total ? Math.round(p.stats.complete / p.stats.total * 100) : 0; return (
              <div key={p.id} className="row" onClick={() => onEnter(p.id)}>
                <div><div className="pn">{p.name}</div><div className="pc">{p.code}{p.client ? " \u00B7 " + p.client : ""}</div></div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{p.location || "\u2014"}</div>
                <div><span className={"rolechip" + (p.role === "admin" ? " admin" : "")}>{p.role === "admin" ? "Admin" : "Member"}</span></div>
                <div><div className="bar"><i style={{ width: pct + "%", background: p.accent }} /></div><div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{pct}%</div></div>
                <div className="mono" style={{ color: p.stats.overdue ? "var(--red)" : "var(--muted)", fontWeight: 700 }}>{p.stats.overdue}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{fmtDate(p.startDate)}{p.targetDate ? <><br />{fmtDate(p.targetDate)}</> : ""}</div>
                <div className="enter">Enter<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m9 18 6-6-6-6" /></svg></div>
              </div>); })}
            {filtered.length === 0 && <div className="empty">No projects match.</div>}
          </div>
        </div>

        <div className={"scene" + (scene === "newproj" ? " on" : "")}>
          <div className="hello">New project</div>
          <div className="subhello">Platform admins only. Creates an isolated project; nobody sees it until you add them.</div>
          <div className="form">
            <div className="frow2">
              <div className="f"><label>Project name</label><input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder="atnorth Mantsala Data Centre" /></div>
              <div className="f"><label>Project code</label><input value={nf.code} onChange={(e) => setNf({ ...nf, code: e.target.value })} placeholder="FIN05" /><div className="hint">Short code used in activity references, e.g. FIN05.01.L0.GY01</div></div>
            </div>
            <div className="frow2">
              <div className="f"><label>Client / owner</label><input value={nf.client} onChange={(e) => setNf({ ...nf, client: e.target.value })} placeholder="atnorth" /></div>
              <div className="f"><label>Location</label><input value={nf.location} onChange={(e) => setNf({ ...nf, location: e.target.value })} placeholder="Mantsala, Finland" /></div>
            </div>
            <div className="frow2">
              <div className="f"><label>Start date</label><input type="date" value={nf.startDate} onChange={(e) => setNf({ ...nf, startDate: e.target.value })} /></div>
              <div className="f"><label>Target completion</label><input type="date" value={nf.targetDate} onChange={(e) => setNf({ ...nf, targetDate: e.target.value })} /></div>
            </div>
            <div className="frow2">
              <div className="f"><label>Accent colour</label><div className="swatches">{SW.map((c) => <div key={c} className={"swatch" + (nf.accent === c ? " sel" : "")} style={{ background: c }} onClick={() => setNf({ ...nf, accent: c })} />)}</div></div>
              <div className="f"><label>Copy config from</label><select value={nf.copyFrom} onChange={(e) => setNf({ ...nf, copyFrom: e.target.value })}><option value="">Start blank</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name} (Cx stages, systems, zones)</option>)}</select><div className="hint">Reuse Cx stages, systems and zones from an existing project. Companies are shared across all projects.</div></div>
            </div>
            <div className="f"><label>Initial project admin</label><div className="adminrow"><span className="adminchip">{userName} (you)</span></div><div className="hint">You are added as admin automatically. Add others from the project's Admin tab once it exists.</div></div>
            {err && <div className="err">{err}</div>}
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}><button className="btn" disabled={busy} onClick={submit}>{busy ? "Creating\u2026" : "Create project"}</button><button className="btn ghost" disabled={busy} onClick={() => setScene("projects")}>Cancel</button></div>
          </div>
        </div>

        <div className={"scene" + (scene === "inside" ? " on" : "")}>
          {ip ? <>
            <div className="ip-top" style={{ background: "linear-gradient(135deg, " + (ip.accent || "#2F6BFF") + ", " + (ip.accent || "#2F6BFF") + "99)" }}>
              <div className="lg">{(ip.code || "").slice(0, 3).toUpperCase()}</div>
              <div style={{ flex: 1 }}><h2>{ip.name}</h2><div className="m">{ip.location ? ip.location + " \u00B7 " : ""}you are {ip.role === "admin" ? "Admin" : "Member"} on this project</div></div>
              <button className="btn ipboard" onClick={() => onEnter(ip.id)}>Open planning board</button>
              <button className="btn ghost sm ipleave" onClick={() => setScene("home")}>Leave project</button>
            </div>
            <div className="ip-board">
              <div className="ip-toolbar">
                <div className="seg">
                  <span className={ovView === "swimlane" ? "on" : ""} onClick={() => setOvView("swimlane")}>Swimlane</span>
                  <span className={ovView === "gantt" ? "on" : ""} onClick={() => setOvView("gantt")}>Gantt</span>
                </div>
                <div className="seg">
                  <span className={ovGran === "day" ? "on" : ""} onClick={() => setOvGran("day")}>Day</span>
                  <span className={ovGran === "week" ? "on" : ""} onClick={() => setOvGran("week")}>Week</span>
                </div>
                <div className={"seg" + (ovView === "gantt" ? " dim" : "")}>
                  <span className={ovGroup === "company" ? "on" : ""} onClick={() => ovView === "swimlane" && setOvGroup("company")}>Company</span>
                  <span className={ovGroup === "level" ? "on" : ""} onClick={() => ovView === "swimlane" && setOvGroup("level")}>Level</span>
                  <span className={ovGroup === "zone" ? "on" : ""} onClick={() => ovView === "swimlane" && setOvGroup("zone")}>Zone</span>
                </div>
                <div className="seg">
                  {[["2w", 2], ["4w", 4], ["8w", 8], ["All", 0]].map(([lbl, w]) => <span key={w} className={ovWeeks === w ? "on" : ""} onClick={() => setOvWeeks(w)}>{lbl}</span>)}
                </div>
                <div className="ipnav">
                  <button disabled={ovWeeks === 0} onClick={() => panWin(-1)} aria-label="Earlier">{"\u2039"}</button>
                  <span className="iprange">{ovWeeks === 0 ? "All dates" : (fmtShort(ovWindow.min) + " \u2013 " + fmtShort(ovWindow.max - DAY))}</span>
                  <button disabled={ovWeeks === 0} onClick={() => panWin(1)} aria-label="Later">{"\u203A"}</button>
                  <button className="todaybtn" disabled={ovWeeks === 0} onClick={() => setOvAnchor(mondayMs(today0))}>Today</button>
                </div>
              </div>
              {ov === null
                ? <div className="ip-empty">Loading overview\u2026</div>
                : ov.length === 0
                  ? <div className="ip-empty">No activities in this project yet.</div>
                  : <>
                    <div className="ip-axis"><div className="axsp" /><div className="axtrack">{ovTicks.map((t, i) => <span key={i} style={{ left: t.pos + "%" }}>{t.label}</span>)}</div></div>
                    {ovLanes.lanes.length === 0
                      ? <div className="ip-empty">No activities in this window. Widen the span or page with the arrows.</div>
                      : ovView === "swimlane"
                      ? ovLanes.lanes.map((ln) => (
                        <div className="lane" key={ln.name}>
                          <div className="lh"><b>{ln.name}</b><div className="s">{ln.acts.length} {ln.acts.length === 1 ? "activity" : "activities"}</div></div>
                          <div className="tracks">
                            {packRows(ln.acts).map((row, ri) => (
                              <div className="track" key={ri}>
                                {gridEls()}
                                {row.map(({ a, b }) => a.milestone
                                  ? <div className="ms" key={a.id} style={{ left: b.left + "%" }} title={a.label} onClick={() => setOvSel(a)}><span className="dia" style={{ background: ip.accent || "#2F6BFF" }} /><span className="mslabel">{a.label}</span></div>
                                  : <div className="blk" key={a.id} style={{ left: b.left + "%", width: b.width + "%", background: b.bg, color: b.fg, border: b.border }} title={a.label} onClick={() => setOvSel(a)}>{a.label}</div>)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                      : <div className="gantt">{ovFlat.map((a) => { const b = barFor(a); return (
                        <div className="grow" key={a.id} onClick={() => setOvSel(a)}>
                          <div className="glh" title={a.label}>{a.label}</div>
                          <div className="track">
                            {gridEls()}
                            {a.milestone
                              ? <div className="ms" style={{ left: b.left + "%" }}><span className="dia" style={{ background: ip.accent || "#2F6BFF" }} /></div>
                              : <div className="blk" style={{ left: b.left + "%", width: b.width + "%", background: b.bg, color: b.fg, border: b.border }}>{a.label}</div>}
                          </div>
                        </div>
                      ); })}</div>}
                  </>}
            </div>
            <div className="ip-foot">Live snapshot of {ip.name}, scoped to this project. Click any activity for detail; open the planning board to edit, drag and manage constraints.</div>
            {ovSel && (
              <div className="ovsel-back" onClick={() => setOvSel(null)}>
                <div className="ovsel" onClick={(e) => e.stopPropagation()}>
                  <div className="ovsel-h"><b>{ovSel.label}</b><button onClick={() => setOvSel(null)} aria-label="Close">{"\u00D7"}</button></div>
                  <div className="ovsel-b">
                    <div className="r"><span>Status</span><b><i className="dot" style={{ background: statusDot(ovSel) }} />{statusLabel(ovSel)}</b></div>
                    <div className="r"><span>Company</span><b>{ovSel.company}</b></div>
                    <div className="r"><span>Level</span><b>{ovSel.level}</b></div>
                    <div className="r"><span>Zone</span><b>{ovSel.zone}</b></div>
                    <div className="r"><span>Start</span><b>{fmtDate(ovSel.start)}</b></div>
                    <div className="r"><span>Finish</span><b>{ovSel.start ? fmtDate(addDays(ovSel.start, Math.max(0, ovSel.dur - 1))) : "\u2014"}</b></div>
                    <div className="r"><span>Duration</span><b>{ovSel.dur} {ovSel.dur === 1 ? "day" : "days"}</b></div>
                    {ovSel.committed && <div className="r"><span>Committed</span><b>Yes</b></div>}
                    {ovSel.milestone && <div className="r"><span>Type</span><b>Milestone</b></div>}
                  </div>
                  <div className="ovsel-f"><button className="btn sm" onClick={() => onEnter(ip.id)}>Open in board</button></div>
                </div>
              </div>
            )}
          </> : <div className="empty">You are not a member of any project yet.</div>}
        </div>
      </div>
      {tileData && (
        <div className="ovsel-back" onClick={() => setTileSel(null)}>
          <div className="ovsel wide" onClick={(e) => e.stopPropagation()}>
            <div className="ovsel-h"><div style={{ flex: 1, minWidth: 0 }}><b>{tileData.title}</b><div className="ovsel-sub">{tileData.sub}</div></div><button onClick={() => setTileSel(null)} aria-label="Close">{"\u00D7"}</button></div>
            <div className="drillb">
              {tileData.rows.length === 0
                ? <div className="ip-empty" style={{ padding: "18px" }}>Nothing to show here.</div>
                : tileData.rows.map((r) => (
                  <div className="drow" key={r.id} onClick={() => { setTileSel(null); onEnter(r.id); }}>
                    <div className="drow-m"><b>{r.name}</b><span>{r.sub}</span>{r.bar != null && <div className="drow-bar"><i style={{ width: r.bar + "%" }} /></div>}</div>
                    <span className="drow-chip" style={{ color: r.color, borderColor: r.color }}>{r.chip}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
      <div className="qp-foot">DLP by QMC Cx Software Solutions{"\u2122"} {"\u00B7"} {"\u00A9"} {new Date().getFullYear()} Quantum Mission Critical. All rights reserved.</div>
    </div>
  );
}

export default function App({ session }) {
  const [S, setS] = useState(null);
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));
  const [makeReady, setMakeReady] = useState(false);
  const [ytt, setYtt] = useState(false);
  const [witSched, setWitSched] = useState(false);
  const [witPeriod, setWitPeriod] = useState("4w");
  const [resize, setResize] = useState(null);
  const [metricDrill, setMetricDrill] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [navOpen, setNavOpen] = useState(() => { try { return localStorage.getItem("fin04_nav") !== "0"; } catch (e) { return true; } });
  const toggleNav = () => setNavOpen((o) => { const n = !o; try { localStorage.setItem("fin04_nav", n ? "1" : "0"); } catch (e) {} return n; });
  useEffect(() => { if (!ytt) return; const h = (e) => { if (e.key === "Escape") setYtt(false); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [ytt]);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(() => { try { const p = localStorage.getItem("fin04_page"); return ["board", "table", "schedule", "constraints", "reports", "help", "admin", "cx"].includes(p) ? p : "board"; } catch (e) { return "board"; } });
  const dragId = useRef(null);

  // ---- multi-project ----
  const [projects, setProjects] = useState([]);
  const [isSuper, setIsSuper] = useState(false);
  const [selProj, setSelProj] = useState(null);   // selected project id; null = portal
  const [pendingFocus, setPendingFocus] = useState(null);   // activity id to open once the board loads
  const [booting, setBooting] = useState(true);
  const [swOpen, setSwOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [activity, setActivity] = useState([]);
  const selProjRef = useRef(null);
  const projectsRef = useRef([]);
  useEffect(() => { selProjRef.current = selProj; }, [selProj]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  const prefs = () => { try { return JSON.parse(localStorage.getItem("fin04_prefs") || "{}"); } catch { return {}; } };

  const enterProject = async (projectId, projList, focusActId) => {
    const list = projList || projectsRef.current;
    const proj = list.find((x) => x.id === projectId);
    setSelProj(projectId);
    if (focusActId) setPendingFocus(focusActId);
    try { history.replaceState(null, "", "?p=" + projectId); localStorage.setItem("fin04_lastproj", projectId); } catch (e) {}
    try {
      const data = await loadAll(session, projectId, proj?.name);
      const p = prefs();
      setS({ ...data, projectId, projectRole: proj?.role || "member", currentUserId: session.user.id, theme: p.theme || "light", view: p.view || "swimlane", grain: p.grain || "day", laneBy: p.laneBy || "company" });
    } catch (e) { console.error("Load failed:", e); }
  };
  const goPortal = () => { setSelProj(null); setS(null); setSwOpen(false); try { history.replaceState(null, "", location.pathname); } catch (e) {} boot(); };

  const boot = async () => {
    try {
      const { isSuper: sup, userName: nm, list, activity: act } = await loadProjects(session);
      setIsSuper(sup); setProjects(list); projectsRef.current = list; setUserName(nm || ""); setActivity(act || []);
      const urlP = (() => { try { return new URLSearchParams(location.search).get("p"); } catch { return null; } })();
      let target = null;
      if (urlP && list.find((x) => x.id === urlP)) target = urlP;
      else if (!sup && list.length === 1) target = list[0].id;
      if (target) await enterProject(target, list);
      else setSelProj(null);
    } catch (e) { console.error("Boot failed:", e); }
    setBooting(false);
  };
  const createProjectAndEnter = async (fields) => {
    const id = await createProject(fields, session);
    const { list } = await loadProjects(session);
    setProjects(list); projectsRef.current = list;
    await enterProject(id, list);
  };
  useEffect(() => { boot(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const ch = subscribeAll(() => { if (selProjRef.current) enterProject(selProjRef.current); }); return () => { try { ch.unsubscribe(); } catch (e) {} }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { heartbeat(); const t = setInterval(heartbeat, 60000); const onVis = () => { if (document.visibilityState === "visible") heartbeat(); }; document.addEventListener("visibilitychange", onVis); return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); }; }, []);
  useEffect(() => { if (S?.brand) applyBrandToTab(S.brand); }, [S?.brand]);
  useEffect(() => { if (!pendingFocus || !S) return; const a = (S.activities || []).find((x) => x.id === pendingFocus); if (a) setEditing(a); setPendingFocus(null); }, [S, pendingFocus]);
  useEffect(() => {
    const open = (e) => { const t = e.target; if (t && t.tagName === "INPUT" && t.type === "date" && !t.disabled && !t.readOnly && typeof t.showPicker === "function") { try { t.showPicker(); } catch (err) {} } };
    document.addEventListener("click", open);
    return () => document.removeEventListener("click", open);
  }, []);
  useEffect(() => { const t = THEMES[S?.theme] || THEMES.light; document.documentElement.style.background = t.paper; document.body.style.background = t.paper; }, [S?.theme]);
  useEffect(() => { try { localStorage.setItem("fin04_page", page); } catch (e) {} }, [page]);
  useEffect(() => { if (!S) return; if (page === "admin" && !(isSuper || S.projectRole === "admin")) setPage("board"); }, [S, page, isSuper]);

  const PREF_KEYS = ["theme", "view", "grain", "laneBy"];
  const cu = S && (() => {
    const base = S.users.find((u) => u.id === S.currentUserId) || { id: session.user.id, name: session.user.email, role: "member", companyId: null };
    return { ...base, role: (isSuper || S.projectRole === "admin") ? "admin" : "member" };
  })();
  // Audit is written entirely by database triggers (see schema.sql), so the
  // optional { action, detail } some callers pass as a second argument is
  // intentionally ignored and kept only as inline documentation of intent.
  const update = (producer, _meta) => setS((prev) => {
    const n = producer(prev);
    if (PREF_KEYS.some((k) => n[k] !== prev[k])) { try { localStorage.setItem("fin04_prefs", JSON.stringify({ theme: n.theme, view: n.view, grain: n.grain, laneBy: n.laneBy })); } catch (e) {} }
    syncCollections(prev, n, session, prev.projectId);
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
      if (a.status === "complete" && af) {
        delayDays = Math.round((af - pf) / DAYMS);
      } else if (a.status !== "complete") {
        const lateStart = as ? Math.round((as - ps) / DAYMS) : 0;
        const overdue = todayMid() > pf.getTime() ? Math.round((todayMid() - pf.getTime()) / DAYMS) : 0;
        delayDays = Math.max(0, lateStart, overdue);
      }
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
    const todayOff = Math.round((todayMid() - anchor) / DAYMS);
    base.forEach((a) => {
      a.projStartOff = a._ps != null ? a._ps : a.startOff;
      a.projEndOff = a._pe != null ? a._pe : a.endOff;
      a.knockOn = Math.max(0, a.projStartOff - (a._base != null ? a._base : a.startOff));  // pushed by predecessors, beyond its own slip
      a.totalShift = Math.max(0, a.projStartOff - a.startOff);
      // Carry forward until actually complete. Original rule: the planned span overlaps the window.
      // Added: while still open, also keep it if its live span overlaps the window, where "live" means
      // the overdue tail stretched to today, or a start/finish that a slipped predecessor pushed in
      // (knock-on). Complete activities keep the planned-span rule and drop off once they are behind us.
      const liveEnd = Math.max(a.endOff, a.projEndOff, a.delayed ? todayOff : a.endOff);
      a.inWin = (a.endOff >= 0 && a.startOff < DAYS) || (a.status !== "complete" && liveEnd >= 0 && a.projStartOff < DAYS);
      delete a._ps; delete a._pe; delete a._base;
    });
    return base;
  }, [S, anchor, DAYS]);

  if (booting) return <div className="lk" style={cssVars(prefs().theme === "dark" ? "dark" : "light")}><style>{css}</style><div className="lk-empty">Loading…</div></div>;
  if (!selProj) return <Portal projects={projects} isSuper={isSuper} userName={userName || session.user.email} activity={activity} theme={prefs().theme === "dark" ? "dark" : "light"} onEnter={(id, focus) => enterProject(id, undefined, focus)} onNew={createProjectAndEnter} onSignOut={() => signOut()} onLoadOverview={(pid) => loadProjectOverview(session, pid, (projects.find((p) => p.id === pid) || {}).name)} />;
  if (!S) return <div className="lk" style={cssVars("light")}><style>{css}</style><div className="lk-empty">Loading board…</div></div>;
  if (cu.mustReset) return <SetPassword forced onDone={() => setS((prev) => ({ ...prev, users: prev.users.map((u) => (u.id === cu.id ? { ...u, mustReset: false } : u)) }))} />;
  const LV = S.levels || DEFAULT_LEVELS;

  const isAdmin = cu.role === "admin";
  const csnCompanyId = cu.companyId ? cu.companyId : (cu.role === "admin" ? (((S.companies || []).find((c) => (c.name || "").trim().toLowerCase() === "csn") || {}).id || null) : null);
  const myConstraints = (() => {
    const out = [];
    (S.activities || []).forEach((a) => (a.constraints || []).forEach((c) => {
      if (c.done) return;
      const mine = (c.ownerType === "user" && c.ownerId === cu.id) || (c.ownerType === "company" && csnCompanyId && c.ownerId === csnCompanyId);
      if (mine) out.push({ a, c });
    }));
    return out.sort((x, y) => (x.c.due || "9999").localeCompare(y.c.due || "9999"));
  })();
  const notifCount = myConstraints.length;
  const canEdit = (a) => isAdmin || a.companyId === cu.companyId;
  // ---- Request Invite (atnorth client viewers) ----
  // A non-admin whose company is the project client (atnorth) can ask an admin to
  // forward an activity's invite to them. The admin sees it in the notifications bell.
  const inviteReqs = S.inviteRequests || [];
  const myCoName = (coName(cu.companyId) || "").trim().toLowerCase();
  const projClient = (((projects || []).find((p) => p.id === selProj) || {}).client || "").trim().toLowerCase();
  const isClientViewer = !isAdmin && !!cu.companyId && (myCoName === "atnorth" || (!!projClient && myCoName === projClient));
  const myInviteFor = (actId) => inviteReqs.find((r) => r.activityId === actId && r.requesterId === cu.id) || null;
  const pendingInvites = isAdmin ? inviteReqs.filter((r) => r.status === "pending") : [];
  const notifTotal = notifCount + pendingInvites.length;
  const requestInvite = async (a) => {
    if (!a || !isClientViewer || myInviteFor(a.id)) return;
    const optimistic = { id: "tmp_" + a.id, activityId: a.id, requesterId: cu.id, requesterName: cu.name, requesterEmail: session.user.email || "", desc: a.desc || "", code: (a.code == null ? "" : String(a.code)), location: locCode(a), status: "pending", createdAt: new Date().toISOString(), decidedByName: "", decidedAt: null };
    setS((prev) => ({ ...prev, inviteRequests: [...(prev.inviteRequests || []), optimistic] }));
    try {
      const saved = await submitInviteRequest({ projectId: S.projectId, activity: a, requesterId: cu.id, requesterName: cu.name, requesterEmail: session.user.email || "", location: locCode(a) });
      setS((prev) => ({ ...prev, inviteRequests: (prev.inviteRequests || []).map((r) => (r.id === optimistic.id ? saved : r)) }));
    } catch (e) {
      console.error("Invite request failed:", e);
      setS((prev) => ({ ...prev, inviteRequests: (prev.inviteRequests || []).filter((r) => r.id !== optimistic.id) }));
      alert("Could not send the request. Please try again.");
    }
  };
  const markInviteForwarded = async (id) => {
    if (!isAdmin) return;
    const now = new Date().toISOString();
    setS((prev) => ({ ...prev, inviteRequests: (prev.inviteRequests || []).map((r) => (r.id === id ? { ...r, status: "forwarded", decidedByName: cu.name, decidedAt: now } : r)) }));
    try { await decideInviteRequest(id, { status: "forwarded", decided_by: cu.id, decided_by_name: cu.name, decided_at: now }); }
    catch (e) { console.error("Mark forwarded failed:", e); }
  };
  const toggleConstraint = (actId, cId) => { const a = S.activities.find((x) => x.id === actId); if (!a || !isAdmin) return; update((p) => ({ ...p, activities: p.activities.map((x) => x.id === actId ? { ...x, constraints: (x.constraints || []).map((c) => c.id === cId ? { ...c, done: !c.done } : c) } : x) }), { action: "Clear constraint", detail: a.desc }); };
  const acknowledgeConstraint = (actId, cId) => {
    const a = S.activities.find((x) => x.id === actId); if (!a) return;
    const c = (a.constraints || []).find((y) => y.id === cId); if (!c) return;
    const mine = isAdmin || (c.ownerType === "user" && c.ownerId === cu.id) || (c.ownerType === "company" && csnCompanyId && c.ownerId === csnCompanyId);
    if (!mine) return;
    update((p) => ({ ...p, activities: p.activities.map((x) => x.id === actId ? { ...x, constraints: (x.constraints || []).map((y) => y.id === cId ? { ...y, done: true } : y) } : x) }), { action: "Acknowledge constraint", detail: `${c.text} (${a.desc})` });
  };
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
  const resizable = (a) => !a.isMilestone && canEdit(a) && (isAdmin || !a.committed);
  const commitResize = (a, edge, delta) => {
    update((p) => ({ ...p, activities: p.activities.map((x) => {
      if (x.id !== a.id) return x;
      if (edge === "r") return { ...x, duration: Math.max(1, x.duration + delta) };
      return { ...x, start: fmtISO(addDays(parseD(x.start), delta)), duration: Math.max(1, x.duration - delta) };
    }) }), { action: "Resize activity", detail: `${a.desc} (${edge === "l" ? "start" : "finish"} ${delta > 0 ? "+" : ""}${delta}d)` });
  };
  const startResize = (e, a, edge) => {
    e.preventDefault(); e.stopPropagation();
    if (!resizable(a)) return;
    const tk = e.currentTarget.closest(".lk-tk");
    const dayW = tk && tk.offsetWidth ? tk.offsetWidth / cols : 36;
    const startX = e.clientX, origDur = a.duration;
    let last = 0;
    const onMove = (ev) => {
      let d = Math.round((ev.clientX - startX) / dayW);
      d = edge === "l" ? Math.min(d, origDur - 1) : Math.max(d, -(origDur - 1));
      if (d !== last) { last = d; setResize({ id: a.id, edge, delta: d }); }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp);
      setResize(null); if (last !== 0) commitResize(a, edge, last);
    };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  };
  const newActivity = (lane, dayIdx) => {
    const base = { id: uid("a"), code: nextCode(S.activities), predecessors: [], desc: "", companyId: isAdmin ? (S.companies[0] || {}).id : cu.companyId, area: (S.areas && S.areas.length === 1) ? S.areas[0] : "", subArea: "", tier3: "", asset: "", system: "", level: "L2",
      start: (dayIdx == null ? "" : fmtISO(addDays(anchor, Math.max(0, dayIdx)))), duration: 1, committed: false, status: "planned", isMilestone: false, discipline: [], witnessInvite: false, witnessAt: "", witnessDurationMin: 60, notes: "", slipReason: "", actualStart: "", actualFinish: "", constraints: [], reschedules: [] };
    if (lane) { if (S.laneBy === "level") base.level = lane; else if (S.laneBy === "area") base.area = lane; else if (S.laneBy === "subarea") { if (lane !== "Unassigned") base.subArea = lane; } else if (S.laneBy === "tier3") { if (lane !== "Unassigned") base.tier3 = lane; } else if (isAdmin) { const c = S.companies.find((c) => c.name === lane); if (c) base.companyId = c.id; } }
    setEditing(base);
  };
  const exportActivities = () => {
    const headers = ["Code", "Description", "Company", "Location code", "Building", "Level", "Zone / Room", "Asset", "System", "Cx Stage", "Milestone", "Witness invite", "Predecessors", "Planned start", "Planned finish", "Duration (d)", "Actual start", "Actual finish", "Delay (d)", "Forecast start", "Forecast finish", "Knock-on (d)", "Status", "Percent (%)", "Committed", "Reason for non-completion", "Open constraints", "Constraints", "Notes"];
    const predCodes = (a) => (a.predecessors || []).map((pid) => { const p = S.activities.find((x) => x.id === pid); return p && p.code != null ? "#" + p.code : null; }).filter(Boolean).join("; ");
    const rows = visible.map((a) => [a.code != null ? "#" + a.code : "", a.desc, coName(a.companyId), locCode(a), a.area, a.subArea || "", a.tier3 || "", a.asset || "", a.system, a.level, a.isMilestone ? "Yes" : "No", a.witnessInvite ? "Yes" : "No", predCodes(a), a.start, fmtISO(addDays(parseD(a.start), a.duration - 1)), a.duration, a.actualStart || "", a.actualFinish || "", a.delayDays || 0, fmtISO(addDays(anchor, a.projStartOff)), fmtISO(addDays(anchor, a.projEndOff)), a.knockOn || 0, a.status, pctOf(a), a.committed ? "Yes" : "No", a.slipReason || "", a.open, a.constraints.map((c) => (c.done ? "[x] " : "[ ] ") + c.text).join("; "), a.notes || ""]);
    downloadFile(`FIN04-lookahead-${fmtISO(new Date())}.csv`, toCSV(headers, rows));
    update((p) => p, { action: "Export activities", detail: `${rows.length} rows` });
  };
  const fmtWitnessAt = (s) => { if (!s) return ""; const d = new Date(s); if (isNaN(d)) return s; return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
  const exportWitness = () => {
    const pad = (n) => String(n).padStart(2, "0");
    const localISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    // All witnessable activities with a date, ignoring board filters, earliest first.
    const wit = (S.activities || []).filter((a) => a.witnessInvite && a.witnessAt).sort((a, b) => (a.witnessAt || "").localeCompare(b.witnessAt || ""));
    const headers = ["Subject", "Start Date", "Start Time", "End Date", "End Time", "All Day Event", "Location", "Description", "Required Attendees", "Optional Attendees", "Discipline", "Sent", "Start ISO", "End ISO", "Company", "Cx Stage", "System", "Activity ID"];
    const rows = wit.map((a) => {
      const mins = a.witnessDurationMin || 60;
      const sd = new Date(a.witnessAt); const ed = new Date(sd.getTime() + mins * 60000);
      const loc = locCode(a);
      const title = a.desc || "Activity";
      const subject = `FIN04 - INVITE FOR ${title}`;
      const open = (a.constraints || []).filter((c) => !c.done).length;
      const disc = (a.discipline || []).join("; ");
      const { to, cc } = witnessRecipients(a.discipline || []);
      const bodyLines = [`Invite to witness ${title}`, "", `Discipline: ${disc || "-"}`, `Cx Stage: ${a.level}${a.system ? " on " + a.system : ""}`, `Performing: ${coName(a.companyId)}`, `Location: ${loc || "-"}`, `Planned start: ${a.start}`];
      if (a.notes) bodyLines.push(`Notes: ${a.notes}`);
      if (open) bodyLines.push(`Open constraints: ${open}`);
      bodyLines.push("", "Please forward to any stakeholder missed in the invite.");
      const body = bodyLines.join("\n");
      const dmy = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
      const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const sent = a.witnessSentAt ? fmtWitnessAt(a.witnessSentAt) : "";
      return [subject, dmy(sd), hm(sd), dmy(ed), hm(ed), "False", loc, body, to.join("; "), cc.join("; "), disc, sent, localISO(sd), localISO(ed), coName(a.companyId), a.level, a.system || "", a.id];
    });
    downloadFile(`FIN04-witness-invites-${fmtISO(new Date())}.csv`, toCSV(headers, rows));
    update((p) => p, { action: "Export witness invites", detail: `${rows.length} activities` });
  };
  // Stamp activities as invite-sent from the macro's confirmation file (Activity IDs).
  const markWitnessSent = (ids) => {
    const want = new Set((ids || []).filter(Boolean));
    if (!want.size) return;
    const now = new Date().toISOString();
    update((p) => ({ ...p, activities: p.activities.map((x) => (want.has(x.id) && !x.witnessSentAt ? { ...x, witnessSentAt: now } : x)) }), { action: "Mark witness invites sent", detail: `${want.size} activit${want.size === 1 ? "y" : "ies"}` });
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
    const rz = resize && resize.id === a.id ? resize : null;
    let s = Math.max(0, sU(a)), e = Math.min(cols - 1, eU(a));
    if (rz) { if (rz.edge === "l") s = Math.max(0, Math.min(e, sU(a) + rz.delta)); else e = Math.min(cols - 1, Math.max(s, eU(a) + rz.delta)); }
    const lv = lvOf(LV, a.level);
    const editable = canEdit(a);
    const movable = isAdmin || (editable && !a.committed);
    if (a.isMilestone) {
      const late = a.delayed && !a.excuse;
      const complete = a.status === "complete";
      const hasSlip = !a.excuse && (late || (!complete && a.totalShift > 0));
      let feDay;
      if (complete) feDay = a.actualFinish ? Math.round((parseD(a.actualFinish) - anchor) / DAYMS) : a.endOff;   // completed: anchor the evidence to the real finish
      else feDay = a.projEndOff;
      let fe = grain === "day" ? feDay : Math.floor(feDay / 7);
      if (!complete && late && todayUnit > fe) fe = todayUnit;   // overdue: project out to today
      const planned = sU(a);
      const step = a._stepMax ? `translateY(${(a._step - a._stepMax / 2) * MS_STEP}px)` : undefined;
      const accent = late ? "#C0392B" : (S.theme === "dark" ? "#F0C552" : "#E0A106");
      const chip = late ? `${a.delayDays || a.totalShift}d late` : `forecast +${a.totalShift}d`;
      const showSlip = hasSlip && fe > planned && fe >= 0 && planned < cols;
      if (showSlip) {
        const gs = Math.max(0, planned), ge = Math.min(cols - 1, fe);
        const N = ge - gs + 1; const h = (50 / N).toFixed(4);
        return <div className="lk-ms slip" style={{ gridColumn: `${gs + 1} / ${ge + 2}`, gridRow: row + 1, transform: step, position: "relative" }}>
          <span className="dia ghost" style={{ position: "absolute", left: `${h}%`, top: "50%", transform: "translate(-50%,-50%) rotate(45deg)" }} title={`Planned ${a.start}`} />
          <span className="ms-conn" style={{ position: "absolute", top: "50%", left: `calc(${h}% + 8px)`, right: `calc(${h}% + 8px)`, borderTopColor: accent, borderTopStyle: complete ? "solid" : "dashed" }} />
          <div className="ms-head" style={{ position: "absolute", left: `calc(${(100 - h).toFixed(4)}% - 6px)`, top: "50%", transform: "translateY(-50%)", cursor: movable ? "grab" : "pointer" }} draggable={movable} onDragStart={() => movable && (dragId.current = a.id)} onClick={() => setEditing({ ...a })}>
            <span className="dia" style={late ? { background: "#C0392B" } : { background: "transparent", border: `1.5px solid ${accent}` }} title={tipOf(a)} />
            <span className="mslbl2">{a.desc || "Milestone"}</span>
            <span className={"ms-chip " + (late ? "late" : "fore")} title={complete ? "Delivered late (recorded)" : (late ? "Overdue" : "Forecast slip")}>{chip}</span>
          </div>
        </div>;
      }
      return <div className="lk-ms" style={{ gridColumn: `${s + 1} / ${s + 2}`, gridRow: row + 1, transform: step }}
        draggable={movable} onDragStart={() => movable && (dragId.current = a.id)} onClick={() => setEditing({ ...a })}>
        <span className="dia" style={{ background: late ? "#C0392B" : lv.color }} title={tipOf(a)} />
        <span className="mslbl">{a.desc || "Milestone"}{hasSlip ? (late ? ` +${a.delayDays || a.totalShift}d` : ` (forecast +${a.totalShift}d)`) : ""}</span>
      </div>;
    }
    const constrained = a.open > 0 && a.status !== "complete";
    const spot = makeReady && constrained && a.startOff < mk;
    const dim = makeReady && !spot;
    // "Carried" = an open activity whose planned bar finished before this window starts, so its planned
    // span sits off-screen to the left. Anchor a labelled, clickable overdue bar at the left edge and run
    // it to the live end (today, or a predecessor-pushed projected finish). Forecast skips these to avoid
    // drawing the slip tail twice. Not engaged mid-resize.
    const carried = !rz && a.status !== "complete" && eU(a) < 0;
    if (carried) {
      let le = grain === "day" ? a.projEndOff : Math.floor(a.projEndOff / 7);
      if (a.delayed && todayUnit > le) le = todayUnit;
      s = 0; e = Math.min(cols - 1, Math.max(0, le));
    }
    const carriedHatch = a.delayed
      ? "repeating-linear-gradient(135deg,rgba(192,57,58,.30) 0 6px,rgba(192,57,58,.07) 6px 12px)"
      : "repeating-linear-gradient(135deg,rgba(224,161,6,.28) 0 6px,rgba(224,161,6,.06) 6px 12px)";
    const hasTail = !carried && !a.excuse && a.status !== "complete" && a.totalShift > 0 && (grain === "day" ? a.projEndOff : Math.floor(a.projEndOff / 7)) > eU(a);
    const tailLate = a.delayed && !a.excuse;
    return (
      <div className={"lk-ticket" + (constrained ? " constrained" : "") + (a.status === "complete" ? " complete" : "") + (dim ? " dim" : "") + (spot ? " spot" : "") + (!editable ? " ro" : "") + (rz ? " resizing" : "") + (carried ? " carried" : "")}
        style={{ gridColumn: `${s + 1} / ${e + 2}`, gridRow: row + 1, zIndex: rz ? 4 : 1, borderLeftColor: carried ? "#C0392B" : lv.color, background: carried ? carriedHatch : (a.status === "complete" ? "var(--card)" : (S.theme === "dark" ? "var(--card)" : tintOf(lv.color))), ...(carried ? { backgroundColor: S.theme === "dark" ? "rgba(192,57,58,.12)" : "rgba(192,57,58,.06)" } : {}), ...(hasTail ? { borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: `1px dashed ${tailLate ? "rgba(192,57,58,.85)" : "rgba(224,161,6,.85)"}` } : {}) }}
        draggable={movable && !rz} onDragStart={() => movable && (dragId.current = a.id)} onClick={() => setEditing({ ...a })} title={carried ? `Carried forward \u00b7 planned finish ${fmtISO(addDays(parseD(a.start), a.duration - 1))} \u00b7 ${tipOf(a)}` : tipOf(a)}>
        <div className="desc">{carried && <span title={`Slipped from w/c ${fmtWC(mondayOf(parseD(a.start)))}`} style={{ color: "#C0392B", marginRight: 4, fontWeight: 800 }}>{"\u25C2"}</span>}{a.desc || "Untitled activity"}</div>
        <div className="meta">
          <span className="dot" style={{ background: a.status === "complete" ? "#9AA6B2" : constrained ? "#E0A106" : "#0E9384" }} />
          {a.committed && <span className="lk-chip commit">will</span>}
          {a.witnessInvite && <span className="lk-chip wit" title="Witness invite">WIT</span>}
          {constrained && <span className="lk-chip cstr"><Icon n="alert" s={9} />{a.open}</span>}
          {a.delayed && !a.excuse && <span className="lk-chip late">+{a.delayDays}d</span>}
          {a.knockOn > 0 && a.status !== "complete" && <span className="lk-chip knock" title="Projected start pushed later by a predecessor">{"\u25B8+"}{a.knockOn}d</span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{S.laneBy === "company" ? locCode(a) : coName(a.companyId)}</span>
        </div>
        {grain === "day" && resizable(a) && <><div className="lk-rsz l" title="Drag to change the start" onMouseDown={(ev) => startResize(ev, a, "l")} /><div className="lk-rsz r" title="Drag to change the finish" onMouseDown={(ev) => startResize(ev, a, "r")} /></>}
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
    const startsAtPlanCol = s === Math.max(0, sU(a));
    const mLeft = startsAtPlanCol ? 16 : 2;
    return <div title="Actual progress" style={{ gridColumn: `${s + 1} / ${e + 2}`, gridRow: row + 1, alignSelf: "end", height: 5, margin: `0 2px 3px ${mLeft}px`, borderRadius: 3, background: "#0E9384", zIndex: 2, pointerEvents: "none" }} />;
  };

  const Forecast = ({ a, row }) => {
    if (a.isMilestone || a.status === "complete") return null;
    if (a.excuse) return null;
    if (eU(a) < 0) return null;   // carried: Ticket draws the whole overdue bar, so do not draw the tail twice
    const late = a.delayed;
    if (!late && a.totalShift <= 0) return null;   // amber forecast still needs a shift; a late tail draws whenever overdue
    let ee = grain === "day" ? a.projEndOff : Math.floor(a.projEndOff / 7);
    if (late && todayUnit > ee) ee = todayUnit;   // overdue: stretch the late tail out to today so the graphic matches the day count
    const ps = sU(a);
    if (ee < 0 || ps >= cols || ee <= eU(a)) return null;
    const s = Math.max(0, ps), e = Math.min(cols - 1, ee);
    if (e < s) return null;
    const dark = S.theme === "dark";
    const col = late ? (dark ? "#FCA89E" : "#C0392B") : (dark ? "#F0C552" : "#E0A106");
    const hatch = late
      ? "repeating-linear-gradient(135deg,rgba(192,57,58,.30) 0 6px,rgba(192,57,58,.07) 6px 12px)"
      : "repeating-linear-gradient(135deg,rgba(224,161,6,.28) 0 6px,rgba(224,161,6,.06) 6px 12px)";
    const badge = late ? `${a.delayDays || a.totalShift}d late` : `+${a.totalShift}d`;
    return <div title={late ? `Overdue: forecast to finish late` : `Forecast: projected to start ${a.totalShift} day${a.totalShift === 1 ? "" : "s"} later than plan`} style={{ gridColumn: `${s + 1} / ${e + 2}`, gridRow: row + 1, alignSelf: "stretch", margin: "0 2px", border: "1px solid var(--line)", borderLeft: 0, borderRadius: "0 12px 12px 0", background: hatch, display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 8px", zIndex: 0, pointerEvents: "none", overflow: "hidden" }}><span style={{ fontSize: 9.5, fontWeight: 700, color: col, whiteSpace: "nowrap", textShadow: dark ? "0 1px 2px rgba(0,0,0,.6)" : "none" }}>{badge}</span></div>;
  };

  const RescheduleTrail = ({ a, row }) => {
    const rs = a.reschedules || []; if (!rs.length) return null;
    const origOff = Math.round((parseD(rs[0].from) - anchor) / DAYMS);
    const dur = a.isMilestone ? 1 : Math.max(1, a.duration || 1);
    const oS = grain === "day" ? origOff : Math.floor(origOff / 7);
    const oE = grain === "day" ? origOff + dur - 1 : Math.floor((origOff + dur - 1) / 7);
    const cS = sU(a), cE = eU(a);
    const out = [];
    const inWin = (u) => u >= 0 && u < cols;
    if (a.isMilestone) {
      if (inWin(oS) && inWin(cS) && oS !== cS) { const gs = Math.min(oS, cS), ge = Math.max(oS, cS); const N = ge - gs + 1; const inset = `calc(${(50 / N).toFixed(4)}% + 8px)`; out.push(<div key="rt" style={{ gridColumn: `${gs + 1} / ${ge + 2}`, gridRow: row + 1, alignSelf: "center", position: "relative", height: 0, zIndex: 0, pointerEvents: "none" }} title={`Rescheduled from ${rs[0].from}`}><div style={{ position: "absolute", top: -1, left: inset, right: inset, borderTop: "2px dotted #C0392B" }} /></div>); }
    } else {
      let gapFrom, gapTo;
      if (cS > oE) { gapFrom = oE + 1; gapTo = cS - 1; } else if (cE < oS) { gapFrom = cE + 1; gapTo = oS - 1; }
      if (gapFrom != null && gapTo >= gapFrom) { const gs = Math.max(0, gapFrom), ge = Math.min(cols - 1, gapTo); if (ge >= gs) out.push(<div key="rt" style={{ gridColumn: `${gs + 1} / ${ge + 2}`, gridRow: row + 1, alignSelf: "center", position: "relative", height: 0, zIndex: 0, pointerEvents: "none" }} title={`Rescheduled from ${rs[0].from}`}><div style={{ position: "absolute", top: -1, left: -2, right: -2, borderTop: "2px dotted #C0392B" }} /></div>); }
    }
    if ((oS >= 0 && oS < cols) || (oE >= 0 && oE < cols)) {
      const gs = Math.max(0, oS), ge = Math.min(cols - 1, oE);
      if (a.isMilestone) out.push(<div key="gh" className="lk-ghost ms" style={{ gridColumn: `${gs + 1} / ${gs + 2}`, gridRow: row + 1 }} title={`Originally ${rs[0].from}`}><span className="dia" /></div>);
      else out.push(<div key="gh" className="lk-ghost bar" style={{ gridColumn: `${gs + 1} / ${ge + 2}`, gridRow: row + 1 }} title={`Originally ${rs[0].from}`} />);
    }
    return <>{out}</>;
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
        <button title="Constraints Log" className={page === "constraints" ? "on" : ""} onClick={() => setPage("constraints")}><Icon n="alert" s={20} /><span className="lbl">Constraints Log</span></button>
        <button title="Schedule" className={page === "schedule" ? "on" : ""} onClick={() => setPage("schedule")}><Icon n="gantt" s={20} /><span className="lbl">Schedule</span></button>
        <button title="Analytics" className={page === "reports" ? "on" : ""} onClick={() => setPage("reports")}><Icon n="chart" s={20} /><span className="lbl">Analytics</span></button>
        <button title="Weekly Cx Progress" className={page === "cx" ? "on" : ""} onClick={() => setPage("cx")}><Icon n="checkcircle" s={20} /><span className="lbl">Weekly Cx Progress</span></button>
        <button title="Help" className={page === "help" ? "on" : ""} onClick={() => setPage("help")}><Icon n="help" s={20} /><span className="lbl">Help</span></button>
        {isAdmin && <button title="Admin" className={page === "admin" ? "on" : ""} onClick={() => setPage("admin")}><Icon n="cog" s={20} /><span className="lbl">Admin</span></button>}
        <div className="lk-railppc" title="Open Analytics" onClick={() => setPage("reports")} style={{ marginTop: "auto", color: "#9aa7b8" }}>
          <div style={{ fontSize: 9, letterSpacing: ".1em" }}>PPC</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: ppcAll == null ? "#9aa7b8" : (ppcAll >= 80 ? "#34D399" : ppcAll >= 50 ? "#FBBF24" : "#F87171") }}>{ppcAll == null ? "\u2014" : ppcAll + "%"}</div>
        </div>
      </div></nav>
      <div className="lk-page">
      <div className="lk-bar">
        {brandLogo && <img className="lk-brandlogo" src={brandLogo} alt="" style={{ height: 28, maxWidth: 130, objectFit: "contain" }} />}
        {brandLogo && <span className="lk-branddiv" />}
        <div className="lk-brandid"><span className="lk-projname">{S.brand?.projectName || "FIN04"}</span><span className="lk-appname">{S.brand?.appName || "DLP"}</span></div>
        {(isSuper || projects.length > 1) && <div className="lk-switch">
          {swOpen && <div className="lk-switch-back" onClick={() => setSwOpen(false)} />}
          <button className="lk-switchbtn" onClick={() => setSwOpen((o) => !o)}>
            <span className="lk-switchdot" style={{ background: (projects.find((p) => p.id === selProj) || {}).accent || "var(--signal)" }} />
            <span>{(projects.find((p) => p.id === selProj) || {}).code || "Project"}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {swOpen && <div className="lk-switchmenu">
            <button className="lk-switchitem all" onClick={() => { setSwOpen(false); goPortal(); }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>All projects
            </button>
            <div className="lk-switchsep" />
            {projects.map((p) => <button key={p.id} className={"lk-switchitem" + (p.id === selProj ? " on" : "")} onClick={() => { setSwOpen(false); if (p.id !== selProj) enterProject(p.id); }}>
              <span className="lk-switchdot" style={{ background: p.accent }} /><span>{p.code}</span><span className="lk-switchsub">{p.name}</span>
            </button>)}
          </div>}
        </div>}
        <div className="lk-spacer" />
        <div className="lk-who">
          <button className="lk-btn icon" title={S.theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} onClick={() => update((p) => ({ ...p, theme: p.theme === "dark" ? "light" : "dark" }))}><Icon n={S.theme === "dark" ? "sun" : "moon"} s={15} /></button>
          <button className="lk-btn icon lk-notifbtn" title={notifTotal ? `${notifTotal} item${notifTotal === 1 ? "" : "s"} need your attention` : "Nothing needs your attention"} onClick={() => setNotifOpen(true)}><Icon n="mail" s={16} />{notifTotal > 0 && <span className="lk-notifbadge">{notifTotal > 99 ? "99+" : notifTotal}</span>}</button>
          <span style={{ fontWeight: 600 }}>{cu.name}</span>
          {cu.role === "admin" ? <span className="lk-pill admin">Admin</span> : (coLogo(cu.companyId) ? <img className="lk-colead" src={coLogo(cu.companyId)} alt={coName(cu.companyId)} title={coName(cu.companyId)} /> : <span className="lk-pill member">{coName(cu.companyId)}</span>)}
          <button className="lk-btn" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>
      {page === "board" && <div className="lk-boardpage">
      <div className="lk-toolbar">
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
        {isAdmin && <select className="lk-wsel" value={S.settings.weeks} title="Lookahead window length (project setting; also in Admin -> Lookahead)" onChange={(e) => update((p) => ({ ...p, settings: { ...p.settings, weeks: Number(e.target.value) } }), { action: "Change setting", detail: `Lookahead ${e.target.value} weeks` })}>
          {[2, 4, 6, 8, 12].map((w) => <option key={w} value={w}>{w}-week</option>)}
        </select>}
        {S.view === "swimlane" && <div className="lk-seg">
          {[["company", "Company"], ...(S.areas.length > 1 ? [["area", "Building"]] : []), ["subarea", "Level"], ["tier3", "Zone"], ["level", "Cx Stage"]].map(([k, l]) => (
            <button key={k} className={S.laneBy === k ? "sel" : ""} onClick={() => update((p) => ({ ...p, laneBy: k }))}>{l}</button>))}
        </div>}
        <button className={"lk-btn pill" + (makeReady ? " on" : "")} onClick={() => setMakeReady((v) => !v)}><Icon n="cross" s={14} />Make-ready</button>
        <button className={"lk-btn pill" + (ytt ? " on" : "")} title="YTT Focus: yesterday, today and tomorrow with open constraints" onClick={() => setYtt((v) => !v)}><Icon n="cross" s={14} />YTT</button>
        <button className={"lk-btn pill" + (witSched ? " on" : "")} title="Witness Schedule: witnessable activities for the selected period, with open constraints" onClick={() => setWitSched((v) => !v)}><Icon n="cal" s={14} />Witness Schedule</button>
        <div className="lk-spacer" />
        <button className="lk-btn" onClick={() => setShowImport(true)}><Icon n="upload" s={14} />Import</button>
        <button className="lk-btn" onClick={exportActivities}><Icon n="download" s={14} />Export</button>
        <button className="lk-btn primary" onClick={() => newActivity()}><Icon n="plus" s={15} />Activity</button>
      </div>

      <div className="lk-metrics">
        <div className="lk-metric clickable" onClick={() => setMetricDrill({ title: "In Lookahead", items: inWindow })}><span className="v">{inWindow.length}</span><span className="l">In lookahead</span></div>
        <div className="lk-metric clickable" onClick={() => setMetricDrill({ title: "Ready To Run", items: ready })}><span className="v" style={{ color: "#0E9384" }}>{ready.length}</span><span className="l">Ready to run</span></div>
        <div className="lk-metric clickable" onClick={() => setMetricDrill({ title: "Need Make-Ready", items: needMR })}><span className="v" style={{ color: "#D97706" }}>{needMR.length}</span><span className="l">Need make-ready</span><span className="sub">{urgentMR.length} within {mk}d</span></div>
        <div className="lk-metric clickable" onClick={() => setMetricDrill({ title: "Committed This Week", items: committedWk })}><span className="v" style={{ color: "var(--accent)" }}>{committedWk.length}</span><span className="l">Committed this week</span></div>
        <div className="lk-metric clickable" onClick={() => setMetricDrill({ title: "Delayed", items: delayedList })}><span className="v" style={{ color: "#C0392B" }}>{delayedList.length}</span><span className="l">Delayed</span></div>
        <div className="lk-metric clickable" onClick={() => setMetricDrill({ title: "At Risk", items: atRiskList })}><span className="v" style={{ color: "#E0A106" }}>{atRiskList.length}</span><span className="l">At risk</span><span className="sub">predecessor knock-on</span></div>
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
          const effEndU = (a) => { let e = eU(a); if (a.status === "complete") return e; if (!a.excuse && (a.delayed || a.totalShift > 0)) { let ee = grain === "day" ? a.projEndOff : Math.floor(a.projEndOff / 7); if (a.delayed && todayUnit > ee) ee = todayUnit; if (ee > e) e = ee; } return e; };
          const rows = []; la.forEach((a) => { const su = sU(a), eu = effEndU(a); let r = rows.findIndex((end) => end < su); if (r < 0) { r = rows.length; rows.push(eu); } else rows[r] = eu; a._row = r; a._step = 0; a._stepMax = 0; });
          const msByRow = {}; la.forEach((a) => { if (a.isMilestone) (msByRow[a._row] = msByRow[a._row] || []).push(a); });
          Object.keys(msByRow).forEach((k) => { const ms = msByRow[k].sort((x, y) => sU(x) - sU(y)); let prev = -99, lvl = 0, mx = 0; ms.forEach((a) => { const su = sU(a); lvl = (su - prev <= 3) ? (lvl + 1) % 4 : 0; a._step = lvl; if (lvl > mx) mx = lvl; prev = su; }); ms.forEach((a) => { a._stepMax = mx; }); });
          const sw = S.laneBy === "level" ? lvOf(LV, lane).color : "var(--muted)";
          const co = S.laneBy === "company" ? S.companies.find((c) => c.name === lane) : null;
          const laneLogo = pickLogo(co);
          return (
            <div key={lane} className="lk-lane" style={{ gridTemplateColumns: gridCols, minWidth: minW }}>
              <div className="lk-llbl">{!laneLogo && <span className="sw" style={{ background: sw }} />}
                <div style={{ minWidth: 0 }}>{laneLogo && <img className="lk-lanelogo" src={laneLogo} alt={lane} style={{ cursor: co ? "pointer" : "default" }} title={co ? "Company role & scope" : undefined} onClick={() => co && setCompanyInfo(co)} />}<div className="lanenm">{S.laneBy === "level" ? `${lane} · ${lvOf(LV, lane).name}` : lane}</div><div className="cnt mono">{la.length} act</div></div></div>
              <div className="lk-track" style={{ gridColumn: `2 / span ${DAYS}` }}>
                <Underlay lane={lane} />
                <div className="lk-tk" style={{ gridTemplateColumns: `repeat(${cols},1fr)`, gridTemplateRows: (rows.length ? rows : [0]).map((_, r) => { const mx = la.reduce((m, a) => (a._row === r && a._stepMax > m ? a._stepMax : m), 0); return `minmax(${48 + mx * MS_STEP}px,auto)`; }).join(" ") }}>
                  {la.map((a) => <Forecast key={"fc" + a.id} a={a} row={a._row} />)}                  {la.map((a) => <RescheduleTrail key={"rt" + a.id} a={a} row={a._row} />)}
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
                  <Forecast a={a} row={0} />                  <RescheduleTrail a={a} row={0} />
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
        <span className="it"><span style={{ height: 11, width: 18, borderRadius: "0 4px 4px 0", border: "1px solid #C0392B", borderLeft: 0, background: "repeating-linear-gradient(135deg,rgba(192,57,58,.30) 0 5px,rgba(192,57,58,.07) 5px 10px)" }} />delayed</span>
        <span className="it"><span style={{ height: 11, width: 18, borderRadius: "0 4px 4px 0", border: "1px solid #E0A106", borderLeft: 0, background: "repeating-linear-gradient(135deg,rgba(224,161,6,.28) 0 5px,rgba(224,161,6,.06) 5px 10px)" }} />forecast (knock-on)</span>
      </div>
      </div>}
      {page === "table" && <TablePage S={S} cu={cu} isAdmin={isAdmin} canEdit={canEdit} update={update} coName={coName} />}
      {page === "schedule" && <SchedulePage S={S} coName={coName} onOpen={(a) => { setPage("board"); setEditing({ ...a }); }} />}
      {page === "constraints" && <ConstraintsPage S={S} update={update} canEdit={canEdit} coName={coName} onOpen={(a) => { setPage("board"); setEditing({ ...a }); }} />}
      {page === "reports" && <ReportsPage S={S} LV={LV} coName={coName} exportActivities={exportActivities} exportWitness={exportWitness} markWitnessSent={markWitnessSent} isAdmin={isAdmin} by={cu.name} projectId={selProj} onOpen={(a) => { setPage("board"); setEditing({ ...a }); }} />}
      {page === "admin" && isAdmin && <AdminPanel S={S} cu={cu} update={update} exportActivities={exportActivities} />}
      {page === "cx" && <CxProgressPage projectId={selProj} isAdmin={isAdmin} theme={S.theme} cu={cu} reportButton={<WeeklyReportLauncher S={S} LV={LV} coName={coName} by={cu.name} isAdmin={isAdmin} projectId={selProj} label="Weekly Report" variant="cx" />} />}
      {page === "help" && <HelpPage dark={S.theme === "dark"} admin={cu.role === "admin" || isSuper} brandLogo={brandLogo} proj={(() => { const sp = projects.find((p) => p.id === selProj) || {}; return { code: sp.code || S.brand?.projectName || "", client: sp.client || "", location: sp.location || "" }; })()} />}
      <div className="lk-foot">DLP by QMC Cx Software Solutions{"\u2122"} {"\u00B7"} {"\u00A9"} {new Date().getFullYear()} Quantum Mission Critical. All rights reserved.</div>
      </div>
      </div>

      {editing && <Drawer act={editing} S={S} canEdit={canEdit(editing)} isAdmin={isAdmin} by={cu.name} clientViewer={isClientViewer} inviteForMe={myInviteFor(editing.id)} onRequestInvite={requestInvite} onAdd={addOption} onSave={saveActivity} onClose={() => setEditing(null)} onDelete={removeActivity} />}
      {metricDrill && <DrillModal title={metricDrill.title} items={metricDrill.items} S={S} LV={LV} coName={coName} onOpen={(a) => { setMetricDrill(null); setEditing({ ...a }); }} onClose={() => setMetricDrill(null)} />}
      {notifOpen && (() => {
        const seen = {}; const byAct = [];
        myConstraints.forEach(({ a, c }) => { if (!seen[a.id]) { seen[a.id] = { a, cons: [] }; byAct.push(seen[a.id]); } seen[a.id].cons.push(c); });
        return <div className="lk-modal-bg" onClick={() => setNotifOpen(false)}>
          <div className="ytt drill" style={{ ...cssVars(S.theme), maxWidth: 470 }} onClick={(e) => e.stopPropagation()}>
            <div className="ytt-head">
              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}><Icon n="mail" s={17} /><h3 style={{ margin: 0, fontSize: 15.5 }}>Notifications</h3><span className="ytt-sub">{[notifCount ? `${notifCount} open constraint${notifCount === 1 ? "" : "s"}` : "", pendingInvites.length ? `${pendingInvites.length} invite request${pendingInvites.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" \u00b7 ") || "Nothing right now"}</span></div>
              <button className="lk-btn icon" onClick={() => setNotifOpen(false)}><Icon n="x" /></button>
            </div>
            <div className="ytt-list" style={{ maxHeight: "70vh", overflow: "auto" }}>
              {pendingInvites.map((r) => { const a = (S.activities || []).find((x) => x.id === r.activityId); return <div key={r.id} className="ytt-card" style={{ borderLeftColor: "var(--accent)" }}>
                  <div className="ytt-card-desc" onClick={() => { if (a) { setNotifOpen(false); setPage("board"); setEditing({ ...a }); } }}>{"\u2709 "}{(a && a.desc) || r.desc || "Untitled"}</div>
                  <div className="ytt-card-meta">
                    <span className="dot" style={{ background: "var(--accent)" }} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{r.requesterName || "Someone"} requests this invite</span>
                    <span className="ytt-loc">{r.requesterEmail || ""}{r.location ? <> {"\u00b7"} {r.location}</> : ""}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}><button className="lk-btn primary" onClick={() => markInviteForwarded(r.id)}><Icon n="check" s={14} />Mark Forwarded</button></div>
                </div>; })}
              {byAct.length === 0 && pendingInvites.length === 0 ? <div className="ytt-empty" style={{ padding: 16 }}>Nothing needs your attention right now.</div>
                : byAct.map(({ a, cons }) => { const lv = lvOf(LV, a.level); return <div key={a.id} className="ytt-card" style={{ borderLeftColor: lv.color }}>
                    <div className="ytt-card-desc" onClick={() => { setNotifOpen(false); setPage("board"); setEditing({ ...a }); }}>{a.isMilestone ? "\u25C6 " : ""}{a.desc || "Untitled"}</div>
                    <div className="ytt-card-meta">
                      <span className="dot" style={{ background: "#E0A106" }} />
                      {a.committed && <span className="lk-chip commit">will</span>}
                      {a.witnessInvite && <span className="lk-chip wit">WIT</span>}
                      <span className="ytt-loc">{coName(a.companyId)} {"\u00b7"} {locCode(a)}</span>
                    </div>
                    <div className="ytt-cons">{cons.map((c) => { const over = c.due && c.due < fmtISO(new Date()); return <label key={c.id} className="ytt-con">
                        <input type="checkbox" checked={false} onChange={() => acknowledgeConstraint(a.id, c.id)} title="Acknowledge / mark cleared" />
                        <span>{c.text}{c.owner ? <span className="ytt-meta2"> {"\u00b7"} {c.owner}</span> : ""}{c.due ? <span className={over ? "ytt-due" : "ytt-meta2"}> {"\u00b7"} need {c.due}</span> : ""}</span>
                      </label>; })}</div>
                  </div>; })}
            </div>
          </div>
        </div>;
      })()}
      {companyInfo && <CompanyModal co={companyInfo} logo={pickLogo(companyInfo)} S={S} onClose={() => setCompanyInfo(null)} />}
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
      {page === "board" && witSched && (() => {
        const DAYW = { "1w": 7, "2w": 14, "4w": 28 };
        const startToday = todayMid();
        const periodEnd = witPeriod === "all" ? Infinity : startToday + ((DAYW[witPeriod] || 28) + 1) * DAYMS;
        const durLabel = (m) => m === 240 ? "Half day" : m === 480 ? "Full day" : (m || 60) + " min";
        const list = (S.activities || [])
          .filter((a) => a.witnessInvite && a.witnessAt)
          .map((a) => ({ a, t: new Date(a.witnessAt).getTime(), open: (a.constraints || []).filter((c) => !c.done) }))
          .filter((x) => !isNaN(x.t) && x.t >= startToday && (periodEnd === Infinity || x.t < periodEnd))
          .sort((x, y) => x.t - y.t);
        const periodOpts = [["1w", "This week"], ["2w", "Next 2 weeks"], ["4w", "Next 4 weeks (lookahead)"], ["all", "All upcoming"]];
        return (
          <div className="lk-bg" onClick={() => setWitSched(false)}>
            <div className="ytt" style={{ ...cssVars(S.theme), width: "min(720px,96vw)" }} onClick={(e) => e.stopPropagation()}>
              <div className="ytt-head">
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Icon n="cal" s={18} /><h3 style={{ margin: 0, fontSize: 16 }}>Witness Schedule</h3><span className="ytt-sub">Activities marked for witness in the selected period, with open constraints.</span></div>
                <button className="lk-btn icon" onClick={() => setWitSched(false)}><Icon n="x" /></button>
              </div>
              <div className="wsch-period">
                Period
                <select value={witPeriod} onChange={(e) => setWitPeriod(e.target.value)}>{periodOpts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <span style={{ marginLeft: "auto" }}>{list.length} witness point{list.length === 1 ? "" : "s"}</span>
              </div>
              <div className="wsch-list">
                {list.length === 0 ? <div className="ytt-empty" style={{ textAlign: "center", padding: 18 }}>No witness activities in this period.</div> :
                  list.map(({ a, open }) => { const lv = lvOf(LV, a.level); const d = new Date(a.witnessAt);
                    return <div key={a.id} className="wsch-card" style={{ borderLeftColor: lv.color, gridTemplateColumns: isClientViewer ? "118px 1fr auto" : undefined }}>
                      <div className="wsch-when">
                        <span className="wsch-day">{d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}</span>
                        <span className="wsch-time">{String(d.getHours()).padStart(2, "0")}:{String(d.getMinutes()).padStart(2, "0")}</span>
                        <span className="wsch-durpill">{durLabel(a.witnessDurationMin)}</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="wsch-name" onClick={() => { setWitSched(false); setEditing({ ...a }); }}>{a.isMilestone ? "\u25C6 " : ""}{a.desc || "Untitled"}</div>
                        <div className="wsch-meta">
                          <span className="lk-chip wit">WIT</span>
                          {(a.discipline || []).map((dd) => <span key={dd} className="lk-chip" style={{ background: "var(--chipbg)" }}>{dd}</span>)}
                          <span className="ytt-loc">{coName(a.companyId)} {"\u00b7"} {locCode(a)}</span>
                        </div>
                        {open.length > 0
                          ? <><div className="wsch-conhdr">{open.length} open constraint{open.length === 1 ? "" : "s"}</div>
                              {open.map((c) => <div key={c.id} className="wsch-con"><span className="cdot" /><span>{c.text}{c.owner ? <span className="ytt-meta2"> {"\u00b7"} {c.owner}</span> : ""}{c.due ? <span className="ytt-due"> {"\u00b7"} need {c.due}</span> : ""}</span></div>)}</>
                          : <div className="ytt-ready">No open constraints</div>}
                      </div>
                      {isClientViewer && (() => { const r = myInviteFor(a.id); return <div style={{ alignSelf: "center" }}>{r
                        ? <button className="lk-btn" disabled title="Already requested">{r.status === "forwarded" ? "Invite Forwarded" : "Invite Requested"}</button>
                        : <button className="lk-btn primary" onClick={() => requestInvite(a)}><Icon n="mail" s={14} />Request Invite</button>}</div>; })()}
                    </div>; })}
              </div>
            </div>
          </div>);
      })()}
    </div>);
}

function cssVars(theme) { const t = THEMES[theme] || THEMES.light; return { "--ink": t.ink, "--paper": t.paper, "--card": t.card, "--line": t.line, "--muted": t.muted, "--accent": t.accent, "--weekend": t.weekend, "--todcell": t.todcell, "--todhead": t.todhead, "--todedge": t.todedge, "--hover": t.hover, "--chipbg": t.chipbg, "--cal-invert": theme === "dark" ? "1" : "0" }; }

function OwnerField({ value, ownerType, ownerId, companies, users, onChange, style, placeholder, dis }) {
  const [open, setOpen] = useState(false);
  const v = value || "";
  const at = v.lastIndexOf("@");
  const showing = open && at >= 0;
  const q = showing ? v.slice(at + 1).toLowerCase().trim() : "";
  const opts = showing ? [
    ...(companies || []).filter((c) => c.name.toLowerCase().includes(q)).map((c) => ({ type: "company", id: c.id, name: c.name })),
    ...(users || []).filter((u) => (u.name || "").toLowerCase().includes(q)).map((u) => ({ type: "user", id: u.id, name: u.name })),
  ].slice(0, 8) : [];
  const pick = (o) => { onChange(o.name, o.type, o.id); setOpen(false); };
  return <div style={{ position: "relative", ...style }}>
    <input className="lk-in" style={{ width: "100%", fontSize: 11.5, padding: "4px 7px" }} placeholder={placeholder || "Owner (type @ to assign)"} value={v} disabled={dis}
      onChange={(e) => { const t = e.target.value; onChange(t, "", null); setOpen(t.lastIndexOf("@") >= 0); }}
      onFocus={() => setOpen(v.lastIndexOf("@") >= 0)} onBlur={() => setTimeout(() => setOpen(false), 160)} />
    {showing && opts.length > 0 && <div className="lk-ment">
      {opts.map((o) => <div key={o.type + o.id} className="lk-ment-i" onMouseDown={(e) => { e.preventDefault(); pick(o); }}>
        <Icon n={o.type === "company" ? "office" : "person"} s={13} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span><span className="lk-ment-tag">{o.type === "company" ? "Company" : "Person"}</span>
      </div>)}
    </div>}
  </div>;
}

function Drawer({ act, S, canEdit, isAdmin, by, clientViewer, inviteForMe, onRequestInvite, onAdd, onSave, onClose, onDelete }) {
  const [a, setA] = useState(act);
  const [tab, setTab] = useState("details");
  const [exReason, setExReason] = useState("");
  const [exNote, setExNote] = useState("");
  const [rsDate, setRsDate] = useState("");
  const [rsReason, setRsReason] = useState("");
  const [addKind, setAddKind] = useState(null);
  const [addText, setAddText] = useState("");
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [auditRows, setAuditRows] = useState([]);
  const [confirmDel, setConfirmDel] = useState(false);
  const [cText, setCText] = useState("");
  const [cOwner, setCOwner] = useState("");
  const [cOwnerType, setCOwnerType] = useState("");
  const [cOwnerId, setCOwnerId] = useState(null);
  const [cDue, setCDue] = useState("");
  const [assetQ, setAssetQ] = useState("");
  const [assetOpen, setAssetOpen] = useState(false);
  const setC = (id, k, v) => set("constraints", a.constraints.map((x) => x.id === id ? { ...x, [k]: v } : x));
  const locked = a.status === "complete" && !isAdmin;
  const set = (k, v) => { if (!canEdit || locked) return; setA((p) => ({ ...p, [k]: v })); };
  const setReason = (v) => { if (!canEdit) return; setA((p) => ({ ...p, slipReason: v })); };
  const isNew = !act.desc && act.constraints.length === 0;
  const doReschedule = () => { if (!isAdmin || !rsDate || !rsReason.trim() || rsDate === a.start) return; setA((p) => ({ ...p, start: rsDate, reschedules: [...(p.reschedules || []), { from: p.start, to: rsDate, at: fmtISO(new Date()), by: by || "", reason: rsReason.trim() }] })); setRsDate(""); setRsReason(""); };
  const addC = () => { if (!cText.trim()) return; set("constraints", [...a.constraints, { id: uid("c"), text: cText.trim(), done: false, owner: cOwner.trim(), ownerType: cOwnerType, ownerId: cOwnerId, due: cDue }]); setCText(""); setCOwner(""); setCOwnerType(""); setCOwnerId(null); setCDue(""); };
  const dis = !canEdit || locked;
  const assetTags = parseAssetField(a.asset);
  const assetDerived = deriveFromAssets(assetTags);
  const hasKnownAsset = assetTags.some((t) => ASSET_BY_TAG[t]);
  const applyAssets = (tags) => {
    if (!canEdit || locked) return;
    const known = tags.some((t) => ASSET_BY_TAG[t]);
    const d = deriveFromAssets(tags);
    setA((p) => ({ ...p, asset: joinAssetField(tags), area: known ? d.area : p.area, subArea: known ? d.subArea : p.subArea, tier3: known ? d.tier3 : p.tier3, system: known ? d.system : p.system }));
  };
  const toggleAsset = (tag) => { const has = assetTags.includes(tag); applyAssets(has ? assetTags.filter((t) => t !== tag) : [...assetTags, tag]); };
  const lockB = hasKnownAsset && !!assetDerived.area;
  const lockL = hasKnownAsset && !!assetDerived.subArea;
  const lockZ = hasKnownAsset && !!assetDerived.tier3;
  const lockS = hasKnownAsset && !!assetDerived.system;
  const assetMatches = (() => { const q = assetQ.trim().toLowerCase(); if (!assetOpen) return []; let list = ASSETS; if (q) list = ASSETS.filter((x) => x.tag.toLowerCase().includes(q) || x.name.toLowerCase().includes(q) || x.type.toLowerCase().includes(q)); return list.slice(0, 50); })();
  const roBox = (v) => (<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "var(--ink)" }}><span>{v || "--"}</span><span style={{ fontSize: 9.5, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 6, padding: "1px 6px", whiteSpace: "nowrap" }}>from asset</span></div>);
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
  if (!a.start) missing.push("planned start");
  if (a.witnessInvite && !a.witnessAt) missing.push("witness date & time");
  if (a.witnessInvite && !(a.discipline || []).length) missing.push("discipline");
  if (a.witnessInvite && !a.witnessDurationMin) missing.push("witness duration");
  const incomplete = missing.length > 0;
  // predecessor options: exclude self and anything downstream of this activity (prevents cycles)
  const descend = new Set();
  (function walk(id) { (S.activities || []).forEach((x) => { if ((x.predecessors || []).includes(id) && !descend.has(x.id)) { descend.add(x.id); walk(x.id); } }); })(a.id);
  const predOptions = (S.activities || []).filter((x) => x.id !== a.id && !descend.has(x.id) && !(a.predecessors || []).includes(x.id));
  const predLabel = (id) => { const x = (S.activities || []).find((p) => p.id === id); return x ? `#${x.code ?? "?"} ${x.desc || "Untitled"}` : "(removed)"; };
  return (
    <div className="lk-bg"><style>{css}</style>
      <div className="lk-drawer" style={cssVars(S.theme)} onClick={(e) => e.stopPropagation()}>
        <div className="lk-dh"><h3>{isNew ? "New Activity" : canEdit ? "Edit Activity" : "Activity (View Only)"}</h3><button className="lk-btn icon" onClick={onClose}><Icon n="x" /></button></div>
        <div className="lk-db">
          {!canEdit && <div className="lk-pv" style={{ borderRadius: 8, border: "1px solid var(--line)" }}><Icon n="alert" s={13} />This activity belongs to another company. You can view it but not change it.</div>}
          <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
            {[["details", "Details"], ["schedule", "Schedule"], ["ready", "Readiness"]].concat(isAdmin && !isNew ? [["delay", "Delay"]] : []).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex: 1, fontFamily: "inherit", fontSize: 12, fontWeight: 650, padding: "8px 6px", borderRadius: "8px 8px 0 0", cursor: "pointer", borderWidth: 1, borderStyle: "solid", borderColor: tab === k ? "var(--line)" : "transparent", borderBottom: 0, background: tab === k ? "var(--card)" : "transparent", color: tab === k ? "var(--ink)" : "var(--muted)" }}>
                {l}{k === "delay" && !a.excuse && (a.delayed || a.totalShift > 0) ? <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#F87171", marginLeft: 5, verticalAlign: "middle" }} /> : null}
              </button>))}
          </div>
          {tab === "details" && <>
          <div className="lk-f"><label>What is the activity{a.code != null ? <span style={{ fontWeight: 400, color: "var(--muted)" }}> &middot; #{a.code}</span> : null}</label><input className="lk-in" value={a.desc} disabled={dis} placeholder="e.g. UPS module SAT" autoFocus onChange={(e) => set("desc", e.target.value)} /></div>
          <div className="lk-row">
            <div className="lk-f"><label>Company (Performing)</label>
              <select className="lk-select" value={a.companyId || ""} disabled={dis || !isAdmin} onChange={(e) => { if (e.target.value === "__add__") { setAddText(""); setAddKind("company"); } else set("companyId", e.target.value); }}>
                {S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}{isAdmin && !dis && ADD_OPT}
              </select>{!isAdmin && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>Members add only for their own company.</span>}
              {renderAdd("company", "New company name", {})}</div>
            <div className="lk-f"><label>Building</label>
              {lockB ? roBox(a.area) : <><select className="lk-select" value={a.area} disabled={dis || !isAdmin} onChange={(e) => { set("area", e.target.value); set("subArea", ""); set("tier3", ""); }}>
                <option value="">--</option>{S.areas.map((x) => <option key={x}>{x}</option>)}</select>
              {!isAdmin && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>Building is fixed for the project.</span>}</>}</div>
          </div>
          <div className="lk-f"><label>Level</label>
            {lockL ? roBox(a.subArea) : <><select className="lk-select" value={a.subArea || ""} disabled={dis || !a.area} onChange={(e) => { if (e.target.value === "__add__") { setAddText(""); setAddKind("subArea"); } else { set("subArea", e.target.value); set("tier3", ""); } }}>
              <option value="">--</option>{(S.subAreas || []).filter((s) => s.area === a.area).map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}{isAdmin && !dis && a.area && ADD_OPT}</select>
            {!isAdmin && a.area && (S.subAreas || []).filter((s) => s.area === a.area).length === 0 && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>No levels defined for {a.area}.</span>}
            {renderAdd("subArea", "New level name", { area: a.area })}</>}</div>
          <div className="lk-f"><label>Zone / Room</label>
            {lockZ ? roBox(a.tier3) : <><select className="lk-select" value={a.tier3 || ""} disabled={dis || !a.subArea} onChange={(e) => { if (e.target.value === "__add__") { setAddText(""); setAddKind("tier3"); } else set("tier3", e.target.value); }}>
              <option value="">--</option>{(S.tier3s || []).filter((t) => t.area === a.area && t.subArea === a.subArea).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}{isAdmin && !dis && a.subArea && ADD_OPT}</select>
            {!isAdmin && a.subArea && (S.tier3s || []).filter((t) => t.area === a.area && t.subArea === a.subArea).length === 0 && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>No zones or rooms defined for {a.subArea}.</span>}
            {renderAdd("tier3", "New zone / room name", { area: a.area, subArea: a.subArea })}</>}</div>
          <div className="lk-f"><label>Discipline{a.witnessInvite && <span style={{ color: "#C0392B" }}> *</span>}</label>
            <div className="lk-levels">{DISCIPLINES.map((d) => { const on = (a.discipline || []).includes(d); return <div key={d} className={"lk-lvl" + (on ? " sel" : "")} onClick={() => { if (dis) return; const cur = a.discipline || []; set("discipline", on ? cur.filter((x) => x !== d) : [...cur, d]); }}>{d}</div>; })}</div>
            {a.witnessInvite && !(a.discipline || []).length && <span style={{ fontSize: 11, color: "#C0392B" }}>Select at least one discipline so the witness invite has recipients.</span>}</div>
          <div className="lk-f"><label>System</label>
            {lockS ? roBox(a.system) : <><select className="lk-select" value={a.system} disabled={dis} onChange={(e) => { if (e.target.value === "__add__") { setAddText(""); setAddKind("system"); } else set("system", e.target.value); }}>
              <option value="">--</option>{S.systems.map((x) => <option key={x}>{x}</option>)}{isAdmin && !dis && ADD_OPT}</select>
            {renderAdd("system", "New system name", {})}</>}</div>
          <div className="lk-f"><label>Asset (Optional)</label>
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", minHeight: 40, opacity: dis ? 0.6 : 1 }} onClick={() => { if (!dis) { const el = document.getElementById("assetInp"); if (el) el.focus(); } }}>
                {assetTags.map((t) => { const known = ASSET_BY_TAG[t]; const lbl = t.split(".").slice(3).join(".") || t; return <span key={t} title={known ? known.name : "Not in register"} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(99,102,241,0.16)", border: "1px solid rgba(99,102,241,0.4)", color: "#c9ccff", borderRadius: 7, padding: "3px 6px 3px 8px", fontSize: 11.5, fontFamily: "ui-monospace,Menlo,Consolas,monospace", opacity: known ? 1 : 0.75 }}>{lbl}{!dis && <span style={{ cursor: "pointer", color: "#9aa0e6", fontWeight: 700, padding: "0 2px" }} onClick={(e) => { e.stopPropagation(); toggleAsset(t); }}>×</span>}</span>; })}
                {!dis && <input id="assetInp" autoComplete="off" value={assetQ} placeholder={assetTags.length ? "Add another..." : "Search tag or equipment, e.g. UPS, CRAH, GY01..."} onFocus={() => setAssetOpen(true)} onBlur={() => setTimeout(() => setAssetOpen(false), 150)} onChange={(e) => { setAssetQ(e.target.value); setAssetOpen(true); }} style={{ flex: 1, minWidth: 130, background: "transparent", border: 0, outline: "none", color: "inherit", fontSize: 13, padding: "3px 2px" }} />}
              </div>
              {assetOpen && assetMatches.length > 0 && <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 5px)", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "0 18px 50px rgba(0,0,0,.5)", maxHeight: 260, overflow: "auto", zIndex: 40, padding: 5 }}>
                {assetMatches.map((x) => { const on = assetTags.includes(x.tag); return <div key={x.tag} onMouseDown={(e) => { e.preventDefault(); toggleAsset(x.tag); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 9px", borderRadius: 8, cursor: "pointer", background: on ? "rgba(99,102,241,0.12)" : "transparent" }}>
                  <span style={{ width: 15, height: 15, borderRadius: 4, flex: "0 0 auto", border: "1.5px solid var(--line)", background: on ? "var(--accent)" : "transparent", color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{on ? "\u2713" : ""}</span>
                  <span style={{ minWidth: 0 }}><span style={{ fontFamily: "ui-monospace,Menlo,Consolas,monospace", fontSize: 12 }}>{x.tag}</span><span style={{ display: "block", fontSize: 11, color: "var(--muted)" }}>{x.name}</span></span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap" }}>{x.type} &middot; {x.me}</span>
                </div>; })}
              </div>}
              {assetOpen && assetQ.trim() && assetMatches.length === 0 && <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 5px)", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", color: "var(--muted)", fontSize: 12, zIndex: 40 }}>No assets match "{assetQ}"</div>}
            </div>
            {hasKnownAsset && <span style={{ fontSize: 10.5, color: "var(--muted)", display: "block", marginTop: 5 }}>Location and System are set from the asset. Remove the asset to edit them by hand.</span>}</div>
          <div className="lk-f"><label>Cx Stage</label>
            <div className="lk-levels">{Object.entries(S.levels).map(([k, v]) => <div key={k} className={"lk-lvl" + (a.level === k ? " sel" : "")} onClick={() => set("level", k)}><span className="sw" style={{ background: v.color }} />{k}</div>)}</div></div>
          </>}
          {tab === "schedule" && <>
          <div className="lk-row">
            <div className="lk-f"><label>Start</label><input className="lk-in mono" type="date" value={a.start} disabled={dis} onChange={(e) => set("start", e.target.value)} /></div>
            <div className="lk-f"><label>Days (Calendar)</label><input className="lk-in mono" type="number" min="1" value={a.duration} disabled={dis} onChange={(e) => set("duration", Math.max(1, +e.target.value || 1))} />{a.start && a.duration >= 1 && <span style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>Ends {addDays(parseD(a.start), a.duration - 1).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · weekends counted</span>}</div>
          </div>
          {isAdmin && !isNew && <div className="lk-f" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon n="loader" s={13} />Reschedule <span style={{ fontWeight: 400, color: "var(--muted)" }}>(keeps the original date on record)</span></label>
            <div style={{ fontSize: 11, color: "var(--muted)", margin: "2px 0 8px" }}>Current planned start <span className="mono">{a.start}</span>. Moving it leaves a faded marker on the board with a red dotted line to the new date, and logs the change. The original is never overwritten.</div>
            <div className="lk-row">
              <div className="lk-f"><label>New date</label><input className="lk-in mono" type="date" value={rsDate} onChange={(e) => setRsDate(e.target.value)} /></div>
              <div className="lk-f"><label>Reason (required)</label><input className="lk-in" value={rsReason} placeholder="Why is it moving?" onChange={(e) => setRsReason(e.target.value)} /></div>
            </div>
            <button className="lk-btn primary" style={{ marginTop: 8 }} disabled={!rsDate || !rsReason.trim() || rsDate === a.start} onClick={doReschedule}><Icon n="loader" s={13} />Reschedule</button>
            {(a.reschedules || []).length > 0 && <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>Reschedule History</div>
              {(a.reschedules || []).map((r, i) => <div key={i} style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 6, fontSize: 11.5, padding: "3px 0", borderTop: i ? "1px solid var(--line)" : "none" }}><span className="mono">{r.from}</span><span style={{ color: "#C0392B" }}>{"\u2192"}</span><span className="mono">{r.to}</span><span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--muted)" }}>{r.by || "—"} · <span className="mono">{r.at}</span></span>{r.reason && <span style={{ flexBasis: "100%", fontSize: 10.5, color: "var(--muted)" }}>{r.reason}</span>}</div>)}
            </div>}
          </div>}
          <div className="lk-f"><label>Predecessors <span style={{ fontWeight: 400, color: "var(--muted)" }}>(this starts after these finish; a slip upstream pushes this forward)</span></label>
            {(a.predecessors || []).map((pid) => <div key={pid} className="lk-cstr"><span className="t">{predLabel(pid)}</span>{!dis && <button onClick={() => set("predecessors", a.predecessors.filter((x) => x !== pid))}><Icon n="trash" s={13} /></button>}</div>)}
            {(a.predecessors || []).length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>None. Not waiting on another activity.</div>}
            {!dis && predOptions.length > 0 && <div className="lk-add"><select className="lk-select" value="" onChange={(e) => { if (e.target.value) set("predecessors", [...(a.predecessors || []), e.target.value]); }}><option value="">Add a predecessor…</option>{predOptions.map((x) => <option key={x.id} value={x.id}>#{x.code ?? "?"} - {x.desc || "Untitled"}</option>)}</select></div>}
          </div>
          </>}
          {tab === "ready" && <>
          <div className="lk-f"><label>Constraints To Clear (Make-Ready)</label>
            {a.constraints.map((c) => <div key={c.id} className="lk-cstr2">
              <input type="checkbox" checked={c.done} disabled={dis} onChange={() => setC(c.id, "done", !c.done)} />
              <div className="cmain">
                <span className={"t" + (c.done ? " done" : "")}>{c.text}</span>
                {!dis && <div className="crow">
                  <OwnerField value={c.owner} ownerType={c.ownerType} ownerId={c.ownerId} companies={S.companies} users={S.users} dis={dis} style={{ flex: 1, minWidth: 100 }} onChange={(name, t, id) => set("constraints", a.constraints.map((x) => x.id === c.id ? { ...x, owner: name, ownerType: t, ownerId: id } : x))} />
                  <input className="lk-in mono" style={{ fontSize: 11.5, padding: "4px 7px", maxWidth: 150 }} type="date" title="Need-by date" value={c.due || ""} onChange={(e) => setC(c.id, "due", e.target.value)} />
                </div>}
                {dis && (c.owner || c.due) && <div className="crow" style={{ fontSize: 11, color: "var(--muted)" }}>{c.owner ? "Owner: " + c.owner : ""}{c.owner && c.due ? " \u00b7 " : ""}{c.due ? "need-by " + c.due : ""}</div>}
              </div>
              {!dis && <button onClick={() => set("constraints", a.constraints.filter((x) => x.id !== c.id))}><Icon n="trash" s={13} /></button>}
            </div>)}
            {a.constraints.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>No constraints. Reads as ready to run.</div>}
            {!dis && <div className="lk-add" style={{ flexWrap: "wrap" }}>
              <input className="lk-in" style={{ flex: "1 1 100%" }} placeholder="Add a constraint…" value={cText} onChange={(e) => setCText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addC()} />
              <OwnerField value={cOwner} ownerType={cOwnerType} ownerId={cOwnerId} companies={S.companies} users={S.users} style={{ flex: 1, minWidth: 100 }} placeholder="Owner (type @ to assign)" onChange={(name, t, id) => { setCOwner(name); setCOwnerType(t); setCOwnerId(id); }} />
              <input className="lk-in mono" style={{ maxWidth: 150 }} type="date" title="Need-by date (optional)" value={cDue} onChange={(e) => setCDue(e.target.value)} />
              <button className="lk-btn primary" title="Add constraint" onClick={addC}><Icon n="plus" s={15} /></button>
            </div>}</div>
          <div className={"lk-tog" + (a.committed ? " on" : "")} onClick={() => set("committed", !a.committed)}><span>Committed for this week <span style={{ fontWeight: 400, color: "var(--muted)" }}>(a reliable promise)</span></span><span className="lk-sw2" /></div>
          <div className={"lk-tog" + (a.witnessInvite ? " on" : "")} onClick={() => set("witnessInvite", !a.witnessInvite)}><span>Witness invite <span style={{ fontWeight: 400, color: "var(--muted)" }}>(client or third-party witness required)</span></span><span className="lk-sw2" /></div>
          {a.witnessInvite && <div className="lk-f"><label>Witness date &amp; time <span style={{ color: "#C0392B" }}>*</span></label>
            <input className="lk-in mono" type="datetime-local" value={a.witnessAt || ""} disabled={dis} onChange={(e) => set("witnessAt", e.target.value)} />
            {!a.witnessAt && <span style={{ fontSize: 11, color: "#C0392B" }}>A witness time is required before this activity can be saved.</span>}</div>}
          {a.witnessInvite && <div className="lk-f"><label>Witness duration <span style={{ color: "#C0392B" }}>*</span></label>
            <select className="lk-select" value={a.witnessDurationMin || 60} disabled={dis} onChange={(e) => set("witnessDurationMin", parseInt(e.target.value, 10))}>
              <option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option><option value={90}>90 min</option><option value={120}>120 min</option><option value={240}>Half day (4 h)</option><option value={480}>Full day (8 h)</option>
            </select>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Sets the invite end time (start + duration).</span></div>}
          {a.witnessInvite && (a.discipline || []).length > 0 && (() => { const rcp = witnessRecipients(a.discipline); return (
            <div className="lk-f"><label>Invite recipients <span style={{ fontWeight: 400, color: "var(--muted)", textTransform: "none", letterSpacing: 0 }}>(set by discipline)</span></label>
              <div style={{ border: "1px solid var(--line)", borderRadius: 8, background: "var(--card)", padding: "8px 10px", maxHeight: 170, overflow: "auto" }}>
                <div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 5 }}>Required ({rcp.to.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{rcp.to.length ? rcp.to.map((e) => <span key={e} style={{ fontSize: 11, fontFamily: "ui-monospace,Menlo,Consolas,monospace", background: "rgba(99,102,241,0.14)", border: "1px solid rgba(99,102,241,0.35)", color: "var(--ink)", borderRadius: 999, padding: "2px 8px" }}>{e}</span>) : <span style={{ fontSize: 11.5, color: "var(--muted)" }}>None for this discipline.</span>}</div>
                {rcp.cc.length > 0 && <><div style={{ fontSize: 10.5, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", margin: "8px 0 5px" }}>CC ({rcp.cc.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{rcp.cc.map((e) => <span key={e} style={{ fontSize: 11, fontFamily: "ui-monospace,Menlo,Consolas,monospace", background: "var(--chipbg)", border: "1px solid var(--line)", color: "var(--muted)", borderRadius: 999, padding: "2px 8px" }}>{e}</span>)}</div></>}
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>You are the organiser, added automatically, so you are not listed.</span></div>
          ); })()}
          </>}
          {tab === "details" && <>
          <div className={"lk-tog" + (a.isMilestone ? " on" : "")} onClick={() => set("isMilestone", !a.isMilestone)}><span>Milestone <span style={{ fontWeight: 400, color: "var(--muted)" }}>(a point in time, shown as a diamond)</span></span><span className="lk-sw2" /></div>
          </>}
          {tab === "schedule" && <>
          {locked && canEdit && <div className="lk-pv" style={{ borderRadius: 8, border: "1px solid var(--line)" }}><Icon n="alert" s={13} />Marked complete, so the fields are locked. Set the status back to In progress or Planned to edit them. The reason for non-completion can still be recorded.</div>}
          <div className="lk-f"><label>Status</label><div className="lk-status">{[["planned", "Planned"], ["in_progress", "In progress"], ["complete", "Complete"]].map(([k, l]) => <button key={k} className={a.status === k ? "sel" : ""} disabled={!canEdit} onClick={() => setA((p) => { const n = { ...p, status: k }; if (k === "in_progress" && !n.actualStart) n.actualStart = fmtISO(new Date()); if (k === "complete") { if (!n.actualStart) n.actualStart = fmtISO(new Date()); if (!n.actualFinish) n.actualFinish = fmtISO(new Date()); n.percent = 100; } else if (k === "planned") n.percent = 0; return n; })}>{l}</button>)}</div></div>
          <div className="lk-row">
            <div className="lk-f"><label>Actual Start</label><input className="lk-in mono" type="date" value={a.actualStart || ""} disabled={dis} onChange={(e) => set("actualStart", e.target.value)} /></div>
            <div className="lk-f"><label>Actual Finish</label><input className="lk-in mono" type="date" value={a.actualFinish || ""} disabled={dis} onChange={(e) => set("actualFinish", e.target.value)} /></div>
          </div>
          <div className="lk-f"><label>Percent complete</label><input className="lk-in mono" type="number" min="0" max="100" step="5" value={a.percent == null ? "" : a.percent} disabled={dis} placeholder={a.status === "complete" ? "100" : "0"} onChange={(e) => { const v = e.target.value; set("percent", v === "" ? null : Math.max(0, Math.min(100, Math.round(Number(v) || 0)))); }} />
            <span style={{ fontSize: 10.5, color: "var(--muted)" }}>Manual progress you set. Left blank it reads {a.status === "complete" ? "100" : "0"}% from the status.</span></div>
          {(() => { const ps = parseD(a.start), pf = addDays(ps, a.duration - 1); let d = null, lbl = ""; if (a.status === "complete" && a.actualFinish) { d = Math.round((parseD(a.actualFinish) - pf) / DAYMS); lbl = "Finish vs plan"; } else if (a.actualStart) { d = Math.round((parseD(a.actualStart) - ps) / DAYMS); lbl = "Start vs plan"; } if (d == null) return null; return <div style={{ fontSize: 12.5, fontWeight: 600, color: d > 0 ? "#C0392B" : "#0E9384" }}>{lbl}: {d > 0 ? "+" + d : d} day{Math.abs(d) === 1 ? "" : "s"} {d > 0 ? "late" : d < 0 ? "early" : "on plan"}</div>; })()}
          {(() => { const pf = addDays(parseD(a.start), a.duration - 1); const made = a.status === "complete" && (!a.actualFinish || parseD(a.actualFinish) <= pf); const miss = a.committed && !made && (pf.getTime() < todayMid() || (a.status === "complete" && a.actualFinish && parseD(a.actualFinish) > pf)); if (!miss) return null; return <div className="lk-f"><label>Reason for non-completion <span style={{ fontWeight: 400, color: "var(--muted)" }}>(this committed activity missed its promised finish)</span></label>
            <select className="lk-select" value={a.slipReason || ""} disabled={!canEdit} onChange={(e) => setReason(e.target.value)}>
              <option value="">-- record why it slipped --</option>{SLIP_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>; })()}
          </>}
          {tab === "details" && <>
          <div className="lk-f"><label>Notes / Comment</label>
            <textarea className="lk-in" value={a.notes || ""} disabled={dis} placeholder="Anything the team should know: access, sequencing, contacts, risks…" rows={3} style={{ resize: "vertical", minHeight: 60, fontFamily: "inherit" }} onChange={(e) => set("notes", e.target.value)} /></div>
          </>}
          {tab === "delay" && isAdmin && !isNew && (() => {
            const ps = parseD(a.start), pf = addDays(ps, Math.max(1, a.duration || 1) - 1);
            const lateStart = a.actualStart ? Math.round((parseD(a.actualStart) - ps) / DAYMS) : 0;
            const overdue = (a.status !== "complete" && pf.getTime() < todayMid()) ? Math.round((todayMid() - pf.getTime()) / DAYMS) : 0;
            const knock = a.knockOn || 0;
            const mag = a.delayDays != null ? a.delayDays : Math.max(0, lateStart, overdue);
            const flagged = mag > 0 || overdue > 0 || lateStart > 0 || a.totalShift > 0;
            const causes = [];
            if (overdue > 0) causes.push("Overdue: planned finish was " + pf.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " and the activity is not complete.");
            if (lateStart > 0) causes.push("Actual start was " + lateStart + " day" + (lateStart === 1 ? "" : "s") + " after the planned start.");
            if (knock > 0) causes.push("Pushed " + knock + " day" + (knock === 1 ? "" : "s") + " by a predecessor.");
            if (!causes.length && a.totalShift > 0) causes.push("Forecast to shift " + a.totalShift + " day" + (a.totalShift === 1 ? "" : "s") + " from a predecessor.");
            const box = { border: "1px solid var(--line)", borderRadius: 11, background: "var(--card)", padding: 13 };
            if (a.excuse) return <div style={box}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}><span style={{ fontWeight: 750, fontSize: 13.5 }}>Delay</span><span style={{ fontSize: 10, fontWeight: 800, borderRadius: 20, padding: "3px 9px", background: "rgba(14,147,132,.2)", color: "#34D399" }}>Excused</span></div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>This delay is excused, so it no longer shows as late on the board. Reason: <b style={{ color: "var(--ink)" }}>{a.excuse.reason}</b>.{a.excuse.note ? " " + a.excuse.note : ""}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>By {a.excuse.by || "\u2014"} on <span className="mono">{a.excuse.at}</span></div>
              {canEdit && <button className="lk-btn" style={{ marginTop: 11 }} onClick={() => setA((p) => { const n = { ...p }; delete n.excuse; return n; })}>Remove excuse</button>}
            </div>;
            if (!flagged) return <div style={{ ...box, color: "var(--muted)", textAlign: "center", padding: 22, fontSize: 12.5 }}>No delay. This activity is on plan.</div>;
            return <div style={box}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}><span style={{ fontWeight: 750, fontSize: 13.5 }}>Delay</span>{mag > 0 && <span style={{ fontSize: 10, fontWeight: 800, borderRadius: 20, padding: "3px 9px", background: "rgba(192,57,58,.22)", color: "#FCA89E" }}>{mag} day{mag === 1 ? "" : "s"} late</span>}</div>
              {causes.map((c, i) => <div key={i} style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, borderLeft: "2px solid #C0392B", padding: "2px 0 2px 9px", marginBottom: 8 }}>{c}</div>)}
              <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 4, marginBottom: 4 }}>Excuse this delay</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 9 }}>Keep the planned dates but clear the late flag, with a recorded reason. To move the plan instead, use Reschedule on the Schedule tab.</div>
              <div className="lk-f" style={{ marginBottom: 8 }}><label>Reason</label>
                <select className="lk-select" value={exReason} disabled={!canEdit} onChange={(e) => setExReason(e.target.value)}>
                  <option value="">-- choose a reason --</option>
                  {["Client agreed revised date", "Access / permit outside our control", "Weather", "Data correction", "Other"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select></div>
              <input className="lk-in" placeholder="Note (optional, shown in audit)" value={exNote} disabled={!canEdit} onChange={(e) => setExNote(e.target.value)} style={{ marginBottom: 10 }} />
              <button className="lk-btn primary" disabled={!canEdit || !exReason} onClick={() => { setA((p) => ({ ...p, excuse: { reason: exReason, note: exNote.trim(), by: by || "", at: fmtISO(new Date()) } })); setExReason(""); setExNote(""); }}>Excuse the delay</button>
            </div>;
          })()}
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
          {!isNew && (confirmDel
            ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 12.5, color: "#C0392B", fontWeight: 600 }}>Delete this activity?</span><button className="lk-btn" style={{ background: "#C0392B", color: "#fff", borderColor: "#C0392B" }} onClick={() => onDelete(a)}>Yes, delete</button><button className="lk-btn" onClick={() => setConfirmDel(false)}>No</button></span>
            : <button className="lk-btn" onClick={() => setConfirmDel(true)} style={{ color: "#C0392B" }}><Icon n="trash" s={14} />Delete</button>)}
          <div className="lk-spacer" />{incomplete && <span style={{ fontSize: 11.5, color: "#E0A106", fontWeight: 600, alignSelf: "center", marginRight: 8 }} title={"Still needed: " + missing.join(", ")}>Needs {missing.length} field{missing.length > 1 ? "s" : ""}: {missing.join(", ")}</span>}<button className="lk-btn" onClick={onClose}>Cancel</button>
          <button className="lk-btn primary" onClick={() => onSave(a, isNew)} disabled={incomplete}><Icon n="check" s={15} />Save</button>
        </div>}
        {!canEdit && clientViewer && !isNew && <div className="lk-df">
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Want to attend? Request an invite and an admin will forward it to you.</span>
          <div className="lk-spacer" />
          {inviteForMe
            ? <button className="lk-btn" disabled title="Already requested">{inviteForMe.status === "forwarded" ? "Invite Forwarded" : "Invite Requested"}</button>
            : <button className="lk-btn primary" onClick={() => { onRequestInvite(a); }}><Icon n="mail" s={15} />Request Invite</button>}
        </div>}
      </div>
    </div>);
}

async function readXlsxSheet(file) {
  const _xl = await import("exceljs/dist/exceljs.min.js"); const ExcelJS = _xl.default || _xl;
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The workbook has no sheets.");
  const ncols = ws.columnCount || 0;
  const norm = (v) => {
    if (v == null) return "";
    if (Object.prototype.toString.call(v) === "[object Date]") return v;
    if (typeof v === "object") {
      if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
      if (v.text != null) return v.text;
      if (v.result != null) return v.result;
      if (v.hyperlink != null) return v.text || v.hyperlink;
      return String(v);
    }
    return v;
  };
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const arr = [];
    for (let c = 1; c <= ncols; c++) arr.push(norm(row.getCell(c).value));
    rows.push(arr);
  });
  const headers = (rows[0] || []).map((h) => String(h).trim());
  return { headers: headers, rows: rows.slice(1) };
}

function AdminPanel({ S, cu, update, exportActivities }) {
  const [tab, setTab] = useState(() => { try { const t = localStorage.getItem("fin04_admintab"); return ["branding", "levels", "systems", "areas", "companies", "settings", "baseline", "users", "members", "requests", "audit", "data", "changelog"].includes(t) ? t : "companies"; } catch (e) { return "companies"; } });
  useEffect(() => { try { localStorage.setItem("fin04_admintab", tab); } catch (e) {} }, [tab]);
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
  const [bl, setBl] = useState(null);          // saved baseline row (or null)
  const [blPrev, setBlPrev] = useState(null);  // parsed-but-unsaved preview (xer/xml)
  const [blTab, setBlTab] = useState(null);    // tabular import context { filename, headers, rows }
  const [blMap, setBlMap] = useState(null);    // column mapping + options
  const [blBusy, setBlBusy] = useState(false);
  const [blErr, setBlErr] = useState("");
  const [blMsg, setBlMsg] = useState("");
  useEffect(() => { if (!S.projectId) return; let on = true; loadBaseline(S.projectId).then((r) => { if (on) setBl(r); }).catch(() => {}); return () => { on = false; }; }, [S.projectId]);
  const openMapping = (filename, tab) => {
    if (!tab.headers || !tab.headers.length) { setBlErr("No columns found in the first sheet."); return; }
    const msCol = autodetectMsCol(tab.headers);
    setBlTab({ filename: filename, headers: tab.headers, rows: tab.rows });
    setBlMap({ ...autodetectMapping(tab.headers), msRule: msCol >= 0 ? "col" : "zero", msCol: msCol, msVal: "Milestone", dateFmt: "auto" });
  };
  const onXerFile = async (file) => {
    if (!file) return; setBlErr(""); setBlMsg(""); setBlPrev(null); setBlTab(null); setBlMap(null); setBlBusy(true);
    try {
      const ext = (file.name || "").toLowerCase().split(".").pop();
      if (ext === "xer") { const p = parseXER(decodeXer(await file.arrayBuffer())); p.source_filename = file.name; setBlPrev(p); }
      else if (ext === "xml") { const p = parseMSPDI(await file.text()); p.source_filename = file.name; setBlPrev(p); }
      else if (ext === "csv") { openMapping(file.name, parseCSV(await file.text())); }
      else if (ext === "xlsx") { openMapping(file.name, await readXlsxSheet(file)); }
      else throw new Error("Use a P6 .xer, a Microsoft Project .xml, or a .csv / .xlsx spreadsheet.");
    } catch (e) { setBlErr(e && e.message ? e.message : "Could not read this file."); }
    setBlBusy(false);
  };
  const saveBl = async () => {
    if (!blPrev || !S.projectId) return; setBlBusy(true); setBlErr("");
    try {
      const saved = await saveBaseline(S.projectId, { meta: blPrev.meta, activities: blPrev.activities, wbs: blPrev.wbs, source_filename: blPrev.source_filename });
      setBl(saved); setBlPrev(null); setBlMsg("Baseline saved. It is now available on the Schedule.");
    } catch (e) { setBlErr(e && e.message ? e.message : "Save failed. Check you ran the baselines.sql migration and that you are a project admin."); }
    setBlBusy(false);
  };
  const saveBlTab = async () => {
    if (!blTab || !blMap || !S.projectId) return;
    if (blMap.name < 0 || blMap.start < 0) { setBlErr("Map the required fields (Activity name and Start)."); return; }
    setBlBusy(true); setBlErr("");
    try {
      const b = tabularToBaseline(blTab, blMap, blMap, blTab.filename);
      const saved = await saveBaseline(S.projectId, { meta: b.meta, activities: b.activities, wbs: b.wbs, source_filename: blTab.filename });
      setBl(saved); setBlTab(null); setBlMap(null); setBlMsg("Baseline saved. It is now available on the Schedule.");
    } catch (e) { setBlErr(e && e.message ? e.message : "Save failed. Check the baselines.sql migration is run and that you are a project admin."); }
    setBlBusy(false);
  };
  const removeBl = async () => {
    if (!S.projectId) return; setBlBusy(true); setBlErr("");
    try { await clearBaseline(S.projectId); setBl(null); setBlPrev(null); setBlTab(null); setBlMap(null); setBlMsg("Baseline removed."); }
    catch (e) { setBlErr(e && e.message ? e.message : "Remove failed."); }
    setBlBusy(false);
  };
  const blMiles = (acts) => (acts || []).filter((a) => a.ms).slice().sort((x, y) => (x.end < y.end ? -1 : 1));
  const [mapDraft, setMapDraft] = useState({});
  const [mapAll, setMapAll] = useState(false);
  const [mapQ, setMapQ] = useState("");
  const [mapSaved, setMapSaved] = useState(false);
  useEffect(() => { setMapDraft((bl && bl.mappings) || {}); }, [bl]);
  const [brandMsg, setBrandMsg] = useState("");
  const [impMode, setImpMode] = useState("append");
  const [impMsg, setImpMsg] = useState("");
  const [userMsg, setUserMsg] = useState("");
  const [nu, setNu] = useState({ email: "", name: "", role: "member", companyId: S.companies[0]?.id || "" });
  const [uq, setUq] = useState("");
  const [uCo, setUCo] = useState("all");
  const [uRole, setURole] = useState("all");
  const [uInvite, setUInvite] = useState("all");
  const [manageId, setManageId] = useState(null);
  const [openGroups, setOpenGroups] = useState({});
  const [subInput, setSubInput] = useState({});
  const [t3Input, setT3Input] = useState({});
  const [copyFrom, setCopyFrom] = useState({});
  const addList = (key, label) => { if (!nv.trim()) return; update((p) => ({ ...p, [key]: key === "companies" ? [...p.companies, { id: uid("co"), name: nv.trim() }] : [...p[key], nv.trim()] }), { action: "Add " + label, detail: nv.trim() }); setNv(""); };
  const [confirmAsk, setConfirmAsk] = useState(null);
  const askDel = (msg, fn) => setConfirmAsk({ msg, fn });
  const delList = (key, val, label) => update((p) => {
    const n = { ...p };
    if (key === "companies") n.companies = p.companies.filter((c) => c.id !== val);
    else n[key] = p[key].filter((x) => x !== val);
    if (key === "areas") { n.subAreas = (p.subAreas || []).filter((s) => s.area !== val); n.tier3s = (p.tier3s || []).filter((t) => t.area !== val); }
    return n;
  }, { action: "Remove " + label, detail: typeof val === "string" ? val : (S.companies.find((c) => c.id === val) || {}).name });
  const renameSystem = (oldName, raw) => { const name = (raw || "").trim(); if (!name || name === oldName) return; if (S.systems.some((s) => s !== oldName && s.toLowerCase() === name.toLowerCase())) { alert(`System "${name}" already exists.`); return; } update((p) => ({ ...p, systems: p.systems.map((s) => s === oldName ? name : s), activities: p.activities.map((a) => a.system === oldName ? { ...a, system: name } : a) }), { action: "Rename system", detail: `${oldName} -> ${name}` }); };
  const renameCompany = (id, raw) => { const name = (raw || "").trim(); const cur = S.companies.find((c) => c.id === id); if (!cur || !name || name === cur.name) return; if (S.companies.some((c) => c.id !== id && c.name.toLowerCase() === name.toLowerCase())) { alert(`Company "${name}" already exists.`); return; } update((p) => ({ ...p, companies: p.companies.map((c) => c.id === id ? { ...c, name } : c) }), { action: "Rename company", detail: `${cur.name} -> ${name}` }); };
  const setCompanyDesc = (id, raw) => { const description = (raw || "").trim(); const cur = S.companies.find((c) => c.id === id); if (!cur || (cur.description || "") === description) return; update((p) => ({ ...p, companies: p.companies.map((c) => c.id === id ? { ...c, description } : c) }), { action: "Edit company description", detail: cur.name }); };
  const addLevel = () => { const used = Object.keys(S.levels); let key = (lvKey || "").trim().toUpperCase().replace(/\s+/g, ""); if (!key) { let n = used.length + 1; key = "L" + n; while (S.levels[key]) { n++; key = "L" + n; } } if (S.levels[key]) { alert(`Cx stage "${key}" already exists.`); return; } const name = (lvName || "").trim() || "New stage"; update((p) => ({ ...p, levels: { ...p.levels, [key]: { name, color: lvColor || "#64748B", sort: Object.keys(p.levels).length } } }), { action: "Add Cx stage", detail: `${key} ${name}` }); setLvKey(""); setLvName(""); setLvColor("#64748B"); };
  const delLevel = (k) => { const keys = Object.keys(S.levels); if (keys.length <= 1) { alert("Keep at least one Cx stage."); return; } const fallback = keys.find((x) => x !== k); const used = S.activities.filter((a) => a.level === k).length; const msg = used ? `${used} activit${used === 1 ? "y" : "ies"} use ${k}. Delete it and move them to ${fallback}?` : `Delete Cx stage ${k}?`; askDel(msg, () => update((p) => { const lv = { ...p.levels }; delete lv[k]; return { ...p, levels: lv, activities: p.activities.map((a) => a.level === k ? { ...a, level: fallback } : a) }; }, { action: "Delete Cx stage", detail: k })); };
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
  // ---- access requests ----
  const [reqs, setReqs] = useState([]);
  const [reqBusy, setReqBusy] = useState(false);
  const [approve, setApprove] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  useEffect(() => {
    let on = true;
    const go = () => fetchAccessRequests().then((r) => { if (on) setReqs(r); }).catch(() => {});
    go();
    const sub = subscribeAccessRequests(go);
    return () => { on = false; try { sub && sub.unsubscribe && sub.unsubscribe(); } catch (e) {} };
  }, []);
  const pendReqs = reqs.filter((r) => r.status === "pending");
  const decidedReqs = reqs.filter((r) => r.status !== "pending").slice(0, 12);
  const FREE_DOMAINS = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "proton.me", "protonmail.com", "gmx.com", "aol.com"];
  const normName = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const domainOf = (e) => { const p = (e || "").split("@")[1]; return p ? p.toLowerCase().trim() : ""; };
  const domainLabel = (d) => { const p = d.split("."); return p.length < 2 ? d : p[p.length - 2]; };
  const titleCaseStr = (s) => (s || "").replace(/\b\w/g, (c) => c.toUpperCase());
  const matchCompanyByEmail = (email) => {
    const d = domainOf(email);
    if (!d) return { type: "empty" };
    if (FREE_DOMAINS.includes(d)) return { type: "free", domain: d };
    const exact = S.companies.find((c) => (c.domain || "").toLowerCase() === d);
    if (exact) return { type: "exact", company: exact, domain: d };
    const lbl = normName(domainLabel(d));
    const fuzzy = lbl && S.companies.find((c) => { const n = normName(c.name); return n && (n === lbl || n.includes(lbl) || lbl.includes(n)); });
    if (fuzzy) return { type: "fuzzy", company: fuzzy, domain: d };
    return { type: "unknown", domain: d };
  };
  const openApprove = (req) => {
    const m = matchCompanyByEmail(req.email);
    setApprove({
      req, name: req.name || req.email, email: req.email,
      companyId: (m.type === "exact" || m.type === "fuzzy") ? m.company.id : "",
      createNew: false, touched: false,
      newName: req.organisation || (m.domain ? titleCaseStr(domainLabel(m.domain)) : ""),
      remember: true, grantProject: true, projRole: "member",
    });
  };
  const setApproveEmail = (email) => setApprove((a) => {
    if (!a) return a;
    let companyId = a.companyId;
    if (!a.touched && !a.createNew) { const m = matchCompanyByEmail(email); companyId = (m.type === "exact" || m.type === "fuzzy") ? m.company.id : ""; }
    return { ...a, email, companyId };
  });
  const doApprove = async () => {
    const a = approve; if (!a) return;
    const email = (a.email || "").trim();
    if (!email) { setUserMsg("Email required."); return; }
    const d = domainOf(email); const free = FREE_DOMAINS.includes(d);
    let companyId = a.companyId, companyName = "";
    setReqBusy(true); setUserMsg("");
    try {
      if (a.createNew) {
        const nm = (a.newName || "").trim();
        if (!nm) { setUserMsg("Name the new company."); setReqBusy(false); return; }
        const existing = S.companies.find((c) => c.name.toLowerCase() === nm.toLowerCase());
        const co = existing || await createCompany(nm, (!free && a.remember) ? d : null);
        companyId = co.id; companyName = co.name;
      } else {
        if (!companyId) { setUserMsg("Pick a company, or create one."); setReqBusy(false); return; }
        const co = S.companies.find((c) => c.id === companyId);
        companyName = co ? co.name : "";
        if (co && d && !free && a.remember && (co.domain || "").toLowerCase() !== d) { try { await setCompanyDomain(co.id, d); } catch (e) {} }
      }
      const res = await userOp({ op: "invite", email, name: (a.name || email).trim(), role: "member", company_id: companyId, redirect: window.location.origin });
      await decideAccessRequest(a.req.id, { status: "approved", decided_by: cu.id, decided_by_name: cu.name, decided_at: new Date().toISOString() });
      let granted = false, grantErr = "";
      if (a.grantProject && res && res.id) { try { await addMember(S.projectId, res.id, a.projRole || "member", cu.id); granted = true; } catch (ge) { grantErr = ge.message || String(ge); } }
      setReqs((rs) => rs.map((r) => r.id === a.req.id ? { ...r, status: "approved", decidedByName: cu.name, decidedAt: new Date().toISOString() } : r));
      setApprove(null); setReqBusy(false);
      const projName = S.brand?.projectName || "this project";
      setNewCred({ who: email, pw: res && res.tempPassword, link: res && res.link, title: "Approved \u00b7 " + (granted ? ((a.projRole === "admin" ? "Admin" : "Member") + " on " + projName) : (a.grantProject ? "account made, grant failed" : (companyName || "global contacts only"))) });
      setUserMsg(grantErr ? ("Account created, but the project grant failed: " + grantErr + ". Add them under Project Team.") : "");
    } catch (e) { setReqBusy(false); setUserMsg("Approve failed: " + (e.message || e)); }
  };
  const doReject = async () => {
    const r = rejecting; if (!r) return;
    setReqBusy(true);
    try {
      await decideAccessRequest(r.req.id, { status: "rejected", decided_by: cu.id, decided_by_name: cu.name, decided_at: new Date().toISOString(), decision_note: (r.reason || "").trim() || null });
      setReqs((rs) => rs.map((x) => x.id === r.req.id ? { ...x, status: "rejected", decidedByName: cu.name, decidedAt: new Date().toISOString() } : x));
      setRejecting(null); setReqBusy(false);
    } catch (e) { setReqBusy(false); setUserMsg("Reject failed: " + (e.message || e)); }
  };
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
  const [members, setMembers] = useState(null);
  const [memQ, setMemQ] = useState("");
  const [memRole, setMemRole] = useState("member");
  const [memMsg, setMemMsg] = useState("");
  const [mfQ, setMfQ] = useState("");
  const [mfCo, setMfCo] = useState("all");
  const [mfRole, setMfRole] = useState("all");
  const [mfStatus, setMfStatus] = useState("all");
  const [pmManageId, setPmManageId] = useState(null);
  const [coManageId, setCoManageId] = useState(null);
  const [mcount, setMcount] = useState({});
  useEffect(() => { let live = true; loadMembershipCounts().then((m) => { if (live) setMcount(m); }).catch(() => {}); return () => { live = false; }; }, [S.projectId, members]);
  const meSuper = (S.users.find((u) => u.id === S.currentUserId) || {}).platformRole === "super" || !!S.isSuper;
  const setPlat = async (id, role, name) => { setUserMsg("Updating platform role…"); try { await setPlatformRole(id, role); setUserMsg((name || "User") + (role === "super" ? " is now a Super" : " is now a User") + ". Refresh to see it reflected everywhere."); } catch (e) { setUserMsg("Failed: " + (e.message || e)); } };
  useEffect(() => { let live = true; if (S.projectId) loadProjectMembers(S.projectId).then((r) => { if (live) setMembers(r); }).catch((e) => { if (live) setMemMsg("Load failed: " + (e.message || e)); }); return () => { live = false; }; }, [S.projectId]);
  const reloadMems = () => loadProjectMembers(S.projectId).then(setMembers).catch((e) => setMemMsg("Load failed: " + (e.message || e)));
  const addMem = async (userId, name) => { setMemMsg("Adding " + (name || "") + "…"); try { await addMember(S.projectId, userId, memRole, S.currentUserId); setMemMsg((name || "User") + " added as " + memRole); reloadMems(); } catch (e) { setMemMsg("Failed: " + (e.message || e)); } };
  const removeMem = async (userId, name) => { setMemMsg("Removing…"); try { await removeMember(S.projectId, userId); setMemMsg((name || "User") + " removed from this project"); reloadMems(); } catch (e) { setMemMsg("Failed: " + (e.message || e)); } };
  const changeRole = async (userId, role, name, adminCount, curRole) => { if (curRole === "admin" && role === "member" && adminCount <= 1) { setMemMsg("Keep at least one admin on the project."); reloadMems(); return; } try { await setMemberRole(S.projectId, userId, role); setMemMsg((name || "Role") + " set to " + role); reloadMems(); } catch (e) { setMemMsg("Failed: " + (e.message || e)); reloadMems(); } };
  const exportProject = () => downloadFile(`FIN04-project-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ companies: S.companies, areas: S.areas, subAreas: S.subAreas || [], tier3s: S.tier3s || [], systems: S.systems, levels: S.levels, settings: S.settings, activities: S.activities }, null, 2));
  const parseCSV = (text) => { const rows = []; let row = [], cur = "", q = false; for (let i = 0; i < text.length; i++) { const c = text[i]; if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else { if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else if (c === "\r") {} else cur += c; } } if (cur !== "" || row.length) { row.push(cur); rows.push(row); } return rows; };
  const normDate = (s) => { if (s == null || s === "") return ""; if (s instanceof Date) return isNaN(s) ? "" : fmtISO(s); s = String(s).trim(); if (!s) return ""; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; let m = s.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/); if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0"); m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})$/); if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return y + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0"); } m = s.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3,9})[-\/ ](\d{2}|\d{4})$/); if (m) { const mo = ({ jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 })[m[2].slice(0, 3).toLowerCase()]; if (mo) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return y + "-" + String(mo).padStart(2, "0") + "-" + m[1].padStart(2, "0"); } } const d = new Date(s); return isNaN(d) ? "" : fmtISO(d); };
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
    ["Project Setup", [["branding", "Branding"], ["levels", "Cx Stages"], ["systems", "Systems"], ["areas", "Locations"], ["companies", "Companies"], ["settings", "Lookahead"], ["baseline", "P6 Baseline"]]],
    ["User management", [["users", "Global Contacts"], ["members", "Project Team"], ["requests", "Access requests"]]],
    ["Audit log", [["audit", "Audit"]]],
    ["Advanced", [["data", "Import / Export"]]],
    ["About", [["changelog", "Changelog"]]],
  ];
  return (
    <div className="lk-adminwrap2" style={cssVars(S.theme)}><style>{css}</style>
        <div className="lk-subnav">
          {navGroups.map(([g, items]) => <div key={g} className="grp"><div className="grphd">{g}</div>{items.map(([k, l]) => <button key={k} className={tab === k ? "sel" : ""} onClick={() => setTab(k)}>{l}{k === "requests" && pendReqs.length ? <span className="lk-reqbadge">{pendReqs.length}</span> : null}</button>)}</div>)}
        </div>
        <div className={"lk-subbody" + (tab === "users" || tab === "members" || tab === "audit" || tab === "requests" ? " wide" : "")}><div className="lk-db">
          {tab === "systems" && <>
            <div className="lk-list">{S.systems.map((name) => <div key={name} className="lk-li">
              <input className="lk-in" key={"sys:" + name} defaultValue={name} style={{ flex: 1 }} title="Rename system (updates every activity using it)" onKeyDown={(e) => { if (e.key === "Enter") { renameSystem(name, e.target.value); e.target.blur(); } else if (e.key === "Escape") { e.target.value = name; e.target.blur(); } }} onBlur={(e) => renameSystem(name, e.target.value)} />
              <button onClick={() => askDel('Delete "' + name + '"?', () => delList("systems", name, "system"))}><Icon n="trash" s={14} /></button>
            </div>)}</div>
            <div className="lk-add"><input className="lk-in" placeholder="Add system…" value={nv} onChange={(e) => setNv(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addList("systems", "system")} /><button className="lk-btn primary" onClick={() => addList("systems", "system")}><Icon n="plus" s={15} /></button></div>
          </>}
          {tab === "companies" && <>
            <div className="lk-cohead"><span /><span>Company &amp; role</span><span className="ctr">People</span><span /></div>
            <div className="lk-list" style={{ gap: 8 }}>{S.companies.map((c) => {
              const n = S.users.filter((u) => u.companyId === c.id).length;
              const role = (c.description || "").replace(/\s*\n\s*/g, " \u00b7 ").trim();
              const lg = c.logoUrl ? { url: c.logoUrl, dark: false } : (c.logoDark ? { url: c.logoDark, dark: true } : null);
              return <div key={c.id} className="lk-corow">
                <span className={"lk-cologo" + (lg ? (lg.dark ? " dk" : "") : " empty")}>{lg ? <img src={lg.url} alt="" /> : <span className="lk-cologo-ph">{avInit(c.name)}</span>}</span>
                <div className="lk-coname"><b>{c.name}</b>{role ? <s title={role}>{role}</s> : <s style={{ opacity: .6 }}>No role set</s>}</div>
                <span className="lk-mpc" title={n + " contact" + (n === 1 ? "" : "s") + " in this company"} style={{ color: n ? "var(--ink)" : "var(--muted)" }}>{n}</span>
                <button className="lk-mbtn" onClick={() => setCoManageId(c.id)}>Manage</button>
              </div>;
            })}</div>
            <div className="lk-add"><input className="lk-in" placeholder="Add a company…" value={nv} onChange={(e) => setNv(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addList("companies", "company")} /><button className="lk-btn primary" onClick={() => addList("companies", "company")}><Icon n="plus" s={15} />Add</button></div>
          </>}
          {coManageId && (() => {
            const c = S.companies.find((x) => x.id === coManageId); if (!c) return null;
            const n = S.users.filter((u) => u.companyId === c.id).length;
            const headLg = c.logoUrl ? { url: c.logoUrl, dark: false } : (c.logoDark ? { url: c.logoDark, dark: true } : null);
            return <div className="lk-modal-bg" onClick={() => setCoManageId(null)}>
              <div className="lk-modal" style={{ ...cssVars(S.theme), maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
                <div className="lk-dh"><h3 style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}><span className={"lk-cologo sm" + (headLg ? (headLg.dark ? " dk" : "") : " empty")}>{headLg ? <img src={headLg.url} alt="" /> : <span className="lk-cologo-ph">{avInit(c.name)}</span>}</span>{c.name || "Manage company"}</h3><button className="lk-btn icon" onClick={() => setCoManageId(null)}><Icon n="x" /></button></div>
                <div className="bd">
                  <div className="lk-f"><label>Company Name</label><input className="lk-in" key={c.id + ":" + c.name} defaultValue={c.name} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); else if (e.key === "Escape") { e.target.value = c.name; e.target.blur(); } }} onBlur={(e) => renameCompany(c.id, e.target.value)} /></div>
                  <div className="lk-f"><label>Role &amp; Scope</label><textarea className="lk-in" key={"d:" + c.id} defaultValue={c.description || ""} rows={3} placeholder="Role & scope on the project. Shown on the board when the logo is clicked." style={{ resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" }} onKeyDown={(e) => { if (e.key === "Escape") { e.target.value = c.description || ""; e.target.blur(); } }} onBlur={(e) => setCompanyDesc(c.id, e.target.value)} /></div>
                  <div className="lk-f"><label>Logos</label>
                    <div style={{ display: "flex", gap: 12 }}>
                      {[["Light mode", c.logoUrl, "logoUrl", "#ffffff", "#0b1320", false], ["Dark mode", c.logoDark, "logoDark", "#0d1422", "#dbe6f5", true]].map(([lbl, url, field, bg, fg, dk]) => <div key={field} style={{ flex: 1 }}>
                        <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 5 }}>{lbl}</div>
                        <label className="lk-codrop" style={{ background: bg, color: fg, borderColor: dk ? "var(--line)" : "transparent" }} title={"Upload the " + lbl.toLowerCase() + " logo for " + c.name}>
                          {url ? <img src={url} alt="" /> : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, opacity: .85 }}><Icon n="upload" s={13} />Upload</span>}
                          <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: "none" }} onChange={async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; try { const u = await uploadCompanyLogo(f, c.id); update((p) => ({ ...p, companies: p.companies.map((x) => x.id === c.id ? { ...x, [field]: u } : x) }), { action: "Company logo set", detail: c.name + " (" + lbl + ")" }); } catch (x) { alert("Logo upload failed: " + (x.message || x)); } e.target.value = ""; }} />
                          {url && <span className="lk-coremove" onClick={(e) => { e.preventDefault(); e.stopPropagation(); update((p) => ({ ...p, companies: p.companies.map((x) => x.id === c.id ? { ...x, [field]: "" } : x) }), { action: "Company logo removed", detail: c.name + " (" + lbl + ")" }); }} title={"Remove " + lbl.toLowerCase() + " logo"}>&times;</span>}
                        </label>
                      </div>)}
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>Wide transparent PNG or SVG looks best. The light logo shows on light backgrounds; the dark on dark.</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{n} contact{n === 1 ? "" : "s"} assigned to this company.</div>
                </div>
                <div className="rep-foot" style={{ justifyContent: "space-between" }}>
                  <button className="lk-btn" style={{ color: "var(--red)" }} onClick={() => { setCoManageId(null); askDel('Delete "' + c.name + '" and unassign it from any activities?', () => delList("companies", c.id, "company")); }}><Icon n="trash" s={14} />Delete company</button>
                  <button className="lk-btn primary" onClick={() => setCoManageId(null)}>Done</button>
                </div>
              </div>
            </div>;
          })()}
          {tab === "areas" && <>
            <div className="lk-list">{S.areas.map((area) => {
              const subs = (S.subAreas || []).filter((s) => s.area === area).map((s) => s.name).sort();
              return <div key={area} style={{ borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
                <div className="lk-li" style={{ borderBottom: 0, gap: 6 }}><input className="lk-in" key={"a:" + area} defaultValue={area} style={{ fontWeight: 600, flex: 1 }} title="Rename building (updates every activity using it)" onKeyDown={(e) => { if (e.key === "Enter") { renameArea(area, e.target.value); e.target.blur(); } else if (e.key === "Escape") { e.target.value = area; e.target.blur(); } }} onBlur={(e) => renameArea(area, e.target.value)} /><button title="Delete building" onClick={() => askDel('Delete building "' + area + '" and its levels and zones?', () => delList("areas", area, "area"))}><Icon n="trash" s={14} /></button></div>
                <div style={{ paddingLeft: 14 }}>
                  {subs.map((sn) => { const t3 = (S.tier3s || []).filter((t) => t.area === area && t.subArea === sn).map((t) => t.name).sort(); const k = area + "\u0001" + sn; const sibs = subs.filter((x) => x !== sn && (S.tier3s || []).some((t) => t.area === area && t.subArea === x)); return <div key={sn} style={{ paddingBottom: 4 }}>
                    <div className="lk-li" style={{ borderBottom: 0, gap: 6, flexWrap: "wrap" }}><span style={{ fontSize: 12, color: "var(--muted)" }}>↳</span><input className="lk-in" key={"s:" + area + ":" + sn} defaultValue={sn} style={{ flex: 1, fontSize: 12, minWidth: 80 }} title="Rename level" onKeyDown={(e) => { if (e.key === "Enter") { renameSub(area, sn, e.target.value); e.target.blur(); } else if (e.key === "Escape") { e.target.value = sn; e.target.blur(); } }} onBlur={(e) => renameSub(area, sn, e.target.value)} />
                      {sibs.length > 0 && <><select className="lk-select" style={{ fontSize: 11, maxWidth: 150 }} value={copyFrom[k] || ""} onChange={(e) => setCopyFrom({ ...copyFrom, [k]: e.target.value })}><option value="">Copy zones from…</option>{sibs.map((x) => <option key={x} value={x}>{x} ({(S.tier3s || []).filter((t) => t.area === area && t.subArea === x).length})</option>)}</select><button className="lk-btn" style={{ fontSize: 11 }} title="Copy every zone / room from the chosen level into this one" disabled={!copyFrom[k]} onClick={() => copyZones(area, copyFrom[k], sn)}>Copy</button></>}
                      <button title="Delete level" onClick={() => askDel('Delete level "' + sn + '" and its zones?', () => delSub(area, sn))}><Icon n="trash" s={13} /></button></div>
                    <div style={{ paddingLeft: 16 }}>
                      {t3.map((tn) => <div key={tn} className="lk-li" style={{ borderBottom: 0, gap: 6 }}><span style={{ fontSize: 11.5, color: "var(--muted)" }}>↳↳</span><input className="lk-in" key={"t:" + area + ":" + sn + ":" + tn} defaultValue={tn} style={{ flex: 1, fontSize: 11.5, minWidth: 80 }} title="Rename zone / room" onKeyDown={(e) => { if (e.key === "Enter") { renameT3(area, sn, tn, e.target.value); e.target.blur(); } else if (e.key === "Escape") { e.target.value = tn; e.target.blur(); } }} onBlur={(e) => renameT3(area, sn, tn, e.target.value)} /><button title="Delete zone / room" onClick={() => askDel('Delete zone / room "' + tn + '"?', () => delT3(area, sn, tn))}><Icon n="trash" s={12} /></button></div>)}
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
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.55 }}>Everyone on the platform. Add a person once here; putting them on projects (under <button onClick={() => setTab("members")} style={{ background: "none", border: 0, color: "var(--accent)", cursor: "pointer", padding: 0, font: "inherit" }}>Project Team</button>) needs no further invite. Platform role sets cross-project reach: a <b>Super</b> sees and administers every project; a <b>User</b> sees only the projects they are added to.</div>
            <div className="lk-ufilter">
              <div className="lk-f" style={{ minWidth: 150, flex: 1 }}><label>Search</label><input className="lk-in" placeholder="Name or email…" value={uq} onChange={(e) => setUq(e.target.value)} /></div>
              <div className="lk-f" style={{ minWidth: 150 }}><label>Company</label><select className="lk-select" value={uCo} onChange={(e) => setUCo(e.target.value)}><option value="all">All companies</option><option value="none">No company</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="lk-f" style={{ minWidth: 110 }}><label>Platform</label><select className="lk-select" value={uRole} onChange={(e) => setURole(e.target.value)}><option value="all">Everyone</option><option value="super">Supers</option><option value="user">Users</option></select></div>
              <div className="lk-f" style={{ minWidth: 110 }}><label>Invite</label><select className="lk-select" value={uInvite} onChange={(e) => setUInvite(e.target.value)}><option value="all">All</option><option value="pending">Pending</option><option value="accepted">Accepted</option></select></div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", margin: "0 0 10px" }}><button className="lk-btn" title="Download every platform user with email, company, role, projects, status and last seen" onClick={() => {
              const cnm = (id) => (S.companies.find((c) => c.id === id) || {}).name || "";
              const p2 = (n) => String(n).padStart(2, "0");
              const fmtSeen = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}, ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; };
              const rows = (S.users || []).slice().sort((a, b) => (cnm(a.companyId) || "\uffff").localeCompare(cnm(b.companyId) || "\uffff") || (a.name || "").localeCompare(b.name || "")).map((u) => { const st = ustat[u.id] || {}; return [u.name || "", st.email || "", cnm(u.companyId) || "", u.platformRole === "super" ? "Super" : "User", mcount[u.id] || 0, st.lastSignIn ? "Active" : "Invite pending", fmtSeen(st.lastSignIn)]; });
              downloadFile(`FIN04-users-${fmtISO(new Date())}.csv`, toCSV(["Name", "Email", "Company", "Platform role", "Projects", "Status", "Last seen"], rows));
            }}><Icon n="download" s={14} />Export Users (CSV)</button></div>
            {(() => {
              const cn = (id) => (S.companies.find((c) => c.id === id) || {}).name || "";
              const q = uq.trim().toLowerCase();
              const filtered = S.users.filter((u) => {
                const pr = u.platformRole || "user";
                if (uRole !== "all" && pr !== uRole) return false;
                if (uCo === "none") { if (u.companyId) return false; } else if (uCo !== "all" && u.companyId !== uCo) return false;
                if (uInvite !== "all") { const accepted = !!(ustat[u.id] && ustat[u.id].lastSignIn); if (uInvite === "accepted" && !accepted) return false; if (uInvite === "pending" && accepted) return false; }
                if (q && !(`${u.name || ""} ${cn(u.companyId)}`.toLowerCase().includes(q))) return false;
                return true;
              });
              const groups = {};
              filtered.forEach((u) => { const key = u.platformRole === "super" ? "\u0000Platform team" : (cn(u.companyId) || "\uffffNo company"); (groups[key] = groups[key] || []).push(u); });
              const renderRow = (u) => { const seen = ustat[u.id] && ustat[u.id].lastSignIn; const pr = u.platformRole || "user"; const n = mcount[u.id] || 0; const co = cn(u.companyId); return <div key={u.id} className="lk-urow">
                <span className="lk-uava" style={{ background: avBg(u.id) }}>{avInit(u.name)}</span>
                <div className="lk-uname"><b>{u.name || "(unnamed)"}</b>{u.id === S.currentUserId ? <span className="lk-you">you</span> : null}</div>
                <span className="lk-cochip" title={co || "No company"}>{co || "No company"}</span>
                <span className="lk-platbadge" data-super={pr === "super" ? "1" : "0"} title="Platform role">{pr === "super" ? "Super" : "User"}</span>
                <span className="lk-mpc" title={"On " + n + " project" + (n === 1 ? "" : "s")} style={{ color: n ? "var(--ink)" : "var(--muted)" }}>{n}</span>
                <span className={"lk-stat " + (seen ? "act" : "pend")} title={seen ? "Last seen " + new Date(seen).toLocaleString("en-GB") : "Onboarding link not yet used"}>{seen ? "Active" : "Invite pending"}</span>
                <button className="lk-mbtn" onClick={() => setManageId(u.id)}>Manage</button>
              </div>; };
              if (!filtered.length) return <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>No one matches these filters.</div>;
              const order = (k) => k === "\u0000Platform team" ? "\u0000" : (k === "\uffffNo company" ? "\uffff" : k.toLowerCase());
              return <><div className="lk-uhead"><span /><span>Person</span><span>Company</span><span>Platform</span><span className="ctr">Proj</span><span>Status</span><span /></div>
              {Object.keys(groups).sort((a, b) => order(a).localeCompare(order(b))).map((k) => { const open = !!openGroups[k] || !!q; return <div key={k} className="lk-ugroup">
                <button className="lk-ughead" style={{ borderBottom: open ? "1px solid var(--line)" : 0 }} onClick={() => setOpenGroups((g) => ({ ...g, [k]: !g[k] }))}>
                  <span className="chev" style={{ transform: open ? "rotate(90deg)" : "none" }}>{"\u25B6"}</span>
                  {k === "\u0000Platform team" ? "Platform team" : (k === "\uffffNo company" ? "No company" : k)} <span className="cnt">({groups[k].length})</span>
                </button>
                {open && <div className="lk-list" style={{ padding: "4px 8px" }}>{groups[k].map(renderRow)}</div>}
              </div>; })}</>;
            })()}
            <div className="lk-f"><label>Add A Person To Global Contacts (Email Required)</label><input className="lk-in" placeholder="Email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></div>
            <div className="lk-f"><input className="lk-in" placeholder="Name (optional)" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></div>
            <div className="lk-row">
              <select className="lk-select" value={nu.companyId} onChange={(e) => setNu({ ...nu, companyId: e.target.value, role: "member" })}>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <button className="lk-btn primary" onClick={addUser}><Icon n="plus" s={15} />Add person</button>
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
              <div className="lk-f"><label>Bulk Add Users</label>
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
          {manageId && (() => {
            const u = S.users.find((x) => x.id === manageId); if (!u) return null;
            const pr = u.platformRole || "user"; const seen = !!(ustat[u.id] && ustat[u.id].lastSignIn); const np = mcount[u.id] || 0; const isSelf = u.id === S.currentUserId;
            return <div className="lk-modal-bg" onClick={() => setManageId(null)}>
              <div className="lk-modal" style={{ ...cssVars(S.theme), maxWidth: 430 }} onClick={(e) => e.stopPropagation()}>
                <div className="lk-dh"><h3 style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}><span className="lk-uava" style={{ background: avBg(u.id), width: 30, height: 30, fontSize: 11 }}>{avInit(u.name)}</span>{u.name || "Manage person"}{isSelf ? <span className="lk-you">you</span> : null}</h3><button className="lk-btn icon" onClick={() => setManageId(null)}><Icon n="x" /></button></div>
                <div className="bd">
                  <div className="lk-f"><label>Display Name</label><input className="lk-in" key={u.id + ":" + u.name} defaultValue={u.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== u.name) userOp({ op: "update", id: u.id, name: v }).then(() => setUserMsg("Name updated")).catch((x) => setUserMsg("Failed: " + (x.message || x))); }} /></div>
                  <div className="lk-f"><label>Platform Role</label>{meSuper
                    ? <select className="lk-select" value={pr} onChange={(e) => setPlat(u.id, e.target.value, u.name)}><option value="user">User</option><option value="super">Super</option></select>
                    : <div className="lk-locked"><span className="lkv">{pr === "super" ? "Super" : "User"}</span><span className="lkn">Only a super can change this</span></div>}
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>A <b>Super</b> sees and administers every project; a <b>User</b> sees only the projects they are added to.</div></div>
                  <div className="lk-f"><label>Company</label><select className="lk-select" value={u.companyId || ""} onChange={(e) => userOp({ op: "update", id: u.id, company_id: e.target.value }).catch((x) => setUserMsg("Failed: " + (x.message || x)))}><option value="">No company</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11.5, color: "var(--muted)", margin: "2px 0 2px" }}><span className={"lk-stat " + (seen ? "act" : "pend")}>{seen ? "Active" : "Invite pending"}</span><span>&middot;</span><span>On {np} project{np === 1 ? "" : "s"}</span></div>
                  <div style={{ borderTop: "1px solid var(--line)", marginTop: 11, paddingTop: 11, display: "flex", flexDirection: "column", gap: 7 }}>
                    <button className="lk-btn" onClick={() => { setAuditUser(u.name); setAuditOpen(true); setTab("audit"); setManageId(null); }}><Icon n="list" s={14} />View audit trail</button>
                    <button className="lk-btn" onClick={() => sendLink(u.id, u.name)}><Icon n="mail" s={14} />Resend set-password link</button>
                    <button className="lk-btn" onClick={() => resetPw(u.id, u.name)}><Icon n="cog" s={14} />Reset password</button>
                    {!isSelf && <button className="lk-btn" style={{ color: "var(--red)" }} onClick={() => { setManageId(null); askDel("Delete " + (u.name || "this person") + " from Global Contacts? This removes their account and every project access.", () => delUser(u.id, u.name)); }}><Icon n="trash" s={14} />Remove from platform</button>}
                  </div>
                </div>
                <div className="rep-foot"><button className="lk-btn primary" onClick={() => setManageId(null)}>Done</button></div>
              </div>
            </div>;
          })()}
          {pmManageId && (() => {
            const m = (members || []).find((x) => x.user_id === pmManageId); const u = S.users.find((x) => x.id === pmManageId); if (!m || !u) return null;
            const cn = (id) => (S.companies.find((c) => c.id === id) || {}).name || "";
            const seen = !!(ustat[u.id] && ustat[u.id].lastSignIn); const np = mcount[u.id] || 0; const isSelf = u.id === S.currentUserId;
            const adminCount = (members || []).filter((x) => x.role === "admin").length;
            return <div className="lk-modal-bg" onClick={() => setPmManageId(null)}>
              <div className="lk-modal" style={{ ...cssVars(S.theme), maxWidth: 430 }} onClick={(e) => e.stopPropagation()}>
                <div className="lk-dh"><h3 style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}><span className="lk-uava" style={{ background: avBg(u.id), width: 30, height: 30, fontSize: 11 }}>{avInit(u.name)}</span>{u.name || "Manage member"}{isSelf ? <span className="lk-you">you</span> : null}</h3><button className="lk-btn icon" onClick={() => setPmManageId(null)}><Icon n="x" /></button></div>
                <div className="bd">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 11.5, color: "var(--muted)", marginBottom: 12 }}><span className="lk-cochip">{cn(u.companyId) || "No company"}</span><span className={"lk-stat " + (seen ? "act" : "pend")}>{seen ? "Active" : "Invite pending"}</span><span>&middot;</span><span>On {np} project{np === 1 ? "" : "s"}</span></div>
                  <div className="lk-f"><label>Role On This Project</label><select className="lk-select" value={m.role} onChange={(e) => changeRole(u.id, e.target.value, u.name, adminCount, m.role)}><option value="member">Member</option><option value="admin">Admin</option></select>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5 }}>An <b>Admin</b> can manage this project's setup, team and activities; a <b>Member</b> works within it. At least one admin must remain.</div></div>
                  <div style={{ borderTop: "1px solid var(--line)", marginTop: 11, paddingTop: 11, display: "flex", flexDirection: "column", gap: 7 }}>
                    <button className="lk-btn" onClick={() => { setPmManageId(null); setManageId(u.id); }}><Icon n="person" s={14} />Edit name, company or platform role</button>
                    {!isSelf && <button className="lk-btn" style={{ color: "var(--red)" }} onClick={() => { setPmManageId(null); askDel("Remove " + (u.name || "this person") + " from this project? They keep their account and other projects.", () => removeMem(u.id, u.name)); }}><Icon n="trash" s={14} />Remove from this project</button>}
                  </div>
                </div>
                <div className="rep-foot"><button className="lk-btn primary" onClick={() => setPmManageId(null)}>Done</button></div>
              </div>
            </div>;
          })()}
          {tab === "members" && <div className="lk-userwrap"><div className="lk-usermain">
            {(() => {
              const cn = (id) => (S.companies.find((c) => c.id === id) || {}).name || "";
              const byId = {}; S.users.forEach((u) => { byId[u.id] = u; });
              const all = (members || []).map((m) => ({ ...m, u: byId[m.user_id] })).filter((r) => r.u);
              const adminCount = all.filter((r) => r.role === "admin").length;
              const orphan = (members || []).length - all.length;
              const seenOf = (id) => !!(ustat[id] && ustat[id].lastSignIn);
              const q = mfQ.trim().toLowerCase();
              const rows = all.filter((r) => {
                if (mfRole !== "all" && r.role !== mfRole) return false;
                if (mfCo === "none") { if (r.u.companyId) return false; } else if (mfCo !== "all" && r.u.companyId !== mfCo) return false;
                if (mfStatus !== "all") { const a = seenOf(r.user_id); if (mfStatus === "active" && !a) return false; if (mfStatus === "pending" && a) return false; }
                if (q && !(`${r.u.name || ""} ${cn(r.u.companyId)}`.toLowerCase().includes(q))) return false;
                return true;
              });
              rows.sort((a, b) => (a.role === "admin" ? 0 : 1) - (b.role === "admin" ? 0 : 1) || (a.u.name || "").localeCompare(b.u.name || ""));
              return <>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Project team</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{members ? all.length + " member" + (all.length === 1 ? "" : "s") + " \u00b7 " + adminCount + " admin" + (adminCount === 1 ? "" : "s") : ""}</div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10, lineHeight: 1.5 }}>Adding someone here grants access to this project immediately, with no invite to accept. Removing them revokes only this project; they keep their account and any other projects.</div>
                {members === null ? <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 2px" }}>Loading members…</div> : <>
                  <div className="lk-ufilter">
                    <div className="lk-f" style={{ minWidth: 150, flex: 1 }}><label>Search</label><input className="lk-in" placeholder="Name or company…" value={mfQ} onChange={(e) => setMfQ(e.target.value)} /></div>
                    <div className="lk-f" style={{ minWidth: 140 }}><label>Company</label><select className="lk-select" value={mfCo} onChange={(e) => setMfCo(e.target.value)}><option value="all">All companies</option><option value="none">No company</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    <div className="lk-f" style={{ minWidth: 110 }}><label>Role</label><select className="lk-select" value={mfRole} onChange={(e) => setMfRole(e.target.value)}><option value="all">All roles</option><option value="admin">Admins</option><option value="member">Members</option></select></div>
                    <div className="lk-f" style={{ minWidth: 110 }}><label>Status</label><select className="lk-select" value={mfStatus} onChange={(e) => setMfStatus(e.target.value)}><option value="all">All</option><option value="active">Active</option><option value="pending">Invite pending</option></select></div>
                  </div>
                  {!all.length ? <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>No one on the team yet. Add people from Global Contacts below.</div>
                    : !rows.length ? <div style={{ fontSize: 12, color: "var(--muted)", padding: "10px 2px" }}>No members match these filters.</div>
                    : <>
                      <div className="lk-uhead"><span /><span>Member</span><span>Company</span><span>Role</span><span className="ctr">Proj</span><span>Status</span><span /></div>
                      {rows.map((r) => { const seen = seenOf(r.user_id); const sup = (r.u.platformRole || "user") === "super"; const np = mcount[r.user_id] || 0; return <div key={r.user_id} className="lk-urow">
                        <span className="lk-uava" style={{ background: avBg(r.user_id) }}>{avInit(r.u.name)}</span>
                        <div className="lk-uname"><b>{r.u.name || "(unnamed)"}</b>{r.user_id === S.currentUserId ? <span className="lk-you">you</span> : null}</div>
                        <span className="lk-cochip" title={cn(r.u.companyId) || "No company"}>{cn(r.u.companyId) || "No company"}</span>
                        <span className="lk-platbadge" data-super={r.role === "admin" ? "1" : "0"} title="Role on this project">{r.role === "admin" ? "Admin" : "Member"}</span>
                        <span className="lk-mpc" title={"On " + np + " project" + (np === 1 ? "" : "s") + " across the platform"} style={{ color: np ? "var(--ink)" : "var(--muted)" }}>{np}</span>
                        <span className={"lk-stat " + (seen ? "act" : "pend")} title={seen ? "Has signed in" : "Onboarding link not yet used"}>{seen ? (sup ? "Active \u00b7 super" : "Active") : "Invite pending"}</span>
                        <button className="lk-mbtn" onClick={() => setPmManageId(r.user_id)}>Manage</button>
                      </div>; })}
                      {orphan > 0 ? <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{orphan} {orphan === 1 ? "person" : "people"} not shown (no profile in Global Contacts yet).</div> : null}
                    </>}
                </>}
              </>;
            })()}
            {memMsg && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>{memMsg}</div>}
            <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
              <div className="lk-f"><label>Add People From Global Contacts</label><input className="lk-in" placeholder="Search people by name or company…" value={memQ} onChange={(e) => setMemQ(e.target.value)} /></div>
              <div className="lk-row" style={{ alignItems: "center", marginBottom: 8 }}><span style={{ fontSize: 11.5, color: "var(--muted)" }}>Add as</span><select className="lk-select" style={{ maxWidth: 140 }} value={memRole} onChange={(e) => setMemRole(e.target.value)}><option value="member">Member</option><option value="admin">Admin</option></select></div>
              {(() => {
                const cn = (id) => (S.companies.find((c) => c.id === id) || {}).name || "";
                const have = new Set((members || []).map((m) => m.user_id));
                const q = memQ.trim().toLowerCase();
                const cands = S.users.filter((u) => !have.has(u.id) && (!q || (`${u.name || ""} ${cn(u.companyId)}`.toLowerCase().includes(q)))).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                if (!cands.length) return <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{q ? "No one in Global Contacts matches." : "Everyone in Global Contacts is already on this project."}</div>;
                return <div className="lk-list" style={{ maxHeight: 280, overflow: "auto" }}>{cands.slice(0, 60).map((u) => { const np = mcount[u.id] || 0; return <div key={u.id} className="lk-li" style={{ gap: 9, alignItems: "center" }}>
                  <span className="lk-mav" style={{ background: avBg(u.id), width: 26, height: 26, fontSize: 10 }}>{avInit(u.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name || "(unnamed)"}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(cn(u.companyId) || "No company") + " \u00b7 on " + np + " project" + (np === 1 ? "" : "s")}</div>
                  </div>
                  <button className="lk-btn" onClick={() => addMem(u.id, u.name)}><Icon n="plus" s={13} />Add</button>
                </div>; })}{cands.length > 60 && <div style={{ fontSize: 11, color: "var(--muted)", padding: "6px 2px" }}>Showing first 60. Refine the search to narrow.</div>}</div>;
              })()}
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 8 }}>Someone not listed? Add them under <button onClick={() => setTab("users")} style={{ background: "none", border: 0, color: "var(--accent)", cursor: "pointer", padding: 0, font: "inherit" }}>Global Contacts</button> first; that sends the one-time onboarding link. After that they appear here with no further invite.</div>
            </div>
            </div>
            <div className="lk-userside"><LatestOnline users={S.users} ustat={ustat} pres={pres} /></div>
          </div>}
          {tab === "requests" && <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Access requests</h3>
              {pendReqs.length > 0 && <span className="lk-reqbadge">{pendReqs.length}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>Approving creates the person's account and, by default, adds them to this project straight away, with no separate invite for them to accept. Anyone can submit this form, so verify identity before approving.</div>
            {newCred && newCred.title && newCred.title.startsWith("Approved") && <div style={{ marginBottom: 14, padding: 11, border: "1px solid var(--accent)", borderRadius: 8, background: "var(--chipbg)", fontSize: 12.5 }}>
              <div style={{ fontWeight: 700, marginBottom: 5 }}>{newCred.title}. Share with the person:</div>
              <div style={{ marginBottom: 2 }}>User: <span className="mono" style={{ userSelect: "all" }}>{newCred.who}</span></div>
              {newCred.link && <div style={{ marginBottom: 2, wordBreak: "break-all" }}>Set-password link: <span className="mono" style={{ userSelect: "all" }}>{newCred.link}</span></div>}
              {newCred.pw && <div>Temporary password: <span className="mono" style={{ userSelect: "all", fontWeight: 700 }}>{newCred.pw}</span></div>}
              <button className="lk-btn" style={{ marginTop: 8 }} onClick={() => { try { navigator.clipboard.writeText(newCred.link ? `Email: ${newCred.who}\nSet your DLP password: ${newCred.link}` : `Site: ${window.location.origin}\nEmail: ${newCred.who}\nPassword: ${newCred.pw}`); setUserMsg("Copied to clipboard"); } catch (e) { setUserMsg("Copy not available; select the text manually."); } }}><Icon n="download" s={13} />Copy invite details</button>
              <button className="lk-btn" style={{ marginTop: 8, marginLeft: 6 }} onClick={() => setNewCred(null)}>Done</button>
              <div style={{ marginTop: 7, color: "var(--muted)" }}>The link lets them set their own password and signs them straight in. No email is sent automatically.</div>
            </div>}
            {pendReqs.length === 0
              ? <div style={{ fontSize: 13, color: "var(--muted)", padding: "30px 0", textAlign: "center", border: "1px dashed var(--line)", borderRadius: 12 }}>No pending requests.</div>
              : pendReqs.map((r) => { const free = FREE_DOMAINS.includes(domainOf(r.email)); const suspicious = free && !r.organisation; return (
                <div key={r.id} className="lk-req">
                  <div className="rtop">
                    <div>
                      <div className="who">{r.name || "(no name)"}</div>
                      <div className="rmeta">{r.email}{r.organisation ? <> &middot; <span className="org">{r.organisation}</span></> : <> &middot; <span style={{ color: "var(--muted)" }}>no organisation given</span></>}</div>
                    </div>
                    <div className="rwhen">{relTime(r.createdAt)}</div>
                  </div>
                  {r.note ? <div className="rnote">{r.note}</div> : <div className="rnote empty">No reason provided.</div>}
                  {suspicious && <div className="rflag"><Icon n="alert" s={14} />Personal email, no organisation. Verify before approving.</div>}
                  <div className="racts">
                    <button className="lk-btn primary" onClick={() => openApprove(r)}><Icon n="check" s={14} />Approve</button>
                    <button className="lk-btn" style={{ color: "var(--red)" }} onClick={() => setRejecting({ req: r, reason: "" })}>Reject</button>
                  </div>
                </div>); })}
            {decidedReqs.length > 0 && <>
              <div className="grphd" style={{ marginTop: 22, color: "var(--muted)" }}>Recently decided</div>
              {decidedReqs.map((r) => <div key={r.id} className="lk-rdecided"><div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{r.name || r.email}</div><div style={{ fontSize: 11.5, color: "var(--muted)" }}>{r.email}{r.decidedByName ? " \u00b7 " + (r.status === "approved" ? "approved" : "rejected") + " by " + r.decidedByName : ""}{r.decisionNote ? " \u00b7 " + r.decisionNote : ""}</div></div><span className={"lk-rstat " + (r.status === "approved" ? "app" : "rej")}>{r.status === "approved" ? "Approved" : "Rejected"}</span></div>)}
            </>}
            {userMsg && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>{userMsg}</div>}
          </>}
          {tab === "baseline" && <>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>P6 Baseline</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14, maxWidth: "74ch", lineHeight: 1.55 }}>
              Upload a programme baseline for this project: Primavera P6 (.xer), Microsoft Project (.xml, via Save As \u2192 XML), or a spreadsheet (.csv / .xlsx). DLP reads the activities, milestones and dates and keeps them read-only for comparison against the live programme on the Schedule. Spreadsheets get a quick column-mapping step. Re-uploading replaces the stored baseline.
            </div>
            {blErr && <div style={{ marginBottom: 10, fontSize: 12.5, color: "var(--red)", background: "rgba(192,57,43,.08)", border: "1px solid rgba(192,57,43,.3)", borderRadius: 8, padding: "8px 11px" }}>{blErr}</div>}
            {blMsg && <div style={{ marginBottom: 10, fontSize: 12.5, color: "#0E9384", background: "rgba(14,147,132,.08)", border: "1px solid rgba(14,147,132,.3)", borderRadius: 8, padding: "8px 11px" }}>{blMsg}</div>}
            {bl && bl.meta && !blPrev && !blTab && (() => { const m = bl.meta || {}; const c = m.counts || {}; return (
              <div style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--card)", padding: 14, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <span className="mono" style={{ fontSize: 10, letterSpacing: ".04em", color: "var(--muted)", border: "1px solid var(--line)", borderRadius: 5, padding: "2px 7px" }}>P6 BASELINE</span>
                  <span style={{ fontWeight: 600 }}>{bl.source_filename || "baseline.xer"}</span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{bl.imported_at ? "imported " + fmtDate(bl.imported_at) : ""}</span>
                </div>
                <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 12.5 }}>
                  <div><div style={{ color: "var(--muted)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em" }}>Project</div><b>{m.project || "\u2014"}</b></div>
                  <div><div style={{ color: "var(--muted)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em" }}>Data date</div><b>{m.dataDate || "\u2014"}</b></div>
                  <div><div style={{ color: "var(--muted)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em" }}>Plan span</div><b>{(m.planStart || m.spanStart || "\u2014") + "  \u2192  " + (m.planEnd || m.spanEnd || "\u2014")}</b></div>
                  <div><div style={{ color: "var(--muted)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em" }}>Activities</div><b>{c.activities != null ? c.activities : "\u2014"}</b></div>
                  <div><div style={{ color: "var(--muted)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em" }}>Milestones</div><b>{c.milestones != null ? c.milestones : "\u2014"}</b></div>
                  <div><div style={{ color: "var(--muted)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em" }}>WBS nodes</div><b>{c.wbs != null ? c.wbs : "\u2014"}</b></div>
                </div>
                {blMiles(bl.activities).length > 0 && <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <div className="grphd" style={{ marginBottom: 6 }}>Milestones ({blMiles(bl.activities).length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 220, overflow: "auto" }}>
                    {blMiles(bl.activities).map((a) => <div key={a.pid} style={{ display: "flex", gap: 10, fontSize: 11.5, alignItems: "baseline" }}>
                      <span className="mono" style={{ color: "var(--muted)", minWidth: 84 }}>{a.end}</span>
                      <span className="mono" style={{ color: "var(--muted)", minWidth: 64 }}>{a.code}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                    </div>)}
                  </div>
                </div>}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <label className="lk-btn"><input type="file" accept=".xer,.xml,.csv,.xlsx" style={{ display: "none" }} onChange={(e) => { onXerFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />Replace baseline</label>
                  <button className="lk-btn" style={{ color: "var(--red)" }} disabled={blBusy} onClick={removeBl}>Remove baseline</button>
                </div>
              </div>); })()}
            {bl && bl.meta && !blPrev && !blTab && (() => {
              const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
              const liveActs = (S.activities || []).slice().sort((a, b) => (a.desc || "").localeCompare(b.desc || ""));
              const allItems = bl.activities || [];
              const baseItems = (mapAll ? allItems : allItems.filter((a) => a.ms)).filter((a) => { if (!mapQ) return true; const q = mapQ.toLowerCase(); return (a.name || "").toLowerCase().indexOf(q) !== -1 || String(a.code || "").toLowerCase().indexOf(q) !== -1; });
              const shown = mapAll ? baseItems.slice(0, 60) : baseItems;
              const suggest = (item) => { const n = norm(item.name); if (!n) return ""; let hit = liveActs.find((l) => norm(l.desc) === n); if (!hit) hit = liveActs.find((l) => { const ln = norm(l.desc); return ln && (ln.indexOf(n) !== -1 || n.indexOf(ln) !== -1); }); return hit ? hit.id : ""; };
              const mappedCount = Object.keys(mapDraft).filter((k) => mapDraft[k]).length;
              return (
              <div style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--card)", padding: 14, marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Activity mapping</span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{mappedCount} mapped</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, maxWidth: "74ch" }}>Map P6 baseline activities to their live counterparts so Compare can show per-row variance. Milestones matter most; unmapped baseline items still appear on the Schedule aligned by date.</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                  <input className="lk-in" placeholder="Search baseline activities\u2026" value={mapQ} onChange={(e) => setMapQ(e.target.value)} style={{ maxWidth: 260 }} />
                  <button className={"lk-btn" + (mapAll ? " on" : "")} onClick={() => setMapAll((v) => !v)}>{mapAll ? "All activities" : "Milestones only"}</button>
                  <div style={{ flex: 1 }} />
                  {mapSaved && <span style={{ fontSize: 11.5, color: "#0E9384" }}>Saved</span>}
                  <button className="lk-btn primary" disabled={blBusy} onClick={async () => { setBlBusy(true); setBlErr(""); try { await saveBaselineMappings(S.projectId, mapDraft); setBl({ ...bl, mappings: { ...mapDraft } }); setMapSaved(true); setTimeout(() => setMapSaved(false), 2500); } catch (e) { setBlErr(e && e.message ? e.message : "Mapping save failed."); } setBlBusy(false); }}>Save mapping</button>
                </div>
                <div style={{ maxHeight: 360, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
                  {shown.length === 0 ? <div style={{ padding: 14, fontSize: 12.5, color: "var(--muted)" }}>No baseline activities match.</div> : shown.map((item) => { const sug = suggest(item); const val = mapDraft[item.pid] || ""; return (
                    <div key={item.pid} style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 10, alignItems: "center", padding: "7px 10px", borderBottom: "1px solid var(--line)" }}>
                      <div style={{ minWidth: 0 }}><div style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.ms && <span style={{ display: "inline-block", width: 8, height: 8, background: "var(--muted)", transform: "rotate(45deg)", marginRight: 6, verticalAlign: "middle" }} />}{item.name}</div><div className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{item.code} \u00b7 {item.end || item.start}</div></div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <select className="lk-select" value={val} onChange={(e) => setMapDraft((m) => ({ ...m, [item.pid]: e.target.value }))} style={{ flex: 1, minWidth: 0 }}>
                          <option value="">{"\u2014 unmapped \u2014"}</option>
                          {liveActs.map((l) => <option key={l.id} value={l.id}>{(l.code != null ? "#" + l.code + " " : "") + (l.desc || "Untitled")}</option>)}
                        </select>
                        {!val && sug && <button className="lk-btn" title="Use suggested match" style={{ whiteSpace: "nowrap", fontSize: 11 }} onClick={() => setMapDraft((m) => ({ ...m, [item.pid]: sug }))}>Suggest</button>}
                      </div>
                    </div>); })}
                </div>
                {mapAll && baseItems.length > shown.length && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>Showing first {shown.length} of {baseItems.length}. Refine the search to see more.</div>}
              </div>); })()}
            {!bl && !blPrev && !blTab && <div style={{ border: "1px dashed var(--line)", borderRadius: 10, padding: 22, textAlign: "center", background: "var(--card)" }}>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>No P6 baseline stored for this project yet.</div>
              <label className="lk-btn primary"><input type="file" accept=".xer,.xml,.csv,.xlsx" style={{ display: "none" }} onChange={(e) => { onXerFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />{blBusy ? "Reading\u2026" : "Upload .xer / .xml / .csv / .xlsx"}</label>
            </div>}
            {blPrev && (() => { const m = blPrev.meta || {}; const c = m.counts || {}; return (
              <div style={{ border: "1px solid var(--accent)", borderRadius: 10, background: "var(--card)", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Preview</span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{blPrev.source_filename}</span>
                </div>
                <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 12.5, marginBottom: 10 }}>
                  <div><div style={{ color: "var(--muted)", fontSize: 10.5, textTransform: "uppercase" }}>Project</div><b>{m.project || "\u2014"}</b></div>
                  <div><div style={{ color: "var(--muted)", fontSize: 10.5, textTransform: "uppercase" }}>Data date</div><b>{m.dataDate || "\u2014"}</b></div>
                  <div><div style={{ color: "var(--muted)", fontSize: 10.5, textTransform: "uppercase" }}>Plan span</div><b>{(m.planStart || m.spanStart || "\u2014") + "  \u2192  " + (m.planEnd || m.spanEnd || "\u2014")}</b></div>
                  <div><div style={{ color: "var(--muted)", fontSize: 10.5, textTransform: "uppercase" }}>Activities</div><b>{c.activities != null ? c.activities : "\u2014"}</b></div>
                  <div><div style={{ color: "var(--muted)", fontSize: 10.5, textTransform: "uppercase" }}>Milestones</div><b>{c.milestones != null ? c.milestones : "\u2014"}</b></div>
                </div>
                {blMiles(blPrev.activities).length > 0 && <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <div className="grphd" style={{ marginBottom: 6 }}>Milestones found ({blMiles(blPrev.activities).length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 200, overflow: "auto" }}>
                    {blMiles(blPrev.activities).map((a) => <div key={a.pid} style={{ display: "flex", gap: 10, fontSize: 11.5, alignItems: "baseline" }}>
                      <span className="mono" style={{ color: "var(--muted)", minWidth: 84 }}>{a.end}</span>
                      <span className="mono" style={{ color: "var(--muted)", minWidth: 64 }}>{a.code}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                    </div>)}
                  </div>
                </div>}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="lk-btn primary" disabled={blBusy} onClick={saveBl}>{blBusy ? "Saving\u2026" : "Save baseline"}</button>
                  <button className="lk-btn" disabled={blBusy} onClick={() => { setBlPrev(null); setBlErr(""); }}>Discard</button>
                </div>
              </div>); })()}
            {blTab && blMap && (() => {
              const headers = blTab.headers;
              const auto = autodetectMapping(headers);
              const setM = (patch) => setBlMap((mm) => ({ ...mm, ...patch }));
              const opts = (cur, req) => [<option key="n" value={-1}>{req ? "\u2014 select \u2014" : "\u2014 none \u2014"}</option>, ...headers.map((h, i) => <option key={i} value={i}>{h || ("Column " + (i + 1))}</option>)];
              const FIELDS = [["name", "Activity name", true, "The activity description."], ["start", "Start", true, "Planned / baseline start."], ["finish", "Finish", false, "Defaults to Start for milestones."], ["code", "Activity ID", false, "Optional reference."], ["wbs", "WBS / Phase", false, "Used for grouping."]];
              const prev = tabularToBaseline(blTab, blMap, blMap, blTab.filename);
              const ready = blMap.name >= 0 && blMap.start >= 0;
              const seg = (on) => ({ border: "1px solid var(--line)", background: on ? "var(--accent)" : "transparent", color: on ? "#fff" : "var(--muted)", fontWeight: 600, fontSize: 11.5, padding: "6px 11px", borderRadius: 7, cursor: "pointer" });
              const selS = (hl) => ({ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", background: "var(--card)", border: "1px solid " + (hl ? "var(--accent)" : "var(--line)"), borderRadius: 8, padding: "7px 10px", maxWidth: 320, width: "100%" });
              const mini = { fontSize: 11.5, fontWeight: 600, color: "var(--ink)", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 7, padding: "5px 8px" };
              const thS = { textAlign: "left", fontSize: 9, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--muted)", fontWeight: 700, padding: "6px 8px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" };
              const tdS = { padding: "6px 8px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" };
              return (
              <div style={{ border: "1px solid var(--accent)", borderRadius: 10, background: "var(--card)", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Map columns</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{blTab.filename} \u00b7 {headers.length} cols \u00b7 {blTab.rows.length} rows</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Confirm or change which column maps to each field. Required fields must be set; auto-detected columns are outlined in violet.</div>
                {FIELDS.map(([k, label, req, hint]) => { const hl = auto[k] === blMap[k] && blMap[k] >= 0; return (
                  <div key={k} style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: 14, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                    <div><div style={{ fontWeight: 600 }}>{label} {req ? <span style={{ fontSize: 9, fontWeight: 700, color: "var(--red)" }}>REQUIRED</span> : <span style={{ fontSize: 9, fontWeight: 700, color: "var(--muted)" }}>OPTIONAL</span>}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{hint}</div></div>
                    <div style={{ display: "flex", alignItems: "center" }}><select value={blMap[k]} onChange={(e) => setM({ [k]: parseInt(e.target.value, 10) })} style={selS(hl)}>{opts(blMap[k], req)}</select>{hl && <span className="mono" style={{ fontSize: 9, color: "var(--accent)", marginLeft: 8 }}>auto</span>}</div>
                  </div>); })}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Milestone rule</span>
                  <button style={seg(blMap.msRule === "col")} onClick={() => setM({ msRule: "col" })}>From a column</button>
                  <button style={seg(blMap.msRule === "zero")} onClick={() => setM({ msRule: "zero" })}>Zero-duration</button>
                  {blMap.msRule === "col" && <span style={{ fontSize: 12, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>when <select value={blMap.msCol} onChange={(e) => setM({ msCol: parseInt(e.target.value, 10) })} style={mini}>{opts(blMap.msCol, false)}</select> = <input value={blMap.msVal} onChange={(e) => setM({ msVal: e.target.value })} style={{ ...mini, width: 110 }} /></span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--muted)" }}>Date format</span>
                  {[["auto", "Auto"], ["iso", "ISO"], ["dmy", "DD/MM/YYYY"], ["mdy", "MM/DD/YYYY"]].map(([d, t]) => <button key={d} style={seg(blMap.dateFmt === d)} onClick={() => setM({ dateFmt: d })}>{t}</button>)}
                </div>
                <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <div className="grphd" style={{ marginBottom: 6 }}>Preview</div>
                  <div style={{ overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                      <thead><tr>{["Activity", "ID", "WBS", "Start", "Finish"].map((h) => <th key={h} style={thS}>{h}</th>)}</tr></thead>
                      <tbody>{prev.activities.slice(0, 6).map((a) => <tr key={a.pid}>
                        <td style={tdS}>{a.ms && <span style={{ display: "inline-block", width: 8, height: 8, background: "var(--red)", transform: "rotate(45deg)", borderRadius: 1, marginRight: 6, verticalAlign: "middle" }} />}{a.name}</td>
                        <td style={tdS} className="mono">{a.code || "\u2014"}</td>
                        <td style={tdS} className="mono">{(a.wbs ? (prev.wbs[a.wbs] || {}).name : "") || "\u2014"}</td>
                        <td style={tdS} className="mono">{a.start || "?"}</td>
                        <td style={tdS} className="mono">{a.end || "\u2014"}</td>
                      </tr>)}</tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{ready ? <>Ready: <b style={{ color: "var(--ink)" }}>{prev.meta.counts.activities}</b> activities, <b style={{ color: "var(--ink)" }}>{prev.meta.counts.milestones}</b> milestones detected.</> : <span style={{ color: "#E0A106" }}>Map Activity name and Start to continue.</span>}</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="lk-btn primary" disabled={!ready || blBusy} onClick={saveBlTab}>{blBusy ? "Saving\u2026" : "Save baseline"}</button>
                  <button className="lk-btn" disabled={blBusy} onClick={() => { setBlTab(null); setBlMap(null); setBlErr(""); }}>Discard</button>
                </div>
              </div>); })()}
          </>}
          {tab === "branding" && <>
            <div className="lk-f"><label>Project Name</label>
              <input className="lk-in" value={S.brand?.projectName || ""} placeholder="FIN04" onChange={(e) => update((p) => ({ ...p, brand: { ...p.brand, projectName: e.target.value } }))} /></div>
            <div className="lk-f"><label>App Name</label>
              <input className="lk-in" value={S.brand?.appName || ""} placeholder="DLP" onChange={(e) => update((p) => ({ ...p, brand: { ...p.brand, appName: e.target.value } }))} /></div>
            <div className="lk-f"><label>Tagline</label>
              <input className="lk-in" value={S.brand?.tagline || ""} placeholder="Collaborative Digital Planning" onChange={(e) => update((p) => ({ ...p, brand: { ...p.brand, tagline: e.target.value } }))} /></div>
            <button className="lk-btn primary" onClick={async () => {
              setBrandMsg("Saving…");
              try { await updateBranding({ project_name: S.brand.projectName, app_name: S.brand.appName, tagline: S.brand.tagline }, S.projectId); setBrandMsg("Text saved"); }
              catch (e) { setBrandMsg("Failed: " + (e.message || e)); }
            }}><Icon n="check" s={15} />Save text</button>
            <div className="lk-f" style={{ marginTop: 14 }}><label>Customer Logo</label>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 4 }}>
                {[["light", "Light mode", S.brand?.logoUrl, false, "#ffffff"], ["dark", "Dark mode", S.brand?.logoDark, true, "#0f172a"]].map(([k, lbl, url, dark, bg]) => <div key={k} style={{ flex: "1 1 170px" }}>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginBottom: 4 }}>{lbl}</div>
                  <div style={{ background: bg, border: "1px solid var(--line)", borderRadius: 8, padding: 8, minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {url ? <img src={url} alt="" style={{ height: 40, maxWidth: 160, objectFit: "contain" }} /> : <span style={{ fontSize: 11, color: "#94a3b8" }}>none</span>}
                  </div>
                  <input className="lk-in" style={{ marginTop: 6 }} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={async (e) => {
                    const f = e.target.files && e.target.files[0]; if (!f) return;
                    setBrandMsg("Uploading " + lbl + " logo…");
                    try { const u = await uploadLogo(f, dark, S.projectId); update((p) => ({ ...p, brand: { ...p.brand, [dark ? "logoDark" : "logoUrl"]: u } })); setBrandMsg(lbl + " logo updated"); }
                    catch (x) { setBrandMsg("Failed: " + (x.message || x)); }
                    e.target.value = "";
                  }} />
                  {url && <button className="lk-btn" style={{ marginTop: 6, fontSize: 11 }} onClick={async () => { try { await updateBranding({ [dark ? "logo_url_dark" : "logo_url"]: null }, S.projectId); update((p) => ({ ...p, brand: { ...p.brand, [dark ? "logoDark" : "logoUrl"]: null } })); setBrandMsg(lbl + " logo removed"); } catch (x) { setBrandMsg("Failed: " + (x.message || x)); } }}>Remove</button>}
                </div>)}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 6 }}>PNG, JPG, SVG or WebP, wide transparent PNG looks best. Set one for each theme; if you set only one, it is used in both modes.</div>
            </div>
            {brandMsg && <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{brandMsg}</div>}
          </>}
          {tab === "settings" && <>
            <div className="lk-f"><label>Lookahead Length</label>
              <div className="lk-status">{[2, 4, 6, 8, 12].map((w) => <button key={w} className={S.settings.weeks === w ? "sel" : ""} onClick={() => update((p) => ({ ...p, settings: { ...p.settings, weeks: w } }), { action: "Change setting", detail: `Lookahead ${w} weeks` })}>{w} weeks</button>)}</div></div>
            <div className="lk-f"><label>Make-Ready Window (Days)</label>
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
            <div className="lk-f"><label>Import Mode</label>
              <div className="lk-status"><button className={impMode === "append" ? "sel" : ""} onClick={() => setImpMode("append")}>Append</button><button className={impMode === "override" ? "sel" : ""} onClick={() => setImpMode("override")}>Override</button></div></div>
            <div className="lk-f"><label>Import File (.xlsx or .csv Activities, or .json Project)</label>
              <input className="lk-in" type="file" accept=".json,.csv,.xlsx" onChange={handleImportFile} /></div>
            <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>JSON sets up the whole project: companies, buildings, levels, zones/rooms, systems, Cx stages, settings and activities. CSV imports activities and auto-creates any new company, building, level, zone/room or system it names, so a CSV alone can stand a project up. Columns are Building, Level, Zone / Room and Cx Stage. Override replaces the project wholesale; Append in JSON opens a review screen where you overwrite, ignore or clone each clashing item.</div>
            {impMsg && <div className="lk-pv" style={{ borderRadius: 8, border: "1px solid var(--line)" }}><Icon n="alert" s={13} />{impMsg}</div>}
          </>}
          {tab === "audit" && <>
            <div className="lk-pv" style={{ borderRadius: 8, border: "1px solid var(--line)" }}><Icon n="alert" s={13} />Complete history of every action by every user, admin only. In production the database writes this on every change and it cannot be edited here.</div>
            <div className="lk-f"><label>Filter By User</label>
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
      {confirmAsk && <div className="lk-modal-bg" onClick={() => setConfirmAsk(null)}>
        <div className="lk-modal" style={{ ...cssVars(S.theme), maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
          <div className="lk-dh"><h3>Are you sure?</h3><button className="lk-btn icon" onClick={() => setConfirmAsk(null)}><Icon n="x" /></button></div>
          <div className="bd"><div style={{ fontSize: 14, lineHeight: 1.5 }}>{confirmAsk.msg}</div><div style={{ fontSize: 12, color: "var(--muted)" }}>This cannot be undone.</div></div>
          <div className="rep-foot"><button className="lk-btn" onClick={() => setConfirmAsk(null)}>No</button><button className="lk-btn" style={{ background: "#C0392B", color: "#fff", borderColor: "#C0392B" }} onClick={() => { const fn = confirmAsk.fn; setConfirmAsk(null); fn && fn(); }}><Icon n="trash" s={14} />Yes, delete</button></div>
        </div>
      </div>}
      {approve && (() => {
        const m = matchCompanyByEmail(approve.email);
        const d = domainOf(approve.email); const free = FREE_DOMAINS.includes(d);
        const selCo = S.companies.find((c) => c.id === approve.companyId);
        const showRemember = !!d && !free && (approve.createNew || (approve.companyId && !(selCo && (selCo.domain || "").toLowerCase() === d)));
        return <div className="lk-modal-bg" onClick={() => !reqBusy && setApprove(null)}>
          <div className="lk-modal" style={{ ...cssVars(S.theme), maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="lk-dh"><h3>Approve Access</h3><button className="lk-btn icon" onClick={() => setApprove(null)}><Icon n="x" /></button></div>
            <div className="bd">
              <div className="lk-f"><label>Full Name</label><input className="lk-in" value={approve.name} onChange={(e) => setApprove((a) => ({ ...a, name: e.target.value }))} /></div>
              <div className="lk-f"><label>Work Email</label><input className="lk-in" value={approve.email} onChange={(e) => setApproveEmail(e.target.value)} /><div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>The invite and set-password link go to this address. Editing it re-checks the company match.</div></div>
              {m.type === "exact" && <div className="lk-match exact"><Icon n="check" s={15} />Matched to {m.company.name} on {m.domain}</div>}
              {m.type === "fuzzy" && <div className="lk-match fuzzy"><Icon n="alert" s={15} />Best guess {m.company.name} from {m.domain}. Confirm or change.</div>}
              {m.type === "free" && <div className="lk-match none"><Icon n="alert" s={15} />{m.domain} is a personal email provider. Assign manually.</div>}
              {m.type === "unknown" && <div className="lk-match none"><Icon n="alert" s={15} />No company matches {m.domain}. Pick one or create a new company.</div>}
              <div className="lk-f"><label>Assign To Company</label>
                <select className="lk-select" value={approve.createNew ? "__new__" : approve.companyId} onChange={(e) => { const v = e.target.value; if (v === "__new__") { setApprove((a) => ({ ...a, createNew: true, touched: true, newName: a.newName || a.req.organisation || (domainOf(a.email) ? titleCaseStr(domainLabel(domainOf(a.email))) : "") })); } else { setApprove((a) => ({ ...a, createNew: false, touched: true, companyId: v })); } }}>
                  <option value="">Select a company…</option>
                  {S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.domain ? "  (" + c.domain + ")" : ""}</option>)}
                  <option value="__new__">+ Create new company…</option>
                </select>
                {approve.createNew && <input className="lk-in" style={{ marginTop: 8 }} placeholder="New company name" value={approve.newName} onChange={(e) => setApprove((a) => ({ ...a, newName: e.target.value }))} />}
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>Stated organisation: <b style={{ color: "var(--ink-2)" }}>{approve.req.organisation || "none given"}</b></div>
              </div>
              {showRemember && <label className="lk-remember"><input type="checkbox" checked={approve.remember} onChange={(e) => setApprove((a) => ({ ...a, remember: e.target.checked }))} /><span>Remember {d} for {approve.createNew ? "this company" : (selCo ? selCo.name : "this company")}</span></label>}
              <div className="lk-f"><label>Project Access</label>
                <label className="lk-remember"><input type="checkbox" checked={approve.grantProject} onChange={(e) => setApprove((a) => ({ ...a, grantProject: e.target.checked }))} /><span>Add to <b>{S.brand?.projectName || "this project"}</b> on approval</span></label>
                {approve.grantProject && <div className="lk-row" style={{ marginTop: 8, alignItems: "center" }}><span style={{ fontSize: 11.5, color: "var(--muted)" }}>as</span><select className="lk-select" style={{ maxWidth: 160 }} value={approve.projRole} onChange={(e) => setApprove((a) => ({ ...a, projRole: e.target.value }))}><option value="member">Member</option><option value="admin">Admin</option></select></div>}
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>{approve.grantProject ? "They can open this project immediately, with no separate invite to accept." : "Creates their account only; add them to projects later under Members."}</div>
              </div>
              {userMsg && <div style={{ fontSize: 11.5, color: "var(--red)" }}>{userMsg}</div>}
            </div>
            <div className="rep-foot"><button className="lk-btn" disabled={reqBusy} onClick={() => setApprove(null)}>Cancel</button><button className="lk-btn primary" disabled={reqBusy} onClick={doApprove}>{reqBusy ? "Working…" : "Approve And Invite"}</button></div>
          </div>
        </div>;
      })()}
      {rejecting && <div className="lk-modal-bg" onClick={() => !reqBusy && setRejecting(null)}>
        <div className="lk-modal" style={{ ...cssVars(S.theme), maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
          <div className="lk-dh"><h3>Reject Request</h3><button className="lk-btn icon" onClick={() => setRejecting(null)}><Icon n="x" /></button></div>
          <div className="bd">
            <div style={{ fontSize: 14 }}>Reject the request from <b>{rejecting.req.name || rejecting.req.email}</b>?</div>
            <div className="lk-f"><label>Reason (Optional, Internal)</label><textarea className="lk-in" rows={3} value={rejecting.reason} onChange={(e) => setRejecting((r) => ({ ...r, reason: e.target.value }))} style={{ resize: "vertical", fontFamily: "inherit" }} /></div>
          </div>
          <div className="rep-foot"><button className="lk-btn" disabled={reqBusy} onClick={() => setRejecting(null)}>Cancel</button><button className="lk-btn" style={{ background: "#C0392B", color: "#fff", borderColor: "#C0392B" }} disabled={reqBusy} onClick={doReject}>{reqBusy ? "Working…" : "Reject Request"}</button></div>
        </div>
      </div>}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><h3 style={{ margin: 0 }}>Review Project Import</h3><button className="lk-btn icon" onClick={onClose}><Icon n="x" /></button></div>
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

function CompanyModal({ co, logo, S, onClose }) {
  return (
    <div className="lk-bg" onClick={onClose}>
      <div className="ytt drill" style={{ ...cssVars(S.theme), maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="ytt-head">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {logo ? <img src={logo} alt="" style={{ height: 30, maxWidth: 150, objectFit: "contain" }} /> : <Icon n="shield" s={18} />}
            <h3 style={{ margin: 0, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{co.name}</h3>
          </div>
          <button className="lk-btn icon" onClick={onClose}><Icon n="x" /></button>
        </div>
        <div className="drill-body" style={{ padding: "14px 16px 18px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 7 }}>Role &amp; Scope</div>
          {co.description ? <div style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{co.description}</div>
            : <div style={{ fontSize: 13, color: "var(--muted)" }}>No description added yet. An admin can add one in Settings, Companies.</div>}
        </div>
      </div>
    </div>
  );
}

const DRILL_ICONS = { "in lookahead": ["cal", "var(--muted)"], "total activities": ["list", "var(--muted)"], "ready to run": ["play", "#0E9384"], "need make-ready": ["wrench", "#D97706"], "committed this week": ["checkcircle", "var(--accent)"], "committed": ["checkcircle", "var(--accent)"], "delayed": ["clock", "#C0392B"], "at risk": ["alert", "#E0A106"], "complete": ["check", "#0E9384"], "in progress": ["loader", "var(--muted)"], "planned": ["cal", "var(--muted)"], "witness required": ["eye", "#7A4FD0"] };
const drillIcon = (t) => DRILL_ICONS[(t || "").trim().toLowerCase()] || ["chart", null];

function DrillModal({ title, items, S, LV, coName, onOpen, onClose }) {
  const [dIcon, dColor] = drillIcon(title);
  return (
    <div className="lk-bg" onClick={onClose}>
      <div className="ytt drill" style={cssVars(S.theme)} onClick={(e) => e.stopPropagation()}>
        <div className="ytt-head">
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}><span style={{ color: dColor || "inherit", display: "inline-flex", flex: "none" }}><Icon n={dIcon} s={17} /></span><h3 style={{ margin: 0, fontSize: 15.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</h3><span className="ytt-sub">{items.length} activit{items.length === 1 ? "y" : "ies"}</span></div>
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

function BaselineGantt({ baseline, LV, dark, zoom, compact, P }) {
  const [collapsed, setCollapsed] = useState({});
  const svgRef = useRef(null);
  const wbs = (baseline && baseline.wbs) || {};
  const groupName = (a) => { const p = wbsPath(wbs, a.wbs); return p.length > 1 ? p[1] : (p[0] || "Ungrouped"); };
  const items = ((baseline && baseline.activities) || []).filter((a) => a.start).map((a) => ({ id: a.pid, code: a.code, name: a.name || "Untitled", s: parseD(a.start), e: parseD(a.end || a.start), ms: !!a.ms, crit: !!a.crit, grp: groupName(a) }));

  const ppd = zoom === "day" ? 30 : zoom === "week" ? 9.6 : 4.4;
  const rowH = compact ? 22 : 30, headH = 46, leftW = 300;
  let t0, t1;
  if (items.length) { t0 = mondayOf(new Date(Math.min(...items.map((i) => i.s.getTime())))); t1 = new Date(Math.max(...items.map((i) => i.e.getTime()))); }
  else { t0 = mondayOf(new Date()); t1 = addDays(t0, 28); }
  t1 = addDays(mondayOf(addDays(t1, 7)), 6);
  const dayOff = (d) => Math.round((d.getTime() - t0.getTime()) / DAYMS);
  const N = Math.max(7, dayOff(t1) + 1);
  const tlW = N * ppd, W = leftW + tlW;
  const xOf = (off) => leftW + off * ppd;

  const groups = {}; items.forEach((it) => { (groups[it.grp] = groups[it.grp] || []).push(it); });
  const rows = [];
  Object.keys(groups).sort().forEach((k) => { rows.push({ t: "grp", k, n: groups[k].length }); if (!collapsed[k]) groups[k].slice().sort((a, b) => a.s - b.s).forEach((it) => rows.push({ t: "task", it })); });
  const H = headH + rows.length * rowH + 8;

  const months = []; { let d = new Date(t0.getFullYear(), t0.getMonth(), 1); while (d <= t1) { const next = new Date(d.getFullYear(), d.getMonth() + 1, 1); const xs = xOf(Math.max(0, dayOff(d < t0 ? t0 : d))); const xe = xOf(dayOff(next > t1 ? t1 : next)); months.push({ label: d.toLocaleString("en-GB", { month: "short", year: "2-digit" }), xs, xe }); d = next; } }
  const ticks = []; { for (let i = 0; i <= N; i++) { const d = addDays(t0, i); const isMon = d.getDay() === 1; const first = d.getDate() === 1; if (zoom === "day") { ticks.push({ x: xOf(i), label: String(d.getDate()), strong: isMon }); } else if (zoom === "week") { if (isMon) ticks.push({ x: xOf(i), label: String(d.getDate()), strong: false }); } else { if (first) ticks.push({ x: xOf(i), label: "", strong: true }); } } }
  const todayX = leftW + dayOff(new Date(todayMid())) * ppd;
  const text = (x, y, s, o = {}) => <text x={x} y={y} fontFamily="Segoe UI, Arial, sans-serif" fill={o.fill || P.ink} fontSize={o.size || 11} fontWeight={o.weight || 400} textAnchor={o.anchor || "start"} dominantBaseline={o.baseline || "middle"} style={{ pointerEvents: "none" }}>{s}</text>;
  const BASE = dark ? "#8A97A6" : "#94A3B8";
  const CRIT = dark ? "#E06C6C" : "#C0392B";

  const svgString = () => { const c = svgRef.current.cloneNode(true); c.setAttribute("xmlns", "http://www.w3.org/2000/svg"); return new XMLSerializer().serializeToString(c); };
  const exportImg = (type) => { const str = svgString(); const img = new Image(); img.onload = () => { const sc = 2; const cv = document.createElement("canvas"); cv.width = W * sc; cv.height = H * sc; const ctx = cv.getContext("2d"); ctx.fillStyle = P.bg; ctx.fillRect(0, 0, cv.width, cv.height); ctx.scale(sc, sc); ctx.drawImage(img, 0, 0); const url = cv.toDataURL(type === "jpg" ? "image/jpeg" : "image/png", 0.92); const a = document.createElement("a"); a.href = url; a.download = `FIN04-P6-baseline-${fmtISO(new Date())}.${type}`; a.click(); }; img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(str))); };

  const meta = (baseline && baseline.meta) || {};
  return (
    <div className="lk-sch-scroll" style={{ background: P.bg }}>
      {items.length === 0 ? <div className="lk-empty">The stored baseline has no dated activities.</div> : <>
      <div style={{ display: "flex", gap: 10, padding: "8px 12px", alignItems: "center", borderBottom: "1px solid " + P.line, background: P.bg }}>
        <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 11, color: P.mut }}>{(meta.project || "P6 baseline")}{baseline.source_filename ? " \u00b7 " + baseline.source_filename : ""} \u00b7 {items.length} activities \u00b7 {items.filter((i) => i.ms).length} milestones{meta.dataDate ? " \u00b7 data date " + meta.dataDate : ""}</span>
        <div style={{ flex: 1 }} />
        <button className="lk-btn" onClick={() => exportImg("png")}><Icon n="download" s={13} />PNG</button>
        <button className="lk-btn" onClick={() => exportImg("jpg")}><Icon n="download" s={13} />JPG</button>
      </div>
      <svg className="lk-sch-axis" width={W} height={headH} viewBox={`0 0 ${W} ${headH}`} xmlns="http://www.w3.org/2000/svg" style={{ position: "sticky", top: 0, zIndex: 3, display: "block", marginBottom: -headH, background: P.bg, fontFamily: "Segoe UI, Arial, sans-serif" }}>
        <rect x={0} y={0} width={W} height={headH} fill={P.bg} />
        {months.map((m, i) => <g key={"hm" + i}><rect x={m.xs} y={0} width={Math.max(0, m.xe - m.xs)} height={22} fill={i % 2 ? P.band2 : P.band} />{(m.xe - m.xs) > 26 && text((m.xs + m.xe) / 2, 11, m.label, { anchor: "middle", size: 10.5, weight: 700, fill: P.mut })}</g>)}
        {ticks.map((t, i) => <g key={"ht" + i}><line x1={t.x} y1={22} x2={t.x} y2={headH} stroke={t.strong ? P.gridStrong : P.grid} strokeWidth="1" />{t.label && zoom !== "month" && text(t.x + 2, 34, t.label, { size: 9.5, fill: P.mut })}</g>)}
        <line x1={leftW} y1={0} x2={leftW} y2={headH} stroke={P.line} strokeWidth="1" />
        <line x1={0} y1={headH} x2={W} y2={headH} stroke={P.line} strokeWidth="1" />
        {todayX >= leftW && todayX <= W && <g><line x1={todayX} y1={22} x2={todayX} y2={headH} stroke={P.today} strokeWidth="1.5" strokeDasharray="3 3" />{text(todayX + 3, headH - 4, "today", { size: 9, fill: P.today, weight: 700 })}</g>}
      </svg>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{ background: P.bg, fontFamily: "Segoe UI, Arial, sans-serif", position: "relative", zIndex: 1 }}>
        <rect x={0} y={0} width={W} height={H} fill={P.bg} />
        {months.map((m, i) => <g key={"m" + i}><rect x={m.xs} y={0} width={Math.max(0, m.xe - m.xs)} height={22} fill={i % 2 ? P.band2 : P.band} />{(m.xe - m.xs) > 26 && text((m.xs + m.xe) / 2, 11, m.label, { anchor: "middle", size: 10.5, weight: 700, fill: P.mut })}</g>)}
        {ticks.map((t, i) => <g key={"t" + i}><line x1={t.x} y1={22} x2={t.x} y2={H} stroke={t.strong ? P.gridStrong : P.grid} strokeWidth="1" />{t.label && zoom !== "month" && text(t.x + 2, 34, t.label, { size: 9.5, fill: P.mut })}</g>)}
        <line x1={leftW} y1={0} x2={leftW} y2={H} stroke={P.line} strokeWidth="1" />
        <line x1={0} y1={headH} x2={W} y2={headH} stroke={P.line} strokeWidth="1" />
        {todayX >= leftW && todayX <= W && <line x1={todayX} y1={headH} x2={todayX} y2={H} stroke={P.today} strokeWidth="1.5" strokeDasharray="3 3" />}
        {rows.map((r, i) => { const y = headH + i * rowH; if (r.t === "grp") { const open = !collapsed[r.k]; return <g key={"g" + r.k} style={{ cursor: "pointer" }} onClick={() => setCollapsed((c) => ({ ...c, [r.k]: !c[r.k] }))}><rect x={0} y={y} width={W} height={rowH} fill={P.header} /><text x={10} y={y + rowH / 2} fontSize="10" fill={P.mut} dominantBaseline="middle">{open ? "\u25BC" : "\u25B6"}</text>{text(24, y + rowH / 2, `${r.k}  (${r.n})`, { weight: 700, size: 11.5, fill: P.ink })}</g>; } const it = r.it; const nm = it.name; return <g key={"tb" + it.id}>{i % 2 === 0 && <rect x={0} y={y} width={W} height={rowH} fill={P.row} />}<line x1={0} y1={y + rowH} x2={W} y2={y + rowH} stroke={P.sep} strokeWidth="1" />{text(10, y + rowH / 2, it.code || "", { size: 9.5, fill: P.mut })}<text x={42} y={y + rowH / 2} fontSize="11.5" fill={P.ink} dominantBaseline="middle" style={{ pointerEvents: "none" }}>{nm.length > 34 ? nm.slice(0, 33) + "\u2026" : nm}</text></g>; })}
        {rows.map((r, i) => { if (r.t !== "task") return null; const it = r.it; const y = headH + i * rowH, yc = y + rowH / 2; const xs = xOf(dayOff(it.s)); const xe = xOf(dayOff(it.e) + 1); const barH = rowH - 12, barY = y + (rowH - barH) / 2; const col = it.crit ? CRIT : BASE; if (it.ms) { return <polygon key={"ms" + it.id} points={`${xs},${yc - 6} ${xs + 6},${yc} ${xs},${yc + 6} ${xs - 6},${yc}`} fill={dark ? P.bg : "#FFFFFF"} stroke={col} strokeWidth="1.7" />; } return <g key={"bar" + it.id}><rect x={xs} y={barY} width={Math.max(xe - xs, 4)} height={barH} rx={3} fill={col} opacity={0.22} /><rect x={xs} y={barY} width={Math.max(xe - xs, 4)} height={barH} rx={3} fill="none" stroke={col} strokeWidth="1.1" /></g>; })}
      </svg>
      </>}
    </div>
  );
}

function CompareGantt({ baseline, live, mappings, LV, dark, zoom, compact, P }) {
  const [collapsed, setCollapsed] = useState({});
  const svgRef = useRef(null);
  const colorOf = (a) => ((LV[a.level] || {}).color || "#64748B");
  const baseById = {}; ((baseline && baseline.activities) || []).forEach((b) => { baseById[b.pid] = b; });
  const liveToBase = {}; const mp = mappings || {}; Object.keys(mp).forEach((bpid) => { if (mp[bpid]) liveToBase[mp[bpid]] = bpid; });
  const liveItems = (live || []).filter((a) => a.start).map((a) => { const s = parseD(a.start); const e = addDays(s, Math.max(1, a.duration || 1) - 1); const bp = liveToBase[a.id] ? baseById[liveToBase[a.id]] : null; return { id: a.id, code: a.code != null ? "#" + a.code : "", name: a.desc || "Untitled", s, e, ms: !!a.isMilestone, col: colorOf(a), grp: a.level + " " + ((LV[a.level] || {}).name || ""), base: bp ? { s: parseD(bp.start), e: parseD(bp.end || bp.start), ms: !!bp.ms } : null }; });
  const baseMiles = ((baseline && baseline.activities) || []).filter((b) => b.ms && b.start).map((b) => ({ id: b.pid, code: b.code, name: b.name || "Milestone", s: parseD(b.start), e: parseD(b.end || b.start) }));

  const ppd = zoom === "day" ? 30 : zoom === "week" ? 9.6 : 4.4;
  const rowH = compact ? 22 : 30, headH = 46, leftW = 300;
  const ds = [];
  liveItems.forEach((i) => { ds.push(i.s.getTime(), i.e.getTime()); if (i.base) ds.push(i.base.s.getTime(), i.base.e.getTime()); });
  baseMiles.forEach((i) => ds.push(i.s.getTime(), i.e.getTime()));
  let t0, t1;
  if (ds.length) { t0 = mondayOf(new Date(Math.min(...ds))); t1 = new Date(Math.max(...ds)); } else { t0 = mondayOf(new Date()); t1 = addDays(t0, 28); }
  t1 = addDays(mondayOf(addDays(t1, 7)), 6);
  const dayOff = (d) => Math.round((d.getTime() - t0.getTime()) / DAYMS);
  const N = Math.max(7, dayOff(t1) + 1);
  const tlW = N * ppd, W = leftW + tlW;
  const xOf = (off) => leftW + off * ppd;

  const groups = {}; liveItems.forEach((it) => { (groups[it.grp] = groups[it.grp] || []).push(it); });
  const rows = [];
  Object.keys(groups).sort().forEach((k) => { rows.push({ t: "grp", k, n: groups[k].length }); if (!collapsed[k]) groups[k].slice().sort((a, b) => a.s - b.s).forEach((it) => rows.push({ t: "live", it })); });
  if (baseMiles.length) { const bk = "P6 baseline milestones"; rows.push({ t: "grp", k: bk, n: baseMiles.length }); if (!collapsed[bk]) baseMiles.slice().sort((a, b) => a.s - b.s).forEach((it) => rows.push({ t: "bm", it })); }
  const H = headH + rows.length * rowH + 8;

  const months = []; { let d = new Date(t0.getFullYear(), t0.getMonth(), 1); while (d <= t1) { const next = new Date(d.getFullYear(), d.getMonth() + 1, 1); const xs = xOf(Math.max(0, dayOff(d < t0 ? t0 : d))); const xe = xOf(dayOff(next > t1 ? t1 : next)); months.push({ label: d.toLocaleString("en-GB", { month: "short", year: "2-digit" }), xs, xe }); d = next; } }
  const ticks = []; { for (let i = 0; i <= N; i++) { const d = addDays(t0, i); const isMon = d.getDay() === 1; const first = d.getDate() === 1; if (zoom === "day") { ticks.push({ x: xOf(i), label: String(d.getDate()), strong: isMon }); } else if (zoom === "week") { if (isMon) ticks.push({ x: xOf(i), label: String(d.getDate()), strong: false }); } else { if (first) ticks.push({ x: xOf(i), label: "", strong: true }); } } }
  const todayX = leftW + dayOff(new Date(todayMid())) * ppd;
  const text = (x, y, s, o = {}) => <text x={x} y={y} fontFamily="Segoe UI, Arial, sans-serif" fill={o.fill || P.ink} fontSize={o.size || 11} fontWeight={o.weight || 400} textAnchor={o.anchor || "start"} dominantBaseline={o.baseline || "middle"} style={{ pointerEvents: "none" }}>{s}</text>;
  const BASE = dark ? "#8A97A6" : "#94A3B8";
  const LATE = dark ? "#F87171" : "#C0392B", EARLY = dark ? "#34D399" : "#0E9384";

  const svgString = () => { const c = svgRef.current.cloneNode(true); c.setAttribute("xmlns", "http://www.w3.org/2000/svg"); return new XMLSerializer().serializeToString(c); };
  const exportImg = (type) => { const str = svgString(); const img = new Image(); img.onload = () => { const sc = 2; const cv = document.createElement("canvas"); cv.width = W * sc; cv.height = H * sc; const ctx = cv.getContext("2d"); ctx.fillStyle = P.bg; ctx.fillRect(0, 0, cv.width, cv.height); ctx.scale(sc, sc); ctx.drawImage(img, 0, 0); const url = cv.toDataURL(type === "jpg" ? "image/jpeg" : "image/png", 0.92); const a = document.createElement("a"); a.href = url; a.download = `FIN04-compare-${fmtISO(new Date())}.${type}`; a.click(); }; img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(str))); };

  const mappedN = liveItems.filter((i) => i.base).length;
  const slipped = liveItems.filter((i) => i.base && (dayOff(i.e) - dayOff(i.base.e)) > 1).length;

  return (
    <div className="lk-sch-scroll" style={{ background: P.bg }}>
      {liveItems.length === 0 ? <div className="lk-empty">No live activities with dates to compare.</div> : <>
      <div style={{ display: "flex", gap: 14, padding: "8px 12px", alignItems: "center", borderBottom: "1px solid " + P.line, background: P.bg, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: P.mut }}><b style={{ color: P.ink }}>{mappedN}</b> mapped \u00b7 <b style={{ color: LATE }}>{slipped}</b> slipped vs baseline</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: P.mut }}><span style={{ display: "inline-block", width: 18, height: 6, borderRadius: 2, background: "#94A3B8", opacity: .6 }} /> P6 baseline</span>
        {mappedN === 0 && <span style={{ fontSize: 11.5, color: P.mut }}>No mappings yet \u2014 map activities in Admin \u2192 P6 Baseline for per-row variance. Milestones below align by date.</span>}
        <div style={{ flex: 1 }} />
        <button className="lk-btn" onClick={() => exportImg("png")}><Icon n="download" s={13} />PNG</button>
      </div>
      <svg className="lk-sch-axis" width={W} height={headH} viewBox={`0 0 ${W} ${headH}`} xmlns="http://www.w3.org/2000/svg" style={{ position: "sticky", top: 0, zIndex: 3, display: "block", marginBottom: -headH, background: P.bg, fontFamily: "Segoe UI, Arial, sans-serif" }}>
        <rect x={0} y={0} width={W} height={headH} fill={P.bg} />
        {months.map((m, i) => <g key={"hm" + i}><rect x={m.xs} y={0} width={Math.max(0, m.xe - m.xs)} height={22} fill={i % 2 ? P.band2 : P.band} />{(m.xe - m.xs) > 26 && text((m.xs + m.xe) / 2, 11, m.label, { anchor: "middle", size: 10.5, weight: 700, fill: P.mut })}</g>)}
        {ticks.map((t, i) => <g key={"ht" + i}><line x1={t.x} y1={22} x2={t.x} y2={headH} stroke={t.strong ? P.gridStrong : P.grid} strokeWidth="1" />{t.label && zoom !== "month" && text(t.x + 2, 34, t.label, { size: 9.5, fill: P.mut })}</g>)}
        <line x1={leftW} y1={0} x2={leftW} y2={headH} stroke={P.line} strokeWidth="1" />
        <line x1={0} y1={headH} x2={W} y2={headH} stroke={P.line} strokeWidth="1" />
        {todayX >= leftW && todayX <= W && <g><line x1={todayX} y1={22} x2={todayX} y2={headH} stroke={P.today} strokeWidth="1.5" strokeDasharray="3 3" />{text(todayX + 3, headH - 4, "today", { size: 9, fill: P.today, weight: 700 })}</g>}
      </svg>
      <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{ background: P.bg, fontFamily: "Segoe UI, Arial, sans-serif", position: "relative", zIndex: 1 }}>
        <rect x={0} y={0} width={W} height={H} fill={P.bg} />
        {months.map((m, i) => <rect key={"m" + i} x={m.xs} y={0} width={Math.max(0, m.xe - m.xs)} height={22} fill={i % 2 ? P.band2 : P.band} />)}
        {ticks.map((t, i) => <line key={"t" + i} x1={t.x} y1={22} x2={t.x} y2={H} stroke={t.strong ? P.gridStrong : P.grid} strokeWidth="1" />)}
        <line x1={leftW} y1={0} x2={leftW} y2={H} stroke={P.line} strokeWidth="1" />
        <line x1={0} y1={headH} x2={W} y2={headH} stroke={P.line} strokeWidth="1" />
        {todayX >= leftW && todayX <= W && <line x1={todayX} y1={headH} x2={todayX} y2={H} stroke={P.today} strokeWidth="1.5" strokeDasharray="3 3" />}
        {rows.map((r, i) => { const y = headH + i * rowH; if (r.t === "grp") { const open = !collapsed[r.k]; return <g key={"g" + r.k} style={{ cursor: "pointer" }} onClick={() => setCollapsed((c) => ({ ...c, [r.k]: !c[r.k] }))}><rect x={0} y={y} width={W} height={rowH} fill={P.header} /><text x={10} y={y + rowH / 2} fontSize="10" fill={P.mut} dominantBaseline="middle">{open ? "\u25BC" : "\u25B6"}</text>{text(24, y + rowH / 2, `${r.k}  (${r.n})`, { weight: 700, size: 11.5, fill: P.ink })}</g>; } const it = r.it; const nm = it.name; return <g key={"lx" + r.t + it.id}>{i % 2 === 0 && <rect x={0} y={y} width={W} height={rowH} fill={P.row} />}<line x1={0} y1={y + rowH} x2={W} y2={y + rowH} stroke={P.sep} strokeWidth="1" />{text(10, y + rowH / 2, r.t === "live" ? it.code : "", { size: 9.5, fill: P.mut })}<text x={42} y={y + rowH / 2} fontSize="11.5" fill={r.t === "bm" ? P.mut : P.ink} dominantBaseline="middle" style={{ pointerEvents: "none" }}>{nm.length > 34 ? nm.slice(0, 33) + "\u2026" : nm}</text></g>; })}
        {rows.map((r, i) => { const y = headH + i * rowH, yc = y + rowH / 2; if (r.t === "bm") { const it = r.it; const x = xOf(dayOff(it.s)); return <polygon key={"bm" + it.id} points={`${x},${yc - 6} ${x + 6},${yc} ${x},${yc + 6} ${x - 6},${yc}`} fill={dark ? P.bg : "#FFFFFF"} stroke={BASE} strokeWidth="1.6" />; } if (r.t !== "live") return null; const it = r.it; const barH = rowH - 14, barY = y + (rowH - barH) / 2; const lxs = xOf(dayOff(it.s)), lxe = xOf(dayOff(it.e) + 1); const vNodes = []; if (it.base) { const bxs = xOf(dayOff(it.base.s)), bxe = xOf(dayOff(it.base.e) + 1); const dd = dayOff(it.e) - dayOff(it.base.e); const vcol = dd > 1 ? LATE : dd < -1 ? EARLY : P.mut; if (it.base.ms || it.ms) { vNodes.push(<polygon key="bd" points={`${bxs},${yc - 5} ${bxs + 5},${yc} ${bxs},${yc + 5} ${bxs - 5},${yc}`} fill="none" stroke={BASE} strokeWidth="1.4" />); } else { vNodes.push(<rect key="bb" x={bxs} y={yc + 3} width={Math.max(bxe - bxs, 3)} height={4} rx={2} fill={BASE} opacity={0.7} />); } const chipX = Math.max(lxe, bxe) + 6; vNodes.push(text(chipX, yc, dd === 0 ? "on plan" : (dd > 0 ? "+" : "") + dd + "d", { size: 9.5, fill: dd === 0 ? P.mut : vcol, weight: 700 })); } const liveNode = it.ms ? <polygon points={`${lxs},${yc - 6} ${lxs + 6},${yc} ${lxs},${yc + 6} ${lxs - 6},${yc}`} fill={it.col} /> : <g><rect x={lxs} y={barY} width={Math.max(lxe - lxs, 4)} height={barH} rx={3} fill={it.col} opacity={0.32} /><rect x={lxs} y={barY} width={Math.max(lxe - lxs, 4)} height={barH} rx={3} fill="none" stroke={it.col} strokeWidth="1.1" /></g>; return <g key={"lb" + it.id}>{vNodes}{liveNode}</g>; })}
      </svg>
      </>}
    </div>
  );
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
  const [bl, setBl] = useState(null);
  const [source, setSource] = useState("live");
  useEffect(() => { if (!S.projectId) return; let on = true; loadBaseline(S.projectId).then((r) => { if (on) setBl(r); }).catch(() => {}); return () => { on = false; }; }, [S.projectId]);
  const hasBaseline = !!(bl && bl.activities && bl.activities.length);
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
  const pct = (a) => pctOf(a);
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
        {view === "gantt" && hasBaseline && <div className="grp"><label>Schedule</label><div className="seg">{[["live", "Live"], ["p6", "P6 Baseline"], ["compare", "Compare"]].map(([k, l]) => <button key={k} className={source === k ? "on" : ""} onClick={() => setSource(k)}>{l}</button>)}</div></div>}
        {view === "gantt" && source !== "live" && hasBaseline && <>
        <div className="grp"><label>Zoom</label><div className="seg">{[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([k, l]) => <button key={k} className={zoom === k ? "on" : ""} onClick={() => setZoom(k)}>{l}</button>)}</div></div>
        <button className={"lk-btn" + (compact ? " on" : "")} onClick={() => setCompact((v) => !v)}>Compact</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--muted)", alignSelf: "center" }}>{source === "compare" ? "Live vs P6 baseline" : "Read-only P6 baseline"}</span>
        </>}
        {view === "gantt" && source === "live" && <>
        <div className="grp"><label>Zoom</label><div className="seg">{[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([k, l]) => <button key={k} className={zoom === k ? "on" : ""} onClick={() => setZoom(k)}>{l}</button>)}</div></div>
        <div className="grp"><label>Group By</label><select className="lk-select" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}><option value="none">None</option><option value="company">Company</option><option value="area">Building</option><option value="level">Cx Stage</option><option value="system">System</option></select></div>
        <div className="grp"><label>Colour By</label><select className="lk-select" value={colorBy} onChange={(e) => setColorBy(e.target.value)}><option value="level">Cx Stage</option><option value="company">Company</option><option value="status">Status</option></select></div>
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
      {view === "gantt" && source === "p6" && hasBaseline && <BaselineGantt baseline={bl} LV={LV} dark={dark} zoom={zoom} compact={compact} P={P} />}
      {view === "gantt" && source === "compare" && hasBaseline && <CompareGantt baseline={bl} live={S.activities} mappings={bl.mappings} LV={LV} dark={dark} zoom={zoom} compact={compact} P={P} />}
      {view === "gantt" && (source === "live" || !hasBaseline) && <div className="lk-sch-scroll" style={{ background: P.bg }}>
        {acts.length === 0 ? <div className="lk-empty">No activities with dates yet.</div> :
        <>
        <svg className="lk-sch-axis" width={W} height={headH} viewBox={`0 0 ${W} ${headH}`} xmlns="http://www.w3.org/2000/svg" style={{ position: "sticky", top: 0, zIndex: 3, display: "block", marginBottom: -headH, background: P.bg, fontFamily: "Segoe UI, Arial, sans-serif" }}>
          <rect x={0} y={0} width={W} height={headH} fill={P.bg} />
          {months.map((m, i) => <g key={"hm" + i}><rect x={m.xs} y={0} width={Math.max(0, m.xe - m.xs)} height={22} fill={i % 2 ? P.band2 : P.band} />{(m.xe - m.xs) > 26 && text((m.xs + m.xe) / 2, 11, m.label, { anchor: "middle", size: 10.5, weight: 700, fill: P.mut })}</g>)}
          {ticks.map((t, i) => <g key={"ht" + i}><line x1={t.x} y1={22} x2={t.x} y2={headH} stroke={t.strong ? P.gridStrong : P.grid} strokeWidth="1" />{t.label && zoom !== "month" && text(t.x + 2, 34, t.label, { size: 9.5, fill: P.mut })}</g>)}
          <line x1={leftW} y1={0} x2={leftW} y2={headH} stroke={P.line} strokeWidth="1" />
          {text(leftW - 10, 34, "% done", { anchor: "end", size: 9, weight: 700, fill: P.mut })}
          <line x1={0} y1={headH} x2={W} y2={headH} stroke={P.line} strokeWidth="1" />
          {todayX >= leftW && todayX <= W && <g><line x1={todayX} y1={22} x2={todayX} y2={headH} stroke={P.today} strokeWidth="1.5" strokeDasharray="3 3" />{text(todayX + 3, headH - 4, "today", { size: 9, fill: P.today, weight: 700 })}</g>}
        </svg>
        <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{ background: P.bg, fontFamily: "Segoe UI, Arial, sans-serif", position: "relative", zIndex: 1 }}>
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
              <text x={42} y={y + rowH / 2} fontSize="11.5" fill={P.ink} dominantBaseline="middle" style={{ pointerEvents: "none" }}>{nm.length > 30 ? nm.slice(0, 29) + "\u2026" : nm}</text>
              {!a.isMilestone && text(leftW - 10, y + rowH / 2, pct(a) + "%", { anchor: "end", size: 10.5, fill: P.mut })}
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
                ? (delay
                    ? (() => {
                        const complete = a.status === "complete";
                        const todayOff = dayOff(new Date(todayMid()));
                        const isLate = complete || todayOff > g.pE;
                        const accent = isLate ? "#C0392B" : "#D97706";
                        const ex = xOf(projE);
                        return <g>
                          <line x1={g.x} y1={yc} x2={ex} y2={yc} stroke={accent} strokeWidth="1.4" strokeDasharray={complete ? undefined : "4 3"} />
                          <polygon points={`${g.x},${yc - 5} ${g.x + 5},${yc} ${g.x},${yc + 5} ${g.x - 5},${yc}`} fill="none" stroke="#7C8896" strokeWidth="1.2" strokeDasharray="2 2" />
                          <polygon points={`${ex},${yc - 6} ${ex + 6},${yc} ${ex},${yc + 6} ${ex - 6},${yc}`} fill={complete ? accent : "none"} stroke={accent} strokeWidth={complete ? 0 : 1.4} />
                        </g>;
                      })()
                    : <polygon points={`${g.x},${yc - 6} ${g.x + 6},${yc} ${g.x},${yc + 6} ${g.x - 6},${yc}`} fill={col} />)
                : <g>
                    <rect x={g.x} y={barY} width={g.w} height={barH} rx={3} fill={col} opacity={0.30} />
                    <rect x={g.x} y={barY} width={g.w * p / 100} height={barH} rx={3} fill={col} />
                    <rect x={g.x} y={barY} width={g.w} height={barH} rx={3} fill="none" stroke={col} strokeWidth="1" />
                    {delay && <rect x={dx1} y={barY + 1} width={Math.max(2, dx2 - dx1)} height={barH - 2} rx={2} fill="none" stroke="#C0392B" strokeWidth="1.2" strokeDasharray="3 2" />}
                  </g>}
              {showResp && coName(a.companyId) && text(respX, yc, coName(a.companyId), { size: 10, fill: P.mut })}
            </g>;
          })}
        </svg>
        </>}
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
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkCommitted, setBulkCommitted] = useState("");
  const lastIdx = useRef(null);
  const [colsOpen, setColsOpen] = useState(false);
  const [frOpen, setFrOpen] = useState(false);
  const [frFind, setFrFind] = useState("");
  const [frRepl, setFrRepl] = useState("");
  const [frField, setFrField] = useState("desc");
  const [frCase, setFrCase] = useState(false);
  const [frWhole, setFrWhole] = useState(false);
  const [frConfirm, setFrConfirm] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  useEffect(() => { setSel(new Set()); setConfirmBulk(false); lastIdx.current = null; }, [fCo, fStatus, fAr, fLv, q, fFrom, fTo]);
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const clickRow = (e, idx, id) => { if (e.shiftKey && lastIdx.current != null) { const lo = Math.min(lastIdx.current, idx), hi = Math.max(lastIdx.current, idx); const ids = list.slice(lo, hi + 1).map((x) => x.id); setSel((s) => { const n = new Set(s); ids.forEach((x) => n.add(x)); return n; }); } else { toggleSel(id); lastIdx.current = idx; } };
  const setSelCommitted = (val) => { if (!sel.size) return; const ids = sel; const n = ids.size; update((p) => ({ ...p, activities: p.activities.map((x) => ids.has(x.id) ? { ...x, committed: val } : x) }), { action: "Bulk set committed (table)", detail: `${n} activit${n === 1 ? "y" : "ies"} -> committed ${val ? "Yes" : "No"}` }); setSavedMsg(`Set committed = ${val ? "Yes" : "No"} on ${n} activit${n === 1 ? "y" : "ies"}`); setTimeout(() => setSavedMsg(""), 3000); setSel(new Set()); setBulkCommitted(""); };
  const delSelected = () => { const ids = sel; if (!ids.size) return; update((p) => ({ ...p, activities: p.activities.filter((x) => !ids.has(x.id)).map((x) => (x.predecessors && x.predecessors.some((pid) => ids.has(pid))) ? { ...x, predecessors: x.predecessors.filter((pid) => !ids.has(pid)) } : x) }), { action: "Delete activities (table)", detail: ids.size + " activit" + (ids.size === 1 ? "y" : "ies") }); setSel(new Set()); setConfirmBulk(false); };
  const setSelStatus = () => { if (!sel.size || !bulkStatus) return; const ids = sel; const n = ids.size; const today = fmtISO(new Date()); update((p) => ({ ...p, activities: p.activities.map((x) => { if (!ids.has(x.id)) return x; const nn = { ...x, status: bulkStatus }; if (bulkStatus === "in_progress" && !nn.actualStart) nn.actualStart = today; if (bulkStatus === "complete") { if (!nn.actualStart) nn.actualStart = today; if (!nn.actualFinish) nn.actualFinish = today; } return nn; }) }), { action: "Bulk set status (table)", detail: `${n} activit${n === 1 ? "y" : "ies"} -> ${bulkStatus.replace("_", " ")}` }); setSavedMsg(`Set ${n} activit${n === 1 ? "y" : "ies"} to ${bulkStatus.replace("_", " ")}`); setTimeout(() => setSavedMsg(""), 3000); setSel(new Set()); setBulkStatus(""); };
  const [cols, setCols] = useState(() => ({ ...TBL_DEFAULT_COLS, ...(savedView.cols || {}) }));
  const cn = (id) => (S.companies.find((c) => c.id === id) || {}).name || "";
  const rowEditable = (a) => a.status === "complete" ? isAdmin : (isAdmin || (canEdit(a) && !a.committed));
  const begin = (a) => { setEditId(a.id); setDraft({ ...a }); };
  const cancel = () => { setEditId(null); setDraft(null); };
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setStatus = (v) => setDraft((d) => { const n = { ...d, status: v }; if (v === "in_progress" && !n.actualStart) n.actualStart = fmtISO(new Date()); if (v === "complete") { if (!n.actualStart) n.actualStart = fmtISO(new Date()); if (!n.actualFinish) n.actualFinish = fmtISO(new Date()); } return n; });
  const save = () => { if (!draft.desc.trim() || !draft.start) return; const d = draft; update((p) => ({ ...p, activities: p.activities.map((x) => x.id === d.id ? d : x) }), { action: "Edit activity (table)", detail: `${d.desc} (${coName(d.companyId)})` }); cancel(); };
  const saveView = () => { try { localStorage.setItem("fin04_tblview", JSON.stringify({ cols, fCo, fAr, fLv, fStatus })); setSavedMsg("Saved as your default view"); setTimeout(() => setSavedMsg(""), 2200); } catch (e) {} };
  const resetView = () => { setCols({ ...TBL_DEFAULT_COLS }); setFCo("all"); setFAr("all"); setFLv("all"); setFStatus("all"); setFFrom(""); setFTo(""); try { localStorage.removeItem("fin04_tblview"); } catch (e) {} setSavedMsg("Reset to defaults"); setTimeout(() => setSavedMsg(""), 2200); };
  const subsFor = (area) => (S.subAreas || []).filter((s) => s.area === area);
  const zonesFor = (area, sub) => (S.tier3s || []).filter((t) => t.area === area && t.subArea === sub);
  const list = S.activities.filter((a) => {
    if (fStatus !== "all" && a.status !== fStatus) return false;
    if (fCo === "none") { if (a.companyId) return false; } else if (fCo !== "all" && a.companyId !== fCo) return false;
    if (fAr !== "all" && a.area !== fAr) return false;
    if (fLv !== "all" && a.level !== fLv) return false;
    if (fFrom && (a.start || "") < fFrom) return false;
    if (fTo && (a.start || "") > fTo) return false;
    if (q.trim() && !(`${a.desc || ""} ${cn(a.companyId)} ${a.system || ""}`.toLowerCase().includes(q.trim().toLowerCase()))) return false;
    return true;
  }).sort((a, b) => (a.start || "").localeCompare(b.start || "") || (a.code || 0) - (b.code || 0));
  const allSel = list.length > 0 && list.every((a) => sel.has(a.id));
  const someSel = sel.size > 0 && !allSel;
  const toggleAll = () => setSel(() => (list.length && list.every((a) => sel.has(a.id))) ? new Set() : new Set(list.map((a) => a.id)));
  const cell = { padding: "5px 7px", fontSize: 11.5 };
  const C = (k) => cols[k];
  const FR_FIELDS = [["desc", "Activity name", "text"], ["notes", "Notes", "text"], ["asset", "Asset code", "text"], ["system", "System", "enum"], ["area", "Building", "area"], ["level", "Cx Stage", "enum"], ["status", "Status", "status"], ["companyId", "Company", "company"], ["committed", "Committed", "bool"], ["witnessInvite", "Witness", "bool"]];
  const frType = (FR_FIELDS.find((f) => f[0] === frField) || [])[2] || "text";
  const frIsText = frType === "text";
  const frBool = frType === "bool";
  const frOptsFor = (f) => { switch (f) { case "system": return [["", "(Blank)"], ...S.systems.map((s) => [s, s])]; case "area": return S.areas.map((x) => [x, x]); case "level": return Object.keys(S.levels).map((k) => [k, k]); case "status": return [["planned", "Planned"], ["in_progress", "In progress"], ["complete", "Complete"]]; case "companyId": return [["", "(None)"], ...S.companies.map((c) => [c.id, c.name])]; case "committed": case "witnessInvite": return [["true", "Yes"], ["false", "No"]]; default: return []; } };
  const frOpts = frOptsFor(frField);
  const frCur = (a) => frBool ? String(!!a[frField]) : String(a[frField] == null ? "" : a[frField]);
  const frLbl = (v) => { const o = frOpts.find((x) => x[0] === v); return o ? o[1] : (v || "(Blank)"); };
  const frMk = () => { const esc = frFind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return new RegExp(frWhole ? `\\b${esc}\\b` : esc, frCase ? "g" : "gi"); };
  const frVal = (a) => (a[frField] || "");
  const frMatched = frIsText ? (frFind ? list.filter((a) => frMk().test(frVal(a))) : []) : list.filter((a) => frFind === "__any__" || frCur(a) === frFind);
  const frOccur = frIsText ? frMatched.reduce((n, a) => n + (frVal(a).match(frMk()) || []).length, 0) : frMatched.length;
  const frBefore = (a) => frIsText ? frVal(a) : frLbl(frCur(a));
  const frAfter = (a) => frIsText ? frVal(a).replace(frMk(), frRepl) : frLbl(frRepl);
  const frApply = () => {
    if (!frMatched.length || (frIsText && !frFind)) return;
    const ids = new Set(frMatched.map((a) => a.id)); const n = ids.size; const fl = (FR_FIELDS.find((f) => f[0] === frField) || ["", frField])[1]; const today = fmtISO(new Date());
    const apply = (x) => {
      if (frIsText) return { ...x, [frField]: (x[frField] || "").replace(frMk(), frRepl) };
      if (frType === "bool") return { ...x, [frField]: frRepl === "true" };
      if (frType === "area") return { ...x, area: frRepl, subArea: "", tier3: "" };
      if (frType === "company") return { ...x, companyId: frRepl || null };
      if (frType === "status") { const nn = { ...x, status: frRepl }; if (frRepl === "in_progress" && !nn.actualStart) nn.actualStart = today; if (frRepl === "complete") { if (!nn.actualStart) nn.actualStart = today; if (!nn.actualFinish) nn.actualFinish = today; } return nn; }
      return { ...x, [frField]: frRepl };
    };
    const det = frIsText ? `"${frFind}" -> "${frRepl}" in ${fl}` : `${fl} set to "${frLbl(frRepl)}"${frFind === "__any__" ? "" : ` (where ${fl} = "${frLbl(frFind)}")`}`;
    update((p) => ({ ...p, activities: p.activities.map((x) => ids.has(x.id) ? apply(x) : x) }), { action: "Find & replace (table)", detail: `${det} on ${n} activit${n === 1 ? "y" : "ies"}` });
    setSavedMsg(`Updated ${n} activit${n === 1 ? "y" : "ies"}${frIsText ? ` (${frOccur} occurrence${frOccur === 1 ? "" : "s"})` : ""}`); setTimeout(() => setSavedMsg(""), 3000); setFrConfirm(false); setFrOpen(false); if (frIsText) { setFrFind(""); setFrRepl(""); }
  };
  const visCount = 2 + TBL_COLS.filter(([k]) => cols[k]).length;
  return (
    <div className="lk-tblwrap" style={cssVars(S.theme)}><style>{css}</style>
      <div className="lk-ufilter" style={{ padding: "10px 16px 0", alignItems: "flex-end" }}>
        <div className="lk-f" style={{ minWidth: 150, flex: 1 }}><label>Search</label><input className="lk-in" placeholder="Activity, company, system…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="lk-f" style={{ minWidth: 130 }}><label>Company</label><select className="lk-select" value={fCo} onChange={(e) => setFCo(e.target.value)}><option value="all">All companies</option><option value="none">No company</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        {S.areas.length > 1 && <div className="lk-f" style={{ minWidth: 120 }}><label>Building</label><select className="lk-select" value={fAr} onChange={(e) => setFAr(e.target.value)}><option value="all">All buildings</option>{S.areas.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>}
        <div className="lk-f" style={{ minWidth: 90 }}><label>Cx Stage</label><select className="lk-select" value={fLv} onChange={(e) => setFLv(e.target.value)}><option value="all">All</option>{Object.keys(S.levels).map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 105 }}><label>Status</label><select className="lk-select" value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="all">All statuses</option><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="complete">Complete</option></select></div>
        <div className="lk-f" style={{ minWidth: 124 }}><label>Start From</label><input className="lk-in mono" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} /></div>
        <div className="lk-f" style={{ minWidth: 124 }}><label>Start To</label><input className="lk-in mono" type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} /></div>
        <div style={{ position: "relative" }}>
          {isAdmin && <button className={"lk-btn" + (frOpen ? " on" : "")} style={{ marginRight: 8 }} onClick={() => setFrOpen((v) => !v)}>Find &amp; replace</button>}
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
      {isAdmin && frOpen && <div style={{ margin: "8px 16px 0", padding: "12px 14px", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
          <div className="lk-f" style={{ minWidth: 140 }}><label>In</label><select className="lk-select" value={frField} onChange={(e) => { const f = e.target.value; const t = (FR_FIELDS.find((x) => x[0] === f) || [])[2] || "text"; setFrField(f); setFrConfirm(false); if (t === "text") { setFrFind(""); setFrRepl(""); } else { setFrFind("__any__"); const o = frOptsFor(f); setFrRepl(o.length ? o[0][0] : ""); } }}>{FR_FIELDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          {frIsText
            ? <><div className="lk-f" style={{ minWidth: 150 }}><label>Find</label><input className="lk-in" value={frFind} placeholder="e.g. Generator" onChange={(e) => { setFrFind(e.target.value); setFrConfirm(false); }} /></div>
                <div className="lk-f" style={{ minWidth: 150 }}><label>Replace With</label><input className="lk-in" value={frRepl} placeholder="e.g. GEN" onChange={(e) => { setFrRepl(e.target.value); setFrConfirm(false); }} /></div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, paddingBottom: 7 }}><input type="checkbox" checked={frCase} onChange={(e) => { setFrCase(e.target.checked); setFrConfirm(false); }} />Match Case</label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, paddingBottom: 7 }}><input type="checkbox" checked={frWhole} onChange={(e) => { setFrWhole(e.target.checked); setFrConfirm(false); }} />Whole Word</label></>
            : <><div className="lk-f" style={{ minWidth: 150 }}><label>Where</label><select className="lk-select" value={frFind} onChange={(e) => { setFrFind(e.target.value); setFrConfirm(false); }}><option value="__any__">(Any value)</option>{frOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div className="lk-f" style={{ minWidth: 150 }}><label>Set To</label><select className="lk-select" value={frRepl} onChange={(e) => { setFrRepl(e.target.value); setFrConfirm(false); }}>{frOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div></>}
        </div>
        {(!frIsText || frFind) && <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>{frMatched.length === 0 ? "No matching activities in the current view." : <span>Will change <b style={{ color: "var(--ink)" }}>{frMatched.length}</b> activit{frMatched.length === 1 ? "y" : "ies"}{frIsText ? ` (${frOccur} occurrence${frOccur === 1 ? "" : "s"})` : ""} in the current view of {list.length}.</span>}</div>}
        {(!frIsText || frFind) && frMatched.length > 0 && <div style={{ marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4, maxHeight: 168, overflow: "auto" }}>
          {frMatched.slice(0, 8).map((a) => <div key={a.id} style={{ fontSize: 11.5, display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>{!frIsText && <span style={{ color: "var(--muted)", minWidth: 130, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.desc || "Untitled"}</span>}<span style={{ color: "var(--muted)", textDecoration: "line-through" }}>{frBefore(a) || "(Blank)"}</span><span style={{ color: "var(--muted)" }}>{"\u2192"}</span><span style={{ color: "var(--ink)", fontWeight: 600 }}>{frAfter(a) || "(Blank)"}</span></div>)}
          {frMatched.length > 8 && <div style={{ fontSize: 11, color: "var(--muted)" }}>+{frMatched.length - 8} more</div>}
        </div>}
        <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
          {frConfirm
            ? <><span style={{ fontSize: 12, color: "#C0392B", fontWeight: 600 }}>Apply to {frMatched.length} activit{frMatched.length === 1 ? "y" : "ies"}? This cannot be undone.</span><button className="lk-btn" style={{ background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" }} onClick={frApply}>Yes, Apply</button><button className="lk-btn" onClick={() => setFrConfirm(false)}>Cancel</button></>
            : <><button className="lk-btn primary" disabled={frMatched.length === 0 || (frIsText && !frFind)} onClick={() => setFrConfirm(true)}>{frIsText ? "Replace" : "Apply"}</button><button className="lk-btn" onClick={() => { setFrOpen(false); setFrConfirm(false); }}>Close</button></>}
        </div>
      </div>}
      {isAdmin && sel.size > 0 && <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "8px 16px", margin: "8px 16px 0", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{sel.size} selected</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><select className="lk-select" style={{ fontSize: 12, padding: "5px 8px" }} value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}><option value="">Set status to…</option><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="complete">Complete</option></select><button className="lk-btn" disabled={!bulkStatus} onClick={setSelStatus}>Apply</button></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><select className="lk-select" style={{ fontSize: 12, padding: "5px 8px" }} value={bulkCommitted} onChange={(e) => setBulkCommitted(e.target.value)}><option value="">Set committed to…</option><option value="yes">Yes</option><option value="no">No</option></select><button className="lk-btn" disabled={!bulkCommitted} onClick={() => setSelCommitted(bulkCommitted === "yes")}>Apply</button></span>
        {confirmBulk
          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontSize: 12.5, color: "#C0392B", fontWeight: 600 }}>Delete {sel.size} activit{sel.size === 1 ? "y" : "ies"}? This cannot be undone.</span><button className="lk-btn" style={{ background: "#C0392B", color: "#fff", borderColor: "#C0392B" }} onClick={delSelected}><Icon n="trash" s={14} />Yes, delete</button><button className="lk-btn" onClick={() => setConfirmBulk(false)}>Cancel</button></span>
          : <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><button className="lk-btn" style={{ color: "#C0392B" }} onClick={() => setConfirmBulk(true)}><Icon n="trash" s={14} />Delete selected</button><button className="lk-btn" onClick={() => setSel(new Set())}>Clear</button></span>}
      </div>}
      <div className="lk-tblscroll">
        <table className="lk-grid">
          <thead><tr>
            <th style={{ width: isAdmin ? 74 : 56 }}>{isAdmin && <input type="checkbox" checked={allSel} ref={(el) => { if (el) el.indeterminate = someSel; }} onChange={toggleAll} title="Select all / none" />}</th>{C("code") && <th>#</th>}<th>Activity</th>{C("company") && <th>Company</th>}{C("building") && <th>Building</th>}{C("level") && <th>Level</th>}{C("zone") && <th>Zone / Room</th>}{C("system") && <th>System</th>}{C("cx") && <th>Cx</th>}{C("start") && <th>Start</th>}{C("days") && <th>Days</th>}{C("committed") && <th>Committed</th>}{C("status") && <th>Status</th>}{C("witness") && <th>Witness</th>}{C("witnessat") && <th>Witness time</th>}{C("notes") && <th style={{ width: 320 }}>Notes</th>}
          </tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={visCount} style={{ padding: 14, color: "var(--muted)", fontSize: 12 }}>No activities match these filters.</td></tr>}
            {list.map((a, idx) => {
              const ed = editId === a.id; const d = ed ? draft : a; const canRow = rowEditable(a); const lk = ed && d.status === "complete" && !isAdmin;
              return <tr key={a.id} className={ed ? "ed" : ""}>
                <td>{ed
                  ? <span style={{ display: "inline-flex", gap: 2 }}><button title="Save" onClick={save}><Icon n="check" s={14} /></button><button title="Cancel" onClick={cancel}><Icon n="x" s={14} /></button></span>
                  : <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{isAdmin && <input type="checkbox" checked={sel.has(a.id)} onClick={(e) => clickRow(e, idx, a.id)} onChange={() => {}} title="Select; Shift-click to select a range" />}<button title={canRow ? "Edit this row" : (a.status === "complete" ? "Complete: only an admin can reopen it" : a.committed ? "Committed: locked" : "Only your own company's activities are editable")} disabled={!canRow} onClick={() => begin(a)} style={{ opacity: canRow ? 1 : 0.3 }}><Icon n="pen" s={13} /></button></span>}</td>
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
                {C("notes") && <td style={{ width: 320, maxWidth: 320 }}>{ed ? <input className="lk-in" style={cell} value={d.notes || ""} disabled={lk} onChange={(e) => set("notes", e.target.value)} /> : <div style={{ maxWidth: 320, whiteSpace: "normal", overflowWrap: "break-word", color: "var(--muted)" }}>{a.notes || ""}</div>}</td>}
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
      <div className="lk-rep-filters">
        <div className="lk-f" style={{ minWidth: 180 }}><label>Search</label><input className="lk-in" placeholder="Activity or constraint…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="lk-f" style={{ minWidth: 150 }}><label>Company</label><select className="lk-select" value={co} onChange={(e) => setCo(e.target.value)}><option value="all">All companies</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 150 }}><label>Building</label><select className="lk-select" value={ar} onChange={(e) => setAr(e.target.value)}><option value="all">All buildings</option>{S.areas.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
        <button className={"lk-btn" + (openOnly ? " on" : "")} onClick={() => setOpenOnly((v) => !v)}>{openOnly ? "Open Only" : "Showing All"}</button>
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
              <td style={{ minWidth: 130 }}>{ed ? <OwnerField value={cd.owner} ownerType={cd.ownerType} ownerId={cd.ownerId} companies={S.companies} users={S.users} style={{ minWidth: 110 }} onChange={(name, t, id) => setCd((d) => ({ ...d, owner: name, ownerType: t, ownerId: id }))} /> : (c.owner || "")}</td>
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
  const RECENT_MS = 4 * 3600000; // amber dot if last seen within 4h, grey beyond
  const rows = users.map((u) => {
    const seen = ustat[u.id] && ustat[u.id].lastSignIn;
    if (!seen) return null; // invite not yet accepted -> no status, not listed
    const p = pres[u.id] ? new Date(pres[u.id]).getTime() : 0;
    const last = Math.max(p, new Date(seen).getTime());
    const online = p > 0 && (now - p) < ONLINE_MS;
    return { id: u.id, name: u.name || "Unknown", last, online, tier: online ? "on" : ((now - last) < RECENT_MS ? "rec" : "off") };
  }).filter(Boolean).sort((a, b) => b.last - a.last);
  const onlineRows = rows.filter((r) => r.online);
  const earlierRows = rows.filter((r) => !r.online);
  const sameDay = (d) => new Date().toDateString() === d.toDateString();
  const fmtTime = (t) => { const d = new Date(t); return d.toLocaleString("en-GB", sameDay(d) ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); };
  const row = (r) => <div key={r.id} className="lk-on-row">
    <span className="lk-on-avwrap"><span className="lk-on-av" style={{ background: avBg(r.id) }}>{avInit(r.name)}</span><span className={"lk-on-dot " + r.tier} /></span>
    <span className="lk-on-nm"><b title={r.name}>{r.name}</b><s className={r.online ? "on" : ""} title={"Last online " + new Date(r.last).toLocaleString("en-GB")}>{r.online ? "Online now" : "Last seen " + fmtTime(r.last)}</s></span>
  </div>;
  return (
    <div className="lk-online">
      <div className="lk-online-h"><span>Latest Online</span>{onlineRows.length > 0 && <span className="lk-online-now"><i />{onlineRows.length} online</span>}</div>
      {rows.length === 0
        ? <div className="lk-online-empty">No one has accepted their invite yet.</div>
        : <>
          {onlineRows.length > 0 && <><div className="lk-on-sub">Online now</div><div className="lk-on-body">{onlineRows.map(row)}</div></>}
          {earlierRows.length > 0 && <>{onlineRows.length > 0 && <hr className="lk-on-hr" />}<div className="lk-on-sub">Earlier</div><div className="lk-on-body scroll">{earlierRows.map(row)}</div></>}
        </>}
    </div>);
}

function HelpPage({ dark, admin, brandLogo, proj }) {
  const ADMIN_ONLY = new Set(["weekly", "r_admin"]);
  const HOWTO_SIM = new Set(["board", "views", "analytics"]);
  const NAV = [
    ["Quick Reference", [
      ["r_overview", "Sign in & scope"], ["r_navigate", "Find your way around"], ["r_board", "The Planning Board"],
      ["r_card", "The activity card"], ["r_table", "The Activity Table"], ["r_schedpage", "The Schedule page"],
      ["r_reading", "Reading the schedule"], ["r_constraints", "Constraints & make-ready"], ["r_commit", "Committing & PPC"],
      ["r_witness", "Witness invites"], ["r_analytics", "Analytics & reports"], ["r_admin", "Admin & settings"],
      ["r_cxstages", "Cx stages & colours"], ["r_markers", "Markers & chips"], ["r_codes", "Location codes"]]],
    ["How To", [
      ["board", "Add via Planning Board"], ["table", "Add via Activity Table"], ["import", "Bulk import (Excel/CSV)"],
      ["views", "Switch & read views"], ["reschedule", "Reschedule & links"], ["constraints", "Constraints & make-ready"],
      ["witness", "Witness invites"], ["ytt", "YTT daily focus"], ["analytics", "Dashboard & popouts"], ["weekly", "Weekly Report"]]],
  ];
  const [hp, setHp] = useState("r_overview");
  const frameRef = useRef(null);
  const srcRef = useRef("help.html?embed=1" + (dark ? "&theme=dark" : "") + "&page=r_overview");
  const post = (msg) => { try { const w = frameRef.current && frameRef.current.contentWindow; if (w) w.postMessage(msg, "*"); } catch (e) { } };
  useEffect(() => { post({ src: "dlp-help", type: "help-nav", page: hp }); }, [hp]);
  useEffect(() => { post({ src: "dlp-help", type: "help-theme", dark: !!dark }); }, [dark]);
  const onLoad = () => { post({ src: "dlp-help", type: "help-theme", dark: !!dark }); post({ src: "dlp-help", type: "help-nav", page: hp }); };
  const sub = proj && (proj.client || proj.location) ? [proj.client, proj.location].filter(Boolean).join(", ") : "";
  return (
    <div className="lk-helppage">
      <div className="lk-helphero">
        <div className="hh">
          <div className="eyebrow">Digital Last Planner System &middot; Commissioning</div>
          <h1>Help &amp; <b>Quick Reference</b></h1>
          <div className="lede">Everything in one place: a Quick Reference to every part of the app, plus step-through How To tutorials.</div>
        </div>
        <div className="proj">
          {brandLogo ? <img src={brandLogo} alt="" /> : null}
          <span className="pl">{(proj && proj.code) || ""}{sub ? " \u00B7 " + sub : ""}</span>
        </div>
      </div>
      <div className="lk-helpmain">
        <nav className="lk-helpnav">
          {NAV.map(([g, items]) => {
            const vis = items.filter(([k]) => admin || !ADMIN_ONLY.has(k));
            if (!vis.length) return null;
            return <div key={g} className="grp"><div className="grphd">{g}</div>{vis.map(([k, l]) => <button key={k} className={hp === k ? "sel" : ""} onClick={() => setHp(k)}>{l}{ADMIN_ONLY.has(k) ? <span className="tag">Admin</span> : (HOWTO_SIM.has(k) ? <span className="tag">Try</span> : null)}</button>)}</div>;
          })}
        </nav>
        <div className="lk-helppane">
          <iframe ref={frameRef} title="DLP Help" src={srcRef.current} onLoad={onLoad} />
        </div>
      </div>
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

function buildWeeklyReportHTML({ r, summary, includeSchedule, by, mode, theme, sections, cxSectionsHtml }){
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

  // Dynamic section assembly: gate each block by `sections`, number contiguously, inject Cx block.
  const SEC = Object.assign({ summary:true, kpis:true, ppc:true, constraints:true, reasons:true, byco:true, bycx:true, nextweek:true, milestones:true, schedule:true }, sections||{});
  let _n = 0; const nn = () => String(++_n).padStart(2,"0");
  const sh = (title) => `<div class="sec-head"><span class="eyebrow">${nn()}</span><h2>${title}</h2><div class="rule"></div></div>`;
  const blocks = [];
  let intro = "";
  if (SEC.summary) intro += `<p class="lede">${sumHtml}</p>`;
  if (SEC.kpis) intro += `<div class="kpis">${kpiTiles}</div>`;
  if (intro) blocks.push(`<section>${intro}</section>`);
  if (SEC.ppc) blocks.push(`<section>${sh("Plan reliability")}`
    + `<div class="hero"><div><div class="big num">${r.ppc==null?"&ndash;":r.ppc}<small>${r.ppc==null?"":"%"}</small></div><div class="caplabel"><div class="eyebrow">Percent plan complete</div><div class="sub">${r.ppc==null?"no commitments due":r.kept.length+" of "+r.due.length+" commitments kept"}</div></div></div>`
    + `<div class="promise"><div class="row"><span class="t">This week's commitments &nbsp;<b>(WILL)</b></span><span class="t"><b>${r.kept.length}</b> kept &nbsp; <b>${r.missed.length}</b> missed</span></div>`
    + `<div class="cells">${cells}</div>`
    + `<div class="spark">${spark}<div style="flex:1"></div><div class="legend"><span><i class="dot" style="background:var(--green)"></i>Kept</span><span><i class="dot" style="background:var(--red)"></i>Missed</span></div></div></div></div></section>`);
  if (SEC.constraints) blocks.push(`<section>${sh("Open constraints")}<div class="cards">${cardsHtml}</div></section>`);
  if (SEC.reasons && SEC.byco) blocks.push(`<section><div class="twocol"><div>${sh("Why work slipped")}<div class="bars">${reasonsHtml}</div></div><div>${sh("By contractor")}<div class="bars">${coHtml}</div></div></div></section>`);
  else { if (SEC.reasons) blocks.push(`<section>${sh("Why work slipped")}<div class="bars">${reasonsHtml}</div></section>`); if (SEC.byco) blocks.push(`<section>${sh("By contractor")}<div class="bars">${coHtml}</div></section>`); }
  if (SEC.bycx) blocks.push(`<section>${sh("By Cx stage")}<div class="bars">${cxHtml}</div></section>`);
  if (SEC.nextweek) blocks.push(`<section>${sh("Committed next week")}<div class="rows">${nwHtml}</div></section>`);
  if (SEC.milestones) blocks.push(`<section>${sh("Milestones ahead")}<div class="rows">${msHtml}</div></section>`);
  if (cxSectionsHtml) blocks.push(String(cxSectionsHtml).replace(/__NUM__/g, () => nn()));
  if (SEC.schedule && includeSchedule && scheduleSection) blocks.push(scheduleSection.replace(/<span class="eyebrow">\d+<\/span>/, `<span class="eyebrow">${nn()}</span>`));
  const bodyHtml = blocks.join("\n");

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FIN04 Weekly DLP Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#0F1E2E;--ink-2:#33485C;--muted:#647689;--paper:#FFFFFF;--backdrop:#E9EDF1;--line:#E0E6EC;--line-2:#EEF2F6;--signal:#1E63D6;--green:#0E9384;--amber:#C07A00;--red:#C0392B;--display:"Space Grotesk","Inter",system-ui,sans-serif;--body:"Inter",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
body.dark{--ink:#E8EDF3;--ink-2:#B4C0CD;--muted:#8593A2;--paper:#161D26;--backdrop:#0C1116;--line:#2A3542;--line-2:#1E2732;--signal:#5B9BF5;--green:#2FB6A6;--amber:#E0A33A;--red:#E76A5C}
body.dark .sheet{box-shadow:0 18px 50px rgba(0,0,0,.55)}
body.dark .hero{background:linear-gradient(180deg,#1B2430,#161D26)}
body.dark .b-will{background:rgba(91,155,245,.18)}
body.dark .b-wit{background:rgba(141,107,232,.22);color:#B89CF2}
body.dark .pill.ontrack{background:rgba(47,182,166,.18)}
body.dark .pill.risk{background:rgba(224,163,58,.18)}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{background:var(--backdrop);font-family:var(--body);color:var(--ink);-webkit-font-smoothing:antialiased;line-height:1.5;font-size:14px}
.num{font-variant-numeric:tabular-nums lining-nums}
.bar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 18px;background:#13202F;color:#fff}
.bar .hint{font-size:12.5px;color:#A9BBCD}.bar button{font-family:var(--body);font-size:13px;font-weight:600;border:0;border-radius:8px;background:var(--signal);color:#fff;padding:9px 16px;cursor:pointer}
.bar button:hover{filter:brightness(1.08)}
.sheet{max-width:880px;margin:26px auto;background:var(--paper);box-shadow:0 18px 50px rgba(15,30,46,.14);border-radius:4px;overflow:hidden}
.mast{background:#001C26;color:#fff;padding:26px 38px 22px;position:relative}
.mast::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--red) 0 14%,var(--amber) 14% 36%,var(--green) 36% 62%,var(--signal) 62% 100%)}
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
.sec-head h2{font-family:var(--display);font-weight:700;font-size:15px;letter-spacing:.04em;margin:0;text-transform:uppercase;color:var(--signal)}.sec-head .rule{flex:1;height:1px;background:var(--line)}
.lede{font-size:14.5px;color:var(--ink-2);line-height:1.6;margin:0 0 20px}.lede b{color:var(--ink);font-weight:600}
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
.divider{display:flex;align-items:center;gap:14px;margin:34px 0 22px}.divider .band{flex:1;height:2px;background:var(--ink)}.divider .lbl{font-family:var(--display);font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--signal)}
.cx-adv{display:flex;align-items:center;gap:9px;font-size:11.5px;color:var(--ink-2);background:rgba(30,99,214,.07);border:1px solid var(--line);border-radius:9px;padding:9px 12px;margin-bottom:10px}
.cx-adv .i{width:16px;height:16px;border-radius:50%;background:var(--signal);color:#fff;font-size:10px;font-weight:800;font-style:italic;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.cx-scurve{border:1px solid var(--line);border-radius:10px;padding:8px 10px}.cx-empty{font-size:12px;color:var(--muted);padding:16px;text-align:center}
.cx-funnel .cx-frow{display:grid;grid-template-columns:70px 1fr 74px;align-items:center;gap:10px;margin-bottom:8px}.cx-fnm{font-size:11.5px;font-weight:600}
.cx-fbar{height:20px;border-radius:7px;background:var(--line-2);position:relative;overflow:hidden}.cx-fbar i{position:absolute;left:0;top:0;bottom:0;border-radius:7px}.cx-fbar b{position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:10.5px;font-weight:700}
.cx-fct{font-size:11px;color:var(--muted);text-align:right}
.cx-irl{display:flex;align-items:center;gap:6px}.cx-step{flex:1;border:1px solid var(--line);border-radius:10px;padding:12px 6px;text-align:center}.cx-step .n{font-family:var(--display);font-size:20px;font-weight:700}.cx-step .k{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-top:4px}.cx-arr{color:var(--muted)}
.cx-rag{width:100%;border-collapse:separate;border-spacing:0 5px;font-size:11.5px}.cx-rag th{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;text-align:center}.cx-rag th.l{text-align:left}.cx-rag td{text-align:center}.cx-rag td.v{text-align:left;font-weight:600}
.cx-cell{display:inline-flex;align-items:center;justify-content:center;width:30px;height:22px;border-radius:6px;font-size:10.5px;font-weight:800;border:1px solid}
.c-g{background:rgba(14,147,132,.13);color:var(--green);border-color:rgba(14,147,132,.32)}.c-a{background:rgba(192,122,0,.12);color:var(--amber);border-color:rgba(192,122,0,.3)}.c-r{background:rgba(192,57,43,.12);color:var(--red);border-color:rgba(192,57,43,.3)}.c-x{background:var(--line-2);color:var(--muted);border-color:var(--line)}
.cx-risk{width:100%;border-collapse:collapse;font-size:12px}.cx-risk th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;padding:0 8px 7px 0}.cx-risk td{padding:9px 8px 9px 0;border-top:1px solid var(--line);vertical-align:middle}
.cx-crit{font-size:9.5px;font-weight:700;color:var(--red);background:rgba(192,57,43,.1);border:1px solid rgba(192,57,43,.28);border-radius:999px;padding:2px 8px;white-space:nowrap}
.cx-att{display:flex;align-items:flex-end;gap:14px;height:130px;padding-top:8px}.cx-acol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%}.cx-abar{width:100%;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,var(--signal),rgba(30,99,214,.3));min-height:6px}.cx-awl{font-size:10px;color:var(--muted)}
@page{size:A4;margin:0}
@media print{html,body{background:var(--paper)}.bar{display:none}.sheet{max-width:none;margin:0;box-shadow:none;border-radius:0}section,.ccard,.hero,.kpis,.rows,.barrow,.g-row{break-inside:avoid}.sec-head{break-after:avoid}}
</style></head><body class="${theme === 'dark' ? 'dark' : ''}">
<div class="bar"><div class="hint">Weekly DLP Report. Click Download PDF, then choose "Save as PDF".</div><button onclick="window.print()">Download PDF</button></div>
<div class="sheet">
<div class="mast"><div class="mast-top">
<div class="brand"><img class="logo" src="${ATNORTH_LOGO}" alt="atnorth"><div class="proj"><div class="p1">FIN04 Data Centre</div><div class="p2">Koski, Finland</div></div></div>
<div class="issued">Issued <b>${fmtFull(r.today)}</b><br>${esc(by||"")}</div></div>
<h1>Weekly DLP Report</h1><div class="wk num">${periodLabel} &nbsp;|&nbsp; lookahead to ${fmtFull(r.laEnd)}</div></div>
<div class="body">
${bodyHtml}
</div>
<footer>Generated from DLP &middot; dlp-pi.vercel.app &middot; FIN04 commissioning lookahead</footer>
</div></body></html>`;
}

// Build the Weekly Cx Progress sections for the report from a cx_week snapshot. Numbers are placeholders (__NUM__), filled during assembly.
function buildCxReportSections(snap, sel, baselineAgreed){
  if (!snap) return "";
  const D = snap.detail || {};
  const SS = Object.assign({ cxkpis:true, scurve:true, funnel:true, bytype:false, issues:false, irl:false, docs:true, cxmilestones:false, risks:true, attendance:false }, sel||{});
  const sh = (t) => `<div class="sec-head"><span class="eyebrow">__NUM__</span><h2>${t}</h2><div class="rule"></div></div>`;
  const pct = (v) => (v==null||isNaN(v))?0:Math.round(v*10)/10;
  const secs = [];
  if (SS.cxkpis){
    const tiles = [
      ["Cx assets",(snap.assets||0).toLocaleString(),"var(--signal)"],["Red tag (L1)",pct(snap.red_pct)+"%","var(--red)"],
      ["Yellow tag (L2)",pct(snap.yellow_pct)+"%","var(--amber)"],["Green tag (L3)",pct(snap.green_pct)+"%","var(--green)"],
      ["Open issues",snap.open_issues==null?"&ndash;":snap.open_issues,"var(--signal)"],["Awaiting verification",snap.awaiting_verification==null?"&ndash;":snap.awaiting_verification,"var(--amber)"],
    ].map(([l,v,c])=>`<div class="kpi"><div class="v num" style="color:${c}">${v}</div><div class="l">${l}</div></div>`).join("");
    secs.push(`<section>${sh("Cx attainment")}<div class="kpis">${tiles}</div></section>`);
  }
  if (SS.scurve){
    const sc = D.scurve||[]; const W=700,H=150,n=sc.length; const X=(i)=>n<2?0:(i/(n-1))*W, Y=(v)=>H-(H-8)*((v||0)/100)-4;
    const path=(idx)=>{ let d="",st=false; for(let i=0;i<n;i++){const v=sc[i][idx]; if(v==null)continue; d+=(st?"L":"M")+X(i).toFixed(1)+" "+Y(v).toFixed(1)+" "; st=true;} return d; };
    const adv = !baselineAgreed ? `<div class="cx-adv"><span class="i">i</span>Provisional. The planned curve and variance update automatically once a delivery schedule is linked.</div>` : "";
    const svg = n ? `<div class="cx-scurve"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="150"><line x1="0" y1="${H-4}" x2="${W}" y2="${H-4}" stroke="var(--line)"/>${baselineAgreed?`<path d="${path(1)}" fill="none" stroke="var(--signal)" stroke-width="2" stroke-dasharray="6 5" opacity="0.55"/>`:""}<path d="${path(2)}" fill="none" stroke="var(--green)" stroke-width="2.4"/></svg></div>` : `<div class="cx-empty">No programme data in this import.</div>`;
    secs.push(`<section>${sh("Programme S-curve, planned vs actual")}${adv}${svg}</section>`);
  }
  if (SS.funnel){
    const rows = [["L1 Red",snap.red_n,snap.red_pct,"var(--red)"],["L2 Yellow",snap.yellow_n,snap.yellow_pct,"var(--amber)"],["L3 Green",snap.green_n,snap.green_pct,"var(--green)"],["L4 Blue",snap.blue_n,snap.blue_pct,"var(--signal)"],["L5 White",snap.white_n,snap.white_pct,"#8593A2"]];
    const html = rows.map(([nm,nv,p,c])=>`<div class="cx-frow"><div class="cx-fnm">${nm}</div><div class="cx-fbar"><i style="width:${Math.max(1.5,pct(p))}%;background:${c}"></i><b>${pct(p)}%</b></div><div class="cx-fct">${nv||0}</div></div>`).join("");
    secs.push(`<section>${sh("Tag attainment funnel")}<div class="cx-funnel">${html}</div></section>`);
  }
  if (SS.bytype && (D.byType||[]).length){
    const rows = D.byType.slice(0,10).map((r)=>`<div class="cx-frow"><div class="cx-fnm">${esc(r[0])}</div><div class="cx-fbar"><i style="width:${Math.max(1.5,pct(r[1]))}%;background:var(--red)"></i></div><div class="cx-fct">${pct(r[1])}% &middot; ${r[2]}</div></div>`).join("");
    secs.push(`<section>${sh("Red tag by equipment type")}<div class="cx-funnel">${rows}</div></section>`);
  }
  if (SS.issues && D.issuesByType && Object.keys(D.issuesByType).length){
    const mx = Math.max(1, ...Object.values(D.issuesByType));
    const rows = Object.entries(D.issuesByType).map(([k,v])=>`<div class="barrow"><span class="nm">${esc(k)}</span><div class="track"><div class="fill" style="width:${Math.round(v/mx*100)}%;background:var(--signal)"></div></div><span class="ct num">${v}</span></div>`).join("");
    secs.push(`<section>${sh("Open issues by type")}<div class="bars">${rows}</div></section>`);
  }
  if (SS.irl){
    const irl = D.irl || { opened:snap.irl_opened, started:snap.irl_started, delivered:snap.irl_delivered, verified:snap.irl_verified };
    const steps = [["Opened",irl.opened],["Started",irl.started],["Delivered",irl.delivered],["Verified",irl.verified]];
    const html = steps.map(([l,v])=>`<div class="cx-step"><div class="n num">${v==null?"&ndash;":v}</div><div class="k">${l}</div></div>`).join('<span class="cx-arr">&rsaquo;</span>');
    secs.push(`<section>${sh("IRL workflow this week")}<div class="cx-irl">${html}</div></section>`);
  }
  if (SS.docs && D.docs && (D.docs.rows||[]).length){
    const cols = D.docs.cols||[];
    const head = `<tr><th class="l">Vendor</th>${cols.map((c)=>`<th>${esc(c)}</th>`).join("")}</tr>`;
    const rows = D.docs.rows.map((r)=>`<tr><td class="v">${esc(r[0])}</td>${(r[1]||[]).map((g)=>`<td><span class="cx-cell c-${String(g||"x").toLowerCase()}">${g}</span></td>`).join("")}</tr>`).join("");
    secs.push(`<section>${sh("Documentation register")}<table class="cx-rag">${head}${rows}</table></section>`);
  }
  if (SS.cxmilestones && (D.milestones||[]).length){
    const rows = D.milestones.slice(0,8).map((m)=>`<div class="lrow"><div><div class="nm">${esc(m[0])}</div><div class="sub">${esc(m[2]||"")}</div></div><span class="num">${m[3]==null?"":"+"+m[3]+"d"}</span></div>`).join("");
    secs.push(`<section>${sh("Cx milestones")}<div class="rows">${rows}</div></section>`);
  }
  if (SS.risks && (D.risks||[]).length){
    const rows = D.risks.map((r)=>`<tr><td>${esc(r[0])}</td><td class="num">${esc(r[3]||"")}</td><td>${/crit/i.test(r[4])?`<span class="cx-crit">${esc(r[4])}</span>`:esc(r[4]||"")}</td></tr>`).join("");
    secs.push(`<section>${sh("Risk register")}<table class="cx-risk"><tr><th>Risk</th><th>Due</th><th>Priority</th></tr>${rows}</table></section>`);
  }
  if (SS.attendance && (D.attendance||[]).length){
    const att = D.attendance.filter((a)=>a&&a.rate!=null);
    if (att.length){ const html = att.map((a)=>`<div class="cx-acol"><div class="cx-abar" style="height:${Math.max(6,a.rate)}%"></div><div class="cx-awl">${esc(String(a.wk).replace(/week\s*/i,"W"))} ${a.rate}%</div></div>`).join("");
      secs.push(`<section>${sh("Vendor attendance")}<div class="cx-att">${html}</div></section>`); }
  }
  if (!secs.length) return "";
  return `<div class="divider"><span class="band"></span><span class="lbl">Weekly Cx Progress</span><span class="band"></span></div>` + secs.join("\n");
}

// Deterministic narrative composed from only the included sections' live data.
function draftReportSummary({ r, sections, cxSnap, cxSel }){
  const SEC = sections||{}; const parts=[];
  if (r && SEC.ppc!==false){
    if (r.ppc==null) parts.push("No commitments fell due this week.");
    else parts.push(`Commitment reliability stood at ${r.ppc}% PPC, with ${r.kept.length} of ${r.due.length} committed activit${r.due.length===1?"y":"ies"} completed on time.`);
  }
  if (r && SEC.constraints!==false && r.cards.length) parts.push(`${r.cards.length} activit${r.cards.length===1?"y carries":"ies carry"} open constraints in the lookahead.`);
  if (r && SEC.reasons!==false && r.reasons[0] && r.reasons[0].name!=="Unattributed") parts.push(`The main driver of non-completion was ${r.reasons[0].name.toLowerCase()}.`);
  if (cxSnap){
    const cs = cxSel||{}, D = cxSnap.detail||{};
    if (cs.cxkpis!==false) parts.push(`On asset attainment, L1 red-tag reached ${Math.round((cxSnap.red_pct||0)*10)/10}% across ${(cxSnap.assets||0).toLocaleString()} assets, with L3 at ${Math.round((cxSnap.green_pct||0)*10)/10}%.`);
    if (cs.risks!==false && (D.risks||[]).length){ const crit=D.risks.filter((x)=>/crit/i.test(x[4])).length; if (crit) parts.push(`${crit} critical risk${crit===1?"":"s"} remain open on the register.`); }
    if (cs.docs!==false && D.docs && (D.docs.rows||[]).length){ const red=D.docs.rows.filter((x)=>(x[1]||[]).some((g)=>String(g).toUpperCase()==="R")).length; if (red) parts.push(`${red} document vendor${red===1?" is":"s are"} red on the register.`); }
  }
  return parts.join(" ");
}

const RPT_PLAN_SECTIONS = [["summary","Executive summary"],["ppc","Commitment reliability"],["kpis","Lookahead KPIs"],["constraints","Open constraint cards"],["reasons","Reasons for non-completion"],["breakdowns","By contractor / Cx stage"],["nextweek","Next week commitments"],["milestones","Milestones"],["schedule","Schedule snapshot"]];
const RPT_CX_SECTIONS = [["cxkpis","Cx attainment KPIs"],["scurve","Programme S-curve"],["funnel","Tag attainment funnel"],["bytype","Red tag by equipment"],["issues","Open issues by type"],["irl","IRL workflow"],["docs","Documentation register"],["cxmilestones","Cx milestones"],["risks","Risk register"],["attendance","Vendor attendance"]];
const RPT_PLAN_DEFAULT = { summary:true, ppc:true, kpis:true, constraints:true, reasons:true, breakdowns:false, nextweek:false, milestones:true, schedule:true };
const RPT_CX_DEFAULT = { cxkpis:true, scurve:true, funnel:true, bytype:false, issues:false, irl:false, docs:true, cxmilestones:false, risks:true, attendance:false };

// AI polish guard: the polished text may not introduce any number/percentage absent from the deterministic draft.
const rptNumTokens = (s) => (String(s||"").match(/\d[\d,.]*%?/g) || []).map((t)=>t.replace(/,/g,""));
const rptNumbersOk = (draft, out) => { const D = new Set(rptNumTokens(draft)); return rptNumTokens(out).every((t)=>D.has(t)); };

// Shared Weekly Report launcher: identical button + config window used on both Analytics and Weekly Cx Progress.
function WeeklyReportLauncher({ S, LV, coName, by, isAdmin, projectId, label, variant }){
  const defWeek = useMemo(() => { const t = new Date(todayMid()); const dow = t.getDay(); const back = (dow - 5 + 7) % 7; const fri = addDays(t, -back); const mon = mondayOf(fri); return { start: mon, end: addDays(mon, 6) }; }, []);
  const prefKey = "dlp_report_sections_" + (projectId||"x");
  const loadPref = () => { try { const j = JSON.parse(localStorage.getItem(prefKey)||"null"); if (j && j.plan && j.cx) return j; } catch(e){} return { plan:{...RPT_PLAN_DEFAULT}, cx:{...RPT_CX_DEFAULT} }; };
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("week");
  const [from, setFrom] = useState(fmtISO(defWeek.start));
  const [to, setTo] = useState(fmtISO(defWeek.end));
  const [summary, setSummary] = useState(null);
  const [theme, setTheme] = useState("light");
  const [plan, setPlan] = useState(() => loadPref().plan);
  const [cx, setCx] = useState(() => loadPref().cx);
  const [cxSnap, setCxSnap] = useState(null);
  const [cxBaseline, setCxBaseline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishNote, setPolishNote] = useState("");
  const [recips, setRecips] = useState([]);
  const [emails, setEmails] = useState({});
  const [recipOpen, setRecipOpen] = useState(false);
  const [recipMsg, setRecipMsg] = useState("");
  const [exName, setExName] = useState("");
  const [exEmail, setExEmail] = useState("");
  const start = mode === "week" ? defWeek.start : (from ? parseD(from) : defWeek.start);
  const end = mode === "week" ? defWeek.end : (to ? parseD(to) : defWeek.end);
  const rData = useMemo(() => open ? computeReport({ S, LV, coName, start, end }) : null, [open, S, LV, start.getTime(), end.getTime()]);
  const secObj = () => ({ ...plan, byco: plan.breakdowns, bycx: plan.breakdowns });
  const autoSummary = useMemo(() => rData ? draftReportSummary({ r: rData, sections: secObj(), cxSnap, cxSel: cx }) : "", [rData, plan, cx, cxSnap]);
  const summaryVal = summary != null ? summary : autoSummary;
  const persist = (p, c) => { try { localStorage.setItem(prefKey, JSON.stringify({ plan:p, cx:c })); } catch(e){} };
  const togPlan = (k) => { const nx = { ...plan, [k]: !plan[k] }; setPlan(nx); setSummary(null); persist(nx, cx); };
  const togCx = (k) => { const nx = { ...cx, [k]: !cx[k] }; setCx(nx); setSummary(null); persist(plan, nx); };
  const openModal = async () => {
    setSummary(null); setMode("week"); setFrom(fmtISO(defWeek.start)); setTo(fmtISO(defWeek.end)); setOpen(true); setBusy(true);
    try {
      const [{ data: wk }, { data: conf }] = await Promise.all([
        supabase.from("cx_week").select("*").eq("project_id", projectId).order("week_ending", { ascending: false }).limit(1),
        supabase.from("cx_config").select("config").eq("project_id", projectId).maybeSingle(),
      ]);
      setCxSnap(wk && wk[0] ? wk[0] : null);
      setCxBaseline(!!(conf && conf.config && conf.config.baselineAgreed));
    } catch(e) { setCxSnap(null); }
    try {
      const [rr, us] = await Promise.all([ loadReportRecipients(projectId), fetchUserStatus() ]);
      const em = {}; Object.keys(us || {}).forEach((id) => { if (us[id] && us[id].email) em[id] = us[id].email; });
      setEmails(em);
      const seed = [{ name: "Alexander L", email: "alexander.l@cs-nordics.com" }, { name: "Etienne B", email: "etienne.b@cs-international.com" }];
      setRecips(rr && rr.length ? rr : seed);
    } catch(e) {}
    setBusy(false);
  };
  const generate = () => {
    const cxHtml = cxSnap ? buildCxReportSections(cxSnap, cx, cxBaseline) : "";
    const html = buildWeeklyReportHTML({ r: rData, summary: summaryVal, includeSchedule: !!plan.schedule, by, mode, theme, sections: secObj(), cxSectionsHtml: cxHtml });
    const w = window.open("", "_blank");
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    else { const url = URL.createObjectURL(new Blob([html], { type: "text/html" })); const a = document.createElement("a"); a.href = url; a.download = `FIN04-weekly-report-${fmtISO(start)}${theme==="dark"?"-dark":""}.html`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
    setOpen(false);
  };
  if (!isAdmin) return null;
  const polish = async () => {
    const draft = summaryVal; if (!draft) return;
    setPolishing(true); setPolishNote("");
    try {
      const { data, error } = await supabase.functions.invoke("super-action", { body: { draft } });
      if (error) setPolishNote("AI polish unavailable: " + (error.message || "function not reachable") + ". Keeping the drafted summary.");
      else if (!data || data.error) setPolishNote("AI polish unavailable: " + ((data && (data.detail || data.error)) || "not configured") + ". Keeping the drafted summary.");
      else if (data.text && rptNumbersOk(draft, data.text)) { setSummary(data.text); setPolishNote("Polished with AI. Every figure preserved and verified."); }
      else setPolishNote("AI output altered a figure, so it was rejected. Keeping the drafted summary.");
    } catch (e) { setPolishNote("AI polish unavailable: " + String((e && e.message) || e) + ". Keeping the drafted summary."); }
    setPolishing(false);
  };
  const toggleUser = (u) => {
    const em = emails[u.id]; if (!em) return; const low = em.toLowerCase();
    setRecips((prev) => prev.some((r) => (r.email || "").toLowerCase() === low) ? prev.filter((r) => (r.email || "").toLowerCase() !== low) : [...prev, { name: u.name || em, email: em }]);
    setRecipMsg("");
  };
  const addExternal = () => {
    const em = (exEmail || "").trim(); if (!em || !/.+@.+\..+/.test(em)) { setRecipMsg("Enter a valid email."); return; }
    const low = em.toLowerCase();
    setRecips((prev) => prev.some((r) => (r.email || "").toLowerCase() === low) ? prev : [...prev, { name: (exName || "").trim() || em, email: em }]);
    setExName(""); setExEmail(""); setRecipMsg("");
  };
  const removeRecip = (email) => { const low = (email || "").toLowerCase(); setRecips((prev) => prev.filter((r) => (r.email || "").toLowerCase() !== low)); };
  const saveRecips = async () => {
    setRecipMsg("Saving\u2026");
    try { const saved = await saveReportRecipients(projectId, recips); setRecips(saved); setRecipMsg("Saved."); }
    catch(e) { setRecipMsg("Save failed: " + String((e && e.message) || e)); }
  };
  const copyAddresses = async () => {
    const list = recips.map((r) => r.email).filter(Boolean).join("; ");
    try { await navigator.clipboard.writeText(list); setRecipMsg("Addresses copied to clipboard."); }
    catch(e) { setRecipMsg("Copy failed; select the addresses manually."); }
  };
  const emailReport = () => {
    const to = recips.map((r) => r.email).filter(Boolean).join(";");
    if (!to) return;
    const lbl = mode === "week" ? "week ending " + fmtDoW(defWeek.end) : fmtISO(start) + " to " + fmtISO(end);
    const subject = "FIN04 Weekly DLP Report, " + lbl;
    const body = "Please find attached the FIN04 Weekly DLP Report (" + lbl + ").\r\n\r\nGenerated by " + by + ".\r\n\r\nAttach the PDF saved from the report window before sending.";
    window.location.href = "mailto:?to=" + encodeURIComponent(to) + "&subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  };
  const optRow = (on, lbl, onClick) => (<label key={lbl} className="rep-check" style={{ display:"flex", alignItems:"center", gap:9, padding:"6px 2px", margin:0, cursor:"pointer" }}><input type="checkbox" checked={!!on} onChange={onClick} /><span style={{ fontSize:12.5 }}>{lbl}</span></label>);
  return (<>
    <button className={variant==="cx" ? "cxp-btn" : "lk-btn primary"} onClick={openModal}><Icon n="chart" s={14} />{label||"Weekly Report"}</button>
    {open && <div className="lk-modal-bg" onClick={() => setOpen(false)}>
      <div className="lk-modal" style={{ ...cssVars(S.theme), maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="lk-dh"><h3>Generate Weekly DLP Report</h3><button className="lk-btn icon" onClick={() => setOpen(false)}><Icon n="x" /></button></div>
        <div className="bd">
          <div className="rep-fld"><label>Reporting Period</label>
            <div className="rep-seg"><button className={mode==="week"?"on":""} onClick={() => { setMode("week"); setSummary(null); }}>Week Just Ended</button><button className={mode==="range"?"on":""} onClick={() => { setMode("range"); setSummary(null); }}>Custom Range</button></div>
          </div>
          {mode==="week" ? <div className="rep-hint">Week {isoWeek(defWeek.start)} {"\u00b7"} {fmtDoW(defWeek.start)} to {fmtDoW(defWeek.end)}</div>
            : <div className="rep-dates"><div className="lk-f"><label>From</label><input className="lk-in mono" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setSummary(null); }} /></div><div className="lk-f"><label>To</label><input className="lk-in mono" type="date" value={to} onChange={(e) => { setTo(e.target.value); setSummary(null); }} /></div></div>}
          <div className="rep-fld" style={{ marginTop: 14 }}><label>Sections To Include</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div style={{ border:"1px solid var(--line)", borderRadius:10, padding:"8px 12px" }}>
                <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--accent)", marginBottom:4 }}>Planning board</div>
                {RPT_PLAN_SECTIONS.map(([k,l]) => optRow(plan[k], l, () => togPlan(k)))}
              </div>
              <div style={{ border:"1px solid var(--line)", borderRadius:10, padding:"8px 12px", opacity: cxSnap?1:.6 }}>
                <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", color:"var(--accent)", marginBottom:4 }}>Weekly Cx Progress</div>
                {RPT_CX_SECTIONS.map(([k,l]) => optRow(cx[k], l, () => togCx(k)))}
              </div>
            </div>
            <div className="rep-mut" style={{ fontSize:11, marginTop:6 }}>{busy ? "Loading latest Cx week..." : cxSnap ? ("Cx sections read the week ending " + fmtFull(new Date(cxSnap.week_ending)) + ".") : "No Cx week imported yet; Cx sections will be skipped."}</div>
          </div>
          <div className="rep-fld" style={{ marginTop: 14 }}><label style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}><span>Executive Summary <span className="rep-mut">(auto-drafted from included sections, editable)</span></span><button type="button" className="lk-btn" style={{ padding:"4px 10px", fontSize:11.5 }} disabled={polishing} onClick={polish}>{polishing ? "Polishing\u2026" : "Polish with AI"}</button></label>
            <textarea className="lk-in rep-sum" rows={4} value={summaryVal} onChange={(e) => setSummary(e.target.value)} />
            {polishNote && <div className="rep-mut" style={{ fontSize:11, marginTop:4 }}>{polishNote}</div>}</div>
          <div className="rep-fld" style={{ marginTop: 14 }}><label>Appearance</label>
            <div className="rep-seg"><button className={theme==="light"?"on":""} onClick={() => setTheme("light")}>Light</button><button className={theme==="dark"?"on":""} onClick={() => setTheme("dark")}>Dark</button></div>
          </div>
          <div className="rep-fld" style={{ marginTop: 14 }}><label>Distribution List</label>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span className="rep-mut" style={{ fontSize:12 }}>{recips.length} recipient{recips.length===1?"":"s"} saved</span>
              <button type="button" className="lk-btn" style={{ padding:"4px 10px", fontSize:11.5 }} onClick={() => { setRecipMsg(""); setRecipOpen(true); }}>Manage recipients</button>
            </div>
            <div className="rep-mut" style={{ fontSize:11, marginTop:6 }}>Email report opens an Outlook draft addressed to this list; attach the PDF you save from the report window, then send.</div>
          </div>
        </div>
        <div className="rep-foot"><button className="lk-btn" onClick={() => setOpen(false)}>Cancel</button><button className="lk-btn" onClick={emailReport} disabled={!recips.length} title="Open an Outlook draft addressed to the distribution list">Email report</button><button className="lk-btn primary" onClick={generate}><Icon n="chart" s={14} />Generate report</button></div>
      </div>
    </div>}
    {recipOpen && <div className="lk-modal-bg" onClick={() => setRecipOpen(false)}>
      <div className="lk-modal" style={{ ...cssVars(S.theme), maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
        <div className="lk-dh"><h3>Report Recipients</h3><button className="lk-btn icon" onClick={() => setRecipOpen(false)}><Icon n="x" /></button></div>
        <div className="bd" style={{ maxHeight: "62vh", overflow: "auto" }}>
          <div className="rep-fld"><label>Selected ({recips.length})</label>
            {recips.length ? <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {recips.map((r) => <span key={r.email} title={r.email} style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:11.5, border:"1px solid var(--line)", borderRadius:20, padding:"3px 9px" }}>{r.name || r.email}<button onClick={() => removeRecip(r.email)} style={{ background:"none", border:0, cursor:"pointer", color:"var(--muted)", padding:0, lineHeight:1, fontSize:14 }}>{"\u00d7"}</button></span>)}
            </div> : <div className="rep-mut" style={{ fontSize:12 }}>No recipients yet.</div>}
          </div>
          <div className="rep-fld" style={{ marginTop: 12 }}><label>Add From Platform</label>
            {(() => {
              const cnm = (id) => (S.companies.find((c) => c.id === id) || {}).name || "No company";
              const groups = {};
              (S.users || []).forEach((u) => { if (!emails[u.id]) return; const k = cnm(u.companyId); (groups[k] = groups[k] || []).push(u); });
              const keys = Object.keys(groups).sort();
              if (!keys.length) return <div className="rep-mut" style={{ fontSize:12 }}>No platform emails available.</div>;
              const has = (u) => recips.some((r) => (r.email||"").toLowerCase() === (emails[u.id]||"").toLowerCase());
              return keys.map((k) => <div key={k} style={{ marginBottom:8 }}>
                <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:".05em", textTransform:"uppercase", color:"var(--accent)", margin:"6px 0 3px" }}>{k}</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"2px 14px" }}>
                  {groups[k].slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map((u) => <label key={u.id} style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, cursor:"pointer", padding:"2px 0" }}><input type="checkbox" checked={has(u)} onChange={() => toggleUser(u)} /><span>{u.name || emails[u.id]}</span></label>)}
                </div>
              </div>);
            })()}
          </div>
          <div className="rep-fld" style={{ marginTop: 12 }}><label>Add External (Not On Platform)</label>
            <div style={{ display:"flex", gap:8 }}>
              <input className="lk-in" style={{ flex:1 }} placeholder="Name" value={exName} onChange={(e) => setExName(e.target.value)} />
              <input className="lk-in" style={{ flex:1.4 }} placeholder="Email" value={exEmail} onChange={(e) => setExEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addExternal(); }} />
              <button className="lk-btn" onClick={addExternal}>Add</button>
            </div>
          </div>
          {recipMsg && <div className="rep-mut" style={{ fontSize:11.5, marginTop:8 }}>{recipMsg}</div>}
        </div>
        <div className="rep-foot"><button className="lk-btn" onClick={copyAddresses}>Copy addresses</button><button className="lk-btn" onClick={() => setRecipOpen(false)}>Close</button><button className="lk-btn primary" onClick={saveRecips}>Save list</button></div>
      </div>
    </div>}
  </>);
}

function ReportsPage({ S, LV, coName, exportActivities, exportWitness, markWitnessSent, onOpen, isAdmin, by, projectId }) {
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
  const [repTheme, setRepTheme] = useState("light");
  const repStart = repMode === "week" ? defWeek.start : (repFrom ? parseD(repFrom) : defWeek.start);
  const repEnd = repMode === "week" ? defWeek.end : (repTo ? parseD(repTo) : defWeek.end);
  const repData = useMemo(() => repOpen ? computeReport({ S, LV, coName, start: repStart, end: repEnd }) : null, [repOpen, S, LV, repStart.getTime(), repEnd.getTime()]);
  const repSummaryVal = repSummary != null ? repSummary : (repData ? draftSummary(repData) : "");
  const generateReport = () => {
    const html = buildWeeklyReportHTML({ r: repData, summary: repSummaryVal, includeSchedule: repSchedule, by, mode: repMode, theme: repTheme });
    const w = window.open("", "_blank");
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    else { const url = URL.createObjectURL(new Blob([html], { type: "text/html" })); const a = document.createElement("a"); a.href = url; a.download = `FIN04-weekly-report-${fmtISO(repStart)}${repTheme === "dark" ? "-dark" : ""}.html`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
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
      <div className="lk-rep-filters">
        <div className="lk-f" style={{ minWidth: 150 }}><label>Company</label><select className="lk-select" value={co} onChange={(e) => setCo(e.target.value)}><option value="all">All companies</option>{S.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 150 }}><label>Building</label><select className="lk-select" value={ar} onChange={(e) => setAr(e.target.value)}><option value="all">All buildings</option>{S.areas.map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 130 }}><label>Cx Stage</label><select className="lk-select" value={lv} onChange={(e) => setLv(e.target.value)}><option value="all">All Cx stages</option>{Object.keys(LV).map((k) => <option key={k} value={k}>{k}</option>)}</select></div>
        <div className="lk-f" style={{ minWidth: 120 }}><label>Period</label><select className="lk-select" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="all">All time</option><option value="range">Date range</option></select></div>
        {period === "range" && <div className="lk-f" style={{ minWidth: 132 }}><label>From</label><input className="lk-in mono" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>}
        {period === "range" && <div className="lk-f" style={{ minWidth: 132 }}><label>To</label><input className="lk-in mono" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>}
        <button className="lk-btn" onClick={exportActivities}><Icon n="download" s={14} />Export all activities</button>
        <button className="lk-btn" onClick={exportWitness}><Icon n="download" s={14} />Export witness invites</button>
        {isAdmin && <><button className="lk-btn" title="Import the sent-confirmations file the Outlook macro writes, to stamp these invites as sent" onClick={() => { const el = document.getElementById("witSentInp"); if (el) el.click(); }}><Icon n="check" s={14} />Mark sent (from Outlook)</button>
        <input id="witSentInp" type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const ids = String(rd.result || "").split(/\r?\n/).map((ln) => (ln.split(",")[0] || "").trim().replace(/^"|"$/g, "")).filter((c) => c && c.toLowerCase() !== "activity id"); markWitnessSent(ids); }; rd.readAsText(f); e.target.value = ""; }} /></>}
        <WeeklyReportLauncher S={S} LV={LV} coName={coName} by={by} isAdmin={isAdmin} projectId={projectId} label="Weekly Report" />
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
      <div className="lk-rep-sec"><h3>Weekly PPC Trend</h3>{hasTrend ? <Trend points={points} onPoint={(i) => openDrill("Week " + points[i].label + " \u00b7 committed due", points[i].items)} /> : <div style={{ fontSize: 12, color: "var(--muted)" }}>Needs committed activities across weeks to plot a trend.</div>}</div>
      <div className="lk-rep-sec"><h3>Reasons For Non-Completion</h3>
        {misses.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted)" }}>No missed commitments to date. Every committed activity whose promised finish has passed was completed on time.</div>
          : <><div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, marginBottom: 10 }}><b style={{ color: "#C0392B" }}>{misses.length}</b> committed activit{misses.length === 1 ? "y" : "ies"} due to date {misses.length === 1 ? "was" : "were"} not completed as promised{reasonTally["Unattributed"] ? <>, of which <b style={{ color: "var(--ink)" }}>{reasonTally["Unattributed"]}</b> {reasonTally["Unattributed"] === 1 ? "has" : "have"} no reason recorded</> : ""}. Recording the reason on each miss turns this into a Pareto of what is actually breaking the plan.</div>
            {reasonRows.map((x) => <RepBar key={x.name} label={x.name} n={x.n} max={maxR} color={x.name === "Unattributed" ? "#94A3B8" : "#C0392B"} onClick={() => openDrill("Missed \u00b7 " + x.name, misses.filter((m) => (m.slipReason || "Unattributed") === x.name))} />)}</>}
      </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
        <div className="lk-rep-sec"><h3>Status Mix</h3><div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}><Donut data={statusData} onSlice={(d) => openDrill(d.name, acts.filter((a) => a.status === d.k))} /><div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{statusData.map((s) => <div key={s.k} onClick={() => openDrill(s.name, acts.filter((a) => a.status === s.k))} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}><span style={{ width: 11, height: 11, borderRadius: 3, background: s.color }} />{s.name}<span style={{ color: "var(--muted)" }}>{s.n}</span></div>)}</div></div></div>
        <div className="lk-rep-sec"><h3>Activities By Company</h3>{byCompany.length === 0 ? <div style={{ fontSize: 12, color: "var(--muted)" }}>No activities.</div> : byCompany.map((x) => <RepBar key={x.name} label={`${x.name}${x.open ? ` (${x.open} open)` : ""}`} n={x.n} max={maxCo} onClick={() => openDrill(x.name, acts.filter((a) => a.companyId === x.id))} />)}</div>
      </div>
      <div className="lk-rep-sec"><h3>By Cx Stage</h3>{byLevel.map((x) => <RepBar key={x.name} label={x.name} n={x.n} max={maxLv} color={x.color} onClick={() => openDrill(x.name, acts.filter((a) => a.level === x.k))} />)}</div>
      {repOpen && <div className="lk-modal-bg" onClick={() => setRepOpen(false)}>
        <div className="lk-modal" style={{ ...cssVars(S.theme), maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
          <div className="lk-dh"><h3>Generate Weekly DLP Report</h3><button className="lk-btn icon" onClick={() => setRepOpen(false)}><Icon n="x" /></button></div>
          <div className="bd">
            <div className="rep-fld"><label>Reporting Period</label>
              <div className="rep-seg">
                <button className={repMode === "week" ? "on" : ""} onClick={() => { setRepMode("week"); setRepSummary(null); }}>Week Just Ended</button>
                <button className={repMode === "range" ? "on" : ""} onClick={() => { setRepMode("range"); setRepSummary(null); }}>Custom Range</button>
              </div>
            </div>
            {repMode === "week"
              ? <div className="rep-hint">Week {isoWeek(defWeek.start)} {"\u00b7"} {fmtDoW(defWeek.start)} to {fmtDoW(defWeek.end)}</div>
              : <div className="rep-dates"><div className="lk-f"><label>From</label><input className="lk-in mono" type="date" value={repFrom} onChange={(e) => { setRepFrom(e.target.value); setRepSummary(null); }} /></div><div className="lk-f"><label>To</label><input className="lk-in mono" type="date" value={repTo} onChange={(e) => { setRepTo(e.target.value); setRepSummary(null); }} /></div></div>}
            <div className="rep-fld"><label>Executive Summary <span className="rep-mut">(auto-drafted, editable)</span></label>
              <textarea className="lk-in rep-sum" rows={4} value={repSummaryVal} onChange={(e) => setRepSummary(e.target.value)} /></div>
            <label className="rep-check"><input type="checkbox" checked={repSchedule} onChange={(e) => setRepSchedule(e.target.checked)} /> Include Schedule Snapshot (4 Week Lookahead)</label>
            <div className="rep-fld" style={{ marginTop: 14 }}><label>Appearance</label>
              <div className="rep-seg">
                <button className={repTheme === "light" ? "on" : ""} onClick={() => setRepTheme("light")}>Light</button>
                <button className={repTheme === "dark" ? "on" : ""} onClick={() => setRepTheme("dark")}>Dark</button>
              </div>
            </div>
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
  const normDate = (s) => { if (s == null || s === "") return ""; if (s instanceof Date) return isNaN(s) ? "" : fmtISO(s); s = String(s).trim(); if (!s) return ""; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; let m = s.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/); if (m) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0"); m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})$/); if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return y + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0"); } m = s.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3,9})[-\/ ](\d{2}|\d{4})$/); if (m) { const mo = ({ jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 })[m[2].slice(0, 3).toLowerCase()]; if (mo) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return y + "-" + String(mo).padStart(2, "0") + "-" + m[1].padStart(2, "0"); } } const d = new Date(s); return isNaN(d) ? "" : fmtISO(d); };
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
    const ci = { desc: idx(["description", "activity description", "activity", "desc"]), company: idx(["company", "contractor"]), area: idx(["building", "area"]), subarea: idx(["level", "floor", "sub-area", "sub area", "subarea"]), tier3: idx(["zone", "room", "tier 3 area", "tier3 area", "tier 3", "tier3"]), asset: idx(["asset", "equipment", "tag"]), system: idx(["system"]), level: idx(["cx stage", "cx", "stage"]), ms: idx(["milestone"]), wit: idx(["witness invite", "witness"]), witat: idx(["witness date", "witness time", "witness at"]), notes: idx(["notes", "comment"]), pstart: idx(["planned start", "start"]), pfin: idx(["planned finish", "finish", "end"]), dur: idx(["duration", "days"]), astart: idx(["actual start"]), afin: idx(["actual finish"]), status: idx(["status"]), commit: idx(["committed", "commit"]), cons: idx(["constraints", "constraint"]) };
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
      if (isAdmin) { if (!coRaw) e.push("missing Company (name an existing company on each row)"); else { const c = coByName.get(coRaw.toLowerCase()); if (!c) e.push(`company "${coRaw}" does not exist`); else companyId = c.id; } }
      else { if (coRaw) { const c = coByName.get(coRaw.toLowerCase()); if (!c) e.push(`company "${coRaw}" does not exist`); else if (c.id !== cu.companyId) e.push(`you can only import activities for your own company (${myCoName || "your company"})`); } if (!companyId) e.push("your account has no company assigned; ask an admin to set one before importing"); }
      const isMs = yes(g(ci.ms));
      const areaRaw = g(ci.area); let area = ""; if (areaRaw) { const m = areaMap.get(areaRaw.toLowerCase()); if (!m) e.push(`building "${areaRaw}" does not exist`); else area = m; } else if (!isMs) e.push("missing Building");
      const subRaw = g(ci.subarea); let subArea = ""; if (subRaw) { if (area && subSet.has(`${area.toLowerCase()}|${subRaw.toLowerCase()}`)) subArea = subRaw; else e.push(`level "${subRaw}" does not exist under building "${areaRaw}"`); }
      const t3Raw = g(ci.tier3); let tier3 = ""; if (t3Raw) { if (area && subArea && t3Set.has(`${area.toLowerCase()}|${subArea.toLowerCase()}|${t3Raw.toLowerCase()}`)) tier3 = t3Raw; else e.push(`zone/room "${t3Raw}" does not exist under "${areaRaw}" / "${subRaw}"`); }
      const sysRaw = g(ci.system); let system = ""; if (sysRaw) { const m = sysMap.get(sysRaw.toLowerCase()); if (!m) e.push(`system "${sysRaw}" does not exist`); else system = m; } else if (!isMs) e.push("missing System");
      const lvRaw = g(ci.level).toUpperCase(); let level = lvKeys[0] || "L2"; if (lvRaw) { if (lvKeys.includes(lvRaw)) level = lvRaw; else e.push(`Cx stage "${lvRaw}" is not one of ${lvKeys.join(", ")}`); }
      const start = normDate(g(ci.pstart)); const pfin = normDate(g(ci.pfin)); const durRaw = g(ci.dur);
      if (!start) e.push("missing or invalid Planned start (use YYYY-MM-DD)");
      let duration = 1; if (durRaw && +durRaw > 0) duration = +durRaw; else if (start && pfin) duration = Math.max(1, Math.round((parseD(pfin) - parseD(start)) / DAYMS) + 1);
      const witInvite = yes(g(ci.wit)); const witAt = normDT(g(ci.witat));
      if (witInvite && !witAt) e.push("Witness invite is Yes, so a valid Witness date & time is required (YYYY-MM-DD HH:MM)");
      const cons = g(ci.cons); const constraints = cons ? cons.split(";").map((x) => x.trim()).filter(Boolean).map((x) => ({ id: uid("c"), text: x.replace(/^\[[ xX]\]\s*/, ""), done: /^\[[xX]\]/.test(x) })) : [];
      if (e.length) { errors.push(`Row ${ln}: ${e.join("; ")}`); continue; }
      staged.push({ id: uid("a"), desc, companyId, area, subArea, tier3, asset: g(ci.asset), system, level, isMilestone: isMs, witnessInvite: witInvite, witnessAt: witInvite ? witAt : "", notes: g(ci.notes), start, duration, committed: yes(g(ci.commit)), status: (g(ci.status) || "planned").toLowerCase().replace(/\s+/g, "_"), actualStart: normDate(g(ci.astart)), actualFinish: normDate(g(ci.afin)), constraints });
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
        <div className="lk-dh"><h3>Import Activities</h3><button className="lk-btn icon" onClick={onClose}><Icon n="x" /></button></div>
        <div className="bd">
          <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>Bulk add activities from the Excel template. Members import under their own company; admins can set any existing company per row.</div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>The rules</div>
            <ul>
              <li><b>Company:</b> members can only import under their own company; <b>admins</b> can name any existing company per row (it must match a company on the project).</li>
              <li>The <b>Excel template has dropdowns</b> for Building, Level, Zone / Room, System and Cx Stage, pre-loaded with this project's current values. Pick from them rather than typing.</li>
              <li><b>Those values must already exist</b> on the project. Anything that does not match is rejected, it is not created for you.</li>
              <li>Matching ignores case but the spelling must be exact. The dropdowns do not enforce which Level belongs to which Building, so the app still checks that on import.</li>
              <li>If any single row is invalid, <b>nothing is imported</b>. You get a list of what to fix, then re-upload.</li>
              <li>Dates use YYYY-MM-DD. Committed and Witness invite take Yes or No.</li>
              <li>If <b>Witness invite</b> is Yes, a <b>Witness date &amp; time</b> is required, format YYYY-MM-DD HH:MM (see example 2).</li>
              <li>The template has <b>two example rows</b>. Delete them and import only your own activities.</li>
              <li>Description and Planned start are required on every row; Building and System too, <b>except on milestone rows</b> (Milestone = Yes), where they are optional. You can upload the filled .xlsx, or a .csv if you prefer.</li>
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
