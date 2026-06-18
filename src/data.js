import { supabase } from "./supabaseClient";

// ---- field mapping (db row <-> client activity) ----
const fromActivity = (r) => ({
  id: r.id, desc: r.descr || "", companyId: r.company_id || "", area: r.area || "", system: r.system || "",
  level: r.level || "L2", isMilestone: !!r.is_milestone, start: r.start_date || "", duration: r.duration || 1,
  committed: !!r.committed, status: r.status || "planned", actualStart: r.actual_start || "", actualFinish: r.actual_finish || "",
  subArea: r.sub_area || "", tier3: r.tier3 || "", witnessInvite: !!r.witness_invite, notes: r.notes || "",
  constraints: Array.isArray(r.constraints) ? r.constraints : [],
});
const toActivity = (a, session, isNew) => {
  const row = {
    id: a.id, descr: a.desc || "", company_id: a.companyId || null, area: a.area || null, system: a.system || null,
    level: a.level, is_milestone: !!a.isMilestone, start_date: a.start || null, duration: a.duration || 1,
    committed: !!a.committed, status: a.status, actual_start: a.actualStart || null, actual_finish: a.actualFinish || null,
    sub_area: a.subArea || null, tier3: a.tier3 || null, witness_invite: !!a.witnessInvite, notes: a.notes || null,
    constraints: a.constraints || [], updated_by: session.user.id, updated_at: new Date().toISOString(),
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
    companies: (companies.data || []).map((c) => ({ id: c.id, name: c.name })),
    areas: (areas.data || []).map((a) => a.name),
    systems: (systems.data || []).map((s) => s.name),
    levels: levelsObj,
    settings: { weeks: settings.data?.weeks ?? 4, makeReadyDays: settings.data?.make_ready_days ?? 7 },
    users: (profiles.data || []).map((p) => ({ id: p.id, name: p.name, role: p.role, companyId: p.company_id })),
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
});

// Set the browser tab title and favicon from branding.
export function applyBrandToTab(brand) {
  if (!brand) return;
  document.title = `${brand.projectName || "FIN04"} ${brand.appName || "DLP"}`.trim();
  if (brand.logoUrl) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    link.href = brand.logoUrl;
  }
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
    const ups = next.companies.filter((c) => !pm[c.id] || pm[c.id].name !== c.name).map((c) => ({ id: c.id, name: c.name }));
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

export async function fetchAudit() {
  const { data } = await supabase.from("audit_log").select("*").order("ts", { ascending: false }).limit(500);
  return (data || []).map((e) => ({ id: e.id, ts: e.ts, user: e.user_name, action: e.action, detail: e.detail }));
}

export async function signOut() { await supabase.auth.signOut(); }

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

// Admin: upload a logo file, return its public URL, and store it.
export async function uploadLogo(file) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `logo-${Date.now()}.${ext}`;
  const up = await supabase.storage.from("branding").upload(path, file, { upsert: true, cacheControl: "3600" });
  if (up.error) throw up.error;
  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  const url = data.publicUrl;
  await updateBranding({ logo_url: url });
  return url;
}

export function subscribeAll(onChange) {
  let t;
  const debounced = () => { clearTimeout(t); t = setTimeout(onChange, 250); };
  return supabase
    .channel("fin04-all")
    .on("postgres_changes", { event: "*", schema: "public" }, debounced)
    .subscribe();
}
