create extension if not exists pgcrypto;

-- =========================================================
-- THỂ LOẠI CHỤP
-- =========================================================

create table if not exists public.booking_service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  cover_url text not null default '',
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nếu bản cũ đã có cột price thì vẫn giữ, nhưng từ nay không dùng nữa.


-- =========================================================
-- BẢNG GIÁ RIÊNG
-- =========================================================

create table if not exists public.booking_service_prices (
  id uuid primary key default gen_random_uuid(),

  service_type_id uuid not null
    references public.booking_service_types(id)
    on delete cascade,

  price bigint not null default 0
    check (price >= 0),

  note text not null default '',
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(service_type_id)
);


-- Nếu bảng service cũ có cột price thì chuyển dữ liệu cũ sang bảng giá mới
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'booking_service_types'
      and column_name = 'price'
  ) then

    insert into public.booking_service_prices (
      service_type_id,
      price,
      active
    )
    select
      id,
      coalesce(price, 0),
      true
    from public.booking_service_types
    on conflict (service_type_id)
    do nothing;

  end if;
end $$;


-- =========================================================
-- CẤU HÌNH CHUYỂN KHOẢN
-- =========================================================

create table if not exists public.booking_payment_settings (
  id text primary key default 'main',

  enabled boolean not null default false,

  bank_name text not null default '',
  account_number text not null default '',
  account_holder text not null default '',

  transfer_content text not null default 'BOOKING {PHONE}',

  qr_url text not null default '',
  note text not null default '',

  updated_at timestamptz not null default now()
);

insert into public.booking_payment_settings (
  id,
  enabled
)
values (
  'main',
  false
)
on conflict (id) do nothing;


-- =========================================================
-- BOOKING
-- =========================================================

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),

  full_name text not null,
  phone text not null,

  email text not null default '',
  zalo text not null default '',
  customer_address text not null default '',

  service_type_id uuid
    references public.booking_service_types(id)
    on delete set null,

  service text not null default '',
  service_name text not null default '',
  service_price bigint not null default 0,

  event_date date,
  location text not null default '',
  title text not null default '',
  note text not null default '',

  payment_requested boolean not null default false,
  payment_method text not null default 'later',

  transferred boolean not null default false,
  transferred_at timestamptz,

  status text not null default 'new',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


alter table public.booking_requests
  add column if not exists email text not null default '',
  add column if not exists zalo text not null default '',
  add column if not exists customer_address text not null default '',
  add column if not exists service_type_id uuid,
  add column if not exists service_name text not null default '',
  add column if not exists service_price bigint not null default 0,
  add column if not exists title text not null default '',
  add column if not exists payment_requested boolean not null default false,
  add column if not exists payment_method text not null default 'later',
  add column if not exists transferred boolean not null default false,
  add column if not exists transferred_at timestamptz;


-- =========================================================
-- GIÁ ĐƯỢC CHỐT TẠI THỜI ĐIỂM BOOKING
-- =========================================================

create or replace function public.set_booking_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_name text;
  v_service_price bigint;
begin

  select
    s.name,
    coalesce(p.price, 0)
  into
    v_service_name,
    v_service_price
  from public.booking_service_types s

  left join public.booking_service_prices p
    on p.service_type_id = s.id
   and p.active = true

  where s.id = new.service_type_id
    and s.active = true;

  if not found then
    raise exception 'Thể loại Booking không hợp lệ.';
  end if;

  new.service := v_service_name;
  new.service_name := v_service_name;
  new.service_price := v_service_price;

  new.status := 'new';
  new.transferred := false;
  new.transferred_at := null;

  return new;
end;
$$;

drop trigger if exists booking_snapshot_trigger
on public.booking_requests;

create trigger booking_snapshot_trigger
before insert on public.booking_requests
for each row
execute function public.set_booking_snapshot();


-- =========================================================
-- RLS
-- =========================================================

alter table public.booking_service_types
enable row level security;

alter table public.booking_service_prices
enable row level security;

alter table public.booking_payment_settings
enable row level security;

alter table public.booking_requests
enable row level security;


-- SERVICES

drop policy if exists "public read booking services"
on public.booking_service_types;

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


-- PRICE

drop policy if exists "public read booking prices"
on public.booking_service_prices;

create policy "public read booking prices"
on public.booking_service_prices
for select
to anon, authenticated
using (
  (
    active = true
    and exists (
      select 1
      from public.booking_service_types s
      where s.id = service_type_id
        and s.active = true
    )
  )
  or public.is_gallery_admin()
);

drop policy if exists "admin manage booking prices"
on public.booking_service_prices;

create policy "admin manage booking prices"
on public.booking_service_prices
for all
to authenticated
using (public.is_gallery_admin())
with check (public.is_gallery_admin());


-- PAYMENT SETTINGS

drop policy if exists "public read payment settings"
on public.booking_payment_settings;

create policy "public read payment settings"
on public.booking_payment_settings
for select
to anon, authenticated
using (
  enabled = true
  or public.is_gallery_admin()
);

drop policy if exists "admin manage payment settings"
on public.booking_payment_settings;

create policy "admin manage payment settings"
on public.booking_payment_settings
for all
to authenticated
using (public.is_gallery_admin())
with check (public.is_gallery_admin());


-- BOOKING

drop policy if exists "public create booking"
on public.booking_requests;

drop policy if exists "public submit booking"
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
-- GRANTS
-- =========================================================

grant select on public.booking_service_types
to anon, authenticated;

grant insert, update, delete
on public.booking_service_types
to authenticated;

grant select on public.booking_service_prices
to anon, authenticated;

grant insert, update, delete
on public.booking_service_prices
to authenticated;

grant select on public.booking_payment_settings
to anon, authenticated;

grant insert, update, delete
on public.booking_payment_settings
to authenticated;

grant insert
on public.booking_requests
to anon, authenticated;

grant select, update, delete
on public.booking_requests
to authenticated;
