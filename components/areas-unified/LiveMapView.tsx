'use client';

import { useState, useEffect, useCallback } from 'react';
import { showToast } from '@/lib/toast';
import { Loader2 } from 'lucide-react';
import { InteractiveMap } from '@/components/map/InteractiveMap';
import type { AreaWithGeometry, DrawingState, GeoJSONPolygon } from './types';

interface LiveMapViewProps {
  selectedEntityId?: string | null;
  fitToEntityId?: string | null;
  onEntitySelect?: (entityId: string, entityType: 'area' | 'sub_area') => void;
}

export function LiveMapView({
  selectedEntityId: externalSelectedId,
  fitToEntityId: externalFitId,
  onEntitySelect: externalOnSelect,
}: LiveMapViewProps = {}) {
  const [areas, setAreas] = useState<AreaWithGeometry[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [initialFitId, setInitialFitId] = useState<string | null>(null);

  const selectedEntityId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;
  const fitToEntityId = externalFitId ?? initialFitId;

  const viewOnlyDrawing: DrawingState = { mode: 'view' };

  const fetchAreas = useCallback(async () => {
    try {
      const res = await fetch('/api/map/areas');
      if (!res.ok) throw new Error('Failed to fetch areas');
      const data = await res.json();
      setAreas(data.areas || []);
      // Auto-fit to all areas on initial load
      setInitialFitId('__all__');
      setTimeout(() => setInitialFitId(null), 500);
    } catch (error: any) {
      showToast.error('שגיאה בטעינת שטחים');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const handleEntitySelect = useCallback(
    (entityId: string, entityType: 'area' | 'sub_area') => {
      if (externalOnSelect) {
        externalOnSelect(entityId, entityType);
      } else {
        setInternalSelectedId(entityId);
      }
    },
    [externalOnSelect]
  );

  // No-ops for view-only mode
  const noop = useCallback(() => {}, []);
  const noopGeometry = useCallback(
    (_id: string, _type: 'area' | 'sub_area', _g: GeoJSONPolygon) => {},
    []
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mr-2 text-muted-foreground">טוען מפה...</span>
      </div>
    );
  }

  return (
    <div className="h-full rounded-lg overflow-hidden border relative z-0">
      <InteractiveMap
        areas={areas}
        drawingState={viewOnlyDrawing}
        selectedEntityId={selectedEntityId}
        onPolygonCreated={noop as any}
        onPolygonEdited={noopGeometry}
        onEntitySelect={handleEntitySelect}
        fitToEntityId={fitToEntityId}
      />
    </div>
  );
}
