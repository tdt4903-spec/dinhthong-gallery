drop policy if exists "gallery admin read public files"
on public.customer_product_public_files;

create policy "gallery admin read public files"
on public.customer_product_public_files
for select
to authenticated
using (public.is_gallery_admin());
