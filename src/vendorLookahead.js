// REV336: Vendor Lookahead. Pure data assembly, Gantt layout, SVG string builder and
// the email-safe clipboard rendering for the owner/admin engagement snapshot on the
// Reports page. No app state, no DOM, no IO: every function here runs headless so the
// whole feature is provable in the harness. The popout component in App.jsx consumes
// the layout for its interactive JSX Gantt; the SVG string builder exists for the
// Copy Gantt as image path (Outlook strips pasted SVG, so it rasterises to PNG).

const pD = (s) => new Date(String(s).slice(0, 10) + "T00:00:00Z");
const addD = (d, n) => new Date(d.getTime() + n * 86400000);
const iso = (d) => d.toISOString().slice(0, 10);
export const vlDd = (s) => pD(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const MID = " \u00b7 ";

// Mirrors the Workload view palette so a vendor keeps one colour across the app; the
// second Workload slot is a CSS variable, replaced here with its literal green so the
// same colours survive SVG rasterisation and pasted email HTML.
export const VL_PAL = ["#2563EB", "#1e8e63", "#D97706", "#7C3AED", "#DB2777", "#0891B2", "#65A30D", "#DC2626", "#475569"];
export const vlColor = (id) => { if (!id) return "#94A3B8"; let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return VL_PAL[h % VL_PAL.length]; };

// Next Monday, strictly forward: run on a Monday and the window still starts the
// Monday after, per the approved pure-forward anchor.
export function vlWindow(todayISO) {
  const t = pD(todayISO);
  const dow = t.getUTCDay();
  const days = ((8 - dow) % 7) || 7;
  const anchor = addD(t, days);
  const weeks = [0, 1, 2, 3].map((i) => iso(addD(anchor, i * 7)));
  return { anchor: iso(anchor), end: iso(addD(anchor, 27)), weeks, label: "W/C " + vlDd(iso(anchor)).toUpperCase() + " \u00b7 4 WEEKS" };
}

// REV335 closure rules, verbatim: complete, failed, or reported 100% is closed work
// and can never dress up engagement.
const pctOfA = (a) => a.percent != null ? Math.max(0, Math.min(100, Math.round(a.percent))) : (a.status === "complete" ? 100 : 0);
const failedA = (a) => String(a.outcome || "").toLowerCase() === "failed";
export const vlClosed = (a) => a.status === "complete" || failedA(a) || pctOfA(a) >= 100;

export function vendorLookaheadData(St, todayISO, excludeNames) {
  const win = vlWindow(todayISO);
  const ws = win.anchor, we = win.end;
  const ex = new Set((excludeNames || []).map((n) => String(n || "").trim().toLowerCase()).filter(Boolean));
  const cos = (St.companies || []).filter((c) => !ex.has(String(c.name || "").trim().toLowerCase()));
  const endOf = (a) => iso(addD(pD(a.start), Math.max(0, (a.duration || 1) - 1)));
  const all = (St.activities || []).filter((a) => a && a.start);
  const inWin = all.filter((a) => !vlClosed(a)).map((a) => ({ a, s: String(a.start).slice(0, 10), e: endOf(a) })).filter((r) => r.s <= we && r.e >= ws);
  const wkOf = (dISO) => Math.min(3, Math.max(0, Math.floor((pD(dISO) - pD(ws)) / (7 * 86400000))));
  const witIn = (a) => a.witnessInvite && a.witnessAt && String(a.witnessAt).slice(0, 10) >= ws && String(a.witnessAt).slice(0, 10) <= we;
  const mkVendor = (id, name, rows) => {
    rows.sort((x, y) => (x.s < y.s ? -1 : x.s > y.s ? 1 : 0));
    const weekly = [0, 0, 0, 0];
    rows.forEach((r) => { const w0 = wkOf(r.s < ws ? ws : r.s), w1 = wkOf(r.e > we ? we : r.e); for (let w = w0; w <= w1; w++) weekly[w]++; });
    return { id, name, color: vlColor(id), rows, weekly, witCount: rows.filter((r) => witIn(r.a)).length };
  };
  const byCo = {};
  inWin.forEach((r) => { (byCo[r.a.companyId || ""] = byCo[r.a.companyId || ""] || []).push(r); });
  const vendors = []; const zeros = [];
  cos.forEach((c) => {
    const rows = byCo[c.id] || [];
    if (rows.length) { vendors.push(mkVendor(c.id, c.name, rows)); return; }
    // Zero row context: winding down, gearing up, never engaged and stalled are four
    // different conversations; the snapshot must not flatten them into one red line.
    const mine = all.filter((a) => a.companyId === c.id);
    let ctx;
    if (!mine.length) ctx = "no activities on the board at all";
    else {
      const future = mine.filter((a) => !vlClosed(a) && String(a.start).slice(0, 10) > we).sort((x, y) => (String(x.start) < String(y.start) ? -1 : 1));
      if (future.length) ctx = "next activity starts " + vlDd(future[0].start);
      else {
        const fins = mine.filter((a) => a.status === "complete").map((a) => (a.actualFinish ? String(a.actualFinish).slice(0, 10) : endOf(a))).sort();
        if (fins.length) ctx = "last activity finished " + vlDd(fins[fins.length - 1]);
        else { const n = mine.filter((a) => !vlClosed(a)).length; ctx = n + " open activit" + (n === 1 ? "y" : "ies") + ", all past-dated"; }
      }
    }
    zeros.push({ id: c.id, name: c.name, ctx });
  });
  vendors.sort((x, y) => y.rows.length - x.rows.length || x.name.localeCompare(y.name));
  if (byCo[""] && byCo[""].length) vendors.push(mkVendor("", "Unassigned", byCo[""]));
  const counts = {
    vendors: vendors.length,
    activities: vendors.reduce((s, v) => s + v.rows.length, 0),
    witness: vendors.reduce((s, v) => s + v.witCount, 0),
    zeros: zeros.length,
  };
  return { win, vendors, zeros, counts };
}

// Geometry only: the interactive JSX Gantt in App.jsx and the PNG copy path both draw
// from this one layout so they can never disagree about a bar.
export function vlGanttLayout(d) {
  const ws = d.win.anchor;
  const dayOff = (s) => Math.round((pD(s) - pD(ws)) / 86400000);
  const LEFT = 132, W = 840, TOP = 20, ROWH = 14, LANEPAD = 12;
  const dayW = (W - LEFT - 8) / 28;
  const lanes = [], bars = [], diamonds = [];
  let y = TOP + 10;
  d.vendors.forEach((v) => {
    const subs = [];
    const placed = v.rows.map((r) => {
      const s = Math.max(0, dayOff(r.s)), e = Math.min(27, dayOff(r.e));
      let si = subs.findIndex((endD) => s > endD);
      if (si < 0) { si = subs.length; subs.push(e); } else subs[si] = e;
      return { r, s, e, si };
    });
    const laneH = Math.max(1, subs.length) * ROWH + LANEPAD;
    lanes.push({ id: v.id, name: v.name, color: v.color, y: y + laneH / 2, top: y });
    placed.forEach(({ r, s, e, si }) => {
      bars.push({ id: r.a.id, x: LEFT + s * dayW, w: Math.max(4, (e - s + 1) * dayW - 2), y: y + si * ROWH, h: 9, color: v.color, opacity: si % 2 ? 0.72 : 1, desc: r.a.desc || "Untitled" });
      if (r.a.witnessInvite && r.a.witnessAt) {
        const wd = dayOff(String(r.a.witnessAt).slice(0, 10));
        if (wd >= 0 && wd <= 27) diamonds.push({ x: LEFT + wd * dayW + dayW / 2, y: y + si * ROWH + 4.5 });
      }
    });
    y += laneH;
  });
  const H = Math.max(y + 8, 80);
  const weeks = d.win.weeks.map((wISO, i) => ({ x: LEFT + i * 7 * dayW + 8, label: "W/C " + vlDd(wISO).toUpperCase() }));
  const grid = [0, 1, 2, 3, 4].map((i) => LEFT + i * 7 * dayW);
  return { W, H, LEFT, TOP, weeks, grid, lanes, bars, diamonds };
}

const VL_THEMES = {
  dark: { bg: "#11161e", grid: "#232b38", lane: "#c6cfda", week: "#68727f", diamond: "#b79bf0" },
  light: { bg: "#ffffff", grid: "#e9edf2", lane: "#1c2733", week: "#68727f", diamond: "#7C3AED" },
};

export function vlGanttSvg(lay, theme) {
  const T = VL_THEMES[theme] || VL_THEMES.light;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lay.W} ${lay.H}" width="${lay.W}" height="${lay.H}"><rect width="${lay.W}" height="${lay.H}" fill="${T.bg}"/>`;
  s += lay.weeks.map((w) => `<text x="${w.x}" y="14" font-family="Segoe UI,Arial" font-size="10" font-weight="700" fill="${T.week}">${esc(w.label)}</text>`).join("");
  s += lay.grid.map((x) => `<line x1="${x}" y1="${lay.TOP}" x2="${x}" y2="${lay.H - 6}" stroke="${T.grid}"/>`).join("");
  s += lay.lanes.map((l) => `<text x="8" y="${l.y + 4}" font-family="Segoe UI,Arial" font-size="11" font-weight="700" fill="${T.lane}">${esc(l.name)}</text>`).join("");
  s += lay.bars.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3" fill="${b.color}" opacity="${b.opacity}"/>`).join("");
  s += lay.diamonds.map((p) => `<path d="M ${p.x} ${p.y - 5} l 5 5 l -5 5 l -5 -5 z" fill="${T.diamond}"/>`).join("");
  return s + "</svg>";
}

