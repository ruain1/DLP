-- REV218 companion (DB-only; apply any time in the Supabase SQL Editor).
-- is_cx_admin() previously granted the platform bypass to platform_role = 'super' only,
-- so the owner account depended on explicit project_members admin rows for Cx config
-- and Cx week writes. This aligns it with is_admin(): owner and super both pass.
-- Run a database backup (GitHub Actions db-backup workflow) before applying.

create or replace function public.is_cx_admin(p_project uuid) returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$
  select
    exists (select 1 from public.profiles
             where id = auth.uid() and platform_role in ('super', 'owner'))
    or exists (select 1 from public.project_members
                where project_id = p_project
                  and user_id = auth.uid()
                  and role = 'admin');
$$;

-- V1: the definition now contains the owner branch
select pg_get_functiondef('public.is_cx_admin(uuid)'::regprocedure);
