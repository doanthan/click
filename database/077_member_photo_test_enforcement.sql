-- 077: Enforce the member, photo and test-account rules in the database
-- (build prompt 1, Cindy 2026-10-15).
--
-- Apply AFTER 076, after the three reviewed backfills, and together with the
-- code that reads these columns - not before. The code in production today
-- checks none of this, so applied early these triggers would refuse its click
-- sends for anyone the backfills have not cleared yet.
--
-- A click or a mutual click can never cross the test boundary, and between
-- real members it needs both people to be members with a passing photo. The
-- app checks all of this before it writes; this is for everything that does
-- not go through the app - the scripts that insert clicks directly can still
-- seed TEST pairs, and can no longer reach a real member. (photo_status's own
-- trigger is in 076: it changes nothing the old code can see.)

begin;

create or replace function click_pair_is_eligible(p_a uuid, p_b uuid)
returns boolean
language sql
stable
as $$
  select a.is_test = b.is_test
     and (
       a.is_test
       or (a.photo_status = 'ok' and b.photo_status = 'ok'
           and a.member_onboarded_at is not null and b.member_onboarded_at is not null)
     )
  from profiles a, profiles b
  where a.id = p_a and b.id = p_b;
$$;

create or replace function clicks_require_eligible_pair()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'clicks' then
    if click_pair_is_eligible(new.sender_id, new.receiver_id) is not true then
      raise exception 'click refused: % and % are not an eligible pair', new.sender_id, new.receiver_id
        using errcode = 'check_violation';
    end if;
  else
    if click_pair_is_eligible(new.user_a_id, new.user_b_id) is not true then
      raise exception 'mutual click refused: % and % are not an eligible pair', new.user_a_id, new.user_b_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clicks_require_eligible_pair on clicks;
create trigger clicks_require_eligible_pair
  before insert on clicks
  for each row execute function clicks_require_eligible_pair();

drop trigger if exists mutual_clicks_require_eligible_pair on mutual_clicks;
create trigger mutual_clicks_require_eligible_pair
  before insert on mutual_clicks
  for each row execute function clicks_require_eligible_pair();

commit;
