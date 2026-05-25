-- Minimal 1-to-1 messaging. Conversations are pairwise (profile_a < profile_b)
-- so a unique constraint enforces no duplicates. Messages are append-only.
-- No realtime; the UI polls on navigation.

begin;

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  profile_a_id uuid not null references profiles(id) on delete cascade,
  profile_b_id uuid not null references profiles(id) on delete cascade,
  source_mutual_click_id uuid references mutual_clicks(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_ordered_pair check (profile_a_id < profile_b_id),
  unique (profile_a_id, profile_b_id)
);

create index if not exists conversations_profile_a_idx
  on conversations(profile_a_id, last_message_at desc nulls last);
create index if not exists conversations_profile_b_idx
  on conversations(profile_b_id, last_message_at desc nulls last);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_profile_id uuid not null references profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on messages(conversation_id, created_at desc);

alter table conversations enable row level security;
alter table messages enable row level security;

commit;
