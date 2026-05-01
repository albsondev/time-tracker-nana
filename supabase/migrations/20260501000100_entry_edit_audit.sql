alter table public.time_entries
  add column if not exists is_modified boolean not null default false,
  add column if not exists modified_at timestamptz;

alter table public.break_entries
  add column if not exists is_modified boolean not null default false,
  add column if not exists modified_at timestamptz;
