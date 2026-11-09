-- Key DinhThong SnapSelect Pro: key ngắn DTSP-XXXX-XXXX-XXXX và tạo key theo mã máy.
alter table public.snapselect_licenses add column if not exists machine_id text not null default '';
alter table public.snapselect_licenses add column if not exists short_key text;
create unique index if not exists snapselect_licenses_short_key_idx on public.snapselect_licenses (short_key) where short_key is not null;
create index if not exists snapselect_licenses_machine_idx on public.snapselect_licenses (machine_id) where machine_id <> '';
