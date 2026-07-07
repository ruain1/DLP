-- ============================================================
-- FIN04 Lookahead  -  schema, security and audit
-- Run once in the Supabase SQL editor (paste the whole file).
-- ============================================================

-- ---------- tables ----------
create table if not exists companies (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists areas   ( name text primary key );
create table if not exists systems ( name text primary key );

create table if not exists levels (
  key   text primary key,            -- 'L1' .. 'L4'
  name  text not null,
  color text not null,
  sort  int  not null default 0
);

create table if not exists settings (
  id int primary key default 1,
  weeks int not null default 4,
  make_ready_days int not null default 7,
  constraint settings_singleton check (id = 1)
);

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  role       text not null default 'member' check (role in ('admin','member')),
  company_id uuid references companies(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists activities (
  id            uuid primary key default gen_random_uuid(),
  descr         text not null default '',
  company_id    uuid references companies(id) on delete set null,
  area          text,
  system        text,
  level         text,
  is_milestone  boolean not null default false,
  start_date    date,
  duration      int not null default 1,
  committed     boolean not null default false,
  status        text not null default 'planned',
  actual_start  date,
  actual_finish date,
  constraints   jsonb not null default '[]'::jsonb,
  created_by    uuid references auth.users(id),
  updated_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists audit_log (
  id        bigint generated always as identity primary key,
  ts        timestamptz not null default now(),
  user_id   uuid,
  user_name text,
  action    text not null,
  entity    text,
  entity_id text,
  detail    text
);

-- ---------- helper functions (security definer to avoid RLS recursion) ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_company() returns uuid
language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid();
$$;

-- ---------- enable RLS ----------
alter table companies  enable row level security;
alter table areas      enable row level security;
alter table systems    enable row level security;
alter table levels     enable row level security;
alter table settings   enable row level security;
alter table profiles   enable row level security;
alter table activities enable row level security;
alter table audit_log  enable row level security;

-- ---------- policies: setup tables (read all authenticated, write admin) ----------
do $$ declare t text;
begin
  foreach t in array array['companies','areas','systems','levels','settings','profiles'] loop
    execute format('drop policy if exists read_%1$s on %1$s;', t);
    execute format('create policy read_%1$s on %1$s for select to authenticated using (true);', t);
    execute format('drop policy if exists admin_%1$s on %1$s;', t);
    execute format('create policy admin_%1$s on %1$s for all to authenticated using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- ---------- policies: activities (read all, write admin or own company) ----------
drop policy if exists read_activities    on activities;
drop policy if exists insert_activities  on activities;
drop policy if exists update_activities  on activities;
drop policy if exists delete_activities  on activities;
create policy read_activities   on activities for select to authenticated using (true);
create policy insert_activities on activities for insert to authenticated
  with check ( public.is_admin() or company_id = public.my_company() );
create policy update_activities on activities for update to authenticated
  using ( public.is_admin() or company_id = public.my_company() )
  with check ( public.is_admin() or company_id = public.my_company() );
create policy delete_activities on activities for delete to authenticated
  using ( public.is_admin() or company_id = public.my_company() );

-- ---------- policies: audit_log (admin read only; writes only via triggers) ----------
drop policy if exists admin_read_audit on audit_log;
create policy admin_read_audit on audit_log for select to authenticated using (public.is_admin());

-- ---------- audit triggers ----------
create or replace function public.audit_activities() returns trigger
language plpgsql security definer set search_path = public as $$
declare uname text; act text; eid text; det text;
begin
  select coalesce(name,'') into uname from profiles where id = auth.uid();
  if (tg_op = 'INSERT') then act:='Create activity'; eid:=new.id::text; det:=new.descr;
  elsif (tg_op = 'UPDATE') then act:='Edit activity'; eid:=new.id::text; det:=new.descr;
  else act:='Delete activity'; eid:=old.id::text; det:=old.descr; end if;
  insert into audit_log(user_id,user_name,action,entity,entity_id,detail)
  values (auth.uid(), uname, act, 'activity', eid, det);
  if (tg_op='DELETE') then return old; else return new; end if;
end; $$;

-- Human-readable detail per setup table (REV142). Action and entity are unchanged so the
-- digest classifier still routes rows; only the stored detail changes from raw JSON to a label.
create or replace function public.audit_setup() returns trigger
language plpgsql security definer set search_path = public as $$
declare uname text; act text; det text; rec json;
begin
  select coalesce(name,'') into uname from profiles where id = auth.uid();
  act := initcap(lower(tg_op)) || ' ' || tg_table_name;
  rec := case when tg_op = 'DELETE' then row_to_json(old) else row_to_json(new) end;
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
  insert into audit_log(user_id,user_name,action,entity,detail)
  values (auth.uid(), uname, act, tg_table_name, det);
  if (tg_op = 'DELETE') then return old; else return new; end if;
end; $$;

drop trigger if exists trg_audit_activities on activities;
create trigger trg_audit_activities after insert or update or delete on activities
  for each row execute function public.audit_activities();

do $$ declare t text;
begin
  foreach t in array array['companies','areas','systems','levels','settings','profiles'] loop
    execute format('drop trigger if exists trg_audit_%1$s on %1$s;', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on %1$s for each row execute function public.audit_setup();', t);
  end loop;
end $$;

-- ---------- create a profile automatically on signup ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), 'member')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- realtime ----------
do $$ declare t text;
begin
  foreach t in array array['activities','companies','areas','systems','levels','settings','profiles','audit_log'] loop
    begin execute format('alter publication supabase_realtime add table %s;', t); exception when others then null; end;
  end loop;
end $$;

-- ---------- seed setup data ----------
insert into settings (id, weeks, make_ready_days) values (1,4,7) on conflict (id) do nothing;
insert into levels (key,name,color,sort) values
  ('L1','Factory','#64748B',1),
  ('L2','Site install & static','#0E9384',2),
  ('L3','Energise / startup / functional','#D97706',3),
  ('L4','Performance','#7C3AED',4)
on conflict (key) do nothing;
insert into companies (name) values ('Nordic EPOD'),('Mecwide'),('Eaton'),('Baudouin'),('Daikin'),('IKM')
on conflict (name) do nothing;
insert into areas (name) values ('Data Hall 1'),('Data Hall 2'),('MV Room'),('Electrical Room'),('Generator Yard'),('Cooling Plant'),('Pump Room')
on conflict (name) do nothing;
insert into systems (name) values ('MV Switchgear'),('LV Distribution'),('Generators'),('UPS'),('Chilled Water'),('CRAH/CRAC'),('BMS'),('EPMS')
on conflict (name) do nothing;

-- ============================================================
-- AFTER you sign up your own account once, make yourself admin:
--   update profiles set role='admin'
--   where id = (select id from auth.users where email = 'you@yourdomain.com');
-- ============================================================
