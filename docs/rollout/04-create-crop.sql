-- Olive rollout — CREATE THE OLIVE CROP. Writes one row.
--
-- No migration creates this: the olive module gates on crop name rather than
-- customer id, so that a second olive grower later needs no code change.
-- OLIVE_CROP_NAME in lib/olive/constants.ts is 'זית' and must match exactly.
--
-- WHY NOT "ON CONFLICT (name) DO NOTHING"
-- crops.name has only a plain index (idx_crops_name, indisunique=false), not a
-- unique constraint, so ON CONFLICT (name) raises 42P10 "there is no unique or
-- exclusion constraint matching the ON CONFLICT specification". The insert-where-
-- not-exists below is the re-runnable form that actually works here.
--
-- WHY EXACTLY ONE ROW MATTERS
-- The importer reads the crop with .maybeSingle(). Two rows named 'זית' make
-- that return an error the script does not distinguish, and it then reports the
-- opposite problem: 'No crop named "זית"'. The assertion below refuses to leave
-- the table in that state.

BEGIN;

INSERT INTO public.crops (name, description)
SELECT 'זית', 'מטע זיתים'
WHERE NOT EXISTS (
  SELECT 1 FROM public.crops WHERE name = 'זית'
);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.crops WHERE name = 'זית';
  IF n <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 crop named זית, found % — resolve before importing', n;
  END IF;
  RAISE NOTICE 'crop זית present exactly once';
END $$;

COMMIT;


-- Then capture the id — the importer does not need it, but the verification
-- queries and the leak checks do:
--
-- select id, name, description, source from crops where name = 'זית';
