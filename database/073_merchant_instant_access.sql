begin;

-- 073_merchant_instant_access.sql
--
-- Hosts in the launch pilot no longer wait for an admin to approve their
-- application. Submitting the signup form makes them an approved host straight
-- away (registerMerchantWizardSubmit), so they can build an event and connect
-- payouts in the same sitting. The review moves to their FIRST EVENT: they
-- start untrusted (auto_approve_events = false), so that event lands 'pending'
-- and nothing they make is public until an admin approves it.
--
-- This column is what makes that one approval also trust them. It is a one-shot
-- flag, set only at instant-access signup:
--
--   * approveEventForAdmin -> trustHostAfterFirstEventReview turns
--     auto_approve_events on and the flag off, so their later events publish
--     straight away;
--   * any explicit admin decision about the host clears it without granting
--     anything - setMerchantAutoApproveForAdmin ("Review every event" /
--     "Trust merchant") and updateMerchantVerificationForAdmin (approve,
--     reject, suspend). So an admin who puts a host on "Review every event"
--     keeps them there, which is the bug board #259 rule.
--
-- Existing hosts default to false: nothing about them changes.
--
-- Idempotent - safe to re-run.

alter table merchant_profiles
  add column if not exists trust_after_first_event boolean not null default false;

commit;
