--
-- PostgreSQL database dump
--

\restrict nWdaFyYlIJH9vG00vG0Rv9oqAdIREqDhN7wxkljQq22BeW1ro0YADRfTf7rFUoB

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Ubuntu 17.10-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: activity_diff(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_diff(oj jsonb, nj jsonb) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare k text; parts text[] := '{}';
  skip text[] := array['id','created_at','updated_at','created_by','updated_by'];
begin
  for k in select jsonb_object_keys(nj) loop
    if k = any(skip) then continue; end if;
    if (oj -> k) is distinct from (nj -> k) then
      parts := parts || (public.activity_label(k) || ': '
        || public.activity_val(k, oj -> k) || ' -> ' || public.activity_val(k, nj -> k));
    end if;
  end loop;
  if array_length(parts, 1) is null then return 'No field changes'; end if;
  return left(array_to_string(parts, '; '), 800);
exception when others then
  return 'Edited (detail unavailable)';
end; $$;


--
-- Name: activity_label(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_label(k text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case k
    when 'descr' then 'description'
    when 'company_id' then 'company'
    when 'area' then 'building'
    when 'sub_area' then 'level'
    when 'tier3' then 'zone/room'
    when 'level' then 'Cx stage'
    when 'system' then 'system'
    when 'asset' then 'asset'
    when 'start_date' then 'start'
    when 'duration' then 'duration (days)'
    when 'is_milestone' then 'milestone'
    when 'committed' then 'committed'
    when 'witness_invite' then 'witness invite'
    when 'witness_at' then 'witness time'
    when 'status' then 'status'
    when 'actual_start' then 'actual start'
    when 'actual_finish' then 'actual finish'
    when 'slip_reason' then 'reason'
    when 'notes' then 'notes'
    when 'predecessors' then 'predecessors'
    when 'constraints' then 'constraints'
    when 'code' then 'code'
    else k
  end;
$$;


--
-- Name: activity_val(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activity_val(k text, v jsonb) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare t text;
begin
  if v is null or v = 'null'::jsonb then return '(empty)'; end if;
  if k = 'company_id' then
    return coalesce((select name from companies c where c.id = (v#>>'{}')::uuid), '(unknown)');
  elsif k = 'constraints' then
    return jsonb_array_length(v)::text || ' total, '
      || (select count(*) from jsonb_array_elements(v) e
          where coalesce((e->>'done')::boolean, false) = false)::text || ' open';
  elsif k = 'predecessors' then
    if coalesce(jsonb_array_length(v), 0) = 0 then return 'none'; end if;
    return coalesce((select string_agg('#' || x.code::text, ', ' order by x.code)
                     from activities x
                     where x.id::text in (select jsonb_array_elements_text(v))), 'set');
  elsif jsonb_typeof(v) = 'boolean' then
    return case when v::text = 'true' then 'yes' else 'no' end;
  else
    t := v #>> '{}';
    if t is null or t = '' then return '(empty)'; end if;
    if k = 'status' then t := replace(t, '_', ' '); end if;
    return t;
  end if;
exception when others then
  return coalesce(v #>> '{}', 'changed');
end; $$;


--
-- Name: asset_holds_yellow(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.asset_holds_yellow(p_project uuid, p_tag text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with yk as (select public.yellow_tag_step(p_project) k)
  select coalesce(
    (select o.value from asset_override o, yk
       where o.project_id = p_project and o.asset_tag = p_tag and o.step_key = yk.k),
    (select (r.steps ->> (select k from yk))::int from asset_register r
       where r.project_id = p_project and r.tag = p_tag),
    0
  ) = 2
$$;


--
-- Name: assign_activity_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_activity_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.code is null then
    new.code := nextval('activity_code_seq');
  elsif new.code > (select last_value from activity_code_seq) then
    perform setval('activity_code_seq', new.code);
  end if;
  return new;
end $$;


--
-- Name: audit_activities(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_activities() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: audit_activity_updates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_activity_updates() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare uname text;
begin
  select coalesce(name,'') into uname from profiles where id = auth.uid();
  insert into audit_log(user_id, user_name, action, entity, entity_id, detail, project_id)
  values (auth.uid(), coalesce(nullif(uname, ''), new.by_name), 'Daily update', 'activity', new.activity_id::text,
          left(new.note, 160) || case when new.pct is not null then ' (' || new.pct || '%)' else '' end, new.project_id);
  return new;
end $$;


--
-- Name: audit_setup(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_setup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: audit_user_privileges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_user_privileges() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: can_edit_asset(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_edit_asset(p_project uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
       exists (select 1 from profiles pr
                 where pr.id = auth.uid()
                   and pr.platform_role in ('owner','super'))
    or exists (select 1 from project_members m
                 where m.project_id = p_project and m.user_id = auth.uid()
                   and m.role = 'admin')
$$;


--
-- Name: can_edit_ee(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_edit_ee(p_project uuid, p_tag text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.asset_holds_yellow(p_project, p_tag) and (
       public.can_edit_asset(p_project)
    or exists (select 1 from user_privileges up
                 where up.project_id = p_project and up.user_id = auth.uid()
                   and up.priv_key = 'editEE' and up.granted = true)
  )
$$;


--
-- Name: ee_step(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ee_step(p_project uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select step_key from cx_step_reference
   where project_id = p_project and lower(step_key) = 'ee'
   order by sort_order limit 1
$$;


--
-- Name: enforce_activity_locks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_activity_locks() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  -- Admins may do anything.
  if public.is_admin() then
    return new;
  end if;

  -- Defence in depth: a non-admin must never move a row to another company.
  -- (RLS already blocks this; the trigger gives a clear error instead of a
  -- silent policy failure.)
  if new.company_id is distinct from old.company_id then
    raise exception 'Not allowed: an activity cannot be reassigned to another company.';
  end if;

  -- Once an activity is committed, a non-admin cannot reschedule it.
  if old.committed then
    if new.start_date is distinct from old.start_date
       or new.duration is distinct from old.duration then
      raise exception 'Not allowed: a committed activity cannot be rescheduled. Ask an admin.';
    end if;

    -- ...and cannot un-commit it, which would otherwise bypass the lock above.
    if new.committed = false then
      raise exception 'Not allowed: a committed activity cannot be un-committed.';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: enforce_completion_window(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_completion_window() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: guard_commit_transition(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_commit_transition() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.committed is distinct from old.committed
     and not public.has_priv(new.project_id, 'commit') then
    raise exception 'Commit or uncommit requires the Commit Weekly Plan privilege';
  end if;
  return new;
end $$;


--
-- Name: guard_invite_request(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_invite_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.has_priv(new.project_id, 'requestInv') then
    raise exception 'Request Invites is not enabled for this account';
  end if;
  return new;
end $$;


--
-- Name: guard_owner_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_owner_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.platform_role = 'owner' then
      raise exception 'The owner account cannot be deleted';
    end if;
    return old;
  end if;
  if old.platform_role = 'owner' and new.platform_role is distinct from 'owner'
     and not public.is_owner() then
    raise exception 'Only the owner can change the owner role';
  end if;
  if new.platform_role = 'owner' and old.platform_role is distinct from 'owner'
     and not public.is_owner()
     and exists (select 1 from profiles where platform_role = 'owner') then
    raise exception 'Only the owner can assign the owner role';
  end if;
  return new;
end $$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), 'member')
  on conflict (id) do nothing;
  return new;
end; $$;


--
-- Name: has_priv(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_priv(pid uuid, k text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare r text; ov boolean;
begin
  if public.is_owner() then return true; end if;
  if k = 'privs' then return false; end if;
  select granted into ov from user_privileges
    where project_id = pid and user_id = auth.uid() and priv_key = k;
  if found then return ov; end if;
  r := public.proj_role(pid);
  if r is null then return false; end if;
  if k = 'requestInv' then
    return r = 'member' and exists (
      select 1
      from profiles pr
      join companies c on c.id = pr.company_id
      join projects  p on p.id = pid
      where pr.id = auth.uid()
        and lower(trim(c.name)) = lower(trim(coalesce(p.client,'')))
        and coalesce(p.client,'') <> ''
    );
  end if;
  if r = 'admin' then return true; end if;
  return k in ('create','editOwn','del','witnessReq','witnessOutcome','retest');
end $$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and (role = 'admin' or platform_role in ('owner', 'super'))
  );
$$;


--
-- Name: is_admin_somewhere(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_somewhere() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from profiles
                  where id = auth.uid() and platform_role in ('super', 'owner'))
      or exists (select 1 from project_members
                  where user_id = auth.uid() and role = 'admin');
$$;


--
-- Name: is_cx_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_cx_admin(p_project uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    exists (select 1 from public.profiles
             where id = auth.uid() and platform_role in ('super', 'owner'))
    or exists (select 1 from public.project_members
                where project_id = p_project
                  and user_id = auth.uid()
                  and role = 'admin');
$$;


--
-- Name: is_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_member(p uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.is_super() or exists (
    select 1 from project_members where project_id = p and user_id = auth.uid());
$$;


--
-- Name: is_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_owner() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from profiles where id = auth.uid() and platform_role = 'owner');
$$;


--
-- Name: is_project_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_project_admin(p uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.is_super() or exists (
    select 1 from project_members where project_id = p and user_id = auth.uid() and role = 'admin');
$$;


--
-- Name: is_super(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from profiles where id = auth.uid() and platform_role = 'super');
$$;


--
-- Name: is_super_or_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_or_owner() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from profiles where id = auth.uid() and platform_role in ('super','owner'));
$$;


--
-- Name: my_company(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_company() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select company_id from profiles where id = auth.uid();
$$;


--
-- Name: preserve_activity_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_activity_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.code := old.code;
  return new;
end $$;


--
-- Name: proj_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.proj_role(pid uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case
    when exists (select 1 from profiles where id = auth.uid() and platform_role in ('super','owner')) then 'admin'
    else (select role from project_members where project_id = pid and user_id = auth.uid())
  end;
$$;


--
-- Name: prune_import_fingerprints(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prune_import_fingerprints() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from import_fingerprints
  where project_id = new.project_id
    and id not in (
      select id from import_fingerprints
      where project_id = new.project_id
      order by ts desc limit 50
    );
  return null;
end $$;


--
-- Name: set_activity_percent(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_activity_percent(p_id uuid, p_percent integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- must be a known signed-in user (same trust level as the read policy)
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'not authorised';
  end if;

  update activities
     set percent = case when p_percent is null then null
                        else greatest(0, least(100, p_percent)) end,
         updated_by = auth.uid()
   where id = p_id;

  if not found then
    raise exception 'activity not found';
  end if;
end;
$$;


--
-- Name: set_platform_role(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_platform_role(target uuid, new_role text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_super() then
    raise exception 'Only a platform super can change platform roles';
  end if;
  if new_role not in ('user','super') then
    raise exception 'Platform role must be user or super';
  end if;
  -- never strip the last remaining super
  if new_role = 'user'
     and exists (select 1 from profiles where id = target and platform_role = 'super')
     and (select count(*) from profiles where platform_role = 'super') <= 1 then
    raise exception 'Keep at least one platform super';
  end if;
  update profiles set platform_role = new_role where id = target;
end; $$;


--
-- Name: snapshot_activities(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.snapshot_activities() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare uname text;
begin
  select coalesce(name,'') into uname from profiles where id = auth.uid();
  insert into activity_snapshots(activity_id, op, before_row, after_row, user_id, user_name)
  values (
    coalesce(new.id, old.id),
    tg_op,
    case when tg_op = 'INSERT' then null else row_to_json(old)::jsonb end,
    case when tg_op = 'DELETE' then null else row_to_json(new)::jsonb end,
    auth.uid(), uname
  );
  if (tg_op = 'DELETE') then return old; else return new; end if;
end; $$;


--
-- Name: tg_override_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_override_events() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare yk text; ek text;
begin
  yk := public.yellow_tag_step(NEW.project_id);
  ek := public.ee_step(NEW.project_id);
  if NEW.step_key = yk and NEW.value = 2 then
    insert into asset_event(project_id, asset_tag, type, state)
      values (NEW.project_id, NEW.asset_tag, 'ready_for_energisation', 'new')
    on conflict (project_id, asset_tag, type) do update
      set state = case when asset_event.state = 'retracted' then 'new'
                       else asset_event.state end;
  elsif NEW.step_key = yk and NEW.value <> 2 then
    update asset_event set state = 'retracted'
      where project_id = NEW.project_id and asset_tag = NEW.asset_tag
        and type = 'ready_for_energisation' and state in ('new','rffe_sent');
  end if;
  if NEW.step_key = ek and NEW.value = 2 then
    update asset_event set state = 'energised', energised_at = now(), energised_by = NEW.set_by
      where project_id = NEW.project_id and asset_tag = NEW.asset_tag
        and type = 'ready_for_energisation';
  end if;
  return NEW;
end $$;


--
-- Name: tg_register_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_register_events() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare yk text; was int; now2 int; ov int;
begin
  yk := public.yellow_tag_step(NEW.project_id);
  if yk is null then return NEW; end if;
  if TG_OP = 'INSERT' then was := 0; else was := coalesce((OLD.steps ->> yk)::int, 0); end if;
  now2 := coalesce((NEW.steps ->> yk)::int, 0);
  if was = now2 then return NEW; end if;
  select value into ov from asset_override
    where project_id = NEW.project_id and asset_tag = NEW.tag and step_key = yk;
  if ov is not null then return NEW; end if;
  if now2 = 2 then
    insert into asset_event(project_id, asset_tag, type, state)
      values (NEW.project_id, NEW.tag, 'ready_for_energisation', 'new')
    on conflict (project_id, asset_tag, type) do update
      set state = case when asset_event.state = 'retracted' then 'new'
                       else asset_event.state end;
  else
    update asset_event set state = 'retracted'
      where project_id = NEW.project_id and asset_tag = NEW.tag
        and type = 'ready_for_energisation' and state in ('new','rffe_sent');
  end if;
  return NEW;
end $$;


--
-- Name: yellow_tag_step(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.yellow_tag_step(p_project uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select step_key from cx_step_reference
   where project_id = p_project and stage = 'L2' and is_tag = true
   order by sort_order limit 1
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: acc_benchmark_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acc_benchmark_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    imported_at timestamp with time zone DEFAULT now() NOT NULL,
    imported_by uuid DEFAULT auth.uid(),
    imported_by_name text,
    count integer DEFAULT 0 NOT NULL,
    snapshot jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: acc_benchmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acc_benchmarks (
    project_id uuid NOT NULL,
    fok_ref text NOT NULL,
    discipline text,
    title text,
    planned_date date,
    assignee_email text,
    acc_url text,
    notes text,
    present boolean DEFAULT true NOT NULL,
    board_activity_id uuid,
    source_version text,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid,
    resolved_email text,
    completed_at timestamp with time zone
);


--
-- Name: acc_sync; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acc_sync (
    project_id uuid NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    hub_id text,
    acc_project_id text,
    folder_urn text,
    item_urn text,
    file_name text,
    sheet_name text DEFAULT 'FOK Register'::text,
    region text DEFAULT 'EMEA'::text,
    webhook_id text,
    last_event_at timestamp with time zone,
    last_reconcile_at timestamp with time zone,
    last_version text,
    last_result jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text
);


--
-- Name: acc_sync_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acc_sync_events (
    id bigint NOT NULL,
    project_id uuid NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    kind text NOT NULL,
    version text,
    rows integer,
    added integer,
    changed integer,
    removed integer,
    invites integer,
    detail text
);


--
-- Name: acc_sync_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.acc_sync_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.acc_sync_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: access_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    email text NOT NULL,
    organisation text DEFAULT ''::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_by uuid,
    decided_by_name text,
    decided_at timestamp with time zone,
    decision_note text,
    project_id uuid DEFAULT 'f1040000-0000-4000-a000-000000000001'::uuid NOT NULL,
    CONSTRAINT access_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    descr text DEFAULT ''::text NOT NULL,
    company_id uuid,
    area text,
    system text,
    level text,
    is_milestone boolean DEFAULT false NOT NULL,
    start_date date,
    duration integer DEFAULT 1 NOT NULL,
    committed boolean DEFAULT false NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    actual_start date,
    actual_finish date,
    constraints jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sub_area text,
    tier3 text,
    witness_invite boolean DEFAULT false NOT NULL,
    notes text,
    witness_at text,
    asset text,
    code integer,
    predecessors text[] DEFAULT '{}'::text[] NOT NULL,
    slip_reason text,
    reschedules jsonb DEFAULT '[]'::jsonb NOT NULL,
    project_id uuid DEFAULT 'f1040000-0000-4000-a000-000000000001'::uuid NOT NULL,
    percent smallint,
    discipline text,
    witness_duration_min smallint DEFAULT 60 NOT NULL,
    witness_sent_at timestamp with time zone,
    outcome text DEFAULT 'pending'::text NOT NULL,
    outcome_reason text,
    outcome_notes text,
    outcome_at date,
    retest_of uuid,
    witness_days integer DEFAULT 1 NOT NULL,
    witness_events jsonb DEFAULT '[]'::jsonb NOT NULL,
    witness_type text,
    acc_url text,
    fok_ref text,
    assignee_email text,
    crew text,
    est_hours numeric,
    CONSTRAINT activities_outcome_check CHECK ((outcome = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text]))),
    CONSTRAINT activities_witness_days_check CHECK (((witness_days >= 1) AND (witness_days <= 31)))
);


--
-- Name: COLUMN activities.outcome; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.activities.outcome IS 'Witness outcome: pending / succeeded / failed. Only meaningful when witness_invite is true.';


--
-- Name: COLUMN activities.outcome_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.activities.outcome_reason IS 'Required when outcome = failed. Quality Pareto source.';


--
-- Name: COLUMN activities.outcome_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.activities.outcome_at IS 'Date the outcome was recorded / the witnessed event took place.';


--
-- Name: COLUMN activities.retest_of; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.activities.retest_of IS 'Points at the failed attempt this activity retests. Chains give attempt numbers and first-time-pass.';


--
-- Name: COLUMN activities.witness_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.activities.witness_type IS 'Witness invite type (e.g. L3 SAT); required by the app when witness_invite is true';


--
-- Name: activity_code_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_code_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_snapshots (
    id bigint NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    activity_id uuid NOT NULL,
    op text NOT NULL,
    before_row jsonb,
    after_row jsonb,
    user_id uuid,
    user_name text,
    reverted_at timestamp with time zone,
    reverted_by text,
    CONSTRAINT activity_snapshots_op_check CHECK ((op = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: activity_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.activity_snapshots ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.activity_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: activity_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    activity_id uuid NOT NULL,
    at timestamp with time zone DEFAULT now() NOT NULL,
    by_id uuid DEFAULT auth.uid(),
    by_name text DEFAULT ''::text NOT NULL,
    pct integer,
    note text NOT NULL,
    CONSTRAINT activity_updates_note_len CHECK (((char_length(note) >= 1) AND (char_length(note) <= 4000))),
    CONSTRAINT activity_updates_pct_range CHECK (((pct IS NULL) OR ((pct >= 0) AND (pct <= 100))))
);


--
-- Name: areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areas (
    name text NOT NULL,
    project_id uuid DEFAULT 'f1040000-0000-4000-a000-000000000001'::uuid NOT NULL
);


--
-- Name: asset_event; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_event (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    asset_tag text NOT NULL,
    type text DEFAULT 'ready_for_energisation'::text NOT NULL,
    state text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rffe_sent_at timestamp with time zone,
    rffe_sent_by uuid,
    energised_at timestamp with time zone,
    energised_by uuid,
    confirmed_at timestamp with time zone,
    CONSTRAINT asset_event_state_check CHECK ((state = ANY (ARRAY['new'::text, 'rffe_sent'::text, 'energised'::text, 'retracted'::text])))
);


--
-- Name: asset_override; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_override (
    project_id uuid NOT NULL,
    asset_tag text NOT NULL,
    step_key text NOT NULL,
    value integer NOT NULL,
    set_by uuid,
    set_at timestamp with time zone DEFAULT now() NOT NULL,
    note text
);


--
-- Name: asset_register; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_register (
    project_id uuid NOT NULL,
    tag text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    type text DEFAULT ''::text NOT NULL,
    discipline text DEFAULT ''::text NOT NULL,
    level text DEFAULT ''::text NOT NULL,
    hall text DEFAULT ''::text NOT NULL,
    steps jsonb DEFAULT '{}'::jsonb NOT NULL,
    dates jsonb DEFAULT '{}'::jsonb NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'upload'::text NOT NULL,
    CONSTRAINT asset_register_source_check CHECK ((source = ANY (ARRAY['upload'::text, 'sharepoint'::text])))
);


--
-- Name: asset_status_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_status_config (
    project_id uuid NOT NULL,
    tenant_id text DEFAULT ''::text NOT NULL,
    client_id text DEFAULT ''::text NOT NULL,
    file_url text DEFAULT ''::text NOT NULL,
    sheet_name text DEFAULT 'Asset Cx Register'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_vendor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_vendor (
    project_id text NOT NULL,
    equip_type text NOT NULL,
    vendor text DEFAULT 'TBC'::text NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    user_name text,
    action text NOT NULL,
    entity text,
    entity_id text,
    detail text,
    project_id uuid
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: baselines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.baselines (
    project_id uuid NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    activities jsonb DEFAULT '[]'::jsonb NOT NULL,
    wbs jsonb DEFAULT '{}'::jsonb NOT NULL,
    mappings jsonb DEFAULT '{}'::jsonb NOT NULL,
    source_filename text,
    imported_at timestamp with time zone DEFAULT now() NOT NULL,
    imported_by uuid DEFAULT auth.uid()
);


--
-- Name: branding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branding (
    id integer DEFAULT 1 NOT NULL,
    project_name text DEFAULT 'FIN04'::text NOT NULL,
    app_name text DEFAULT 'DLP'::text NOT NULL,
    tagline text DEFAULT 'Collaborative Digital Planning'::text NOT NULL,
    logo_url text,
    logo_url_dark text,
    project_id uuid DEFAULT 'f1040000-0000-4000-a000-000000000001'::uuid NOT NULL,
    CONSTRAINT branding_singleton CHECK ((id = 1))
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    logo_url text,
    logo_url_dark text,
    description text,
    domain text
);


--
-- Name: crews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crews (
    project_id uuid NOT NULL,
    name text NOT NULL
);


--
-- Name: cx_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cx_config (
    project_id uuid NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text
);


--
-- Name: cx_step_reference; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cx_step_reference (
    project_id uuid NOT NULL,
    step_key text NOT NULL,
    stage text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_tag boolean DEFAULT false NOT NULL,
    definition text DEFAULT ''::text NOT NULL,
    executed_by text DEFAULT ''::text NOT NULL,
    signed_off_by text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    step_no text DEFAULT ''::text NOT NULL,
    prereq text DEFAULT ''::text NOT NULL,
    purpose text DEFAULT ''::text NOT NULL,
    ofci_cfci text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    in_register boolean DEFAULT true NOT NULL
);


--
-- Name: cx_week; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cx_week (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    week_ending date NOT NULL,
    acc_refreshed date,
    imported_at timestamp with time zone DEFAULT now() NOT NULL,
    imported_by text,
    assets integer,
    mapped_assets integer,
    red_n integer,
    yellow_n integer,
    green_n integer,
    blue_n integer,
    white_n integer,
    red_pct numeric,
    yellow_pct numeric,
    green_pct numeric,
    blue_pct numeric,
    white_pct numeric,
    open_issues integer,
    awaiting_verification integer,
    issues_raised_7d integer,
    issues_resolved_7d integer,
    new_red_7d integer,
    new_yellow_7d integer,
    new_green_7d integer,
    irl_opened integer,
    irl_started integer,
    irl_delivered integer,
    irl_verified integer,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: docs_column_ref; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.docs_column_ref (
    project_id text NOT NULL,
    doc_key text NOT NULL,
    doc_name text NOT NULL,
    level text NOT NULL,
    responsible text DEFAULT ''::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: docs_matrix; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.docs_matrix (
    project_id text NOT NULL,
    equip_type text NOT NULL,
    status jsonb DEFAULT '{}'::jsonb NOT NULL,
    overall boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    synced_at timestamp with time zone,
    source text
);


--
-- Name: docs_override; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.docs_override (
    project_id text NOT NULL,
    equip_type text NOT NULL,
    doc_key text NOT NULL,
    value text NOT NULL,
    set_by uuid,
    set_at timestamp with time zone DEFAULT now() NOT NULL,
    note text
);


--
-- Name: docs_status_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.docs_status_config (
    project_id text NOT NULL,
    tenant_id text DEFAULT ''::text NOT NULL,
    client_id text DEFAULT ''::text NOT NULL,
    file_url text DEFAULT ''::text NOT NULL,
    sheet_name text DEFAULT 'Documentation status'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: docs_vendor_target; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.docs_vendor_target (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    vendor text NOT NULL,
    level text NOT NULL,
    due_date date,
    note text DEFAULT ''::text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by text DEFAULT ''::text
);


--
-- Name: import_fingerprints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_fingerprints (
    id bigint NOT NULL,
    project_id uuid NOT NULL,
    hash text NOT NULL,
    row_count integer DEFAULT 0 NOT NULL,
    mode text DEFAULT 'append'::text NOT NULL,
    by_name text DEFAULT ''::text NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: import_fingerprints_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.import_fingerprints ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.import_fingerprints_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invite_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invite_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    activity_id uuid NOT NULL,
    requester_id uuid DEFAULT auth.uid() NOT NULL,
    requester_name text DEFAULT ''::text NOT NULL,
    requester_email text DEFAULT ''::text,
    activity_desc text DEFAULT ''::text,
    activity_code text DEFAULT ''::text,
    location text DEFAULT ''::text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_by uuid,
    decided_by_name text DEFAULT ''::text,
    decided_at timestamp with time zone
);


--
-- Name: levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.levels (
    key text NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    project_id uuid DEFAULT 'f1040000-0000-4000-a000-000000000001'::uuid NOT NULL
);


--
-- Name: presence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presence (
    user_id uuid NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    company_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invite_token text,
    invite_expires timestamp with time zone,
    must_reset boolean DEFAULT false NOT NULL,
    platform_role text DEFAULT 'user'::text NOT NULL,
    CONSTRAINT profiles_platform_role_check CHECK ((platform_role = ANY (ARRAY['owner'::text, 'super'::text, 'user'::text]))),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);


--
-- Name: project_companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_companies (
    project_id uuid NOT NULL,
    company_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    added_by uuid
);


--
-- Name: TABLE project_companies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.project_companies IS 'Which companies are active on which project. The companies table remains the global registry; deleting a company there cascades its associations away.';


--
-- Name: project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_members (
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    added_by uuid,
    CONSTRAINT project_members_role_check CHECK ((role = ANY (ARRAY['member'::text, 'admin'::text])))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    client text,
    location text,
    start_date date,
    target_date date,
    accent text DEFAULT '#1E63D6'::text,
    app_name text,
    tagline text,
    logo_url text,
    logo_url_dark text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    CONSTRAINT projects_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);


--
-- Name: report_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_recipients (
    project_id uuid NOT NULL,
    recipients jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: report_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind text NOT NULL,
    run_date date NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    recipients integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    detail text,
    project_id uuid DEFAULT 'f1040000-0000-4000-a000-000000000001'::uuid NOT NULL,
    subject text,
    html text,
    CONSTRAINT report_runs_kind_check CHECK ((kind = ANY (ARRAY['daily'::text, 'weekly'::text, 'morning'::text, 'report'::text])))
);


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    id integer DEFAULT 1 NOT NULL,
    weeks integer DEFAULT 4 NOT NULL,
    make_ready_days integer DEFAULT 7 NOT NULL,
    project_id uuid DEFAULT 'f1040000-0000-4000-a000-000000000001'::uuid NOT NULL,
    ppc_target integer DEFAULT 80 NOT NULL,
    benchmarks_visible boolean DEFAULT false NOT NULL,
    page_icons jsonb DEFAULT '{}'::jsonb NOT NULL,
    design jsonb DEFAULT '{}'::jsonb NOT NULL,
    invite_attendees jsonb DEFAULT '{}'::jsonb NOT NULL,
    working_days jsonb DEFAULT '[1, 2, 3, 4, 5]'::jsonb NOT NULL,
    hours_per_day numeric DEFAULT 8 NOT NULL,
    crews_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT settings_ppc_target_range CHECK (((ppc_target >= 1) AND (ppc_target <= 100))),
    CONSTRAINT settings_singleton CHECK ((id = 1))
);


--
-- Name: sub_areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sub_areas (
    area text NOT NULL,
    name text NOT NULL,
    project_id uuid DEFAULT 'f1040000-0000-4000-a000-000000000001'::uuid NOT NULL
);


--
-- Name: systems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.systems (
    name text NOT NULL,
    project_id uuid DEFAULT 'f1040000-0000-4000-a000-000000000001'::uuid NOT NULL
);


--
-- Name: tier3_areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tier3_areas (
    area text NOT NULL,
    sub_area text NOT NULL,
    name text NOT NULL,
    project_id uuid DEFAULT 'f1040000-0000-4000-a000-000000000001'::uuid NOT NULL
);


--
-- Name: user_privileges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_privileges (
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    priv_key text NOT NULL,
    granted boolean NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE vendors; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vendors IS 'Platform-wide vendor / OEM directory. asset_vendor rows remain plain text; this feeds suggestions and central management.';


--
-- Name: acc_benchmark_imports acc_benchmark_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_benchmark_imports
    ADD CONSTRAINT acc_benchmark_imports_pkey PRIMARY KEY (id);


--
-- Name: acc_benchmarks acc_benchmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_benchmarks
    ADD CONSTRAINT acc_benchmarks_pkey PRIMARY KEY (project_id, fok_ref);


--
-- Name: acc_sync_events acc_sync_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_sync_events
    ADD CONSTRAINT acc_sync_events_pkey PRIMARY KEY (id);


--
-- Name: acc_sync acc_sync_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_sync
    ADD CONSTRAINT acc_sync_pkey PRIMARY KEY (project_id);


--
-- Name: access_requests access_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_pkey PRIMARY KEY (id);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: activity_snapshots activity_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_snapshots
    ADD CONSTRAINT activity_snapshots_pkey PRIMARY KEY (id);


--
-- Name: activity_updates activity_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_updates
    ADD CONSTRAINT activity_updates_pkey PRIMARY KEY (id);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (name);


--
-- Name: asset_event asset_event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_event
    ADD CONSTRAINT asset_event_pkey PRIMARY KEY (id);


--
-- Name: asset_event asset_event_project_id_asset_tag_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_event
    ADD CONSTRAINT asset_event_project_id_asset_tag_type_key UNIQUE (project_id, asset_tag, type);


--
-- Name: asset_override asset_override_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_override
    ADD CONSTRAINT asset_override_pkey PRIMARY KEY (project_id, asset_tag, step_key);


--
-- Name: asset_register asset_register_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_register
    ADD CONSTRAINT asset_register_pkey PRIMARY KEY (project_id, tag);


--
-- Name: asset_status_config asset_status_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_status_config
    ADD CONSTRAINT asset_status_config_pkey PRIMARY KEY (project_id);


--
-- Name: asset_vendor asset_vendor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_vendor
    ADD CONSTRAINT asset_vendor_pkey PRIMARY KEY (project_id, equip_type);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: baselines baselines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baselines
    ADD CONSTRAINT baselines_pkey PRIMARY KEY (project_id);


--
-- Name: branding branding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branding
    ADD CONSTRAINT branding_pkey PRIMARY KEY (id);


--
-- Name: companies companies_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_name_key UNIQUE (name);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: crews crews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crews
    ADD CONSTRAINT crews_pkey PRIMARY KEY (project_id, name);


--
-- Name: cx_config cx_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cx_config
    ADD CONSTRAINT cx_config_pkey PRIMARY KEY (project_id);


--
-- Name: cx_step_reference cx_step_reference_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cx_step_reference
    ADD CONSTRAINT cx_step_reference_pkey PRIMARY KEY (project_id, step_key);


--
-- Name: cx_week cx_week_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cx_week
    ADD CONSTRAINT cx_week_pkey PRIMARY KEY (id);


--
-- Name: cx_week cx_week_project_id_week_ending_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cx_week
    ADD CONSTRAINT cx_week_project_id_week_ending_key UNIQUE (project_id, week_ending);


--
-- Name: docs_column_ref docs_column_ref_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs_column_ref
    ADD CONSTRAINT docs_column_ref_pkey PRIMARY KEY (project_id, doc_key);


--
-- Name: docs_matrix docs_matrix_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs_matrix
    ADD CONSTRAINT docs_matrix_pkey PRIMARY KEY (project_id, equip_type);


--
-- Name: docs_override docs_override_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs_override
    ADD CONSTRAINT docs_override_pkey PRIMARY KEY (project_id, equip_type, doc_key);


--
-- Name: docs_status_config docs_status_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs_status_config
    ADD CONSTRAINT docs_status_config_pkey PRIMARY KEY (project_id);


--
-- Name: docs_vendor_target docs_vendor_target_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs_vendor_target
    ADD CONSTRAINT docs_vendor_target_pkey PRIMARY KEY (id);


--
-- Name: docs_vendor_target docs_vendor_target_project_id_vendor_level_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs_vendor_target
    ADD CONSTRAINT docs_vendor_target_project_id_vendor_level_key UNIQUE (project_id, vendor, level);


--
-- Name: import_fingerprints import_fingerprints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_fingerprints
    ADD CONSTRAINT import_fingerprints_pkey PRIMARY KEY (id);


--
-- Name: invite_requests invite_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_requests
    ADD CONSTRAINT invite_requests_pkey PRIMARY KEY (id);


--
-- Name: levels levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.levels
    ADD CONSTRAINT levels_pkey PRIMARY KEY (key);


--
-- Name: presence presence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presence
    ADD CONSTRAINT presence_pkey PRIMARY KEY (user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_companies project_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_companies
    ADD CONSTRAINT project_companies_pkey PRIMARY KEY (project_id, company_id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (project_id, user_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: report_recipients report_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_recipients
    ADD CONSTRAINT report_recipients_pkey PRIMARY KEY (project_id);


--
-- Name: report_runs report_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_runs
    ADD CONSTRAINT report_runs_pkey PRIMARY KEY (id);


--
-- Name: report_runs report_runs_project_kind_run_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_runs
    ADD CONSTRAINT report_runs_project_kind_run_date_key UNIQUE (project_id, kind, run_date);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: sub_areas sub_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_areas
    ADD CONSTRAINT sub_areas_pkey PRIMARY KEY (area, name);


--
-- Name: systems systems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_pkey PRIMARY KEY (name);


--
-- Name: tier3_areas tier3_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier3_areas
    ADD CONSTRAINT tier3_areas_pkey PRIMARY KEY (area, sub_area, name);


--
-- Name: user_privileges user_privileges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_privileges
    ADD CONSTRAINT user_privileges_pkey PRIMARY KEY (project_id, user_id, priv_key);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: acc_benchmark_imports_proj_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acc_benchmark_imports_proj_idx ON public.acc_benchmark_imports USING btree (project_id, imported_at DESC);


--
-- Name: acc_benchmarks_proj; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acc_benchmarks_proj ON public.acc_benchmarks USING btree (project_id);


--
-- Name: acc_sync_events_proj_ts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX acc_sync_events_proj_ts ON public.acc_sync_events USING btree (project_id, ts DESC);


--
-- Name: activities_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX activities_code_key ON public.activities USING btree (code) WHERE (code IS NOT NULL);


--
-- Name: activity_updates_act_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_updates_act_at_idx ON public.activity_updates USING btree (activity_id, at DESC);


--
-- Name: activity_updates_project_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_updates_project_at_idx ON public.activity_updates USING btree (project_id, at DESC);


--
-- Name: asset_vendor_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asset_vendor_project_idx ON public.asset_vendor USING btree (project_id);


--
-- Name: audit_log_project_ts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_project_ts_idx ON public.audit_log USING btree (project_id, ts DESC);


--
-- Name: cx_week_proj_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cx_week_proj_idx ON public.cx_week USING btree (project_id, week_ending DESC);


--
-- Name: docs_matrix_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX docs_matrix_project_idx ON public.docs_matrix USING btree (project_id);


--
-- Name: docs_override_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX docs_override_project_idx ON public.docs_override USING btree (project_id);


--
-- Name: idx_access_requests_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_access_requests_project ON public.access_requests USING btree (project_id);


--
-- Name: idx_activities_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activities_project ON public.activities USING btree (project_id);


--
-- Name: idx_actsnap_activity_ts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_actsnap_activity_ts ON public.activity_snapshots USING btree (activity_id, ts DESC);


--
-- Name: idx_impfp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_impfp ON public.import_fingerprints USING btree (project_id, hash);


--
-- Name: idx_pm_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pm_project ON public.project_members USING btree (project_id);


--
-- Name: idx_pm_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pm_user ON public.project_members USING btree (user_id);


--
-- Name: invite_requests_activity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invite_requests_activity_idx ON public.invite_requests USING btree (activity_id);


--
-- Name: invite_requests_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invite_requests_project_idx ON public.invite_requests USING btree (project_id);


--
-- Name: invite_requests_unique_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invite_requests_unique_open ON public.invite_requests USING btree (activity_id, requester_id);


--
-- Name: profiles_invite_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_invite_token_idx ON public.profiles USING btree (invite_token);


--
-- Name: vendors_name_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vendors_name_lower ON public.vendors USING btree (lower(name));


--
-- Name: activities trg_assign_activity_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assign_activity_code BEFORE INSERT ON public.activities FOR EACH ROW EXECUTE FUNCTION public.assign_activity_code();


--
-- Name: activities trg_audit_activities; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_activities AFTER INSERT OR DELETE OR UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.audit_activities();


--
-- Name: activity_updates trg_audit_activity_updates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_activity_updates AFTER INSERT ON public.activity_updates FOR EACH ROW EXECUTE FUNCTION public.audit_activity_updates();


--
-- Name: areas trg_audit_areas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_areas AFTER INSERT OR DELETE OR UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.audit_setup();


--
-- Name: branding trg_audit_branding; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_branding AFTER INSERT OR DELETE OR UPDATE ON public.branding FOR EACH ROW EXECUTE FUNCTION public.audit_setup();


--
-- Name: companies trg_audit_companies; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_companies AFTER INSERT OR DELETE OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.audit_setup();


--
-- Name: levels trg_audit_levels; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_levels AFTER INSERT OR DELETE OR UPDATE ON public.levels FOR EACH ROW EXECUTE FUNCTION public.audit_setup();


--
-- Name: user_privileges trg_audit_privs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_privs AFTER INSERT OR DELETE OR UPDATE ON public.user_privileges FOR EACH ROW EXECUTE FUNCTION public.audit_user_privileges();


--
-- Name: profiles trg_audit_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_profiles AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_setup();


--
-- Name: settings trg_audit_settings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_settings AFTER INSERT OR DELETE OR UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.audit_setup();


--
-- Name: sub_areas trg_audit_sub_areas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_sub_areas AFTER INSERT OR DELETE OR UPDATE ON public.sub_areas FOR EACH ROW EXECUTE FUNCTION public.audit_setup();


--
-- Name: systems trg_audit_systems; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_systems AFTER INSERT OR DELETE OR UPDATE ON public.systems FOR EACH ROW EXECUTE FUNCTION public.audit_setup();


--
-- Name: tier3_areas trg_audit_tier3; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_tier3 AFTER INSERT OR DELETE OR UPDATE ON public.tier3_areas FOR EACH ROW EXECUTE FUNCTION public.audit_setup();


--
-- Name: activities trg_completion_window; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_completion_window BEFORE INSERT OR UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.enforce_completion_window();


--
-- Name: activities trg_enforce_activity_locks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_activity_locks BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.enforce_activity_locks();


--
-- Name: activities trg_guard_commit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_commit BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.guard_commit_transition();


--
-- Name: invite_requests trg_guard_invite_request; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_invite_request BEFORE INSERT ON public.invite_requests FOR EACH ROW EXECUTE FUNCTION public.guard_invite_request();


--
-- Name: profiles trg_guard_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_owner BEFORE DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_owner_profile();


--
-- Name: import_fingerprints trg_impfp_prune; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_impfp_prune AFTER INSERT ON public.import_fingerprints FOR EACH ROW EXECUTE FUNCTION public.prune_import_fingerprints();


--
-- Name: asset_override trg_override_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_override_events AFTER INSERT OR UPDATE ON public.asset_override FOR EACH ROW EXECUTE FUNCTION public.tg_override_events();


--
-- Name: activities trg_preserve_activity_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_preserve_activity_code BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.preserve_activity_code();


--
-- Name: asset_register trg_register_events; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_register_events AFTER INSERT OR UPDATE ON public.asset_register FOR EACH ROW EXECUTE FUNCTION public.tg_register_events();


--
-- Name: activities trg_snapshot_activities; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_snapshot_activities AFTER INSERT OR DELETE OR UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.snapshot_activities();


--
-- Name: acc_benchmarks acc_benchmarks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_benchmarks
    ADD CONSTRAINT acc_benchmarks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: acc_sync_events acc_sync_events_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_sync_events
    ADD CONSTRAINT acc_sync_events_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: acc_sync acc_sync_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acc_sync
    ADD CONSTRAINT acc_sync_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: access_requests access_requests_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: access_requests access_requests_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: activities activities_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: activities activities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: activities activities_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: activities activities_retest_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_retest_of_fkey FOREIGN KEY (retest_of) REFERENCES public.activities(id) ON DELETE SET NULL;


--
-- Name: activities activities_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: activity_updates activity_updates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_updates
    ADD CONSTRAINT activity_updates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: areas areas_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: asset_register asset_register_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_register
    ADD CONSTRAINT asset_register_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: asset_status_config asset_status_config_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_status_config
    ADD CONSTRAINT asset_status_config_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: baselines baselines_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baselines
    ADD CONSTRAINT baselines_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: branding branding_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branding
    ADD CONSTRAINT branding_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: crews crews_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crews
    ADD CONSTRAINT crews_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: cx_config cx_config_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cx_config
    ADD CONSTRAINT cx_config_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: cx_step_reference cx_step_reference_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cx_step_reference
    ADD CONSTRAINT cx_step_reference_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: cx_week cx_week_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cx_week
    ADD CONSTRAINT cx_week_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: docs_vendor_target docs_vendor_target_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.docs_vendor_target
    ADD CONSTRAINT docs_vendor_target_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: invite_requests invite_requests_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_requests
    ADD CONSTRAINT invite_requests_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: invite_requests invite_requests_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_requests
    ADD CONSTRAINT invite_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id);


--
-- Name: invite_requests invite_requests_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_requests
    ADD CONSTRAINT invite_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: invite_requests invite_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invite_requests
    ADD CONSTRAINT invite_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: levels levels_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.levels
    ADD CONSTRAINT levels_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: presence presence_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presence
    ADD CONSTRAINT presence_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_companies project_companies_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_companies
    ADD CONSTRAINT project_companies_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: project_companies project_companies_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_companies
    ADD CONSTRAINT project_companies_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: report_recipients report_recipients_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_recipients
    ADD CONSTRAINT report_recipients_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: report_runs report_runs_project_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_runs
    ADD CONSTRAINT report_runs_project_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: settings settings_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: sub_areas sub_areas_area_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_areas
    ADD CONSTRAINT sub_areas_area_fkey FOREIGN KEY (area) REFERENCES public.areas(name) ON DELETE CASCADE;


--
-- Name: sub_areas sub_areas_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sub_areas
    ADD CONSTRAINT sub_areas_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: systems systems_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.systems
    ADD CONSTRAINT systems_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: tier3_areas tier3_areas_area_sub_area_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier3_areas
    ADD CONSTRAINT tier3_areas_area_sub_area_fkey FOREIGN KEY (area, sub_area) REFERENCES public.sub_areas(area, name) ON DELETE CASCADE;


--
-- Name: tier3_areas tier3_areas_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier3_areas
    ADD CONSTRAINT tier3_areas_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: user_privileges user_privileges_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_privileges
    ADD CONSTRAINT user_privileges_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: user_privileges user_privileges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_privileges
    ADD CONSTRAINT user_privileges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: acc_benchmark_imports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acc_benchmark_imports ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_benchmarks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acc_benchmarks ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_sync; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acc_sync ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_sync_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acc_sync_events ENABLE ROW LEVEL SECURITY;

--
-- Name: access_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: activities act_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY act_delete ON public.activities FOR DELETE TO authenticated USING ((public.has_priv(project_id, 'del'::text) AND (public.has_priv(project_id, 'editAny'::text) OR (company_id = public.my_company())) AND ((committed = false) OR public.has_priv(project_id, 'editCommitted'::text) OR public.has_priv(project_id, 'commit'::text))));


--
-- Name: activities act_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY act_insert ON public.activities FOR INSERT TO authenticated WITH CHECK ((public.has_priv(project_id, 'create'::text) AND (public.has_priv(project_id, 'editAny'::text) OR (company_id = public.my_company())) AND ((committed = false) OR public.has_priv(project_id, 'commit'::text))));


--
-- Name: activities act_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY act_read ON public.activities FOR SELECT TO authenticated USING (true);


--
-- Name: activities act_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY act_update ON public.activities FOR UPDATE TO authenticated USING (((public.has_priv(project_id, 'editAny'::text) OR (public.has_priv(project_id, 'editOwn'::text) AND (company_id = public.my_company()))) AND ((committed = false) OR public.has_priv(project_id, 'editCommitted'::text) OR public.has_priv(project_id, 'commit'::text)))) WITH CHECK (((public.has_priv(project_id, 'editAny'::text) OR (public.has_priv(project_id, 'editOwn'::text) AND (company_id = public.my_company()))) AND ((committed = false) OR public.has_priv(project_id, 'commit'::text) OR public.has_priv(project_id, 'editCommitted'::text))));


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_benchmarks admin_acc_benchmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_acc_benchmarks ON public.acc_benchmarks TO authenticated USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: acc_sync admin_acc_sync; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_acc_sync ON public.acc_sync TO authenticated USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: acc_sync_events admin_acc_sync_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_acc_sync_events ON public.acc_sync_events TO authenticated USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: areas admin_areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_areas ON public.areas TO authenticated USING (public.is_project_admin(project_id)) WITH CHECK (public.is_project_admin(project_id));


--
-- Name: asset_register admin_asset_register; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_asset_register ON public.asset_register TO authenticated USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: asset_status_config admin_asset_status_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_asset_status_config ON public.asset_status_config TO authenticated USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: asset_vendor admin_asset_vendor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_asset_vendor ON public.asset_vendor TO authenticated USING (public.is_cx_admin((project_id)::uuid)) WITH CHECK (public.is_cx_admin((project_id)::uuid));


--
-- Name: baselines admin_baselines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_baselines ON public.baselines TO authenticated USING (public.is_project_admin(project_id)) WITH CHECK (public.is_project_admin(project_id));


--
-- Name: branding admin_branding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_branding ON public.branding TO authenticated USING (public.is_project_admin(project_id)) WITH CHECK (public.is_project_admin(project_id));


--
-- Name: companies admin_companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_companies ON public.companies TO authenticated USING (public.is_admin_somewhere()) WITH CHECK (public.is_admin_somewhere());


--
-- Name: crews admin_crews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_crews ON public.crews TO authenticated USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: cx_step_reference admin_cx_step_reference; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_cx_step_reference ON public.cx_step_reference TO authenticated USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: project_members admin_del_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_del_members ON public.project_members FOR DELETE TO authenticated USING (public.is_project_admin(project_id));


--
-- Name: access_requests admin_delete_access_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_delete_access_requests ON public.access_requests FOR DELETE TO authenticated USING (public.is_project_admin(project_id));


--
-- Name: docs_column_ref admin_docs_column_ref; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_docs_column_ref ON public.docs_column_ref TO authenticated USING (public.is_cx_admin((project_id)::uuid)) WITH CHECK (public.is_cx_admin((project_id)::uuid));


--
-- Name: docs_matrix admin_docs_matrix; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_docs_matrix ON public.docs_matrix TO authenticated USING (public.is_cx_admin((project_id)::uuid)) WITH CHECK (public.is_cx_admin((project_id)::uuid));


--
-- Name: docs_override admin_docs_override; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_docs_override ON public.docs_override TO authenticated USING (public.is_cx_admin((project_id)::uuid)) WITH CHECK (public.is_cx_admin((project_id)::uuid));


--
-- Name: docs_status_config admin_docs_status_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_docs_status_config ON public.docs_status_config TO authenticated USING (public.is_cx_admin((project_id)::uuid)) WITH CHECK (public.is_cx_admin((project_id)::uuid));


--
-- Name: docs_vendor_target admin_docs_vendor_target; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_docs_vendor_target ON public.docs_vendor_target TO authenticated USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: project_members admin_ins_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_ins_members ON public.project_members FOR INSERT TO authenticated WITH CHECK (public.is_project_admin(project_id));


--
-- Name: levels admin_levels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_levels ON public.levels TO authenticated USING (public.is_project_admin(project_id)) WITH CHECK (public.is_project_admin(project_id));


--
-- Name: activity_snapshots admin_mark_actsnap; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_mark_actsnap ON public.activity_snapshots FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: profiles admin_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_profiles ON public.profiles TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: access_requests admin_read_access_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_read_access_requests ON public.access_requests FOR SELECT TO authenticated USING (public.is_project_admin(project_id));


--
-- Name: activity_snapshots admin_read_actsnap; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_read_actsnap ON public.activity_snapshots FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: audit_log admin_read_audit; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_read_audit ON public.audit_log FOR SELECT TO authenticated USING (public.is_cx_admin(project_id));


--
-- Name: report_recipients admin_report_recipients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_report_recipients ON public.report_recipients TO authenticated USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: report_runs admin_report_runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_report_runs ON public.report_runs TO authenticated USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: settings admin_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_settings ON public.settings TO authenticated USING (public.is_project_admin(project_id)) WITH CHECK (public.is_project_admin(project_id));


--
-- Name: sub_areas admin_sub_areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_sub_areas ON public.sub_areas TO authenticated USING (public.is_project_admin(project_id)) WITH CHECK (public.is_project_admin(project_id));


--
-- Name: systems admin_systems; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_systems ON public.systems TO authenticated USING (public.is_project_admin(project_id)) WITH CHECK (public.is_project_admin(project_id));


--
-- Name: tier3_areas admin_tier3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_tier3 ON public.tier3_areas TO authenticated USING (public.is_project_admin(project_id)) WITH CHECK (public.is_project_admin(project_id));


--
-- Name: project_members admin_upd_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_upd_members ON public.project_members FOR UPDATE TO authenticated USING (public.is_project_admin(project_id)) WITH CHECK (public.is_project_admin(project_id));


--
-- Name: access_requests admin_update_access_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_update_access_requests ON public.access_requests FOR UPDATE TO authenticated USING (public.is_project_admin(project_id)) WITH CHECK (public.is_project_admin(project_id));


--
-- Name: projects admin_update_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_update_projects ON public.projects FOR UPDATE TO authenticated USING (public.is_project_admin(id)) WITH CHECK (public.is_project_admin(id));


--
-- Name: vendors admin_vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_vendors ON public.vendors TO authenticated USING (public.is_admin_somewhere()) WITH CHECK (public.is_admin_somewhere());


--
-- Name: areas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_event; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_event ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_override; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_override ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_register; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_register ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_status_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_status_config ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_vendor; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset_vendor ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: baselines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.baselines ENABLE ROW LEVEL SECURITY;

--
-- Name: branding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branding ENABLE ROW LEVEL SECURITY;

--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: crews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;

--
-- Name: cx_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cx_config ENABLE ROW LEVEL SECURITY;

--
-- Name: cx_config cx_config_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cx_config_admin ON public.cx_config USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: cx_step_reference; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cx_step_reference ENABLE ROW LEVEL SECURITY;

--
-- Name: cx_week; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cx_week ENABLE ROW LEVEL SECURITY;

--
-- Name: cx_week cx_week_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cx_week_admin ON public.cx_week USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: invite_requests delete_invite_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delete_invite_requests ON public.invite_requests FOR DELETE TO authenticated USING (public.is_cx_admin(project_id));


--
-- Name: docs_column_ref; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.docs_column_ref ENABLE ROW LEVEL SECURITY;

--
-- Name: docs_matrix; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.docs_matrix ENABLE ROW LEVEL SECURITY;

--
-- Name: docs_override; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.docs_override ENABLE ROW LEVEL SECURITY;

--
-- Name: docs_status_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.docs_status_config ENABLE ROW LEVEL SECURITY;

--
-- Name: docs_vendor_target; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.docs_vendor_target ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_event evt_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evt_read ON public.asset_event FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.project_members m
  WHERE ((m.project_id = asset_event.project_id) AND (m.user_id = auth.uid())))));


--
-- Name: asset_event evt_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evt_write ON public.asset_event TO authenticated USING ((public.can_edit_asset(project_id) OR public.can_edit_ee(project_id, asset_tag))) WITH CHECK ((public.can_edit_asset(project_id) OR public.can_edit_ee(project_id, asset_tag)));


--
-- Name: import_fingerprints impfp_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY impfp_ins ON public.import_fingerprints FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: import_fingerprints impfp_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY impfp_read ON public.import_fingerprints FOR SELECT TO authenticated USING (true);


--
-- Name: import_fingerprints; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.import_fingerprints ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_benchmark_imports insert_acc_benchmark_imports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_acc_benchmark_imports ON public.acc_benchmark_imports FOR INSERT TO authenticated WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: access_requests insert_access_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_access_requests ON public.access_requests FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: activity_updates insert_activity_updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_activity_updates ON public.activity_updates FOR INSERT TO authenticated WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: invite_requests insert_invite_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY insert_invite_requests ON public.invite_requests FOR INSERT TO authenticated WITH CHECK (((requester_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM ((public.profiles p
     JOIN public.companies c ON ((c.id = p.company_id)))
     JOIN public.projects pr ON ((pr.id = invite_requests.project_id)))
  WHERE ((p.id = auth.uid()) AND (lower(c.name) = lower(COALESCE(pr.client, ''::text))))))));


--
-- Name: invite_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invite_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: levels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;

--
-- Name: asset_override ovr_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ovr_read ON public.asset_override FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.project_members m
  WHERE ((m.project_id = asset_override.project_id) AND (m.user_id = auth.uid())))) OR public.can_edit_asset(project_id)));


--
-- Name: asset_override ovr_write_ee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ovr_write_ee ON public.asset_override TO authenticated USING (((step_key = public.ee_step(project_id)) AND public.can_edit_ee(project_id, asset_tag))) WITH CHECK (((step_key = public.ee_step(project_id)) AND public.can_edit_ee(project_id, asset_tag)));


--
-- Name: asset_override ovr_write_other; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ovr_write_other ON public.asset_override TO authenticated USING (((step_key <> public.ee_step(project_id)) AND public.can_edit_asset(project_id))) WITH CHECK (((step_key <> public.ee_step(project_id)) AND public.can_edit_asset(project_id)));


--
-- Name: project_members pm_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pm_delete_admin ON public.project_members FOR DELETE TO authenticated USING ((public.is_project_admin(project_id) OR public.is_super()));


--
-- Name: project_members pm_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pm_insert_admin ON public.project_members FOR INSERT TO authenticated WITH CHECK ((public.is_project_admin(project_id) OR public.is_super()));


--
-- Name: project_members pm_select_self_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pm_select_self_or_admin ON public.project_members FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_project_admin(project_id) OR public.is_super()));


--
-- Name: project_members pm_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pm_update_admin ON public.project_members FOR UPDATE TO authenticated USING ((public.is_project_admin(project_id) OR public.is_super())) WITH CHECK ((public.is_project_admin(project_id) OR public.is_super()));


--
-- Name: presence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;

--
-- Name: presence presence_admin_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_admin_sel ON public.presence FOR SELECT TO authenticated USING (public.is_admin());


--
-- Name: presence presence_self_ins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_self_ins ON public.presence FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: presence presence_self_sel; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_self_sel ON public.presence FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: presence presence_self_upd; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_self_upd ON public.presence FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_companies ENABLE ROW LEVEL SECURITY;

--
-- Name: project_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: acc_benchmark_imports read_acc_benchmark_imports; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_acc_benchmark_imports ON public.acc_benchmark_imports FOR SELECT TO authenticated USING (true);


--
-- Name: acc_benchmarks read_acc_benchmarks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_acc_benchmarks ON public.acc_benchmarks FOR SELECT TO authenticated USING (true);


--
-- Name: acc_sync read_acc_sync; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_acc_sync ON public.acc_sync FOR SELECT TO authenticated USING (true);


--
-- Name: acc_sync_events read_acc_sync_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_acc_sync_events ON public.acc_sync_events FOR SELECT TO authenticated USING (true);


--
-- Name: activity_updates read_activity_updates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_activity_updates ON public.activity_updates FOR SELECT TO authenticated USING ((public.is_cx_admin(project_id) OR (EXISTS ( SELECT 1
   FROM public.project_members m
  WHERE ((m.project_id = activity_updates.project_id) AND (m.user_id = auth.uid()))))));


--
-- Name: areas read_areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_areas ON public.areas FOR SELECT TO authenticated USING (public.is_member(project_id));


--
-- Name: asset_register read_asset_register; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_asset_register ON public.asset_register FOR SELECT TO authenticated USING (true);


--
-- Name: asset_status_config read_asset_status_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_asset_status_config ON public.asset_status_config FOR SELECT TO authenticated USING (true);


--
-- Name: asset_vendor read_asset_vendor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_asset_vendor ON public.asset_vendor FOR SELECT TO authenticated USING (true);


--
-- Name: baselines read_baselines; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_baselines ON public.baselines FOR SELECT TO authenticated USING (public.is_member(project_id));


--
-- Name: branding read_branding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_branding ON public.branding FOR SELECT TO authenticated, anon USING (true);


--
-- Name: companies read_companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_companies ON public.companies FOR SELECT TO authenticated USING (true);


--
-- Name: crews read_crews; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_crews ON public.crews FOR SELECT TO authenticated USING (true);


--
-- Name: cx_config read_cx_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_cx_config ON public.cx_config FOR SELECT TO authenticated USING (true);


--
-- Name: cx_step_reference read_cx_step_reference; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_cx_step_reference ON public.cx_step_reference FOR SELECT TO authenticated USING (true);


--
-- Name: cx_week read_cx_week; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_cx_week ON public.cx_week FOR SELECT TO authenticated USING (true);


--
-- Name: docs_column_ref read_docs_column_ref; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_docs_column_ref ON public.docs_column_ref FOR SELECT TO authenticated USING (true);


--
-- Name: docs_matrix read_docs_matrix; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_docs_matrix ON public.docs_matrix FOR SELECT TO authenticated USING (true);


--
-- Name: docs_override read_docs_override; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_docs_override ON public.docs_override FOR SELECT TO authenticated USING (true);


--
-- Name: docs_status_config read_docs_status_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_docs_status_config ON public.docs_status_config FOR SELECT TO authenticated USING (true);


--
-- Name: docs_vendor_target read_docs_vendor_target; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_docs_vendor_target ON public.docs_vendor_target FOR SELECT TO authenticated USING (true);


--
-- Name: invite_requests read_invite_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_invite_requests ON public.invite_requests FOR SELECT TO authenticated USING (((requester_id = auth.uid()) OR public.is_cx_admin(project_id)));


--
-- Name: levels read_levels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_levels ON public.levels FOR SELECT TO authenticated USING (public.is_member(project_id));


--
-- Name: project_members read_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_members ON public.project_members FOR SELECT TO authenticated USING (public.is_member(project_id));


--
-- Name: profiles read_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_profiles ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: project_companies read_project_companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_project_companies ON public.project_companies FOR SELECT TO authenticated USING (true);


--
-- Name: projects read_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_projects ON public.projects FOR SELECT TO authenticated USING (public.is_member(id));


--
-- Name: report_runs read_report_runs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_report_runs ON public.report_runs FOR SELECT TO authenticated USING (true);


--
-- Name: settings read_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_settings ON public.settings FOR SELECT TO authenticated USING (public.is_member(project_id));


--
-- Name: sub_areas read_sub_areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_sub_areas ON public.sub_areas FOR SELECT TO authenticated USING (public.is_member(project_id));


--
-- Name: systems read_systems; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_systems ON public.systems FOR SELECT TO authenticated USING (public.is_member(project_id));


--
-- Name: tier3_areas read_tier3; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_tier3 ON public.tier3_areas FOR SELECT TO authenticated USING (public.is_member(project_id));


--
-- Name: vendors read_vendors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY read_vendors ON public.vendors FOR SELECT TO authenticated USING (true);


--
-- Name: report_recipients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: report_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

--
-- Name: sub_areas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sub_areas ENABLE ROW LEVEL SECURITY;

--
-- Name: projects super_delete_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_delete_projects ON public.projects FOR DELETE TO authenticated USING (public.is_super());


--
-- Name: projects super_insert_projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY super_insert_projects ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_super());


--
-- Name: systems; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;

--
-- Name: tier3_areas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tier3_areas ENABLE ROW LEVEL SECURITY;

--
-- Name: user_privileges up_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY up_owner ON public.user_privileges TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());


--
-- Name: user_privileges up_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY up_read ON public.user_privileges FOR SELECT TO authenticated USING ((public.is_super_or_owner() OR (user_id = auth.uid()) OR (public.proj_role(project_id) = 'admin'::text)));


--
-- Name: invite_requests update_invite_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY update_invite_requests ON public.invite_requests FOR UPDATE TO authenticated USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- Name: user_privileges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_privileges ENABLE ROW LEVEL SECURITY;

--
-- Name: vendors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

--
-- Name: project_companies write_project_companies; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY write_project_companies ON public.project_companies TO authenticated USING (public.is_cx_admin(project_id)) WITH CHECK (public.is_cx_admin(project_id));


--
-- PostgreSQL database dump complete
--

\unrestrict nWdaFyYlIJH9vG00vG0Rv9oqAdIREqDhN7wxkljQq22BeW1ro0YADRfTf7rFUoB

