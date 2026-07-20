import { supabase } from "./supabaseClient";
import { coerceIsoDate } from "./accReconcile";   // REV320: strict date coercion, shared with the parser

// ---- field mapping (db row <-> client activity) ----
const fromActivity = (r) => ({
  id: r.id, desc: r.descr || "", companyId: r.company_id || "", area: r.area || "", system: r.system || "",
  level: r.level || "L2", isMilestone: !!r.is_milestone, start: r.start_date || "", duration: r.duration || 1,
  // Milestones are binary (Planned / Complete); any legacy in_progress row is coerced at load
  committed: !!r.committed, status: (r.is_milestone && r.status === "in_progress") ? "planned" : (r.status || "planned"), actualStart: r.actual_start || "", actualFinish: r.actual_finish || "", percent: (r.percent == null ? null : Number(r.percent)),
  outcome: r.outcome || "pending", outcomeReason: r.outcome_reason || "", outcomeNotes: r.outcome_notes || "", outcomeAt: r.outcome_at || "", retestOf: r.retest_of || null,
  subArea: r.sub_area || "", tier3: r.tier3 || "", asset: r.asset || "", discipline: (r.discipline ? String(r.discipline).split(/\s*;\s*/).filter(Boolean) : []), witnessInvite: !!r.witness_invite, witnessType: r.witness_type || "", witnessAt: r.witness_at || "", witnessDurationMin: (r.witness_duration_min == null ? 60 : Number(r.witness_duration_min)), witnessDays: (r.witness_days == null ? 1 : Math.max(1, Number(r.witness_days))), witnessSentAt: r.witness_sent_at || "", crew: (r.crew ? String(r.crew).split(/\s*;\s*/).filter(Boolean) : []), estHours: (r.est_hours == null ? "" : Number(r.est_hours)), notes: r.notes || "", slipReason: r.slip_reason || "", accUrl: r.acc_url || "", fokRef: r.fok_ref || "", assigneeEmail: r.assignee_email || "",
  code: r.code ?? null, predecessors: Array.isArray(r.predecessors) ? r.predecessors : [],
  constraints: Array.isArray(r.constraints) ? r.constraints : [],
  reschedules: Array.isArray(r.reschedules) ? r.reschedules : [],
  witnessEvents: Array.isArray(r.witness_events) ? r.witness_events : [],
});
const toActivity = (a, session, isNew) => {
  const row = {
    id: a.id, descr: a.desc || "", company_id: a.companyId || null, area: a.area || null, system: a.system || null,
    level: a.level, is_milestone: !!a.isMilestone, start_date: a.start || null, duration: a.duration || 1,
    committed: !!a.committed, status: a.status, actual_start: a.actualStart || null, actual_finish: a.actualFinish || null, percent: (a.percent == null || a.percent === "" ? null : Math.max(0, Math.min(100, Math.round(Number(a.percent))))),
    outcome: a.outcome || "pending", outcome_reason: a.outcomeReason || null, outcome_notes: a.outcomeNotes || null, outcome_at: a.outcomeAt || null, retest_of: a.retestOf || null,
    sub_area: a.subArea || null, tier3: a.tier3 || null, asset: a.asset || null, discipline: (Array.isArray(a.discipline) ? a.discipline.join("; ") : (a.discipline || "")) || null, witness_invite: !!a.witnessInvite, witness_type: a.witnessType || null, witness_at: a.witnessAt || null, witness_duration_min: (a.witnessDurationMin == null ? 60 : a.witnessDurationMin), witness_days: (a.witnessDays == null ? 1 : Math.max(1, a.witnessDays)), witness_sent_at: a.witnessSentAt || null, crew: (Array.isArray(a.crew) ? a.crew.join("; ") : (a.crew || "")) || null, est_hours: (a.estHours === "" || a.estHours == null ? null : Number(a.estHours)), notes: a.notes || null, slip_reason: a.slipReason || null, acc_url: a.accUrl || null, fok_ref: a.fokRef || null, assignee_email: a.assigneeEmail || null,
    code: isNew ? null : (a.code ?? null), predecessors: a.predecessors || [],
    constraints: a.constraints || [], reschedules: a.reschedules || [], witness_events: a.witnessEvents || [], updated_by: session.user.id, updated_at: new Date().toISOString(),
  };
  if (isNew) row.created_by = session.user.id;
  return row;
};

// ---- invite requests (atnorth asks to be forwarded an activity invite) ----
const fromInviteRequest = (r) => ({
  id: r.id, activityId: r.activity_id, requesterId: r.requester_id,
  requesterName: r.requester_name || "", requesterEmail: r.requester_email || "",
  desc: r.activity_desc || "", code: (r.activity_code == null ? "" : String(r.activity_code)), location: r.location || "",
  status: r.status || "pending", createdAt: r.created_at,
  decidedByName: r.decided_by_name || "", decidedAt: r.decided_at || null,
});

// ---- load everything into the client state shape ----
export async function loadAll(session, projectId, projectName) {
  const [companies, areas, systems, crews, levels, settings, profiles, activities, audit, branding, subAreas, tier3s, inviteReqs, privRows, projMeta, inviteTypes] = await Promise.all([
    supabase.from("companies").select("*").order("name"),
    supabase.from("areas").select("*").eq("project_id", projectId).order("name"),
    supabase.from("systems").select("*").eq("project_id", projectId).order("name"),
    supabase.from("crews").select("*").eq("project_id", projectId).order("name"),
    supabase.from("levels").select("*").eq("project_id", projectId).order("sort"),
    supabase.from("settings").select("*").eq("project_id", projectId).maybeSingle(),
    supabase.from("profiles").select("*").order("name"),
    supabase.from("activities").select("*").eq("project_id", projectId),
    supabase.from("audit_log").select("*").or("project_id.eq." + projectId + ",project_id.is.null").order("ts", { ascending: false }).limit(500),
    supabase.from("branding").select("*").eq("project_id", projectId).maybeSingle(),
    supabase.from("sub_areas").select("*").eq("project_id", projectId).order("name"),
    supabase.from("tier3_areas").select("*").eq("project_id", projectId).order("name"),
    supabase.from("invite_requests").select("*").eq("project_id", projectId),
    supabase.from("user_privileges").select("*").eq("project_id", projectId),
    supabase.from("projects").select("id, code, name, client, location").eq("id", projectId).maybeSingle(),
    supabase.from("invite_types").select("*").eq("project_id", projectId).order("name"),
  ]);
  // REV216 (3d): the project's associated companies drive pickers; null = association data
  // unavailable (pickers fall back to the full registry rather than going blank).
  let projectCompanyIds = null;
  try { const pc = await supabase.from("project_companies").select("company_id").eq("project_id", projectId); if (!pc.error) projectCompanyIds = (pc.data || []).map((r) => r.company_id); } catch (e) {}

  const loadErrors = [["companies", companies], ["areas", areas], ["systems", systems], ["crews", crews], ["levels", levels], ["settings", settings], ["profiles", profiles], ["activities", activities], ["audit_log", audit], ["branding", branding], ["sub_areas", subAreas], ["tier3_areas", tier3s], ["invite_requests", inviteReqs], ["user_privileges", privRows], ["invite_types", inviteTypes]].filter(([, r]) => r && r.error).map(([t, r]) => t + ": " + (r.error.message || String(r.error)));
  if (loadErrors.length) console.error("DLP load errors:", loadErrors);
  const levelsObj = {};
  (levels.data || []).forEach((l) => { levelsObj[l.key] = { name: l.name, color: l.color, sort: l.sort }; });
  return {
    projectCompanyIds,
    companies: (companies.data || []).map((c) => ({ id: c.id, name: c.name, logoUrl: c.logo_url || "", logoDark: c.logo_url_dark || "", description: c.description || "", domain: c.domain || "" })),
    areas: (areas.data || []).map((a) => a.name),
    systems: (systems.data || []).map((s) => s.name),
    inviteTypes: (inviteTypes.data || []).map((s) => s.name),
    crews: (crews.data || []).map((c) => c.name),
    levels: levelsObj,
    settings: { weeks: settings.data?.weeks ?? 4, makeReadyDays: settings.data?.make_ready_days ?? 7, workingDays: settings.data?.working_days ?? [1, 2, 3, 4, 5], hoursPerDay: settings.data?.hours_per_day ?? 8, ppcTarget: settings.data?.ppc_target ?? 80, benchmarksVisible: settings.data?.benchmarks_visible ?? false, crewsEnabled: settings.data?.crews_enabled ?? false, pageIcons: settings.data?.page_icons ?? {}, design: settings.data?.design ?? {}, inviteAttendees: settings.data?.invite_attendees ?? {} },
    users: (profiles.data || []).map((p) => ({ id: p.id, name: p.name, role: p.role, companyId: p.company_id, platformRole: p.platform_role || "user", mustReset: !!p.must_reset })),
    loadErrors,
    activities: (activities.data || []).map(fromActivity),
    audit: (audit.data || []).map((e) => ({ id: e.id, ts: e.ts, user: e.user_name, action: e.action, detail: e.detail, entity: e.entity, entityId: e.entity_id })),
    brand: brandFrom(branding.data, projectName),
    projectMeta: (projMeta && projMeta.data) ? { code: projMeta.data.code || "", name: projMeta.data.name || "", client: projMeta.data.client || "", location: projMeta.data.location || "" } : null,
    subAreas: (subAreas.data || []).map((s) => ({ area: s.area, name: s.name })),
    tier3s: (tier3s.data || []).map((t) => ({ area: t.area, subArea: t.sub_area, name: t.name })),
    inviteRequests: (inviteReqs.data || []).map(fromInviteRequest),
    privileges: (privRows.data || []).map((r) => ({ userId: r.user_id, key: r.priv_key, granted: !!r.granted })),
  };
}

