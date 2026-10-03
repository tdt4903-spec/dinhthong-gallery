create table if not exists public.customer_product_public_files (
  id uuid primary key default gen_random_uuid(),

  album_id uuid not null
    references public.customer_product_albums(id)
    on delete cascade,

  drive_file_id text not null,
  position integer not null default 0,

  created_at timestamptz not null default now(),

  unique(album_id, drive_file_id)
);

create index if not exists customer_product_public_files_album_idx
on public.customer_product_public_files(album_id, position);

alter table public.customer_product_public_files enable row level security;

drop policy if exists "public read published album files"
on public.customer_product_public_files;

create policy "public read published album files"
on public.customer_product_public_files
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.customer_product_albums a
    where a.id = customer_product_public_files.album_id
      and a.is_public = true
  )
);

drop policy if exists "gallery admin insert public files"
on public.customer_product_public_files;

create policy "gallery admin insert public files"
on public.customer_product_public_files
for insert
to authenticated
with check (
  exists (
    select 1
    from public.allowed_emails ae
    where lower(ae.email) =
      lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "gallery admin delete public files"
on public.customer_product_public_files;

create policy "gallery admin delete public files"
on public.customer_product_public_files
for delete
to authenticated
using (
  exists (
    select 1
    from public.allowed_emails ae
    where lower(ae.email) =
      lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

grant select on public.customer_product_public_files
to anon, authenticated;

grant insert, delete on public.customer_product_public_files
to authenticated;
