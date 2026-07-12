-- REV244: append-only daily updates per activity.
-- Run ONCE in the Supabase SQL Editor. Run a database backup (GitHub Actions
-- db-backup workflow) first. Apply BEFORE using the YTT daily-update composer on the
-- REV244 client; until applied, the client shows a banner in the expansion instead.
--
-- Design: a dedicated table with an insert policy for admins/owner, a read policy for
-- project members, and deliberately NO update or delete policies, so every entry is
-- immutable for everyone (including admins) at the database level.

create table if not exists public.activity_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  activity_id uuid not null,
  at timestamptz not null default now(),
  by_id uuid default auth.uid(),
  by_name text not null default '',
  pct integer,
  note text not null,
  constraint activity_updates_note_len check (char_length(note) between 1 and 4000),
  constraint activity_updates_pct_range check (pct is null or (pct between 0 and 100))
);
create index if not exists activity_updates_act_at_idx on public.activity_updates (activity_id, at desc);
create index if not exists activity_updates_project_at_idx on public.activity_updates (project_id, at desc);

alter table public.activity_updates enable row level security;

drop policy if exists read_activity_updates on public.activity_updates;
create policy read_activity_updates on public.activity_updates for select to authenticated
  using (public.is_cx_admin(project_id) or exists (
    select 1 from public.project_members m
     where m.project_id = activity_updates.project_id and m.user_id = auth.uid()));

drop policy if exists insert_activity_updates on public.activity_updates;
create policy insert_activity_updates on public.activity_updates for insert to authenticated
  with check (public.is_cx_admin(project_id));

-- No UPDATE or DELETE policies on purpose: entries cannot be edited or removed by anyone.

-- Every daily update lands in the audit log, same pattern as the activity triggers.
create or replace function public.audit_activity_updates() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare uname text;
begin
  select coalesce(name,'') into uname from profiles where id = auth.uid();
  insert into audit_log(user_id, user_name, action, entity, entity_id, detail, project_id)
  values (auth.uid(), coalesce(nullif(uname, ''), new.by_name), 'Daily update', 'activity', new.activity_id::text,
          left(new.note, 160) || case when new.pct is not null then ' (' || new.pct || '%)' else '' end, new.project_id);
  return new;
end $$;
drop trigger if exists trg_audit_activity_updates on public.activity_updates;
create trigger trg_audit_activity_updates after insert on public.activity_updates
  for each row execute function public.audit_activity_updates();

-- V1: expect exactly two policies (SELECT, INSERT) and none for UPDATE or DELETE.
select policyname, cmd from pg_policies where tablename = 'activity_updates' order by cmd;
-- V2: expect the trigger.
select tgname from pg_trigger where tgrelid = 'public.activity_updates'::regclass and not tgisinternal;
