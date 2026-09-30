begin;

-- 071_click_quiz.sql
--
-- The Click quiz: ONE five-step modal in place of the Life quiz (four sections
-- of life tags) and the Personality quiz (four questions and an intent split).
-- Canon: click-tech UIUX/Cowork/Click_Design_Prompt_Quiz.md (rev 5 Jul 2026)
-- for the questions, TECH/08_LIFE_TAGS.md section 2 for what each answer
-- generates. The taxonomy and every derivation live in src/lib/click-quiz.ts.
--
-- WHERE AN ANSWER GOES
--   Life chapter, pet, LGBTQ+ and alcohol-free answers become life tags in
--   user_tags (tag_type 'life', source 'quiz'), exactly where the Life quiz put
--   its answers. Recharge, strangers and pace become a click_personas row. Both
--   are read by matching and rendered nowhere. Everything else the quiz asks -
--   room size, vibe, structure, who you click with, social mood, comfort needs,
--   free days, travel range - has no matching feature yet, so the raw answers
--   are kept here until one exists.
--
-- WHY ITS OWN TABLE, NOT A COLUMN ON profiles
--   The answers include LGBTQ+ self-identification. profiles is read by dozens
--   of queries, several of them public projections; a table that only the quiz
--   reads cannot be selected into one of those by accident.

create table if not exists click_quiz_answers (
  profile_id uuid primary key references profiles(id) on delete cascade,
  -- question id -> option value (single) or option values (multi). Sanitised
  -- against the taxonomy on every write, so it never holds an unknown key.
  answers jsonb not null default '{}'::jsonb,
  -- The step a member reopens on while unfinished: 1-5. 0 = never advanced.
  step smallint not null default 0 check (step between 0 and 5),
  -- Set by Finish. From then on every autosave also refreshes the derived life
  -- tags and persona, so an edit made later cannot leave matching behind.
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table click_quiz_answers enable row level security;

comment on table click_quiz_answers is
  'The Click quiz answers, one row per member, written only by saveClickQuiz. Private: never rendered to anyone, cleared by anonymiseMemberAsAdmin. Life tags and the persona are derived from it (src/lib/click-quiz.ts).';

-- Every question in the Click quiz is optional, and it never asks about event
-- frequency, so a persona it writes can be missing any of these. They were NOT
-- NULL because the Personality quiz refused to save until all four were
-- answered. The CHECK constraints stay: a value, when present, is still one of
-- the allowed ones. Readers treat a row with no social_energy as no persona.
alter table click_personas
  alter column persona_name drop not null,
  alter column social_energy drop not null,
  alter column pace drop not null,
  alter column openness drop not null,
  alter column engagement_frequency drop not null;

commit;
