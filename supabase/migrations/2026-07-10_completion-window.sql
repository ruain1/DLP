-- REV186: completion window safeguard (completion-window.sql)
-- A non-admin cannot set an activity to complete after its planned finish day
-- (Europe/Helsinki). Admins, the service role, migrations and SQL-editor
-- sessions pass. Covers INSERT and UPDATE, so every client path is bound.
-- Run BEFORE pushing the REV186 app files.

create or replace function enforce_completion_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  fin date;
  old_status text := case when tg_op = 'UPDATE' then old.status else null end;
  is_admin boolean;
begin
  -- only guard transitions INTO complete
  if new.status = 'complete' and (old_status is distinct from 'complete') then
    -- service role / SQL editor / migrations carry no auth uid: allow
    if uid is null then return new; end if;
    select exists (
             select 1 from profiles p
             where p.id = uid and p.platform_role in ('owner', 'super')
           )
        or exists (
             select 1 from project_members m
             where m.user_id = uid and m.project_id = new.project_id and m.role = 'admin'
           )
      into is_admin;
    if is_admin then return new; end if;
    fin := new.start_date::date + greatest(coalesce(new.duration, 1), 1) - 1;
    if (now() at time zone 'Europe/Helsinki')::date > fin then
      raise exception 'Not allowed: this activity passed its planned finish (%). Overdue completion is admin-only; record the reason for non-completion and ask an admin.', fin
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists trg_completion_window on activities;
create trigger trg_completion_window
  before insert or update on activities
  for each row execute function enforce_completion_window();

-- Verification after applying:
--   1) As a member (or via the app signed in as one), set an activity whose
--      planned finish is in the past to complete: the save is rejected and
--      the REV184 red Database error banner surfaces the message.
--   2) The same action as an admin succeeds.
--   3) This SQL editor session (postgres) can still update freely: uid is null.
