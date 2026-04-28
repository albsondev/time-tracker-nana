create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null,
  type text not null check (
    type in (
      'arrival',
      'lunch_start',
      'lunch_end',
      'break_start',
      'break_end',
      'departure'
    )
  ),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.break_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  category text not null check (
    category in ('lunch', 'medical', 'sick', 'travel', 'personal', 'other')
  ),
  starts_at timestamptz not null,
  ends_at timestamptz,
  deducts_from_work boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  constraint break_ends_after_start check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.hour_bank_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movement_date date not null,
  source text not null check (
    source in ('weekly_balance', 'manual_adjustment', 'compensation')
  ),
  minutes_delta integer not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists time_entries_user_occurred_at_idx
  on public.time_entries(user_id, occurred_at);

create index if not exists break_entries_user_work_date_idx
  on public.break_entries(user_id, work_date);

create index if not exists hour_bank_movements_user_date_idx
  on public.hour_bank_movements(user_id, movement_date);

alter table public.profiles enable row level security;
alter table public.time_entries enable row level security;
alter table public.break_entries enable row level security;
alter table public.hour_bank_movements enable row level security;

create policy "profiles are owned by the user"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "time entries are owned by the user"
  on public.time_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "break entries are owned by the user"
  on public.break_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "hour bank movements are owned by the user"
  on public.hour_bank_movements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
