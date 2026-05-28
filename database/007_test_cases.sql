-- Editable QA test cases + per-case comment threads for the /test page.
-- - test_cases: anyone on /test can add or remove a case and flip its status.
-- - test_case_comments: a thread of notes attached to one test case.
-- No auth on /test, so author is a free-text name typed by the person.

begin;

create table if not exists test_cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  status text not null default 'todo'
    check (status in ('todo', 'passing', 'failing', 'blocked')),
  author text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists test_case_comments (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid not null references test_cases(id) on delete cascade,
  author text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists test_case_comments_case_idx
  on test_case_comments(test_case_id, created_at);

create index if not exists test_cases_created_idx
  on test_cases(created_at desc);

-- Match the rest of the schema: RLS on. The app reads/writes via the pooled
-- `postgres` role (DATABASE_URL), which bypasses RLS as the table owner.
alter table test_cases enable row level security;
alter table test_case_comments enable row level security;

commit;
