alter table public.booking_requests
  drop column if exists google_event_id,
  drop column if exists google_calendar_synced_at;
