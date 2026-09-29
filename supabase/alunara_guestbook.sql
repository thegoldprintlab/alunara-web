-- =============================================================================
-- ALUNARA BUKU TAMU — tetamu upload gambar majlis, guna filter film stock
-- =============================================================================
-- Idempotent: selamat dijalankan berulang.
--
-- KONSEP
--   Bos buka satu "majlis" di /admin, dapat kod + QR. Tetamu scan QR, upload
--   gambar dari browser (tak payah install app), pilih filter film stock,
--   simpan. Semua masuk satu galeri untuk bos.
--
--   Tiada video. Sengaja — lihat Dokumentasi/Sedetik/02 untuk sebabnya
--   (transcode 1080p = 10.5x realtime pada 1 vCPU, perlu queue + container).
--
-- KESELAMATAN — jangan ringankan
--   * Tetamu TIDAK log masuk. Jadi jangan sekali-kali bagi anon akses terus
--     ke jadual. Semua tulis-masuk melalui RPC security definer yang:
--       - semak kod majlis sah & belum tamat
--       - hadkan bilangan upload ikut sesi (bukan ikut IP — tetamu kongsi wifi)
--       - hadkan jenis & saiz fail
--   * Storage bucket ditetapkan private. Tetamu baca balik melalui signed URL.
--   * Bos sahaja (is_admin()) boleh baca senarai penuh + padam gambar.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. MAJLIS — satu baris = satu event yang ada buku tamu
-- ---------------------------------------------------------------------------
create table if not exists public.alunara_guestbook_events (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,          -- kod 6 aksara untuk link/QR
  title        text not null,                 -- cth. "Majlis Aina & Haikal"
  host_name    text,                          -- nama pengantin/tuan rumah
  event_date   date,
  booking_id   uuid references public.alunara_bookings (id) on delete set null,
  active       boolean not null default true,
  -- Bila tetamu boleh upload. Lepas ni, galeri jadi baca-sahaja.
  upload_until timestamptz not null default (now() + interval '90 days'),
  -- Filter film stock yang dibenarkan untuk majlis ni (null = semua).
  -- Kalau bos nak tema tertentu (cth. perkahwinan rustic = Portra sahaja).
  allowed_stocks text[],
  -- SILING KESELAMATAN, bukan had produk. Tiada pakej yang mengurangkan
  -- bilangan gambar — had ini hanya untuk menghalang satu sesi daripada
  -- membanjiri bucket. 100 cukup tinggi sehingga tetamu biasa takkan
  -- menyentuhnya; jangan turunkan untuk "menjual tier".
  max_uploads_per_guest integer not null default 100,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Kod mesti mudah dibaca & ditaip (QR rosak / tetamu taip manual).
-- Buang aksara mudah keliru: 0/O, 1/I/L.
alter table public.alunara_guestbook_events
  drop constraint if exists alunara_guestbook_code_sah;
alter table public.alunara_guestbook_events
  add constraint alunara_guestbook_code_sah
  check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$');

-- Naikkan siling keselamatan. `create table if not exists` TIDAK mengubah
-- jadual sedia ada, jadi baris lama masih simpan 20 dan perlu dikemas.
alter table public.alunara_guestbook_events
  alter column max_uploads_per_guest set default 100;
update public.alunara_guestbook_events
   set max_uploads_per_guest = 100
 where max_uploads_per_guest < 100;

create index if not exists alunara_guestbook_events_code_idx
  on public.alunara_guestbook_events (code) where active;

-- ---------------------------------------------------------------------------
-- 2. SESI TETAMU — satu baris = satu tetamu (nama + had upload)
--    Kita tak minta tetamu log masuk. Nama + sesi cukup untuk had & atribusi.
-- ---------------------------------------------------------------------------
create table if not exists public.alunara_guestbook_guests (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.alunara_guestbook_events (id) on delete cascade,
  session    uuid not null default gen_random_uuid(),  -- token sesi dalam localStorage
  name       text not null,
  wish       text,                                      -- ucapan/doa bertulis
  created_at timestamptz not null default now()
);

create unique index if not exists alunara_guestbook_guests_session_idx
  on public.alunara_guestbook_guests (session);
create index if not exists alunara_guestbook_guests_event_idx
  on public.alunara_guestbook_guests (event_id, created_at desc);
-- Nama sama boleh datang dua kali (dua orang nama "Ahmad") — jangan unique pada nama.

-- ---------------------------------------------------------------------------
-- 3. GAMBAR — satu baris = satu upload
-- ---------------------------------------------------------------------------
create table if not exists public.alunara_guestbook_photos (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.alunara_guestbook_events (id) on delete cascade,
  guest_id      uuid references public.alunara_guestbook_guests (id) on delete set null,
  storage_path  text not null,        -- laluan dalam bucket, BUKAN url awam
  width         integer,
  height        integer,
  bytes         integer,
  stock         text not null default 'none',   -- film stock yang dipilih
  stock_strength numeric(3,2) not null default 1.00,  -- 0..1 keamatan
  -- Moderation: gambar boleh disembunyikan tanpa dipadam (kekalkan bukti).
  hidden        boolean not null default false,
  hidden_reason text,
  created_at    timestamptz not null default now()
);

create index if not exists alunara_guestbook_photos_event_idx
  on public.alunara_guestbook_photos (event_id, created_at desc)
  where not hidden;
create index if not exists alunara_guestbook_photos_guest_idx
  on public.alunara_guestbook_photos (guest_id);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.alunara_guestbook_events enable row level security;
alter table public.alunara_guestbook_guests enable row level security;
alter table public.alunara_guestbook_photos enable row level security;

drop policy if exists alunara_guestbook_events_admin  on public.alunara_guestbook_events;
drop policy if exists alunara_guestbook_guests_admin  on public.alunara_guestbook_guests;
drop policy if exists alunara_guestbook_photos_admin  on public.alunara_guestbook_photos;

create policy alunara_guestbook_events_admin on public.alunara_guestbook_events
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy alunara_guestbook_guests_admin on public.alunara_guestbook_guests
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy alunara_guestbook_photos_admin on public.alunara_guestbook_photos
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- anon TIADA policy langsung pada ketiga-tiga jadual.
revoke all on public.alunara_guestbook_events from anon;
revoke all on public.alunara_guestbook_guests from anon;
revoke all on public.alunara_guestbook_photos from anon;

grant select, insert, update, delete on public.alunara_guestbook_events to authenticated;
grant select, insert, update, delete on public.alunara_guestbook_guests to authenticated;
grant select, insert, update, delete on public.alunara_guestbook_photos to authenticated;

-- ---------------------------------------------------------------------------
-- 5. RPC AWAM — info majlis ikut kod (untuk halaman tetamu)
-- ---------------------------------------------------------------------------
create or replace function public.alunara_guestbook_info(p_code text)
returns table (
  event_title   text,
  host_name     text,
  event_date    date,
  boleh_upload  boolean,
  jumlah_gambar integer,
  stocks        text[]
)
language sql
security definer
stable
set search_path = public
as $$
  select
    e.title,
    e.host_name,
    e.event_date,
    (e.active and now() < e.upload_until),
    (select count(*)::integer from public.alunara_guestbook_photos p
      where p.event_id = e.id and not p.hidden),
    e.allowed_stocks
  from public.alunara_guestbook_events e
  where e.code = upper(trim(p_code)) and e.active;
$$;

revoke all on function public.alunara_guestbook_info(text) from public;
grant execute on function public.alunara_guestbook_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC AWAM — senarai gambar untuk galeri
--    Sengaja TAK pulangkan nama tetamu penuh (privasi) — hanya awalan.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_guestbook_gallery(
  p_code  text,
  p_limit integer default 200
)
returns table (
  id            uuid,
  storage_path  text,
  stock         text,
  nama_awal     text,
  wish          text,
  created_at    timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.storage_path,
    p.stock,
    split_part(coalesce(g.name, 'Tetamu'), ' ', 1),   -- awalan nama sahaja
    g.wish,
    p.created_at
  from public.alunara_guestbook_photos p
  join public.alunara_guestbook_events e on e.id = p.event_id
  left join public.alunara_guestbook_guests g on g.id = p.guest_id
  where e.code = upper(trim(p_code))
    and e.active
    and not p.hidden
  order by p.created_at desc
  limit least(coalesce(p_limit, 200), 500);
$$;

revoke all on function public.alunara_guestbook_gallery(text, integer) from public;
grant execute on function public.alunara_guestbook_gallery(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC AWAM — daftar tetamu (nama + ucapan), pulangkan token sesi
-- ---------------------------------------------------------------------------
create or replace function public.alunara_guestbook_join(
  p_code text,
  p_name text,
  p_wish text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event   uuid;
  v_boleh   boolean;
  v_session uuid;
  v_kali    integer;
begin
  if coalesce(trim(p_name), '') = '' or length(trim(p_name)) < 2 then
    raise exception 'Nama tak sah';
  end if;
  if length(coalesce(p_name, '')) > 60 then
    raise exception 'Nama terlalu panjang';
  end if;
  if length(coalesce(p_wish, '')) > 500 then
    raise exception 'Ucapan terlalu panjang (maksimum 500 aksara)';
  end if;

  select id, (active and now() < upload_until)
    into v_event, v_boleh
  from public.alunara_guestbook_events
  where code = upper(trim(p_code)) and active;

  if v_event is null then
    raise exception 'Kod majlis tak sah';
  end if;
  if not v_boleh then
    raise exception 'Tempoh muat naik dah tamat';
  end if;

  -- Had ringkas: elak satu orang daftar 100 kali untuk lepas had upload.
  select count(*) into v_kali
  from public.alunara_guestbook_guests
  where event_id = v_event and created_at > now() - interval '1 hour';
  if v_kali >= 200 then
    raise exception 'Majlis ini dah capai had pendaftaran sejam. Cuba sebentar lagi.';
  end if;

  insert into public.alunara_guestbook_guests (event_id, name, wish)
  values (v_event, trim(p_name), nullif(trim(coalesce(p_wish, '')), ''))
  returning session into v_session;

  return v_session;
end;
$$;

revoke all on function public.alunara_guestbook_join(text, text, text) from public;
grant execute on function public.alunara_guestbook_join(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. RPC AWAM — sahkan slot upload sebelum dapatkan signed URL
--    Dipanggil SEBELUM upload. Kalau ia tolak, frontend tak dapat URL.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_guestbook_acquire_slot(
  p_session uuid
) returns table (event_id uuid, guest_id uuid, slot integer, had integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event uuid;
  v_guest uuid;
  v_had   integer;
  v_kali  integer;
begin
  select g.id, g.event_id, e.max_uploads_per_guest
    into v_guest, v_event, v_had
  from public.alunara_guestbook_guests g
  join public.alunara_guestbook_events e on e.id = g.event_id
  where g.session = p_session and e.active and now() < e.upload_until;

  if v_guest is null then
    raise exception 'Sesi tak sah atau tempoh muat naik dah tamat';
  end if;

  -- Kira upload sebenar, bukan bilangan slot. Padam gambar = dapat balik slot
  -- (adil untuk tetamu), tapi memori slot belum dikira — jadi hadkan
  -- acquire kepada 3x had supaya seseorang tak boleh tempah 1000 slot kosong.
  -- WAJIB alias: `guest_id` juga nama OUT parameter fungsi ini, jadi tanpa
  -- awalan jadual Postgres tak tahu mana satu dimaksudkan (42702).
  select count(*) into v_kali
  from public.alunara_guestbook_photos p
  where p.guest_id = v_guest;

  if v_kali >= v_had * 3 then
    raise exception 'Terlalu banyak cubaan muat naik';
  end if;
  if v_kali >= v_had then
    raise exception 'Dah capai had % gambar untuk sesi ini', v_had;
  end if;

  return query select v_event, v_guest, v_kali + 1, v_had;
end;
$$;

revoke all on function public.alunara_guestbook_acquire_slot(uuid) from public;
grant execute on function public.alunara_guestbook_acquire_slot(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. RPC AWAM — daftar gambar yang dah siap upload
--    Dipanggil SELEPAS upload ke Storage berjaya.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_guestbook_add_photo(
  p_session      uuid,
  p_storage_path text,
  p_width        integer default null,
  p_height       integer default null,
  p_bytes        integer default null,
  p_stock        text    default 'none',
  p_strength     numeric default 1.00
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest  uuid;
  v_event  uuid;
  v_had    integer;
  v_kali   integer;
  v_stocks text[];
  v_id     uuid;
begin
  select g.id, g.event_id, e.max_uploads_per_guest, e.allowed_stocks
    into v_guest, v_event, v_had, v_stocks
  from public.alunara_guestbook_guests g
  join public.alunara_guestbook_events e on e.id = g.event_id
  where g.session = p_session and e.active and now() < e.upload_until;

  if v_guest is null then
    raise exception 'Sesi tak sah atau tempoh muat naik dah tamat';
  end if;

  select count(*) into v_kali
  from public.alunara_guestbook_photos where guest_id = v_guest;
  if v_kali >= v_had then
    raise exception 'Dah capai had % gambar untuk sesi ini', v_had;
  end if;

  -- Filter mesti dalam senarai yang bos benarkan untuk majlis ini.
  if v_stocks is not null and not (coalesce(p_stock,'none') = any (v_stocks)) then
    raise exception 'Filter % tak dibenarkan untuk majlis ini', p_stock;
  end if;

  -- Laluan mesti dalam folder majlis itu. Halang tetamu tulis ke majlis lain.
  if p_storage_path not like (v_event::text || '/%') then
    raise exception 'Laluan fail tak sah';
  end if;

  insert into public.alunara_guestbook_photos
    (event_id, guest_id, storage_path, width, height, bytes, stock, stock_strength)
  values
    (v_event, v_guest, p_storage_path, p_width, p_height, p_bytes,
     coalesce(p_stock, 'none'), least(greatest(coalesce(p_strength, 1.00), 0), 1))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.alunara_guestbook_add_photo(uuid, text, integer, integer, integer, text, numeric) from public;
grant execute on function public.alunara_guestbook_add_photo(uuid, text, integer, integer, integer, text, numeric) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. Fungsi admin — jana kod majlis yang tak berlanggar
-- ---------------------------------------------------------------------------
create or replace function public.alunara_guestbook_new_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  aksara text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  kod    text;
  cuba   integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;

  loop
    cuba := cuba + 1;
    kod := '';
    for i in 1..6 loop
      kod := kod || substr(aksara, 1 + floor(random() * length(aksara))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.alunara_guestbook_events where code = kod
    );
    if cuba > 50 then
      raise exception 'Gagal jana kod unik';
    end if;
  end loop;

  return kod;
end;
$$;

revoke all on function public.alunara_guestbook_new_code() from public;
grant execute on function public.alunara_guestbook_new_code() to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Storage bucket — privat, bukan awam
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'alunara-guestbook',
  'alunara-guestbook',
  false,                                        -- PRIVAT. signed URL sahaja.
  15728640,                                     -- 15 MB setiap gambar
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Tiada policy storage untuk anon: upload & baca melalui Edge Function /
-- signed URL yang dijana server-side dengan service role. Ini menghalang
-- tetamu daripada meneroka bucket orang lain walaupun tahu laluannya.

-- ---------------------------------------------------------------------------
-- 12. updated_at automatik
-- ---------------------------------------------------------------------------
drop trigger if exists alunara_guestbook_events_touch on public.alunara_guestbook_events;
create trigger alunara_guestbook_events_touch
  before update on public.alunara_guestbook_events
  for each row execute function public.alunara_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 13. Pembersihan — auto-hide selepas majlis tamat + N bulan
--     Dijalankan manual atau via cron. Jangan padam terus: bos mungkin
--     nak simpan kenangan. Auto-hide cukup untuk kurangkan beban.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_guestbook_auto_hide(p_bulan integer default 12)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kira integer;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin';
  end if;

  with sasaran as (
    select p.id
    from public.alunara_guestbook_photos p
    join public.alunara_guestbook_events e on e.id = p.event_id
    where now() > e.upload_until + (p_bulan || ' months')::interval
      and not p.hidden
  )
  update public.alunara_guestbook_photos p
     set hidden = true,
         hidden_reason = 'auto: majlis tamat lebih ' || p_bulan || ' bulan'
  from sasaran s
  where p.id = s.id;

  get diagnostics v_kira = row_count;
  return v_kira;
end;
$$;

revoke all on function public.alunara_guestbook_auto_hide(integer) from public;
grant execute on function public.alunara_guestbook_auto_hide(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 14. Semakan pantas (jalankan manual untuk sahkan)
-- ---------------------------------------------------------------------------
-- select code, title, active, upload_until from public.alunara_guestbook_events;
-- select count(*) from public.alunara_guestbook_photos where not hidden;
