-- Multi-image support for events.
--
-- Today every event row has exactly one `image_url` + `image_alt`. The create
-- wizard's Media step grew a drag/drop/paste-multiple uploader that captures
-- additional photos beyond the cover. This migration adds an array column to
-- carry them through; `image_url` continues to hold the cover (and is the
-- first item in `image_urls` when present) so existing readers don't break.
--
-- No backfill — pre-existing rows can keep image_urls null and the readers
-- fall back to image_url. New inserts via createEventForMerchant() write
-- both fields for consistency.

begin;

alter table events
  add column if not exists image_urls text[];

comment on column events.image_urls is
  'All event photos in display order; image_urls[1] mirrors image_url. Null on legacy rows — readers should fall back to image_url.';

commit;
