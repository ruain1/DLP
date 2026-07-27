-- REV349: review the Morning Cx Update narrative before it sends.
--
-- The morning run is claimed and assembled exactly as before, then parked with
-- status 'draft' instead of being mailed. narrative holds the editable AI text so a
-- reviewer can change it and have the email rebuilt from it; drafted_at starts the
-- grace clock that the failsafe sweep uses to send an unreviewed draft anyway.
--
-- status has no CHECK constraint on this table, so 'draft' and 'skipped' need no
-- constraint change. Both columns are nullable and additive: every existing row and
-- every existing code path is unaffected, and with review off nothing writes them.

alter table public.report_runs add column if not exists narrative  text;
alter table public.report_runs add column if not exists drafted_at timestamptz;

comment on column public.report_runs.narrative  is 'REV349: editable AI narrative for a morning run held for review.';
comment on column public.report_runs.drafted_at is 'REV349: when a morning run was parked as a draft; starts the review grace window.';

-- Finding today's pending draft runs on every scheduler tick, so keep it cheap.
create index if not exists report_runs_draft_idx
  on public.report_runs (project_id, kind, status)
  where status = 'draft';
