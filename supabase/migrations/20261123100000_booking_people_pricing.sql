-- Per-person pricing belongs to the service category; fixed-price services are unchanged.
alter table public.booking_service_types
  add column if not exists collect_people boolean not null default false,
  add column if not exists people_price_tiers jsonb not null default '[]'::jsonb;

alter table public.booking_requests
  add column if not exists people_count integer check (people_count > 0),
  add column if not exists unit_price bigint check (unit_price > 0);

create or replace function public.valid_booking_people_tiers(tiers jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  tier jsonb;
  lower_bound numeric;
  upper_bound numeric;
  unit_amount numeric;
  previous_max numeric := 0;
begin
  if jsonb_typeof(tiers) is distinct from 'array' or jsonb_array_length(tiers) = 0 then
    return false;
  end if;
  for tier in select value from jsonb_array_elements(tiers) order by (value->>'min')::numeric loop
    if jsonb_typeof(tier->'min') is distinct from 'number'
       or jsonb_typeof(tier->'price') is distinct from 'number'
       or not (tier ? 'max')
       or jsonb_typeof(tier->'max') not in ('number', 'null') then
      return false;
    end if;
    lower_bound := (tier->>'min')::numeric;
    upper_bound := (tier->>'max')::numeric;
    unit_amount := (tier->>'price')::numeric;
    if lower_bound <> trunc(lower_bound) or lower_bound < 1 or lower_bound > 2147483647
       or (upper_bound is not null and (upper_bound <> trunc(upper_bound) or upper_bound < lower_bound or upper_bound > 2147483647))
       or unit_amount <> trunc(unit_amount) or unit_amount < 1 or unit_amount > 1000000000
       or previous_max is null or lower_bound <= previous_max then
      return false;
    end if;
    previous_max := upper_bound;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

alter table public.booking_service_types
  add constraint booking_people_tiers_valid check (
    jsonb_typeof(people_price_tiers) = 'array'
    and (not collect_people or public.valid_booking_people_tiers(people_price_tiers))
  );

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
    s.people_price_tiers
  into
    v_service_name,
    v_package_name,
    v_package_price,
    v_collect_people,
    v_people_tiers
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
