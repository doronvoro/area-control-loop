'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HierarchyTreeNode } from './HierarchyTreeNode';
import type { Customer, Area, SubArea, TreeNode } from './AreaManagementLayout';
import { Layers, Plus } from 'lucide-react';

interface HierarchyTreeProps {
  customers: Customer[];
  customerAreasMap: Record<string, Area[]>;
  areaSubAreasMap: Record<string, SubArea[]>;
  expanded: Set<string>;
  selectedNodeId: string | null;
  loadingSubAreas: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  onSelectNode: (node: TreeNode) => void;
  onLoadSubAreas: (areaId: string) => Promise<void>;
  onCreateCustomer?: () => void;
  // Node action callbacks
  onCreateArea?: (customerId: string) => void;
  onCreateSubArea?: (areaId: string, parentSubAreaId?: string) => void;
  onEditCustomer?: (customer: Customer) => void;
  onEditArea?: (area: Area) => void;
  onEditSubArea?: (subArea: SubArea) => void;
  onDeleteCustomer?: (customer: Customer) => void;
  onDeleteArea?: (area: Area) => void;
  onDeleteSubArea?: (subArea: SubArea) => void;
  renderInlineContent?: (nodeId: string, depth: number) => React.ReactNode | null;
  showHeader?: boolean;
}

export function HierarchyTree({
  customers,
  customerAreasMap,
  areaSubAreasMap,
  expanded,
  selectedNodeId,
  loadingSubAreas,
  onToggleExpand,
  onSelectNode,
  onLoadSubAreas,
  onCreateCustomer,
  onCreateArea,
  onCreateSubArea,
  onEditCustomer,
  onEditArea,
  onEditSubArea,
  onDeleteCustomer,
  onDeleteArea,
  onDeleteSubArea,
  renderInlineContent,
  showHeader = true,
}: HierarchyTreeProps) {
  const handleExpandArea = async (areaId: string) => {
    await onLoadSubAreas(areaId);
    onToggleExpand(`area_${areaId}`);
  };

  const renderSubAreas = (subAreas: SubArea[], depth: number, parentAreaId: string): React.ReactNode => {
    return subAreas.map((subArea) => {
      const nodeId = `sub_area_${subArea.id}`;
      const hasChildren = !!(subArea.children && subArea.children.length > 0);
      const isExpanded = expanded.has(nodeId);

      return (
        <div key={subArea.id}>
          <HierarchyTreeNode
            nodeType="sub_area"
            id={nodeId}
            name={subArea.name}
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            isSelected={selectedNodeId === nodeId}
            depth={depth}
            onToggleExpand={() => onToggleExpand(nodeId)}
            onSelect={() =>
              onSelectNode({
                id: nodeId,
                type: 'sub_area',
                name: subArea.name,
                data: subArea,
              })
            }
            onCreateChild={
              onCreateSubArea
                ? () => onCreateSubArea(subArea.area_id, subArea.id)
                : undefined
            }
            onEdit={onEditSubArea ? () => onEditSubArea(subArea) : undefined}
            onDelete={onDeleteSubArea ? () => onDeleteSubArea(subArea) : undefined}
          />
          {renderInlineContent?.(nodeId, depth + 1)}
          {hasChildren && isExpanded && renderSubAreas(subArea.children!, depth + 1, parentAreaId)}
        </div>
      );
    });
  };

  return (
    <Card className={`h-full flex flex-col ${!showHeader ? 'pt-2' : ''}`}>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              <CardTitle className="text-lg">מבנה היררכי</CardTitle>
            </div>
            {onCreateCustomer && (
              <Button size="sm" onClick={onCreateCustomer}>
                <Plus className="h-4 w-4 ml-1" />
                לקוח
              </Button>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className="flex-1 overflow-y-auto p-2">
        {customers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>אין לקוחות במערכת</p>
          </div>
        ) : (
          <div className="space-y-1">
            {customers.map((customer) => {
              const customerId = `customer_${customer.id}`;
              const areas = customerAreasMap[customer.id] || [];
              const hasAreas = areas.length > 0;
              const isExpanded = expanded.has(customerId);

              return (
                <div key={customer.id}>
                  <HierarchyTreeNode
                    nodeType="customer"
                    id={customerId}
                    name={customer.name}
                    hasChildren={hasAreas}
                    isExpanded={isExpanded}
                    isSelected={selectedNodeId === customerId}
                    depth={0}
                    onToggleExpand={() => onToggleExpand(customerId)}
                    onSelect={() =>
                      onSelectNode({
                        id: customerId,
                        type: 'customer',
                        name: customer.name,
                        data: customer,
                      })
                    }
                    onCreateChild={
                      onCreateArea
                        ? () => onCreateArea(customer.id)
                        : undefined
                    }
                    onEdit={onEditCustomer ? () => onEditCustomer(customer) : undefined}
                    onDelete={onDeleteCustomer ? () => onDeleteCustomer(customer) : undefined}
                  />
                  {hasAreas && isExpanded && (
                    <div>
                      {areas.map((area) => {
                        const areaId = `area_${area.id}`;
                        const subAreas = areaSubAreasMap[area.id] || [];
                        const hasSubAreas = subAreas.length > 0;
                        const isAreaExpanded = expanded.has(areaId);
                        const isLoading = loadingSubAreas.has(area.id);

                        return (
                          <div key={area.id}>
                            <HierarchyTreeNode
                              nodeType="area"
                              id={areaId}
                              name={area.name}
                              hasChildren={true} // Always show expand icon for areas (lazy load)
                              isExpanded={isAreaExpanded}
                              isSelected={selectedNodeId === areaId}
                              isLoading={isLoading}
                              areaType={(area as any).area_type || 'outdoor'}
                              depth={1}
                              onToggleExpand={() => handleExpandArea(area.id)}
                              onSelect={() =>
                                onSelectNode({
                                  id: areaId,
                                  type: 'area',
                                  name: area.name,
                                  data: area,
                                })
                              }
                              onCreateChild={
                                onCreateSubArea
                                  ? () => onCreateSubArea(area.id)
                                  : undefined
                              }
                              onEdit={onEditArea ? () => onEditArea(area) : undefined}
                              onDelete={onDeleteArea ? () => onDeleteArea(area) : undefined}
                            />
                            {renderInlineContent?.(areaId, 2)}
                            {isAreaExpanded && hasSubAreas && renderSubAreas(subAreas, 2, area.id)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
