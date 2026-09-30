-- ---------------------------------------------------------------------------
-- 12. RPC AWAM v2 — DAFTAR TETAMU ikut SLUG (fix "events is not created")
--
-- PUNCA BUG: halaman tetamu v2 memanggil `alunara_guestbook_join(p_code)` —
-- RPC v1 yang cari kod 6 aksara dalam `alunara_guestbook_events.code`. Tetapi
-- galeri v2 dicapai ikut SLUG (`/buku-tamu/alia-arif`), jadi carian itu tidak
-- jumpa apa-apa dan tetamu dapat ralat "Kod majlis tak sah" walaupun galeri
-- dan event memang wujud.
--
-- Fungsi ini menyelesaikan join ikut slug → event pertama (label 'Utama'),
-- atau event yang diminta kalau p_event_id diberi.
-- ---------------------------------------------------------------------------
create or replace function public.alunara_gb_join(
  p_slug     text,
  p_name     text,
  p_wish     text default null,
  p_event_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gallery uuid;
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

  select g.id, (g.active and now() < g.upload_until)
    into v_gallery, v_boleh
  from public.alunara_guestbook_galleries g
  where lower(g.slug) = lower(trim(p_slug)) and g.active;

  if v_gallery is null then
    raise exception 'Pautan majlis tak sah atau majlis dah tamat';
  end if;
  if not v_boleh then
    raise exception 'Tempoh muat naik dah tamat';
  end if;

  -- Event pertama (atau event yang diminta).
  if p_event_id is not null then
    select e.id into v_event
    from public.alunara_guestbook_events e
    where e.id = p_event_id and e.gallery_id = v_gallery and e.active;
  else
    select e.id into v_event
    from public.alunara_guestbook_events e
    where e.gallery_id = v_gallery and e.active
    order by e.event_date nulls last, e.created_at
    limit 1;
  end if;

  if v_event is null then
    raise exception 'Majlis ini belum ada sesi muat naik';
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

revoke all on function public.alunara_gb_join(text, text, text, uuid) from public;
grant execute on function public.alunara_gb_join(text, text, text, uuid) to anon, authenticated;
