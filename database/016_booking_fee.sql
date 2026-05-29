-- Booking fee % setting.
-- Per-booking service fee added on top of the ticket price at checkout,
-- stored in basis points (e.g. 500 bps = 5%). Editable from /admin/system.

begin;

insert into system_settings (key, value)
values ('booking_fee_bps', '0'::jsonb)
on conflict (key) do nothing;

commit;