// Email-safe clipboard rendering: classic Outlook renders with the Word engine, so
// nested tables, inline styles, literal hex, widths as attributes, and nothing that
// depends on flexbox, grid or dark backgrounds. This is deliberately the light
// equivalent of the popout, not a copy of the dark app styling, which would not
// survive a paste anywhere useful.
const FF = "Aptos,'Aptos Display','Segoe UI',Calibri,Arial,sans-serif";
export const VL_CARD_CAP = 6;

export function buildVendorCardsEmailHtml(d, projName) {
  const cellk = (v, lb, color) => `<td align="center" style="border:1px solid #e3e8ef; padding:8px 4px; font-family:${FF};"><span style="font-size:14pt; font-weight:bold; color:${color};">${v}</span><br><span style="font-size:9pt; color:#68727f;">${lb}</span></td>`;
  let h = `<table width="720" cellpadding="0" cellspacing="0" style="font-family:${FF}; color:#1c2733; background:#ffffff;">`;
  h += `<tr><td style="padding:2px 0 4px; font-size:14pt; font-weight:bold; font-family:${FF};">Vendor Lookahead${MID}${esc(projName || "DLP")}${MID}${esc(win4Label(d))}</td></tr>`;
  h += `<tr><td style="padding:4px 0 10px;"><table width="100%" cellpadding="0" cellspacing="0"><tr>`
    + cellk(d.counts.vendors, "VENDORS ACTIVE", "#2456A6") + `<td width="6"></td>`
    + cellk(d.counts.activities, "OPEN ACTIVITIES", "#1e8e63") + `<td width="6"></td>`
    + cellk(d.counts.witness, "WITNESS SESSIONS", "#7C3AED") + `<td width="6"></td>`
    + cellk(d.counts.zeros, "NOTHING PLANNED", "#C0392B") + `</tr></table></td></tr>`;
  d.vendors.forEach((v) => {
    const shown = v.rows.slice(0, VL_CARD_CAP);
    const more = v.rows.length - shown.length;
    let inner = `<tr><td colspan="2" style="padding:7px 12px 6px; border-bottom:1px solid #f1f4f8; background:#f9fafc; font-family:${FF};">`
      + `<span style="font-size:11.5pt; font-weight:bold;">${esc(v.name)}</span>`
      + `<span style="font-size:9.5pt; font-weight:bold; color:#1c2733;">&#160;&#160;${v.rows.length} activit${v.rows.length === 1 ? "y" : "ies"}</span>`
      + (v.witCount ? `<span style="font-size:9.5pt; font-weight:bold; color:#2456A6;">${MID}${v.witCount} witness</span>` : "")
      + `<span style="font-size:8.5pt; font-weight:bold; color:#68727f;">&#160;&#160;${v.weekly.join(" \u00b7 ")} by week</span></td></tr>`;
    shown.forEach((r) => {
      const chips = (r.a.committed ? `<span style="font-size:7.5pt; font-weight:bold; letter-spacing:.05em; color:#ffffff; background:#2456A6; padding:2px 7px;">WILL</span>&#160;` : "")
        + (r.a.witnessInvite ? `<span style="font-size:7.5pt; font-weight:bold; letter-spacing:.05em; color:#ffffff; background:#7C3AED; padding:2px 7px;">WIT</span>` : "");
      inner += `<tr><td style="padding:5px 12px; border-bottom:1px solid #f6f8fb; font-family:${FF};"><span style="font-size:10.5pt; font-weight:bold;">${esc(r.a.desc || "Untitled")}</span> <span style="font-size:9.5pt; color:#68727f;">${MID}${esc([r.a.level, vlDd(r.s) + " (" + (r.a.duration || 1) + "d)"].filter(Boolean).join(MID))}</span></td><td align="right" style="padding:5px 12px 5px 0; border-bottom:1px solid #f6f8fb; white-space:nowrap;">${chips}</td></tr>`;
    });
    if (more > 0) inner += `<tr><td colspan="2" style="padding:5px 12px 7px; font-size:9pt; color:#68727f; font-family:${FF};">and ${more} more in the window</td></tr>`;
    h += `<tr><td style="padding:5px 0;"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e8ef; border-left:4px solid ${v.color};">${inner}</table></td></tr>`;
  });
  if (d.zeros.length) {
    h += `<tr><td style="padding:10px 0 3px; font-size:8.5pt; letter-spacing:.07em; font-weight:bold; color:#C0392B; font-family:${FF}; border-bottom:1px solid #e3e8ef;">NOTHING PLANNED IN THE NEXT 4 WEEKS</td></tr>`;
    d.zeros.forEach((z) => {
      h += `<tr><td style="padding:5px 0; border-bottom:1px solid #f6f8fb; font-family:${FF};"><span style="font-size:10.5pt; font-weight:bold; color:#C0392B;">${esc(z.name)}</span> <span style="font-size:9.5pt; color:#68727f;">${MID}${esc(z.ctx)}</span></td></tr>`;
    });
  }
  return h + `</table>`;
}

function win4Label(d) { return "W/C " + vlDd(d.win.anchor) + ", 4 weeks"; }

export function buildVendorCardsText(d, projName) {
  const L = ["Vendor Lookahead" + MID + (projName || "DLP") + MID + win4Label(d), ""];
  d.vendors.forEach((v) => {
    L.push(v.name + ": " + v.rows.length + " activit" + (v.rows.length === 1 ? "y" : "ies") + (v.witCount ? ", " + v.witCount + " witness" : "") + " (" + v.weekly.join("/") + " by week)");
    v.rows.slice(0, VL_CARD_CAP).forEach((r) => L.push("  - " + (r.a.desc || "Untitled") + MID + vlDd(r.s) + " (" + (r.a.duration || 1) + "d)" + (r.a.committed ? " [WILL]" : "") + (r.a.witnessInvite ? " [WIT]" : "")));
    if (v.rows.length > VL_CARD_CAP) L.push("  and " + (v.rows.length - VL_CARD_CAP) + " more in the window");
  });
  if (d.zeros.length) { L.push("", "Nothing planned in the next 4 weeks:"); d.zeros.forEach((z) => L.push("  - " + z.name + MID + z.ctx)); }
  return L.join("\n");
}
