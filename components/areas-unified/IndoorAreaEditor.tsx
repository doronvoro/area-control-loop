'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TreeHeader } from '@/components/indoor-designer/tree/TreeHeader';
import { DesignerBreadcrumb } from '@/components/indoor-designer/shared/Breadcrumb';
import { InteractiveTree } from '@/components/indoor-designer/tree/InteractiveTree';
import { InteractiveIndoorCanvas } from '@/components/indoor-designer/canvas/InteractiveIndoorCanvas';
import { useTreeData } from '@/components/indoor-designer/hooks/useTreeData';
import { useDesignerActions } from '@/components/indoor-designer/hooks/useDesignerActions';
import { getBounds } from '@/components/indoor-designer/geometry/geometry-utils';
import type { DesignerState, GeneratedSubArea } from '@/components/indoor-designer/types';
import type { GeoJSONPolygon } from '@/components/map/types';
import type { SubArea, Permissions, AreaWithType } from './types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface IndoorAreaEditorProps {
  area: AreaWithType;
  subAreas: SubArea[];
  permissions: Permissions;
  selectedSubAreaId?: string;
  onRefresh: () => void;
}

/**
 * Convert DB sub-areas (hierarchical) into flat GeneratedSubArea[] for the designer.
 */
function convertDbToDesignerSubAreas(
  subAreas: SubArea[],
  parentTempId: string | null = null
): GeneratedSubArea[] {
  const result: GeneratedSubArea[] = [];

  for (const sa of subAreas) {
    const tempId = sa.id; // Use real DB ID as tempId for existing areas
    const item: GeneratedSubArea = {
      tempId,
      parentTempId,
      level: sa.level,
      name: sa.name,
      geometry: (sa as any).geometry || {
        type: 'Polygon' as const,
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      },
    };
    result.push(item);

    // Recurse into children
    if (sa.children && sa.children.length > 0) {
      result.push(...convertDbToDesignerSubAreas(sa.children, tempId));
    }
  }

  return result;
}

