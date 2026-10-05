create extension if not exists pgcrypto;

-- =========================================================
-- THỂ LOẠI BOOKING
-- =========================================================

create table if not exists public.booking_service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  cover_url text not null default '',
  price bigint not null default 0,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================================================
-- TẠO BOOKING_REQUESTS NẾU CHƯA CÓ
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

  status text not null default 'new',

  transferred boolean not null default false,
  transferred_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================================================
-- NẾU BẢNG TỪ PHIÊN BẢN CŨ ĐÃ TỒN TẠI THÌ BỔ SUNG CỘT
-- =========================================================

alter table public.booking_requests
  add column if not exists email text not null default '',
  add column if not exists zalo text not null default '',
  add column if not exists customer_address text not null default '',
  add column if not exists service_type_id uuid,
  add column if not exists service text not null default '',
  add column if not exists service_name text not null default '',
  add column if not exists service_price bigint not null default 0,
  add column if not exists event_date date,
  add column if not exists location text not null default '',
  add column if not exists title text not null default '',
  add column if not exists note text not null default '',
  add column if not exists payment_requested boolean not null default false,
  add column if not exists payment_method text not null default 'later',
  add column if not exists status text not null default 'new',
  add column if not exists transferred boolean not null default false,
  add column if not exists transferred_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();


-- =========================================================
-- FK NẾU BẢNG CŨ CHƯA CÓ
-- =========================================================

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_requests_service_type_id_fkey'
  ) then

    alter table public.booking_requests
      add constraint booking_requests_service_type_id_fkey
      foreign key (service_type_id)
      references public.booking_service_types(id)
      on delete set null;

  end if;
end $$;


-- =========================================================
-- INDEX
-- =========================================================

create index if not exists booking_requests_created_at_idx
on public.booking_requests(created_at desc);

create index if not exists booking_service_types_position_idx
on public.booking_service_types(position);


-- =========================================================
-- RLS
-- =========================================================

alter table public.booking_service_types
enable row level security;

alter table public.booking_requests
enable row level security;


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


drop policy if exists "public create booking"
on public.booking_requests;

create policy "public create booking"
on public.booking_requests
for insert
to anon, authenticated
with check (
  status = 'new'
  and transferred = false
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
