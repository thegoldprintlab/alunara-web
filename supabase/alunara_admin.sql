-- =============================================================================
-- ALUNARA ADMIN — skema untuk /admin (log klien + tarikh tempahan)
-- =============================================================================
-- Idempotent: selamat dijalankan berulang.
--
-- KONTEKS PENTING
--   Laman alunara.my sebelum ni 100% statik; senarai tarikh yang dah di-lock
--   duduk dalam src/content.ts (TARIKH_LOCK) — bos kena edit kod & deploy
--   setiap kali ada tempahan baru. Itu sebabnya admin panel ini dibina.
--
--   DB yang dipakai ialah project Supabase SAMA dengan The Gold Plan
--   (profiles + is_admin() sudah wujud di situ dan arfasyrf@gmail.com
--   sudah berperanan 'admin'). Jadi kita guna semula auth yang ada.
--
-- KESELAMATAN — jangan ringankan
--   * Sebelum ni `alunara_bookings` ada policy `using (true)` untuk anon:
--     sesiapa boleh baca SELURUH nama + no. telefon pelanggan, dan boleh
--     INSERT baris palsu tanpa had. Baik juga `alunara_confirm_booking(id)`
--     boleh dipanggil sesiapa sahaja tanpa log masuk.
--   * Semua policy longgar itu DIBUANG di sini dan diganti dengan is_admin().
--   * Kalendar awam /tempah masih perlukan TARIKH saja (bukan nama pelanggan),
--     jadi ia dapat RPC khas `alunara_public_booked_dates()`.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Jadual KLIEN — buku klien yang boleh diguna semula (repeat customer)
-- ---------------------------------------------------------------------------
create table if not exists public.alunara_clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  source      text default 'WhatsApp',   -- WhatsApp | Instagram | Web | Referral | Walk-in
  area        text,                      -- kawasan majlis biasa (cth. Ayer Keroh)
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists alunara_clients_phone_idx on public.alunara_clients (phone);
create index if not exists alunara_clients_name_idx  on public.alunara_clients (lower(name));

-- ---------------------------------------------------------------------------
-- 2. Jadual TEMPAHAN — kolum tambahan pada jadual sedia ada
--    (id, event_date, customer_name, customer_phone, event_type, package_tier,
--     location, notes, status, created_at sudah wujud — jangan buang)
-- ---------------------------------------------------------------------------
alter table public.alunara_bookings add column if not exists client_id      uuid references public.alunara_clients (id) on delete set null;
alter table public.alunara_bookings add column if not exists package_id     text;                        -- sari | bayu | anggun | custom
alter table public.alunara_bookings add column if not exists addon          boolean not null default false;
alter table public.alunara_bookings add column if not exists theme          text;                        -- Floral | Minimalist | Rustic
alter table public.alunara_bookings add column if not exists venue          text;                        -- nama dewan / alamat penuh
alter table public.alunara_bookings add column if not exists setup_time     text;                        -- cth. 'Semalam (petang)' — tanpa petikan untuk elak isu jenis
alter table public.alunara_bookings add column if not exists total_amount   numeric(10,2) not null default 0;
alter table public.alunara_bookings add column if not exists deposit_amount numeric(10,2) not null default 0;
alter table public.alunara_bookings add column if not exists paid_amount    numeric(10,2) not null default 0;
alter table public.alunara_bookings add column if not exists balance_paid   boolean not null default false;
alter table public.alunara_bookings add column if not exists updated_at     timestamptz not null default now();

-- Status yang disokong: enquiry | pending | confirmed | completed | cancelled
comment on column public.alunara_bookings.status is
  'enquiry (tanya saja) | pending (dah setuju, deposit belum) | confirmed (deposit masuk) | completed (majlis selesai) | cancelled';

-- Satu tarikh = satu majlis (konsep "1 Tarikh, 1 Majlis").
-- Hanya satu baris boleh pegang sesuatu tarikh melainkan yang cancelled.
create unique index if not exists alunara_bookings_tarikh_unik
  on public.alunara_bookings (event_date)
  where (status <> 'cancelled');

create index if not exists alunara_bookings_status_idx on public.alunara_bookings (status, event_date);