// The projects this user can see (RLS returns only their memberships; supers see all),
// with the user's role per project and a light activity-stat summary for the portal.
export async function loadProjects(session) {
  const me = session?.user?.id;
  const [prof, projRes, memRes, statRes, auditRes] = await Promise.all([
    supabase.from("profiles").select("name, platform_role").eq("id", me).maybeSingle(),
    supabase.from("projects").select("*").order("name"),
    supabase.from("project_members").select("project_id, role").eq("user_id", me),
    supabase.from("activities").select("id, project_id, status, start_date, duration"),
    supabase.from("audit_log").select("ts, user_name, action, entity, entity_id, detail").order("ts", { ascending: false }).limit(80),
  ]);
  const platformRole = prof.data?.platform_role || "user";
  const isSuper = platformRole === "super" || platformRole === "owner";
  const userName = prof.data?.name || (session?.user?.email || "");
  const roleByProj = {};
  (memRes.data || []).forEach((m) => { roleByProj[m.project_id] = m.role; });
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const stat = {}; const actToProj = {};
  (statRes.data || []).forEach((a) => {
    actToProj[a.id] = a.project_id;
    const s = stat[a.project_id] || (stat[a.project_id] = { total: 0, complete: 0, overdue: 0, inProgress: 0 });
    s.total++;
    if (a.status === "complete") { s.complete++; return; }
    if (a.status === "in_progress") s.inProgress++;
    if (a.start_date) { const pf = new Date(a.start_date); pf.setDate(pf.getDate() + (a.duration || 1) - 1); if (pf.getTime() < todayMs) s.overdue++; }
  });
  const list = (projRes.data || []).map((p) => ({
    id: p.id, code: p.code, name: p.name, client: p.client || "", location: p.location || "",
    accent: p.accent || "#1E63D6", logoUrl: p.logo_url || "", logoDark: p.logo_url_dark || "",
    tagline: p.tagline || "", appName: p.app_name || "DLP",
    startDate: p.start_date || null, targetDate: p.target_date || null,
    status: p.status || "active",
    role: isSuper ? "admin" : (roleByProj[p.id] || "member"),
    stats: stat[p.id] || { total: 0, complete: 0, overdue: 0, inProgress: 0 },
  }));
  const codeByProj = {}; list.forEach((p) => { codeByProj[p.id] = p.code; });
  // Feed: only real activity events, summarised, latest-per-activity, tagged by project.
  // Config / backend changes (entity is a table name) are deliberately excluded.
  const verb = {
    "Added activity": "added", "Edited activity": "updated", "Removed activity": "removed",
    "Completed activity": "completed", "Committed activity": "committed", "Started activity": "started",
    "Rescheduled activity": "rescheduled", "Cleared a constraint on": "cleared a constraint on",
    "Create activity": "added", "Edit activity": "updated", "Delete activity": "removed",
  };
  const seen = new Set(); const activity = [];
  for (const e of (auditRes.data || [])) {
    if (e.entity !== "activity") continue;            // drop config / backend rows
    const key = e.entity_id + "|" + e.action;          // keep distinct event types per activity
    if (seen.has(key)) continue;
    seen.add(key);
    activity.push({ user: e.user_name || "Someone", verb: verb[e.action] || "updated", name: (e.detail || "").trim().slice(0, 52), code: codeByProj[actToProj[e.entity_id]] || "", ts: e.ts, projId: actToProj[e.entity_id] || null, actId: e.entity_id });
    if (activity.length >= 6) break;
  }
  return { isSuper, platformRole, userName, list, activity };
}

// Read-only overview for the "Inside a project" page. Reuses loadAll so it sees
// exactly what the board sees (same RLS, same project scope), then flattens to
// the fields the swimlane needs, grouped later by company / level / zone.
export async function loadProjectOverview(session, projectId, projectName) {
  const S = await loadAll(session, projectId, projectName);
  const coName = {}; (S.companies || []).forEach((c) => { coName[c.id] = c.name; });
  const lvl = S.levels || {};
  return (S.activities || []).map((a) => ({
    id: a.id,
    label: ((a.code != null ? String(a.code) : "").trim() || (a.desc || "").trim() || "Activity"),
    company: coName[a.companyId] || "Unassigned",
    level: (lvl[a.level] && lvl[a.level].name) || a.level || "No level",
    zone: (a.area || "").trim() || "No zone",
    start: a.start || null,
    dur: Math.max(1, a.duration || 1),
    status: a.status || "planned",
    committed: !!a.committed,
    milestone: !!a.isMilestone,
  }));
}

// Super: create a new project and make the creator its admin.
export async function createProject(fields, session) {
  const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : ("p" + Date.now());
  const { error } = await supabase.from("projects").insert({
    id, code: fields.code, name: fields.name, client: fields.client || null,
    location: fields.location || null, accent: fields.accent || "#1E63D6",
    start_date: fields.startDate || null, target_date: fields.targetDate || null,
    status: "active", created_by: session?.user?.id || null,
  });
  if (error) throw error;
  const { error: mErr } = await supabase.from("project_members").insert({ project_id: id, user_id: session.user.id, role: "admin", added_by: session.user.id });
  if (mErr) throw mErr;
  if (fields.copyFrom) {
    const src = fields.copyFrom;
    const [lv, sy, ar, sa, t3, it] = await Promise.all([
      supabase.from("levels").select("key,name,color,sort").eq("project_id", src),
      supabase.from("systems").select("name").eq("project_id", src),
      supabase.from("areas").select("name").eq("project_id", src),
      supabase.from("sub_areas").select("area,name").eq("project_id", src),
      supabase.from("tier3_areas").select("area,sub_area,name").eq("project_id", src),
      supabase.from("invite_types").select("name").eq("project_id", src),
    ]);
    const ops = [];
    if (lv.data?.length) ops.push(supabase.from("levels").insert(lv.data.map((r) => ({ ...r, project_id: id }))));
    if (sy.data?.length) ops.push(supabase.from("systems").insert(sy.data.map((r) => ({ ...r, project_id: id }))));
    if (ar.data?.length) ops.push(supabase.from("areas").insert(ar.data.map((r) => ({ ...r, project_id: id }))));
    if (sa.data?.length) ops.push(supabase.from("sub_areas").insert(sa.data.map((r) => ({ ...r, project_id: id }))));
    if (t3.data?.length) ops.push(supabase.from("tier3_areas").insert(t3.data.map((r) => ({ ...r, project_id: id }))));
    if (it.data?.length) ops.push(supabase.from("invite_types").insert(it.data.map((r) => ({ ...r, project_id: id }))));
    await Promise.all(ops);
  }
  return id;
}

const brandFrom = (d, projectName) => ({
  projectName: d?.project_name ?? projectName ?? "FIN04",
  appName: d?.app_name ?? "DLP",
  tagline: d?.tagline ?? "Collaborative Digital Planning",
  logoUrl: d?.logo_url ?? null,
  logoDark: d?.logo_url_dark ?? null,
});

// Set the browser tab title and favicon from branding. Also registers the current
// project name so modules outside App (exports, email subjects, witness routing)
// can brand themselves without threading a prop through every layer (REV264).
let CURRENT_PROJECT_NAME = "FIN04";
export const projName = () => CURRENT_PROJECT_NAME;

// REV321: per-project invite attendee matrices for the "Copy from another project" picker in
// the Invite Attendees editor. RLS on settings restricts reads to projects the caller can see,
// so a plain project admin gets only their own and owner/super see all; the caller also gates
// the cross-project sources to owner/super. Returns [{ projectId, code, name, matrix }].
export async function loadInviteMatrices() {
  const [sRes, pRes] = await Promise.all([
    supabase.from("settings").select("project_id, invite_attendees"),
    supabase.from("projects").select("id, code, name"),
  ]);
  if (sRes.error) return { error: sRes.error.message };
  const byId = new Map((pRes.data || []).map((p) => [p.id, p]));
  return (sRes.data || []).map((r) => {
    const p = byId.get(r.project_id) || {};
    return { projectId: r.project_id, code: p.code || "", name: p.name || "", matrix: r.invite_attendees || {} };
  });
}
export function applyBrandToTab(brand) {
  if (!brand) return;
  CURRENT_PROJECT_NAME = brand.projectName || "FIN04";
  document.title = `${brand.projectName || "FIN04"} ${brand.appName || "DLP"}`.trim();
}

// ---- diff one state object against the next and push only the changes ----
export async function syncCollections(prev, next, session, projectId) {
  const ops = [];
  // activities (keyed by id)
  if (next.activities !== prev.activities) {
    const pm = Object.fromEntries(prev.activities.map((a) => [a.id, a]));
    const nm = Object.fromEntries(next.activities.map((a) => [a.id, a]));
    const ups = [];
    next.activities.forEach((a) => { if (!pm[a.id] || JSON.stringify(pm[a.id]) !== JSON.stringify(a)) ups.push({ ...toActivity(a, session, !pm[a.id]), project_id: projectId }); });
    const del = prev.activities.filter((a) => !nm[a.id]).map((a) => a.id);
    if (ups.length) ops.push(supabase.from("activities").upsert(ups));
    if (del.length) ops.push(supabase.from("activities").delete().in("id", del));
  }
  // companies (keyed by id) - global shared directory, not project-scoped
  if (next.companies !== prev.companies) {
    const nm = Object.fromEntries(next.companies.map((c) => [c.id, c]));
    const pm = Object.fromEntries(prev.companies.map((c) => [c.id, c]));
    const ups = next.companies.filter((c) => !pm[c.id] || pm[c.id].name !== c.name || (pm[c.id].logoUrl || "") !== (c.logoUrl || "") || (pm[c.id].logoDark || "") !== (c.logoDark || "") || (pm[c.id].description || "") !== (c.description || "")).map((c) => ({ id: c.id, name: c.name, logo_url: c.logoUrl || null, logo_url_dark: c.logoDark || null, description: c.description || null }));
    const del = prev.companies.filter((c) => !nm[c.id]).map((c) => c.id);
    if (ups.length) ops.push(supabase.from("companies").upsert(ups));
    // REV192: companies are a global directory shared by every project. A state
    // diff may delete AT MOST ONE company (the deliberate Manage-button path);
    // any bulk delete is suppressed, because this single line once converted a
    // FIN3021 import into a global directory wipe across all projects.
    if (del.length === 1) ops.push(supabase.from("companies").delete().in("id", del));
    else if (del.length > 1) console.warn(`[DLP] bulk company delete suppressed (${del.length} ids):`, del);
  }
  // areas / systems (string arrays keyed by name, per project)
  for (const [key, table] of [["areas", "areas"], ["systems", "systems"], ["crews", "crews"], ["inviteTypes", "invite_types"]]) {
    if (next[key] !== prev[key] && Array.isArray(next[key]) && Array.isArray(prev[key])) {
      const add = next[key].filter((x) => !prev[key].includes(x)).map((name) => ({ name, project_id: projectId }));
      const rem = prev[key].filter((x) => !next[key].includes(x));
      if (add.length) ops.push(supabase.from(table).upsert(add));
      if (rem.length) ops.push(supabase.from(table).delete().eq("project_id", projectId).in("name", rem));
    }
  }
  // levels (object keyed by L1.., per project)
  if (next.levels !== prev.levels) {
    const ups = Object.entries(next.levels)
      .filter(([k, v]) => !prev.levels[k] || prev.levels[k].name !== v.name || prev.levels[k].color !== v.color)
      .map(([k, v], i) => ({ key: k, name: v.name, color: v.color, sort: v.sort ?? i, project_id: projectId }));
    if (ups.length) ops.push(supabase.from("levels").upsert(ups));
    const rem = Object.keys(prev.levels).filter((k) => !next.levels[k]);
    if (rem.length) ops.push(supabase.from("levels").delete().eq("project_id", projectId).in("key", rem));
  }
  // sub-areas (keyed by area+name, per project)
  if (next.subAreas !== prev.subAreas) {
    const k = (s) => s.area + "\u0001" + s.name;
    const pset = new Set((prev.subAreas || []).map(k));
    const nset = new Set((next.subAreas || []).map(k));
    const add = (next.subAreas || []).filter((s) => !pset.has(k(s))).map((s) => ({ area: s.area, name: s.name, project_id: projectId }));
    const rem = (prev.subAreas || []).filter((s) => !nset.has(k(s)));
    if (add.length) ops.push(supabase.from("sub_areas").upsert(add));
    rem.forEach((s) => ops.push(supabase.from("sub_areas").delete().match({ area: s.area, name: s.name, project_id: projectId })));
  }
  // tier 3 areas (keyed by area+sub+name, per project)
  if (next.tier3s !== prev.tier3s) {
    const k = (t) => t.area + "\u0001" + t.subArea + "\u0001" + t.name;
    const pset = new Set((prev.tier3s || []).map(k));
    const nset = new Set((next.tier3s || []).map(k));
    const add = (next.tier3s || []).filter((t) => !pset.has(k(t))).map((t) => ({ area: t.area, sub_area: t.subArea, name: t.name, project_id: projectId }));
    const rem = (prev.tier3s || []).filter((t) => !nset.has(k(t)));
    if (add.length) ops.push(supabase.from("tier3_areas").upsert(add));
    rem.forEach((t) => ops.push(supabase.from("tier3_areas").delete().match({ area: t.area, sub_area: t.subArea, name: t.name, project_id: projectId })));
  }
  // settings (one row per project)
  if (next.settings !== prev.settings) {
    ops.push(supabase.from("settings").update({ weeks: next.settings.weeks, make_ready_days: next.settings.makeReadyDays, working_days: next.settings.workingDays ?? [1, 2, 3, 4, 5], hours_per_day: next.settings.hoursPerDay ?? 8, ppc_target: next.settings.ppcTarget ?? 80, benchmarks_visible: !!next.settings.benchmarksVisible, crews_enabled: !!next.settings.crewsEnabled, page_icons: next.settings.pageIcons ?? {}, design: next.settings.design ?? {}, invite_attendees: next.settings.inviteAttendees ?? {} }).eq("project_id", projectId));
  }
  const results = await Promise.all(ops);
  const err = results.find((r) => r && r.error);
  if (err) console.error("Sync error:", err.error);
  return err ? err.error : null;
}

