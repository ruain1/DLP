// Supabase Edge Function: admin-users
// Admin-only user management. Uses the service role key, which stays server-side.
// Deploy:  supabase functions deploy admin-users --no-verify-jwt
// (it verifies the caller itself, see below)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // identify the caller from their bearer token
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    // confirm the caller is an admin (checked with the privileged client)
    const admin = createClient(url, service);
    const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (!prof || prof.role !== "admin") return json({ error: "Admins only" }, 403);

    const body = await req.json();
    switch (body.op) {
      case "invite": {
        const { email, name, role, company_id } = body;
        if (!email) return json({ error: "Email required" }, 400);
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { name } });
        if (error) throw error;
        await admin.from("profiles").upsert({
          id: data.user.id, name: name || email, role: role || "member", company_id: company_id || null,
        });
        return json({ ok: true, id: data.user.id });
      }
      case "update": {
        const { id, role, company_id, name } = body;
        const patch: Record<string, unknown> = {};
        if (role !== undefined) patch.role = role;
        if (company_id !== undefined) patch.company_id = company_id;
        if (name !== undefined) patch.name = name;
        const { error } = await admin.from("profiles").update(patch).eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }
      case "delete": {
        const { id } = body;
        if (id === user.id) return json({ error: "You cannot delete yourself" }, 400);
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;
        return json({ ok: true });
      }
      default:
        return json({ error: "Unknown op" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
