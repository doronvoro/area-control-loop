'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Plus, Trash2, Settings } from 'lucide-react';
import { AreaForm } from './AreaForm';
import { SubAreaTreeView } from './SubAreaTreeView';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { showToast } from '@/lib/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Area {
  id: string;
  name: string;
  description?: string | null;
}

interface SubArea {
  id: string;
  name: string;
  variety?: string | null;
  rows?: string | null;
  parent_sub_area_id?: string | null;
  level?: number;
  area_id: string;
  display?: string;
  children?: SubArea[];
}

interface AreasListProps {
  areas: Area[];
  customerId?: string | null;
  canCreateArea: boolean;
  canUpdateArea: boolean;
  canDeleteArea: boolean;
  canCreateSubArea: boolean;
  canUpdateSubArea: boolean;
  canDeleteSubArea: boolean;
}

export function AreasList({
  areas,
  customerId,
  canCreateArea,
  canUpdateArea,
  canDeleteArea,
  canCreateSubArea,
  canUpdateSubArea,
  canDeleteSubArea,
}: AreasListProps) {
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [editAreaOpen, setEditAreaOpen] = useState(false);
  const [treeViewOpen, setTreeViewOpen] = useState(false);
  const [treeViewArea, setTreeViewArea] = useState<Area | null>(null);
  const [treeSubAreas, setTreeSubAreas] = useState<SubArea[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [deleteArea, setDeleteArea] = useState<Area | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleEditArea = (area: Area) => {
    setSelectedArea(area);
    setEditAreaOpen(true);
  };

  const handleCreateArea = () => {
    setSelectedArea(null);
    setEditAreaOpen(true);
  };

  const handleDeleteAreaClick = (area: Area) => {
    setDeleteArea(area);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDeleteArea = async () => {
    if (!deleteArea) return;

    try {
      const response = await fetch(`/api/areas?id=${deleteArea.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast.error(errorData.error || 'שגיאה במחיקת השטח');
        return;
      }

      showToast.success('השטח נמחק בהצלחה');
      window.location.reload();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה במחיקת השטח');
    }
  };

  const handleOpenTreeView = async (area: Area) => {
    setTreeViewArea(area);
    setTreeViewOpen(true);
    await fetchTreeSubAreas(area.id);
  };

  const fetchTreeSubAreas = async (areaId: string) => {
    setLoadingTree(true);
    try {
      const response = await fetch(`/api/sub-areas/tree?areaId=${areaId}`);
      if (response.ok) {
        const data = await response.json();
        setTreeSubAreas(data);
      }
    } catch (err) {
      console.error('Error fetching tree sub-areas:', err);
    } finally {
      setLoadingTree(false);
    }
  };

  const handleAreaUpdateSuccess = () => {
    window.location.reload();
  };

  const handleTreeRefresh = () => {
    if (treeViewArea) {
      fetchTreeSubAreas(treeViewArea.id);
    }
  };

  return (
    <>
      <div className="mb-6 flex justify-end">
        {canCreateArea && (
          <Button onClick={handleCreateArea}>
            <Plus className="h-4 w-4 ml-2" />
            הוסף שטח חדש
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) => (
          <Card key={area.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{area.name}</CardTitle>
                <div className="flex items-center gap-1">
                  {(canUpdateArea || canDeleteArea) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditArea(area)}
                      title="ערוך"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canDeleteArea && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAreaClick(area)}
                      title="מחק"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {area.description && (
                <p className="text-sm text-muted-foreground mb-4">
                  {area.description}
                </p>
              )}

              {(canCreateSubArea || canUpdateSubArea || canDeleteSubArea) && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleOpenTreeView(area)}
                >
                  <Settings className="h-4 w-4 ml-2" />
                  ניהול תת-שטחים
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {(canCreateArea || canUpdateArea) && (
        <AreaForm
          area={selectedArea}
          customerId={customerId || undefined}
          open={editAreaOpen}
          onOpenChange={setEditAreaOpen}
          onSuccess={handleAreaUpdateSuccess}
        />
      )}

      {treeViewArea && (
        <Dialog open={treeViewOpen} onOpenChange={setTreeViewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ניהול תת-שטחים - {treeViewArea.name}</DialogTitle>
              <DialogDescription>
                ניהול היררכי של תת-שטחים. ניתן להוסיף, לערוך ולמחוק תת-שטחים.
              </DialogDescription>
            </DialogHeader>
            {loadingTree ? (
              <div className="text-center py-8">טוען...</div>
            ) : (
              <SubAreaTreeView
                areaId={treeViewArea.id}
                subAreas={treeSubAreas}
                canCreate={canCreateSubArea}
                canUpdate={canUpdateSubArea}
                canDelete={canDeleteSubArea}
                onRefresh={handleTreeRefresh}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {deleteArea && (
        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="מחיקת שטח"
          description={`האם אתה בטוח שברצונך למחוק את השטח "${deleteArea.name}"? פעולה זו תמחק גם את כל תת-השטחים הקשורים.`}
          confirmText="מחק"
          cancelText="ביטול"
          variant="destructive"
          onConfirm={handleConfirmDeleteArea}
        />
      )}
    </>
  );
}
