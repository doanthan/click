-- Trusted-merchant auto-approval.
--
-- Admins asked to only have to review a merchant's FIRST event. Once an admin
-- approves one event for a merchant (a manual QA pass), that merchant is
-- trusted and their subsequent events can publish straight to 'live' without
-- sitting in the pending queue.
--
-- This flag is flipped on automatically the first time `approveEventForAdmin`
-- approves one of the merchant's events. Admins can revoke it from the merchant
-- detail page (POST /api/admin/merchants/[merchantId]/auto-approve) to send a
-- merchant back to manual review.
--
-- Idempotent - safe to re-run.

begin;

alter table merchant_profiles
  add column if not exists auto_approve_events boolean not null default false;

commit;
