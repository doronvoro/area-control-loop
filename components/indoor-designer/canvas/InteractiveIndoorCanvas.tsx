'use client';

import dynamic from 'next/dynamic';
import type { GeoJSONPolygon } from '@/components/map/types';
import type { GeneratedSubArea, IndoorDrawingState, SelectionContext } from '../types';

const IndoorCanvas = dynamic(
  () => import('./IndoorCanvas').then((mod) => mod.IndoorCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg border">
        <span className="text-muted-foreground">טוען קנבס...</span>
      </div>
    ),
  }
);

interface InteractiveIndoorCanvasProps {
  areaGeometry: GeoJSONPolygon | null;
  subAreas: GeneratedSubArea[];
  width: number;
  height: number;
  drawingState: IndoorDrawingState;
  selectedTempId: string | null;
  selectionContext?: SelectionContext;
  onPolygonCreated?: (geometry: GeoJSONPolygon) => void;
  onSubAreaEdited?: (tempId: string, geometry: GeoJSONPolygon) => void;
  onSubAreaSelect?: (tempId: string) => void;
  showLabels?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
  pendingMonitoringCounts?: Record<string, number>;
  monitoringReports?: Record<string, any[]>;
}

export function InteractiveIndoorCanvas(props: InteractiveIndoorCanvasProps) {
  return <IndoorCanvas {...props} />;
}
