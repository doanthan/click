-- 062_rotate_mutual_terminals.sql
--
-- NOT YET APPLIED. This rewrites rows in a live table, so it needs sign-off before
-- anyone runs it. Read the count query at the bottom first.
--
-- The three non-active mutual_clicks terminals were written one place out of step
-- with the meanings 049 declared for them (and with 21_CLICK_MECHANIC §B2 / §B7.9):
--
--   exit                    code wrote     spec means
--   ----------------------  -------------  ------------------------------------------
--   7-day silence lapse     'expired'      'released'   soft, 30d cooldown, re-clickable
--   "Not feeling it"        'released'     'suppressed' deliberate soft-no, 90d
--   block / ban teardown    'suppressed'   'expired'    permanent, NEVER resurfaces
--
-- Nothing read the difference while all three were merely "not active", which is why
-- it went unnoticed. It stops being cosmetic the moment anything decides, off the
-- status, whether a pair may meet again - which the B7.9 rediscovery cooldown and the
-- "past clicks" shelf now do. Left unrotated:
--   * every pair who simply went quiet for a week sits on 'expired', the one terminal
--     defined as permanent, and can never be suggested to each other again;
--   * every "not feeling it" sits on 'released', so it shows on the past-clicks shelf
--     the person dismissed it from, and reopens after 30 days instead of 90;
--   * every blocked/banned pair sits on 'released', which the shelf reads as readable
--     history (the user_blocks anti-join still hides them, but the status is a lie).
--
-- The mapping is unambiguous because each old value had exactly one writer:
--   'expired'    <- expireClickLifecycles only
--   'released'   <- releaseMutualForSession only
--   'suppressed' <- severPairCoordination / severAllCoordinationForUser only
-- (Verified by grep over src/ at the time this was written. 'connected' was never
-- written by anything, so it needs no rotation and none of the arms touch it.)
--
-- It is a 3-cycle, so it cannot be done as three sequential UPDATEs without the
-- second undoing the first. One statement, one pass, via CASE.

begin;

-- Rotate active -> nothing; the four terminals map as above. 'active' and
-- 'connected' are passed through untouched.
update mutual_clicks
set status = case status
      when 'expired'    then 'released'::mutual_status
      when 'released'   then 'suppressed'::mutual_status
      when 'suppressed' then 'expired'::mutual_status
      else status
    end,
    updated_at = now()
where status in ('expired', 'released', 'suppressed');

-- ended_at is what the 30-day rediscovery cooldown reads, and every terminal writer
-- has always set it. Backfill any historic row that predates that so a released pair
-- is not stuck out of discovery forever on a NULL comparison (NULL > x is NULL, which
-- the cooldown's NOT EXISTS treats as "no cooldown" - so this is belt-and-braces, and
-- it makes the "past clicks" ordering honest either way).
update mutual_clicks
set ended_at = coalesce(ended_at, expires_at, updated_at, created_at)
where status <> 'active' and ended_at is null;

commit;

-- Run this FIRST, on its own, to see what the rotation would touch:
--
--   select status, count(*)
--   from mutual_clicks
--   group by status
--   order by status;
--
-- If every count is 0 the rotation is a no-op and can be applied without ceremony.
