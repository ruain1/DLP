-- REV326: Morning meeting attendance.
-- One row per project per meeting date, holding the parsed Teams attendance
-- report. The Morning Cx Update email attaches the newest row whose meeting
-- falls within 26 hours of the send boundary. project_id is present from day
-- one (the report_runs table's missing project_id is a known defect; this
-- table does not repeat it).
--
-- Run this in the Supabase SQL editor BEFORE using the attendance feature.
-- The app tolerates the table being absent (the drawer shows the database
-- error banner and the email simply omits the block), but nothing persists
-- until this has run.

create table if not exists public.morning_attendance (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  meeting_date date not null,
  meeting_title text default '',
  meeting_start timestamptz,
  duration_min integer,
  source_filename text default '',
  participants jsonb not null default '[]'::jsonb,
  uploaded_by uuid,
  uploaded_by_name text default '',
  uploaded_at timestamptz not null default now(),
  unique (project_id, meeting_date)
);

alter table public.morning_attendance enable row level security;

-- Read: any authenticated user (matches act_read and the other project tables;
-- the app scopes queries by project_id).
drop policy if exists ma_read on public.morning_attendance;
create policy ma_read on public.morning_attendance
  for select to authenticated using (true);

-- Write: project Cx admins, supers and the owner (matches admin_acc_benchmarks).
drop policy if exists ma_admin on public.morning_attendance;
create policy ma_admin on public.morning_attendance
  to authenticated
  using (public.is_cx_admin(project_id))
  with check (public.is_cx_admin(project_id));

-- ---------------------------------------------------------------------------
-- Verification (run after the above; both must return rows):
--
-- select column_name, data_type from information_schema.columns
--   where table_schema = 'public' and table_name = 'morning_attendance'
--   order by ordinal_position;
--
-- select policyname, cmd from pg_policies
--   where schemaname = 'public' and tablename = 'morning_attendance';
-- ---------------------------------------------------------------------------