// ---- admin user management via the edge function ----
export async function userOp(body) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    let msg = error.message || String(error);
    try { if (error.context && typeof error.context.json === "function") { const b = await error.context.json(); if (b && b.error) msg = b.error; } } catch (e) {}
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

// Claim a setup link: set the chosen password for the user the token belongs to.
// No session required; the token is the credential. Returns { ok, email }.
export async function claimInvite(token, password) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body: { op: "claiminvite", token, password } });
  if (error) {
    let msg = error.message || String(error);
    try { if (error.context && typeof error.context.json === "function") { const b = await error.context.json(); if (b && b.error) msg = b.error; } } catch (e) {}
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

// Admin: auth metadata (last sign-in) keyed by user id, to show accepted/pending + last seen.
export async function fetchUserStatus() {
  const data = await userOp({ op: "status" });
  const map = {};
  (data.users || []).forEach((u) => { map[u.id] = u; });
  return map;
}

export async function fetchAudit(projectId) {
  let q = supabase.from("audit_log").select("*");
  if (projectId) q = q.or("project_id.eq." + projectId + ",project_id.is.null");
  const { data } = await q.order("ts", { ascending: false }).limit(500);
  return (data || []).map((e) => ({ id: e.id, ts: e.ts, user: e.user_name, action: e.action, detail: e.detail }));
}

export async function signOut() { await supabase.auth.signOut(); }

// ---- access requests (self-service join) ----
// Submit a request from the login screen. No session: the table allows an
// anonymous insert only, and grants no read, so the queue stays admin-only.
export async function submitAccessRequest({ name, email, organisation, note }) {
  const payload = {
    name: (name || "").trim(),
    email: (email || "").trim().toLowerCase(),
    organisation: (organisation || "").trim(),
    note: (note || "").trim(),
  };
  if (!payload.email) throw new Error("Email required.");
  const { error } = await supabase.from("access_requests").insert(payload);
  if (error) throw error;
  return { ok: true };
}

// Admin: read the request queue (RLS restricts this to admins).
export async function fetchAccessRequests() {
  const { data, error } = await supabase.from("access_requests").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) return [];
  return (data || []).map((r) => ({
    id: r.id, name: r.name || "", email: r.email || "", organisation: r.organisation || "", note: r.note || "",
    status: r.status || "pending", createdAt: r.created_at, decidedByName: r.decided_by_name || "", decidedAt: r.decided_at || null, decisionNote: r.decision_note || "",
  }));
}

export async function decideAccessRequest(id, patch) {
  const { error } = await supabase.from("access_requests").update(patch).eq("id", id);
  if (error) throw error;
}

// ---- invite requests (atnorth viewer asks an admin to forward an activity invite) ----
// Insert is gated by RLS to the project client's own company; status starts pending.
export async function submitInviteRequest({ projectId, activity, requesterId, requesterName, requesterEmail, location }) {
  const row = {
    project_id: projectId,
    activity_id: activity.id,
    requester_id: requesterId,
    requester_name: (requesterName || "").trim(),
    requester_email: (requesterEmail || "").trim().toLowerCase(),
    activity_desc: (activity.desc || "").slice(0, 200),
    activity_code: (activity.code == null ? null : String(activity.code)),
    location: location || "",
    status: "pending",
  };
  const { data, error } = await supabase.from("invite_requests").insert(row).select("*").single();
  if (error) throw error;
  return fromInviteRequest(data);
}

// Admin marks a request forwarded (a pure tracking stamp; no invite is sent from here).
export async function decideInviteRequest(id, patch) {
  const { error } = await supabase.from("invite_requests").update(patch).eq("id", id);
  if (error) throw error;
}

export function subscribeAccessRequests(onChange) {
  let t; const debounced = () => { clearTimeout(t); t = setTimeout(onChange, 250); };
  return supabase.channel("fin04-access-requests")
    .on("postgres_changes", { event: "*", schema: "public", table: "access_requests" }, debounced)
    .subscribe();
}

// Admin: create a company directly (used by the approve flow, which needs the
// new id immediately). Optionally stamp the email domain so future requests match.
export async function createCompany(name, domain) {
  const row = { name: (name || "").trim() };
  if (domain) row.domain = domain.toLowerCase();
  const { data, error } = await supabase.from("companies").insert(row).select("id,name,domain").single();
  if (error) throw error;
  return { id: data.id, name: data.name, domain: data.domain || "" };
}

export async function setCompanyDomain(id, domain) {
  const { error } = await supabase.from("companies").update({ domain: domain ? domain.toLowerCase() : null }).eq("id", id);
  if (error) throw error;
}

// Logged-in user changes their own password.
export async function changePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// ---- branding ----
// Read branding without a session (the login screen calls this).
export async function fetchBranding() {
  const { data } = await supabase.from("branding").select("*").eq("id", 1).maybeSingle();
  return brandFrom(data);
}

export const FIN04_PROJECT = "f1040000-0000-4000-a000-000000000001";

// Admin: save name / tagline for a project. patch keys are db column names.
// REV114: previously a plain .update(), which matched zero rows on any project whose
// branding row was never seeded (every project created through the hub) and reported
// no error, so the save silently did nothing. Now: update, and if nothing matched,
// insert the row with the patch aboard. The hub-REV114 migration backfills existing
// projects and seeds future ones by trigger, so the insert here is a safety net.
export async function updateBranding(patch, projectId) {
  const pid = projectId || FIN04_PROJECT;
  const { data, error } = await supabase.from("branding").update(patch).eq("project_id", pid).select("project_id");
  if (error) throw error;
  if (!data || data.length === 0) {
    const row = { project_id: pid, project_name: patch.project_name || "Project", app_name: patch.app_name || "DLP", ...patch };
    const ins = await supabase.from("branding").insert(row);
    if (ins.error) throw ins.error;
  }
}

