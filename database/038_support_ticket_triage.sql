-- 038_support_ticket_triage.sql
--
-- Extends the bug reporter into a triage board synced to Google Sheets, where
-- both an AI fixer (a Claude Code run that reads the sheet, fixes each bug, and
-- ticks "AI fixed") and humans (who confirm fixes or send them back) collaborate.
--
-- The reporter now captures the bug as two parts so the AI has a clear target:
--   what_is_wrong - the observed/broken behaviour (was: message)
--   expected_behavior - what it should do instead
--
-- Triage flags mirrored to the sheet:
--   is_issue - false = triaged as "not a real bug" (greyed out)
--   ai_fixed - set true by the AI fixer pass (amber row)
--   status - 'open' (red) → 'fixed' (green, user-confirmed)

alter table support_tickets
  add column if not exists expected_behavior text,
  add column if not exists is_issue boolean not null default true,
  add column if not exists ai_fixed boolean not null default false;
