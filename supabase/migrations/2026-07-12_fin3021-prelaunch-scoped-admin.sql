-- Applied to nbukhiaczzebfsyxofga via SQL Editor on 2026-07-12 (v2 with uuid casts).
-- fin3021-prelaunch-scoped-admin.sql
-- v2 fix: five module tables (asset_vendor, docs_column_ref, docs_matrix,
-- docs_override, docs_status_config) store project_id as text, so their policies
-- cast the column to uuid before the admin check. Run the data sanity check
-- first (five zeros expected); everything else is unchanged from v1.
-- The FIN3021 pre-launch review, part 1 of 2 (the SQL half). Scopes the remaining
-- globally-gated admin policies to the project, so a FIN3021 project admin can run
-- their own project and a FIN04 admin holds no silent power over FIN3021 data.
--
-- BEFORE APPLYING, re-run the affected-users check (it returned zero rows on
-- 2026-07-12; confirm that still holds):
--   select p.id, p.name from profiles p
--    where p.role = 'admin' and coalesce(p.platform_role,'') not in ('owner','super')
--      and not exists (select 1 from project_members m
--                       where m.user_id = p.id and m.role = 'admin');
-- Zero rows -> nobody loses access. Then take a db-backup run, then apply whole.
--
-- Scoped here (project-domain tables, all carry project_id):
--   ACC:    acc_benchmarks, acc_benchmark_imports, acc_sync, acc_sync_events
--   Assets: asset_register, asset_status_config, asset_vendor
--   Docs:   docs_column_ref, docs_matrix, docs_override, docs_status_config, docs_vendor_target
--   Other:  crews, cx_step_reference, audit_log (read), report_recipients,
--           invite_requests, project_companies (drops its redundant global half)
-- Deliberately left global (part 2 below explains): profiles, presence, activity_snapshots.

-- ACC
drop policy if exists admin_acc_benchmarks on public.acc_benchmarks;
create policy admin_acc_benchmarks on public.acc_benchmarks for all to authenticated
  using (public.is_cx_admin(project_id)) with check (public.is_cx_admin(project_id));
drop policy if exists insert_acc_benchmark_imports on public.acc_benchmark_imports;
create policy insert_acc_benchmark_imports on public.acc_benchmark_imports for insert to authenticated
  with check (public.is_cx_admin(project_id));
drop policy if exists admin_acc_sync on public.acc_sync;
create policy admin_acc_sync on public.acc_sync for all to authenticated
  using (public.is_cx_admin(project_id)) with check (public.is_cx_admin(project_id));
drop policy if exists admin_acc_sync_events on public.acc_sync_events;
create policy admin_acc_sync_events on public.acc_sync_events for all to authenticated
  using (public.is_cx_admin(project_id)) with check (public.is_cx_admin(project_id));

-- Assets
drop policy if exists admin_asset_register on public.asset_register;
create policy admin_asset_register on public.asset_register for all to authenticated
  using (public.is_cx_admin(project_id)) with check (public.is_cx_admin(project_id));
drop policy if exists admin_asset_status_config on public.asset_status_config;
create policy admin_asset_status_config on public.asset_status_config for all to authenticated
  using (public.is_cx_admin(project_id)) with check (public.is_cx_admin(project_id));
drop policy if exists admin_asset_vendor on public.asset_vendor;
create policy admin_asset_vendor on public.asset_vendor for all to authenticated
  using (public.is_cx_admin(project_id::uuid)) with check (public.is_cx_admin(project_id::uuid));

-- Documentation
drop policy if exists admin_docs_column_ref on public.docs_column_ref;
create policy admin_docs_column_ref on public.docs_column_ref for all to authenticated
  using (public.is_cx_admin(project_id::uuid)) with check (public.is_cx_admin(project_id::uuid));
drop policy if exists admin_docs_matrix on public.docs_matrix;
create policy admin_docs_matrix on public.docs_matrix for all to authenticated
  using (public.is_cx_admin(project_id::uuid)) with check (public.is_cx_admin(project_id::uuid));
