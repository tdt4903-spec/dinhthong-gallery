-- Guests may select photos unless an admin turns it off for the album.
alter table public.folder_settings
  add column if not exists allow_photo_selection boolean not null default true;

-- Each automatic viewer reset (album reached the viewer threshold) is logged
-- so admins can see how many times and when it happened.
create table if not exists public.gallery_viewer_reset_log (
  id bigint generated always as identity primary key,
  album_id text not null,
  deleted_count integer not null check (deleted_count >= 0),
  threshold integer not null check (threshold > 0),
  created_at timestamptz not null default now()
);

create index if not exists gallery_viewer_reset_log_album_created_idx
  on public.gallery_viewer_reset_log (album_id, created_at desc);

-- Only the server (service role) writes and reads this log.
alter table public.gallery_viewer_reset_log enable row level security;

-- Viewer registration reads every visitor row of one album.
create index if not exists gallery_album_visitors_album_id_idx
  on public.gallery_album_visitors (album_id);