// Super / owner: edit a project's hub details. fields uses the portal's camelCase names.
export async function updateProject(id, fields) {
  const patch = {};
  if (fields.name != null) patch.name = fields.name.trim();
  if (fields.code != null) patch.code = fields.code.trim();
  if (fields.client !== undefined) patch.client = fields.client || null;
  if (fields.location !== undefined) patch.location = fields.location || null;
  if (fields.accent != null) patch.accent = fields.accent;
  if (fields.startDate !== undefined) patch.start_date = fields.startDate || null;
  if (fields.targetDate !== undefined) patch.target_date = fields.targetDate || null;
  if (fields.status != null) patch.status = fields.status;
  const { data, error } = await supabase.from("projects").update(patch).eq("id", id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Nothing was saved. Your account may not have permission to edit projects (owner and platform supers only), or the hub-REV114 SQL migration has not been run.");
}

// Portfolio analytics (owner / super hub page). One pass over every visible activity.
// PPC per project mirrors the in-app sidebar formula exactly (REV106 semantics):
// denominator = committed activities whose promised finish (start + duration - 1) is
// before today; numerator = those complete with actual finish on or before the promise.
// Status buckets are disjoint: complete, overdue, in progress, then open (planned or
// committed, not yet due). Company rows use the shared global directory.
export async function loadPortfolioAnalytics() {
  const [actRes, coRes, tgRes] = await Promise.all([
    supabase.from("activities").select("project_id, status, committed, start_date, duration, actual_finish, company_id"),
    supabase.from("companies").select("id, name"),
    supabase.from("settings").select("project_id, ppc_target"),
  ]);
  if (actRes.error) throw actRes.error;
  const coNames = {}; (coRes.data || []).forEach((c) => { coNames[c.id] = c.name; });
  const t = new Date(); t.setHours(0, 0, 0, 0); const today = t.getTime();
  const finOf = (a) => { if (!a.start_date) return null; const d = new Date(a.start_date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + Math.max(0, (a.duration || 1) - 1)); return d.getTime(); };
  const perProj = {}; const perCo = {};
  (actRes.data || []).forEach((a) => {
    const p = perProj[a.project_id] || (perProj[a.project_id] = { total: 0, complete: 0, inProgress: 0, overdue: 0, open: 0, committedOpen: 0, ppcDen: 0, ppcNum: 0 });
    p.total++;
    const fin = finOf(a);
    const done = a.status === "complete";
    if (done) p.complete++;
    else if (fin != null && fin < today) p.overdue++;
    else if (a.status === "in_progress") p.inProgress++;
    else p.open++;
    if (!done && a.committed) p.committedOpen++;
    if (a.committed && a.start_date && fin != null && fin < today) {
      p.ppcDen++;
      const af = a.actual_finish ? (() => { const d = new Date(a.actual_finish); d.setHours(0, 0, 0, 0); return d.getTime(); })() : null;
      if (done && (af == null || af <= fin)) p.ppcNum++;
    }
    if (a.company_id) {
      const c = perCo[a.company_id] || (perCo[a.company_id] = { name: coNames[a.company_id] || "Unknown", total: 0, complete: 0 });
      c.total++; if (done) c.complete++;
    }
  });
  Object.values(perProj).forEach((p) => { p.ppc = p.ppcDen ? Math.round(p.ppcNum / p.ppcDen * 100) : null; });
  const companies = Object.values(perCo).sort((x, y) => y.total - x.total || x.name.localeCompare(y.name));
  // REV223: each project's own PPC target rides along for the comparison table.
  // A failed or empty settings read degrades to the 80 default, never blocks analytics.
  const targets = {};
  (((tgRes && !tgRes.error && tgRes.data) || [])).forEach((r) => { if (r.ppc_target != null) targets[r.project_id] = r.ppc_target; });
  return { perProj, companies, targets };
}

// Admin: upload a customer logo file, return its public URL, and store it (light or dark slot).
export async function uploadLogo(file, dark = false, projectId) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `logo-${dark ? "dark-" : ""}${Date.now()}.${ext}`;
  const up = await supabase.storage.from("branding").upload(path, file, { upsert: true, cacheControl: "3600" });
  if (up.error) throw up.error;
  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  const url = data.publicUrl;
  await updateBranding({ [dark ? "logo_url_dark" : "logo_url"]: url }, projectId);
  return url;
}

// Admin: upload a per-company logo, return its public URL (caller stores it on the company).
export async function uploadCompanyLogo(file, companyId) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `company-${companyId}-${Date.now()}.${ext}`;
  const up = await supabase.storage.from("branding").upload(path, file, { upsert: true, cacheControl: "3600" });
  if (up.error) throw up.error;
  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  return data.publicUrl;
}

// REV191: realtime scoped to the open project. Project-scoped tables trigger a
// reload only when the changed row belongs to this project; global tables always
// do. Audit, snapshots, presence and digest claims are ignored here because each
// either accompanies a primary data change that fires its own scoped event, or
// (presence) is polled on its own 30s interval; reloading everyone for them was
// pure churn. DELETE payloads carry only the primary key, so a delete on a
// project table reloads conservatively (project_id unknowable without replica
// identity full). Unknown table shapes also reload conservatively.
const RT_IGNORE = new Set(["presence", "report_runs", "audit_log", "activity_snapshots"]);
const RT_GLOBAL = new Set(["companies", "profiles", "projects", "project_members", "user_privileges", "invite_requests", "access_requests", "branding"]);
export function subscribeAll(onChange, getProjectId) {
  let t;
  const debounced = () => { clearTimeout(t); t = setTimeout(onChange, 250); };
  return supabase
    .channel("fin04-all")
    .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
      try {
        const tbl = payload && payload.table;
        if (RT_IGNORE.has(tbl)) return;
        const pid = typeof getProjectId === "function" ? getProjectId() : getProjectId;
        if (!pid || RT_GLOBAL.has(tbl)) return debounced();
        const rec = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) || {};
        if (rec.project_id === undefined || rec.project_id === null) return debounced();
        if (rec.project_id === pid) debounced();
      } catch (e) { debounced(); }
    })
    .subscribe();
}

// ---- REV192: import fingerprints ----
export async function importFingerprint(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text || "")));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function checkImportFingerprint(projectId, hash) {
  const { data } = await supabase.from("import_fingerprints").select("ts, by_name, mode, row_count")
    .eq("project_id", projectId).eq("hash", hash).order("ts", { ascending: false }).limit(1);
  return (data && data[0]) || null;
}
export async function recordImportFingerprint(projectId, hash, rowCount, mode, byName) {
  // Best-effort: a failed fingerprint write must never block an import.
  try { await supabase.from("import_fingerprints").insert({ project_id: projectId, hash, row_count: rowCount || 0, mode: mode || "append", by_name: byName || "" }); } catch (e) { console.warn("[DLP] fingerprint record failed", e); }
}

// REV265: latest audit entry per user, for the rail presence popout. One indexed
// query per popout open; first-per-user picked client-side from the newest 300.
export async function loadLatestAuditByUser(projectId) {
  const q = supabase.from("audit_log").select("user_id,user_name,action,entity,entity_id,detail,ts").order("ts", { ascending: false }).limit(300);
  const { data, error } = await (projectId ? q.eq("project_id", projectId) : q);
  if (error) throw error;
  const m = {};
  (data || []).forEach((r) => { if (r.user_id && !m[r.user_id]) m[r.user_id] = r; });
  return m;
}

// ---- presence ("Latest online") ----
export async function heartbeat() {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data && data.session && data.session.user;
    if (!user) return;
    await supabase.from("presence").upsert({ user_id: user.id, last_seen: new Date().toISOString() }, { onConflict: "user_id" });
  } catch (e) { /* presence is best-effort */ }
}

export async function loadPresence() {
  try {
    const { data, error } = await supabase.from("presence").select("user_id,last_seen");
    if (error) return {};
    const m = {};
    (data || []).forEach((r) => { m[r.user_id] = r.last_seen; });
    return m;
  } catch (e) { return {}; }
}

// ---- audit revert: activity snapshots (admin-only via RLS on activity_snapshots) ----
export async function loadActivitySnapshots() {
  try {
    const { data, error } = await supabase.from("activity_snapshots").select("*").order("ts", { ascending: false }).limit(1000);
    if (error) return [];
    return data || [];
  } catch (e) { return []; }
}

// UPDATE: restore before_row wholesale. DELETE: re-insert before_row (same id keeps
// predecessor and retest links). INSERT: remove the created activity. Writes go through
// the normal activities table so the live audit trigger and the snapshot trigger both
// record the revert as a fresh entry; nothing is ever silently lost.
export async function applyAuditRevert(snap, byName) {
  let err = null;
  if (snap.op === "UPDATE" || snap.op === "DELETE") {
    const row = { ...(snap.before_row || {}) };
    if (!row.id) return "Snapshot has no before state";
    const { error } = await supabase.from("activities").upsert(row);
    err = error;
  } else if (snap.op === "INSERT") {
    const id = snap.after_row && snap.after_row.id;
    if (!id) return "Snapshot has no created row";
    const { error } = await supabase.from("activities").delete().eq("id", id);
    err = error;
  } else return "Unknown snapshot type";
  if (err) return err.message || "Revert failed";
  await supabase.from("activity_snapshots").update({ reverted_at: new Date().toISOString(), reverted_by: byName || "" }).eq("id", snap.id);
  return null;
}

// Full audit history for a single activity (admin-only; RLS enforces it).
export async function fetchActivityAudit(activityId) {
  try {
    const { data, error } = await supabase.from("audit_log").select("*")
      .eq("entity", "activity").eq("entity_id", String(activityId))
      .order("ts", { ascending: false }).limit(200);
    if (error) return [];
    return (data || []).map((e) => ({ id: e.id, ts: e.ts, user: e.user_name, action: e.action, detail: e.detail }));
  } catch (e) { return []; }
}

// ---- Entries Created report (admin, REV159): live activities by DB insert time (created_at),
// paginated past the PostgREST 1000-row cap. created_at is timestamptz default now(), so the
// window is always correct; created_by is only set on app inserts, so raw-SQL rows read null and
// the UI labels them Unattributed. Deleted rows are not returned (live table only, by design).
export async function fetchCreatedBetween(projectId, fromISO, toISO) {
  const out = []; const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from("activities")
      .select("*").eq("project_id", projectId)
      .gte("created_at", fromISO).lte("created_at", toISO)
      .order("created_at", { ascending: false })
      .range(from, from + page - 1);
    if (error) throw error;
    const batch = data || [];
    for (const r of batch) out.push({ ...fromActivity(r), createdAt: r.created_at, createdBy: r.created_by });
    if (batch.length < page) break;
  }
  return out;
}

// ---- Per-project membership (project_members) ----
export async function loadProjectMembers(projectId) {
  const { data, error } = await supabase.from("project_members").select("user_id, role").eq("project_id", projectId);
  if (error) throw error;
  return data || [];
}
export async function addMember(projectId, userId, role, addedBy) {
  const { error } = await supabase.from("project_members").insert({ project_id: projectId, user_id: userId, role: role || "member", added_by: addedBy || null });
  if (error) throw error;
}
export async function setMemberRole(projectId, userId, role) {
  const { error } = await supabase.from("project_members").update({ role }).eq("project_id", projectId).eq("user_id", userId);
  if (error) throw error;
}
export async function removeMember(projectId, userId) {
  const { error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId);
  if (error) throw error;
}

// ---- Address book helpers ----
// How many projects each visible person is a member of (supers see all; a
// project admin sees only the projects they administer).
// REV203: platform directory for the hub Global Settings scene. Project-independent:
// every profile and company plus the caller's own id, so the hub can mark "you" and gate
// self-actions. Status (email, last sign-in) comes separately via fetchUserStatus, counts
// via loadMembershipCounts. Note: unpaginated like loadAll's profile read; both need the
// paginated helper once the platform approaches Supabase's 1000-row cap.
export async function loadDirectory() {
  const me = await currentUserId();
  const [profiles, companies] = await Promise.all([
    supabase.from("profiles").select("*").order("name"),
    supabase.from("companies").select("*").order("name"),
  ]);
  if (profiles.error) throw profiles.error;
  if (companies.error) throw companies.error;
  return {
    meId: me,
    users: (profiles.data || []).map((p) => ({ id: p.id, name: p.name, role: p.role, companyId: p.company_id, platformRole: p.platform_role || "user", mustReset: !!p.must_reset })),
    companies: (companies.data || []).map((c) => ({ id: c.id, name: c.name, logoUrl: c.logo_url || "", logoDark: c.logo_url_dark || "", description: c.description || "", domain: c.domain || "" })),
  };
}

