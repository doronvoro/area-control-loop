'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardGrid } from './CardGrid';
import { ItemDetailView } from './ItemDetailView';
import { AreaForm } from '@/components/areas/AreaForm';
import { SubAreaForm } from '@/components/areas/SubAreaForm';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { showToast } from '@/lib/toast';
import { Layers, Pencil, Trash2 } from 'lucide-react';
import type { TreeNode, Area, SubArea, Crop, Permissions, Customer } from './AreaManagementLayout';

interface DetailPanelProps {
  selectedNode: TreeNode | null;
  customerAreasMap: Record<string, Area[]>;
  areaSubAreasMap: Record<string, SubArea[]>;
  crops: Crop[];
  permissions: Permissions;
  onRefresh: () => void;
  onDrillDown?: (node: TreeNode) => void;
  onEditCustomer?: (customer: Customer) => void;
  onDeleteCustomer?: (customer: Customer) => void;
  onCreateArea?: (customerId: string) => void;
}

export function DetailPanel({
  selectedNode,
  customerAreasMap,
  areaSubAreasMap,
  crops,
  permissions,
  onRefresh,
  onDrillDown,
  onEditCustomer,
  onDeleteCustomer,
  onCreateArea,
}: DetailPanelProps) {
  const [editAreaOpen, setEditAreaOpen] = useState(false);
  const [editSubAreaOpen, setEditSubAreaOpen] = useState(false);
  const [createAreaOpen, setCreateAreaOpen] = useState(false);
  const [createSubAreaOpen, setCreateSubAreaOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [editingSubArea, setEditingSubArea] = useState<SubArea | null>(null);
  const [parentAreaId, setParentAreaId] = useState<string | null>(null);
  const [parentSubAreaId, setParentSubAreaId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ type: 'area' | 'sub_area'; data: Area | SubArea } | null>(null);

  // Empty state - no selection
  if (!selectedNode) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center text-muted-foreground">
          <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>בחר פריט מהעץ להצגת פרטים</p>
        </CardContent>
      </Card>
    );
  }

  const { type, data } = selectedNode;
  const realId = selectedNode.id.replace(/^(customer_|area_|sub_area_)/, '');

  // Handlers
  const handleEditArea = (area: Area) => {
    setEditingArea(area);
    setEditAreaOpen(true);
  };

  const handleEditSubArea = (subArea: SubArea) => {
    setEditingSubArea(subArea);
    setEditSubAreaOpen(true);
  };

  const handleCreateArea = (customerId: string) => {
    if (onCreateArea) {
      onCreateArea(customerId);
      return;
    }
    setParentAreaId(customerId);
    setEditingArea(null);
    setCreateAreaOpen(true);
  };

  const handleCreateSubArea = (areaId: string, parentSubAreaId?: string) => {
    setParentAreaId(areaId);
    setParentSubAreaId(parentSubAreaId || null);
    setEditingSubArea(null);
    setCreateSubAreaOpen(true);
  };

  const handleDeleteArea = (area: Area) => {
    setDeletingItem({ type: 'area', data: area });
    setDeleteDialogOpen(true);
  };

  const handleDeleteSubArea = (subArea: SubArea) => {
    setDeletingItem({ type: 'sub_area', data: subArea });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;

    try {
      const endpoint = deletingItem.type === 'area' ? '/api/areas' : '/api/sub-areas';
      const response = await fetch(`${endpoint}?id=${deletingItem.data.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast.error(errorData.error || 'שגיאה במחיקה');
        return;
      }

      showToast.success(deletingItem.type === 'area' ? 'השטח נמחק בהצלחה' : 'התת-שטח נמחק בהצלחה');
      onRefresh();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה במחיקה');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    }
  };

  const handleFormSuccess = () => {
    onRefresh();
    setEditAreaOpen(false);
    setEditSubAreaOpen(false);
    setCreateAreaOpen(false);
    setCreateSubAreaOpen(false);
  };

  // Get all sub-areas flattened for the form's parent selector
  const getAllSubAreas = (areaId: string): Array<{ id: string; name: string; display?: string }> => {
    const subAreas = areaSubAreasMap[areaId] || [];
    const result: Array<{ id: string; name: string; display?: string }> = [];

    const flatten = (items: SubArea[]) => {
      for (const item of items) {
        result.push({ id: item.id, name: item.name, display: item.display || item.name });
        if (item.children) {
          flatten(item.children);
        }
      }
    };

    flatten(subAreas);
    return result;
  };

  // Render based on selection type
  if (type === 'customer') {
    const customer = data as Customer;
    const areas = customerAreasMap[realId] || [];

    if (areas.length === 0) {
      return (
        <>
          <ItemDetailView
            type="customer"
            data={customer}
            permissions={permissions}
            onEdit={permissions.canUpdateCustomer && onEditCustomer ? () => onEditCustomer(customer) : undefined}
            onDelete={permissions.canDeleteCustomer && onDeleteCustomer ? () => onDeleteCustomer(customer) : undefined}
            onCreateChild={permissions.canCreateArea ? () => handleCreateArea(realId) : undefined}
            createChildLabel="הוסף שטח"
          />
          {createAreaOpen && (
            <AreaForm
              area={null}
              customerId={realId}
              crops={crops}
              open={createAreaOpen}
              onOpenChange={setCreateAreaOpen}
              onSuccess={handleFormSuccess}
            />
          )}
        </>
      );
    }

    return (
      <>
        <CardGrid
          title={`שטחים של ${customer.name}`}
          items={areas}
          itemType="area"
          permissions={permissions}
          onEdit={handleEditArea}
          onDelete={handleDeleteArea}
          onCreate={permissions.canCreateArea ? () => handleCreateArea(realId) : undefined}
          createLabel="הוסף שטח"
          onItemClick={onDrillDown ? (area: Area) => onDrillDown({
            id: `area_${area.id}`,
            type: 'area',
            name: area.name,
            data: area,
          }) : undefined}
          headerActions={
            (permissions.canUpdateCustomer && onEditCustomer) || (permissions.canDeleteCustomer && onDeleteCustomer) ? (
              <div className="flex gap-1">
                {permissions.canUpdateCustomer && onEditCustomer && (
                  <Button variant="ghost" size="sm" onClick={() => onEditCustomer(customer)} title="ערוך לקוח">
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {permissions.canDeleteCustomer && onDeleteCustomer && (
                  <Button variant="ghost" size="sm" onClick={() => onDeleteCustomer(customer)} title="מחק לקוח">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
        {editAreaOpen && editingArea && (
          <AreaForm
            area={editingArea}
            crops={crops}
            open={editAreaOpen}
            onOpenChange={setEditAreaOpen}
            onSuccess={handleFormSuccess}
          />
        )}
        {createAreaOpen && (
          <AreaForm
            area={null}
            customerId={realId}
            crops={crops}
            open={createAreaOpen}
            onOpenChange={setCreateAreaOpen}
            onSuccess={handleFormSuccess}
          />
        )}
        {deleteDialogOpen && deletingItem && (
          <ConfirmationDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title="מחיקת שטח"
            description={`האם אתה בטוח שברצונך למחוק את השטח "${(deletingItem.data as Area).name}"? פעולה זו תמחק גם את כל תת-השטחים הקשורים.`}
            confirmText="מחק"
            cancelText="ביטול"
            variant="destructive"
            onConfirm={handleConfirmDelete}
          />
        )}
      </>
    );
  }

  if (type === 'area') {
    const area = data as Area;
    const subAreas = areaSubAreasMap[realId] || [];

    if (subAreas.length === 0) {
      return (
        <>
          <ItemDetailView
            type="area"
            data={area}
            permissions={permissions}
            onEdit={permissions.canUpdateArea ? () => handleEditArea(area) : undefined}
            onDelete={permissions.canDeleteArea ? () => handleDeleteArea(area) : undefined}
            onCreateChild={permissions.canCreateSubArea ? () => handleCreateSubArea(realId) : undefined}
            createChildLabel="הוסף תת-שטח"
          />
          {editAreaOpen && (
            <AreaForm
              area={area}
              crops={crops}
              open={editAreaOpen}
              onOpenChange={setEditAreaOpen}
              onSuccess={handleFormSuccess}
            />
          )}
          {createSubAreaOpen && (
            <SubAreaForm
              subArea={null}
              areaId={realId}
              subAreas={getAllSubAreas(realId)}
              crops={crops}
              open={createSubAreaOpen}
              onOpenChange={setCreateSubAreaOpen}
              onSuccess={handleFormSuccess}
            />
          )}
          {deleteDialogOpen && deletingItem && (
            <ConfirmationDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              title="מחיקת שטח"
              description={`האם אתה בטוח שברצונך למחוק את השטח "${(deletingItem.data as Area).name}"?`}
              confirmText="מחק"
              cancelText="ביטול"
              variant="destructive"
              onConfirm={handleConfirmDelete}
            />
          )}
        </>
      );
    }

    return (
      <>
        <CardGrid
          title={`תת-שטחים של ${area.name}`}
          items={subAreas}
          itemType="sub_area"
          permissions={permissions}
          onEdit={handleEditSubArea}
          onDelete={handleDeleteSubArea}
          onCreate={permissions.canCreateSubArea ? () => handleCreateSubArea(realId) : undefined}
          createLabel="הוסף תת-שטח"
          onItemClick={onDrillDown ? (subArea: SubArea) => onDrillDown({
            id: `sub_area_${subArea.id}`,
            type: 'sub_area',
            name: subArea.name,
            data: subArea,
          }) : undefined}
        />
        {editSubAreaOpen && editingSubArea && (
          <SubAreaForm
            subArea={editingSubArea}
            areaId={realId}
            subAreas={getAllSubAreas(realId)}
            crops={crops}
            open={editSubAreaOpen}
            onOpenChange={setEditSubAreaOpen}
            onSuccess={handleFormSuccess}
          />
        )}
        {createSubAreaOpen && (
          <SubAreaForm
            subArea={null}
            areaId={realId}
            subAreas={getAllSubAreas(realId)}
            crops={crops}
            open={createSubAreaOpen}
            onOpenChange={setCreateSubAreaOpen}
            onSuccess={handleFormSuccess}
          />
        )}
        {deleteDialogOpen && deletingItem && (
          <ConfirmationDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title="מחיקת תת-שטח"
            description={`האם אתה בטוח שברצונך למחוק את התת-שטח "${(deletingItem.data as SubArea).name}"? פעולה זו תמחק גם את כל תת-השטחים הקשורים.`}
            confirmText="מחק"
            cancelText="ביטול"
            variant="destructive"
            onConfirm={handleConfirmDelete}
          />
        )}
      </>
    );
  }

  if (type === 'sub_area') {
    const subArea = data as SubArea;
    const children = subArea.children || [];

    if (children.length === 0) {
      return (
        <>
          <ItemDetailView
            type="sub_area"
            data={subArea}
            permissions={permissions}
            onEdit={permissions.canUpdateSubArea ? () => handleEditSubArea(subArea) : undefined}
            onDelete={permissions.canDeleteSubArea ? () => handleDeleteSubArea(subArea) : undefined}
            onCreateChild={permissions.canCreateSubArea ? () => handleCreateSubArea(subArea.area_id, subArea.id) : undefined}
            createChildLabel="הוסף תת-שטח"
          />
          {editSubAreaOpen && (
            <SubAreaForm
              subArea={subArea}
              areaId={subArea.area_id}
              subAreas={getAllSubAreas(subArea.area_id)}
              crops={crops}
              open={editSubAreaOpen}
              onOpenChange={setEditSubAreaOpen}
              onSuccess={handleFormSuccess}
            />
          )}
          {createSubAreaOpen && (
            <SubAreaForm
              subArea={null}
              areaId={subArea.area_id}
              subAreas={getAllSubAreas(subArea.area_id)}
              crops={crops}
              createSubArea={{ parentId: parentSubAreaId || undefined }}
              open={createSubAreaOpen}
              onOpenChange={setCreateSubAreaOpen}
              onSuccess={handleFormSuccess}
            />
          )}
          {deleteDialogOpen && deletingItem && (
            <ConfirmationDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
              title="מחיקת תת-שטח"
              description={`האם אתה בטוח שברצונך למחוק את התת-שטח "${(deletingItem.data as SubArea).name}"?`}
              confirmText="מחק"
              cancelText="ביטול"
              variant="destructive"
              onConfirm={handleConfirmDelete}
            />
          )}
        </>
      );
    }

    return (
      <>
        <CardGrid
          title={`תת-שטחים של ${subArea.name}`}
          items={children}
          itemType="sub_area"
          permissions={permissions}
          onEdit={handleEditSubArea}
          onDelete={handleDeleteSubArea}
          onCreate={permissions.canCreateSubArea ? () => handleCreateSubArea(subArea.area_id, subArea.id) : undefined}
          createLabel="הוסף תת-שטח"
          onItemClick={onDrillDown ? (child: SubArea) => onDrillDown({
            id: `sub_area_${child.id}`,
            type: 'sub_area',
            name: child.name,
            data: child,
          }) : undefined}
        />
        {editSubAreaOpen && editingSubArea && (
          <SubAreaForm
            subArea={editingSubArea}
            areaId={subArea.area_id}
            subAreas={getAllSubAreas(subArea.area_id)}
            crops={crops}
            open={editSubAreaOpen}
            onOpenChange={setEditSubAreaOpen}
            onSuccess={handleFormSuccess}
          />
        )}
        {createSubAreaOpen && (
          <SubAreaForm
            subArea={null}
            areaId={subArea.area_id}
            subAreas={getAllSubAreas(subArea.area_id)}
            crops={crops}
            createSubArea={{ parentId: parentSubAreaId || undefined }}
            open={createSubAreaOpen}
            onOpenChange={setCreateSubAreaOpen}
            onSuccess={handleFormSuccess}
          />
        )}
        {deleteDialogOpen && deletingItem && (
          <ConfirmationDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            title="מחיקת תת-שטח"
            description={`האם אתה בטוח שברצונך למחוק את התת-שטח "${(deletingItem.data as SubArea).name}"? פעולה זו תמחק גם את כל תת-השטחים הקשורים.`}
            confirmText="מחק"
            cancelText="ביטול"
            variant="destructive"
            onConfirm={handleConfirmDelete}
          />
        )}
      </>
    );
  }

  return null;
}
