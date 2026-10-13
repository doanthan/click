-- 075: Dating fail-safe (HOTFIX 2026-10-12 H1, Cindy).
--
-- Until the dating build ships, no member is dating-visible and no dating signal
-- renders anywhere. Fail closed.
--
-- Spec names, live names: romantic_visible = profiles.dating_visible,
-- date_of_birth = profiles.birth_date, intent 'romantic' = 'dating'.
--
-- Apply BEFORE deploying the code that calls is_romantically_compatible().
-- Applied first, it already makes the old code fail closed: every row is off,
-- and the check below stops anything turning one back on.

-- 1. Off by default, and off for everyone. connection_intents is untouched:
--    "open to dating" stays the member's stated intent, it just makes nobody
--    visible.
alter table profiles alter column dating_visible set default false;
update profiles set dating_visible = false where dating_visible;

-- 2. What the dating gate reads. Nothing collects these yet - the dating build
--    does - so they stay NULL, and NULL fails every gate below. 10 §2.4 keeps
--    the age range on personality_profiles, which does not exist live, so it
--    sits on profiles beside dating_preference.
alter table profiles
  add column if not exists dating_preference text,
  add column if not exists dating_age_min smallint,
  add column if not exists dating_age_max smallint;

alter table profiles drop constraint if exists profiles_dating_preference_check;
alter table profiles add constraint profiles_dating_preference_check
  check (dating_preference in ('men', 'women', 'everyone'));

alter table profiles drop constraint if exists profiles_dating_age_range_check;
alter table profiles add constraint profiles_dating_age_range_check
  check (
    (dating_age_min is null or dating_age_min between 18 and 120)
    and (dating_age_max is null or dating_age_max between 18 and 120)
    and (dating_age_min is null or dating_age_max is null or dating_age_min <= dating_age_max)
  );

-- 3. Dating-visible only with gender, preference and birth date all set - held
--    against EVERY writer, not only set_romantic_visible, so a script, an old
--    deploy or a stray UPDATE cannot leave a row on.
alter table profiles drop constraint if exists profiles_dating_visible_needs_profile;
alter table profiles add constraint profiles_dating_visible_needs_profile
  check (
    not dating_visible
    or (nullif(btrim(gender), '') is not null
        and dating_preference is not null
        and birth_date is not null)
  );

-- 4. 10 §2.4: the one way to switch dating visibility on. The spec gates on
--    dating_preference; the hotfix adds gender and birth date. 10 §2.4's
--    relationship_friends check has no live intent value to test.
create or replace function set_romantic_visible(p_user_id uuid, p_visible boolean)
returns void
language plpgsql
as $$
declare
  v_profile profiles%rowtype;
begin
  select * into v_profile from profiles where id = p_user_id;
  if not found then
    raise exception 'profile_not_found';
  end if;

  if p_visible then
    if nullif(btrim(v_profile.gender), '') is null then
      raise exception 'gender_required';
    end if;
    if v_profile.dating_preference is null then
      raise exception 'dating_preference_required';
    end if;
    if v_profile.birth_date is null then
      raise exception 'date_of_birth_required';
    end if;
  end if;

  update profiles set dating_visible = coalesce(p_visible, false) where id = p_user_id;
end;
$$;

-- 5. 10 §3: the one dating rule. Every surface calls this; none re-implements
--    it. Every blank value is a hard false, tested BEFORE any comparison: in
--    10 §3's own text `v_b.gender != 'male'` is NULL for a blank gender, an IF
--    on NULL does not fire, and the pair passes. A blank preference passed the
--    same way, so it fails here too.
create or replace function is_romantically_compatible(p_user_a uuid, p_user_b uuid)
returns boolean
language plpgsql
stable
as $$
declare
  v_a profiles%rowtype;
  v_b profiles%rowtype;
  v_a_gender text;
  v_b_gender text;
  v_a_age int;
  v_b_age int;
begin
  if p_user_a is null or p_user_b is null or p_user_a = p_user_b then
    return false;
  end if;
  select * into v_a from profiles where id = p_user_a;
  if not found then return false; end if;
  select * into v_b from profiles where id = p_user_b;
  if not found then return false; end if;

  v_a_gender := lower(nullif(btrim(v_a.gender), ''));
  v_b_gender := lower(nullif(btrim(v_b.gender), ''));

  -- Blank = hard fail.
  if v_a_gender is null or v_b_gender is null then return false; end if;
  if v_a.dating_preference is null or v_b.dating_preference is null then return false; end if;
  if v_a.birth_date is null or v_b.birth_date is null then return false; end if;

  -- Rule 1: both romantically visible.
  if not (v_a.dating_visible and v_b.dating_visible) then return false; end if;

  -- Both hold the dating intent.
  if not ('dating' = any(v_a.connection_intents)) then return false; end if;
  if not ('dating' = any(v_b.connection_intents)) then return false; end if;

  -- Rule 3: each wants the other's gender. Only 'male' / 'female' satisfy
  -- men / women, so non-binary and prefer-not-to-say are accepted only by
  -- 'everyone' (10 §3's note).
  if v_a.dating_preference = 'men' and v_b_gender <> 'male' then return false; end if;
  if v_a.dating_preference = 'women' and v_b_gender <> 'female' then return false; end if;
  if v_b.dating_preference = 'men' and v_a_gender <> 'male' then return false; end if;
  if v_b.dating_preference = 'women' and v_a_gender <> 'female' then return false; end if;

  -- Age ranges, both directions (10 §3 semantics): both bounds NULL = no limit,
  -- a NULL min is the platform floor of 18, a NULL max is no ceiling.
  v_a_age := extract(year from age(v_a.birth_date));
  v_b_age := extract(year from age(v_b.birth_date));
  if v_b.dating_age_min is not null or v_b.dating_age_max is not null then
    if v_a_age < coalesce(v_b.dating_age_min, 18) then return false; end if;
    if v_b.dating_age_max is not null and v_a_age > v_b.dating_age_max then return false; end if;
  end if;
  if v_a.dating_age_min is not null or v_a.dating_age_max is not null then
    if v_b_age < coalesce(v_a.dating_age_min, 18) then return false; end if;
    if v_a.dating_age_max is not null and v_b_age > v_a.dating_age_max then return false; end if;
  end if;

  return true;
end;
$$;