// REV209: Companies model readers and mutations for the hub Global Companies editor.
// loadProjectCompanyMap: company_id -> [project_id] from the Phase 3a association table.
export async function loadProjectCompanyMap() {
  const { data, error } = await supabase.from("project_companies").select("project_id, company_id");
  if (error) throw error;
  const m = {}; (data || []).forEach((r) => { (m[r.company_id] = m[r.company_id] || []).push(r.project_id); });
  return m;
}
// Reference counts that gate a registry deletion: activities and people anywhere on the platform.
export async function companyUsage(companyId) {
  const [a, pr] = await Promise.all([
    supabase.from("activities").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", companyId),
  ]);
  return { activities: a.count || 0, people: pr.count || 0 };
}
// REV217 (Phase 4): the global vendor directory. Project asset_vendor rows stay plain
// text; the directory feeds suggestion lists and central management.
export async function loadVendors() {
  const { data, error } = await supabase.from("vendors").select("*").order("name");
  if (error) throw error;
  return (data || []).map((v) => ({ id: v.id, name: v.name, category: v.category || "", notes: v.notes || "" }));
}
export async function createVendor(name, category) {
  const row = { name: (name || "").trim() };
  if (category) row.category = category;
  const { data, error } = await supabase.from("vendors").insert(row).select("id,name").single();
  if (error) throw error;
  return data;
}
export async function updateVendor(id, fields) {
  const { error } = await supabase.from("vendors").update(fields).eq("id", id);
  if (error) throw error;
}
export async function deleteVendorById(id) {
  const { error } = await supabase.from("vendors").delete().eq("id", id);
  if (error) throw error;
}
// Which projects reference each vendor name (case-insensitive), from asset_vendor.
export async function loadVendorUsageByName() {
  const { data, error } = await supabase.from("asset_vendor").select("project_id, vendor");
  if (error) throw error;
  const m = {};
  (data || []).forEach((r) => { const k = (r.vendor || "").trim().toLowerCase(); if (!k) return; (m[k] = m[k] || new Set()).add(r.project_id); });
  const out = {}; Object.keys(m).forEach((k) => { out[k] = [...m[k]]; });
  return out;
}
// Pure union for the project datalist: directory + locally used names, deduped
// case-insensitively (first-seen casing wins), sorted. Harness-tested.
export function mergeVendorNames(globalNames, localNames) {
  const seen = new Set(); const out = [];
  [...(globalNames || []), ...(localNames || [])].forEach((n) => {
    const t = (n || "").trim(); if (!t) return;
    const k = t.toLowerCase(); if (seen.has(k)) return;
    seen.add(k); out.push(t);
  });
  return out.sort((a, b) => a.localeCompare(b));
}

// REV216 (3d): picker scoping helpers. Pickers offer the project's associated companies;
// name resolution stays global so historical references never blank. ids === null means the
// association data was unavailable and callers fall back to the full registry; a loaded empty
// list is honestly empty.
export function scopeCompanies(all, ids) {
  if (!Array.isArray(ids)) return all || [];
  const set = new Set(ids);
  return (all || []).filter((c) => set.has(c.id));
}
export function scopeCompaniesWith(all, ids, currentId) {
  const base = scopeCompanies(all, ids);
  if (currentId && !base.some((c) => c.id === currentId)) {
    const cur = (all || []).find((c) => c.id === currentId);
    if (cur) return [...base, cur];
  }
  return base;
}
// Bulk idempotent association, used wherever project data starts referencing a company.
export async function ensureProjectCompanies(projectId, companyIds) {
  const ids = [...new Set((companyIds || []).filter(Boolean))];
  if (!ids.length) return;
  const { error } = await supabase.from("project_companies").upsert(
    ids.map((company_id) => ({ project_id: projectId, company_id })),
    { onConflict: "project_id,company_id", ignoreDuplicates: true });
  if (error) throw error;
}

// REV211: per-project company associations (Phase 3c).
export async function loadProjectCompanies(projectId) {
  const { data, error } = await supabase.from("project_companies").select("company_id").eq("project_id", projectId);
  if (error) throw error;
  return (data || []).map((r) => r.company_id);
}
export async function addProjectCompany(projectId, companyId) {
  const { error } = await supabase.from("project_companies").insert({ project_id: projectId, company_id: companyId });
  if (error && error.code !== "23505") throw error;
}
export async function removeProjectCompany(projectId, companyId) {
  const { error } = await supabase.from("project_companies").delete().eq("project_id", projectId).eq("company_id", companyId);
  if (error) throw error;
}
// Server-side count so the removal guard sees soft-deleted activities too.
export async function countCompanyActivitiesOnProject(projectId, companyId) {
  const { count, error } = await supabase.from("activities").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("company_id", companyId);
  if (error) throw error;
  return count || 0;
}

// Direct slot write for the hub logo editor (the project tab used to persist via syncCollections).
export async function setCompanyLogo(id, dark, url) {
  const { error } = await supabase.from("companies").update({ [dark ? "logo_url_dark" : "logo_url"]: url || null }).eq("id", id);
  if (error) throw error;
}
export async function renameCompany(id, name) {
  const { error } = await supabase.from("companies").update({ name: (name || "").trim() }).eq("id", id);
  if (error) throw error;
}
// Single targeted registry deletion (the REV192 bulk-delete guard in syncCollections is untouched).
// project_companies rows cascade away via the FK; callers must verify companyUsage first.
export async function deleteCompanyById(id) {
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw error;
}

export async function loadMembershipCounts() {
  const { data, error } = await supabase.from("project_members").select("user_id");
  if (error) throw error;
  const m = {}; (data || []).forEach((r) => { m[r.user_id] = (m[r.user_id] || 0) + 1; });
  return m;
}
// Grant or revoke platform super. Goes through a SECURITY DEFINER function that
// checks the caller is a super and keeps at least one super alive.
export async function setPlatformRole(userId, role) {
  const { error } = await supabase.rpc("set_platform_role", { target: userId, new_role: role });
  if (error) throw error;
}

// ---- P6 baseline (one row per project) ----
export async function loadBaseline(projectId) {
  const { data, error } = await supabase.from("baselines").select("*").eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  return data || null;
}
export async function saveBaseline(projectId, payload) {
  const row = {
    project_id: projectId,
    meta: payload.meta || {},
    activities: payload.activities || [],
    wbs: payload.wbs || {},
    source_filename: payload.source_filename || null,
    imported_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("baselines").upsert(row, { onConflict: "project_id" }).select().maybeSingle();
  if (error) throw error;
  return data;
}
export async function saveBaselineMappings(projectId, mappings) {
  const { error } = await supabase.from("baselines").update({ mappings: mappings || {} }).eq("project_id", projectId);
  if (error) throw error;
}
export async function clearBaseline(projectId) {
  const { error } = await supabase.from("baselines").delete().eq("project_id", projectId);
  if (error) throw error;
}

// ---- weekly report distribution list (one saved recipient set per project) ----
// recipients is an array of { name, email }. Admin-only via RLS.
export async function loadReportRecipients(projectId) {
  const { data, error } = await supabase.from("report_recipients").select("recipients").eq("project_id", projectId).maybeSingle();
  if (error) return null;
  return data && Array.isArray(data.recipients) ? data.recipients : null;
}

export async function saveReportRecipients(projectId, recipients) {
  const clean = (recipients || []).filter((r) => r && r.email).map((r) => ({ name: (r.name || "").trim(), email: (r.email || "").trim() }));
  const { error } = await supabase.from("report_recipients").upsert({ project_id: projectId, recipients: clean, updated_at: new Date().toISOString() }, { onConflict: "project_id" });
  if (error) throw error;
  return clean;
}


// ---- REV104: per-project user privileges ----
// Keys and grouping for the User Privileges matrix. Baselines mirror live
// behaviour as of REV103 (see has_priv in supabase/user-privileges-REV104.sql;
// the two resolvers must stay in lockstep).
// REV175: set only an activity's percent complete via the SECURITY DEFINER RPC, so a
// member can record progress on any company's activity without touching any other field.
export async function setActivityPercent(id, percent) {
  const p = percent == null ? null : Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const { error } = await supabase.rpc("set_activity_percent", { p_id: id, p_percent: p });
  if (error) throw error;
}

export const PRIV_GROUPS = [
  ["Planning Board", [["create", "Create Activities"], ["editOwn", "Edit Own Company Work"], ["editAny", "Edit Any Company Work"], ["del", "Delete Activities"], ["commit", "Commit Weekly Plan"], ["editCommitted", "Edit Committed Work"], ["delay", "Record Delays"]]],
  ["Witnessing", [["witnessReq", "Set Witness Requirements"], ["witnessSend", "Send Witness Invitations"], ["requestInv", "Request Invites"], ["witnessOutcome", "Record Witness Outcomes"], ["retest", "Declare Retests"]]],
  ["Progress And Reports", [["importWb", "Import Cx Workbook"], ["cxConfig", "Configure Cx Progress"], ["weekly", "Generate Weekly Report"], ["distList", "Manage Distribution List"]]],
  // REV132: Asset Status editing. editAsset is the broad Edit Mode (admin baseline);
  // editEE is the narrow Velox lane, off by default and granted per user. can_edit_ee
  // in SQL reads the same editEE grant, so client and RLS stay in lockstep.
  ["Assets", [["editAsset", "Edit Asset Status"], ["editEE", "Mark Equipment Energised (EE)"]]],
  // REV139: Documentation Tracker edit mode. Mirrors editAsset (admin baseline, owner blanket).
  ["Documentation", [["editDocs", "Edit Documentation Status"]]],
  ["Administration", [["users", "Manage Users"], ["approve", "Approve Access Requests"], ["auditView", "View Audit Log"], ["auditRevert", "Revert From Audit Log"], ["privs", "Manage Privileges"]]],
];
export const PRIV_KEYS = PRIV_GROUPS.flatMap(([, ps]) => ps.map(([k]) => k));
const MEMBER_BASE = new Set(["create", "editOwn", "del", "witnessReq", "witnessOutcome", "retest"]);

// One resolver for the whole client. ctx: { platformRole, projRole, isClientCompany, overrides }
// overrides: plain object { key: boolean } for ONE user in ONE project.
export function resolvePriv(ctx, key) {
  // The owner blanket grants every ELEVATED privilege, but requestInv is not one: it is the
  // client-viewer mode flag (member of the client company), and App.jsx derives isClientViewer
  // from it. Granting it to the owner flipped the owner's UI into client-viewer mode, hiding
  // the admin action column and the drawer's Test Invite (the REV111 owner-account report).
  if (ctx.platformRole === "owner") return key !== "requestInv";
  if (key === "privs") return false;
  const ov = ctx.overrides || {};
  if (key in ov) return !!ov[key];
  const role = ctx.platformRole === "super" ? "admin" : (ctx.projRole || null);
  if (!role) return false;
  if (key === "requestInv") return role === "member" && !!ctx.isClientCompany;
  if (role === "admin") return true;
  return MEMBER_BASE.has(key);
}

export async function saveUserPrivileges(projectId, changes) {
  // changes: [{ userId, key, value }] where value true/false stores an override
  // and value null clears the row back to the role default.
  const { data } = await supabase.auth.getSession();
  const me = data?.session?.user?.id || null;
  const ups = changes.filter((c) => c.value === true || c.value === false)
    .map((c) => ({ project_id: projectId, user_id: c.userId, priv_key: c.key, granted: c.value, updated_by: me, updated_at: new Date().toISOString() }));
  const dels = changes.filter((c) => c.value == null);
  if (ups.length) {
    const { error } = await supabase.from("user_privileges").upsert(ups, { onConflict: "project_id,user_id,priv_key" });
    if (error) return error.message || String(error);
  }
  for (const d of dels) {
    const { error } = await supabase.from("user_privileges").delete()
      .eq("project_id", projectId).eq("user_id", d.userId).eq("priv_key", d.key);
    if (error) return error.message || String(error);
  }
  return "";
}

/* ---------- REV115: Asset Status ---------- */

// PostgREST caps any single select at 1000 rows, so register reads paginate.
async function fetchAllAssetRows(projectId, cols) {
  const out = []; const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from("asset_register").select(cols).eq("project_id", projectId).order("tag").range(from, from + page - 1);
    if (error) return { data: out, error: error.message || String(error) };
    out.push(...(data || []));
    if (!data || data.length < page) break;
  }
  return { data: out, error: "" };
}

