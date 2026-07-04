import { supabase } from "./supabaseClient";

// ---- field mapping (db row <-> client activity) ----
const fromActivity = (r) => ({
  id: r.id, desc: r.descr || "", companyId: r.company_id || "", area: r.area || "", system: r.system || "",
  level: r.level || "L2", isMilestone: !!r.is_milestone, start: r.start_date || "", duration: r.duration || 1,
  // Milestones are binary (Planned / Complete); any legacy in_progress row is coerced at load
  committed: !!r.committed, status: (r.is_milestone && r.status === "in_progress") ? "planned" : (r.status || "planned"), actualStart: r.actual_start || "", actualFinish: r.actual_finish || "", percent: (r.percent == null ? null : Number(r.percent)),
  outcome: r.outcome || "pending", outcomeReason: r.outcome_reason || "", outcomeNotes: r.outcome_notes || "", outcomeAt: r.outcome_at || "", retestOf: r.retest_of || null,
  subArea: r.sub_area || "", tier3: r.tier3 || "", asset: r.asset || "", discipline: (r.discipline ? String(r.discipline).split(/\s*;\s*/).filter(Boolean) : []), witnessInvite: !!r.witness_invite, witnessAt: r.witness_at || "", witnessDurationMin: (r.witness_duration_min == null ? 60 : Number(r.witness_duration_min)), witnessDays: (r.witness_days == null ? 1 : Math.max(1, Number(r.witness_days))), witnessSentAt: r.witness_sent_at || "", notes: r.notes || "", slipReason: r.slip_reason || "",
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
    sub_area: a.subArea || null, tier3: a.tier3 || null, asset: a.asset || null, discipline: (Array.isArray(a.discipline) ? a.discipline.join("; ") : (a.discipline || "")) || null, witness_invite: !!a.witnessInvite, witness_at: a.witnessAt || null, witness_duration_min: (a.witnessDurationMin == null ? 60 : a.witnessDurationMin), witness_days: (a.witnessDays == null ? 1 : Math.max(1, a.witnessDays)), witness_sent_at: a.witnessSentAt || null, notes: a.notes || null, slip_reason: a.slipReason || null,
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
  const [companies, areas, systems, levels, settings, profiles, activities, audit, branding, subAreas, tier3s, inviteReqs, privRows] = await Promise.all([
    supabase.from("companies").select("*").order("name"),
    supabase.from("areas").select("*").eq("project_id", projectId).order("name"),
    supabase.from("systems").select("*").eq("project_id", projectId).order("name"),
    supabase.from("levels").select("*").eq("project_id", projectId).order("sort"),
    supabase.from("settings").select("*").eq("project_id", projectId).maybeSingle(),
    supabase.from("profiles").select("*").order("name"),
    supabase.from("activities").select("*").eq("project_id", projectId),
    supabase.from("audit_log").select("*").order("ts", { ascending: false }).limit(500),
    supabase.from("branding").select("*").eq("project_id", projectId).maybeSingle(),
    supabase.from("sub_areas").select("*").eq("project_id", projectId).order("name"),
    supabase.from("tier3_areas").select("*").eq("project_id", projectId).order("name"),
    supabase.from("invite_requests").select("*").eq("project_id", projectId),
    supabase.from("user_privileges").select("*").eq("project_id", projectId),
  ]);
  const levelsObj = {};
  (levels.data || []).forEach((l) => { levelsObj[l.key] = { name: l.name, color: l.color, sort: l.sort }; });
  return {
    companies: (companies.data || []).map((c) => ({ id: c.id, name: c.name, logoUrl: c.logo_url || "", logoDark: c.logo_url_dark || "", description: c.description || "", domain: c.domain || "" })),
    areas: (areas.data || []).map((a) => a.name),
    systems: (systems.data || []).map((s) => s.name),
    levels: levelsObj,
    settings: { weeks: settings.data?.weeks ?? 4, makeReadyDays: settings.data?.make_ready_days ?? 7 },
    users: (profiles.data || []).map((p) => ({ id: p.id, name: p.name, role: p.role, companyId: p.company_id, platformRole: p.platform_role || "user", mustReset: !!p.must_reset })),
    activities: (activities.data || []).map(fromActivity),
    audit: (audit.data || []).map((e) => ({ id: e.id, ts: e.ts, user: e.user_name, action: e.action, detail: e.detail, entity: e.entity, entityId: e.entity_id })),
    brand: brandFrom(branding.data, projectName),
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
    const [lv, sy, ar, sa, t3] = await Promise.all([
      supabase.from("levels").select("key,name,color,sort").eq("project_id", src),
      supabase.from("systems").select("name").eq("project_id", src),
      supabase.from("areas").select("name").eq("project_id", src),
      supabase.from("sub_areas").select("area,name").eq("project_id", src),
      supabase.from("tier3_areas").select("area,sub_area,name").eq("project_id", src),
    ]);
    const ops = [];
    if (lv.data?.length) ops.push(supabase.from("levels").insert(lv.data.map((r) => ({ ...r, project_id: id }))));
    if (sy.data?.length) ops.push(supabase.from("systems").insert(sy.data.map((r) => ({ ...r, project_id: id }))));
    if (ar.data?.length) ops.push(supabase.from("areas").insert(ar.data.map((r) => ({ ...r, project_id: id }))));
    if (sa.data?.length) ops.push(supabase.from("sub_areas").insert(sa.data.map((r) => ({ ...r, project_id: id }))));
    if (t3.data?.length) ops.push(supabase.from("tier3_areas").insert(t3.data.map((r) => ({ ...r, project_id: id }))));
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

// Set the browser tab title and favicon from branding.
export function applyBrandToTab(brand) {
  if (!brand) return;
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
    if (del.length) ops.push(supabase.from("companies").delete().in("id", del));
  }
  // areas / systems (string arrays keyed by name, per project)
  for (const key of ["areas", "systems"]) {
    if (next[key] !== prev[key]) {
      const add = next[key].filter((x) => !prev[key].includes(x)).map((name) => ({ name, project_id: projectId }));
      const rem = prev[key].filter((x) => !next[key].includes(x));
      if (add.length) ops.push(supabase.from(key).upsert(add));
      if (rem.length) ops.push(supabase.from(key).delete().eq("project_id", projectId).in("name", rem));
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
    ops.push(supabase.from("settings").update({ weeks: next.settings.weeks, make_ready_days: next.settings.makeReadyDays }).eq("project_id", projectId));
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

export async function fetchAudit() {
  const { data } = await supabase.from("audit_log").select("*").order("ts", { ascending: false }).limit(500);
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

const FIN04_PROJECT = "f1040000-0000-4000-a000-000000000001";

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
  const [actRes, coRes] = await Promise.all([
    supabase.from("activities").select("project_id, status, committed, start_date, duration, actual_finish, company_id"),
    supabase.from("companies").select("id, name"),
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
  return { perProj, companies };
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

export function subscribeAll(onChange) {
  let t;
  const debounced = () => { clearTimeout(t); t = setTimeout(onChange, 250); };
  return supabase
    .channel("fin04-all")
    .on("postgres_changes", { event: "*", schema: "public" }, debounced)
    .subscribe();
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
export const PRIV_GROUPS = [
  ["Planning Board", [["create", "Create Activities"], ["editOwn", "Edit Own Company Work"], ["editAny", "Edit Any Company Work"], ["del", "Delete Activities"], ["commit", "Commit Weekly Plan"], ["editCommitted", "Edit Committed Work"], ["delay", "Record Delays"]]],
  ["Witnessing", [["witnessReq", "Set Witness Requirements"], ["witnessSend", "Send Witness Invitations"], ["requestInv", "Request Invites"], ["witnessOutcome", "Record Witness Outcomes"], ["retest", "Declare Retests"]]],
  ["Progress And Reports", [["importWb", "Import Cx Workbook"], ["cxConfig", "Configure Cx Progress"], ["weekly", "Generate Weekly Report"], ["distList", "Manage Distribution List"]]],
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
