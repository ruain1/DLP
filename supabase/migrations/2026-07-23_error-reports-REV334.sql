-- REV334: error reports. Members report a failed save from the error banner with one
-- press; admins work the queue in Settings > Support > Error Reports. Idempotent.

create table if not exists public.error_reports (
  id uuid primary key default gen_random_uuid(),
  ref bigint generated always as identity,
  ts timestamptz not null default now(),
  user_id uuid references public.profiles(id),
  user_name text,
  email text,
  project_id uuid,
  source text,
  raw_message text,
  plain_message text,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  admin_note text,
  resolved_by text,
  resolved_at timestamptz
);

alter table public.error_reports enable row level security;

drop policy if exists er_insert on public.error_reports;
create policy er_insert on public.error_reports for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists er_select on public.error_reports;
create policy er_select on public.error_reports for select to authenticated
using (public.is_admin());

drop policy if exists er_update on public.error_reports;
create policy er_update on public.error_reports for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- realtime delivery for the admin badge
do $$ begin
  begin
    alter publication supabase_realtime add table public.error_reports;
  exception when duplicate_object then null;
  end;
end $$;

-- verification:
--   select policyname, cmd from pg_policies where tablename = 'error_reports';
--   Expect er_insert (INSERT), er_select (SELECT), er_update (UPDATE).
-- rollback:
--   drop table if exists public.error_reports cascade;
