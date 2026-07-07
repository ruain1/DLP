// Pure digest logic for the FIN04 admin update emails (daily 17:00, weekly Fri 16:00,
// Europe/Helsinki). No Deno or Supabase imports here so the whole file is testable in
// any JS runtime; index.ts owns IO. Every rendered claim is a verbatim rendering of an
// audit_log row: verb from the action, activity from the entity join, specifics from the
// detail string. No generated prose, by design: this digest is audit-grade.

export const APP_NAME = "FIN04 DLP";
const TZ = "Europe/Helsinki";

// ---------- Helsinki time ----------
export function helParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(d)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, wd: p.weekday };
}
export const helDateStr = (d: Date) => { const p = helParts(d); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; };
// UTC instant for a Helsinki wall-clock time. Guess UTC, measure what wall time that guess
// produces in Helsinki, correct by the difference; converges in one step for real offsets.
export function utcForHelsinki(y: number, m: number, d: number, hh: number, mm = 0): Date {
  let t = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 3; i++) {
    const got = helParts(new Date(t));
    const want = Date.UTC(y, m - 1, d, hh, mm);
    const have = Date.UTC(got.y, got.m - 1, got.d, got.hh, got.mm);
    if (have === want) break;
    t += want - have;
  }
  return new Date(t);
}
// Which digest is due at this instant. Friday 16:00 sends the weekly, which replaces that
// day's daily; every other day sends the daily at 17:00.
export function dueKind(now: Date): "daily" | "weekly" | null {
  const p = helParts(now);
  if (p.wd === "Fri" && p.hh === 16) return "weekly";
  if (p.hh === 17 && p.wd !== "Fri") return "daily";
  return null;
}
// Reporting window ending at the send boundary of `now`. Daily windows normally start at
// the previous day's 17:00; the Saturday daily starts at Friday 16:00 because Friday's
// daily is replaced by the weekly, so the Friday 16:00 to 17:00 hour must not fall into a
// gap. Weekly is the trailing seven days ending Friday 16:00.
export function windowFor(kind: "daily" | "weekly", now: Date) {
  const p = helParts(now);
  const end = utcForHelsinki(p.y, p.m, p.d, kind === "weekly" ? 16 : 17, 0);
  let start: Date;
  if (kind === "weekly") start = new Date(end.getTime() - 7 * 86400000 + (helOffsetDelta(end, 7)));
  else {
    const prev = new Date(end.getTime() - 36 * 3600000); // safely inside the previous Helsinki day
    const q = helParts(prev);
    start = q.wd === "Fri" ? utcForHelsinki(q.y, q.m, q.d, 16, 0) : utcForHelsinki(q.y, q.m, q.d, 17, 0);
  }
  return { start, end };
}
// Correction so the weekly start lands on the same wall-clock hour across a DST change.
function helOffsetDelta(end: Date, daysBack: number): number {
  const p = helParts(new Date(end.getTime() - daysBack * 86400000));
  const wall = utcForHelsinki(p.y, p.m, p.d, helParts(end).hh, 0);
  return wall.getTime() - (end.getTime() - daysBack * 86400000);
}

// ---------- classification ----------
export type BucketKey = "completed" | "outcome" | "witness" | "resched" | "constraints" | "progress" | "users" | "io" | "edited" | "noted" | "admin" | "other";
export const BUCKETS: Record<BucketKey, { label: string; color: string }> = {
  completed: { label: "Completed", color: "#0E9384" },
  outcome: { label: "Outcome", color: "#0E9384" },
  witness: { label: "Witness invites", color: "#7A5AF8" },
  resched: { label: "Rescheduled", color: "#C0392B" },
  constraints: { label: "Constraints", color: "#E0A106" },
  progress: { label: "Progressed", color: "#2456A6" },
  users: { label: "Users", color: "#6b7280" },
  io: { label: "Imports and exports", color: "#6b7280" },
  edited: { label: "Edited", color: "#6b7280" },
  noted: { label: "Noted", color: "#6b7280" },
  admin: { label: "Project admin", color: "#6b7280" },
  other: { label: "Other", color: "#6b7280" },
};
const DAILY_ORDER: BucketKey[] = ["completed", "outcome", "witness", "resched", "constraints", "progress", "users", "io", "edited", "noted", "admin", "other"];
const WEEKLY_ITEMISE: BucketKey[] = ["completed", "witness", "resched", "outcome", "users", "constraints"];

