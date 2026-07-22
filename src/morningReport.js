// REV247: Morning Cx Update. Pure boundary computation, data assembly and the
// Outlook-Word-safe email builder, kept free of app state so every piece can be
// tested headless. The scheduler and Graph send live in App.jsx and ride the same
// report_runs claim machinery as the daily and weekly digests, under kind "morning".
import { helParts, utcForHelsinki, helDateStr, emailBtn, emailShell, projectFooter } from "./digestCore";

export const MORNING_DEFAULTS = {
  enabled: false,
  time: "08:00",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  recipients: "team",           // "team" (all project members) or "admins"
  excludeCoIds: [],             // company ids excluded from a team send (e.g. the client)
  sections: { finishing: true, overdue: true, starting: true, constraints: true, updates: true, witness: true, ytt: true, ai: true, attendance: true },
  aiSteer: "",   // REV277: tailorable AI instructions, appended to the summary steer
  // REV326: morning meeting attendance. companies is the invited list with domain
  // mappings; showAbsent controls whether absent companies are named in the email.
  attendance: { showAbsent: true, companies: [] },
};

export function morningCfg(settings) {
  const st = settings || {};
  // REV297: the morning config persists inside settings.design.morningReport (the design jsonb
  // round-trips through the DB); fall back to the legacy top-level key for any older state.
  const raw = (st.design && st.design.morningReport) || st.morningReport || {};
  return { ...MORNING_DEFAULTS, ...raw, sections: { ...MORNING_DEFAULTS.sections, ...(raw.sections || {}) }, attendance: { ...MORNING_DEFAULTS.attendance, ...(raw.attendance || {}), companies: (raw.attendance && Array.isArray(raw.attendance.companies)) ? raw.attendance.companies : [] } };
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

const MR_FF = "Aptos,'Aptos Display','Segoe UI',Calibri,Arial,sans-serif";
const secHead = (label, color) => `<tr><td style="padding:16px 24px 5px; font-size:14pt; font-weight:bold; font-family:${MR_FF}; color:${color || "#1c2733"}; border-bottom:1px solid #e3e8ef;">${esc(label)}</td></tr>`;
const rowsWrap = (inner) => `<tr><td style="padding:8px 24px 2px;"><table width="100%" cellpadding="0" cellspacing="0" style="font-size:12pt; font-family:${MR_FF}; color:#1c2733;">${inner}</table></td></tr>`;
const moreLine = (n, noun) => n > 0 ? `<tr><td style="padding:5px 0; color:#68727f; font-size:10.5pt; font-family:${MR_FF};">and ${n} more ${esc(noun)}</td></tr>` : "";
const cap = (arr, n) => [arr.slice(0, n), Math.max(0, arr.length - n)];

function actLine(r, extraRight) {
  const pct = r.a.percent != null ? MID + r.a.percent + "%" : "";
  const mile = r.a.isMilestone ? "\u25C6 " : "";
  const right = extraRight ? `<td align="right" style="font-size:11pt; font-weight:bold; font-family:${MR_FF}; white-space:nowrap; ${extraRight.style}">${esc(extraRight.text).replace(/ /g, "&#160;")}</td>` : "";
  return `<tr><td style="padding:5px 0; font-size:12pt; font-family:${MR_FF};">${mile}${esc(r.a.desc || "Untitled")} <span style="color:#68727f;">${MID}${esc(r.co)}${esc(pct)}</span></td>${right}</tr>`;
}

// REV326: the Morning meeting attendance section. att comes from
// aggregateAttendance in attendanceImport.js; showAbsent from cfg.attendance.
export function buildAttendanceHtml(att, showAbsent) {
  if (!att || !att.rows) return "";
  const helT = (isoStr) => { if (!isoStr) return ""; return new Date(isoStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }); };
  const dateLbl = att.meetingStartISO
    ? new Date(att.meetingStartISO).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/Helsinki" })
    : (att.meetingDate ? new Date(String(att.meetingDate) + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }) : "");
  const meta2 = [dateLbl, att.meetingStartISO ? helT(att.meetingStartISO) : "", att.durationMin != null ? att.durationMin + " min" : ""].filter(Boolean).join(MID);
  const th = (lb, right) => `<td${right ? ' align="right"' : ""} style="padding:4px 0; font-size:8.5pt; letter-spacing:.07em; font-weight:bold; font-family:${MR_FF}; color:#68727f; border-bottom:1px solid #e3e8ef;">${lb}</td>`;
  const t = att.totals || {};
  let out = `<tr><td style="padding:16px 24px 5px; border-bottom:1px solid #e3e8ef;"><table width="100%" cellpadding="0" cellspacing="0"><tr>`
    + `<td style="font-size:14pt; font-weight:bold; font-family:${MR_FF}; color:#2456A6;">Morning meeting attendance</td>`
    + `<td align="right" style="font-size:10.5pt; font-family:${MR_FF}; color:#68727f;">${esc(meta2)}</td>`
    + `</tr></table></td></tr>`;
  let inner = `<tr><td colspan="4" style="padding:5px 0 8px; font-size:12pt; font-family:${MR_FF};">`
    + `<b>${t.present || 0}</b> of <b>${t.invited || 0}</b> invited companies represented <span style="color:#68727f;">${MID}</span>`
    + (t.absent ? `<b style="color:#C0392B;">${t.absent} absent</b> <span style="color:#68727f;">${MID}</span>` : "")
    + `<span style="color:#68727f;">${t.people || 0} people joined</span></td></tr>`;
  inner += `<tr>${th("COMPANY")}${th("REPRESENTED BY")}${th("JOINED", 1)}${th("FIRST IN", 1)}</tr>`;
  const [rws, more] = [att.rows.slice(0, 14), Math.max(0, att.rows.length - 14)];
  rws.forEach((r) => {
    const names = (r.names || []).slice(0, 3).join(", ") + ((r.names || []).length > 3 ? " and " + ((r.names || []).length - 3) + " more" : "");
    inner += `<tr>`
      + `<td style="padding:5px 8px 5px 0; border-bottom:1px solid #f1f4f8; font-weight:bold; font-family:${MR_FF};">${esc(r.name)}${r.late ? ` <span style="font-size:10.5pt; font-weight:bold; color:#b07f00;">${MID}joined late</span>` : ""}</td>`
      + `<td style="padding:5px 8px 5px 0; border-bottom:1px solid #f1f4f8; color:#68727f; font-size:10.5pt; font-family:${MR_FF};">${esc(names)}</td>`
      + `<td align="right" style="padding:5px 0; border-bottom:1px solid #f1f4f8; font-family:${MR_FF};">${r.count}</td>`
      + `<td align="right" style="padding:5px 0; border-bottom:1px solid #f1f4f8; font-family:${MR_FF};${r.late ? " color:#b07f00;" : ""}">${esc(helT(r.firstJoinISO))}</td>`
      + `</tr>`;
  });
  if (more) inner += `<tr><td colspan="4" style="padding:5px 0; color:#68727f; font-size:10.5pt; font-family:${MR_FF};">and ${more} more companies</td></tr>`;
  if (showAbsent !== false && (att.absent || []).length) {
    inner += `<tr><td colspan="4" style="padding:8px 0 2px; font-size:8.5pt; letter-spacing:.07em; font-weight:bold; font-family:${MR_FF}; color:#C0392B; border-bottom:1px solid #e3e8ef;">NOT REPRESENTED ${MID}INVITED</td></tr>`;
    att.absent.slice(0, 10).forEach((a) => {
      inner += `<tr>`
        + `<td style="padding:5px 8px 5px 0; font-weight:bold; font-family:${MR_FF}; color:#C0392B;">${esc(a.name)} <span style="font-size:10.5pt;">${MID}absent</span></td>`
        + `<td colspan="3" style="padding:5px 8px 5px 0; color:#68727f; font-size:10.5pt; font-family:${MR_FF};">${(a.domains || []).length ? "no participant matched " + esc((a.domains || []).join(", ")) : "no domain mapped"}</td>`
        + `</tr>`;
    });
  }
  if ((att.unmatched || []).length) {
    inner += `<tr><td colspan="4" style="padding:8px 0 2px; font-size:8.5pt; letter-spacing:.07em; font-weight:bold; font-family:${MR_FF}; color:#68727f; border-bottom:1px solid #e3e8ef;">UNMATCHED ${MID}NO COMPANY MAPPING</td></tr>`;
    const gs = att.unmatched.slice(0, 8).map((u) => `${esc(u.name)} <span style="color:#68727f; font-size:10.5pt;">${MID}${esc([u.domain, helT(u.firstJoinISO)].filter(Boolean).join(MID))}</span>`).join(" &nbsp;&nbsp; ");
    inner += `<tr><td colspan="4" style="padding:5px 0; color:#48525e; font-size:10.5pt; font-family:${MR_FF};">${gs}${att.unmatched.length > 8 ? ` <span style="color:#68727f;">and ${att.unmatched.length - 8} more</span>` : ""}</td></tr>`;
  }
  if (att.uploadedByName) inner += `<tr><td colspan="4" style="padding:8px 0 4px; color:#8b96a3; font-size:9pt; font-family:${MR_FF};">Source: Teams attendance report${MID}uploaded by ${esc(att.uploadedByName)}</td></tr>`;
  out += `<tr><td style="padding:8px 24px 2px;"><table width="100%" cellpadding="0" cellspacing="0" style="font-size:12pt; font-family:${MR_FF}; color:#1c2733;">${inner}</table></td></tr>`;
  return out;
}

