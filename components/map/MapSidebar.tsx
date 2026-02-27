'use client';

import { MapPin, Pencil, Trash2, Plus, ChevronDown, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AreaWithGeometry, DrawingState } from './types';

interface MapSidebarProps {
  areas: AreaWithGeometry[];
  selectedEntityId: string | null;
  drawingState: DrawingState;
  onEntitySelect: (entityId: string, entityType: 'area' | 'sub_area') => void;
  onDrawStart: (entityType: 'area' | 'sub_area', entityId: string) => void;
  onEditStart: (entityId: string, entityType: 'area' | 'sub_area') => void;
  onDeleteGeometry: (entityId: string, entityType: 'area' | 'sub_area') => void;
  onCancelDraw: () => void;
  onFitToEntity: (entityId: string) => void;
}

export function MapSidebar({
  areas,
  selectedEntityId,
  drawingState,
  onEntitySelect,
  onDrawStart,
  onEditStart,
  onDeleteGeometry,
  onCancelDraw,
  onFitToEntity,
}: MapSidebarProps) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());

  const toggleAreaExpand = (areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  };

  const isDrawing = drawingState.mode === 'draw' || drawingState.mode === 'edit';

  return (
    <div className="flex flex-col h-full bg-card border rounded-lg">
      {/* Header */}
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm">שטחים</h3>
        {isDrawing && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {drawingState.mode === 'draw'
                ? 'לחץ על המפה כדי לצייר מצולע'
                : 'גרור נקודות כדי לערוך'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelDraw}
              className="h-6 text-xs"
            >
              ביטול
            </Button>
          </div>
        )}
      </div>

      {/* Area list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {areas.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            אין שטחים
          </p>
        )}

        {areas.map((area) => {
          const isExpanded = expandedAreas.has(area.id);
          const isSelected = selectedEntityId === area.id;
          const hasGeometry = !!area.geometry;
          const hasSubAreas = area.sub_areas.length > 0;

          return (
            <div key={area.id}>
              {/* Area row */}
              <div
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent',
                  isSelected && 'bg-accent'
                )}
                onClick={() => {
                  onEntitySelect(area.id, 'area');
                  if (hasGeometry) onFitToEntity(area.id);
                }}
              >
                {/* Expand toggle */}
                {hasSubAreas ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAreaExpand(area.id);
                    }}
                    className="p-0.5 hover:bg-accent-foreground/10 rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronLeft className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="w-4.5" />
                )}

                {/* Geometry indicator */}
                <MapPin
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    hasGeometry ? 'text-blue-500' : 'text-muted-foreground/40'
                  )}
                />

                {/* Name */}
                <span className="flex-1 truncate">{area.name}</span>

                {/* Actions */}
                <div className="flex items-center gap-0.5">
                  {hasGeometry ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="ערוך גבולות"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditStart(area.id, 'area');
                        }}
                        disabled={isDrawing}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        title="מחק גבולות"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteGeometry(area.id, 'area');
                        }}
                        disabled={isDrawing}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="צייר גבולות"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDrawStart('area', area.id);
                      }}
                      disabled={isDrawing}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Sub-areas */}
              {isExpanded &&
                area.sub_areas.map((subArea) => {
                  const saIsSelected = selectedEntityId === subArea.id;
                  const saHasGeometry = !!subArea.geometry;

                  return (
                    <div
                      key={subArea.id}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent me-4',
                        saIsSelected && 'bg-accent'
                      )}
                      style={{ paddingInlineStart: `${(subArea.level + 1) * 16}px` }}
                      onClick={() => {
                        onEntitySelect(subArea.id, 'sub_area');
                        if (saHasGeometry) onFitToEntity(subArea.id);
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
                      <span className="flex-1 truncate text-xs">
                        {subArea.display || subArea.name}
                        {subArea.variety && (
                          <span className="text-muted-foreground">
                            {' '}
                            ({subArea.variety})
                          </span>
                        )}
                      </span>

                      <div className="flex items-center gap-0.5">
                        {saHasGeometry ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              title="ערוך גבולות"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditStart(subArea.id, 'sub_area');
                              }}
                              disabled={isDrawing}
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-destructive"
                              title="מחק גבולות"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteGeometry(subArea.id, 'sub_area');
                              }}
                              disabled={isDrawing}
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            title="צייר גבולות"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDrawStart('sub_area', subArea.id);
                            }}
                            disabled={isDrawing}
                          >
                            <Plus className="h-2.5 w-2.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
