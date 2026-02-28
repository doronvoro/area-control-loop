-- Add area_type column to distinguish indoor vs outdoor areas
ALTER TABLE areas ADD COLUMN area_type TEXT DEFAULT 'outdoor' CHECK (area_type IN ('outdoor', 'indoor'));

CREATE INDEX idx_areas_area_type ON areas(area_type);
