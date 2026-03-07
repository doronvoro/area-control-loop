'use client';

import { useState, useCallback } from 'react';
import { showToast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TreeHeader } from './tree/TreeHeader';
import { DesignerBreadcrumb } from './shared/Breadcrumb';
import { InteractiveTree } from './tree/InteractiveTree';
import { InteractiveIndoorCanvas } from './canvas/InteractiveIndoorCanvas';
import { useTreeData } from './hooks/useTreeData';
import { useDesignerActions } from './hooks/useDesignerActions';
import type { DesignerState } from './types';
import { INITIAL_DESIGNER_STATE } from './types';
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

export function IndoorDesignerPageContent() {
  const router = useRouter();
  const [state, setDesignerState] = useState<DesignerState>(INITIAL_DESIGNER_STATE);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');
  const [dimensionConfirm, setDimensionConfirm] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const setState = useCallback((updates: Partial<DesignerState>) => {
    setDesignerState((prev) => ({ ...prev, ...updates }));
  }, []);

  const { tree, breadcrumb, selectionContext, selectedNodeDimensions } =
    useTreeData(state);

  const actions = useDesignerActions(state, setState);

  // Handle dimension changes with confirmation when sub-areas exist
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
      showToast.error('שם שטח נדרש');
      return;
    }
    if (!areaGeometry) {
      showToast.error('יש להגדיר את צורת השטח');
      return;
    }
    if (generatedSubAreas.length === 0) {
      showToast.error('יש להגדיר לפחות חלוקה אחת');
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
        // Non-streaming error (validation, auth)
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
      showToast.success('השטח נוצר בהצלחה!');
      router.push('/admin/areas-management');
    } catch (error: any) {
      showToast.error(error.message || 'שגיאה בשמירת השטח');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
      setSaveProgress(0);
      setSaveMessage('');
    }
  }, [state, router]);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Main 2-panel layout */}
      <div className="flex flex-1 overflow-hidden gap-0 border rounded-lg">
        {/* Canvas panel (left in RTL) */}
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

          {/* Canvas */}
          <div className="flex-1 relative">
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
                <p className="text-sm">הגדר שם ומימדים כדי להציג את הקנבס</p>
              </div>
            )}
          </div>
        </div>

        {/* Tree panel (right in RTL) */}
        <div className="w-80 border-s flex flex-col bg-background overflow-hidden">
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

          {/* Tree with scroll */}
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
      <div className="py-3 px-1 space-y-2">
        {saving && (
          <div className="flex items-center gap-3">
            <Progress value={saveProgress} className="flex-1 h-2" />
            <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[60px] text-start">
              {saveMessage}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {state.generatedSubAreas.length > 0
              ? `${state.generatedSubAreas.length} תתי-שטחים`
              : 'אין תתי-שטחים'}
          </span>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !state.areaName.trim() ||
              !state.areaGeometry ||
              state.generatedSubAreas.length === 0
            }
          >
            {saving ? (
              <Loader2 className="h-4 w-4 me-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 me-2" />
            )}
            {saving ? 'שומר...' : 'שמירה'}
          </Button>
        </div>
      </div>

      {/* Dimension change confirmation dialog */}
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
