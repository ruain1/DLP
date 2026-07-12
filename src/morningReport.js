// REV247: Morning Cx Update. Pure boundary computation, data assembly and the
// Outlook-Word-safe email builder, kept free of app state so every piece can be
// tested headless. The scheduler and Graph send live in App.jsx and ride the same
// report_runs claim machinery as the daily and weekly digests, under kind "morning".
import { helParts, utcForHelsinki, helDateStr, emailBtn } from "./digestCore";

export const MORNING_DEFAULTS = {
  enabled: false,
  time: "08:00",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  recipients: "team",           // "team" (all project members) or "admins"
  excludeCoIds: [],             // company ids excluded from a team send (e.g. the client)
  sections: { finishing: true, overdue: true, starting: true, constraints: true, updates: true, witness: true, ytt: true, ai: true },
  aiSteer: "",   // REV277: tailorable AI instructions, appended to the summary steer
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
  const yday = iso(addD(pD(today), -1));
  const tmrw = iso(addD(pD(today), 1));
  const horizon = iso(addD(pD(today), 7));
  const yDone = rows.filter((r) => r.a.status === "complete" && r.e === yday);
  const yMissed = live.filter((r) => r.e === yday);
  const tStart = live.filter((r) => r.s === tmrw);
  const tDue = live.filter((r) => r.e === tmrw && r.s !== tmrw);
  // REV277: pushing pairs. A late finish holding a successor that starts within a week,
  // via the predecessor code links; the facts sheet and the Tomorrow tags both use them.
  const lateBy = (r) => Math.max(1, Math.round((pD(today).getTime() - pD(r.e).getTime()) / 86400000));
  const pushing = [];
  overdueAll.forEach((r) => {
    if (r.a.code == null) return;
    live.forEach((x) => {
      const preds = (x.a.predecessors || []).map(String);
      if (preds.includes(String(r.a.code)) && x.s >= today && x.s <= horizon) pushing.push({ from: r, to: x, late: lateBy(r) });
    });
  });
  const consRows = [];
  live.forEach((r) => { if (r.e >= weekAgo) r.open.forEach((c) => consRows.push({ text: c.text || "", owner: c.owner || "", due: c.due || "", act: r.a.desc || "", actStart: r.s, actWit: !!(r.a.witnessInvite && r.a.witnessAt), od: !!c.due && c.due < today })); });
  consRows.sort((x, y) => ((x.due || "9999") < (y.due || "9999") ? -1 : 1));
  const witness = rows.filter((r) => r.a.witnessInvite && r.a.witnessAt && String(r.a.witnessAt).slice(0, 10) === today);
  const byAct = {}; (updates || []).forEach((u) => { (byAct[u.activity_id] = byAct[u.activity_id] || []).push(u); });
  const upRows = Object.keys(byAct).map((id) => {
    const r = rows.find((x) => x.a.id === id);
    const items = byAct[id];
    const withPct = items.filter((u) => u.pct != null);
    return { desc: r ? (r.a.desc || "Untitled") : "(removed activity)", pct: withPct.length ? withPct[withPct.length - 1].pct : null, items };
  });
  return { today, yday, tmrw, yDone, yMissed, tStart, tDue, pushing, counts: { inProgress: inProgress.length, finishing: finishing.length, overdue: overdueAll.length, starting: starting.length, cons: consRows.length }, finishing, overdue, overdueOlder: overdueAll.length - overdue.length, starting, consRows, witness, upRows };
}