-- ---------------------------------------------------------------------------
-- 3. Jadual LEADS — pertanyaan dari borang laman web
--    (checklist percuma + katalog PDF + borang /tempah)
--    Sebelum ni lead cuma masuk Telegram dan localStorage browser pelawat —
--    kalau bos terlepas mesej Telegram, lead hilang terus.
-- ---------------------------------------------------------------------------
create table if not exists public.alunara_leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  event_date    date,
  event_type    text,
  interest      text,                    -- pakej / checklist yang diminta
  source        text,                    -- checklist | katalog | tempah | manual
  source_page   text,
  notes         text,
  status        text not null default 'baru',  -- baru | dihubungi | tempah | mati
  client_id     uuid references public.alunara_clients (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists alunara_leads_status_idx on public.alunara_leads (status, created_at desc);
create index if not exists alunara_leads_phone_idx  on public.alunara_leads (phone);

-- ---------------------------------------------------------------------------
-- 4. Set semula RLS booking: buang policy longgar lama, ganti guna is_admin()
-- ---------------------------------------------------------------------------
alter table public.alunara_clients  enable row level security;
alter table public.alunara_leads    enable row level security;
alter table public.alunara_bookings enable row level security;

drop policy if exists "alunara bookings anon select booked dates" on public.alunara_bookings;
drop policy if exists "alunara bookings anon insert"              on public.alunara_bookings;
drop policy if exists alunara_bookings_admin_all                  on public.alunara_bookings;

create policy alunara_bookings_admin_all on public.alunara_bookings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists alunara_clients_admin_all on public.alunara_clients;
create policy alunara_clients_admin_all on public.alunara_clients
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists alunara_leads_admin_all on public.alunara_leads;
create policy alunara_leads_admin_all on public.alunara_leads
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Gallery & settings kekal boleh dibaca awam (kandungan laman, bukan data pelanggan).
drop policy if exists "alunara gallery anon select" on public.alunara_gallery;
create policy "alunara gallery anon select" on public.alunara_gallery
  for select to anon, authenticated using (active = true);

drop policy if exists "alunara settings anon select" on public.alunara_settings;
create policy "alunara settings anon select" on public.alunara_settings
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- 5. RPC awam: TARIKH sahaja untuk kalendar /tempah
--    Sengaja pulangkan tarikh tanpa nama/telefon supaya data pelanggan
--    tak pernah sampai ke pelayar orang awam.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_public_booked_dates()
returns setof date
language sql
security definer
stable
set search_path = public
as $$
  select event_date
  from public.alunara_bookings
  where status in ('pending', 'confirmed', 'completed')
    and event_date >= current_date
  order by event_date;
$$;

revoke all on function public.alunara_public_booked_dates() from public;
grant execute on function public.alunara_public_booked_dates() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC awam: hantar lead dari laman web
--    Laman awam tak boleh insert terus (RLS tolak). Ia panggil fungsi ni.
--    Ada had ringkas ikut no. telefon supaya borang tak boleh di-spam.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_public_lead(
  p_name        text,
  p_phone       text,
  p_event_date  date    default null,
  p_event_type  text    default null,
  p_interest    text    default null,
  p_source      text    default 'web',
  p_source_page text    default null,
  p_notes       text    default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_kali  integer;
begin
  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) < 2 then
    raise exception 'Nama tak sah';
  end if;

  -- Had: maksimum 5 lead dari nombor sama dalam 24 jam.
  select count(*) into v_kali
  from public.alunara_leads
  where phone = p_phone and created_at > now() - interval '24 hours';
  if v_kali >= 5 then
    raise exception 'Terlalu banyak cubaan';
  end if;

  insert into public.alunara_leads
    (name, phone, event_date, event_type, interest, source, source_page, notes)
  values
    (trim(p_name), p_phone, p_event_date, p_event_type, p_interest,
     coalesce(p_source, 'web'), p_source_page, p_notes)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.alunara_public_lead(text, text, date, text, text, text, text, text) from public;
grant execute on function public.alunara_public_lead(text, text, date, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Kebenaran jadual
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.alunara_clients  to authenticated;
grant select, insert, update, delete on public.alunara_leads    to authenticated;
grant select, insert, update, delete on public.alunara_bookings to authenticated;

-- anon tiada akses terus langsung ke tiga jadual ini (via RPC sahaja).
revoke all on public.alunara_clients  from anon;
revoke all on public.alunara_leads    from anon;
revoke all on public.alunara_bookings from anon;

-- ---------------------------------------------------------------------------
-- 7b. Fungsi warisan yang TAK BERGERBANG — buang
--     alunara_confirm_booking(uuid) / alunara_cancel_booking(uuid) diuji pada
--     2026-09-23: anon boleh panggil terus (HTTP 204) dan tukar status
--     tempahan sesiapa. Tiada UI yang guna lagi — RLS admin di atas dah cukup.
--     Jangan hidupkan semula tanpa tambah semakan is_admin() dalam badan fungsi.
-- ---------------------------------------------------------------------------
drop function if exists public.alunara_confirm_booking(uuid);
drop function if exists public.alunara_cancel_booking(uuid);

-- ---------------------------------------------------------------------------
-- 8. Kemas kini updated_at automatik
-- ---------------------------------------------------------------------------
create or replace function public.alunara_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists alunara_bookings_touch on public.alunara_bookings;
create trigger alunara_bookings_touch before update on public.alunara_bookings
  for each row execute function public.alunara_touch_updated_at();

drop trigger if exists alunara_clients_touch on public.alunara_clients;
create trigger alunara_clients_touch before update on public.alunara_clients
  for each row execute function public.alunara_touch_updated_at();

drop trigger if exists alunara_leads_touch on public.alunara_leads;
create trigger alunara_leads_touch before update on public.alunara_leads
  for each row execute function public.alunara_touch_updated_at();
