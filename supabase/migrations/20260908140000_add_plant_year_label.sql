-- Free-text planting year for olive plots.
--
-- areas.planting_time is a DATE (added in 20260308100000). The olive spec §5.1
-- is explicit that the planting year is free text in practice, because the
-- client's real data contains values a date cannot hold:
--
--   '2006/7'   July 2006 — a year and a month, in the grower's notation
--   '2003'     a year with no month or day
--
-- Casting those to a DATE invents the parts that were never recorded: '2003'
-- has no month or day at all, and a naive read of '2006/7' as a season label
-- puts it on 1 January, six months from where the file says it belongs.
-- (parsePlantingDate() in lib/olive/import-backup.ts is what reads them now.)
--
-- So the DATE column stays authoritative for anything doing date arithmetic,
-- and this column carries the label the grower actually uses. The UI prefers
-- the label when present and falls back to planting_time.

ALTER TABLE olive_plot_details
  ADD COLUMN IF NOT EXISTS plant_year_label TEXT;

COMMENT ON COLUMN olive_plot_details.plant_year_label IS
  'Planting year as the grower writes it, e.g. "2006/7". Falls back to areas.planting_time when null.';
