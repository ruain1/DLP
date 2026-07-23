-- REV330: let members record progress on their own company's COMMITTED activities.
--
-- Problem. The live act_update policy carried a blanket committed clause:
--   ... and (committed = false or editCommitted or commit)
-- which rejected EVERY member write to a committed row, including status, percent,
-- actual dates, outcome and slip reason. The client's Phase 1 commit lock (App.jsx,
-- Drawer) deliberately keeps exactly those progress fields open for members and only
-- freezes the plan (dates, duration, scope, identity, witness setup, predecessors,
-- the committed flag, delete). Result on site: members editing a WILL card were
-- refused by RLS with "new row violates row-level security policy", or, for a card
-- whose row had been deleted underneath them, by the act_insert committed clause.
--
-- Fix, two parts, both in this file:
--   1. act_update loses the committed clause. Company scoping and the editOwn or
--      editAny privilege requirement are unchanged.
--   2. enforce_activity_locks() is extended so the database enforces the SAME plan
--      lock the client documents: on a committed row, a user without the
--      editCommitted or commit privilege may change only progress columns.
--      Existing protections are kept: company reassignment blocked, un-commit
--      blocked (also independently guarded by guard_commit_transition), reschedule
--      of committed work blocked, plus a new project reassignment block.
--
-- act_insert and act_delete keep their committed clauses on purpose: inserting a
-- pre-committed row IS committing, and deleting committed work stays plan-locked.
--
-- Idempotent. Run the whole file in the Supabase SQL editor. Verification queries
-- at the bottom, rollback below them.

-- ---------- 1. act_update without the committed clause ----------

drop policy if exists act_update on public.activities;
create policy act_update on public.activities for update to authenticated
using (
  public.has_priv(project_id, 'editAny')
  or (public.has_priv(project_id, 'editOwn') and company_id = public.my_company())
)
with check (
  public.has_priv(project_id, 'editAny')
  or (public.has_priv(project_id, 'editOwn') and company_id = public.my_company())
);

-- ---------- 2. the plan lock, in the trigger where it can name its reason ----------

create or replace function public.enforce_activity_locks() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
declare can_plan boolean;
begin
  -- Admins may do anything.
  if public.is_admin() then
    return new;
  end if;

  -- A non-admin must never move a row to another company or another project.
  if new.company_id is distinct from old.company_id then
    raise exception 'Not allowed: an activity cannot be reassigned to another company.';
  end if;
  if new.project_id is distinct from old.project_id then
    raise exception 'Not allowed: an activity cannot be moved to another project.';
  end if;

  if old.committed then
    -- The editCommitted or commit privilege unlocks the plan of committed work,
    -- matching the client's planLocked gate. has_priv already returns true for
    -- per-project admins and the owner.
    can_plan := public.has_priv(old.project_id, 'editCommitted')
             or public.has_priv(old.project_id, 'commit');
    if not can_plan then
      if new.committed = false then
        raise exception 'Not allowed: a committed activity cannot be un-committed.';
      end if;
      if new.start_date is distinct from old.start_date
         or new.duration is distinct from old.duration then
        raise exception 'This activity is committed: its dates are locked. You can still record progress (status, percent, actual dates, outcome). Ask an admin to reschedule.';
      end if;
      if new.descr is distinct from old.descr
         or new.is_milestone is distinct from old.is_milestone
         or new.area is distinct from old.area
         or new.sub_area is distinct from old.sub_area
         or new.tier3 is distinct from old.tier3
         or new.asset is distinct from old.asset
         or new.system is distinct from old.system
         or new.level is distinct from old.level
         or new.discipline is distinct from old.discipline
         or new.crew is distinct from old.crew
         or new.est_hours is distinct from old.est_hours
         or new.predecessors is distinct from old.predecessors
         or new.retest_of is distinct from old.retest_of then
        raise exception 'This activity is committed: its plan (what, where, discipline, crew, predecessors) is locked. You can still record progress (status, percent, actual dates, outcome). Ask an admin to change the plan.';
      end if;
      if new.witness_invite is distinct from old.witness_invite
         or new.witness_type is distinct from old.witness_type
         or new.witness_at is distinct from old.witness_at
         or new.witness_duration_min is distinct from old.witness_duration_min
         or new.witness_days is distinct from old.witness_days then
        raise exception 'This activity is committed: its witness setup is locked. Ask an admin to change it.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- The trigger itself (trg_enforce_activity_locks BEFORE UPDATE) already exists and
-- keeps pointing at the replaced function. Created here only if a fresh database
-- is missing it.
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_enforce_activity_locks') then
    create trigger trg_enforce_activity_locks before update on public.activities
      for each row execute function public.enforce_activity_locks();
  end if;
end $$;

-- ---------- verification ----------
-- 1. act_update no longer mentions committed:
--    select policyname, qual, with_check from pg_policies
--    where schemaname = 'public' and tablename = 'activities' and policyname = 'act_update';
--    Expect: no occurrence of the word committed in either expression.
-- 2. Function updated:
--    select prosrc from pg_proc where proname = 'enforce_activity_locks';
--    Expect: the plan-lock column list above, including witness_setup checks.
-- 3. Live proof: as a member, save a percent change on an own-company WILL card.
--    Expect: saves cleanly. Then try changing its Start date as the same member.
--    Expect: the "dates are locked" message in the red banner, not a policy error.

-- ---------- rollback (only if needed) ----------
-- drop policy if exists act_update on public.activities;
-- create policy act_update on public.activities for update to authenticated
-- using (((public.has_priv(project_id, 'editAny') or (public.has_priv(project_id, 'editOwn') and (company_id = public.my_company()))) and ((committed = false) or public.has_priv(project_id, 'editCommitted') or public.has_priv(project_id, 'commit'))))
-- with check (((public.has_priv(project_id, 'editAny') or (public.has_priv(project_id, 'editOwn') and (company_id = public.my_company()))) and ((committed = false) or public.has_priv(project_id, 'commit') or public.has_priv(project_id, 'editCommitted'))));
-- create or replace function public.enforce_activity_locks() returns trigger
--     language plpgsql set search_path to 'public' as $body$
-- begin
--   if public.is_admin() then return new; end if;
--   if new.company_id is distinct from old.company_id then
--     raise exception 'Not allowed: an activity cannot be reassigned to another company.';
--   end if;
--   if old.committed then
--     if new.start_date is distinct from old.start_date or new.duration is distinct from old.duration then
--       raise exception 'Not allowed: a committed activity cannot be rescheduled. Ask an admin.';
--     end if;
--     if new.committed = false then
--       raise exception 'Not allowed: a committed activity cannot be un-committed.';
--     end if;
--   end if;
--   return new;
-- end;
-- $body$;