export function buildMorningEmail(d, cfg, meta) {
  const sec = cfg.sections || {};
  const c = d.counts;
  const cell = (v, lb, color) => `<td align="center" style="border:1px solid #e3e8ef; border-radius:5px; padding:9px 4px; font-family:${MR_FF};"><span style="font-size:15pt; font-weight:bold; color:${color};">${v}</span><br><span style="font-size:10pt; color:#68727f; letter-spacing:.03em;">${lb}</span></td>`;
  let body = "";
  if (sec.ai !== false && d.ai) {
    const blocks = String(d.ai).split(/\n{2,}/).map((t) => t.trim()).filter(Boolean);
    const renderBlock = (t) => {
      const lines = t.split(/\n/).map((x) => x.trim()).filter(Boolean);
      const bullety = lines.length > 1 && lines.filter((x) => /^([-*\u2022\u00b7]|\d+[.)])\s+/.test(x)).length >= Math.max(2, Math.ceil(lines.length * 0.6));
      if (bullety) {
        const items = lines.map((x) => x.replace(/^([-*\u2022\u00b7]|\d+[.)])\s+/, "")).filter(Boolean);
        return `<tr><td style="padding:2px 18px 10px; font-size:12pt; line-height:1.55; font-family:${MR_FF}; color:#1c2733;"><table width="100%" cellpadding="0" cellspacing="0">`
          + items.map((it) => `<tr><td width="14" style="vertical-align:top; padding:1px 0 3px; font-size:12pt; color:#001C26; font-weight:bold;">&#8226;</td><td style="vertical-align:top; padding:1px 0 3px; font-size:12pt; font-family:${MR_FF};">${esc(it)}</td></tr>`).join("")
          + `</table></td></tr>`;
      }
      return `<tr><td style="padding:2px 18px 10px; font-size:12pt; line-height:1.55; font-family:${MR_FF}; color:#1c2733;">${esc(t)}</td></tr>`;
    };
    body += `<tr><td style="padding:16px 24px 2px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff; border-left:4px solid #001C26;">`
      + `<tr><td style="padding:12px 16px 4px; font-size:10pt; letter-spacing:.08em; font-weight:bold; font-family:${MR_FF}; color:#001C26;">EXECUTIVE SUMMARY</td></tr>`
      + blocks.map(renderBlock).join("")
      + `</table></td></tr>`;
  }
  body += `<tr><td style="padding:18px 24px 6px;"><table width="100%" cellpadding="0" cellspacing="0"><tr>`
    + cell(c.inProgress, "IN PROGRESS", "#2456A6") + `<td width="8"></td>`
    + cell(c.finishing, "FINISH DUE TODAY", "#b07f00") + `<td width="8"></td>`
    + cell(c.overdue, "OVERDUE", "#C0392B") + `<td width="8"></td>`
    + cell(c.starting, "STARTING", "#1e8e63") + `<td width="8"></td>`
    + cell(c.cons, "OPEN CONSTRAINTS", "#2456A6") + `</tr></table></td></tr>`;
  if (sec.attendance !== false && d.attendance) body += buildAttendanceHtml(d.attendance, cfg.attendance && cfg.attendance.showAbsent);
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
          `<tr><td style="padding:5px 0; line-height:1.5; font-size:12pt; font-family:${MR_FF};"><b>Daily update</b>${MID}${esc(u.desc)}${u.pct != null ? ` <span style="color:#2456A6; font-weight:bold;">${u.pct}%</span>` : ""}<br>` +
          u.items.map((it) => `<span style="color:#48525e;">${esc(it.note)}</span> <span style="color:#68727f; font-size:10pt;">${esc(MID + (it.by_name || "admin") + ", " + new Date(it.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }))}</span>`).join("<br>") + `</td></tr>`).join("") + moreLine(uMore, "updated activities") : ""));
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
      `<tr><td style="padding:5px 0; font-size:12pt; font-family:${MR_FF};">${esc(k.text)} <span style="color:#68727f;">${MID}${esc(k.act)}${MID}</span>${k.owner ? esc(k.owner) : `<b style="color:#C0392B;">unowned</b>`}${k.actStart === d.tmrw ? ` <span style="color:#C0392B; font-size:10pt;">${MID}blocks tomorrow&#8217;s start</span>` : (k.actWit ? ` <span style="color:#2456A6; font-size:10pt;">${MID}witnessed activity</span>` : "")}</td><td align="right" style="font-size:11pt; font-weight:bold; white-space:nowrap; color:${k.od ? "#C0392B" : "#b07f00"};">${k.due ? esc((k.od ? "was needed " : "need ") + dd(k.due)).replace(/ /g, "&#160;") : "no date"}</td></tr>`).join("") + moreLine(more, "constraints"));
  }
  if (sec.ytt === false && sec.updates !== false && d.upRows.length) {
    const [rowsU, more] = cap(d.upRows, 12);
    body += secHead("Yesterday's daily updates") + rowsWrap(rowsU.map((u) =>
      `<tr><td style="padding:5px 0; line-height:1.5; font-size:12pt; font-family:${MR_FF};"><b>${esc(u.desc)}</b>${u.pct != null ? ` <span style="color:#2456A6; font-weight:bold;">${u.pct}%</span>` : ""}<br>` +
      u.items.map((it) => `<span style="color:#48525e;">${esc(it.note)}</span> <span style="color:#68727f; font-size:10pt;">${esc(MID + (it.by_name || "admin") + ", " + new Date(it.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }))}</span>`).join("<br>") + `</td></tr>`).join("") + moreLine(more, "activities with updates"));
  }
  if (sec.ytt === false && sec.witness !== false && d.witness.length) {
    body += secHead("Witness events today", "#2456A6") + rowsWrap(d.witness.map((r) =>
      `<tr><td style="padding:5px 0; font-size:12pt; font-family:${MR_FF};">${esc(r.a.desc || "Untitled")} <span style="color:#68727f;">${MID}${esc(r.co)}${MID}${esc(new Date(r.a.witnessAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" }))}</span></td></tr>`).join(""));
  }
  const html = `<table width="780" cellpadding="0" cellspacing="0" style="background:#ffffff; font-family:${MR_FF}; border:1px solid #d9dee5;">`
    + (() => {
        // REV285: identity masthead. Logo only if it is a hosted https URL (data-URIs and
        // relative paths break in Outlook and Gmail); otherwise a clean text wordmark.
        const logo = meta.logoDark || meta.logoUrl || "";
        const useLogo = typeof logo === "string" && /^(https:\/\/|data:image\/|cid:)/.test(logo);
        const markCell = useLogo
          ? `<td style="vertical-align:middle; padding-right:11px;"><img src="${esc(logo)}" alt="atnorth" height="34" style="height:34px; width:auto; display:block;"></td>`
          : `<td style="vertical-align:middle; padding-right:12px; color:#7BB2E8; font-family:${MR_FF}; font-size:14pt; font-weight:bold; letter-spacing:-.3px;">atnorth</td>`;
        return `<tr><td style="background:#001C26; padding:20px 24px 18px;"><table width="100%" cellpadding="0" cellspacing="0"><tr>`
          + `<td style="vertical-align:middle;"><table cellpadding="0" cellspacing="0"><tr>${markCell}`
          + `<td style="vertical-align:middle;"><div style="color:#5C7690; font-size:9pt; letter-spacing:.18em; font-weight:bold; font-family:${MR_FF};">MORNING CX UPDATE</div>`
          + `<div style="color:#ffffff; font-size:14pt; font-weight:bold; font-family:${MR_FF}; letter-spacing:-.3px; padding-top:2px;">${esc(meta.projName || "FIN04")}</div></td></tr></table></td>`
          + `<td align="right" style="vertical-align:middle;"><div style="display:inline-block; font-family:'Courier New',monospace; font-size:9pt; letter-spacing:.1em; color:#7BB2E8; border:1px solid #33586e; border-radius:4px; padding:3px 8px;">${esc(meta.projName || "FIN04")}</div>`
          + `<div style="color:#9DB0C2; font-size:10pt; font-family:${MR_FF}; padding-top:7px;">${meta.projLine ? esc(meta.projLine) + "<br>" : ""}${esc(meta.dateLine)}</div></td>`
          + `</tr></table></td></tr>`
          + `<tr><td style="background:#2456A6; font-size:0; line-height:0; height:4px;">&nbsp;</td></tr>`;
      })()
    + body
    + `<tr><td style="padding:16px 24px 20px;" align="center"><table cellpadding="0" cellspacing="0" align="center"><tr><td>${emailBtn(esc(meta.appUrl || "https://dlp-pi.vercel.app"), "Open the board")}</td></tr></table>`
    + `</td></tr></table>`;
  return emailShell(html, projectFooter(meta.projName, `font-family:${MR_FF};`));
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
