import type { LatLngExpression } from 'leaflet';

// GeoJSON Polygon as stored in the database
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // [[[lng, lat], ...]]
}

// Area with geometry for the map view
export interface AreaWithGeometry {
  id: string;
  name: string;
  description: string | null;
  geometry: GeoJSONPolygon | null;
  pending_monitoring: number;
  sub_areas: SubAreaWithGeometry[];
}

// Treatment data for map popup
export interface TreatmentForMap {
  id: string;
  action_type_name: string | null;
  material_name: string | null;
  dosage: number | null;
  unit_type_name: string | null;
  status: string;
  notes: string | null;
}

// Monitoring report data for map popup
export interface MonitoringReportForMap {
  id: string;
  finding_name: string;
  severity: string | null;
  status: string;
  created_at: string;
  treatments: TreatmentForMap[];
}

// Sub-area with geometry for the map view
export interface SubAreaWithGeometry {
  id: string;
  area_id: string;
  name: string;
  display: string | null;
  variety: string | null;
  level: number;
  geometry: GeoJSONPolygon | null;
  pending_monitoring: number;
  monitoring_reports: MonitoringReportForMap[];
}

// Severity display config
export const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'נמוכה', color: '#16a34a' },
  medium: { label: 'בינונית', color: '#d97706' },
  high: { label: 'גבוהה', color: '#ea580c' },
  critical: { label: 'קריטית', color: '#dc2626' },
};

// State for the drawing/editing mode.
// 'redraw' replaces an existing polygon: the old boundary stays on screen as a
// ghost for reference and is only overwritten once the new one is completed,
// so cancelling leaves the saved boundary untouched.
export interface DrawingState {
  mode: 'view' | 'draw' | 'edit' | 'redraw';
  targetAreaId?: string; // When drawing a sub-area, which area it belongs to
  targetEntityId?: string; // When editing existing polygon
  targetEntityType?: 'area' | 'sub_area';
}

// Map default configuration (Israel center)
export const DEFAULT_CENTER: LatLngExpression = [31.7683, 35.2137];
export const DEFAULT_ZOOM = 8;

// How far the user may zoom in. Past the native zoom of each tile source
// Leaflet upscales the last available tile instead of requesting one, so keep
// this close to the native cap — further in the imagery is just blur.
export const MAX_ZOOM = 20;
// Esri World Imagery only has z19 tiles over cities; outside them (where most
// of our plots are) coverage stops at z18 and the server returns a
// "Map data not yet available" placeholder tile instead of imagery.
export const SATELLITE_MAX_NATIVE_ZOOM = 18;
export const OSM_MAX_NATIVE_ZOOM = 19;

// Polygon styling
export const AREA_STYLE = {
  color: '#2563eb',
  fillColor: '#3b82f6',
  fillOpacity: 0.15,
  weight: 2,
};

export const SUB_AREA_STYLE = {
  color: '#16a34a',
  fillColor: '#22c55e',
  fillOpacity: 0.2,
  weight: 2,
  dashArray: '5, 5',
};

export const AREA_PENDING_STYLE = {
  color: '#dc2626',
  fillColor: '#ef4444',
  fillOpacity: 0.2,
  weight: 2,
};

export const SUB_AREA_PENDING_STYLE = {
  color: '#dc2626',
  fillColor: '#ef4444',
  fillOpacity: 0.25,
  weight: 2,
  dashArray: '5, 5',
};

export const SELECTED_STYLE = {
  color: '#f59e0b',
  weight: 3,
};

// The boundary being replaced during 'redraw' — muted so the new polygon reads
// as the live one, but still visible so the user can see what they are replacing.
export const GHOST_STYLE = {
  color: '#94a3b8',
  fillColor: '#94a3b8',
  fillOpacity: 0.08,
  weight: 1,
  dashArray: '4, 6',
};
