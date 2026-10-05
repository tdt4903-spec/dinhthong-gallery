-- Nội dung CK chuẩn
update public.booking_payment_settings
set transfer_content = 'Booking-{NAME}-{PHONE}'
where id = 'main';


-- Trigger mới:
-- vừa chốt gói/giá vừa kiểm tra trường bắt buộc
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

  -- =====================================================
  -- VALIDATE THÔNG TIN BẮT BUỘC
  -- =====================================================

  if nullif(trim(new.full_name), '') is null then
    raise exception 'Vui lòng nhập họ tên.';
  end if;

  if nullif(trim(new.phone), '') is null then
    raise exception 'Vui lòng nhập số điện thoại.';
  end if;

  if nullif(trim(new.zalo), '') is null then
    raise exception 'Vui lòng nhập Zalo.';
  end if;

  if new.event_date is null then
    raise exception 'Vui lòng chọn ngày chụp dự kiến.';
  end if;

  if nullif(trim(new.location), '') is null then
    raise exception 'Vui lòng nhập địa điểm chụp.';
  end if;


  -- =====================================================
  -- LẤY GÓI + GIÁ TỪ DATABASE
  -- =====================================================

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


  -- =====================================================
  -- TỶ LỆ CỌC
  -- =====================================================

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


  -- =====================================================
  -- SNAPSHOT
  -- =====================================================

  new.service := v_service_name;
  new.service_name := v_service_name;

  new.package_name := v_package_name;
  new.package_price := v_package_price;

  new.service_price := v_package_price;


  -- =====================================================
  -- THANH TOÁN
  -- =====================================================

  if new.payment_option = 'deposit' then

    new.payment_requested := true;
    new.payment_method := 'bank_transfer';

    new.payment_percent :=
      v_deposit_percent;

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
    new.payment_amount :=
      v_package_price;

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
