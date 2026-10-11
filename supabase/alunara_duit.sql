-- =============================================================================
-- ALUNARA DUIT — buku tunai ringkas untuk /admin (Fasa 1)
-- =============================================================================
-- Idempotent: selamat dijalankan berulang.
--
-- KENAPA JADUAL INI WUJUD
--   Panel admin sebelum ni merekod TEMPAHAN je. Kos sebenar (sewa tapak, props,
--   petrol, printing, upah tolong angkat) tak direkod di mana-mana, jadi bos
--   tak tahu margin sebenar pakej RM109. Fail ini tambah dua buku:
--     alunara_payments — duit MASUK sebenar (sumber kebenaran bayaran)
--     alunara_expenses — duit KELUAR sebenar
--
-- KENAPA BUKAN ambil skema OpenKuasaOS (Bendahara)
--   1. Stack dia Next.js server-component; Alunara React+Vite SPA. Kena tulis
--      semula, tak boleh tampal.
--   2. Setiap jadual dia ada `org_id` + RLS multi-tenant (private.is_org_member).
--      Alunara bisnes solo — satu workspace. Tinjau tu cuma beban.
--   3. Lesen AGPL-3.0. Idea skema tak terikat lesen, kod dia ada. Kita tulis
--      sendiri, lebih kecil, ikut keperluan sebenar.
--   Yang diambil cuma BENTUK: arah in/out, kategori, kaedah bayaran.
--
-- KEPUTUSAN REKA BENTUK YANG SENGAJA
--   * Tiada jadual `accounts` (bank/cash berasingan). Solo operator: satu bank +
--     tunai. Kolum `kaedah` dah cukup. Tambah nanti kalau betul-betul perlu.
--   * Tiada jadual `categories` + skrin urus kategori. Kategori = teks bebas,
--     UI bagi senarai cadangan (datalist). Jangan paksa migrasi SQL setiap kali
--     bos nak kategori baru.
--   * Tiada aliran kelulusan (draft/pending_approval). Tak ada siapa nak
--     approve.
--   * `is_capex` WAJIB ada. Modal awal ~RM1,900 (props, kerusi, meja) bukan kos
--     operasi bulanan; kalau dicampur, margin bulan pertama nampak rugi teruk
--     padahal tak.
--
-- JANGAN auto-jana bayaran dari `status` tempahan
--   `status = confirmed` bukan bukti duit masuk. `paid_amount` pula nombor
--   kumulatif, bukan satu peristiwa. Auto-jana dari situ = double count bila
--   booking diedit, deposit/baki masuk bulan salah, refund hilang. Sebaliknya
--   arah diterbalikkan: `alunara_payments` jadi sumber kebenaran, dan
--   `alunara_bookings.paid_amount` DIKIRA dari situ oleh trigger di bawah.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. BAYARAN MASUK — satu baris = satu peristiwa duit bergerak
-- ---------------------------------------------------------------------------
create table if not exists public.alunara_payments (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid references public.alunara_bookings (id) on delete cascade,
  -- deposit | baki | tambahan | refund | lain
  -- refund ditolak dalam kiraan (lihat trigger + view di bawah).
  kind        text not null default 'baki'
              check (kind in ('deposit', 'baki', 'tambahan', 'refund', 'lain')),
  amount      numeric(10,2) not null check (amount > 0),
  -- Tarikh duit BENAR-BENAR bergerak, bukan tarikh majlis. Zon masa KL —
  -- kalau guna UTC, bayaran pukul 8 pagi 1 haribulan boleh masuk bulan lepas.
  paid_at     date not null default ((now() at time zone 'Asia/Kuala_Lumpur')::date),
  kaedah      text not null default 'Tunai',
  nota        text,
  created_at  timestamptz not null default now()
);

create index if not exists alunara_payments_booking_idx on public.alunara_payments (booking_id);
create index if not exists alunara_payments_tarikh_idx  on public.alunara_payments (paid_at desc);
create index if not exists alunara_payments_jenis_idx   on public.alunara_payments (kind);

comment on table public.alunara_payments is
  'Buku duit MASUK. Ini sumber kebenaran bayaran — alunara_bookings.paid_amount dikira dari sini.';
comment on column public.alunara_payments.paid_at is
  'Tarikh duit bergerak (zon KL). BUKAN tarikh majlis.';

