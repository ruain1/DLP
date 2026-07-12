// REV247: Morning Cx Update. Pure boundary computation, data assembly and the
// Outlook-Word-safe email builder, kept free of app state so every piece can be
// tested headless. The scheduler and Graph send live in App.jsx and ride the same
// report_runs claim machinery as the daily and weekly digests, under kind "morning".
import { helParts, utcForHelsinki, helDateStr } from "./digestCore";

export const MORNING_DEFAULTS = {
  enabled: false,
  time: "08:00",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  recipients: "team",           // "team" (all project members) or "admins"
  excludeCoIds: [],             // company ids excluded from a team send (e.g. the client)
  sections: { finishing: true, overdue: true, starting: true, constraints: true, updates: true, witness: true },
};

export function morningCfg(settings) {
  const raw = (settings || {}).morningReport || {};
  return { ...MORNING_DEFAULTS, ...raw, sections: { ...MORNING_DEFAULTS.sections, ...(raw.sections || {}) } };
}

// Mirrors dueBoundaries: every configured day's send time inside the lookback window.
export function morningBoundaries(now, lookbackH, cfg) {
  if (!cfg || !cfg.enabled) return [];
  const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(cfg.time || "08:00");
  const HH = m ? Math.min(23, +m[1]) : 8, MM = m ? Math.min(59, +m[2]) : 0;
  const out = [];
  const floor = now.getTime() - lookbackH * 3600000;
  for (let off = Math.ceil(lookbackH / 24) + 1; off >= 0; off--) {
    const probe = helParts(new Date(now.getTime() - off * 86400000));
    const due = utcForHelsinki(probe.y, probe.m, probe.d, HH, MM);
    const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", weekday: "short" }).format(due);
    if ((cfg.days || []).includes(wd) && due.getTime() >= floor && due.getTime() <= now.getTime()) out.push({ kind: "morning", due });
  }
  out.sort((a, b) => a.due.getTime() - b.due.getTime());
  return out;
}

