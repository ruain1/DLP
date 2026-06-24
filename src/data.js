import { supabase } from "./supabaseClient";

// ---- field mapping (db row <-> client activity) ----
const fromActivity = (r) => ({
  id: r.id, desc: r.descr || "", companyId: r.company_id || "", area: r.area || "", system: r.system || "",
  level: r.level || "L2", isMilestone: !!r.is_milestone, start: r.start_date || "", duration: r.duration || 1,
  committed: !!r.committed, status: r.status || "planned", actualStart: r.actual_start || "", actualFinish: r.actual_finish || "",
  subArea: r.sub_area || "", tier3: r.tier3 || "", asset: r.asset || "", witnessInvite: !!r.witness_invite, witnessAt: r.witness_at || "", notes: r.notes || "", slipReason: r.slip_reason || "",
  code: r.code ?? null, predecessors: Array.isArray(r.predecessors) ? r.predecessors : [],
  constraints: Array.isArray(r.constraints) ? r.constraints : [],
  reschedules: Array.isArray(r.reschedules) ? r.reschedules : [],
});
const toActivity = (a, session, isNew) => {
  const row = {
    id: a.id, descr: a.desc || "", company_id: a.companyId || null, area: a.area || null, system: a.system || null,
    level: a.level, is_milestone: !!a.isMilestone, start_date: a.start || null, duration: a.duration || 1,
    committed: !!a.committed, status: a.status, actual_start: a.actualStart || null, actual_finish: a.actualFinish || null,
    sub_area: a.subArea || null, tier3: a.tier3 || null, asset: a.asset || null, witness_invite: !!a.witnessInvite, witness_at: a.witnessAt || null, notes: a.notes || null, slip_reason: a.slipReason || null,
    code: isNew ? null : (a.code ?? null), predecessors: a.predecessors || [],
    constraints: a.constraints || [], reschedules: a.reschedules || [], updated_by: session.user.id, updated_at: new Date().toISOString(),
  };
  if (isNew) row.created_by = session.user.id;
  return row;
};

// ---- load everything into the client state shape ----
export async function loadAll(session) {
  const [companies, areas, systems, levels, settings, profiles, activities, audit, branding, subAreas, tier3s] = await Promise.all([
    supabase.from("companies").select("*").order("name"),
    supabase.from("areas").select("*").order("name"),
    supabase.from("systems").select("*").order("name"),
    supabase.from("levels").select("*").order("sort"),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("profiles").select("*").order("name"),
    supabase.from("activities").select("*"),
    supabase.from("audit_log").select("*").order("ts", { ascending: false }).limit(500),
    supabase.from("branding").select("*").eq("id", 1).maybeSingle(),
    supabase.from("sub_areas").select("*").order("name"),
    supabase.from("tier3_areas").select("*").order("name"),
  ]);
  const levelsObj = {};
  (levels.data || []).forEach((l) => { levelsObj[l.key] = { name: l.name, color: l.color, sort: l.sort }; });
  return {
    companies: (companies.data || []).map((c) => ({ id: c.id, name: c.name, logoUrl: c.logo_url || "", logoDark: c.logo_url_dark || "", description: c.description || "", domain: c.domain || "" })),
    areas: (areas.data || []).map((a) => a.name),
    systems: (systems.data || []).map((s) => s.name),
    levels: levelsObj,
    settings: { weeks: settings.data?.weeks ?? 4, makeReadyDays: settings.data?.make_ready_days ?? 7 },
    users: (profiles.data || []).map((p) => ({ id: p.id, name: p.name, role: p.role, companyId: p.company_id, mustReset: !!p.must_reset })),
    activities: (activities.data || []).map(fromActivity),
    audit: (audit.data || []).map((e) => ({ id: e.id, ts: e.ts, user: e.user_name, action: e.action, detail: e.detail })),
    brand: brandFrom(branding.data),
    subAreas: (subAreas.data || []).map((s) => ({ area: s.area, name: s.name })),
    tier3s: (tier3s.data || []).map((t) => ({ area: t.area, subArea: t.sub_area, name: t.name })),
  };
}

