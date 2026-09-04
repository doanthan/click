-- Applied-migrations ledger.
--
-- Until now there was no record of which SQL files had been run against a given
-- database, so drift was silent (see the 014→020 gap that broke
-- event_attendees.hold_expires_at). This table is that record: scripts/run-migrations.mjs
-- bootstraps it, skips any file already listed here, and inserts a row after a
-- file applies cleanly. `checksum` is the sha256 of the file at apply time -
-- informational only (the runner warns, but does not block, if a recorded file
-- later changes on disk). `filename` is the basename, so every migration -
-- including any that share a number prefix - gets its own row.

create table if not exists schema_migrations (
  filename text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
