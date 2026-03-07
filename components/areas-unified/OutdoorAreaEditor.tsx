'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { showToast } from '@/lib/toast';
import { MapPin, Pencil, Plus, Trash2, X, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { InteractiveMap } from '@/components/map/InteractiveMap';
import type {
  AreaWithGeometry,
  SubAreaWithGeometry,
  DrawingState,
  GeoJSONPolygon,
  SubArea,
  Permissions,
  AreaWithType,
} from './types';

interface OutdoorAreaEditorProps {
  area: AreaWithType;
  subAreas: SubArea[];
  permissions: Permissions;
  selectedSubAreaId?: string;
  onRefresh: () => void;
}

export function OutdoorAreaEditor({
  area,
  subAreas,
  permissions,
  selectedSubAreaId,
  onRefresh,
}: OutdoorAreaEditorProps) {
  const [mapAreas, setMapAreas] = useState<AreaWithGeometry[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    mode: 'view',
  });
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(
    selectedSubAreaId || area.id
  );
  const [fitToEntityId, setFitToEntityId] = useState<string | null>(null);

  // Fetch map data for this specific area
  const fetchMapData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/map/areas');
      if (!res.ok) throw new Error('Failed to fetch areas');
      const data = await res.json();
      // Filter to just this area
      const filtered = (data.areas || []).filter(
        (a: AreaWithGeometry) => a.id === area.id
      );
      setMapAreas(filtered);

      // Fit to entity after data loads — fall back to area if sub-area has no geometry
      let targetId = selectedSubAreaId || area.id;
      if (selectedSubAreaId && filtered.length > 0) {
        const subArea = filtered[0].sub_areas?.find(
          (sa: SubAreaWithGeometry) => sa.id === selectedSubAreaId
        );
        if (!subArea?.geometry) {
          targetId = area.id;
        }
      }
      setFitToEntityId(targetId);
      setTimeout(() => setFitToEntityId(null), 500);
    } catch (error: any) {
      showToast.error('שגיאה בטעינת נתוני מפה');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [area.id, selectedSubAreaId]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

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

      showToast.success('גבולות נשמרו בהצלחה');
      await fetchMapData();
      onRefresh();
    } catch (error: any) {
      showToast.error(error.message || 'שגיאה בשמירת גבולות');
      console.error(error);
    }
  };

  const handlePolygonCreated = useCallback(
    (geometry: GeoJSONPolygon) => {
      if (drawingState.targetEntityId && drawingState.targetEntityType) {
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

  // Store pending geometry edits — user can drag multiple vertices before saving
  const pendingEditRef = useRef<{
    entityId: string;
    entityType: 'area' | 'sub_area';
    geometry: GeoJSONPolygon;
  } | null>(null);

  const handlePolygonEdited = useCallback(
    (
      entityId: string,
      entityType: 'area' | 'sub_area',
      geometry: GeoJSONPolygon
    ) => {
      // Don't save immediately — accumulate changes until user clicks Save
      pendingEditRef.current = { entityId, entityType, geometry };
    },
    []
  );

  const handleSaveEdit = useCallback(async () => {
    const edit = pendingEditRef.current;
    if (edit) {
      await saveGeometry(edit.entityId, edit.entityType, edit.geometry);
      pendingEditRef.current = null;
    }
    setDrawingState({ mode: 'view' });
  }, []);

  const handleCancelEdit = useCallback(() => {
    pendingEditRef.current = null;
    setDrawingState({ mode: 'view' });
    // Re-fetch to revert any visual changes on the map
    fetchMapData();
  }, [fetchMapData]);

  const handleEntitySelect = useCallback(
    (entityId: string, _entityType: 'area' | 'sub_area') => {
      setSelectedEntityId(entityId);
    },
    []
  );

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
  };

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
  };

  const handleDeleteGeometry = (
    entityId: string,
    entityType: 'area' | 'sub_area'
  ) => {
    saveGeometry(entityId, entityType, null);
  };

  const isDrawing =
    drawingState.mode === 'draw' || drawingState.mode === 'edit';

  const mapArea = mapAreas[0];
  const hasGeometry = !!mapArea?.geometry;
  const mapSubAreas: SubAreaWithGeometry[] = mapArea?.sub_areas || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full border rounded-lg bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      {/* Header with area name + geometry controls */}
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin
            className={cn(
              'h-4 w-4',
              hasGeometry ? 'text-blue-500' : 'text-muted-foreground/40'
            )}
          />
          <span className="font-semibold text-sm">{area.name}</span>
        </div>

        <div className="flex items-center gap-1">
          {isDrawing ? (
            <>
              <span className="text-xs text-muted-foreground me-2">
                {drawingState.mode === 'draw'
                  ? 'לחץ על המפה כדי לצייר מצולע'
                  : 'גרור נקודות כדי לערוך'}
              </span>
              {drawingState.mode === 'edit' ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-3 w-3" />
                    ביטול
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={handleSaveEdit}
                  >
                    <Save className="h-3 w-3" />
                    שמור
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setDrawingState({ mode: 'view' })}
                >
                  <X className="h-3 w-3" />
                  ביטול
                </Button>
              )}
            </>
          ) : (
            <>
              {hasGeometry ? (
                <>
                  {permissions.canUpdateArea && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleEditStart(area.id, 'area')}
                    >
                      <Pencil className="h-3 w-3" />
                      ערוך גבולות
                    </Button>
                  )}
                  {permissions.canDeleteArea && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-destructive"
                      onClick={() => handleDeleteGeometry(area.id, 'area')}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </>
              ) : (
                permissions.canUpdateArea && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleDrawStart('area', area.id)}
                  >
                    <Plus className="h-3 w-3" />
                    צייר גבולות
                  </Button>
                )
              )}
            </>
          )}
        </div>
      </div>

      {/* Map — z-0 creates stacking context so Leaflet z-indices don't overlap dialogs */}
      <div className="flex-1 relative z-0">
        <InteractiveMap
          areas={mapAreas}
          drawingState={drawingState}
          selectedEntityId={selectedEntityId}
          onPolygonCreated={handlePolygonCreated}
          onPolygonEdited={handlePolygonEdited}
          onEntitySelect={handleEntitySelect}
          fitToEntityId={fitToEntityId}
        />
      </div>

      {/* Sub-areas list at bottom */}
      {mapSubAreas.length > 0 && !isDrawing && (
        <div className="border-t max-h-[200px] overflow-y-auto p-2 space-y-0.5">
          <div className="text-xs text-muted-foreground px-2 py-1 font-medium">
            תתי-שטחים ({mapSubAreas.length})
          </div>
          {mapSubAreas.map((sa) => {
            const saSelected = selectedEntityId === sa.id;
            const saHasGeometry = !!sa.geometry;

            return (
              <div
                key={sa.id}
                className={cn(
                  'flex items-center gap-1.5 rounded px-2 py-1 text-xs cursor-pointer hover:bg-accent',
                  saSelected && 'bg-accent'
                )}
                style={{ paddingInlineStart: `${(sa.level + 1) * 12}px` }}
                onClick={() => {
                  setSelectedEntityId(sa.id);
                  if (saHasGeometry) {
                    setFitToEntityId(sa.id);
                    setTimeout(() => setFitToEntityId(null), 100);
                  }
                }}
              >
                <MapPin
                  className={cn(
                    'h-3 w-3 shrink-0',
                    saHasGeometry
                      ? 'text-green-500'
                      : 'text-muted-foreground/40'
                  )}
                />
                <span className="flex-1 truncate">
                  {sa.display || sa.name}
                </span>
                <div className="flex items-center gap-0.5">
                  {saHasGeometry ? (
                    <>
                      {permissions.canUpdateSubArea && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          title="ערוך גבולות"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditStart(sa.id, 'sub_area');
                          }}
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </Button>
                      )}
                      {permissions.canDeleteSubArea && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-destructive"
                          title="מחק גבולות"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGeometry(sa.id, 'sub_area');
                          }}
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </Button>
                      )}
                    </>
                  ) : (
                    permissions.canUpdateSubArea && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        title="צייר גבולות"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDrawStart('sub_area', sa.id);
                        }}
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </Button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
