create table if not exists public.site_settings (
  id text primary key,
  settings jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

create table if not exists public.invites (
  token text primary key,
  invite jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.invites enable row level security;

insert into storage.buckets (id, name, public)
values ('invitation-images', 'invitation-images', true)
on conflict (id) do nothing;
