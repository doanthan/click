-- 023_click_personas.sql (renumbered from 017 to keep migration numbers unique)
--
-- The click_personas table was added by appending to 001_schema.sql after the
-- base schema had already been provisioned. Databases created before that edit
-- (e.g. production) never got the table, so the Personality Quiz "Save Persona"
-- server action throws on insert - surfacing as an opaque server error right
-- after submit. The read path (getLatestPersonaForSession) swallows the error
-- and returns null, which is why only the write breaks.
--
-- This migration is idempotent: safe to run on every environment, including
-- ones that already have the table from 001_schema.sql.

begin;

create table if not exists click_personas (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  persona_name text not null,
  social_energy text not null check (social_energy in ('introvert', 'ambivert', 'extrovert')),
  pace text not null check (pace in ('relaxed', 'balanced', 'fast_moving')),
  openness text not null check (openness in ('cautious', 'curious', 'ready')),
  engagement_frequency text not null check (engagement_frequency in ('occasional', 'active', 'enthusiastic')),
  intent_mix jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists click_personas_profile_idx
  on click_personas(profile_id, generated_at desc);

alter table click_personas enable row level security;

commit;
