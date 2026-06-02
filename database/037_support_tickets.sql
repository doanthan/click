-- 037_support_tickets.sql
--
-- In-app "Report a Bug" feature. The SupportWidget (floating button + off-canvas
-- panel, mounted in the root layout) auto-captures a screenshot + recent console
-- logs + failed network requests for the current page, lets the reporter describe
-- and annotate the bug, and POSTs it to /api/support/ticket.
--
-- This table is the source of truth. Each new bug is ALSO mirrored to a Google
-- Sheet (red row = open, green row = fixed) by src/lib/support-sheets.ts; we keep
-- the appended sheet row number here so "mark fixed" can recolour the right row.
--
-- The per-page checklist (GET /api/support/ticket?url=...) reads the open rows
-- for the current pathname so testers can tick bugs off as they're fixed.

create table if not exists support_tickets (
  id               uuid primary key default gen_random_uuid(),
  ticket_ref       text not null unique,                 -- human ref: TICKET-<ts>-<rand>
  type             text not null default 'bug',
  status           text not null default 'open'
                     check (status in ('open', 'fixed')),
  priority         text not null default 'high',
  subject          text not null,
  message          text not null,
  url              text,                                  -- page pathname+search the bug was filed on
  screenshot_url   text,                                  -- public Supabase Storage URL (may be null)
  console_logs     jsonb not null default '[]'::jsonb,
  network_errors   jsonb not null default '[]'::jsonb,
  annotations      jsonb not null default '[]'::jsonb,    -- highlighted regions [{x,y,w,h,label}]
  client_metadata  jsonb not null default '{}'::jsonb,    -- {browser, os, screen_resolution, viewport_size, user_agent}
  reporter_profile_id uuid references profiles(id) on delete set null,
  reporter_email   text,
  reporter_name    text,
  ip_address       text,
  sheet_row        integer,                               -- 1-based row index in the synced Google Sheet
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  fixed_at         timestamptz,
  fixed_by_profile_id uuid references profiles(id) on delete set null
);

-- Powers the "open bugs on this page" checklist: filter by url + status, newest first.
create index if not exists support_tickets_url_status_idx
  on support_tickets (url, status, created_at desc);

create index if not exists support_tickets_status_idx
  on support_tickets (status, created_at desc);
