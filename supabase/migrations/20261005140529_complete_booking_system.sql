create extension if not exists pgcrypto;

-- =========================================================
-- 1. THÔNG TIN LIÊN HỆ
-- =========================================================

create table if not exists public.site_contact_settings (
  id text primary key default 'main',
  phone text not null default '',
  zalo_url text not null default '',
  facebook_url text not null default '',
  email text not null default '',
  address text not null default '',
  booking_note text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.site_contact_settings (
  id,
  booking_note
)
values (
  'main',
  'Hãy để lại thông tin. DinhThong Photos sẽ liên hệ lại với bạn trong thời gian sớm nhất.'
)
on conflict (id) do nothing;


-- =========================================================
-- 2. THỂ LOẠI CHỤP + GIÁ
-- =========================================================

create table if not exists public.booking_service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  cover_url text not null default '',
  price bigint not null default 0 check (price >= 0),
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_service_types_position_idx
on public.booking_service_types(position);


-- =========================================================
-- 3. BOOKING KHÁCH HÀNG
-- =========================================================

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),

  full_name text not null,
  phone text not null,
  email text not null default '',
  zalo text not null default '',
  customer_address text not null default '',

  service_type_id uuid references public.booking_service_types(id) on delete set null,
  service text not null default '',
  service_name text not null default '',
  service_price bigint not null default 0,

  event_date date,
  location text not null default '',
  title text not null default '',
  note text not null default '',

  status text not null default 'new',
  transferred boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- Nếu bảng cũ đã tồn tại thì bổ sung cột
alter table public.booking_requests
  add column if not exists email text not null default '',
  add column if not exists zalo text not null default '',
  add column if not exists customer_address text not null default '',
  add column if not exists service_type_id uuid,
  add column if not exists service_name text not null default '',
  add column if not exists service_price bigint not null default 0,
  add column if not exists title text not null default '',
  add column if not exists transferred boolean not null default false;


-- =========================================================
-- 4. GIÁ BOOKING ĐƯỢC CHỐT TỪ DASHBOARD
-- Khách không thể tự sửa giá bằng request
-- =========================================================

create or replace function public.set_booking_service_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_service public.booking_service_types%rowtype;
begin
  select *
  into selected_service
  from public.booking_service_types
  where id = new.service_type_id
    and active = true;

  if not found then
    raise exception 'Dịch vụ Booking không hợp lệ hoặc đã bị ẩn.';
  end if;

  new.service := selected_service.name;
  new.service_name := selected_service.name;
  new.service_price := selected_service.price;

  new.status := 'new';
  new.transferred := false;

  return new;
end;
$$;

drop trigger if exists booking_service_snapshot_trigger
on public.booking_requests;

create trigger booking_service_snapshot_trigger
before insert on public.booking_requests
for each row
execute function public.set_booking_service_snapshot();


-- =========================================================
-- 5. RLS
-- =========================================================

alter table public.site_contact_settings
enable row level security;

alter table public.booking_service_types
enable row level security;

alter table public.booking_requests
enable row level security;


-- CONTACT

drop policy if exists "public read contact settings"
on public.site_contact_settings;

create policy "public read contact settings"
on public.site_contact_settings
for select
to anon, authenticated
using (true);

drop policy if exists "admin manage contact settings"
on public.site_contact_settings;

create policy "admin manage contact settings"
on public.site_contact_settings
for all
to authenticated
using (public.is_gallery_admin())
with check (public.is_gallery_admin());


-- SERVICES

drop policy if exists "public read active booking services"
on public.booking_service_types;

create policy "public read active booking services"
on public.booking_service_types
for select
to anon, authenticated
using (
  active = true
  or public.is_gallery_admin()
);

drop policy if exists "admin manage booking services"
on public.booking_service_types;

create policy "admin manage booking services"
on public.booking_service_types
for all
to authenticated
using (public.is_gallery_admin())
with check (public.is_gallery_admin());


-- BOOKING

drop policy if exists "public create booking"
on public.booking_requests;

create policy "public create booking"
on public.booking_requests
for insert
to anon, authenticated
with check (
  transferred = false
  and status = 'new'
);

drop policy if exists "admin read booking"
on public.booking_requests;

create policy "admin read booking"
on public.booking_requests
for select
to authenticated
using (public.is_gallery_admin());

drop policy if exists "admin update booking"
on public.booking_requests;

create policy "admin update booking"
on public.booking_requests
for update
to authenticated
using (public.is_gallery_admin())
with check (public.is_gallery_admin());

drop policy if exists "admin delete booking"
on public.booking_requests;

create policy "admin delete booking"
on public.booking_requests
for delete
to authenticated
using (public.is_gallery_admin());


-- =========================================================
-- 6. GRANTS
-- =========================================================

grant select
on public.site_contact_settings
to anon, authenticated;

grant insert, update, delete
on public.site_contact_settings
to authenticated;

grant select
on public.booking_service_types
to anon, authenticated;

grant insert, update, delete
on public.booking_service_types
to authenticated;

grant insert
on public.booking_requests
to anon, authenticated;

grant select, update, delete
on public.booking_requests
to authenticated;
