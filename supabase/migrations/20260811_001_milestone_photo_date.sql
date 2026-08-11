-- Milestone photos: user-chosen photo date
--
-- Until now the date printed on an album page came from EXIF, and when the
-- phone stripped it, from `created_at` — i.e. whenever the file happened to be
-- uploaded. Two photos uploaded in one sitting therefore carried the same
-- (wrong) date. The album is printed, so the parent needs to set the real date.
--
-- Nullable and NOT backfilled on purpose: existing rows keep their current
-- behaviour (EXIF → created_at) until someone picks a date explicitly.

alter table public.milestone_photos
  add column if not exists photo_date date;

comment on column public.milestone_photos.photo_date is
  'User-chosen date for this milestone photo. Wins over EXIF and created_at when rendering/exporting the album. NULL = fall back to EXIF, then created_at.';
