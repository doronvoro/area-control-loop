'use client';

import { useState, useCallback } from 'react';
import { DetailPanel } from '@/components/area-management/DetailPanel';
import { AreaForm } from '@/components/areas/AreaForm';
import { AreaTypeChoiceDialog } from './AreaTypeChoiceDialog';
import { OutdoorAreaEditor } from './OutdoorAreaEditor';
import { IndoorAreaEditor } from './IndoorAreaEditor';
import { Layers } from 'lucide-react';
import type {
  TreeNode,
  SubArea,
  Crop,
  Permissions,
  Customer,
  AreaWithType,
  AreaType,
} from './types';

interface ContextPanelProps {
  selectedNode: TreeNode | null;
  areaType: 'indoor' | 'outdoor' | null;
  customerAreasMap: Record<string, AreaWithType[]>;
  areaSubAreasMap: Record<string, SubArea[]>;
  crops: Crop[];
  permissions: Permissions;
  onRefresh: () => void;
  onDrillDown?: (node: TreeNode) => void;
  onEditCustomer?: (customer: Customer) => void;
  onDeleteCustomer?: (customer: Customer) => void;
}

export function ContextPanel({
  selectedNode,
  areaType,
  customerAreasMap,
  areaSubAreasMap,
  crops,
  permissions,
  onRefresh,
  onDrillDown,
  onEditCustomer,
  onDeleteCustomer,
}: ContextPanelProps) {
  // Area creation flow: type choice → area form
  const [typeChoiceOpen, setTypeChoiceOpen] = useState(false);
  const [createAreaOpen, setCreateAreaOpen] = useState(false);
  const [createAreaCustomerId, setCreateAreaCustomerId] = useState<string | null>(null);
  const [createAreaType, setCreateAreaType] = useState<AreaType>('outdoor');

  const handleCreateArea = useCallback((customerId: string) => {
    setCreateAreaCustomerId(customerId);
    setTypeChoiceOpen(true);
  }, []);

  const handleTypeChosen = useCallback((type: AreaType) => {
    setCreateAreaType(type);
    setTypeChoiceOpen(false);
    setCreateAreaOpen(true);
  }, []);

  const handleAreaFormSuccess = useCallback(() => {
    setCreateAreaOpen(false);
    setCreateAreaCustomerId(null);
    onRefresh();
  }, [onRefresh]);

  // No selection — empty state
  if (!selectedNode) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground border rounded-lg bg-card">
          <Layers className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">בחר פריט מהעץ כדי לצפות בפרטים</p>
        </div>
        <AreaTypeChoiceDialog
          open={typeChoiceOpen}
          onOpenChange={setTypeChoiceOpen}
          onChoose={handleTypeChosen}
        />
        {createAreaOpen && createAreaCustomerId && (
          <AreaForm
            area={null}
            customerId={createAreaCustomerId}
            crops={crops}
            areaType={createAreaType}
            open={createAreaOpen}
            onOpenChange={setCreateAreaOpen}
            onSuccess={handleAreaFormSuccess}
          />
        )}
      </>
    );
  }

  // Customer selected — use existing DetailPanel with area creation interception
  if (selectedNode.type === 'customer') {
    return (
      <>
        <DetailPanel
          selectedNode={selectedNode}
          customerAreasMap={customerAreasMap}
          areaSubAreasMap={areaSubAreasMap}
          crops={crops}
          permissions={permissions}
          onRefresh={onRefresh}
          onDrillDown={onDrillDown}
          onEditCustomer={onEditCustomer}
          onDeleteCustomer={onDeleteCustomer}
          onCreateArea={handleCreateArea}
        />
        <AreaTypeChoiceDialog
          open={typeChoiceOpen}
          onOpenChange={setTypeChoiceOpen}
          onChoose={handleTypeChosen}
        />
        {createAreaOpen && createAreaCustomerId && (
          <AreaForm
            area={null}
            customerId={createAreaCustomerId}
            crops={crops}
            areaType={createAreaType}
            open={createAreaOpen}
            onOpenChange={setCreateAreaOpen}
            onSuccess={handleAreaFormSuccess}
          />
        )}
      </>
    );
  }

  // Area selected
  if (selectedNode.type === 'area') {
    const area = selectedNode.data as AreaWithType;
    const areaId = area.id;
    const subAreas = areaSubAreasMap[areaId] || [];

    if (areaType === 'indoor') {
      return (
        <IndoorAreaEditor
          area={area}
  
          permissions={permissions}
          onRefresh={onRefresh}
        />
      );
    }

    // Outdoor (default)
    return (
      <OutdoorAreaEditor
        area={area}

        permissions={permissions}
        onRefresh={onRefresh}
      />
    );
  }

  // Sub-area selected
  if (selectedNode.type === 'sub_area') {
    const subArea = selectedNode.data as SubArea;
    const areaId = subArea.area_id;

    // Find parent area
    let area: AreaWithType | null = null;
    for (const areas of Object.values(customerAreasMap)) {
      const found = areas.find((a) => a.id === areaId);
      if (found) {
        area = found as AreaWithType;
        break;
      }
    }

    if (!area) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground border rounded-lg bg-card">
          <p className="text-sm">שטח אב לא נמצא</p>
        </div>
      );
    }

    const subAreas = areaSubAreasMap[areaId] || [];

    if (areaType === 'indoor') {
      return (
        <IndoorAreaEditor
          area={area}
  
          permissions={permissions}
          selectedSubAreaId={subArea.id}
          onRefresh={onRefresh}
        />
      );
    }

    return (
      <OutdoorAreaEditor
        area={area}

        permissions={permissions}
        selectedSubAreaId={subArea.id}
        onRefresh={onRefresh}
      />
    );
  }

  return null;
}
