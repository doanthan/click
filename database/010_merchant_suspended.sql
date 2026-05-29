-- Allow admins to suspend approved merchants. A suspended merchant's events
-- are hidden from the public Discover feed (see getEventsForExplore /
-- getEventCategories in src/lib/event-repository.ts) but the merchant's own
-- merchant dashboard and any confirmed RSVPs still resolve, so attendees
-- aren't kicked out of bookings they already hold.

begin;

alter table merchant_profiles
  drop constraint if exists merchant_profiles_verification_status_check;

alter table merchant_profiles
  add constraint merchant_profiles_verification_status_check
    check (verification_status in ('pending', 'approved', 'rejected', 'suspended'));

commit;