-- ---------------------------------------------------------------------------
-- 2. BELANJA — duit keluar
-- ---------------------------------------------------------------------------
create table if not exists public.alunara_expenses (
  id          uuid primary key default gen_random_uuid(),
  tarikh      date not null default ((now() at time zone 'Asia/Kuala_Lumpur')::date),
  jumlah      numeric(10,2) not null check (jumlah > 0),
  kategori    text not null default 'Lain-lain',
  kaedah      text not null default 'Tunai',
  -- Kalau belanja ini khusus untuk satu majlis (petrol hantar, upah angkat),
  -- pautkan ke booking. Ini kunci untuk kira margin setiap job.
  booking_id  uuid references public.alunara_bookings (id) on delete set null,
  -- Modal (props, kerusi, meja) = true. Kos operasi bulanan = false.
  is_capex    boolean not null default false,
  nota        text,
  -- Pautan resit. Buat masa ini teks (bos tampal pautan Drive/WhatsApp);
  -- muat naik terus ke storage menyusul kalau betul-betul perlu.
  resit_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists alunara_expenses_tarikh_idx   on public.alunara_expenses (tarikh desc);
create index if not exists alunara_expenses_kategori_idx on public.alunara_expenses (kategori);
create index if not exists alunara_expenses_booking_idx  on public.alunara_expenses (booking_id);

comment on table public.alunara_expenses is
  'Buku duit KELUAR. is_capex asingkan modal dari kos operasi bulanan.';

-- ---------------------------------------------------------------------------
-- 3. TRIGGER — paid_amount pada booking DIKIRA dari payments
--    Jangan pernah taip paid_amount dua tempat. UI tak lagi bagi medan
--    "Dah Bayar" yang boleh diedit; ia paparan sahaja.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_kira_bayaran(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bersih numeric;
  v_jumlah numeric;
begin
  if p_booking is null then return; end if;

  select coalesce(sum(case when kind = 'refund' then -amount else amount end), 0)
    into v_bersih
    from public.alunara_payments
   where booking_id = p_booking;

  select coalesce(total_amount, 0) into v_jumlah
    from public.alunara_bookings where id = p_booking;

  if not found then return; end if;

  update public.alunara_bookings
     set paid_amount  = greatest(v_bersih, 0),
         balance_paid = (v_jumlah > 0 and v_bersih >= v_jumlah)
   where id = p_booking;
end;
$$;

create or replace function public.alunara_payments_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.alunara_kira_bayaran(coalesce(new.booking_id, old.booking_id));
  -- Kalau baris dipindah dari satu booking ke booking lain, kira kedua-dua.
  if tg_op = 'UPDATE' and old.booking_id is distinct from new.booking_id then
    perform public.alunara_kira_bayaran(old.booking_id);
  end if;
  return null;
end;
$$;

drop trigger if exists alunara_payments_sync_trg on public.alunara_payments;
create trigger alunara_payments_sync_trg
  after insert or update or delete on public.alunara_payments
  for each row execute function public.alunara_payments_sync();

-- ---------------------------------------------------------------------------
-- 4. BACKFILL — 8 tempahan sedia ada ada `paid_amount` yang belum jadi baris
--    bayaran. Kalau tak salin, laporan bulan lepas salah (duit masuk nampak 0)
--    dan angka booking akan ditulis ganti bila bayaran pertama direkod.
-- ---------------------------------------------------------------------------
insert into public.alunara_payments (booking_id, kind, amount, paid_at, kaedah, nota)
select b.id,
       case
         when b.deposit_amount > 0 and b.paid_amount <= b.deposit_amount then 'deposit'
         else 'baki'
       end,
       b.paid_amount,
       least(b.created_at::date, (now() at time zone 'Asia/Kuala_Lumpur')::date),
       'Tunai',
       'Backfill dari paid_amount (migrasi buku tunai, Okt 2026)'
  from public.alunara_bookings b
 where b.paid_amount > 0
   and not exists (select 1 from public.alunara_payments p where p.booking_id = b.id);

-- Selaraskan semula selepas backfill (termasuk balance_paid).
select public.alunara_kira_bayaran(id) from public.alunara_bookings;

-- ---------------------------------------------------------------------------
-- 5. RLS + kebenaran — sama corak macam jadual alunara_* yang lain
-- ---------------------------------------------------------------------------
alter table public.alunara_payments enable row level security;
alter table public.alunara_expenses enable row level security;

drop policy if exists alunara_payments_admin_all on public.alunara_payments;
create policy alunara_payments_admin_all on public.alunara_payments
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists alunara_expenses_admin_all on public.alunara_expenses;
create policy alunara_expenses_admin_all on public.alunara_expenses
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.alunara_payments to authenticated;
grant select, insert, update, delete on public.alunara_expenses to authenticated;
revoke all on public.alunara_payments from anon;
revoke all on public.alunara_expenses from anon;

-- ---------------------------------------------------------------------------
-- 6. VIEW ringkasan bulanan
--    NAMA SENGAJA JUJUR: ini ALIRAN TUNAI BERSIH, bukan "untung".
--      * Deposit untuk majlis bulan depan masuk bulan ini (duit dah masuk).
--      * Props yang guna berkali-kali dilupuskan penuh pada bulan beli (capex).
--      * Margin ikut pakej hanya bermakna bila kos khusus majlis direkod
--        konsisten — dan dengan 8 tempahan, angka itu belum bermakna.
-- ---------------------------------------------------------------------------
create or replace view public.alunara_duit_bulanan
with (security_invoker = true) as
select bulan,
       sum(masuk)                                             as masuk,
       sum(keluar_op)                                         as keluar_op,
       sum(keluar_capex)                                      as keluar_capex,
       sum(masuk) - sum(keluar_op) - sum(keluar_capex)        as tunai_bersih
from (
  select date_trunc('month', paid_at)::date   as bulan,
         sum(case when kind = 'refund' then -amount else amount end) as masuk,
         0::numeric                            as keluar_op,
         0::numeric                            as keluar_capex
    from public.alunara_payments
   group by 1
  union all
  select date_trunc('month', tarikh)::date,
         0::numeric,
         case when is_capex then 0 else jumlah end,
         case when is_capex then jumlah else 0 end
    from public.alunara_expenses
) t
group by bulan;

revoke all on public.alunara_duit_bulanan from anon;

-- Fungsi ini hanya dipanggil oleh trigger (SECURITY DEFINER). Jangan biar
-- peranan authenticated/anon panggil terus.
revoke all on function public.alunara_kira_bayaran(uuid) from public, anon, authenticated;
revoke all on function public.alunara_payments_sync() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. VIEW ikut kategori (untuk dashboard Fasa 2 — belum dipakai UI)
-- ---------------------------------------------------------------------------
create or replace view public.alunara_belanja_kategori
with (security_invoker = true) as
select date_trunc('month', tarikh)::date as bulan,
       kategori,
       is_capex,
       sum(jumlah) as jumlah,
       count(*)    as bilangan
  from public.alunara_expenses
 group by 1, 2, 3;

revoke all on public.alunara_belanja_kategori from anon;
