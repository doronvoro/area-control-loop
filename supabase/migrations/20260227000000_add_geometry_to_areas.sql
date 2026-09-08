-- Add geometry (GeoJSON Polygon) support to areas and sub-areas.
--
-- Stored as jsonb holding a bare GeoJSON geometry object, e.g.
--   {"type":"Polygon","coordinates":[[[35.2130,31.7690], ... ,[35.2130,31.7690]]]}
--
-- Outdoor areas use WGS84 [lng, lat] pairs and are rendered by
-- components/map/LeafletMap.tsx via L.geoJSON(). Indoor areas reuse the same
-- shape but the numbers are metres in a local L.CRS.Simple canvas space
-- (components/indoor-designer/canvas/IndoorCanvas.tsx).
--
-- Deliberately NOT PostGIS: the extension is not installed and the app reads
-- and writes plain GeoJSON via supabase-js.

ALTER TABLE public.areas     ADD COLUMN IF NOT EXISTS geometry jsonb;
ALTER TABLE public.sub_areas ADD COLUMN IF NOT EXISTS geometry jsonb;

COMMENT ON COLUMN public.areas.geometry IS
  'GeoJSON Polygon. Outdoor: WGS84 [lng, lat], closed ring. Indoor: metres in local canvas space.';
COMMENT ON COLUMN public.sub_areas.geometry IS
  'GeoJSON Polygon nested within the parent area geometry. Same coordinate rules as areas.geometry.';
