begin;

-- 059_profile_deletion.sql
--
-- Records that a profile has been de-identified at the member's request.
--
-- WHY DE-IDENTIFY RATHER THAN DELETE
--   The privacy policy (src/app/privacy/page.tsx) tells people they may
--   "request deletion of your personal information" and, one section earlier,
--   that "some records, such as financial transactions, must be retained for
--   the period required by Australian law". Both are true at once, and APP 11.2
--   allows exactly this: destroy OR de-identify.
--
--   A hard `delete from profiles` would satisfy neither well. Most child tables
--   cascade, so it would silently rewrite historical event headcounts, and
--   payment_transactions.profile_id is ON DELETE SET NULL - so the ledger rows
--   would survive with no idea who paid, which is the record we are legally
--   required to keep. Scrubbing the profile in place keeps every foreign key
--   valid while leaving nothing in it that identifies a person.
--
--   What gets scrubbed and what is deliberately kept is documented at the one
--   write site: anonymiseMemberAsAdmin in src/lib/event-repository.ts.
--
-- WHY A COLUMN AND NOT AN INFERENCE
--   "Is this profile deleted" must not be guessed from a placeholder email
--   pattern. A timestamp is checkable, indexable, and survives someone later
--   changing the placeholder format.

alter table profiles
  add column if not exists deleted_at timestamptz;

comment on column profiles.deleted_at is
  'Set when the profile was de-identified at the member''s request. The row is retained so financial and booking records stay linkable; every identifying field on it has been cleared.';

-- Partial index: the only question ever asked of this column is "which profiles
-- are deleted", and that set stays tiny next to the table.
create index if not exists profiles_deleted_at_idx
  on profiles (deleted_at)
  where deleted_at is not null;

commit;
