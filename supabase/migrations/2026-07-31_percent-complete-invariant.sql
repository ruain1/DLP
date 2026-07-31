-- REV360: percent 100 is only reachable through Complete.
-- Invariant: percent = 100 implies status = complete, enforced at every writer.

-- 1) Step existing offenders back to 99. Completion must be a deliberate act in the
--    UI so the audit log names who recorded it; nothing is auto-completed here.
update public.activities set percent = 99 where percent = 100 and status <> 'complete';

-- 2) The percent-only RPC applies the same ceiling: 99 unless the row is complete.
create or replace function public.set_activity_percent(p_id uuid, p_percent integer) returns void
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  v_status text;
begin
  -- must be a known signed-in user (same trust level as the read policy)
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'not authorised';
  end if;

  select status into v_status from activities where id = p_id;
  if not found then
    raise exception 'activity not found';
  end if;

  update activities
     set percent = case when p_percent is null then null
                        when v_status = 'complete' then greatest(0, least(100, p_percent))
                        else greatest(0, least(99, p_percent)) end,
         updated_by = auth.uid()
   where id = p_id;
end;
$$;

-- 3) Backstop for every client, including future ACC sync.
alter table public.activities
  add constraint activities_percent_complete_chk
  check (percent is null or percent <= 99 or status = 'complete');
