create table if not exists public.day_marks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  type text not null check (type in ('holiday')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date, type)
);

create index if not exists day_marks_user_work_date_idx
  on public.day_marks(user_id, work_date);

alter table public.day_marks enable row level security;

create policy "day marks are owned by the user"
  on public.day_marks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
