alter table public.booking_service_types
  add column if not exists collect_sessions boolean not null default false,
  add column if not exists session_percentages jsonb not null default '[]'::jsonb;

alter table public.booking_requests
  add column if not exists session_count integer not null default 1 check (session_count > 0),
  add column if not exists session_percent integer not null default 100 check (session_percent >= 100),
  add column if not exists base_price bigint;

create or replace function public.valid_booking_session_percentages(percentages jsonb)
returns boolean language plpgsql immutable set search_path = public
as $$
declare
  item jsonb;
  amount numeric;
begin
  if jsonb_typeof(percentages) is distinct from 'array' then return false; end if;
  for item in select value from jsonb_array_elements(percentages) loop
    if jsonb_typeof(item) is distinct from 'number' then return false; end if;
    amount := item::text::numeric;
    if amount <> trunc(amount) or amount < 0 or amount > 10000 then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;

alter table public.booking_service_types
  add constraint booking_session_percentages_valid check (public.valid_booking_session_percentages(session_percentages));

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
  v_collect_people boolean;
  v_people_tiers jsonb;
  v_unit_price bigint;
  v_collect_sessions boolean;
  v_session_percentages jsonb;
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

  new.zalo := coalesce(trim(new.zalo), '');

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
    p.price,
    s.collect_people,
    s.people_price_tiers,
    s.collect_sessions,
    s.session_percentages
  into
    v_service_name,
    v_package_name,
    v_package_price,
    v_collect_people,
    v_people_tiers,
    v_collect_sessions,
    v_session_percentages
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


  if v_collect_people then
    if new.people_count is null or new.people_count < 1 then
      raise exception 'Vui lòng nhập số người tham gia chụp.';
    end if;
    select (tier->>'price')::bigint into v_unit_price
    from jsonb_array_elements(v_people_tiers) tier
    where new.people_count >= (tier->>'min')::integer
      and ((tier->>'max') is null or new.people_count <= (tier->>'max')::integer);
    if not found then
      raise exception 'Số người chưa có trong bảng giá. Vui lòng liên hệ studio.';
    end if;
    v_package_price := new.people_count::bigint * v_unit_price;
    if v_package_price > 9007199254740991 then
      raise exception 'Tổng tiền vượt giới hạn cho phép.';
    end if;
    new.unit_price := v_unit_price;
  else
    new.people_count := null;
    new.unit_price := null;
  end if;

  new.base_price := v_package_price;
  new.session_percent := 100;
  if v_collect_sessions then
    if new.session_count is null or new.session_count < 1
       or new.session_count > jsonb_array_length(v_session_percentages) + 1 then
      raise exception 'Vui lòng chọn số buổi đã được cấu hình.';
    end if;
    select 100 + coalesce(sum(value::text::integer), 0)
    into new.session_percent
    from jsonb_array_elements(v_session_percentages) with ordinality
    where ordinality < new.session_count;
  else
    if coalesce(new.session_count, 1) <> 1 then
      raise exception 'Thể loại này chỉ nhận một buổi chụp.';
    end if;
    new.session_count := 1;
  end if;
  v_package_price := ceil(new.base_price::numeric * new.session_percent / 100)::bigint;
  if v_package_price > 9007199254740991 then
    raise exception 'Tổng tiền vượt giới hạn cho phép.';
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