export function classify(action: string): BucketKey {
  const a = (action || "").toLowerCase();
  if (/witness.*(invite|sent|cancel)|invite.*witness|failed attempt invite|test invite/.test(a)) return "witness";
  if (/retest|witness (outcome|failed|passed)|outcome/.test(a)) return "outcome";
  if (/constraint/.test(a)) return "constraints";
  if (/reschedul|move activity|resize/.test(a)) return "resched";
  if (/percent|progress/.test(a)) return "progress";
  if (/complete/.test(a)) return "completed";
  if (/^(insert|update|delete) profiles\b/.test(a)) return "users";
  if (/^(insert|update|delete) (settings|companies|areas|systems|levels)\b/.test(a)) return "admin";
  if (/invite user|user invited|access request|approve|reset password|set-password|remove user|add person/.test(a)) return "users";
  if (/import|export|workbook|json/.test(a)) return "io";
  if (/note/.test(a)) return "noted";
  if (/rename|add (level|zone|system|company|cx stage)|delete (level|cx stage)|remove (level|zone)|change setting|logo|company description|copy zones/.test(a)) return "admin";
  if (/edit|save|find & replace|bulk set|delete activit|add activit|add \b/.test(a)) return "edited";
  return "other";
}

// ---------- helpers ----------
export const esc = (s: unknown) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]);
export type AuditRow = { ts: string; user: string; action: string; detail: string; entity: string; entityId: string | null };
export type ActRef = { code: number | null; desc: string; companyId: string | null };
// Setup-table audit rows historically stored the raw row_to_json() of the changed row as the
// detail (see the audit_setup trigger), so rendering that verbatim dumped unreadable JSON into
// the digest. Any JSON-shaped detail is humanised here rather than printed. Rows written by the
// REV142 trigger already carry human detail and fall straight through the non-JSON path.
const SETUP_ENTITIES = new Set(["settings", "profiles", "companies", "areas", "systems", "levels"]);
const looksJson = (s: string) => { const t = (s || "").trim(); return t.charAt(0) === "{" || t.charAt(0) === "["; };
const setupVerb = (action: string) => { const x = (action || "").toLowerCase(); return x.indexOf("insert") === 0 ? "Added" : x.indexOf("update") === 0 ? "Updated" : x.indexOf("delete") === 0 ? "Removed" : "Changed"; };
export function humanSetup(entity: string, action: string, detail: string): string {
  let o: any = {};
  try { o = JSON.parse(detail); } catch { return setupVerb(action) + " " + (entity || "record"); }
  if (entity === "settings") return `Lookahead ${o.weeks} wk / make-ready ${o.make_ready_days} d`;
  if (entity === "profiles") { const nm = o.name || "user"; const r = o.role || o.platform_role || ""; return nm + (r ? ` (${r})` : ""); }
  if (entity === "companies") return ("Company " + (o.name || "")).trim();
  if (entity === "areas") return ("Zone " + (o.name || "")).trim();
  if (entity === "systems") return ("System " + (o.name || "")).trim();
  if (entity === "levels") return ("Stage " + (o.key || "") + " " + (o.name || "")).trim();
  return setupVerb(action) + " " + (entity || "record");
}
export function refName(row: AuditRow, acts: Map<string, ActRef>): string {
  if (row.entity === "activity" && row.entityId && acts.has(row.entityId)) {
    const a = acts.get(row.entityId)!;
    return (a.code != null ? "#" + a.code + " " : "") + (a.desc || "activity");
  }
  if (SETUP_ENTITIES.has(row.entity) && looksJson(row.detail)) return humanSetup(row.entity, row.action, row.detail);
  const d = (row.detail || row.action || "").split(/[\n;]/)[0];
  if (looksJson(d)) return setupVerb(row.action) + " " + (row.entity || "record");
  return d;
}
const normT = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// Detail fragments that merely echo the activity name add nothing and read as stutter
// ("#1 MV Interlock Cabling Cx (MV Interlock Cabling Cx)"), so exact matches against the
// reference, with or without its #code prefix, are suppressed.
const detailFrag = (row: AuditRow, ref?: string) => {
  const d = (row.detail || "").trim();
  if (!d) return "";
  if (looksJson(d)) return "";
  if (ref) {
    const nd = normT(d);
    if (nd && (nd === normT(ref) || nd === normT(ref.replace(/^#\d+\s*/, "")))) return "";
  }
  return " (" + d + ")";
};
// Duplicate references within a verb group collapse to one entry with a count, and the caps
// and "+n more" maths run on the deduped list so the numbers stay honest.
const dedupeRefs = (rows: AuditRow[], acts: Map<string, ActRef>, withDetail: boolean) => {
  const order: string[] = [];
  const info = new Map<string, { n: number; frag: string }>();
  for (const r of rows) {
    const ref = refName(r, acts);
    if (!info.has(ref)) { order.push(ref); info.set(ref, { n: 0, frag: "" }); }
    const it = info.get(ref)!;
    it.n += 1;
    if (withDetail && !it.frag) it.frag = detailFrag(r, ref);
  }
  return order.map((ref) => ({ ref, n: info.get(ref)!.n, frag: info.get(ref)!.frag }));
};
const PCT = /(\d{1,3})\s*(?:%)?\s*(?:to|->|\u2192)\s*(\d{1,3})\s*%/;

// ---------- per-user summaries ----------
type Group = { key: BucketKey; rows: AuditRow[] };
function groupRows(rows: AuditRow[]): Group[] {
  const by = new Map<BucketKey, AuditRow[]>();
  for (const r of rows) { const k = classify(r.action); if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); }
  return DAILY_ORDER.filter((k) => by.has(k)).map((k) => ({ key: k, rows: by.get(k)! }));
}
const line = (k: BucketKey, html: string) => `<span style="color:${BUCKETS[k].color};font-weight:bold;">${BUCKETS[k].label}</span> ${html}`;

// Daily: full fidelity under caps. Up to 5 verb groups, up to 6 named references per group
// then "+n more"; a user beyond 25 actions gets the itemised top plus a remainder tally.
export function summariseDaily(rows: AuditRow[], acts: Map<string, ActRef>): string[] {
  const groups = groupRows(rows);
  const heavy = rows.length > 25;
  const shown = groups.slice(0, 5);
  const out: string[] = [];
  for (const g of shown) {
    const dd = dedupeRefs(g.rows, acts, true);
    const refs = dd.slice(0, 6).map((x) => esc(x.ref) + (x.n > 1 ? " (x" + x.n + ")" : "") + esc(x.frag));
    const more = dd.length > 6 ? ` (+${dd.length - 6} more)` : "";
    out.push(line(g.key, refs.join("; ") + more));
  }
  const rest = groups.slice(5).reduce((n, g) => n + g.rows.length, 0);
  if (rest || heavy) out.push(`<span style="color:#6b7280;font-weight:bold;">Also</span> ${rest ? rest + " further action" + (rest === 1 ? "" : "s") + " in other categories" : "high-volume day, itemised top shown"}`);
  return out;
}

// Weekly: outcome verbs stay itemised by name; progress, edits and notes roll up to counts
// with the largest movements named. Up to 6 verb lines per user.
export function summariseWeekly(rows: AuditRow[], acts: Map<string, ActRef>): string[] {
  const groups = groupRows(rows);
  const out: string[] = [];
  for (const g of groups) {
    if (out.length >= 6) break;
    if (WEEKLY_ITEMISE.includes(g.key)) {
      const withD = g.key === "constraints" || g.key === "witness";
      const dd = dedupeRefs(g.rows, acts, withD);
      const refs = dd.slice(0, 4).map((x) => esc(x.ref) + (x.n > 1 ? " (x" + x.n + ")" : "") + (withD ? esc(x.frag) : ""));
      const more = dd.length > 4 ? ` (+${dd.length - 4} more)` : "";
      out.push(line(g.key, refs.join("; ") + more));
    } else if (g.key === "progress" || g.key === "edited" || g.key === "noted") {
      const perAct = new Map<string, { name: string; best: number; span: string }>();
      for (const r of g.rows) {
        const nm = refName(r, acts);
        const m = PCT.exec(r.detail || "");
        const delta = m ? Math.abs(+m[2] - +m[1]) : 0;
        const cur = perAct.get(nm);
        if (!cur || delta > cur.best) perAct.set(nm, { name: nm, best: delta, span: m ? `${m[1]} to ${m[2]}%` : "" });
      }
      const tops = [...perAct.values()].sort((a, b) => b.best - a.best).filter((x) => x.best > 0).slice(0, 2);
      const topsTxt = tops.length ? ", largest " + tops.map((t) => esc(t.name) + " (" + t.span + ")").join(", ") : "";
      const verb = g.key === "progress" ? "update" : g.key === "edited" ? "change" : "note";
      out.push(line(g.key, `${g.rows.length} ${verb}${g.rows.length === 1 ? "" : "s"} across ${perAct.size} activit${perAct.size === 1 ? "y" : "ies"}${topsTxt}`));
    } else {
      out.push(line(g.key, `${g.rows.length} action${g.rows.length === 1 ? "" : "s"}`));
    }
  }
  return out;
}

// ---------- vendor assembly ----------
export type Profile = { id: string; name: string; role: string; companyId: string | null };
export type VendorBlock = { id: string; name: string; total: number; users: { name: string; n: number; lines: string[] }[]; note?: string; logo?: { cid: string; w: number; h: number } | null };
export function assembleVendors(audit: AuditRow[], profiles: Profile[], companies: Map<string, string>, acts: Map<string, ActRef>, kind: "daily" | "weekly") {
  const byName = new Map(profiles.map((p) => [p.name, p]));
  const perUser = new Map<string, AuditRow[]>();
  for (const r of audit) { if (!perUser.has(r.user)) perUser.set(r.user, []); perUser.get(r.user)!.push(r); }
  const perCo = new Map<string, VendorBlock>();
  for (const [user, rows] of perUser) {
    const prof = byName.get(user);
    // Matched admins with no company are CSN by convention; audit authors matching no current
    // profile (system writes, renamed or removed accounts) go to a pinned Unattributed block
    // rather than being silently filed under CSN.
    const coId = prof ? (prof.companyId || "__csn") : "__unattr";
    const coName = coId === "__unattr" ? "Unattributed" : (coId === "__csn" ? "CSN" : companies.get(coId) || "Unassigned");
    if (!perCo.has(coId)) perCo.set(coId, { id: coId, name: coName, total: 0, users: [], note: coId === "__unattr" ? "Audit entries whose author does not match a current user profile." : undefined });
    const blk = perCo.get(coId)!;
    blk.total += rows.length;
    blk.users.push({ name: user, n: rows.length, lines: kind === "daily" ? summariseDaily(rows, acts) : summariseWeekly(rows, acts) });
  }
  const blocks = [...perCo.values()].sort((a, b) => (a.id === "__unattr" ? 1 : 0) - (b.id === "__unattr" ? 1 : 0) || b.total - a.total);
  for (const b of blocks) b.users.sort((x, y) => y.n - x.n);
  return { blocks, totalActions: audit.length, totalUsers: perUser.size };
}

// ---------- changelog ----------
export type ChangeEntry = { rev: string; date: string; items: string[] };
export function changelogRows(entries: ChangeEntry[], startDate: string, endDate: string, kind: "daily" | "weekly") {
  const inWin = entries.filter((e) => e.date >= startDate && e.date <= endDate).sort((a, b) => a.rev.localeCompare(b.rev, undefined, { numeric: true }));
  if (!inWin.length) return [] as { head: string; text: string }[];
  // First sentence of each item, joined; never truncated mid-word. Every word that appears is
  // whole; busy-week volume is handled structurally (the latest three revisions itemised, the
  // remainder counted with a pointer to DLP) rather than by clipping.
  const first = (s: string) => (s || "").split(/[.;:]/)[0].trim();
  const condense = (e: ChangeEntry) => e.items.map(first).filter(Boolean).join("; ");
  if (kind === "weekly" && inWin.length > 3) {
    const latest = inWin.slice(-3);
    const earlier = inWin.length - 3;
    return [{ head: `${inWin[0].rev} to ${inWin[inWin.length - 1].rev}`, text: latest.map((e) => first(e.items[0])).join("; ") + `; plus ${earlier} earlier revision${earlier === 1 ? "" : "s"} this week, full changelog in DLP.` }];
  }
  return inWin.map((e) => ({ head: e.rev, text: condense(e) }));
}

// ---------- workflow palette ----------
// The Cx bar reads the project's own stage colours (L1 to L4, sorted naturally), padded with
// the established red, amber, green, blue when a project defines fewer than four stages.
export function stageColorsFor(levels: Record<string, { color?: string }> | null | undefined): string[] {
  const fallback = ["#C0392B", "#E0A106", "#0E9384", "#2456A6"];
  const keys = Object.keys(levels || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const got = keys.map((k) => (levels as any)[k] && (levels as any)[k].color).filter(Boolean).slice(0, 4);
  while (got.length < 4) got.push(fallback[got.length]);
  return got;
}

// ---------- weekly KPIs (server-side replica of the client computeReport formulas) ----------
export type ActRow = { start_date: string | null; duration: number | null; committed: boolean | null; status: string | null; actual_finish: string | null; actual_start: string | null; constraints: { done?: boolean }[] | null; witness_invite: boolean | null; outcome: string | null; outcome_at: string | null };
const dayMs = 86400000;
const pd = (s: string) => new Date(s + "T00:00:00Z").getTime();
export function weeklyKpis(rows: ActRow[], weekStartISO: string, weekEndISO: string, todayISO: string) {
  const finish = (a: ActRow) => pd(a.start_date!) + ((a.duration || 1) - 1) * dayMs;
  const made = (a: ActRow) => a.status === "complete" && (!a.actual_finish || pd(a.actual_finish) <= finish(a));
  const openN = (a: ActRow) => (a.constraints || []).filter((c) => !c.done).length;
  const ws = pd(weekStartISO), we = pd(weekEndISO), t0 = pd(todayISO), t1 = t0 + 27 * dayMs;
  const dated = rows.filter((a) => a.start_date);
  const due = dated.filter((a) => a.committed && finish(a) >= ws && finish(a) <= we);
  const ppc = due.length ? Math.round((due.filter(made).length / due.length) * 100) : null;
  const inLA = dated.filter((a) => pd(a.start_date!) <= t1 && finish(a) >= t0);
  const delayed = inLA.filter((a) => {
    const ps = pd(a.start_date!), pf = finish(a);
    if (a.status === "complete" && a.actual_finish) return pd(a.actual_finish) > pf;
    if (a.actual_start) return pd(a.actual_start) > ps;
    return false;
  }).length;
  const makeReady = inLA.filter((a) => openN(a) > 0 && a.status !== "complete").length;
  const outs = rows.filter((a) => a.witness_invite && a.outcome && a.outcome !== "pending" && a.outcome_at && pd(a.outcome_at) >= ws && pd(a.outcome_at) <= we);
  return { ppc, delayed, makeReady, witnessPassed: outs.filter((a) => a.outcome === "succeeded").length, witnessAttempted: outs.length, due: due.length };
}

// ---------- email templates (approved shells + itemised body) ----------
const F = "font-family:Segoe UI,Arial,sans-serif;";
const B = "#2456A6";
export function subjectFor(kind: "daily" | "weekly", label: string) {
  return kind === "daily" ? `${APP_NAME} Daily Update, ${label}` : `${APP_NAME} Weekly Update, ${label}`;
}
export function buildDigestHtml(p: {
  kind: "daily" | "weekly"; dateLine: string;
  changelog: { head: string; text: string }[];
  vendors: ReturnType<typeof assembleVendors>;
  kpi?: ReturnType<typeof weeklyKpis> | null;
  appUrl: string;
  qmc?: { cid: string; w: number; h: number } | null;
  stageColors?: string[];
}) {
  const title = p.kind === "daily" ? `${APP_NAME} Daily Update` : `${APP_NAME} Weekly Update`;
  const sc = (p.stageColors && p.stageColors.length === 4) ? p.stageColors : ["#C0392B", "#E0A106", "#0E9384", "#2456A6"];
  const bar = (h: number) => `<tr><td style="padding:0;font-size:0;line-height:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>` + sc.map((col) => `<td width="25%" height="${h}" style="background-color:${col};font-size:0;line-height:0;">&nbsp;</td>`).join("") + `</tr></table></td></tr>`;
  const header = `<tr><td style="padding:16px 20px 12px 20px;background-color:#ffffff;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>`
    + (p.qmc ? `<td width="${p.qmc.w + 10}" style="vertical-align:middle;"><img src="cid:${p.qmc.cid}" width="${p.qmc.w}" height="${p.qmc.h}" alt="Quantum Mission Critical" style="display:block;"></td>` : "")
    + `<td style="vertical-align:middle;${p.qmc ? "padding-left:6px;" : ""}"><span style="font-size:18px;font-weight:bold;color:#111827;${F}">${title}</span><br><span style="font-size:11.5px;color:#6b7280;${F}">${esc(p.dateLine)}</span></td>`
    + `</tr></table></td></tr>` + bar(6);
  const kpiStrip = p.kpi
    ? `<tr><td style="padding:16px 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr>`
      + tile(p.kpi.ppc == null ? "n/a" : p.kpi.ppc + "%", "PPC", "#111827", B)
      + `<td width="8" style="font-size:0;line-height:0;">&nbsp;</td>` + tile(String(p.kpi.delayed), "Delayed", "#C0392B", "#C0392B")
      + `<td width="8" style="font-size:0;line-height:0;">&nbsp;</td>` + tile(p.kpi.witnessAttempted ? p.kpi.witnessPassed + " / " + p.kpi.witnessAttempted : "0", "Witness Passed", "#0E9384", "#0E9384")
      + `<td width="8" style="font-size:0;line-height:0;">&nbsp;</td>` + tile(String(p.kpi.makeReady), "Make-Ready", "#E0A106", "#E0A106")
      + `</tr></table></td></tr>`
    : "";
  const headW = p.changelog.some((x) => x.head.length > 7) ? 98 : 70;
  const clRows = p.changelog.length
    ? `<tr><td style="padding:${p.kpi ? 14 : 16}px 20px 2px 20px;"><span style="font-size:11px;font-weight:bold;color:${B};text-transform:uppercase;letter-spacing:0.6px;${F}">Changelog Updates${p.kind === "weekly" ? " This Week" : ""}</span></td></tr>`
      + `<tr><td style="padding:6px 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">`
      + p.changelog.map((x) => `<tr><td width="${headW}" valign="top" style="padding:4px 10px 4px 0;font-size:12px;font-weight:bold;color:${B};${F}">${esc(x.head)}</td><td style="padding:4px 0;font-size:12.5px;color:#1f2937;line-height:1.55;${F}">${esc(x.text)}</td></tr>`).join("")
      + `</table></td></tr>`
    : "";
  const v = p.vendors;
  const vendorHead = `<tr><td style="padding:14px 20px 8px 20px;"><span style="font-size:11px;font-weight:bold;color:${B};text-transform:uppercase;letter-spacing:0.6px;${F}">Activity By Vendor</span> <span style="font-size:11px;color:#6b7280;${F}">&#183; ${v.totalActions} action${v.totalActions === 1 ? "" : "s"} by ${v.totalUsers} ${v.totalUsers === 1 ? "person" : "people"}${p.kind === "weekly" ? " across " + v.blocks.length + " vendor" + (v.blocks.length === 1 ? "" : "s") : ""}</span></td></tr>`;
  const card = (b: VendorBlock) => {
    const meta = `${b.total} action${b.total === 1 ? "" : "s"}` + (b.users.length > 1 ? ` &#183; most active: ${esc(b.users[0].name)}` : "");
    const logo = b.logo ? `<img src="cid:${b.logo.cid}" width="${b.logo.w}" height="${b.logo.h}" alt="${esc(b.name)}" style="display:inline-block;vertical-align:middle;">` : "";
    const note = b.note ? `<tr><td style="padding:8px 0 2px 0;font-size:11.5px;color:#6b7280;line-height:1.6;${F}">${esc(b.note)}</td></tr>` : "";
    return `<tr><td style="padding:0 0 16px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #e2e8f2;">`
      + `<tr><td style="background-color:#EEF2F8;padding:9px 14px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>`
      + `<td style="vertical-align:middle;">${logo}<span style="font-size:13px;font-weight:bold;color:#111827;${logo ? "padding-left:10px;" : ""}${F}">${esc(b.name)}</span></td>`
      + `<td align="right" style="font-size:11px;color:#55627a;${F}">${meta}</td>`
      + `</tr></table></td></tr>`
      + `<tr><td style="padding:2px 14px 6px 14px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${note}`
      + b.users.map((u) =>
        `<tr><td style="padding:8px 0 2px 0;font-size:12px;font-weight:bold;color:#1f2937;${F}">${esc(u.name)} <span style="font-weight:normal;color:#6b7280;">&#183; ${u.n} action${u.n === 1 ? "" : "s"}</span></td></tr>`
        + `<tr><td style="padding:2px 0 8px 12px;font-size:12px;color:#374151;line-height:1.7;${F}">${u.lines.join("<br>")}</td></tr>`
      ).join("")
      + `</table></td></tr></table></td></tr>`;
  };
  const vendorBody = v.totalActions === 0
    ? `<tr><td style="padding:0 20px 10px 20px;font-size:12.5px;color:#6b7280;${F}">No activity recorded ${p.kind === "daily" ? "today" : "this week"}.</td></tr>`
    : `<tr><td style="padding:0 20px 4px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">` + v.blocks.map(card).join("") + `</table></td></tr>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="border-collapse:collapse;background-color:#ffffff;border:1px solid #d8dee9;${F}">`
    + header + kpiStrip + clRows + vendorHead + vendorBody
    + `<tr><td style="padding:4px 20px 16px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${B};padding:9px 22px;font-size:12.5px;font-weight:bold;${F}"><a href="${esc(p.appUrl)}" style="color:#ffffff;text-decoration:none;">Open DLP</a></td></tr></table></td></tr>`
    + bar(3)
    + `<tr><td style="padding:10px 20px;font-size:10.5px;color:#9ca3af;${F}">Automated update &#183; FIN04 &#183; atnorth Koski &#183; Quantum Mission Critical</td></tr>`
    + `</table>`;
}
function tile(v: string, l: string, vColor: string, accent: string) {
  return `<td width="25%" align="center" style="padding:10px 6px 8px 6px;border-top:3px solid ${accent};background-color:#F8FAFD;"><span style="font-size:22px;font-weight:bold;color:${vColor};${F}">${esc(v)}</span><br><span style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;${F}">${esc(l)}</span></td>`;
}

// ---------- client scheduler support (REV95) ----------
// Every due boundary within the lookback window, oldest first: daily at 17:00 except Friday,
// weekly at Friday 16:00. The catch-up sweep sends any unclaimed boundary late rather than
// losing it; beyond the lookback a missed digest is gone, by accepted design.
export function dueBoundaries(now: Date, lookbackH = 72): { kind: "daily" | "weekly"; due: Date }[] {
  const out: { kind: "daily" | "weekly"; due: Date }[] = [];
  const floor = now.getTime() - lookbackH * 3600000;
  for (let off = Math.ceil(lookbackH / 24) + 1; off >= 0; off--) {
    const probe = helParts(new Date(now.getTime() - off * 86400000));
    const isFri = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", weekday: "short" }).format(utcForHelsinki(probe.y, probe.m, probe.d, 12)) === "Fri";
    const due = utcForHelsinki(probe.y, probe.m, probe.d, isFri ? 16 : 17, 0);
    if (due.getTime() >= floor && due.getTime() <= now.getTime()) out.push({ kind: isFri ? "weekly" : "daily", due });
  }
  out.sort((a, b) => a.due.getTime() - b.due.getTime());
  return out;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function dateLineFor(kind: "daily" | "weekly", win: { start: Date; end: Date }): string {
  const s = helParts(win.start), e = helParts(win.end);
  return kind === "daily"
    ? `${e.wd} ${e.d} ${MONTHS[e.m - 1]} ${e.y} \u00b7 to ${String(e.hh).padStart(2, "0")}:00 Europe/Helsinki`
    : `${s.wd} ${s.d} ${MONTHS[s.m - 1]} to ${e.wd} ${e.d} ${MONTHS[e.m - 1]} ${e.y} \u00b7 sent Friday 16:00 Europe/Helsinki`;
}
export function subjectLabelFor(kind: "daily" | "weekly", win: { start: Date; end: Date }): string {
  const e = helParts(win.end);
  return kind === "daily" ? `${e.wd} ${e.d} ${MONTHS[e.m - 1]}` : `week ending ${e.d} ${MONTHS[e.m - 1]}`;
}
// Adapter: the app's camelCase activities to the snake rows the KPI replica expects.
export function actRowsFromClient(acts: any[]): ActRow[] {
  return (acts || []).map((a) => ({
    start_date: a.start || null, duration: a.duration || 1, committed: !!a.committed, status: a.status || null,
    actual_finish: a.actualFinish || null, actual_start: a.actualStart || null,
    constraints: Array.isArray(a.constraints) ? a.constraints : [],
    witness_invite: !!a.witnessInvite, outcome: a.outcome || null, outcome_at: a.outcomeAt || null,
  }));
}
