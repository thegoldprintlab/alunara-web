-- =============================================================================
-- ALUNARA — INVENTORI (barang) + VIEW PRESTASI (dashboard)
-- =============================================================================
-- Idempotent: selamat dijalankan berulang.
--
-- KENAPA INVENTORI, PADAHAL MODEL KATA "STOK BUKAN MASALAH KEWANGAN"
--   Betul untuk Kawalan tempahan: unique index `event_date` dah jaga
--   "1 Tarikh, 1 Majlis", jadi kita TIDAK bina sistem tolak-stok automatik
--   (itu overkill — 3 meja takkan habis dalam satu hari).
--   Tapi ada soalan lain yang tiada jawapan langsung sekarang:
--     * Berapa nilai aset Alunara? (modal ~RM1,900 ada di mana?)
--     * Barang mana yang rosak / kena ganti / dah lupus?
--     * Bila kali terakhir beli kerusi, dan pada harga berapa?
--   Itu soalan rekod aset, bukan kawalan stok. Jadual ini jawab itu.
--
-- KENAPA VIEW PRESTASI, BUKAN JADUAL
--   Semua angka dashboard DIKIRA dari data sedia ada (bookings, payments,
--   expenses, items). Tiada angka disimpan dua kali — elak dua punca
--   kebenaran yang boleh lari antara satu sama lain.
--
-- NAMA METRIK SENGAJA JUJUR
--   `alunara_margin_pakej.hasil` = hasil DIPERSETUJUI (total_amount), bukan
--   duit yang dah masuk. Margin hanya bermakna bila kos khusus majlis
--   direkod — sebab itu ada kolum `bilangan_ada_kos`: kalau ia 0 sementara
--   `bilangan` besar, margin 100% itu palsu, bukan untung sebenar.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. INVENTORI — barang yang Alunara miliki
-- ---------------------------------------------------------------------------
create table if not exists public.alunara_items (
  id            uuid primary key default gen_random_uuid(),
  nama          text not null,
  kategori      text not null default 'Lain-lain',
  kuantiti      integer not null default 1 check (kuantiti >= 0),
  -- Nilai belian SEUNIT. 0 = belum diisi, bukan bermakna percuma.
  nilai_seunit  numeric(10,2) not null default 0 check (nilai_seunit >= 0),
  tarikh_beli   date,
  -- baik = boleh guna · rosak = perlu baiki/ganti · lupus = dah buang
  keadaan       text not null default 'baik' check (keadaan in ('baik', 'rosak', 'lupus')),
  lokasi        text,
  nota          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists alunara_items_kategori_idx on public.alunara_items (kategori);
create index if not exists alunara_items_keadaan_idx  on public.alunara_items (keadaan);

comment on table public.alunara_items is
  'Inventori barang Alunara (aset). Rekod aset + keadaan, BUKAN kawalan stok automatik.';
comment on column public.alunara_items.nilai_seunit is
  'Nilai belian seunit. 0 = belum diisi (bukan bermakna percuma).';

-- ---------------------------------------------------------------------------
-- 2. SEED — stok asas yang bos memang ada (hanya jika jadual masih kosong)
-- ---------------------------------------------------------------------------
insert into public.alunara_items (nama, kategori, kuantiti, keadaan, nota)
select v.nama, v.kategori, v.kuantiti, 'baik', 'Stok asas (seed awal panel)'
  from (values
    ('Meja bulat', 'Meja', 3),
    ('Kerusi', 'Kerusi', 18),
    ('Meja hidangan', 'Meja Hidangan', 1)
  ) as v(nama, kategori, kuantiti)
 where not exists (select 1 from public.alunara_items);

-- ---------------------------------------------------------------------------
-- 3. VIEW PRESTASI
-- ---------------------------------------------------------------------------

-- 3a. Margin ikut pakej. Hanya kos BUKAN modal dipautkan ke majlis dikira —
--     props/kerusi digunakan berkali-kali, melupuskannya pada satu majlis
--     akan buat majlis itu nampak rugi dan yang lain nampak untung palsu.
create or replace view public.alunara_margin_pakej
with (security_invoker = true) as
select b.package_id,
       count(*)::int                        as bilangan,
       -- Bilangan majlis yang ADA kos khusus direkod. Kalau ini 0 sementara
       -- `bilangan` besar, margin di bawah TIDAK boleh dipercayai.
       count(e.belanja)::int                as bilangan_ada_kos,
       sum(b.total_amount)                  as hasil,
       coalesce(sum(e.belanja), 0)          as kos,
       sum(b.total_amount) - coalesce(sum(e.belanja), 0) as margin
  from public.alunara_bookings b
  left join (
    select booking_id, sum(jumlah) as belanja
      from public.alunara_expenses
     where not is_capex and booking_id is not null
     group by booking_id
  ) e on e.booking_id = b.id
 where b.status <> 'cancelled'
   and b.total_amount > 0
 group by b.package_id;

-- 3b. Nilai aset ikut kategori (keadaan != lupus).
create or replace view public.alunara_aset
with (security_invoker = true) as
select kategori,
       sum(kuantiti)::int              as kuantiti,
       sum(kuantiti * nilai_seunit)    as nilai,
       count(*) filter (where keadaan = 'rosak')::int as baris_rosak
  from public.alunara_items
 where keadaan <> 'lupus'
 group by kategori;

-- 3c. Ringkasan tempahan akan datang + belum kutip (satu baris, sedia guna).
create or replace view public.alunara_ringkasan_tempahan
with (security_invoker = true) as
select
  count(*) filter (
    where status not in ('cancelled', 'completed')
      and event_date >= (now() at time zone 'Asia/Kuala_Lumpur')::date
  )::int                                          as akan_datang,
  coalesce(sum(total_amount - paid_amount) filter (
    where status not in ('cancelled', 'completed')
  ), 0)                                           as belum_kutip,
  coalesce(sum(total_amount) filter (
    where status not in ('cancelled', 'completed')
      and event_date >= (now() at time zone 'Asia/Kuala_Lumpur')::date
  ), 0)                                           as nilai_bakal
  from public.alunara_bookings;

-- ---------------------------------------------------------------------------
-- 4. RLS + kebenaran (sama corak macam jadual alunara_* yang lain)
-- ---------------------------------------------------------------------------
alter table public.alunara_items enable row level security;

drop policy if exists alunara_items_admin_all on public.alunara_items;
create policy alunara_items_admin_all on public.alunara_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.alunara_items to authenticated;
revoke all on public.alunara_items from anon;

revoke all on public.alunara_margin_pakej from anon;
revoke all on public.alunara_aset from anon;
revoke all on public.alunara_ringkasan_tempahan from anon;
