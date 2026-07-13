-- REV308: promote Invite Type into a managed per-project list, mirroring systems.
-- Deliberate difference from systems: systems has a name-only primary key, so a name
-- cannot exist in two projects. Invite types share a common vocabulary (W2, L2 FOK, ...)
-- across every project, so this table uses a composite (project_id, name) primary key.
-- Idempotent: safe to run more than once.

create table if not exists public.invite_types (
  project_id uuid not null default 'f1040000-0000-4000-a000-000000000001'::uuid references public.projects(id),
  name text not null,
  created_at timestamptz not null default now(),
  primary key (project_id, name)
);

alter table public.invite_types enable row level security;

-- members of the project can read the list
drop policy if exists read_invite_types on public.invite_types;
create policy read_invite_types on public.invite_types
  for select to authenticated
  using (public.is_member(project_id));

-- project admins (owner / super / admin) can add, rename, and delete
drop policy if exists admin_invite_types on public.invite_types;
create policy admin_invite_types on public.invite_types
  to authenticated
  using (public.is_project_admin(project_id))
  with check (public.is_project_admin(project_id));

grant select, insert, update, delete on public.invite_types to authenticated;

-- seed the current eight defaults into every existing project (idempotent)
insert into public.invite_types (project_id, name)
select p.id, v.name
from public.projects p
cross join (values ('L2 FOK'), ('W2'), ('IVC'), ('L3 FOK'), ('L3 SU'), ('L3 SAT'), ('L4 FPT'), ('L5 IST')) as v(name)
on conflict (project_id, name) do nothing;

-- verification: one row per project, count should be 8 (or more if any were already present)
select p.code, count(t.name) as types
from public.projects p
left join public.invite_types t on t.project_id = p.id
group by p.code
order by p.code;