// REV277: the compact plaintext facts sheet the AI summary is written from. Every
// figure the model may use is in here; the steer can only shape tone and emphasis.
export function buildMorningAiFacts(d) {
  const L = [];
  const c = d.counts;
  L.push("Date: " + d.today + ". Counts: " + c.inProgress + " in progress, " + c.finishing + " finishing today, " + c.overdue + " overdue, " + c.starting + " starting today, " + c.cons + " open constraints.");
  const act = (r) => (r.a.desc || "Untitled") + " (" + r.co + (r.a.percent != null ? ", " + r.a.percent + "%" : "") + ")";
  if (d.overdue.length) L.push("Overdue finishes: " + d.overdue.slice(0, 10).map((r) => act(r) + " was due " + r.e).join("; ") + (d.overdueOlder ? "; plus " + d.overdueOlder + " older than a week" : "") + ".");
  if (d.finishing.length) L.push("Due to finish today: " + d.finishing.slice(0, 8).map((r) => act(r) + (r.open.length ? " with " + r.open.length + " open constraint(s)" : " clear")).join("; ") + ".");
  if (d.starting.length) L.push("Starting today: " + d.starting.slice(0, 8).map(act).join("; ") + ".");
  if (d.tStart.length) L.push("Starting tomorrow: " + d.tStart.slice(0, 8).map((r) => act(r) + (r.open.length ? " with " + r.open.length + " open constraint(s)" : "")).join("; ") + ".");
  if (d.pushing.length) L.push("Late activities pushing successors: " + d.pushing.slice(0, 8).map((pp) => (pp.from.a.desc || "?") + " (" + pp.from.co + ", " + pp.late + "d late) pushes " + (pp.to.a.desc || "?") + " which starts " + pp.to.s).join("; ") + ".");
  if (d.consRows.length) L.push("Open constraints: " + d.consRows.slice(0, 10).map((k) => k.text + " (" + (k.owner || "unowned") + (k.due ? ", was needed " + k.due : "") + ", on " + k.act + ")").join("; ") + ".");
  if (d.witness.length) L.push("Witness events today: " + d.witness.map((r) => (r.a.desc || "?") + " (" + r.co + ")").join("; ") + ".");
  if (d.upRows.length) L.push("Daily updates were logged yesterday on " + d.upRows.length + " activities.");
  return L.join("\n").slice(0, 3800);
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
  if (sec.ai !== false && d.ai) {
    const paras = String(d.ai).split(/\n{2,}/).map((t) => t.trim()).filter(Boolean);
    body += `<tr><td style="padding:16px 24px 2px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f5fc; border-left:3px solid #2456A6;">`
      + `<tr><td style="padding:12px 16px 4px; font-size:10.5px; letter-spacing:.08em; font-weight:bold; color:#2456A6;">EXECUTIVE SUMMARY <span style="color:#68727f; font-weight:normal; letter-spacing:0;">${MID}AI, from this morning's data</span></td></tr>`
      + paras.map((t) => `<tr><td style="padding:2px 16px 10px; font-size:12px; line-height:1.65; color:#1c2733;">${esc(t)}</td></tr>`).join("")
      + `</table></td></tr>`;
  }
  body += `<tr><td style="padding:18px 24px 6px;"><table width="100%" cellpadding="0" cellspacing="0"><tr>`
    + cell(c.inProgress, "IN PROGRESS", "#2456A6") + `<td width="8"></td>`
    + cell(c.finishing, "FINISH DUE TODAY", "#b07f00") + `<td width="8"></td>`
    + cell(c.overdue, "OVERDUE", "#C0392B") + `<td width="8"></td>`
    + cell(c.starting, "STARTING", "#1e8e63") + `<td width="8"></td>`
    + cell(c.cons, "OPEN CONSTRAINTS", "#2456A6") + `</tr></table></td></tr>`;
  if (!c.inProgress && !c.finishing && !c.overdue && !c.starting && !c.cons && !d.upRows.length && !d.witness.length) {
    body += rowsWrap(`<tr><td style="padding:8px 0; color:#68727f;">Nothing scheduled for today.</td></tr>`);
  }
  if (sec.ytt !== false) {
    const tag = (t, c2) => ({ text: t, style: "color:" + c2 + ";" });
    if (d.yDone.length || d.yMissed.length || (sec.updates !== false && d.upRows.length)) {
      const [uRows, uMore] = cap(d.upRows, 6);
      body += secHead("Yesterday", "#68727f") + rowsWrap(
        d.yDone.slice(0, 8).map((r) => actLine(r, tag("done", "#1e8e63"))).join("")
        + d.yMissed.slice(0, 8).map((r) => actLine(r, tag("missed", "#C0392B"))).join("")
        + (sec.updates !== false ? uRows.map((u) =>
          `<tr><td style="padding:5px 0; line-height:1.5;"><b>Daily update</b>${MID}${esc(u.desc)}${u.pct != null ? ` <span style="color:#2456A6; font-weight:bold;">${u.pct}%</span>` : ""}<br>` +
          u.items.map((it) => `<span style="color:#48525e;">${esc(it.note)}</span> <span style="color:#68727f; font-size:11px;">${esc(MID + (it.by_name || "admin") + ", " + new Date(it.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }))}</span>`).join("<br>") + `</td></tr>`).join("") + moreLine(uMore, "updated activities") : ""));
    }
    const todayRows = d.finishing.map((r) => actLine(r, r.open.length ? tag(r.open.length + " open constraint" + (r.open.length === 1 ? "" : "s"), "#C0392B") : tag("finish due" + MID + "clear", "#1e8e63")))
      .concat(d.witness.map((r) => actLine(r, tag("witness " + new Date(r.a.witnessAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }), "#2456A6"))))
      .concat(d.starting.map((r) => actLine(r, tag("starts" + MID + "to " + dd(r.e), "#1e8e63"))));
    if (todayRows.length) body += secHead("Today") + rowsWrap(todayRows.join(""));
    const tRows = d.tStart.map((r) => {
      const push = d.pushing.filter((pp) => pp.to === r).length;
      return actLine(r, r.open.length ? tag(r.open.length + " open constraint" + (r.open.length === 1 ? "" : "s"), "#C0392B") : (push ? tag("at risk" + MID + "predecessor late", "#b07f00") : tag("starts", "#1e8e63")));
    }).concat(d.tDue.map((r) => actLine(r, tag("due", "#b07f00"))));
    if (tRows.length) body += secHead("Tomorrow", "#1e8e63") + rowsWrap(tRows.join(""));
  }
  if (sec.ytt === false && sec.finishing !== false && d.finishing.length) {
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
  if (sec.ytt === false && sec.starting !== false && d.starting.length) {
    const [rowsS, more] = cap(d.starting, 14);
    body += secHead("Starting today", "#1e8e63") + rowsWrap(rowsS.map((r) => actLine(r, { text: "to " + dd(r.e), style: "color:#1e8e63;" })).join("") + moreLine(more, "starting today"));
  }
  if (sec.constraints !== false && d.consRows.length) {
    const [rowsC, more] = cap(d.consRows, 12);
    body += secHead("Open constraints needing action") + rowsWrap(rowsC.map((k) =>
      `<tr><td style="padding:5px 0;">${esc(k.text)} <span style="color:#68727f;">${MID}${esc(k.act)}${MID}</span>${k.owner ? esc(k.owner) : `<b style="color:#C0392B;">unowned</b>`}${k.actStart === d.tmrw ? ` <span style="color:#C0392B; font-size:11px;">${MID}blocks tomorrow&#8217;s start</span>` : (k.actWit ? ` <span style="color:#2456A6; font-size:11px;">${MID}witnessed activity</span>` : "")}</td><td align="right" style="font-size:11px; font-weight:bold; color:${k.od ? "#C0392B" : "#b07f00"};">${k.due ? esc((k.od ? "was needed " : "need ") + dd(k.due)) : "no date"}</td></tr>`).join("") + moreLine(more, "constraints"));
  }
  if (sec.ytt === false && sec.updates !== false && d.upRows.length) {
    const [rowsU, more] = cap(d.upRows, 12);
    body += secHead("Yesterday's daily updates") + rowsWrap(rowsU.map((u) =>
      `<tr><td style="padding:5px 0; line-height:1.5;"><b>${esc(u.desc)}</b>${u.pct != null ? ` <span style="color:#2456A6; font-weight:bold;">${u.pct}%</span>` : ""}<br>` +
      u.items.map((it) => `<span style="color:#48525e;">${esc(it.note)}</span> <span style="color:#68727f; font-size:11px;">${esc(MID + (it.by_name || "admin") + ", " + new Date(it.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }))}</span>`).join("<br>") + `</td></tr>`).join("") + moreLine(more, "activities with updates"));
  }
  if (sec.ytt === false && sec.witness !== false && d.witness.length) {
    body += secHead("Witness events today", "#2456A6") + rowsWrap(d.witness.map((r) =>
      `<tr><td style="padding:5px 0;">${esc(r.a.desc || "Untitled")} <span style="color:#68727f;">${MID}${esc(r.co)}${MID}${esc(new Date(r.a.witnessAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }))}</span></td></tr>`).join(""));
  }
  const html = `<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff; font-family:Arial,Helvetica,sans-serif; border:1px solid #d9dee5;">`
    + `<tr><td style="background:#2456A6; padding:18px 24px;"><table width="100%" cellpadding="0" cellspacing="0"><tr>`
    + `<td style="color:#ffffff; font-size:18px; font-weight:bold;">Morning Cx Update</td>`
    + `<td align="right" style="color:#cfe0f7; font-size:12px;">${esc(meta.projName || "")}${meta.projLine ? "<br>" + esc(meta.projLine) : ""}<br>${esc(meta.dateLine)}</td>`
    + `</tr></table></td></tr>`
    + body
    + `<tr><td style="padding:16px 24px 20px;" align="center"><table cellpadding="0" cellspacing="0" align="center"><tr><td>${emailBtn(esc(meta.appUrl || "https://dlp-pi.vercel.app"), "Open the board")}</td></tr></table>`
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
