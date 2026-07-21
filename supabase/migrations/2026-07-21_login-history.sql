-- REV324: read-only sign-in history for the Sign-in Log admin view.
-- Reads Supabase Auth's own audit trail (auth.audit_log_entries), so it also surfaces logins
-- from before this view existed, back as far as that table is retained.
-- SECURITY DEFINER because the auth schema is not exposed to PostgREST; the owner/super gate is
-- enforced inside, so only platform owners and supers can read other users' login history and IPs.
create or replace function public.login_history(p_search text default null, p_days integer default 30)
returns table (at timestamptz, user_id uuid, email text, name text, ip text, provider text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select e.created_at as at,
         nullif(e.payload->>'actor_id', '')::uuid as user_id,
         coalesce(e.payload->>'actor_username', e.payload->>'actor_name') as email,
         p.name as name,
         e.ip_address::text as ip,
         e.payload->'traits'->>'provider' as provider
  from auth.audit_log_entries e
  left join public.profiles p on p.id = nullif(e.payload->>'actor_id', '')::uuid
  where (public.is_owner() or public.is_super())
    and e.payload->>'action' = 'login'
    and (p_days is null or p_days <= 0 or e.created_at >= now() - make_interval(days => p_days))
    and (
      p_search is null or p_search = ''
      or coalesce(e.payload->>'actor_username', '') ilike '%' || p_search || '%'
      or coalesce(p.name, '') ilike '%' || p_search || '%'
      or coalesce(e.ip_address::text, '') ilike '%' || p_search || '%'
    )
  order by e.created_at desc
  limit 2000;
$$;

revoke all on function public.login_history(text, integer) from public;
grant execute on function public.login_history(text, integer) to authenticated;
