-- ALUNARA admin: secret-gated date blocking + booking management
-- Idempotent. Admin code lives in a RESTRICTED table (anon cannot read it).

-- Restricted secrets table (no public read).
create table if not exists public.alunara_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.alunara_secrets enable row level security;

-- No select policy for anon/authenticated => only service_role can read.

-- Seed default admin code if missing (bos changes this later).
insert into public.alunara_secrets (key, value)
values ('admin_code', 'alunara2026')
on conflict (key) do nothing;

-- Verify admin code (harmless boolean gate; reads restricted table).
create or replace function public.alunara_verify_admin(p_code text)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.alunara_secrets
    where key = 'admin_code' and value = p_code
  );
$$;
grant execute on function public.alunara_verify_admin(text) to anon, authenticated;

-- Admin: block a date manually (offline/WhatsApp booking).
create or replace function public.alunara_admin_block_date(
  p_code text,
  p_date date,
  p_customer_name text default 'Tempahan Manual',
  p_package text default 'bayu',
  p_phone text default '',
  p_notes text default ''
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  if not public.alunara_verify_admin(p_code) then
    raise exception 'Unauthorized';
  end if;
  insert into public.alunara_bookings
    (event_date, customer_name, customer_phone, event_type, package_tier, location, notes, status)
  values
    (p_date, p_customer_name, p_phone, 'Other', p_package, 'Melaka', p_notes, 'confirmed')
  on conflict do nothing
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.alunara_admin_block_date(text, date, text, text, text, text) to anon, authenticated;

-- Admin: list all bookings (full detail).
create or replace function public.alunara_admin_list_bookings(p_code text)
returns table (
  id uuid, event_date date, customer_name text, customer_phone text,
  event_type text, package_tier text, location text, notes text,
  status text, created_at timestamptz
) language plpgsql security definer as $$
begin
  if not public.alunara_verify_admin(p_code) then
    raise exception 'Unauthorized';
  end if;
  return query select b.id, b.event_date, b.customer_name, b.customer_phone,
    b.event_type, b.package_tier, b.location, b.notes, b.status, b.created_at
    from public.alunara_bookings b order by b.event_date;
end;
$$;
grant execute on function public.alunara_admin_list_bookings(text) to anon, authenticated;

-- Admin: confirm or cancel a booking by id.
create or replace function public.alunara_admin_set_status(p_code text, p_id uuid, p_status text)
returns void language plpgsql security definer as $$
begin
  if not public.alunara_verify_admin(p_code) then
    raise exception 'Unauthorized';
  end if;
  if p_status not in ('pending', 'confirmed', 'cancelled') then
    raise exception 'Invalid status';
  end if;
  update public.alunara_bookings set status = p_status where id = p_id;
end;
$$;
grant execute on function public.alunara_admin_set_status(text, uuid, text) to anon, authenticated;
