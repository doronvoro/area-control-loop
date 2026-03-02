'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { InteractiveMap } from '@/components/map/InteractiveMap';
import type { AreaWithGeometry, DrawingState, GeoJSONPolygon } from './types';

export function LiveMapView() {
  const [areas, setAreas] = useState<AreaWithGeometry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const viewOnlyDrawing: DrawingState = { mode: 'view' };

  const fetchAreas = useCallback(async () => {
    try {
      const res = await fetch('/api/map/areas');
      if (!res.ok) throw new Error('Failed to fetch areas');
      const data = await res.json();
      setAreas(data.areas || []);
    } catch (error: any) {
      toast.error('שגיאה בטעינת שטחים');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const handleEntitySelect = useCallback(
    (entityId: string, _entityType: 'area' | 'sub_area') => {
      setSelectedEntityId(entityId);
    },
    []
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
        fitToEntityId={null}
      />
    </div>
  );
}
