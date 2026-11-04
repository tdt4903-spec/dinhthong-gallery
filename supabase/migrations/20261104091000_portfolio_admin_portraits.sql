create table public.portfolio_admin_portraits (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  photo_key uuid not null
);

alter table public.portfolio_admin_portraits enable row level security;
revoke all on public.portfolio_admin_portraits from public, anon, authenticated;
grant select, insert, update, delete on public.portfolio_admin_portraits to authenticated;

create policy "Approved admins manage their own portrait"
  on public.portfolio_admin_portraits for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_gallery_admin()))
  with check (user_id = (select auth.uid()) and (select public.is_gallery_admin()));

-- Only explicitly published portraits belonging to currently approved accounts are public.
create function public.get_portfolio_admin_portraits()
returns table(display_name text, photo_key uuid)
language sql stable security definer set search_path = ''
as $$
  select coalesce(nullif(trim(a.full_name), ''), 'Dinh Thong Photos'), p.photo_key
  from public.portfolio_admin_portraits p
  join auth.users u on u.id = p.user_id
  join public.allowed_emails a on lower(a.email) = lower(u.email)
  order by 1, p.user_id
$$;
revoke all on function public.get_portfolio_admin_portraits() from public;
grant execute on function public.get_portfolio_admin_portraits() to anon, authenticated;
