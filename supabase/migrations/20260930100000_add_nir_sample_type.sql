-- What a NIR reading was taken from: the fruit in the grove, or the pomace
-- (גפת) coming out of the mill.
--
-- A pomace reading records the same measurements as a fruit one, plus the mill
-- settings that produced it: crushing type, decanter differential, monopump
-- speed and malaxation temperature. They are columns on nir_report rather than
-- a second detail table because the reading IS the same kind of row — one
-- report_areas header, one detail — and splitting it would fork every reader
-- (log, plot drawer, reports) for four nullable numbers.
--
-- DEFAULT 'fruit'
-- Every reading before this migration was a fruit reading, so the default
-- backfills the archive correctly and leaves the import path unchanged.
--
-- POMACE IS NOT A RIPENESS SIGNAL
-- Oil in pomace is what the mill failed to extract, not how ripe the fruit is.
-- Scoring it against parameter_rules would flag a plot as unripe on a good
-- extraction. Readers that classify a plot (latestNirByArea, the reports) look
-- at fruit readings only; the log shows both.
--
-- The mill columns carry no CHECK tying them to sample_type: switching a
-- reading from pomace back to fruit clears them in the form, and a stray value
-- on a fruit row is harmless — nothing reads it there.

ALTER TABLE nir_report
  ADD COLUMN IF NOT EXISTS sample_type TEXT NOT NULL DEFAULT 'fruit'
    CHECK (sample_type IN ('fruit', 'pomace')),
  ADD COLUMN IF NOT EXISTS crushing_type TEXT,
  ADD COLUMN IF NOT EXISTS decanter_differential NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS monopump_speed NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS malaxation_temp NUMERIC(5, 2);

COMMENT ON COLUMN nir_report.sample_type IS
  '''fruit'' (פרי) or ''pomace'' (גפת). Only fruit readings feed ripeness classification.';
COMMENT ON COLUMN nir_report.crushing_type IS 'Pomace only: the crusher used (סוג ריסוק).';
COMMENT ON COLUMN nir_report.decanter_differential IS 'Pomace only: decanter differential (דיפרנציאל דקנטר).';
COMMENT ON COLUMN nir_report.monopump_speed IS 'Pomace only: monopump speed (מהירות מונופאמפ).';
COMMENT ON COLUMN nir_report.malaxation_temp IS 'Pomace only: malaxation temperature in °C (טמפרטורת ערבול).';
