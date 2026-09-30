-- ---------------------------------------------------------------------------
-- 16. RPC AWAM — DINDING UCAPAN (guest wish wall)
--
-- PUNCA MASALAH: ucapan tetamu disimpan dalam `alunara_guestbook_guests.wish`,
-- tetapi halaman buku tamu hanya memaparkannya dalam <figcaption> MEDIA.
-- Akibatnya tetamu yang menulis ucapan SAHAJA (tanpa foto/video/suara) tidak
-- muncul di mana-mana — data ada, paparan tiada. Tetamu yang upload 3 gambar
-- pula ucapannya berulang 3 kali.
--
-- Fungsi ini pulangkan SENARAI TETAMU yang ada ucapan, sekali sahaja setiap
-- orang, supaya halaman boleh tunjuk "dinding ucapan" yang berasingan dari
-- grid media.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_gb_ucapan(
  p_slug  text,
  p_limit integer default 300
)
returns table (
  guest_id   uuid,
  nama       text,
  wish       text,
  event_type text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    gu.id,
    trim(coalesce(gu.name, 'Tetamu')),
    gu.wish,
    e.event_type,
    gu.created_at
  from public.alunara_guestbook_guests gu
  join public.alunara_guestbook_events e on e.id = gu.event_id
  join public.alunara_guestbook_galleries g on g.id = e.gallery_id
  where lower(g.slug) = lower(trim(p_slug))
    and g.active
    and coalesce(trim(gu.wish), '') <> ''
  order by gu.created_at desc
  limit least(coalesce(p_limit, 300), 500);
$$;

revoke all on function public.alunara_gb_ucapan(text, integer) from public;
grant execute on function public.alunara_gb_ucapan(text, integer) to anon, authenticated;