export async function loadAssetStatus(projectId) {
  const [reg, steps, cfg] = await Promise.all([
    fetchAllAssetRows(projectId, "*"),
    supabase.from("cx_step_reference").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("asset_status_config").select("*").eq("project_id", projectId).maybeSingle(),
  ]);
  const err = reg.error || steps.error || cfg.error;
  return { assets: reg.data || [], steps: steps.data || [], config: cfg.data || null, error: err ? (err.message || err.error || String(err)) : "" };
}

// Canonical signature: JSON with recursively sorted keys. Postgres returns jsonb
// in its own internal key order, which differs from the parser's column order;
// naive stringify comparison marked every identical row as updated.
export function stableSig(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableSig).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableSig(v[k])).join(",") + "}";
}

// Compare the previous register state with the incoming one and summarise the
// movement. Pure function so it is harness-testable. Returns counts only,
// never asset lists: added, removed, updated, unchanged, per-tag gained/lost,
// checkpoint completions gained/lost, and planned/actual date changes.
export function computeRegisterDelta(prevRows, newRows, stepDefs) {
  const prevMap = {}; (prevRows || []).forEach((r) => { prevMap[r.tag] = r; });
  const newMap = {}; (newRows || []).forEach((r) => { newMap[r.tag] = r; });
  const rowSig = (r) => stableSig([r.name, r.type, r.discipline, r.level, r.hall, r.steps, r.dates]);
  const tagSteps = (stepDefs || []).filter((sd) => sd.is_tag);
  const allSteps = (stepDefs || []).map((sd) => sd.step_key);
  const d = { firstSync: !(prevRows || []).length, added: 0, removed: 0, updated: 0, unchanged: 0, stepsGained: 0, stepsLost: 0, dateChanges: 0, tagDelta: tagSteps.map((t) => ({ key: t.step_key, stage: t.stage, gained: 0, lost: 0 })) };
  const tagIx = {}; d.tagDelta.forEach((t, i) => { tagIx[t.key] = i; });
  (newRows || []).forEach((r) => {
    const p = prevMap[r.tag];
    if (!p) { d.added++; return; }
    if (rowSig(p) === rowSig(r)) { d.unchanged++; return; }
    d.updated++;
    allSteps.forEach((k) => {
      const was = (p.steps || {})[k] || 0, now = (r.steps || {})[k] || 0;
      if (was !== 2 && now === 2) { d.stepsGained++; if (tagIx[k] !== undefined) d.tagDelta[tagIx[k]].gained++; }
      if (was === 2 && now !== 2) { d.stepsLost++; if (tagIx[k] !== undefined) d.tagDelta[tagIx[k]].lost++; }
    });
    const dk = new Set([...Object.keys(p.dates || {}), ...Object.keys(r.dates || {})]);
    dk.forEach((k) => { if ((p.dates || {})[k] !== (r.dates || {})[k]) d.dateChanges++; });
  });
  (prevRows || []).forEach((p) => { if (!newMap[p.tag]) d.removed++; });
  return d;
}

// Upsert the parsed register. Returns observable counts so every import/sync
// reports exactly what it did: { read, added, updated, unchanged, error }.
// Step structural fields (stage, sort_order, is_tag) refresh from the workbook;
// admin-authored reference content (definition, executed_by, signed_off_by) is
// deliberately not in the upsert payload so imports can never blank it.
export async function saveAssetRegister(projectId, assets, stepDefs, source) {
  const prev = await fetchAllAssetRows(projectId, "tag,name,type,discipline,level,hall,steps,dates");
  if (prev.error) return { error: prev.error };
  const now = new Date().toISOString();
  const rows = assets.map((a) => ({ project_id: projectId, ...a, synced_at: now, source }));
  const delta = computeRegisterDelta(prev.data, rows, stepDefs);
  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await supabase.from("asset_register").upsert(rows.slice(i, i + 400), { onConflict: "project_id,tag" });
    if (error) return { error: error.message || String(error) };
  }
  // The register is the source of truth: tags that vanished from it are removed
  // here too, and reported in the summary as Removed.
  if (delta.removed) {
    const newTags = new Set(rows.map((r) => r.tag));
    const gone = prev.data.filter((p) => !newTags.has(p.tag)).map((p) => p.tag);
    for (let i = 0; i < gone.length; i += 200) {
      const { error } = await supabase.from("asset_register").delete().eq("project_id", projectId).in("tag", gone.slice(i, i + 200));
      if (error) return { error: error.message || String(error) };
    }
  }
  if (stepDefs && stepDefs.length) {
    const sRows = stepDefs.map((sd) => ({ project_id: projectId, step_key: sd.step_key, stage: sd.stage, sort_order: sd.sort_order, is_tag: sd.is_tag, in_register: true, updated_at: now }));
    const { error } = await supabase.from("cx_step_reference").upsert(sRows, { onConflict: "project_id,step_key" });
    if (error) return { error: error.message || String(error) };
  }
  return { read: rows.length, ...delta, error: "" };
}

export async function saveStepReference(projectId, stepKey, fields) {
  const { error } = await supabase.from("cx_step_reference")
    .update({ definition: fields.definition || "", executed_by: fields.executed_by || "", signed_off_by: fields.signed_off_by || "", updated_at: new Date().toISOString() })
    .eq("project_id", projectId).eq("step_key", stepKey);
  return error ? (error.message || String(error)) : "";
}

export async function saveAssetStatusConfig(projectId, cfg) {
  const { error } = await supabase.from("asset_status_config").upsert({
    project_id: projectId, tenant_id: cfg.tenant_id || "", client_id: cfg.client_id || "",
    file_url: cfg.file_url || "", sheet_name: cfg.sheet_name || "Asset Cx Register",
    updated_at: new Date().toISOString(),
  }, { onConflict: "project_id" });
  return error ? (error.message || String(error)) : "";
}

/* ---------- REV132: Asset energisation (overrides, events, sync conflicts) ---------- */
// Manual overrides live in asset_override, separate from the register mirror, so a
// SharePoint re-import never wipes them. Events (asset_event) are the persisted
// ready-for-energisation feed. RLS and triggers do the enforcement; these are the
// thin client accessors plus the pure conflict resolver the sync gate uses.

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id || null;
}

export async function loadAssetOverrides(projectId) {
  const { data, error } = await supabase.from("asset_override")
    .select("asset_tag, step_key, value, set_by, set_at, note").eq("project_id", projectId);
  if (error) return { overrides: [], error: error.message || String(error) };
  return { overrides: data || [], error: "" };
}

export async function saveAssetOverride(projectId, assetTag, stepKey, value, note) {
  const me = await currentUserId();
  const { error } = await supabase.from("asset_override").upsert({
    project_id: projectId, asset_tag: assetTag, step_key: stepKey,
    value, set_by: me, set_at: new Date().toISOString(), note: note || null,
  }, { onConflict: "project_id,asset_tag,step_key" });
  return error ? (error.message || String(error)) : "";
}

export async function deleteAssetOverride(projectId, assetTag, stepKey) {
  const { error } = await supabase.from("asset_override").delete()
    .eq("project_id", projectId).eq("asset_tag", assetTag).eq("step_key", stepKey);
  return error ? (error.message || String(error)) : "";
}

export async function loadAssetEvents(projectId) {
  const { data, error } = await supabase.from("asset_event")
    .select("*").eq("project_id", projectId).eq("type", "ready_for_energisation")
    .order("created_at", { ascending: false });
  if (error) return { events: [], error: error.message || String(error) };
  return { events: data || [], error: "" };
}

// state: 'rffe_sent' | 'energised' | 'retracted' | 'new'. The triggers also move
// state on their own (energised on EE complete, retracted on yellow cleared); this
// is for the app-driven transition, mainly marking rffe_sent after a send.
export async function setAssetEventState(eventId, state) {
  const me = await currentUserId();
  const patch = { state };
  if (state === "rffe_sent") { patch.rffe_sent_at = new Date().toISOString(); patch.rffe_sent_by = me; }
  if (state === "energised") { patch.energised_at = new Date().toISOString(); patch.energised_by = me; }
  const { error } = await supabase.from("asset_event").update(patch).eq("id", eventId);
  return error ? (error.message || String(error)) : "";
}