const brandFrom = (d) => ({
  projectName: d?.project_name ?? "FIN04",
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
export async function syncCollections(prev, next, session) {
  const ops = [];
  // activities (keyed by id)
  if (next.activities !== prev.activities) {
    const pm = Object.fromEntries(prev.activities.map((a) => [a.id, a]));
    const nm = Object.fromEntries(next.activities.map((a) => [a.id, a]));
    const ups = [];
    next.activities.forEach((a) => { if (!pm[a.id] || JSON.stringify(pm[a.id]) !== JSON.stringify(a)) ups.push(toActivity(a, session, !pm[a.id])); });
    const del = prev.activities.filter((a) => !nm[a.id]).map((a) => a.id);
    if (ups.length) ops.push(supabase.from("activities").upsert(ups));
    if (del.length) ops.push(supabase.from("activities").delete().in("id", del));
  }
  // companies (keyed by id)
  if (next.companies !== prev.companies) {
    const nm = Object.fromEntries(next.companies.map((c) => [c.id, c]));
    const pm = Object.fromEntries(prev.companies.map((c) => [c.id, c]));
    const ups = next.companies.filter((c) => !pm[c.id] || pm[c.id].name !== c.name || (pm[c.id].logoUrl || "") !== (c.logoUrl || "") || (pm[c.id].logoDark || "") !== (c.logoDark || "") || (pm[c.id].description || "") !== (c.description || "")).map((c) => ({ id: c.id, name: c.name, logo_url: c.logoUrl || null, logo_url_dark: c.logoDark || null, description: c.description || null }));
    const del = prev.companies.filter((c) => !nm[c.id]).map((c) => c.id);
    if (ups.length) ops.push(supabase.from("companies").upsert(ups));
    if (del.length) ops.push(supabase.from("companies").delete().in("id", del));
  }
  // areas / systems (string arrays keyed by name)
  for (const key of ["areas", "systems"]) {
    if (next[key] !== prev[key]) {
      const add = next[key].filter((x) => !prev[key].includes(x)).map((name) => ({ name }));
      const rem = prev[key].filter((x) => !next[key].includes(x));
      if (add.length) ops.push(supabase.from(key).upsert(add));
      if (rem.length) ops.push(supabase.from(key).delete().in("name", rem));
    }
  }
  // levels (object keyed by L1..)
  if (next.levels !== prev.levels) {
    const ups = Object.entries(next.levels)
      .filter(([k, v]) => !prev.levels[k] || prev.levels[k].name !== v.name || prev.levels[k].color !== v.color)
      .map(([k, v], i) => ({ key: k, name: v.name, color: v.color, sort: v.sort ?? i }));
    if (ups.length) ops.push(supabase.from("levels").upsert(ups));
    const rem = Object.keys(prev.levels).filter((k) => !next.levels[k]);
    if (rem.length) ops.push(supabase.from("levels").delete().in("key", rem));
  }
  // sub-areas (keyed by area+name)
  if (next.subAreas !== prev.subAreas) {
    const k = (s) => s.area + "\u0001" + s.name;
    const pset = new Set((prev.subAreas || []).map(k));
    const nset = new Set((next.subAreas || []).map(k));
    const add = (next.subAreas || []).filter((s) => !pset.has(k(s))).map((s) => ({ area: s.area, name: s.name }));
    const rem = (prev.subAreas || []).filter((s) => !nset.has(k(s)));
    if (add.length) ops.push(supabase.from("sub_areas").upsert(add));
    rem.forEach((s) => ops.push(supabase.from("sub_areas").delete().match({ area: s.area, name: s.name })));
  }
  // tier 3 areas (keyed by area+sub+name)
  if (next.tier3s !== prev.tier3s) {
    const k = (t) => t.area + "\u0001" + t.subArea + "\u0001" + t.name;
    const pset = new Set((prev.tier3s || []).map(k));
    const nset = new Set((next.tier3s || []).map(k));
    const add = (next.tier3s || []).filter((t) => !pset.has(k(t))).map((t) => ({ area: t.area, sub_area: t.subArea, name: t.name }));
    const rem = (prev.tier3s || []).filter((t) => !nset.has(k(t)));
    if (add.length) ops.push(supabase.from("tier3_areas").upsert(add));
    rem.forEach((t) => ops.push(supabase.from("tier3_areas").delete().match({ area: t.area, sub_area: t.subArea, name: t.name })));
  }
  // settings (singleton)
  if (next.settings !== prev.settings) {
    ops.push(supabase.from("settings").upsert({ id: 1, weeks: next.settings.weeks, make_ready_days: next.settings.makeReadyDays }));
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

// Admin: save name / tagline. patch keys are db column names.
export async function updateBranding(patch) {
  const { error } = await supabase.from("branding").upsert({ id: 1, ...patch });
  if (error) throw error;
}

// Admin: upload a customer logo file, return its public URL, and store it (light or dark slot).
export async function uploadLogo(file, dark = false) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `logo-${dark ? "dark-" : ""}${Date.now()}.${ext}`;
  const up = await supabase.storage.from("branding").upload(path, file, { upsert: true, cacheControl: "3600" });
  if (up.error) throw up.error;
  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  const url = data.publicUrl;
  await updateBranding({ [dark ? "logo_url_dark" : "logo_url"]: url });
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
