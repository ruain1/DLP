-- REV187: per-project Crew Capacity toggle (crews-toggle.sql)
-- Default OFF for every project; FIN3021 (Vantaa) backfilled ON so the
-- current behaviour there is unchanged. Run BEFORE pushing the app files.

alter table settings add column if not exists crews_enabled boolean not null default false;

update settings set crews_enabled = true
where project_id = (select id from projects where name = 'Vantaa');

-- Verification:
--   select p.name, s.crews_enabled from settings s join projects p on p.id = s.project_id order by p.name;
--   Expect: Vantaa true, everything else false.