// Pure resolver for the sync gate (no I/O, unit-testable). Given the manual
// overrides and the freshly parsed incoming rows, return only the cells where a
// manual value clashes with what the import wants. Non-conflicting import changes
// are not returned; the caller applies those as it does today.
//   overrides:   [{ asset_tag, step_key, value }]
//   incomingRows:[{ tag, name, steps: { step_key: 0|1|2 } }]
// returns:       [{ tag, name, step_key, mine, incoming }]
export function computeSyncConflicts(overrides, incomingRows) {
  const byTag = {};
  (incomingRows || []).forEach((r) => { byTag[r.tag] = r; });
  const out = [];
  (overrides || []).forEach((o) => {
    const row = byTag[o.asset_tag];
    if (!row) return;                                   // asset gone from register; leave override alone
    const inc = (row.steps || {})[o.step_key];
    if (inc === undefined) return;                      // column not in this import
    if (Number(inc) !== Number(o.value)) {
      out.push({ tag: o.asset_tag, name: row.name || o.asset_tag, step_key: o.step_key, mine: o.value, incoming: Number(inc) });
    }
  });
  return out;
}

// REV134: events store only the asset tag; the notification feed and the RFFE need the
// display name too. One extra read joins the names from the register in memory.
export async function loadAssetEventsNamed(projectId) {
  const r = await loadAssetEvents(projectId);
  if (r.error) return r;
  const tags = [...new Set((r.events || []).map((e) => e.asset_tag))];
  if (!tags.length) return { events: r.events || [], error: "" };
  const { data } = await supabase.from("asset_register").select("tag, name").eq("project_id", projectId).in("tag", tags);
  const nm = {}; (data || []).forEach((x) => { nm[x.tag] = x.name; });
  return { events: (r.events || []).map((e) => ({ ...e, asset_name: nm[e.asset_tag] || e.asset_tag })), error: "" };
}

// REV136: energisation confirmation claim. When EE is marked complete the REV132
// trigger flips the event to 'energised'. claimEnergisedConfirmation sets confirmed_at
// only if it is still null, so exactly one tab wins the right to send the confirmation
// email. releaseEnergisedConfirmation rolls the claim back if the send fails.
export async function claimEnergisedConfirmation(eventId) {
  const { data, error } = await supabase.from("asset_event")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", eventId).eq("state", "energised").is("confirmed_at", null)
    .select("id");
  if (error) return false;
  return !!(data && data.length);
}
export async function releaseEnergisedConfirmation(eventId) {
  await supabase.from("asset_event").update({ confirmed_at: null }).eq("id", eventId);
}

/* ============================================================
   REV139: Documentation Tracker + Vendors
   Mirrors the asset status data layer. docs_matrix is the SharePoint
   mirror (status jsonb of doc_key -> 'y'|'n'|'a' plus the manual overall
   flag). docs_override holds manual Edit Mode changes so a re-sync never
   wipes them. docs_column_ref is purely structural (refreshed on sync).
   asset_vendor is reference data edited in Settings > Vendors.
   Cell codes: 'y' received, 'n' outstanding, 'a' not applicable.
   ============================================================ */

export async function loadDocsStatus(projectId) {
  const [mx, cols, cfg, ov, ven, vt] = await Promise.all([
    supabase.from("docs_matrix").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("docs_column_ref").select("*").eq("project_id", projectId).order("sort_order"),
    supabase.from("docs_status_config").select("*").eq("project_id", projectId).maybeSingle(),
    supabase.from("docs_override").select("equip_type, doc_key, value, set_by, set_at, note").eq("project_id", projectId),
    supabase.from("asset_vendor").select("equip_type, vendor").eq("project_id", projectId),
    supabase.from("docs_vendor_target").select("vendor, level, due_date, note").eq("project_id", projectId),
  ]);
  // A missing docs_vendor_target table (migration not yet run) must not break the
  // whole page; the Vendor Status window simply starts empty until the SQL is run.
  const vtMissing = vt.error && /docs_vendor_target|relation .* does not exist|schema cache/i.test(vt.error.message || "");
  const err = mx.error || cols.error || cfg.error || ov.error || ven.error || (vtMissing ? null : vt.error);
  return {
    matrix: mx.data || [], columns: cols.data || [], config: cfg.data || null,
    overrides: ov.data || [], vendors: ven.data || [], vendor_targets: (vt && vt.data) || [],
    error: err ? (err.message || err.error || String(err)) : "",
  };
}

// Pure, harness-testable. Summarise the movement between the previous matrix
// and the incoming parse. Counts only, never lists: added/removed equipment
// types, updated/unchanged, and per-cell received gained/lost.
export function computeDocsDelta(prevRows, newRows) {
  const prevMap = {}; (prevRows || []).forEach((r) => { prevMap[r.equip_type] = r; });
  const newMap = {}; (newRows || []).forEach((r) => { newMap[r.equip_type] = r; });
  const sig = (r) => stableSig([r.status, r.overall]);
  const d = { firstSync: !(prevRows || []).length, added: 0, removed: 0, updated: 0, unchanged: 0, cellsGained: 0, cellsLost: 0 };
  (newRows || []).forEach((r) => {
    const p = prevMap[r.equip_type];
    if (!p) { d.added++; return; }
    if (sig(p) === sig(r)) { d.unchanged++; return; }
    d.updated++;
    const keys = new Set([...Object.keys(p.status || {}), ...Object.keys(r.status || {})]);
    keys.forEach((k) => {
      const was = (p.status || {})[k], now = (r.status || {})[k];
      if (was !== "y" && now === "y") d.cellsGained++;
      if (was === "y" && now !== "y") d.cellsLost++;
    });
  });
  (prevRows || []).forEach((p) => { if (!newMap[p.equip_type]) d.removed++; });
  return d;
}

// Upsert the parsed matrix and refresh the structural column reference.
// Equipment types that vanished from the sheet are removed and reported.
// rows:    [{ equip_type, status:{doc_key:'y'|'n'|'a'}, overall:bool, sort_order }]
// columns: [{ doc_key, doc_name, level, responsible, sort_order }]
export async function saveDocsMatrix(projectId, rows, columns, source) {
  const prevRes = await supabase.from("docs_matrix").select("equip_type,status,overall").eq("project_id", projectId);
  if (prevRes.error) return { error: prevRes.error.message || String(prevRes.error) };
  const prev = prevRes.data || [];
  const now = new Date().toISOString();
  const payload = rows.map((r) => ({ project_id: projectId, equip_type: r.equip_type, status: r.status || {}, overall: !!r.overall, sort_order: r.sort_order || 0, synced_at: now, source }));
  const delta = computeDocsDelta(prev, payload);
  for (let i = 0; i < payload.length; i += 400) {
    const { error } = await supabase.from("docs_matrix").upsert(payload.slice(i, i + 400), { onConflict: "project_id,equip_type" });
    if (error) return { error: error.message || String(error) };
  }
  if (delta.removed) {
    const keep = new Set(payload.map((r) => r.equip_type));
    const gone = prev.filter((p) => !keep.has(p.equip_type)).map((p) => p.equip_type);
    for (let i = 0; i < gone.length; i += 200) {
      const { error } = await supabase.from("docs_matrix").delete().eq("project_id", projectId).in("equip_type", gone.slice(i, i + 200));
      if (error) return { error: error.message || String(error) };
    }
  }
  if (columns && columns.length) {
    const cRows = columns.map((c) => ({ project_id: projectId, doc_key: c.doc_key, doc_name: c.doc_name, level: c.level, responsible: c.responsible || "", sort_order: c.sort_order || 0, updated_at: now }));
    const { error } = await supabase.from("docs_column_ref").upsert(cRows, { onConflict: "project_id,doc_key" });
    if (error) return { error: error.message || String(error) };
    const keepK = new Set(cRows.map((c) => c.doc_key));
    const goneRes = await supabase.from("docs_column_ref").select("doc_key").eq("project_id", projectId);
    const goneK = (goneRes.data || []).map((x) => x.doc_key).filter((k) => !keepK.has(k));
    if (goneK.length) { await supabase.from("docs_column_ref").delete().eq("project_id", projectId).in("doc_key", goneK); }
  }
  return { read: payload.length, ...delta, error: "" };
}

export async function saveDocsStatusConfig(projectId, cfg) {
  const { error } = await supabase.from("docs_status_config").upsert({
    project_id: projectId, tenant_id: cfg.tenant_id || "", client_id: cfg.client_id || "",
    file_url: cfg.file_url || "", sheet_name: cfg.sheet_name || "Documentation status",
    updated_at: new Date().toISOString(),
  }, { onConflict: "project_id" });
  return error ? (error.message || String(error)) : "";
}

// REV144: per vendor, per level document due date for the Vendor Status window.
// An empty dueDate clears the target (delete the row) so a cleared date does not
// linger as an overdue flag. Admin only at the RLS layer.
export async function saveDocsVendorTarget(projectId, vendor, level, dueDate, note, userName) {
  if (!dueDate) {
    const { error } = await supabase.from("docs_vendor_target").delete()
      .eq("project_id", projectId).eq("vendor", vendor).eq("level", level);
    return error ? (error.message || String(error)) : "";
  }
  const { error } = await supabase.from("docs_vendor_target").upsert({
    project_id: projectId, vendor, level, due_date: dueDate, note: note || "",
    updated_at: new Date().toISOString(), updated_by: userName || "",
  }, { onConflict: "project_id,vendor,level" });
  return error ? (error.message || String(error)) : "";
}

export async function loadDocsOverrides(projectId) {
  const { data, error } = await supabase.from("docs_override")
    .select("equip_type, doc_key, value, set_by, set_at, note").eq("project_id", projectId);
  if (error) return { overrides: [], error: error.message || String(error) };
  return { overrides: data || [], error: "" };
}

// doc_key '__overall__' overrides the sign-off flag ('y'|'n'); any other
// doc_key overrides a cell ('y'|'n'|'a').
export async function saveDocsOverride(projectId, equipType, docKey, value, note) {
  const me = await currentUserId();
  const { error } = await supabase.from("docs_override").upsert({
    project_id: projectId, equip_type: equipType, doc_key: docKey,
    value, set_by: me, set_at: new Date().toISOString(), note: note || null,
  }, { onConflict: "project_id,equip_type,doc_key" });
  return error ? (error.message || String(error)) : "";
}

export async function deleteDocsOverride(projectId, equipType, docKey) {
  const { error } = await supabase.from("docs_override").delete()
    .eq("project_id", projectId).eq("equip_type", equipType).eq("doc_key", docKey);
  return error ? (error.message || String(error)) : "";
}

