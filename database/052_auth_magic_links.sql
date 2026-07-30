create table if not exists auth_magic_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email text not null,
  redirect_to text not null default '/post-login',
  purpose text not null check (purpose in ('login', 'signup')),
  request_ip_hash text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_magic_links_email_created_idx
  on auth_magic_links (lower(email), created_at desc);

create index if not exists auth_magic_links_ip_created_idx
  on auth_magic_links (request_ip_hash, created_at desc)
  where request_ip_hash is not null;

create index if not exists auth_magic_links_expiry_idx
  on auth_magic_links (expires_at)
  where consumed_at is null;

comment on table auth_magic_links is
  'Single-use, short-lived email sign-in tokens. Only SHA-256 token hashes are stored.';
