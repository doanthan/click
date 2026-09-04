-- Merchant full signup wizard (spec context/02_MERCHANT_JOURNEY.md §1).
--
-- Extends merchant_profiles with the columns the 4-step wizard collects,
-- adds a join table for event categories (re-uses existing tag_categories),
-- and a merchant_documents table for ABN cert / insurance / liquor licence
-- uploads. Documents themselves live in the private Supabase Storage bucket
-- "merchant-documents"; this table just stores the metadata + path.
--
-- Idempotent - safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- 1. merchant_profiles: extra columns
-- ---------------------------------------------------------------------------
alter table merchant_profiles
  add column if not exists trading_name text,
  add column if not exists acn text,
  add column if not exists business_type text
    check (business_type in ('sole_trader', 'company', 'partnership', 'trust')),
  add column if not exists phone text,
  add column if not exists address_street text,
  add column if not exists address_suburb text,
  add column if not exists address_state text
    check (address_state in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')),
  add column if not exists address_postcode text
    check (address_postcode ~ '^[0-9]{4}$'),
  add column if not exists submitted_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. merchant_event_categories: which kinds of events this merchant hosts.
--    Spec calls this "Event category focus"; we re-use the existing
--    tag_categories lookup so admins can manage the list in one place.
-- ---------------------------------------------------------------------------
create table if not exists merchant_event_categories (
  merchant_profile_id uuid not null references merchant_profiles(id) on delete cascade,
  tag_category_id uuid not null references tag_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (merchant_profile_id, tag_category_id)
);

create index if not exists merchant_event_categories_category_idx
  on merchant_event_categories(tag_category_id);

alter table merchant_event_categories enable row level security;

-- ---------------------------------------------------------------------------
-- 3. merchant_documents: uploaded compliance documents.
--    file_path is the object key inside the private "merchant-documents"
--    storage bucket; signed URLs are issued at read time.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'merchant_document_type') then
    create type merchant_document_type as enum (
      'abn_certificate',
      'public_liability_insurance',
      'liquor_licence'
    );
  end if;
end$$;

create table if not exists merchant_documents (
  id uuid primary key default gen_random_uuid(),
  merchant_profile_id uuid references merchant_profiles(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  document_type merchant_document_type not null,
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  uploaded_at timestamptz not null default now(),
  -- Documents are uploaded BEFORE the merchant_profile row exists (during
  -- Step 3 of the wizard, before Step 4 commit), so we key off profile_id
  -- and back-fill merchant_profile_id once the profile row lands.
  unique (profile_id, document_type)
);

create index if not exists merchant_documents_profile_idx
  on merchant_documents(merchant_profile_id);

alter table merchant_documents enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Storage bucket - private, signed-URL only.
--    Safe to skip if storage extension isn't available in this DB (the API
--    route will surface a 503 with a clear "Storage not configured" message).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    insert into storage.buckets (id, name, public)
    values ('merchant-documents', 'merchant-documents', false)
    on conflict (id) do nothing;
  end if;
end$$;

commit;