const pD = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");
const addD = (d, n) => new Date(d.getTime() + n * 86400000);
const iso = (d) => d.toISOString().slice(0, 10);
const dd = (s) => pD(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MID = " \u00b7 ";

export function morningData(St, due, updates) {
  const today = helDateStr(due);
  const co = {}; (St.companies || []).forEach((c) => { co[c.id] = c.name; });
  const endOf = (a) => iso(addD(pD(a.start), Math.max(0, (a.duration || 1) - 1)));
  const rows = (St.activities || []).filter((a) => a && a.start)
    .map((a) => ({ a, s: String(a.start).slice(0, 10), e: endOf(a), co: co[a.companyId] || "Unassigned", open: (a.constraints || []).filter((c) => !c.done) }));
  const live = rows.filter((r) => r.a.status !== "complete");
  const weekAgo = iso(addD(pD(today), -7));
  const finishing = live.filter((r) => r.e === today);
  const overdueAll = live.filter((r) => r.e < today);
  const overdue = overdueAll.filter((r) => r.e >= weekAgo);
  const starting = live.filter((r) => r.s === today && r.e !== today);
  const inProgress = live.filter((r) => r.s <= today && r.e >= today);
  const consRows = [];
  live.forEach((r) => { if (r.e >= weekAgo) r.open.forEach((c) => consRows.push({ text: c.text || "", owner: c.owner || "", due: c.due || "", act: r.a.desc || "", od: !!c.due && c.due < today })); });
  consRows.sort((x, y) => ((x.due || "9999") < (y.due || "9999") ? -1 : 1));
  const witness = rows.filter((r) => r.a.witnessInvite && r.a.witnessAt && String(r.a.witnessAt).slice(0, 10) === today);
  const byAct = {}; (updates || []).forEach((u) => { (byAct[u.activity_id] = byAct[u.activity_id] || []).push(u); });
  const upRows = Object.keys(byAct).map((id) => {
    const r = rows.find((x) => x.a.id === id);
    const items = byAct[id];
    const withPct = items.filter((u) => u.pct != null);
    return { desc: r ? (r.a.desc || "Untitled") : "(removed activity)", pct: withPct.length ? withPct[withPct.length - 1].pct : null, items };
  });
  return { today, counts: { inProgress: inProgress.length, finishing: finishing.length, overdue: overdueAll.length, starting: starting.length, cons: consRows.length }, finishing, overdue, overdueOlder: overdueAll.length - overdue.length, starting, consRows, witness, upRows };
}

const secHead = (label, color) => `<tr><td style="padding:14px 24px 4px; font-size:13px; font-weight:bold; color:${color || "#1c2733"}; border-bottom:1px solid #e3e8ef;">${esc(label)}</td></tr>`;
const rowsWrap = (inner) => `<tr><td style="padding:8px 24px 2px;"><table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px; color:#1c2733;">${inner}</table></td></tr>`;
const moreLine = (n, noun) => n > 0 ? `<tr><td style="padding:5px 0; color:#68727f; font-size:11px;">and ${n} more ${esc(noun)}</td></tr>` : "";
const cap = (arr, n) => [arr.slice(0, n), Math.max(0, arr.length - n)];

function actLine(r, extraRight) {
  const pct = r.a.percent != null ? MID + r.a.percent + "%" : "";
  const mile = r.a.isMilestone ? "\u25C6 " : "";
  const right = extraRight ? `<td align="right" style="font-size:11px; font-weight:bold; ${extraRight.style}">${esc(extraRight.text)}</td>` : "";
  return `<tr><td style="padding:5px 0;">${mile}${esc(r.a.desc || "Untitled")} <span style="color:#68727f;">${MID}${esc(r.co)}${esc(pct)}</span></td>${right}</tr>`;
}

export function buildMorningEmail(d, cfg, meta) {
  const sec = cfg.sections || {};
  const c = d.counts;
  const cell = (v, lb, color) => `<td align="center" style="border:1px solid #e3e8ef; border-radius:5px; padding:9px 4px;"><span style="font-size:19px; font-weight:bold; color:${color};">${v}</span><br><span style="font-size:10px; color:#68727f;">${lb}</span></td>`;
  let body = "";
  body += `<tr><td style="padding:18px 24px 6px;"><table width="100%" cellpadding="0" cellspacing="0"><tr>`
    + cell(c.inProgress, "IN PROGRESS", "#2456A6") + `<td width="8"></td>`
    + cell(c.finishing, "FINISH DUE TODAY", "#b07f00") + `<td width="8"></td>`
    + cell(c.overdue, "OVERDUE", "#C0392B") + `<td width="8"></td>`
    + cell(c.starting, "STARTING", "#1e8e63") + `<td width="8"></td>`
    + cell(c.cons, "OPEN CONSTRAINTS", "#2456A6") + `</tr></table></td></tr>`;
  if (!c.inProgress && !c.finishing && !c.overdue && !c.starting && !c.cons && !d.upRows.length && !d.witness.length) {
    body += rowsWrap(`<tr><td style="padding:8px 0; color:#68727f;">Nothing scheduled for today.</td></tr>`);
  }
  if (sec.finishing !== false && d.finishing.length) {
    const [rowsF, more] = cap(d.finishing, 14);
    body += secHead("Finishing today") + rowsWrap(rowsF.map((r) => actLine(r, r.open.length
      ? { text: r.open.length + " open constraint" + (r.open.length === 1 ? "" : "s"), style: "color:#C0392B;" }
      : { text: "clear", style: "color:#1e8e63;" })).join("") + moreLine(more, "finishing today"));
  }
  if (sec.overdue !== false && d.overdue.length) {
    const [rowsO, more] = cap(d.overdue, 14);
    body += secHead("Overdue finishes", "#C0392B") + rowsWrap(rowsO.map((r) => actLine(r, { text: "was " + dd(r.e), style: "color:#C0392B;" })).join("")
      + moreLine(more, "in the last week") + moreLine(d.overdueOlder, "older than a week"));
  }
  if (sec.starting !== false && d.starting.length) {
    const [rowsS, more] = cap(d.starting, 14);
    body += secHead("Starting today", "#1e8e63") + rowsWrap(rowsS.map((r) => actLine(r, { text: "to " + dd(r.e), style: "color:#1e8e63;" })).join("") + moreLine(more, "starting today"));
  }
  if (sec.constraints !== false && d.consRows.length) {
    const [rowsC, more] = cap(d.consRows, 12);
    body += secHead("Open constraints needing action") + rowsWrap(rowsC.map((k) =>
      `<tr><td style="padding:5px 0;">${esc(k.text)} <span style="color:#68727f;">${MID}${esc(k.act)}${k.owner ? esc(MID + k.owner) : ""}</span></td><td align="right" style="font-size:11px; font-weight:bold; color:${k.od ? "#C0392B" : "#b07f00"};">${k.due ? esc((k.od ? "was needed " : "need ") + dd(k.due)) : "no date"}</td></tr>`).join("") + moreLine(more, "constraints"));
  }
  if (sec.updates !== false && d.upRows.length) {
    const [rowsU, more] = cap(d.upRows, 12);
    body += secHead("Yesterday's daily updates") + rowsWrap(rowsU.map((u) =>
      `<tr><td style="padding:5px 0; line-height:1.5;"><b>${esc(u.desc)}</b>${u.pct != null ? ` <span style="color:#2456A6; font-weight:bold;">${u.pct}%</span>` : ""}<br>` +
      u.items.map((it) => `<span style="color:#48525e;">${esc(it.note)}</span> <span style="color:#68727f; font-size:11px;">${esc(MID + (it.by_name || "admin") + ", " + new Date(it.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }))}</span>`).join("<br>") + `</td></tr>`).join("") + moreLine(more, "activities with updates"));
  }
  if (sec.witness !== false && d.witness.length) {
    body += secHead("Witness events today", "#2456A6") + rowsWrap(d.witness.map((r) =>
      `<tr><td style="padding:5px 0;">${esc(r.a.desc || "Untitled")} <span style="color:#68727f;">${MID}${esc(r.co)}${MID}${esc(new Date(r.a.witnessAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }))}</span></td></tr>`).join(""));
  }
  const html = `<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; font-family:Arial,Helvetica,sans-serif; border:1px solid #d9dee5;">`
    + `<tr><td style="background:#2456A6; padding:18px 24px;"><table width="100%" cellpadding="0" cellspacing="0"><tr>`
    + `<td style="color:#ffffff; font-size:18px; font-weight:bold;">Morning Cx Update</td>`
    + `<td align="right" style="color:#cfe0f7; font-size:12px;">${esc(meta.projName || "")}${meta.projLine ? "<br>" + esc(meta.projLine) : ""}<br>${esc(meta.dateLine)}</td>`
    + `</tr></table></td></tr>`
    + body
    + `<tr><td style="padding:16px 24px 20px;" align="center"><table cellpadding="0" cellspacing="0"><tr><td style="background:#2456A6; border-radius:5px;"><a href="${esc(meta.appUrl || "#")}" style="display:inline-block; padding:10px 26px; color:#ffffff; font-size:12.5px; font-weight:bold; text-decoration:none;">Open the board</a></td></tr></table>`
    + `<div style="font-size:10.5px; color:#8a94a1; margin-top:12px;">Sent automatically by DLP${meta.projName ? " for " + esc(meta.projName) : ""}. You receive this as a member of the project team.</div></td></tr></table>`;
  return html;
}

export function morningSubject(projName, due) {
  const dateLine = due.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Helsinki" });
  return { subject: "Morning Cx Update" + MID + (projName || "DLP") + MID + dateLine, dateLine };
}

// REV251: forward schedule helpers for the report tiles. nextSendAfter finds the next
// occurrence of a Helsinki send time on an enabled day; fmtNextSend renders it the way
// the tiles show it. Pure, shared by the morning, daily and weekly tiles so a tile can
// never disagree with the scheduler.
export function nextSendAfter(now, sched) {
  const m = /^([0-9]{1,2}):([0-9]{2})$/.exec((sched && sched.time) || "");
  if (!m) return null;
  const HH = Math.min(23, +m[1]), MM = Math.min(59, +m[2]);
  const days = (sched && sched.days) || [];
  for (let off = 0; off <= 8; off++) {
    const probe = helParts(new Date(now.getTime() + off * 86400000));
    const due = utcForHelsinki(probe.y, probe.m, probe.d, HH, MM);
    const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", weekday: "short" }).format(due);
    if (days.includes(wd) && due.getTime() > now.getTime()) return due;
  }
  return null;
}
export function fmtNextSend(due, now) {
  if (!due) return "not scheduled";
  const hel = (d) => helDateStr(d);
  const t = due.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" });
  if (hel(due) === hel(now)) return "today, " + t;
  return due.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/Helsinki" }) + ", " + t;
}
export function fmtDaysSummary(days) {
  const all = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const set = new Set(days || []);
  if (set.size === 7) return "every day";
  if (set.size === 6 && !set.has("Sun")) return "Mon-Sat";
  if (set.size === 5 && !set.has("Sat") && !set.has("Sun")) return "Mon-Fri";
  return all.filter((d) => set.has(d)).join(", ") || "no days";
}
