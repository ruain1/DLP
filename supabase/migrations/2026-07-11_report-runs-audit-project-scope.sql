-- REV219: multi-project scoping for digest claims and the audit trail.
-- Run ONCE, BEFORE the REV219 client deploys (its scoped audit reads need these columns).
-- The currently deployed client keeps working after this is applied: report_runs.project_id
-- carries a FIN04 default and the audit triggers stamp project_id server-side.
-- Run a database backup (GitHub Actions db-backup workflow) first.

-- 1) report_runs: one digest claim per project per kind per date (was one global claim).
alter table public.report_runs
  add column if not exists project_id uuid not null default 'f1040000-0000-4000-a000-000000000001';
alter table public.report_runs drop constraint if exists report_runs_kind_run_date_key;
alter table public.report_runs drop constraint if exists report_runs_project_kind_run_date_key;
alter table public.report_runs
  add constraint report_runs_project_kind_run_date_key unique (project_id, kind, run_date);
alter table public.report_runs drop constraint if exists report_runs_project_fk;
alter table public.report_runs
  add constraint report_runs_project_fk foreign key (project_id)
  references public.projects(id) on delete cascade;

-- 2) audit_log: project column. Nullable by design: platform-level events (company
--    registry, profile changes) carry no project. All existing history belongs to FIN04.
--    The backfill is one-time; do not re-run this block after platform-level rows exist.
alter table public.audit_log add column if not exists project_id uuid;
update public.audit_log
   set project_id = 'f1040000-0000-4000-a000-000000000001'
 where project_id is null;
create index if not exists audit_log_project_ts_idx on public.audit_log (project_id, ts desc);

-- 3) The three audit triggers stamp project_id from the row they fire on.
--    Bodies are faithful to the live definitions with only the project_id addition.

create or replace function public.audit_activities() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare uname text; act text; eid text; det text; pid uuid;
begin
  select coalesce(name,'') into uname from profiles where id = auth.uid();

  if (tg_op = 'INSERT') then
    act := 'Added activity'; eid := new.id::text; det := new.descr; pid := new.project_id;

  elsif (tg_op = 'DELETE') then
    act := 'Removed activity'; eid := old.id::text; det := old.descr; pid := old.project_id;

  else
    eid := new.id::text; det := new.descr; pid := new.project_id;
    if (new.status = 'complete' and coalesce(old.status,'') <> 'complete') then
      act := 'Completed activity';
    elsif (coalesce(new.committed,false) and not coalesce(old.committed,false)) then
      act := 'Committed activity';
    elsif exists (
      select 1
      from jsonb_array_elements(coalesce(new.constraints,'[]'::jsonb)) n
      left join jsonb_array_elements(coalesce(old.constraints,'[]'::jsonb)) o
        on (o->>'id') = (n->>'id')
      where coalesce((n->>'done')::boolean,false) and not coalesce((o->>'done')::boolean,false)
    ) then
      act := 'Cleared a constraint on';
    elsif (new.status = 'in_progress' and coalesce(old.status,'') <> 'in_progress') then
      act := 'Started activity';
    elsif (new.start_date is distinct from old.start_date) then
      act := 'Rescheduled activity';
    else
      act := 'Edited activity';
    end if;
  end if;

  insert into audit_log(user_id,user_name,action,entity,entity_id,detail,project_id)
  values (auth.uid(), uname, act, 'activity', eid, det, pid);

  if (tg_op = 'DELETE') then return old; else return new; end if;
end; $$;

create or replace function public.audit_setup() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare uname text; act text; det text; rec json; pid uuid;
begin
  select coalesce(name,'') into uname from profiles where id = auth.uid();
  act := initcap(lower(tg_op)) || ' ' || tg_table_name;
  rec := case when tg_op = 'DELETE' then row_to_json(old) else row_to_json(new) end;
  pid := nullif(rec->>'project_id','')::uuid;
  det := case tg_table_name
    when 'settings'  then 'Lookahead ' || coalesce(rec->>'weeks','?') || ' wk / make-ready ' || coalesce(rec->>'make_ready_days','?') || ' d'
    when 'profiles'  then coalesce(nullif(rec->>'name',''),'user') || coalesce(' (' || nullif(coalesce(rec->>'role', rec->>'platform_role'),'') || ')', '')
    when 'companies' then 'Company ' || coalesce(rec->>'name','')
    when 'areas'     then 'Zone ' || coalesce(rec->>'name','')
    when 'systems'   then 'System ' || coalesce(rec->>'name','')
    when 'levels'    then trim('Stage ' || coalesce(rec->>'key','') || ' ' || coalesce(rec->>'name',''))
    else tg_table_name || ' record'
  end;
  det := left(coalesce(det,''), 400);
  insert into audit_log(user_id,user_name,action,entity,detail,project_id)
  values (auth.uid(), uname, act, tg_table_name, det, pid);
  if (tg_op = 'DELETE') then return old; else return new; end if;
end; $$;

create or replace function public.audit_user_privileges() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare uname text; tname text; pcode text; pid uuid;
begin
  select name into uname from profiles where id = auth.uid();
  select name into tname from profiles where id = coalesce(new.user_id, old.user_id);
  pid := coalesce(new.project_id, old.project_id);
  select code into pcode from projects where id = pid;
  insert into audit_log(user_id, user_name, action, entity, entity_id, detail, project_id)
  values (auth.uid(), coalesce(uname,'(system)'),
          case tg_op when 'INSERT' then 'Privilege set' when 'UPDATE' then 'Privilege changed' else 'Privilege reset' end,
          'privilege',
          coalesce(new.user_id, old.user_id)::text,
          coalesce(pcode,'') || ': ' || coalesce(tname,'user') || ' ' || coalesce(new.priv_key, old.priv_key)
            || ' -> ' || case when tg_op = 'DELETE' then 'role default' when new.granted then 'granted' else 'withdrawn' end,
          pid);
  return coalesce(new, old);
end $$;

-- V1: report_runs constraints (expect report_runs_project_kind_run_date_key, no report_runs_kind_run_date_key)
select conname from pg_constraint where conrelid = 'public.report_runs'::regclass order by conname;
-- V2: audit history stamped (stamped should equal total right after apply)
select count(*) filter (where project_id is not null) as stamped, count(*) as total from public.audit_log;
-- V3: all three trigger functions carry project_id (expect three rows of true)
select proname, prosrc like '%project_id%' as has_project
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and proname in ('audit_activities','audit_setup','audit_user_privileges')
 order by proname;
