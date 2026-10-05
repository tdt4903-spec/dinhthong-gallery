alter table public.booking_requests
  add column if not exists google_event_id text,
  add column if not exists google_calendar_synced_at timestamptz;

create index if not exists booking_google_event_id_idx
on public.booking_requests(google_event_id);
