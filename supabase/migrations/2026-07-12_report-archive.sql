-- REV248: report archive + kind check fix. Run ONCE in the Supabase SQL Editor.
-- Run a database backup (GitHub Actions db-backup workflow) first.
--
-- IMPORTANT: this migration is REQUIRED for the Morning Cx Update (REV247) to send at all.
-- The live report_runs_kind_check still only allows 'daily' and 'weekly', so a 'morning'
-- claim insert violates it. This widens the check and adds the archive columns.

alter table public.report_runs drop constraint if exists report_runs_kind_check;
alter table public.report_runs add constraint report_runs_kind_check
  check (kind = any (array['daily'::text, 'weekly'::text, 'morning'::text, 'report'::text]));

alter table public.report_runs add column if not exists subject text;
alter table public.report_runs add column if not exists html text;

-- V1: expect the constraint to list all four kinds.
select conname, pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.report_runs'::regclass and conname = 'report_runs_kind_check';
-- V2: expect two rows.
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'report_runs' and column_name in ('subject', 'html');
