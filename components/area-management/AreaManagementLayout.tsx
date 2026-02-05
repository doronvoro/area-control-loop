'use client';

import { useState, useCallback } from 'react';
import { HierarchyTree } from './HierarchyTree';
import { DetailPanel } from './DetailPanel';

export interface Customer {
  id: string;
  name: string;
  description: string | null;
}

export interface Area {
  id: string;
  name: string;
  description: string | null;
  crop_id: string | null;
}

export interface SubArea {
  id: string;
  name: string;
  variety: string | null;
  rows: string | null;
  parent_sub_area_id: string | null;
  level: number;
  area_id: string;
  display: string | null;
  crop_id: string | null;
  children?: SubArea[];
}

export interface Crop {
  id: string;
  name: string;
  description: string | null;
}

export interface TreeNode {
  id: string;
  type: 'customer' | 'area' | 'sub_area';
  name: string;
  data: Customer | Area | SubArea;
}

export interface Permissions {
  canCreateArea: boolean;
  canUpdateArea: boolean;
  canDeleteArea: boolean;
  canCreateSubArea: boolean;
  canUpdateSubArea: boolean;
  canDeleteSubArea: boolean;
}

interface AreaManagementLayoutProps {
  customers: Customer[];
  initialCustomerAreasMap: Record<string, Area[]>;
  crops: Crop[];
  permissions: Permissions;
}

export function AreaManagementLayout({
  customers,
  initialCustomerAreasMap,
  crops,
  permissions,
}: AreaManagementLayoutProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [customerAreasMap, setCustomerAreasMap] = useState<Record<string, Area[]>>(initialCustomerAreasMap);
  const [areaSubAreasMap, setAreaSubAreasMap] = useState<Record<string, SubArea[]>>({});
  const [loadingSubAreas, setLoadingSubAreas] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((nodeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleLoadSubAreas = useCallback(async (areaId: string) => {
    if (areaSubAreasMap[areaId]) {
      return; // Already loaded
    }

    setLoadingSubAreas((prev) => new Set(prev).add(areaId));

    try {
      const response = await fetch(`/api/sub-areas/tree?areaId=${areaId}`);
      if (response.ok) {
        const subAreas = await response.json();
        setAreaSubAreasMap((prev) => ({
          ...prev,
          [areaId]: subAreas,
        }));
      }
    } catch (error) {
      console.error('Error loading sub-areas:', error);
    } finally {
      setLoadingSubAreas((prev) => {
        const next = new Set(prev);
        next.delete(areaId);
        return next;
      });
    }
  }, [areaSubAreasMap]);

  const handleSelectNode = useCallback((node: TreeNode) => {
    setSelectedNode(node);
  }, []);

  const handleRefreshData = useCallback(async () => {
    // Refresh customer areas
    try {
      const response = await fetch('/api/customer-areas');
      if (response.ok) {
        const data = await response.json();
        const newMap: Record<string, Area[]> = {};
        for (const ca of data) {
          if (!newMap[ca.customer_id]) {
            newMap[ca.customer_id] = [];
          }
          if (ca.areas) {
            newMap[ca.customer_id].push(ca.areas);
          }
        }
        setCustomerAreasMap(newMap);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }

    // Refresh sub-areas for any expanded areas
    for (const areaId of Object.keys(areaSubAreasMap)) {
      try {
        const response = await fetch(`/api/sub-areas/tree?areaId=${areaId}`);
        if (response.ok) {
          const subAreas = await response.json();
          setAreaSubAreasMap((prev) => ({
            ...prev,
            [areaId]: subAreas,
          }));
        }
      } catch (error) {
        console.error('Error refreshing sub-areas:', error);
      }
    }
  }, [areaSubAreasMap]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-200px)] gap-4">
      {/* Left Panel - Tree View */}
      <div className="w-full lg:w-1/3 lg:min-w-[300px] lg:max-w-[400px] h-[40vh] lg:h-full overflow-hidden">
        <HierarchyTree
          customers={customers}
          customerAreasMap={customerAreasMap}
          areaSubAreasMap={areaSubAreasMap}
          expanded={expanded}
          selectedNodeId={selectedNode?.id || null}
          loadingSubAreas={loadingSubAreas}
          onToggleExpand={toggleExpand}
          onSelectNode={handleSelectNode}
          onLoadSubAreas={handleLoadSubAreas}
        />
      </div>

      {/* Right Panel - Detail/Grid View */}
      <div className="flex-1 h-[60vh] lg:h-full overflow-hidden">
        <DetailPanel
          selectedNode={selectedNode}
          customerAreasMap={customerAreasMap}
          areaSubAreasMap={areaSubAreasMap}
          crops={crops}
          permissions={permissions}
          onRefresh={handleRefreshData}
        />
      </div>
    </div>
  );
}
