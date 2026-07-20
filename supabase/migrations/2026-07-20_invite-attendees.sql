-- REV321: per-project witness invite attendee matrix.
-- Editable in Settings > User management > Invite Attendees (owner and admins).
-- Shape stored in the jsonb:
--   { "to": { "MECHANICAL": [...], "ELECTRICAL": [...], "BMS/EPMS": [...], "FLS": [...] },
--     "cc": [...], "organiser": [...] }
-- Empty {} means unconfigured: the app falls back to the hardcoded FIN04 seed for FIN04 and
-- treats any other project as unconfigured until this is filled and saved.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS invite_attendees jsonb DEFAULT '{}'::jsonb NOT NULL;
