create table if not exists public.customer_product_images (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null
    references public.customer_product_albums(id)
    on delete cascade,

  image_url text not null,
  caption text not null default '',
  position integer not null default 0,
  visible boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_product_images_album_id_idx
  on public.customer_product_images(album_id);

create index if not exists customer_product_images_position_idx
  on public.customer_product_images(album_id, position);

alter table public.customer_product_images enable row level security;

drop policy if exists "public read visible customer images"
on public.customer_product_images;

create policy "public read visible customer images"
on public.customer_product_images
for select
using (
  visible = true
  and exists (
    select 1
    from public.customer_product_albums a
    where a.id = customer_product_images.album_id
      and a.is_public = true
  )
);

drop policy if exists "admin manage customer images"
on public.customer_product_images;

create policy "admin manage customer images"
on public.customer_product_images
for all
to authenticated
using (public.is_gallery_admin())
with check (public.is_gallery_admin());

grant select on public.customer_product_images to anon, authenticated;
grant insert, update, delete on public.customer_product_images to authenticated;
