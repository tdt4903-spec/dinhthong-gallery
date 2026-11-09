-- Key DinhThong SnapSelect Pro (app lọc ảnh macOS). Tách riêng khỏi panel_licenses (Key Panel).
-- Chỉ server (service role) đọc/ghi; quản trị viên xem qua popup /dashboardadmin?panel=snapselect.
create table if not exists public.snapselect_licenses (
  lid text primary key,
  customer text not null default '',
  email text not null default '',
  order_code text not null default '',
  plan text not null check (plan in ('monthly', 'yearly', 'lifetime')),
  seats integer not null check (seats between 1 and 100),
  features jsonb not null default '["pro"]'::jsonb,
  issued_at bigint not null,
  expires_at bigint,
  status text not null default 'active' check (status in ('active', 'revoked')),
  note text not null default '',
  activations jsonb not null default '[]'::jsonb,
  history jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists snapselect_licenses_email_idx on public.snapselect_licenses (lower(email));
create index if not exists snapselect_licenses_created_idx on public.snapselect_licenses (created_at desc);

alter table public.snapselect_licenses enable row level security;
revoke all on public.snapselect_licenses from anon, authenticated;
-- Không có policy cho anon/authenticated: chỉ service role (API route trên Vercel) truy cập được.
