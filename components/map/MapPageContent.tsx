'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { InteractiveMap } from './InteractiveMap';
import { MapSidebar } from './MapSidebar';
import type {
  AreaWithGeometry,
  DrawingState,
  GeoJSONPolygon,
} from './types';

export function MapPageContent() {
  const [areas, setAreas] = useState<AreaWithGeometry[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    mode: 'view',
  });
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<
    'area' | 'sub_area' | null
  >(null);
  const [fitToEntityId, setFitToEntityId] = useState<string | null>(null);

  // Fetch areas with geometry
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

  // Save geometry to API
  const saveGeometry = async (
    entityId: string,
    entityType: 'area' | 'sub_area',
    geometry: GeoJSONPolygon | null
  ) => {
    try {
      const res = await fetch('/api/map/geometry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          geometry,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save geometry');
      }

      toast.success('גבולות נשמרו בהצלחה');
      await fetchAreas();
    } catch (error: any) {
      toast.error(error.message || 'שגיאה בשמירת גבולות');
      console.error(error);
    }
  };

  // Handle polygon created (from drawing on map)
  const handlePolygonCreated = useCallback(
    (geometry: GeoJSONPolygon) => {
      if (
        drawingState.targetEntityId &&
        drawingState.targetEntityType
      ) {
        saveGeometry(
          drawingState.targetEntityId,
          drawingState.targetEntityType,
          geometry
        );
      }
      setDrawingState({ mode: 'view' });
    },
    [drawingState]
  );

  // Handle polygon edited
  const handlePolygonEdited = useCallback(
    (
      entityId: string,
      entityType: 'area' | 'sub_area',
      geometry: GeoJSONPolygon
    ) => {
      saveGeometry(entityId, entityType, geometry);
      setDrawingState({ mode: 'view' });
    },
    []
  );

  // Handle entity selection
  const handleEntitySelect = useCallback(
    (entityId: string, entityType: 'area' | 'sub_area') => {
      setSelectedEntityId(entityId);
      setSelectedEntityType(entityType);
    },
    []
  );

  // Start drawing for an entity
  const handleDrawStart = (
    entityType: 'area' | 'sub_area',
    entityId: string
  ) => {
    setDrawingState({
      mode: 'draw',
      targetEntityId: entityId,
      targetEntityType: entityType,
    });
    setSelectedEntityId(entityId);
    setSelectedEntityType(entityType);
  };

  // Start editing an entity's polygon
  const handleEditStart = (
    entityId: string,
    entityType: 'area' | 'sub_area'
  ) => {
    setDrawingState({
      mode: 'edit',
      targetEntityId: entityId,
      targetEntityType: entityType,
    });
    setSelectedEntityId(entityId);
    setSelectedEntityType(entityType);
  };

  // Delete geometry
  const handleDeleteGeometry = (
    entityId: string,
    entityType: 'area' | 'sub_area'
  ) => {
    saveGeometry(entityId, entityType, null);
  };

  // Cancel drawing/editing
  const handleCancelDraw = () => {
    setDrawingState({ mode: 'view' });
  };

  // Fit map to entity
  const handleFitToEntity = (entityId: string) => {
    setFitToEntityId(entityId);
    // Reset after a short delay so it can trigger again for the same entity
    setTimeout(() => setFitToEntityId(null), 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <span className="text-muted-foreground">טוען מפה...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-200px)]">
      {/* Map */}
      <div className="flex-1 h-full min-h-[400px]">
        <InteractiveMap
          areas={areas}
          drawingState={drawingState}
          selectedEntityId={selectedEntityId}
          onPolygonCreated={handlePolygonCreated}
          onPolygonEdited={handlePolygonEdited}
          onEntitySelect={handleEntitySelect}
          fitToEntityId={fitToEntityId}
        />
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-72 h-[300px] lg:h-full">
        <MapSidebar
          areas={areas}
          selectedEntityId={selectedEntityId}
          drawingState={drawingState}
          onEntitySelect={handleEntitySelect}
          onDrawStart={handleDrawStart}
          onEditStart={handleEditStart}
          onDeleteGeometry={handleDeleteGeometry}
          onCancelDraw={handleCancelDraw}
          onFitToEntity={handleFitToEntity}
        />
      </div>
    </div>
  );
}
