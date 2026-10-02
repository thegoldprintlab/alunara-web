-- =============================================================================
-- ALUNARA BUKU TAMU v2 — gallery + media (photo/video/voice) + unlock code
-- =============================================================================
-- Idempotent: selamat dijalankan berulang.
--
-- PERUBAHAN DARI v1 (alunara_guestbook.sql)
--   * Konsep baru "GALLERY" — satu gallery boleh ada BANYAK event (sub-event).
--     Untuk wedding: nikah + resepsi lelaki + resepsi perempuan dalam satu
--     gallery, link sama, boleh filter.
--   * Media generic: foto + video + voice note (bukan foto sahaja).
--   * Self-serve: user create gallery sendiri guna UNLOCK CODE (1-guna).
--   * Customisation: welcome message, welcome label, tema, cover photo.
--   * Slug peribadi: alunara.my/buku-tamu/<slug> (bukan kod 6 aksara rawak).
--
-- MODEL DATA (ringkas)
--   galleries ──< events ──< media ──< (guest)
--   unlock_codes ──< galleries (kod 1-guna untuk cipta gallery)
--
-- KESELAMATAN — sama prinsip v1:
--   * Tetamu TIDAK log masuk. Semua tulis melalui RPC security definer.
--   * Storage privat; baca/upload melalui signed URL (server-side).
--   * Bos sahaja (is_admin()) boleh baca penuh + moderation.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. GALLERY — satu baris = satu buku tamu (boleh ada banyak event)
-- ---------------------------------------------------------------------------
create table if not exists public.alunara_guestbook_galleries (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,           -- link peribadi: /buku-tamu/<slug>
  nickname        text not null,                  -- tajuk pendek (cth. "Ali & Abu")
  title           text not null,                  -- tajuk penuh majlis
  event_type      text not null default 'wedding',-- nikah/resepsi/... (6 jenis)
  event_date      date,
  venue           text,
  welcome_label   text,                           -- label custom (default "Selamat Datang")
  welcome_message text,                           -- ucapan custom tuan rumah
  theme           text not null default 'default',
  cover_path      text,                           -- storage_path gambar cover
  owner_name      text,
  owner_phone     text,
  active          boolean not null default true,
  is_pro          boolean not null default false, -- pro = slideshow + ZIP + storage panjang
  upload_until    timestamptz not null default (now() + interval '90 days'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists alunara_gb_galleries_slug_idx
  on public.alunara_guestbook_galleries (slug) where active;

-- ---------------------------------------------------------------------------
-- 2. EVENT — sub-event dalam satu gallery (nikah / resepsi L / resepsi P)
--    events sedia ada diubah jadi child kepada gallery. Untuk galeri lama
--    (sebelum v2), setiap event lama dipromote jadi gallery sendiri.
-- ---------------------------------------------------------------------------
-- Tambah lajur pada events SEDIA ADA tanpa ganggu data lama.
alter table public.alunara_guestbook_events
  add column if not exists gallery_id uuid
    references public.alunara_guestbook_galleries (id) on delete cascade;

alter table public.alunara_guestbook_events
  add column if not exists event_type text not null default 'wedding';

alter table public.alunara_guestbook_events
  add column if not exists venue text;

alter table public.alunara_guestbook_events
  add column if not exists label text;             -- label sub-event (cth. "Resepsi Wanita")

-- Had VIDEO berasingan per tetamu.
--   `max_uploads_per_guest` ialah siling KESELAMATAN untuk SEMUA media
--   (foto + video + suara). Itu tidak cukup untuk video: satu klip boleh
--   sampai 50MB, jadi 100 video seorang tetamu = 5GB — separuh kuota
--   percuma Cloudflare R2 (10GB) dihabiskan oleh SATU orang, tanpa bos
--   dapat apa-apa. Siling video berasingan ini yang menahan kos.
--   Foto & suara takkan sentuh had ini.
alter table public.alunara_guestbook_events
  add column if not exists max_video_per_guest integer not null default 3;

-- Siling saiz SATU video (bait). Selari dengan VIDEO_MAX_MB dalam
-- src/pages/BukuTamu.tsx. Ini pertahanan sebenar: klien boleh hantar
-- p_bytes apa-apa, jadi semakan di UI sahaja tidak cukup.
alter table public.alunara_guestbook_events
  add column if not exists max_video_bytes bigint not null default 52428800; -- 50 MB

create index if not exists alunara_gb_events_gallery_idx
  on public.alunara_guestbook_events (gallery_id);

-- ---------------------------------------------------------------------------
-- 3. MEDIA — gantikan photos jadi generic (foto + video + voice)
-- ---------------------------------------------------------------------------
create table if not exists public.alunara_guestbook_media (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.alunara_guestbook_events (id) on delete cascade,
  guest_id      uuid references public.alunara_guestbook_guests (id) on delete set null,
  storage_path  text not null,
  media_type    text not null default 'photo',   -- 'photo' | 'video' | 'voice'
  mime_type     text,
  width         integer,
  height        integer,
  bytes         integer,
  duration_sec  numeric,                          -- video/voice sahaja
  stock         text not null default 'none',     -- film stock (foto sahaja)
  stock_strength numeric(3,2) not null default 1.00,
  hidden        boolean not null default false,
  hidden_reason text,
  created_at    timestamptz not null default now()
);

create index if not exists alunara_gb_media_event_idx
  on public.alunara_guestbook_media (event_id, created_at desc)
  where not hidden;

create index if not exists alunara_gb_media_type_idx
  on public.alunara_guestbook_media (event_id, media_type)
  where not hidden;

-- ---------------------------------------------------------------------------
-- 4. UNLOCK CODE — kod 1-guna untuk user cipta gallery sendiri
--    Bos jana di /admin, bagi ke client via WhatsApp. Client masukkan kod,
--    baru boleh buka form create gallery. Kod luput lepas guna / tamat tempoh.
-- ---------------------------------------------------------------------------
create table if not exists public.alunara_guestbook_unlock_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  gallery_id  uuid references public.alunara_guestbook_galleries (id) on delete set null,
  is_pro      boolean not null default false,     -- kod ni unlock tier pro?
  notes       text,
  expires_at  timestamptz not null default (now() + interval '30 days'),
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists alunara_gb_unlock_code_idx
  on public.alunara_guestbook_unlock_codes (code) where used_at is null;

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
alter table public.alunara_guestbook_galleries enable row level security;
alter table public.alunara_guestbook_media enable row level security;
alter table public.alunara_guestbook_unlock_codes enable row level security;

drop policy if exists alunara_gb_galleries_admin on public.alunara_guestbook_galleries;
drop policy if exists alunara_gb_media_admin on public.alunara_guestbook_media;
drop policy if exists alunara_gb_unlock_admin on public.alunara_guestbook_unlock_codes;

create policy alunara_gb_galleries_admin on public.alunara_guestbook_galleries
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy alunara_gb_media_admin on public.alunara_guestbook_media
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy alunara_gb_unlock_admin on public.alunara_guestbook_unlock_codes
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.alunara_guestbook_galleries from anon;
revoke all on public.alunara_guestbook_media from anon;
revoke all on public.alunara_guestbook_unlock_codes from anon;

grant select, insert, update, delete on public.alunara_guestbook_galleries to authenticated;
grant select, insert, update, delete on public.alunara_guestbook_media to authenticated;
grant select, insert, update, delete on public.alunara_guestbook_unlock_codes to authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC AWAM — semak unlock code (untuk halaman create)
--    anon boleh panggil; ia TIDAK dedah apa-apa selain sah/tak sah + is_pro.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_gb_cek_unlock(p_code text)
returns table (sah boolean, is_pro boolean, sebab text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if v_code = '' then
    return query select false, false, 'Kod kosong';
    return;
  end if;

  if exists (
    select 1 from public.alunara_guestbook_unlock_codes
    where code = v_code and used_at is null and expires_at > now()
  ) then
    return query select true,
      (select is_pro from public.alunara_guestbook_unlock_codes where code = v_code),
      ''::text;
  elsif exists (
    select 1 from public.alunara_guestbook_unlock_codes where code = v_code and used_at is not null
  ) then
    return query select false, false, 'Kod dah digunakan';
  elsif exists (
    select 1 from public.alunara_guestbook_unlock_codes where code = v_code
  ) then
    return query select false, false, 'Kod dah tamat tempoh';
  else
    return query select false, false, 'Kod tak sah';
  end if;
end;
$$;

revoke all on function public.alunara_gb_cek_unlock(text) from public;
grant execute on function public.alunara_gb_cek_unlock(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC AWAM — cipta gallery + gunakan unlock code (self-serve)
--    Sekali panggil: sahkan kod, cipta gallery, cipta event pertama,
--    tandakan kod guna. Semua atomik dalam satu transaksi.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_gb_event_code_internal()
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

revoke all on function public.alunara_gb_event_code_internal() from public;
grant execute on function public.alunara_gb_event_code_internal() to anon, authenticated;

create or replace function public.alunara_gb_create_gallery(
  p_unlock_code  text,
  p_nickname     text,
  p_title        text,
  p_event_type   text default 'wedding',
  p_slug         text default null,    -- kalau null, jana dari nickname
  p_event_date   date   default null,
  p_venue        text   default null,
  p_welcome_label text  default null,
  p_welcome_msg  text   default null,
  p_theme        text   default 'default',
  p_owner_name   text   default null,
  p_owner_phone  text   default null
) returns table (gallery_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code     text := upper(trim(coalesce(p_unlock_code, '')));
  v_unlock   uuid;
  v_pro      boolean;
  v_gallery  uuid;
  v_slug     text;
  v_event    uuid;
begin
  -- 1. Sahkan kod
  select id, is_pro into v_unlock, v_pro
  from public.alunara_guestbook_unlock_codes
  where code = v_code and used_at is null and expires_at > now()
  for update;

  if v_unlock is null then
    raise exception 'Kod unlock tak sah, dah guna, atau tamat tempoh';
  end if;

  if coalesce(trim(p_nickname), '') = '' or length(trim(p_nickname)) < 2 then
    raise exception 'Nickname tak sah';
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Tajuk majlis tak sah';
  end if;

  -- 2. Slug peribadi
  if coalesce(trim(p_slug), '') = '' then
    v_slug := lower(regexp_replace(trim(p_nickname), '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(v_slug, '-');
  else
    v_slug := lower(regexp_replace(trim(p_slug), '[^a-zA-Z0-9-]+', '-', 'g'));
    v_slug := trim(v_slug, '-');
  end if;
  if v_slug = '' then
    v_slug := 'majlis';
  end if;

  -- Alias g WAJIB: tanpa ia, "slug" bercanggah dengan OUT parameter slug
  -- (RPC RETURNS TABLE (gallery_id, slug)) → error 42702
  -- "column reference \"slug\" is ambiguous" bila buat gallery.
  if exists (select 1 from public.alunara_guestbook_galleries g where g.slug = v_slug) then
    v_slug := v_slug || '-' || to_char(now(), 'MMDDHH24MI');
  end if;

  -- 3. Cipta gallery
  insert into public.alunara_guestbook_galleries
    (slug, nickname, title, event_type, event_date, venue,
     welcome_label, welcome_message, theme, owner_name, owner_phone, is_pro)
  values
    (v_slug, trim(p_nickname), trim(p_title), coalesce(p_event_type,'wedding'),
     p_event_date, nullif(trim(coalesce(p_venue,'')),''),
     nullif(trim(coalesce(p_welcome_label,'')),''),
     nullif(trim(coalesce(p_welcome_msg,'')),''),
     coalesce(p_theme,'default'),
     nullif(trim(coalesce(p_owner_name,'')),''),
     nullif(trim(coalesce(p_owner_phone,'')),''),
     v_pro)
  returning id into v_gallery;

  -- 4. Cipta event pertama (sub-event)
  insert into public.alunara_guestbook_events
    (code, title, host_name, event_date, venue, event_type, gallery_id,
     active, upload_until, label)
  values
    ((select public.alunara_gb_event_code_internal()),
     trim(p_title),
     nullif(trim(coalesce(p_owner_name,'')),''),
     p_event_date,
     nullif(trim(coalesce(p_venue,'')),''),
     coalesce(p_event_type,'wedding'),
     v_gallery,
     true,
     now() + interval '90 days',
     'Utama')
  returning id into v_event;

  -- 5. Tandakan kod guna
  update public.alunara_guestbook_unlock_codes
     set used_at = now(), gallery_id = v_gallery
   where id = v_unlock;

  return query select v_gallery, v_slug;
end;
$$;

revoke all on function public.alunara_gb_create_gallery(text,text,text,text,text,date,text,text,text,text,text,text) from public;
grant execute on function public.alunara_gb_create_gallery(text,text,text,text,text,date,text,text,text,text,text,text) to anon;

-- ---------------------------------------------------------------------------
-- 8. RPC AWAM — info gallery + senarai sub-event (untuk halaman tetamu)
--    Gantikan/elokkan alunara_guestbook_info.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_gb_gallery_info(p_slug text)
returns table (
  gallery_id      uuid,
  nickname        text,
  title           text,
  event_type      text,
  event_date      date,
  venue           text,
  welcome_label   text,
  welcome_message text,
  theme           text,
  is_pro          boolean,
  boleh_upload    boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    g.id, g.nickname, g.title, g.event_type, g.event_date, g.venue,
    g.welcome_label, g.welcome_message, g.theme, g.is_pro,
    (g.active and now() < g.upload_until)
  from public.alunara_guestbook_galleries g
  where lower(g.slug) = lower(trim(p_slug)) and g.active;
$$;

revoke all on function public.alunara_gb_gallery_info(text) from public;
grant execute on function public.alunara_gb_gallery_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. RPC AWAM — senarai sub-event + jenis media untuk filter UI
-- ---------------------------------------------------------------------------
create or replace function public.alunara_gb_events(p_slug text)
returns table (
  event_id    uuid,
  event_type  text,
  label       text,
  event_date  date,
  venue       text
)
language sql
security definer
stable
set search_path = public
as $$
  select e.id, e.event_type, e.label, e.event_date, e.venue
  from public.alunara_guestbook_events e
  join public.alunara_guestbook_galleries g on g.id = e.gallery_id
  where lower(g.slug) = lower(trim(p_slug)) and g.active
  order by e.event_date nulls last, e.created_at;
$$;

revoke all on function public.alunara_gb_events(text) from public;
grant execute on function public.alunara_gb_events(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 10. RPC AWAM — senarai media (gantikan alunara_guestbook_gallery)
--     Sokong filter ikut event_type + media_type.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_gb_media(
  p_slug       text,
  p_media_type text default null,   -- 'photo' | 'video' | 'voice' | null=semua
  p_event_type text default null,   -- filter ikut jenis event
  p_limit      integer default 200
)
returns table (
  id            uuid,
  storage_path  text,
  media_type    text,
  stock         text,
  duration_sec  numeric,
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
    m.id, m.storage_path, m.media_type, m.stock, m.duration_sec,
    split_part(coalesce(gu.name, 'Tetamu'), ' ', 1),
    gu.wish, m.created_at
  from public.alunara_guestbook_media m
  join public.alunara_guestbook_events e on e.id = m.event_id
  join public.alunara_guestbook_galleries g on g.id = e.gallery_id
  left join public.alunara_guestbook_guests gu on gu.id = m.guest_id
  where lower(g.slug) = lower(trim(p_slug))
    and g.active
    and not m.hidden
    and (p_media_type is null or m.media_type = p_media_type)
    and (p_event_type is null or e.event_type = p_event_type)
  order by m.created_at desc
  limit least(coalesce(p_limit, 200), 500);
$$;

revoke all on function public.alunara_gb_media(text,text,text,integer) from public;
grant execute on function public.alunara_gb_media(text,text,text,integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 11. RPC AWAM — daftar media (gantikan add_photo; sokong video/voice)
-- ---------------------------------------------------------------------------
create or replace function public.alunara_gb_add_media(
  p_session      uuid,
  p_storage_path text,
  p_media_type   text default 'photo',
  p_mime_type    text default null,
  p_width        integer default null,
  p_height       integer default null,
  -- bigint, bukan integer: siling video 50MB muat dalam integer, tetapi
  -- ujian/hantaran rosak boleh sampai melebihi 2GB dan `integer` akan
  -- MELEMPAR ralat julat — jadi semakan saiz tak pernah jalan, dan tetamu
  -- nampak mesej Postgres mentah. bigint buat semakan kita yang menjawab.
  p_bytes        bigint default null,
  p_duration_sec numeric default null,
  p_stock        text default 'none',
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
  v_had_video integer;
  v_max_bytes bigint;
  v_video  integer;
  v_kali   integer;
  v_stocks text[];
  v_id     uuid;
begin
  select g.id, g.event_id, e.max_uploads_per_guest, e.max_video_per_guest,
         e.max_video_bytes, e.allowed_stocks
    into v_guest, v_event, v_had, v_had_video, v_max_bytes, v_stocks
  from public.alunara_guestbook_guests g
  join public.alunara_guestbook_events e on e.id = g.event_id
  where g.session = p_session and e.active and now() < e.upload_until;

  if v_guest is null then
    raise exception 'Sesi tak sah atau tempoh muat naik dah tamat';
  end if;

  select count(*) into v_kali
  from public.alunara_guestbook_media where guest_id = v_guest;
  if v_kali >= v_had then
    raise exception 'Dah capai had % media untuk sesi ini', v_had;
  end if;

  -- Semak jenis media dibenarkan
  if p_media_type not in ('photo','video','voice') then
    raise exception 'Jenis media tak sah';
  end if;

  -- ---- VIDEO: siling berasingan per tetamu + siling saiz ----
  -- Foto & suara TIDAK dikira di sini. Ini yang menahan kos R2:
  -- satu klip besar bukan sekadar bil, ia juga menolak kuota percuma.
  if p_media_type = 'video' then
    select count(*) into v_video
    from public.alunara_guestbook_media
    where guest_id = v_guest and media_type = 'video';
    if v_video >= v_had_video then
      raise exception 'Dah capai had % video untuk sesi ini', v_had_video;
    end if;

    if coalesce(p_bytes, 0) <= 0 then
      raise exception 'Saiz video mesti dinyatakan';
    end if;

    if p_bytes > v_max_bytes then
      raise exception 'Video terlalu besar — maksimum % MB',
        (v_max_bytes / 1048576);
    end if;
  end if;

  -- Filter film stock hanya untuk foto
  if p_media_type = 'photo' and v_stocks is not null
     and not (coalesce(p_stock,'none') = any (v_stocks)) then
    raise exception 'Filter % tak dibenarkan untuk majlis ini', p_stock;
  end if;

  -- Had durasi video. Ini pertahanan SEBENAR — klien boleh hantar apa-apa
  -- nilai dalam p_duration_sec, jadi had di UI sahaja tidak cukup.
  -- Selari dengan VIDEO_MAX_SAAT dalam src/pages/BukuTamu.tsx.
  if p_media_type = 'video' and coalesce(p_duration_sec, 0) > 60 then
    raise exception 'Video terlalu panjang — maksimum 60 saat';
  end if;

  if p_storage_path not like (v_event::text || '/%') then
    raise exception 'Laluan fail tak sah';
  end if;

  insert into public.alunara_guestbook_media
    (event_id, guest_id, storage_path, media_type, mime_type,
     width, height, bytes, duration_sec, stock, stock_strength)
  values
    (v_event, v_guest, p_storage_path, p_media_type, p_mime_type,
     p_width, p_height, p_bytes, p_duration_sec,
     case when p_media_type = 'photo' then coalesce(p_stock,'none') else 'none' end,
     case when p_media_type = 'photo' then least(greatest(coalesce(p_strength,1.00),0),1) else 1.00 end)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.alunara_gb_add_media(uuid,text,text,text,integer,integer,bigint,numeric,text,numeric) from public;
grant execute on function public.alunara_gb_add_media(uuid,text,text,text,integer,integer,bigint,numeric,text,numeric) to anon, authenticated;

-- BUANG versi LAMA (p_bytes integer).
--   `create or replace` memadankan ikut JENIS ARGUMEN. Bila p_bytes jadi
--   bigint, Postgres cipta OVERLOAD — dua fungsi wujud serentak, dan
--   PostgREST boleh pilih yang lama (yang TAK ada semakan saiz). Buang
--   yang lama secara eksplisit, kalau tidak "fix" ini senyap tak berkesan.
drop function if exists public.alunara_gb_add_media(uuid,text,text,text,integer,integer,integer,numeric,text,numeric);

-- ---------------------------------------------------------------------------
-- 11b. RPC AWAM — baki kuota sesi ini (video khasnya)
--      Kenapa perlu: siling video berasingan hanya berguna kalau tetamu TAHU
--      berapa lagi dia boleh hantar. Tanpa ini, dia pilih klip 60s, tunggu
--      muat naik, baru ditolak — pengalaman buruk, dan dia ulang lagi.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_gb_baki_saya(p_session uuid)
returns table (
  media_digunakan      integer,
  media_maks           integer,
  video_digunakan      integer,
  video_maks           integer,
  video_maks_bytes     bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    (select count(*)::integer from public.alunara_guestbook_media m
      where m.guest_id = g.id),
    e.max_uploads_per_guest,
    (select count(*)::integer from public.alunara_guestbook_media m
      where m.guest_id = g.id and m.media_type = 'video'),
    e.max_video_per_guest,
    e.max_video_bytes
  from public.alunara_guestbook_guests g
  join public.alunara_guestbook_events e on e.id = g.event_id
  where g.session = p_session and e.active and now() < e.upload_until;
$$;

revoke all on function public.alunara_gb_baki_saya(uuid) from public;
grant execute on function public.alunara_gb_baki_saya(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 12. RPC ADMIN — jana unlock code baru
-- ---------------------------------------------------------------------------
create or replace function public.alunara_gb_new_unlock_code(p_is_pro boolean default false, p_notes text default null)
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
    for i in 1..8 loop
      kod := kod || substr(aksara, 1 + floor(random() * length(aksara))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.alunara_guestbook_unlock_codes where code = kod
    );
    if cuba > 50 then
      raise exception 'Gagal jana kod unik';
    end if;
  end loop;

  insert into public.alunara_guestbook_unlock_codes (code, is_pro, notes)
  values (kod, p_is_pro, p_notes);

  return kod;
end;
$$;

revoke all on function public.alunara_gb_new_unlock_code(boolean,text) from public;
grant execute on function public.alunara_gb_new_unlock_code(boolean,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Trigger updated_at
-- ---------------------------------------------------------------------------
drop trigger if exists alunara_gb_galleries_touch on public.alunara_guestbook_galleries;
create trigger alunara_gb_galleries_touch
  before update on public.alunara_guestbook_galleries
  for each row execute function public.alunara_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 14. Backfill — promosi event lama jadi gallery (idempotent, selamat)
--     Setiap event lama yang belum ada gallery_id dapat gallery sendiri.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_gallery uuid;
begin
  for r in
    select * from public.alunara_guestbook_events where gallery_id is null
  loop
    insert into public.alunara_guestbook_galleries
      (slug, nickname, title, event_type, event_date, active, upload_until)
    values
      (r.code, coalesce(r.host_name, r.title), r.title, 'wedding',
       r.event_date, r.active, r.upload_until)
    returning id into v_gallery;

    update public.alunara_guestbook_events
       set gallery_id = v_gallery
     where id = r.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 15. Backfill — pindah photos lama → media (idempotent)
--     Photos sedia ada (v1) kekal di tempat, disalin ke media dengan
--     media_type='photo' supaya halaman galeri v2 nampak gambar lama.
-- ---------------------------------------------------------------------------
do $$
begin
  insert into public.alunara_guestbook_media
    (event_id, guest_id, storage_path, media_type, mime_type,
     width, height, bytes, stock, stock_strength, hidden, hidden_reason, created_at)
  select
    p.event_id, p.guest_id, p.storage_path, 'photo',
    case
      when p.storage_path ilike '%.png' then 'image/png'
      when p.storage_path ilike '%.webp' then 'image/webp'
      when p.storage_path ilike '%.heic' then 'image/heic'
      else 'image/jpeg'
    end,
    p.width, p.height, p.bytes, p.stock, p.stock_strength,
    p.hidden, p.hidden_reason, p.created_at
  from public.alunara_guestbook_photos p
  where not exists (
    select 1 from public.alunara_guestbook_media m where m.storage_path = p.storage_path
  );
end;
$$;