export function IndoorAreaEditor({
  area,
  subAreas,
  permissions,
  selectedSubAreaId,
  onRefresh,
}: IndoorAreaEditorProps) {
  // Build initial designer state from DB data
  const initialState = useMemo((): DesignerState => {
    const areaGeometry = (area as any).geometry as GeoJSONPolygon | null;
    let width = 100;
    let height = 50;

    if (areaGeometry) {
      const bounds = getBounds(areaGeometry);
      width = Math.round((bounds.maxX - bounds.minX) * 10) / 10 || 100;
      height = Math.round((bounds.maxY - bounds.minY) * 10) / 10 || 50;
    }

    const generatedSubAreas = convertDbToDesignerSubAreas(subAreas);

    return {
      areaName: area.name,
      areaDescription: area.description || '',
      width,
      height,
      areaGeometry: areaGeometry || {
        type: 'Polygon',
        coordinates: [[[0, 0], [width, 0], [width, height], [0, height], [0, 0]]],
      },
      generatedSubAreas,
      selectedNodeId: selectedSubAreaId || null,
      activeTemplateNodeId: null,
      renamingNodeId: null,
    };
  }, [area, subAreas, selectedSubAreaId]);

  const [state, setDesignerState] = useState<DesignerState>(initialState);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');
  const [dimensionConfirm, setDimensionConfirm] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Re-initialize when area changes
  useEffect(() => {
    setDesignerState(initialState);
  }, [initialState]);

  const setState = useCallback((updates: Partial<DesignerState>) => {
    setDesignerState((prev) => ({ ...prev, ...updates }));
  }, []);

  const { tree, breadcrumb, selectionContext, selectedNodeDimensions } =
    useTreeData(state);

  const actions = useDesignerActions(state, setState);

  const handleDimensionsChange = useCallback(
    (width: number, height: number) => {
      if (state.generatedSubAreas.length > 0) {
        setDimensionConfirm({ width, height });
      } else {
        actions.setDimensions(width, height);
      }
    },
    [state.generatedSubAreas.length, actions]
  );

  const confirmDimensionChange = useCallback(() => {
    if (dimensionConfirm) {
      actions.clearSubAreas();
      actions.setDimensions(dimensionConfirm.width, dimensionConfirm.height);
      setDimensionConfirm(null);
    }
  }, [dimensionConfirm, actions]);

  const handleSave = useCallback(async () => {
    const { areaName, areaDescription, areaGeometry, generatedSubAreas } = state;

    if (!areaName.trim()) {
      toast.error('שם שטח נדרש');
      return;
    }
    if (!areaGeometry) {
      toast.error('יש להגדיר את צורת השטח');
      return;
    }
    if (generatedSubAreas.length === 0) {
      toast.error('יש להגדיר לפחות חלוקה אחת');
      return;
    }

    setSaving(true);
    setSaveProgress(0);
    setSaveMessage('מתחיל שמירה...');

    try {
      const res = await fetch('/api/indoor-designer/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: {
            id: area.id,
            name: areaName.trim(),
            description: areaDescription.trim() || null,
            area_type: 'indoor',
            geometry: areaGeometry,
          },
          sub_areas: generatedSubAreas.map((sa) => ({
            temp_id: sa.tempId,
            parent_temp_id: sa.parentTempId,
            level: sa.level,
            name: sa.name,
            geometry: sa.geometry,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'שגיאה בשמירת השטח');
      }

      // Read NDJSON stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let errorMsg: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.progress != null) setSaveProgress(event.progress);
            if (event.message) setSaveMessage(event.message);
            if (event.step === 'error') {
              errorMsg = event.error;
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (errorMsg) {
        throw new Error(errorMsg);
      }

      setSaveProgress(100);
      toast.success('השטח נשמר בהצלחה!');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'שגיאה בשמירת השטח');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
      setSaveProgress(0);
      setSaveMessage('');
    }
  }, [state, onRefresh]);

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-hidden">
      {/* Main 2-panel layout */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* Canvas panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Breadcrumb + dimensions bar */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/10">
            <DesignerBreadcrumb
              segments={breadcrumb}
              onNavigate={actions.selectNode}
            />
            {selectedNodeDimensions && (
              <span className="text-xs text-muted-foreground whitespace-nowrap ms-3">
                {selectedNodeDimensions.width}m × {selectedNodeDimensions.height}m
              </span>
            )}
          </div>

          {/* Canvas — z-0 creates stacking context so canvas z-indices don't overlap dialogs */}
          <div className="flex-1 relative z-0">
            {state.areaGeometry ? (
              <InteractiveIndoorCanvas
                areaGeometry={state.areaGeometry}
                subAreas={state.generatedSubAreas}
                width={state.width}
                height={state.height}
                drawingState={{ mode: 'view' }}
                selectedTempId={state.selectedNodeId}
                selectionContext={selectionContext}
                onSubAreaSelect={actions.selectNode}
                showLabels
                showLegend
                showGrid
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">הגדר מימדים כדי להציג את הקנבס</p>
              </div>
            )}
          </div>
        </div>

        {/* Tree panel */}
        <div className="w-72 border-s flex flex-col bg-background overflow-hidden">
          <TreeHeader
            areaName={state.areaName}
            areaDescription={state.areaDescription}
            width={state.width}
            height={state.height}
            onAreaNameChange={actions.setAreaName}
            onAreaDescriptionChange={actions.setAreaDescription}
            onDimensionsChange={handleDimensionsChange}
            hasSubAreas={state.generatedSubAreas.length > 0}
          />

          <div className="flex-1 overflow-y-auto">
            <InteractiveTree
              areaName={state.areaName}
              areaGeometry={state.areaGeometry}
              subAreas={state.generatedSubAreas}
              tree={tree}
              selectedNodeId={state.selectedNodeId}
              activeTemplateNodeId={state.activeTemplateNodeId}
              renamingNodeId={state.renamingNodeId}
              onSelectNode={actions.selectNode}
              onAddChildren={actions.addChildren}
              onAddChildrenToSiblings={actions.addChildrenToSiblings}
              onAddSingleChild={actions.addSingleChild}
              onDeleteNode={actions.deleteNode}
              onRenameNode={actions.renameNode}
              onOpenTemplate={actions.openTemplate}
              onStartRename={actions.startRename}
            />
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t py-2 px-3 space-y-2">
        {saving && (
          <div className="flex items-center gap-3">
            <Progress value={saveProgress} className="flex-1 h-2" />
            <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[60px] text-start">
              {saveMessage}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {state.generatedSubAreas.length > 0
              ? `${state.generatedSubAreas.length} תתי-שטחים`
              : 'אין תתי-שטחים'}
          </span>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={
              saving ||
              !state.areaName.trim() ||
              !state.areaGeometry ||
              state.generatedSubAreas.length === 0
            }
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 me-1.5" />
            )}
            {saving ? 'שומר...' : 'שמירה'}
          </Button>
        </div>
      </div>

      {/* Dimension change confirmation */}
      <AlertDialog
        open={!!dimensionConfirm}
        onOpenChange={(open) => !open && setDimensionConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>שינוי מימדים</AlertDialogTitle>
            <AlertDialogDescription>
              שינוי מימדים ימחק את כל החלוקות הקיימות. להמשיך?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDimensionChange}>
              המשך
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
