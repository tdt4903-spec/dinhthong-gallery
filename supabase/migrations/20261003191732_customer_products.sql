create extension if not exists pgcrypto;

-- ============================================================
-- DANH MỤC SẢN PHẨM KHÁCH HÀNG
-- ============================================================

create table if not exists public.customer_product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  position integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ALBUM PUBLIC
-- ============================================================

create table if not exists public.customer_product_albums (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  slug text not null unique,

  category_id uuid
    references public.customer_product_categories(id)
    on delete restrict,

  album_url text not null,
  cover_url text not null default '',
  description text not null default '',

  shoot_date date,
  is_public boolean not null default true,
  is_featured boolean not null default false,

  position integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_product_albums_category_idx
on public.customer_product_albums(category_id);

create index if not exists customer_product_albums_public_idx
on public.customer_product_albums(is_public);

create index if not exists customer_product_albums_position_idx
on public.customer_product_albums(position);

-- ============================================================
-- CHECK ADMIN DỰA TRÊN allowed_emails CÓ SẴN
-- ============================================================

create or replace function public.is_gallery_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_emails
    where lower(email) =
      lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_gallery_admin() from public;

grant execute on function public.is_gallery_admin()
to anon, authenticated;

-- ============================================================
-- RLS
-- ============================================================

alter table public.customer_product_categories enable row level security;
alter table public.customer_product_albums enable row level security;

drop policy if exists "customer categories public read"
on public.customer_product_categories;

create policy "customer categories public read"
on public.customer_product_categories
for select
using (
  visible = true
  or public.is_gallery_admin()
);

drop policy if exists "customer categories admin insert"
on public.customer_product_categories;

create policy "customer categories admin insert"
on public.customer_product_categories
for insert
to authenticated
with check (public.is_gallery_admin());

drop policy if exists "customer categories admin update"
on public.customer_product_categories;

create policy "customer categories admin update"
on public.customer_product_categories
for update
to authenticated
using (public.is_gallery_admin())
with check (public.is_gallery_admin());

drop policy if exists "customer categories admin delete"
on public.customer_product_categories;

create policy "customer categories admin delete"
on public.customer_product_categories
for delete
to authenticated
using (public.is_gallery_admin());


drop policy if exists "customer albums public read"
on public.customer_product_albums;

create policy "customer albums public read"
on public.customer_product_albums
for select
using (
  is_public = true
  or public.is_gallery_admin()
);

drop policy if exists "customer albums admin insert"
on public.customer_product_albums;

create policy "customer albums admin insert"
on public.customer_product_albums
for insert
to authenticated
with check (public.is_gallery_admin());

drop policy if exists "customer albums admin update"
on public.customer_product_albums;

create policy "customer albums admin update"
on public.customer_product_albums
for update
to authenticated
using (public.is_gallery_admin())
with check (public.is_gallery_admin());

drop policy if exists "customer albums admin delete"
on public.customer_product_albums;

create policy "customer albums admin delete"
on public.customer_product_albums
for delete
to authenticated
using (public.is_gallery_admin());

-- ============================================================
-- GRANTS
-- ============================================================

grant select on public.customer_product_categories to anon, authenticated;
grant select on public.customer_product_albums to anon, authenticated;

grant insert, update, delete
on public.customer_product_categories
to authenticated;

grant insert, update, delete
on public.customer_product_albums
to authenticated;

-- ============================================================
-- DANH MỤC MẶC ĐỊNH
-- ============================================================

insert into public.customer_product_categories
(name, slug, position)
values
  ('Ảnh cưới', 'anh-cuoi', 10),
  ('Couple', 'couple', 20),
  ('Kỷ yếu', 'ky-yeu', 30),
  ('Cá nhân', 'ca-nhan', 40),
  ('Gia đình', 'gia-dinh', 50)
on conflict (slug) do nothing;
