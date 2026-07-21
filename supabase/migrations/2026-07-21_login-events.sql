-- REV325: durable sign-in capture. One row per real login, written by a trigger on auth.sessions
-- (token refreshes update a session and do not insert, so they are not counted). Replaces the
-- REV324 read over auth.audit_log_entries, which was empty on this project because Postgres auth
-- audit storage was disabled. History starts from when this trigger goes live; there is no older
-- session data to backfill, so only currently-active sessions are seeded.

create table if not exists public.login_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  at         timestamptz not null default now(),
  ip         text,
  user_agent text,
  aal        text,
  session_id uuid unique
);
create index if not exists login_events_user_at_idx on public.login_events (user_id, at desc);
create index if not exists login_events_at_idx on public.login_events (at desc);

-- No client access. All reads go through the SECURITY DEFINER login_history function below.
alter table public.login_events enable row level security;

-- Trigger: mirror each new auth session into login_events. SECURITY DEFINER so it can write
-- regardless of the caller, exception-safe so a logging failure never blocks a sign-in.
create or replace function public.on_auth_session_created()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.login_events (user_id, at, ip, user_agent, aal, session_id)
  values (new.user_id, coalesce(new.created_at, now()), new.ip::text, new.user_agent, new.aal::text, new.id)
  on conflict (session_id) do nothing;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_login_events on auth.sessions;
create trigger trg_login_events
  after insert on auth.sessions
  for each row execute function public.on_auth_session_created();

-- Seed currently-active sessions so the log is not empty on day one.
insert into public.login_events (user_id, at, ip, user_agent, aal, session_id)
select s.user_id, s.created_at, s.ip::text, s.user_agent, s.aal::text, s.id
from auth.sessions s
on conflict (session_id) do nothing;

-- Repoint login_history from the (empty) audit table to login_events, and return user_agent
-- instead of provider. Same owner/super gate; drop first because the return columns change.
drop function if exists public.login_history(text, integer);
create function public.login_history(p_search text default null, p_days integer default 30)
returns table (at timestamptz, user_id uuid, email text, name text, ip text, user_agent text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select le.at,
         le.user_id,
         u.email::text as email,
         p.name as name,
         le.ip,
         le.user_agent
  from public.login_events le
  left join public.profiles p on p.id = le.user_id
  left join auth.users u on u.id = le.user_id
  where (public.is_owner() or public.is_super())
    and (p_days is null or p_days <= 0 or le.at >= now() - make_interval(days => p_days))
    and (
      p_search is null or p_search = ''
      or coalesce(u.email::text, '') ilike '%' || p_search || '%'
      or coalesce(p.name, '') ilike '%' || p_search || '%'
      or coalesce(le.ip, '') ilike '%' || p_search || '%'
    )
  order by le.at desc
  limit 5000;
$$;

revoke all on function public.login_history(text, integer) from public;
grant execute on function public.login_history(text, integer) to authenticated;