// Pure resolver for the sync gate (no I/O, harness-testable). Given manual
// overrides and the freshly parsed incoming rows, return only the cells where
// a manual value clashes with what the import wants.
//   overrides:    [{ equip_type, doc_key, value }]
//   incomingRows: [{ equip_type, status:{doc_key:'y'|'n'|'a'}, overall:bool }]
//   returns:      [{ equip_type, doc_key, mine, incoming }]
export function computeDocsConflicts(overrides, incomingRows) {
  const byType = {};
  (incomingRows || []).forEach((r) => { byType[r.equip_type] = r; });
  const out = [];
  (overrides || []).forEach((o) => {
    const row = byType[o.equip_type];
    if (!row) return;                                   // type gone from the sheet
    let inc;
    if (o.doc_key === "__overall__") inc = row.overall ? "y" : "n";
    else inc = (row.status || {})[o.doc_key];
    if (inc === undefined) return;                      // column not in this import
    if (String(inc) !== String(o.value)) {
      out.push({ equip_type: o.equip_type, doc_key: o.doc_key, mine: o.value, incoming: inc });
    }
  });
  return out;
}

/* ---------- Vendors (Settings > Vendors, admin only) ---------- */

export async function loadAssetVendors(projectId) {
  const { data, error } = await supabase.from("asset_vendor")
    .select("equip_type, vendor").eq("project_id", projectId);
  if (error) return { vendors: [], error: error.message || String(error) };
  return { vendors: data || [], error: "" };
}

export async function saveAssetVendor(projectId, equipType, vendor) {
  const me = await currentUserId();
  const v = (vendor || "").trim().toUpperCase() || "TBC";
  const { error } = await supabase.from("asset_vendor").upsert({
    project_id: projectId, equip_type: equipType, vendor: v,
    updated_by: me, updated_at: new Date().toISOString(),
  }, { onConflict: "project_id,equip_type" });
  return error ? (error.message || String(error)) : "";
}

// REV162: ACC Live Sync status readers. Credential independent; these only read the
// project scoped acc_sync tables so the Connections card (and, in REV163, the board
// button) can show state. Writes go through the acc-admin edge function, not here.
export async function loadAccSync(projectId) {
  if (!projectId) return null;
  const { data, error } = await supabase.from("acc_sync").select("*").eq("project_id", projectId).maybeSingle();
  if (error) return null;
  return data || null;
}
export async function loadAccSyncEvents(projectId, limit = 10) {
  if (!projectId) return [];
  const { data, error } = await supabase.from("acc_sync_events").select("*").eq("project_id", projectId).order("ts", { ascending: false }).limit(limit);
  if (error) return [];
  return data || [];
}

// REV165: Benchmarks page reader. Plain read of the acc_benchmarks staging table; the page
// cross-references these against loaded activities to derive status (see accReconcile.js).
export async function loadBenchmarks(projectId) {
  if (!projectId) return [];
  const { data, error } = await supabase.from("acc_benchmarks").select("*").eq("project_id", projectId).order("planned_date", { ascending: true, nullsFirst: false });
  if (error) return [];
  return data || [];
}

// REV166: manual FOK import writer. Upserts the imported register into the acc_benchmarks
// staging table (the ACC webhook will later write the same shape). Marks everything not present
// first, then flips the current rows back on, so a ref dropped from the register shows as
// Removed In ACC. board_activity_id is not in the payload, so existing board links survive.
export async function writeBenchmarks(projectId, rows, importedByName) {
  if (!projectId) return { error: "No project selected" };
  await supabase.from("acc_benchmarks").update({ present: false }).eq("project_id", projectId);
  // Dedupe by fok_ref (last wins). A register can reuse an ID (e.g. 8160 appears twice on the
  // CSA sheet), and ON CONFLICT DO UPDATE cannot touch the same key twice in one upsert, which
  // is what the "cannot affect row a second time" error was. Report how many collapsed.
  const byRef = new Map();
  let duplicates = 0;
  for (const r of (rows || [])) { const ref = String(r.fokRef); if (byRef.has(ref)) duplicates++; byRef.set(ref, r); }
  const incoming = Array.from(byRef.values()).map((r) => ({
    project_id: projectId,
    fok_ref: String(r.fokRef),
    discipline: r.discipline || null,
    title: r.title || null,
    planned_date: coerceIsoDate(r.plannedDate),   // REV320: defensive; a non-date (e.g. TBC) here would fail the whole batch upsert
    assignee_email: r.assigneeEmail || null,
    acc_url: r.accUrl || null,
    notes: r.notes || null,
    present: true,
    synced_at: new Date().toISOString(),
  }));
  if (!incoming.length) return { count: 0, duplicates, error: null };
  const { error } = await supabase.from("acc_benchmarks").upsert(incoming, { onConflict: "project_id,fok_ref" });
  if (!error) {
    // REV177: append an immutable snapshot of this import for register comparison (best effort;
    // a snapshot failure never fails the import itself).
    try {
      // REV197: snapshots carry every field the import persists. The original five-field
      // snapshot was blind to ACC link and notes edits, so the change log reported no
      // differences between imports whose notes and links had genuinely moved.
      const snapshot = incoming.map((r) => ({ ref: r.fok_ref, title: r.title || "", planned: r.planned_date || "", assignee: r.assignee_email || "", discipline: r.discipline || "", acc_url: r.acc_url || "", notes: r.notes || "" }));
      await supabase.from("acc_benchmark_imports").insert({ project_id: projectId, imported_by_name: importedByName || null, count: snapshot.length, snapshot });
    } catch (e) { /* snapshot is not critical */ }
  }
  return { count: incoming.length, duplicates, error: error ? error.message : null };
}

// REV177: load the import snapshots for the register change log, newest first.
export async function loadBenchmarkImports(projectId) {
  if (!projectId) return [];
  const { data, error } = await supabase.from("acc_benchmark_imports")
    .select("id, imported_at, imported_by_name, count, snapshot")
    .eq("project_id", projectId).order("imported_at", { ascending: false }).limit(50);
  if (error) return [];
  return data || [];
}

// REV177: pure diff of two register snapshots. prev and curr are arrays of
// { ref, title, planned, assignee, discipline }. Returns added/removed/changed and an
// unchanged count. Compares by ref; changed lists the exact fields that moved.
export function diffBenchmarkSnapshots(prev, curr) {
  const P = new Map((prev || []).map((r) => [String(r.ref), r]));
  const C = new Map((curr || []).map((r) => [String(r.ref), r]));
  const FIELDS = [["title", "Title"], ["planned", "Planned date"], ["assignee", "Assignee"], ["discipline", "Discipline"], ["acc_url", "ACC link"], ["notes", "Notes"]];
  const added = [], removed = [], changed = [];
  let unchanged = 0;
  for (const [ref, c] of C) { if (!P.has(ref)) { added.push(c); continue; }
    const p = P.get(ref); const fields = [];
    for (const [k, label] of FIELDS) { if (p[k] === undefined || c[k] === undefined) continue; /* REV197: field absent from an older snapshot format, cannot judge */ const a = p[k] == null ? "" : String(p[k]); const b = c[k] == null ? "" : String(c[k]); if (a !== b) fields.push({ label, from: a, to: b }); }
    if (fields.length) changed.push({ ref, title: c.title || "", fields }); else unchanged++;
  }
  for (const [ref, p] of P) { if (!C.has(ref)) removed.push(p); }
  const byRef = (x, y) => String(x.ref).localeCompare(String(y.ref), undefined, { numeric: true });
  added.sort(byRef); removed.sort(byRef); changed.sort(byRef);
  return { added, removed, changed, unchanged };
}

// REV170: after Send to Board promotes benchmarks to activities, record the link so the
// benchmark shows as On Board even if its ref is later edited. Best effort; status also
// derives from the activity carrying the same fok_ref, so a failed link is not fatal.
export async function linkBenchmarksToActivities(projectId, links) {
  if (!projectId || !links || !links.length) return { error: null };
  const res = await Promise.all(links.map((l) =>
    supabase.from("acc_benchmarks").update({ board_activity_id: l.id }).eq("project_id", projectId).eq("fok_ref", l.ref)
  ));
  const err = res.find((r) => r.error);
  return { error: err ? err.error.message : null };
}

// REV172: Match Assignees writes the resolved company (and email, for name matches) per ref.
export async function resolveBenchmarkCompanies(projectId, updates) {
  if (!projectId || !updates || !updates.length) return { error: null };
  const res = await Promise.all(updates.map((u) =>
    supabase.from("acc_benchmarks").update({ company_id: u.company_id || null, resolved_email: u.resolved_email || null }).eq("project_id", projectId).eq("fok_ref", u.fok_ref)
  ));
  const err = res.find((r) => r.error);
  return { error: err ? err.error.message : null };
}
// REV172: archive/restore a benchmark. Completed rows drop out of the default view.
export async function setBenchmarkComplete(projectId, fokRef, done) {
  if (!projectId || !fokRef) return { error: "missing" };
  const { error } = await supabase.from("acc_benchmarks").update({ completed_at: done ? new Date().toISOString() : null }).eq("project_id", projectId).eq("fok_ref", fokRef);
  return { error: error ? error.message : null };
}

// ---- REV244: append-only daily updates (activity_updates table) ----
// Read is project-member scoped, insert is admin/owner only, and the table carries no
// update or delete policies, so entries are immutable by design.
export async function fetchActivityUpdates(projectId, activityIds) {
  if (!activityIds || !activityIds.length) return {};
  const { data, error } = await supabase.from("activity_updates").select("*")
    .eq("project_id", projectId).in("activity_id", activityIds)
    .order("at", { ascending: false }).limit(1000);
  if (error) throw error;
  const by = {};
  (data || []).forEach((u) => { (by[u.activity_id] = by[u.activity_id] || []).push(u); });
  return by;
}
export async function addActivityUpdate(projectId, activityId, note, pct, byName) {
  const row = { project_id: projectId, activity_id: activityId, note, by_name: byName || "" };
  if (pct != null) row.pct = pct;
  const { data, error } = await supabase.from("activity_updates").insert(row).select("*").single();
  if (error) throw error;
  return data;
}

// REV247: daily updates in a UTC window (for the Morning Cx Update's yesterday section).
export async function fetchUpdatesBetween(projectId, fromIso, toIso) {
  const { data, error } = await supabase.from("activity_updates").select("*")
    .eq("project_id", projectId).gte("at", fromIso).lt("at", toIso)
    .order("at", { ascending: true }).limit(1000);
  if (error) throw error;
  return data || [];
}
