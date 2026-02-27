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
}

// State for the drawing/editing mode
export interface DrawingState {
  mode: 'view' | 'draw' | 'edit';
  targetAreaId?: string; // When drawing a sub-area, which area it belongs to
  targetEntityId?: string; // When editing existing polygon
  targetEntityType?: 'area' | 'sub_area';
}

// Map default configuration (Israel center)
export const DEFAULT_CENTER: LatLngExpression = [31.7683, 35.2137];
export const DEFAULT_ZOOM = 8;

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
