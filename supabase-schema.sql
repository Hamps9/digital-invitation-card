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

create table if not exists public.rsvps (
  id text primary key,
  name text not null,
  phone text,
  attending text not null,
  attending_text text not null,
  guests integer not null default 1,
  notes text,
  invite_token text,
  submitted_at timestamptz not null default now()
);

alter table public.rsvps enable row level security;

insert into storage.buckets (id, name, public)
values ('invitation-images', 'invitation-images', true)
on conflict (id) do nothing;

update public.site_settings
set settings = settings
  || jsonb_build_object(
    'calendarDetails', 'Save the date for Amara and Josiah''s wedding on April 18, 2027. Ceremony: 11:00 AM at 1 John Akapelwa Rd. Reception: 2:00 PM at 1 John Akapelwa Rd.',
    'calendarLocation', '1 John Akapelwa Rd, Lusaka, 10101, Lusaka, Zambia',
    'ceremonyVenue', '1 John Akapelwa Rd',
    'ceremonyLocation', '1 John Akapelwa Rd, Lusaka, 10101, Lusaka, Zambia',
    'ceremonyDirectionsUrl', 'https://www.google.com/maps/dir/?api=1&destination=1%20John%20Akapelwa%20Rd%2C%20Lusaka%2C%2010101%2C%20Lusaka%2C%20Zambia',
    'receptionVenue', '1 John Akapelwa Rd',
    'receptionLocation', '1 John Akapelwa Rd, Lusaka, 10101, Lusaka, Zambia',
    'receptionDirectionsUrl', 'https://www.google.com/maps/dir/?api=1&destination=1%20John%20Akapelwa%20Rd%2C%20Lusaka%2C%2010101%2C%20Lusaka%2C%20Zambia'
  ),
  updated_at = now()
where id = 'default';
