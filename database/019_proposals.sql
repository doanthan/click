-- Proposal UI — the post-mutual-click coordination object (no chat).
--
-- Business plan §1.3 / §7.2: "When mutual click fires: both users see a shared
-- event suggestion; either can confirm in one tap; 'suggest alternative' opens
-- the Click catalogue (no free text); 7-day expiry."
--
-- One proposal per mutual click. It holds the currently-suggested event, who
-- last proposed it, how many alternatives have been floated (capped at 3), and
-- the 7-day window. Either participant can confirm; confirming locks the plan.

begin;

create type proposal_status as enum ('pending', 'confirmed', 'expired');

create table if not exists event_proposals (
  id uuid primary key default gen_random_uuid(),
  mutual_click_id uuid not null unique references mutual_clicks(id) on delete cascade,
  suggested_event_id uuid references events(id) on delete set null,
  status proposal_status not null default 'pending',
  proposed_by uuid references profiles(id) on delete set null,
  alternatives_count integer not null default 0,
  confirmed_by uuid references profiles(id) on delete set null,
  confirmed_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_proposals_status_idx
  on event_proposals (status, expires_at);

alter table event_proposals enable row level security;

commit;
