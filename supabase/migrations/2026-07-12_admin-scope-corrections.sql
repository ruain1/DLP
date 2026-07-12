-- 2026-07-12_admin-scope-corrections.sql (applied to live 2026-07-12; committed post-apply)
-- Findings from the is_admin live audit. Run a database backup first. Items are
-- independent; apply all three or strike any before running.

-- ITEM 1 (defect, REV110 class): is_admin_somewhere() honours super but NOT the owner.
-- It delegates to is_super(), which checks platform_role = 'super' only, so a pure
-- owner without a project_members admin row would be denied on companies and vendors.
-- Masked today because the owner is also a FIN04 project admin. Targeted fix: give
-- this one function its own owner branch; is_super() itself is left alone in case
-- anything relies on its strict super-only meaning.
create or replace function public.is_admin_somewhere() returns boolean
    language sql stable security definer
    set search_path to 'public'
    as $$
  select exists (select 1 from profiles
                  where id = auth.uid() and platform_role in ('super', 'owner'))
      or exists (select 1 from project_members
                  where user_id = auth.uid() and role = 'admin');
$$;

-- ITEM 2 (blocking before FIN3021 manual sends): report_runs is gated by global
-- is_admin(), so a FIN3021 project admin without the legacy profiles.role = 'admin'
-- cannot claim or record a run (Send now fails at the claim). The table has carried
-- project_id since REV219; scope the policy to the project.
-- Caveat: a legacy profiles.role = 'admin' user who is NOT a project_members admin
-- loses report_runs access; confirm no such person should keep it before applying.
drop policy if exists admin_report_runs on public.report_runs;
create policy admin_report_runs on public.report_runs for all to authenticated
  using (public.is_cx_admin(project_id)) with check (public.is_cx_admin(project_id));

-- ITEM 3 (hygiene): cx_config and cx_week each carry TWO permissive ALL policies,
-- global is_admin() plus scoped is_cx_admin(project_id). Permissive policies OR
-- together, so the global one makes the scoped one meaningless. Drop the legacy
-- globals; owner and super still pass through is_cx_admin's platform branch.
-- Same caveat as item 2 for legacy-role-only admins.
drop policy if exists admin_cx_config on public.cx_config;
drop policy if exists admin_cx_week on public.cx_week;

-- V1: is_admin_somewhere now names the owner. Expect one row containing 'owner'.
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'is_admin_somewhere'
   and pg_get_functiondef(p.oid) like '%''owner''%';
-- V2: report_runs policy is project-scoped. Expect the single row to mention is_cx_admin.
select policyname, qual from pg_policies where tablename = 'report_runs';
-- V3: one policy each remains on cx_config and cx_week. Expect cx_config_admin and cx_week_admin only.
select tablename, policyname from pg_policies where tablename in ('cx_config', 'cx_week') order by 1;
