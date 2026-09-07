-- ALUNARA schema (namespaced, lives alongside gold-plan in same Supabase project)
-- Idempotent: safe to re-run.

create table if not exists public.alunara_bookings (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  customer_name text not null,
  customer_phone text not null,
  event_type text not null,          -- birthday / wedding / engagement / other
  package_tier text not null,        -- basic / premium / luxury
  location text not null default 'Melaka',
  notes text,
  status text not null default 'pending',  -- pending | confirmed | cancelled
  created_at timestamptz not null default now()
);

-- 1 date = 1 booking (tagline "1 Tarikh, 1 Majlis")
create unique index if not exists alunara_bookings_date_unique
  on public.alunara_bookings (event_date)
  where status in ('pending', 'confirmed');

create index if not exists alunara_bookings_created_idx
  on public.alunara_bookings (created_at desc);

alter table public.alunara_bookings enable row level security;

drop policy if exists "alunara bookings anon insert" on public.alunara_bookings;
create policy "alunara bookings anon insert"
  on public.alunara_bookings for insert
  to anon, authenticated
  with check (true);

drop policy if exists "alunara bookings anon select booked dates" on public.alunara_bookings;
create policy "alunara bookings anon select booked dates"
  on public.alunara_bookings for select
  to anon, authenticated
  using (true);

-- RPC: mark booking confirmed (manual, after QR payment received). Admin only in practice;
-- left callable by authenticated for now, gated by secret in the app layer.
create or replace function public.alunara_confirm_booking(p_id uuid)
returns void language sql security definer as $$
  update public.alunara_bookings set status = 'confirmed' where id = p_id;
$$;

create or replace function public.alunara_cancel_booking(p_id uuid)
returns void language sql security definer as $$
  update public.alunara_bookings set status = 'cancelled' where id = p_id;
$$;

grant execute on function public.alunara_confirm_booking(uuid) to authenticated;
grant execute on function public.alunara_cancel_booking(uuid) to authenticated;

-- Gallery items (photo/video). Admin-managed; anon can read.
create table if not exists public.alunara_gallery (
  id uuid primary key default gen_random_uuid(),
  media_type text not null default 'photo',  -- photo | video
  url text not null,
  caption text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.alunara_gallery enable row level security;

drop policy if exists "alunara gallery anon select" on public.alunara_gallery;
create policy "alunara gallery anon select"
  on public.alunara_gallery for select
  to anon, authenticated
  using (active = true);

-- Settings (single-row key/value: QR images, phone, socials)
create table if not exists public.alunara_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.alunara_settings enable row level security;

drop policy if exists "alunara settings anon select" on public.alunara_settings;
create policy "alunara settings anon select"
  on public.alunara_settings for select
  to anon, authenticated
  using (true);
