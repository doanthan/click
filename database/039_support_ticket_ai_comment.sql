-- AI fixer commentary for the support-ticket triage board.
--
-- When the AI fixer pass resolves a bug it now records WHAT it changed here, in
-- addition to flipping ai_fixed=true. This mirrors the new "AI Comment" column
-- on the Google Sheet board (src/lib/support-sheets.ts) and shows up in the
-- Supabase Studio row drawer (Table Editor -> support_tickets -> click a row),
-- so a human tester can read the change summary before confirming the fix.

alter table support_tickets
  add column if not exists ai_comment text;

comment on column support_tickets.ai_comment is
  'AI fixer''s summary of what was changed to resolve this bug (set when ai_fixed flips true). Synced to the "AI Comment" column on the Google Sheet triage board; shown in the Studio row drawer for the human tester.';