drop policy if exists admin_docs_override on public.docs_override;
create policy admin_docs_override on public.docs_override for all to authenticated
  using (public.is_cx_admin(project_id::uuid)) with check (public.is_cx_admin(project_id::uuid));
drop policy if exists admin_docs_status_config on public.docs_status_config;
create policy admin_docs_status_config on public.docs_status_config for all to authenticated
  using (public.is_cx_admin(project_id::uuid)) with check (public.is_cx_admin(project_id::uuid));
drop policy if exists admin_docs_vendor_target on public.docs_vendor_target;
create policy admin_docs_vendor_target on public.docs_vendor_target for all to authenticated
  using (public.is_cx_admin(project_id)) with check (public.is_cx_admin(project_id));

-- Crews, Cx step reference, audit read, report recipients
drop policy if exists admin_crews on public.crews;
create policy admin_crews on public.crews for all to authenticated
  using (public.is_cx_admin(project_id)) with check (public.is_cx_admin(project_id));
drop policy if exists admin_cx_step_reference on public.cx_step_reference;
create policy admin_cx_step_reference on public.cx_step_reference for all to authenticated
  using (public.is_cx_admin(project_id)) with check (public.is_cx_admin(project_id));
drop policy if exists admin_read_audit on public.audit_log;
create policy admin_read_audit on public.audit_log for select to authenticated
  using (public.is_cx_admin(project_id));
drop policy if exists admin_report_recipients on public.report_recipients;
create policy admin_report_recipients on public.report_recipients for all to authenticated
  using (public.is_cx_admin(project_id)) with check (public.is_cx_admin(project_id));

-- Invite requests: requester keeps self-read; admin side scopes to the project
drop policy if exists read_invite_requests on public.invite_requests;
create policy read_invite_requests on public.invite_requests for select to authenticated
  using ((requester_id = auth.uid()) or public.is_cx_admin(project_id));
drop policy if exists update_invite_requests on public.invite_requests;
create policy update_invite_requests on public.invite_requests for update to authenticated
  using (public.is_cx_admin(project_id)) with check (public.is_cx_admin(project_id));
drop policy if exists delete_invite_requests on public.invite_requests;
create policy delete_invite_requests on public.invite_requests for delete to authenticated
  using (public.is_cx_admin(project_id));

-- Project companies: the scoped half already existed inside an OR; make it pure
drop policy if exists write_project_companies on public.project_companies;
create policy write_project_companies on public.project_companies for all to authenticated
  using (public.is_cx_admin(project_id)) with check (public.is_cx_admin(project_id));

-- V1: no policy in public should reference bare is_admin() any more, except the
-- three deliberately global tables. Expect exactly: profiles, presence, activity_snapshots.
select tablename, policyname from pg_policies
 where schemaname = 'public'
   and (coalesce(qual,'') ~ '\mis_admin\(\)' or coalesce(with_check,'') ~ '\mis_admin\(\)')
 order by tablename;
-- V2: spot check one scoped table. Expect a single row mentioning is_cx_admin.
select policyname, qual from pg_policies where tablename = 'docs_matrix';

-- ============ PART 2, the non-SQL half of the review (checklist) ============
-- Left global on purpose:
--   profiles: people exist across projects, and the real mutations run through the
--     admin-users edge function with the service role; the RLS gate is a backstop.
--   presence: no project_id column; who-is-online is low sensitivity, admin-read only.
--   activity_snapshots: no project_id column; scoping needs a backfilled column
--     (derivable from audit_log). Optional hardening, not a launch blocker; the leak
--     is cross-project READ of change snapshots by legacy admins only.
-- Go-live configuration on the FIN3021 project itself, in the app:
--   working calendar Mon-Sat, 10h day; Vantaa location; branding logos;
--   digest + Morning Cx Update configured per project (they are project-scoped);
--   witness contacts routing reviewed for FIN3021's contractor set;
--   member roster with at least one project admin who is not relying on the
--     legacy global flag, which after this migration is the only kind there is.
