create table if not exists public.booking_service_packages (
  id uuid primary key default gen_random_uuid(),

  service_type_id uuid not null
    references public.booking_service_types(id)
    on delete cascade,

  name text not null,
  description text not null default '',

  price bigint not null default 0
    check (price >= 0),

  active boolean not null default true,
  position integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(service_type_id, name)
);

create index if not exists booking_service_packages_service_idx
on public.booking_service_packages(service_type_id, position);


-- Chuyển bảng giá cũ thành "Gói tiêu chuẩn"
insert into public.booking_service_packages (
  service_type_id,
  name,
  description,
  price,
  active,
  position
)
select
  p.service_type_id,
  'Gói tiêu chuẩn',
  coalesce(p.note, ''),
  p.price,
  p.active,
  0
from public.booking_service_prices p
where not exists (
  select 1
  from public.booking_service_packages x
  where x.service_type_id = p.service_type_id
);


-- Booking lưu lại đúng gói và giá tại thời điểm khách đặt
alter table public.booking_requests
  add column if not exists package_id uuid,
  add column if not exists package_name text not null default '',
  add column if not exists package_price bigint not null default 0;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_requests_package_id_fkey'
  ) then
    alter table public.booking_requests
      add constraint booking_requests_package_id_fkey
      foreign key (package_id)
      references public.booking_service_packages(id)
      on delete set null;
  end if;
end $$;


-- Snapshot dịch vụ + gói + giá
create or replace function public.set_booking_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_name text;
  v_package_name text;
  v_package_price bigint;
begin

  select
    s.name,
    p.name,
    p.price
  into
    v_service_name,
    v_package_name,
    v_package_price
  from public.booking_service_types s

  join public.booking_service_packages p
    on p.service_type_id = s.id

  where s.id = new.service_type_id
    and p.id = new.package_id
    and s.active = true
    and p.active = true;

  if not found then
    raise exception 'Gói chụp không hợp lệ.';
  end if;

  new.service := v_service_name;
  new.service_name := v_service_name;

  new.package_name := v_package_name;
  new.package_price := v_package_price;

  -- giữ tương thích code cũ
  new.service_price := v_package_price;

  new.status := 'new';
  new.transferred := false;
  new.transferred_at := null;

  return new;
end;
$$;


-- RLS
alter table public.booking_service_packages
enable row level security;

drop policy if exists "public read booking packages"
on public.booking_service_packages;

create policy "public read booking packages"
on public.booking_service_packages
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

drop policy if exists "admin manage booking packages"
on public.booking_service_packages;

create policy "admin manage booking packages"
on public.booking_service_packages
for all
to authenticated
using (public.is_gallery_admin())
with check (public.is_gallery_admin());


grant select
on public.booking_service_packages
to anon, authenticated;

grant insert, update, delete
on public.booking_service_packages
to authenticated;
