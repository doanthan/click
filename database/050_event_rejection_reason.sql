-- 050_event_rejection_reason.sql
--
-- When an admin declines a pending event, the free-text reason previously only
-- went to the rejection email + audit log — the merchant had no way to see it
-- back on the event page when fixing + resubmitting (bug board #217). Persist
-- the reason (and when it happened) on the event row so the merchant detail page
-- can show "here's what to fix" and a Resubmit-for-review action. Cleared when
-- the merchant resubmits (status flips rejected → pending/live).

alter table events
  add column if not exists rejection_reason text,
  add column if not exists rejected_at timestamptz;
