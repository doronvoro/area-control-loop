'use client';

import dynamic from 'next/dynamic';
import type {
  AreaWithGeometry,
  DrawingState,
  GeoJSONPolygon,
} from './types';

const LeafletMap = dynamic(
  () => import('./LeafletMap').then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg">
        <span className="text-muted-foreground">טוען מפה...</span>
      </div>
    ),
  }
);

interface InteractiveMapProps {
  areas: AreaWithGeometry[];
  drawingState: DrawingState;
  selectedEntityId: string | null;
  onPolygonCreated: (geometry: GeoJSONPolygon) => void;
  onPolygonEdited: (entityId: string, entityType: 'area' | 'sub_area', geometry: GeoJSONPolygon) => void;
  onEntitySelect: (entityId: string, entityType: 'area' | 'sub_area') => void;
  fitToEntityId?: string | null;
}

export function InteractiveMap(props: InteractiveMapProps) {
  return <LeafletMap {...props} />;
}
