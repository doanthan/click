-- Add four more values to the connection_intent enum so step 3 of /onboarding
-- (and the matching profile/register surfaces) can offer broader reasons for
-- joining beyond the original dating/friendship/networking/exploring set.
--
-- Postgres ≥12 allows ALTER TYPE ... ADD VALUE inside a transaction, so this
-- file follows the begin/commit style used by the rest of database/*.sql.
-- The new values can't be referenced in the same transaction, which is fine
-- here — we only define them, we don't query against them.

begin;

alter type connection_intent add value if not exists 'hobbies';
alter type connection_intent add value if not exists 'wellness';
alter type connection_intent add value if not exists 'community';
alter type connection_intent add value if not exists 'new_in_town';

commit;
