'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Plus, ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { SubAreaForm } from './SubAreaForm';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { showToast } from '@/lib/toast';

interface SubArea {
  id: string;
  name: string;
  variety?: string | null;
  rows?: string | null;
  parent_sub_area_id?: string | null;
  level?: number;
  area_id: string;
  display?: string;
  crop_id?: string | null;
  children?: SubArea[];
}

interface Crop {
  id: string;
  name: string;
  description?: string | null;
}

interface SubAreaTreeViewProps {
  areaId: string;
  subAreas: SubArea[];
  crops?: Crop[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onRefresh: () => void;
}

export function SubAreaTreeView({
  areaId,
  subAreas,
  crops = [],
  canCreate,
  canUpdate,
  canDelete,
  onRefresh,
}: SubAreaTreeViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editSubArea, setEditSubArea] = useState<SubArea | null>(null);
  const [createSubArea, setCreateSubArea] = useState<{ parentId?: string } | null>(null);
  const [deleteSubArea, setDeleteSubArea] = useState<SubArea | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Flatten tree structure for parent options
  const flattenSubAreas = (items: SubArea[]): SubArea[] => {
    const result: SubArea[] = [];
    const flatten = (items: SubArea[]) => {
      items.forEach((item) => {
        result.push(item);
        if (item.children && item.children.length > 0) {
          flatten(item.children);
        }
      });
    };
    flatten(items);
    return result;
  };

  const allSubAreas = flattenSubAreas(subAreas);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  const handleDeleteClick = (subArea: SubArea) => {
    setDeleteSubArea(subArea);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteSubArea) return;

    try {
      const response = await fetch(`/api/sub-areas?id=${deleteSubArea.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast.error(errorData.error || 'שגיאה במחיקת התת-שטח');
        return;
      }

      showToast.success('התת-שטח נמחק בהצלחה');
      onRefresh();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה במחיקת התת-שטח');
    } finally {
      setDeleteSubArea(null);
    }
  };

  const renderSubArea = (subArea: SubArea, depth: number = 0) => {
    const hasChildren = subArea.children && subArea.children.length > 0;
    const isExpanded = expanded.has(subArea.id);

    return (
      <div key={subArea.id} className="select-none">
        <div
          className="flex items-center gap-2 p-2 hover:bg-muted rounded-md group"
          style={{ paddingRight: `${depth * 1.5 + 0.5}rem` }}
        >
          <div className="flex items-center gap-1 flex-1">
            {hasChildren ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => toggleExpand(subArea.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-6" />
            )}
            {hasChildren ? (
              isExpanded ? (
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Folder className="h-4 w-4 text-muted-foreground" />
              )
            ) : (
              <div className="w-4" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{subArea.display || subArea.name}</p>
              {(subArea.variety || subArea.rows) && (
                <p className="text-xs text-muted-foreground">
                  {[subArea.variety, subArea.rows].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canCreate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreateSubArea({ parentId: subArea.id })}
                title="הוסף תת-שטח"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            {canUpdate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditSubArea(subArea)}
                title="ערוך"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteClick(subArea)}
                title="מחק"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div className="mr-4">
            {subArea.children!.map((child) => renderSubArea(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-1 border rounded-lg p-2">
        {canCreate && (
          <div className="p-2 border-b mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateSubArea({})}
              className="w-full"
            >
              <Plus className="h-4 w-4 ml-2" />
              הוסף תת-שטח
            </Button>
          </div>
        )}
        {subAreas.length > 0 ? (
          subAreas.map((subArea) => renderSubArea(subArea))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            אין תת-שטחים
          </p>
        )}
      </div>

      {editSubArea && (
        <SubAreaForm
          subArea={editSubArea}
          areaId={areaId}
          subAreas={allSubAreas.map((sa) => ({
            id: sa.id,
            name: sa.name,
            display: sa.display,
          }))}
          crops={crops}
          open={!!editSubArea}
          onOpenChange={(open) => !open && setEditSubArea(null)}
          onSuccess={() => {
            setEditSubArea(null);
            onRefresh();
          }}
        />
      )}

      {createSubArea && (
        <SubAreaForm
          subArea={null}
          areaId={areaId}
          subAreas={allSubAreas.map((sa) => ({
            id: sa.id,
            name: sa.name,
            display: sa.display,
          }))}
          crops={crops}
          open={!!createSubArea}
          onOpenChange={(open) => !open && setCreateSubArea(null)}
          onSuccess={() => {
            setCreateSubArea(null);
            onRefresh();
          }}
          createSubArea={createSubArea}
        />
      )}

      {deleteSubArea && (
        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDeleteSubArea(null);
          }}
          title="מחיקת תת-שטח"
          description={`האם אתה בטוח שברצונך למחוק את התת-שטח "${deleteSubArea.display || deleteSubArea.name}"? פעולה זו תמחק גם את כל תת-השטחים הקשורים.`}
          confirmText="מחק"
          cancelText="ביטול"
          variant="destructive"
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
