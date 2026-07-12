// Captured verbatim from the live Supabase deployment on 2026-07-12 (dashboard Code tab).
// Supersedes the stale 69-line repo copy (invite/update/delete only, legacy gate): the live
// function carries the REV104 owner protections, the setup-token onboarding model
// (claiminvite), setpassword/link/resetpw/passwordchanged and the status op the app relies on.
// This file is now the deployable truth.
// Supabase Edge Function: admin-users
// Admin-only user management. Uses the service role key, which stays server-side.
// Deploy:  supabase functions deploy admin-users --no-verify-jwt
// (it verifies the caller itself, see below)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Readable temporary password (no easily-confused characters).
function genPw(len = 12): string {
  const cs = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let p = "";
  for (let i = 0; i < len; i++) p += cs[arr[i] % cs.length];
  return p;
}

// A long, single-use invite token (256 bits, URL-safe).
function genToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Store a fresh setup token on the profile and return a link to the app's setup
// page. The link is good for 30 days and is consumed only when the user submits
// their chosen password, so mail-scanner prefetching cannot burn it.
// deno-lint-ignore no-explicit-any
async function makeSetupLink(admin: any, userId: string, redirect?: string): Promise<{ link: string; linkError: string }> {
  const base = (redirect || Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");
  const token = genToken();
  const expires = new Date(Date.now() + 30 * 86400000).toISOString();
  const { error } = await admin.from("profiles").update({ invite_token: token, invite_expires: expires }).eq("id", userId);
  if (error) return { link: "", linkError: error.message };
  if (!base) return { link: "", linkError: "No app URL available (pass redirect or set SITE_URL)" };
  return { link: `${base}/?token=${token}`, linkError: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);
    const body = await req.json();

    // PUBLIC, no session required. Guarded entirely by the secret token in the
    // link. Sets the user's chosen password and signs the account up for use.
    if (body.op === "claiminvite") {
      const { token, password } = body;
      if (!token || !password) return json({ error: "token and password required" }, 400);
      if (String(password).length < 8) return json({ error: "Use at least 8 characters." }, 400);
      const { data: p, error: pe } = await admin.from("profiles").select("id, invite_expires, platform_role").eq("invite_token", token).maybeSingle();
      if (pe) return json({ error: pe.message }, 400);
      if (!p) return json({ error: "This setup link is invalid or has already been used. Ask your administrator for a new one." }, 400);
      // REV104: the owner account never onboards through an invite link. A link
      // targeting the owner would otherwise let its holder set the owner password.
      if (p.platform_role === "owner")
        return json({ error: "The owner account cannot be set up through an invite link." }, 400);
      if (p.invite_expires && new Date(p.invite_expires).getTime() < Date.now())
        return json({ error: "This setup link has expired. Ask your administrator for a new one." }, 400);
      const { error: ue } = await admin.auth.admin.updateUserById(p.id, { password, email_confirm: true });
      if (ue) return json({ error: ue.message }, 400);
      await admin.from("profiles").update({ invite_token: null, invite_expires: null, must_reset: false }).eq("id", p.id);
      const { data: u } = await admin.auth.admin.getUserById(p.id);
      return json({ ok: true, email: u?.user?.email || "" });
    }

    // identify the caller from their bearer token
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return json({ error: "Not signed in" }, 401);

    // Any authenticated user may clear their own first-login reset flag.
    if (body.op === "passwordchanged") {
      await admin.from("profiles").update({ must_reset: false }).eq("id", user.id);
      return json({ ok: true });
    }

    // Everything else is admin-only (checked with the privileged client).
    // REV104: the gate now also accepts platform supers and the owner, so it
    // cannot drift out of step with the app, which already treats them as
    // admins everywhere. It only widens for people the app already trusts.
    const { data: prof } = await admin.from("profiles").select("role, platform_role").eq("id", user.id).single();
    const callerIsOwner = prof?.platform_role === "owner";
    const callerIsAdmin = !!prof && (prof.role === "admin" || prof.platform_role === "super" || callerIsOwner);
    if (!callerIsAdmin) return json({ error: "Admins only" }, 403);

    // REV104: owner protection. Password and link operations run through
    // auth.admin, which the database triggers cannot see, so without this gate
    // any admin could take over the owner account by resetting its password or
    // minting a setup link for it. Every operation that targets the owner's
    // account is refused unless the caller IS the owner.
    const targetId = typeof body.id === "string" ? body.id : "";
    if (targetId && ["update", "setpassword", "resetpw", "link", "delete"].includes(body.op) && !callerIsOwner) {
      const { data: target } = await admin.from("profiles").select("platform_role").eq("id", targetId).maybeSingle();
      if (target?.platform_role === "owner")
        return json({ error: "The owner account can only be managed by the owner." }, 403);
    }

    switch (body.op) {
      case "invite": {
        const { email, name, role, company_id } = body;
        if (!email) return json({ error: "Email required" }, 400);
        const tempPassword = genPw();
        const { data, error } = await admin.auth.admin.createUser({
          email, password: tempPassword, email_confirm: true, user_metadata: { name },
        });
        if (error) {
          const m = (error.message || "").toLowerCase();
          if (m.includes("already") || m.includes("registered") || m.includes("exists"))
            return json({ error: "That email already has an account. If it was removed, check Authentication > Users and delete any leftover entry, then try again." }, 400);
          return json({ error: error.message }, 400);
        }
        await admin.from("profiles").upsert({
          id: data.user.id, name: name || email, role: role || "member", company_id: company_id || null, must_reset: true,
        });
        const { link, linkError } = await makeSetupLink(admin, data.user.id, body.redirect);
        return json({ ok: true, id: data.user.id, link, linkError });
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
      case "setpassword": {
        const { id, password } = body;
        if (!id || !password) return json({ error: "id and password required" }, 400);
        const { error } = await admin.auth.admin.updateUserById(id, { password, email_confirm: true });
        if (error) throw error;
        return json({ ok: true });
      }
      case "link": {
        const { id } = body;
        if (!id) return json({ error: "id required" }, 400);
        const { link, linkError } = await makeSetupLink(admin, id, body.redirect);
        if (!link) return json({ error: linkError || "Could not generate link" }, 400);
        return json({ ok: true, link });
      }
      case "resetpw": {
        const { id } = body;
        if (!id) return json({ error: "id required" }, 400);
        const tempPassword = genPw();
        const { error } = await admin.auth.admin.updateUserById(id, { password: tempPassword });
        if (error) return json({ error: error.message }, 400);
        await admin.from("profiles").update({ must_reset: true }).eq("id", id);
        return json({ ok: true, tempPassword });
      }
      case "delete": {
        const { id } = body;
        if (id === user.id) return json({ error: "You cannot delete yourself" }, 400);
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) throw error;
        return json({ ok: true });
      }
      case "status": {
        const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (error) return json({ error: error.message }, 400);
        const users = (data?.users || []).map((u: any) => ({ id: u.id, email: u.email || null, lastSignIn: u.last_sign_in_at || null, createdAt: u.created_at || null }));
        return json({ ok: true, users });
      }
      default:
        return json({ error: "Unknown op" }, 400);
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
