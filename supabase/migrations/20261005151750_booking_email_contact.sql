alter table public.booking_payment_settings
  add column if not exists admin_notification_email text not null default '',
  add column if not exists admin_contact_phone text not null default '',
  add column if not exists admin_contact_email text not null default '',
  add column if not exists admin_contact_zalo_url text not null default '',
  add column if not exists admin_contact_facebook_url text not null default '';

alter table public.booking_requests
  add column if not exists admin_notified_at timestamptz,
  add column if not exists customer_confirmed_email_at timestamptz,
  add column if not exists confirmed_at timestamptz;

update public.booking_payment_settings
set transfer_content = 'Booking-{NAME}-{PHONE}'
where id = 'main';
