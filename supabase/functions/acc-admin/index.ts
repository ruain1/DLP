// Captured verbatim from the live Supabase deployment on 2026-07-12 (dashboard Code tab).
// The repo previously held no copy of this function; this file is the deployable truth.
// Known follow-up (REV163): the admin gate below checks the legacy profiles.role only;
// switch it to the is_cx_admin(project_id) RPC when the ACC backend is enabled.
// Supabase Edge Function: acc-admin
// REV162 skeleton for the one way ACC to DLP sync. Owner and Admin only, verified server
// side exactly like admin-users. The "status" op is live now and reads the project scoped
// acc_sync tables. Every mutation (connect, register webhook, set file, reconcile, pause)
// returns a not yet enabled response until REV163, when the ACC service identity and the
// unattended token model are in place. This function never talks to Autodesk in REV162.
// Deploy:  supabase functions deploy acc-admin --no-verify-jwt
//   (it verifies the caller itself, see below)

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

    // Identify the caller from their bearer token.
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    // Confirm the caller is an admin, checked with the privileged client. The Connections tab
    // is already admin gated in the app; this is the server side backstop.
    const admin = createClient(url, service);
    const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (!prof || prof.role !== "admin") return json({ error: "Owner and Admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const op = body.op as string;
    const projectId = body.project_id as string | undefined;

    switch (op) {
      case "status": {
        if (!projectId) return json({ error: "project_id required" }, 400);
        const { data: cfg } = await admin.from("acc_sync").select("*").eq("project_id", projectId).maybeSingle();
        const { data: events } = await admin
          .from("acc_sync_events").select("*")
          .eq("project_id", projectId).order("ts", { ascending: false }).limit(10);
        return json({ config: cfg || null, events: events || [] });
      }
      // REV163: connect, register_webhook, set_file, reconcile, pause, resume.
      case "connect":
      case "register_webhook":
      case "set_file":
      case "reconcile":
      case "pause":
      case "resume":
        return json({ error: "ACC sync backend is enabled in REV163", op }, 501);
      default:
        return json({ error: "Unknown op", op }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
