-- =========================================================
-- TỶ LỆ CỌC
-- =========================================================

alter table public.booking_payment_settings
  add column if not exists deposit_percent integer not null default 30;

update public.booking_payment_settings
set deposit_percent = 30
where deposit_percent < 30;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_payment_deposit_percent_check'
  ) then
    alter table public.booking_payment_settings
      add constraint booking_payment_deposit_percent_check
      check (deposit_percent between 30 and 100);
  end if;
end $$;

-- Từ nay hệ thống chuyển khoản được quản lý trực tiếp trong Dashboard,
-- không cần nút bật/tắt nữa.
update public.booking_payment_settings
set enabled = true
where id = 'main';


-- =========================================================
-- BOOKING: LỰA CHỌN THANH TOÁN
-- =========================================================

alter table public.booking_requests
  add column if not exists payment_option text not null default 'later',
  add column if not exists payment_amount bigint not null default 0,
  add column if not exists payment_percent integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_requests_payment_option_check'
  ) then
    alter table public.booking_requests
      add constraint booking_requests_payment_option_check
      check (
        payment_option in (
          'later',
          'deposit',
          'full'
        )
      );
  end if;
end $$;


-- =========================================================
-- SERVER TỰ CHỐT:
-- - tên thể loại
-- - gói
-- - giá
-- - số tiền cần chuyển
-- Không tin số tiền do trình duyệt gửi lên
-- =========================================================

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
  v_deposit_percent integer := 30;
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


  select greatest(
    30,
    least(
      100,
      coalesce(deposit_percent, 30)
    )
  )
  into v_deposit_percent
  from public.booking_payment_settings
  where id = 'main';

  if v_deposit_percent is null then
    v_deposit_percent := 30;
  end if;


  new.service := v_service_name;
  new.service_name := v_service_name;

  new.package_name := v_package_name;
  new.package_price := v_package_price;

  -- giữ tương thích dữ liệu cũ
  new.service_price := v_package_price;


  if new.payment_option = 'deposit' then

    new.payment_requested := true;
    new.payment_method := 'bank_transfer';

    new.payment_percent := v_deposit_percent;

    new.payment_amount :=
      ceil(
        v_package_price::numeric
        * v_deposit_percent
        / 100
      )::bigint;

  elsif new.payment_option = 'full' then

    new.payment_requested := true;
    new.payment_method := 'bank_transfer';

    new.payment_percent := 100;
    new.payment_amount := v_package_price;

  else

    new.payment_option := 'later';
    new.payment_requested := false;
    new.payment_method := 'later';

    new.payment_percent := 0;
    new.payment_amount := 0;

  end if;


  new.status := 'new';
  new.transferred := false;
  new.transferred_at := null;

  return new;
end;
$$;


-- Public cần đọc thông tin tài khoản để hiển thị sau khi khách chọn CK
drop policy if exists "public read payment settings"
on public.booking_payment_settings;

create policy "public read payment settings"
on public.booking_payment_settings
for select
to anon, authenticated
using (true);
