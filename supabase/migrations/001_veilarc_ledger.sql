-- Veilarc durable API ledger for Supabase/Postgres.
-- Run this in the Supabase SQL editor before setting VEIL_LEDGER_BACKEND=supabase.

create table if not exists public.veil_payments (
  id text primary key,
  external_id text unique,
  created_at timestamptz not null,
  wallet_scope text[] not null default '{}',
  payload jsonb not null
);

create table if not exists public.veil_confidential_records (
  id text primary key,
  payment_id text not null,
  created_at timestamptz not null,
  wallet_scope text[] not null default '{}',
  payload jsonb not null
);

create table if not exists public.veil_disclosure_access (
  id text primary key,
  record_id text not null,
  granted_at timestamptz not null,
  wallet_scope text[] not null default '{}',
  payload jsonb not null
);

create table if not exists public.veil_audit_events (
  id text primary key,
  timestamp timestamptz not null,
  wallet_scope text[] not null default '{}',
  payload jsonb not null
);

create index if not exists veil_payments_wallet_scope_idx
  on public.veil_payments using gin (wallet_scope);

create index if not exists veil_payments_created_at_idx
  on public.veil_payments (created_at desc);

create index if not exists veil_payments_tx_hash_idx
  on public.veil_payments ((payload ->> 'txHash'));

create index if not exists veil_payments_payment_id_idx
  on public.veil_payments ((payload ->> 'paymentId'));

create index if not exists veil_payments_batch_id_idx
  on public.veil_payments ((payload ->> 'batchId'));

create index if not exists veil_confidential_records_wallet_scope_idx
  on public.veil_confidential_records using gin (wallet_scope);

create index if not exists veil_disclosure_access_wallet_scope_idx
  on public.veil_disclosure_access using gin (wallet_scope);

create index if not exists veil_audit_events_wallet_scope_idx
  on public.veil_audit_events using gin (wallet_scope);

alter table public.veil_payments enable row level security;
alter table public.veil_confidential_records enable row level security;
alter table public.veil_disclosure_access enable row level security;
alter table public.veil_audit_events enable row level security;

-- No public RLS policies are added intentionally.
-- The Vercel/API server must use SUPABASE_SERVICE_ROLE_KEY server-side only.
