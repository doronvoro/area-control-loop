'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Pencil, Eye } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HierarchyTree } from '@/components/area-management/HierarchyTree';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { AreaForm } from '@/components/areas/AreaForm';
import { SubAreaForm } from '@/components/areas/SubAreaForm';
import { AreaTypeChoiceDialog } from './AreaTypeChoiceDialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { InlineIndoorSubAreaForm } from './InlineIndoorSubAreaForm';
import { ContextPanel } from './ContextPanel';
import { LiveMapView } from './LiveMapView';
import { LiveIndoorView } from './LiveIndoorView';
import { showToast } from '@/lib/toast';
import type {
  Customer,
  SubArea,
  Crop,
  Permissions,
  TreeNode,
  PageMode,
  AreaWithType,
  AreaType,
} from './types';
import type { GeoJSONPolygon } from '@/components/map/types';

interface UnifiedAreasLayoutProps {
  customers: Customer[];
  initialCustomerAreasMap: Record<string, AreaWithType[]>;
  crops: Crop[];
  permissions: Permissions;
}

export function UnifiedAreasLayout({
  customers: initialCustomers,
  initialCustomerAreasMap,
  crops,
  permissions,
}: UnifiedAreasLayoutProps) {
  const [mode, setMode] = useState<PageMode>('live');

  // Hierarchy state (from AreaManagementLayout)
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  // Auto-expand all customer nodes on load
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialCustomers.map((c) => `customer_${c.id}`))
  );
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [customerAreasMap, setCustomerAreasMap] =
    useState<Record<string, AreaWithType[]>>(initialCustomerAreasMap);
  const [areaSubAreasMap, setAreaSubAreasMap] = useState<
    Record<string, SubArea[]>
  >({});
  const [loadingSubAreas, setLoadingSubAreas] = useState<Set<string>>(
    new Set()
  );

  // Customer form
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(
    null
  );

  // Area creation flow (from tree): type choice → area form
  const [treeTypeChoiceOpen, setTreeTypeChoiceOpen] = useState(false);
  const [treeCreateAreaCustomerId, setTreeCreateAreaCustomerId] = useState<string | null>(null);
  const [treeCreateAreaType, setTreeCreateAreaType] = useState<AreaType>('outdoor');
  const [treeCreateAreaOpen, setTreeCreateAreaOpen] = useState(false);

  // Area edit (from tree)
  const [treeEditAreaOpen, setTreeEditAreaOpen] = useState(false);
  const [treeEditingArea, setTreeEditingArea] = useState<AreaWithType | null>(null);

  // Sub-area creation/edit (from tree)
  const [treeCreateSubAreaOpen, setTreeCreateSubAreaOpen] = useState(false);
  const [treeCreateSubAreaAreaId, setTreeCreateSubAreaAreaId] = useState<string | null>(null);
  const [treeCreateSubAreaParentId, setTreeCreateSubAreaParentId] = useState<string | null>(null);
  const [treeEditSubAreaOpen, setTreeEditSubAreaOpen] = useState(false);
  const [treeEditingSubArea, setTreeEditingSubArea] = useState<SubArea | null>(null);

  // Indoor sub-area creation (inline template form in tree)
  const [inlineFormNodeId, setInlineFormNodeId] = useState<string | null>(null);
  const [indoorSubAreaParent, setIndoorSubAreaParent] = useState<{
    areaId: string;
    parentSubAreaId: string | null;
    parentName: string;
    parentLevel: number;
    parentGeometry: GeoJSONPolygon | null;
    existingChildCount: number;
    siblingCount: number;
  } | null>(null);

  // Monitoring counts and reports for tree indicators + pin popups
  const [pendingMonitoringCounts, setPendingMonitoringCounts] = useState<
    Record<string, number>
  >({});
  const [monitoringReports, setMonitoringReports] = useState<
    Record<string, any[]>
  >({});

  // Fetch monitoring counts only in live mode
  useEffect(() => {
    if (mode !== 'live') {
      setPendingMonitoringCounts({});
      setMonitoringReports({});
      return;
    }
    fetch('/api/map/monitoring-counts')
      .then((res) => (res.ok ? res.json() : { counts: {}, reports: {} }))
      .then((data) => {
        setPendingMonitoringCounts(data.counts || {});
        setMonitoringReports(data.reports || {});
      })
      .catch(console.error);
  }, [mode]);

  // Delete confirmation (from tree)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{
    type: 'area' | 'sub_area';
    data: AreaWithType | SubArea;
  } | null>(null);

  // --- Handlers (same pattern as AreaManagementLayout) ---

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

  const handleLoadSubAreas = useCallback(
    async (areaId: string) => {
      if (areaSubAreasMap[areaId]) return;

      setLoadingSubAreas((prev) => new Set(prev).add(areaId));

      try {
        const response = await fetch(`/api/sub-areas/tree?areaId=${areaId}`);
        if (response.ok) {
          const subAreas = await response.json();
          setAreaSubAreasMap((prev) => ({ ...prev, [areaId]: subAreas }));
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
    },
    [areaSubAreasMap]
  );

  // Pre-load sub-areas for all areas on mount
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const allAreaIds: string[] = [];
    for (const areas of Object.values(initialCustomerAreasMap)) {
      for (const area of areas) {
        allAreaIds.push(area.id);
      }
    }

    // Load sub-areas for each area
    allAreaIds.forEach((areaId) => {
      fetch(`/api/sub-areas/tree?areaId=${areaId}`)
        .then((res) => res.ok ? res.json() : [])
        .then((subAreas) => {
          setAreaSubAreasMap((prev) => ({ ...prev, [areaId]: subAreas }));
        })
        .catch(console.error);
    });
  }, [initialCustomerAreasMap]);

  const handleSelectNode = useCallback((node: TreeNode) => {
    setSelectedNode(node);

    // Auto-load sub-areas when selecting an area node so the canvas isn't empty
    if (node.type === 'area') {
      const areaId = (node.data as any).id;
      if (areaId && !areaSubAreasMap[areaId]) {
        handleLoadSubAreas(areaId);
      }
    } else if (node.type === 'sub_area') {
      const areaId = (node.data as any).area_id;
      if (areaId && !areaSubAreasMap[areaId]) {
        handleLoadSubAreas(areaId);
      }
    }
  }, [areaSubAreasMap, handleLoadSubAreas]);

  const handleDrillDown = useCallback(
    async (node: TreeNode) => {
      setSelectedNode(node);
      setExpanded((prev) => new Set(prev).add(node.id));

      if (node.type === 'area') {
        const areaId = node.id.replace('area_', '');
        if (!areaSubAreasMap[areaId]) {
          await handleLoadSubAreas(areaId);
        }
      }
    },
    [areaSubAreasMap, handleLoadSubAreas]
  );

  const handleRefreshData = useCallback(async () => {
    // Refresh customers
    try {
      const response = await fetch('/api/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error('Error refreshing customers:', error);
    }

    // Refresh customer areas
    try {
      const response = await fetch('/api/customer-areas');
      if (response.ok) {
        const data = await response.json();
        const newMap: Record<string, AreaWithType[]> = {};
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

    // Refresh sub-areas for any loaded areas
    for (const areaId of Object.keys(areaSubAreasMap)) {
      try {
        const response = await fetch(`/api/sub-areas/tree?areaId=${areaId}`);
        if (response.ok) {
          const subAreas = await response.json();
          setAreaSubAreasMap((prev) => ({ ...prev, [areaId]: subAreas }));
        }
      } catch (error) {
        console.error('Error refreshing sub-areas:', error);
      }
    }

    // Refresh monitoring counts (only in live mode)
    if (mode === 'live') {
      try {
        const res = await fetch('/api/map/monitoring-counts');
        if (res.ok) {
          const data = await res.json();
          setPendingMonitoringCounts(data.counts || {});
          setMonitoringReports(data.reports || {});
        }
      } catch (error) {
        console.error('Error refreshing monitoring counts:', error);
      }
    }
  }, [areaSubAreasMap, mode]);

  const handleCreateCustomer = useCallback(() => {
    setEditingCustomer(null);
    setCustomerFormOpen(true);
  }, []);

  const handleEditCustomer = useCallback((customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerFormOpen(true);
  }, []);

  const handleDeleteCustomer = useCallback(
    async (customer: Customer) => {
      if (
        !confirm(
          `האם אתה בטוח שברצונך למחוק את הלקוח "${customer.name}"? פעולה זו תמחק גם את כל השטחים, העובדים והדוחות הקשורים.`
        )
      ) {
        return;
      }

      try {
        const response = await fetch(`/api/customers?id=${customer.id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          alert(errorData.error || 'שגיאה במחיקת הלקוח');
          return;
        }

        setSelectedNode(null);
        handleRefreshData();
      } catch {
        alert('שגיאה במחיקת הלקוח');
      }
    },
    [handleRefreshData]
  );

  // --- Tree node action handlers ---

  const handleTreeCreateArea = useCallback((customerId: string) => {
    setTreeCreateAreaCustomerId(customerId);
    setTreeTypeChoiceOpen(true);
  }, []);

  const handleTreeTypeChosen = useCallback((type: AreaType) => {
    setTreeCreateAreaType(type);
    setTreeTypeChoiceOpen(false);
    setTreeCreateAreaOpen(true);
  }, []);

  const handleTreeAreaFormSuccess = useCallback(() => {
    setTreeCreateAreaOpen(false);
    setTreeEditAreaOpen(false);
    setTreeCreateAreaCustomerId(null);
    setTreeEditingArea(null);
    handleRefreshData();
  }, [handleRefreshData]);

  const handleTreeEditArea = useCallback((area: AreaWithType) => {
    setTreeEditingArea(area);
    setTreeEditAreaOpen(true);
  }, []);

  const handleTreeDeleteArea = useCallback((area: AreaWithType) => {
    setDeletingItem({ type: 'area', data: area });
    setDeleteDialogOpen(true);
  }, []);

  const handleTreeCreateSubArea = useCallback((areaId: string, parentSubAreaId?: string) => {
    // Check if area is indoor
    let areaType: AreaType = 'outdoor';
    for (const areas of Object.values(customerAreasMap)) {
      const found = areas.find((a) => a.id === areaId);
      if (found) {
        areaType = (found as AreaWithType).area_type || 'outdoor';
        break;
      }
    }

    if (areaType === 'indoor') {
      // Compute the tree node ID for inline form placement
      const nodeId = parentSubAreaId ? `sub_area_${parentSubAreaId}` : `area_${areaId}`;

      // Toggle off if clicking the same node
      if (inlineFormNodeId === nodeId) {
        setInlineFormNodeId(null);
        setIndoorSubAreaParent(null);
        return;
      }

      // Gather parent info for InlineTemplateForm
      let parentName = '';
      let parentLevel = 0;
      let parentGeometry: GeoJSONPolygon | null = null;
      let existingChildCount = 0;
      let siblingCount = 1;

      if (parentSubAreaId) {
        // Parent is a sub-area — find it in the tree
        const subAreas = areaSubAreasMap[areaId] || [];
        const findSubArea = (items: SubArea[]): SubArea | null => {
          for (const sa of items) {
            if (sa.id === parentSubAreaId) return sa;
            if (sa.children) {
              const found = findSubArea(sa.children);
              if (found) return found;
            }
          }
          return null;
        };
        const parent = findSubArea(subAreas);
        if (parent) {
          parentName = parent.name;
          parentLevel = parent.level;
          parentGeometry = (parent as any).geometry || null;
          existingChildCount = parent.children?.length || 0;
          // Count siblings (same parent)
          const findSiblings = (items: SubArea[]): number => {
            for (const sa of items) {
              if (sa.id === parentSubAreaId) {
                return items.length;
              }
              if (sa.children) {
                const count = findSiblings(sa.children);
                if (count > 0) return count;
              }
            }
            return 0;
          };
          siblingCount = findSiblings(subAreas);
        }
      } else {
        // Parent is the area itself
        for (const areas of Object.values(customerAreasMap)) {
          const found = areas.find((a) => a.id === areaId);
          if (found) {
            parentName = found.name;
            parentGeometry = (found as any).geometry || null;
            break;
          }
        }
        existingChildCount = (areaSubAreasMap[areaId] || []).length;
      }

      setIndoorSubAreaParent({
        areaId,
        parentSubAreaId: parentSubAreaId || null,
        parentName,
        parentLevel,
        parentGeometry,
        existingChildCount,
        siblingCount,
      });
      setInlineFormNodeId(nodeId);
      // Auto-expand the node so the inline form is visible
      setExpanded((prev) => new Set(prev).add(nodeId));
      return;
    }

    // Outdoor: use existing SubAreaForm flow
    setTreeCreateSubAreaAreaId(areaId);
    setTreeCreateSubAreaParentId(parentSubAreaId || null);
    setTreeCreateSubAreaOpen(true);
  }, [customerAreasMap, areaSubAreasMap, inlineFormNodeId]);

  const handleTreeEditSubArea = useCallback((subArea: SubArea) => {
    setTreeEditingSubArea(subArea);
    setTreeEditSubAreaOpen(true);
  }, []);

  const handleTreeDeleteSubArea = useCallback((subArea: SubArea) => {
    setDeletingItem({ type: 'sub_area', data: subArea });
    setDeleteDialogOpen(true);
  }, []);

  const handleTreeSubAreaFormSuccess = useCallback(() => {
    setTreeCreateSubAreaOpen(false);
    setTreeEditSubAreaOpen(false);
    setTreeEditingSubArea(null);
    handleRefreshData();
  }, [handleRefreshData]);

  const handleConfirmDelete = useCallback(async () => {
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
      showToast.success(
        deletingItem.type === 'area' ? 'השטח נמחק בהצלחה' : 'התת-שטח נמחק בהצלחה'
      );
      setSelectedNode(null);
      handleRefreshData();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה במחיקה');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    }
  }, [deletingItem, handleRefreshData]);

  // Helper: get all sub-areas flattened for the form's parent selector
  const getAllSubAreas = useCallback(
    (areaId: string): Array<{ id: string; name: string; display?: string }> => {
      const subAreas = areaSubAreasMap[areaId] || [];
      const result: Array<{ id: string; name: string; display?: string }> = [];
      const flatten = (items: SubArea[]) => {
        for (const item of items) {
          result.push({ id: item.id, name: item.name, display: item.display || item.name });
          if (item.children) flatten(item.children);
        }
      };
      flatten(subAreas);
      return result;
    },
    [areaSubAreasMap]
  );

  // Find the area_type for any selected area or sub-area
  const getAreaTypeForNode = useCallback(
    (node: TreeNode | null): 'indoor' | 'outdoor' | null => {
      if (!node) return null;

      if (node.type === 'area') {
        const area = node.data as AreaWithType;
        return area.area_type || 'outdoor';
      }

      if (node.type === 'sub_area') {
        const subArea = node.data as SubArea;
        // Look up the parent area's type
        for (const areas of Object.values(customerAreasMap)) {
          const parentArea = areas.find((a) => a.id === subArea.area_id);
          if (parentArea) {
            return (parentArea as AreaWithType).area_type || 'outdoor';
          }
        }
      }

      return null;
    },
    [customerAreasMap]
  );

  // Look up area type by area ID
  const getAreaTypeById = useCallback(
    (areaId: string): 'indoor' | 'outdoor' => {
      for (const areas of Object.values(customerAreasMap)) {
        const found = areas.find((a) => a.id === areaId);
        if (found) return (found as AreaWithType).area_type || 'outdoor';
      }
      return 'outdoor';
    },
    [customerAreasMap]
  );

  // Derive map entity ID from selected tree node (strip prefix to get raw ID)
  const liveMapEntityId = selectedNode
    ? selectedNode.type === 'area'
      ? (selectedNode.data as AreaWithType).id
      : selectedNode.type === 'sub_area'
        ? (selectedNode.data as SubArea).id
        : null
    : null;

  // When user clicks an entity on the live map, select the corresponding tree node
  const handleLiveMapEntitySelect = useCallback(
    (entityId: string, entityType: 'area' | 'sub_area') => {
      if (entityType === 'area') {
        for (const areas of Object.values(customerAreasMap)) {
          const area = areas.find((a) => a.id === entityId);
          if (area) {
            handleSelectNode({
              id: `area_${entityId}`,
              type: 'area',
              name: area.name,
              data: area,
            });
            return;
          }
        }
      } else {
        // Find sub-area in loaded data
        for (const [areaId, subAreas] of Object.entries(areaSubAreasMap)) {
          const findSubArea = (items: SubArea[]): SubArea | null => {
            for (const sa of items) {
              if (sa.id === entityId) return sa;
              if (sa.children) {
                const found = findSubArea(sa.children);
                if (found) return found;
              }
            }
            return null;
          };
          const subArea = findSubArea(subAreas);
          if (subArea) {
            handleSelectNode({
              id: `sub_area_${entityId}`,
              type: 'sub_area',
              name: subArea.name,
              data: subArea,
            });
            // Auto-expand parent nodes
            setExpanded((prev) => {
              const next = new Set(prev);
              next.add(`area_${areaId}`);
              if (subArea.parent_sub_area_id) {
                next.add(`sub_area_${subArea.parent_sub_area_id}`);
              }
              return next;
            });
            return;
          }
        }
      }
    },
    [customerAreasMap, areaSubAreasMap, handleSelectNode]
  );

  // Render inline indoor sub-area form below a specific tree node
  const renderInlineContent = useCallback(
    (nodeId: string, depth: number): React.ReactNode | null => {
      if (nodeId !== inlineFormNodeId || !indoorSubAreaParent) return null;
      return (
        <InlineIndoorSubAreaForm
          areaId={indoorSubAreaParent.areaId}
          parentSubAreaId={indoorSubAreaParent.parentSubAreaId}
          parentName={indoorSubAreaParent.parentName}
          parentLevel={indoorSubAreaParent.parentLevel}
          parentGeometry={indoorSubAreaParent.parentGeometry}
          existingChildCount={indoorSubAreaParent.existingChildCount}
          siblingCount={indoorSubAreaParent.siblingCount}
          depth={depth}
          onSuccess={() => {
            setInlineFormNodeId(null);
            setIndoorSubAreaParent(null);
            handleRefreshData();
          }}
          onCancel={() => {
            setInlineFormNodeId(null);
            setIndoorSubAreaParent(null);
          }}
        />
      );
    },
    [inlineFormNodeId, indoorSubAreaParent, handleRefreshData]
  );

  return (
    <>
      {/* Mode toggle */}
      <div className="flex items-center justify-end mb-3">
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as PageMode)}
        >
          <TabsList>
            <TabsTrigger value="edit" className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              עריכה
            </TabsTrigger>
            <TabsTrigger value="live" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              מפה חיה
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-220px)] gap-4">
        {/* Tree Panel — shown in both modes */}
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
            onCreateCustomer={
              mode === 'edit' && permissions.canCreateCustomer
                ? handleCreateCustomer
                : undefined
            }
            onCreateArea={
              mode === 'edit' && permissions.canCreateArea
                ? handleTreeCreateArea
                : undefined
            }
            onCreateSubArea={
              mode === 'edit' && permissions.canCreateSubArea
                ? handleTreeCreateSubArea
                : undefined
            }
            onEditCustomer={
              mode === 'edit' && permissions.canUpdateCustomer
                ? handleEditCustomer
                : undefined
            }
            onEditArea={
              mode === 'edit' && permissions.canUpdateArea
                ? (area) => handleTreeEditArea(area as AreaWithType)
                : undefined
            }
            onEditSubArea={
              mode === 'edit' && permissions.canUpdateSubArea
                ? handleTreeEditSubArea
                : undefined
            }
            onDeleteCustomer={
              mode === 'edit' && permissions.canDeleteCustomer
                ? handleDeleteCustomer
                : undefined
            }
            onDeleteArea={
              mode === 'edit' && permissions.canDeleteArea
                ? (area) => handleTreeDeleteArea(area as AreaWithType)
                : undefined
            }
            onDeleteSubArea={
              mode === 'edit' && permissions.canDeleteSubArea
                ? handleTreeDeleteSubArea
                : undefined
            }
            renderInlineContent={mode === 'edit' ? renderInlineContent : undefined}
            showHeader={false}
            pendingMonitoringCounts={pendingMonitoringCounts}
            monitoringReports={monitoringReports}
          />
        </div>

        {/* Main Panel — context-dependent in edit, map in live */}
        <div className="flex-1 h-[60vh] lg:h-full overflow-hidden">
          {mode === 'edit' ? (
            <ContextPanel
              selectedNode={selectedNode}
              areaType={getAreaTypeForNode(selectedNode)}
              customerAreasMap={customerAreasMap}
              areaSubAreasMap={areaSubAreasMap}
              crops={crops}
              permissions={permissions}
              onRefresh={handleRefreshData}
              onDrillDown={handleDrillDown}
              onEditCustomer={
                permissions.canUpdateCustomer
                  ? handleEditCustomer
                  : undefined
              }
              onDeleteCustomer={
                permissions.canDeleteCustomer
                  ? handleDeleteCustomer
                  : undefined
              }
            />
          ) : getAreaTypeForNode(selectedNode) === 'indoor' && selectedNode ? (
            <LiveIndoorView
              area={(selectedNode.type === 'area'
                ? selectedNode.data
                : (() => {
                    const subArea = selectedNode.data as SubArea;
                    for (const areas of Object.values(customerAreasMap)) {
                      const found = areas.find((a) => a.id === subArea.area_id);
                      if (found) return found;
                    }
                    return null;
                  })()) as AreaWithType}
              subAreas={
                selectedNode.type === 'area'
                  ? areaSubAreasMap[(selectedNode.data as AreaWithType).id] || []
                  : areaSubAreasMap[(selectedNode.data as SubArea).area_id] || []
              }
              selectedSubAreaId={
                selectedNode.type === 'sub_area'
                  ? (selectedNode.data as SubArea).id
                  : undefined
              }
              pendingMonitoringCounts={pendingMonitoringCounts}
              monitoringReports={monitoringReports}
            />
          ) : (
            <LiveMapView
              selectedEntityId={liveMapEntityId}
              fitToEntityId={liveMapEntityId}
              onEntitySelect={handleLiveMapEntitySelect}
            />
          )}
        </div>
      </div>

      {/* Customer Form Dialog */}
      <CustomerForm
        customer={editingCustomer}
        open={customerFormOpen}
        onOpenChange={setCustomerFormOpen}
        onSuccess={handleRefreshData}
      />

      {/* Area type choice (from tree) */}
      <AreaTypeChoiceDialog
        open={treeTypeChoiceOpen}
        onOpenChange={setTreeTypeChoiceOpen}
        onChoose={handleTreeTypeChosen}
      />

      {/* Area create form (from tree) */}
      {treeCreateAreaOpen && treeCreateAreaCustomerId && (
        <AreaForm
          area={null}
          customerId={treeCreateAreaCustomerId}
          crops={crops}
          areaType={treeCreateAreaType}
          open={treeCreateAreaOpen}
          onOpenChange={setTreeCreateAreaOpen}
          onSuccess={handleTreeAreaFormSuccess}
        />
      )}

      {/* Area edit form (from tree) */}
      {treeEditAreaOpen && treeEditingArea && (
        <AreaForm
          area={treeEditingArea}
          crops={crops}
          areaType={treeEditingArea.area_type || 'outdoor'}
          open={treeEditAreaOpen}
          onOpenChange={setTreeEditAreaOpen}
          onSuccess={handleTreeAreaFormSuccess}
        />
      )}

      {/* Sub-area create form (from tree) */}
      {treeCreateSubAreaOpen && treeCreateSubAreaAreaId && (
        <SubAreaForm
          subArea={null}
          areaId={treeCreateSubAreaAreaId}
          subAreas={getAllSubAreas(treeCreateSubAreaAreaId)}
          crops={crops}
          areaType={getAreaTypeById(treeCreateSubAreaAreaId)}
          createSubArea={
            treeCreateSubAreaParentId
              ? { parentId: treeCreateSubAreaParentId }
              : undefined
          }
          open={treeCreateSubAreaOpen}
          onOpenChange={setTreeCreateSubAreaOpen}
          onSuccess={handleTreeSubAreaFormSuccess}
        />
      )}

      {/* Sub-area edit form (from tree) */}
      {treeEditSubAreaOpen && treeEditingSubArea && (
        <SubAreaForm
          subArea={treeEditingSubArea}
          areaId={treeEditingSubArea.area_id}
          subAreas={getAllSubAreas(treeEditingSubArea.area_id)}
          crops={crops}
          areaType={getAreaTypeById(treeEditingSubArea.area_id)}
          open={treeEditSubAreaOpen}
          onOpenChange={setTreeEditSubAreaOpen}
          onSuccess={handleTreeSubAreaFormSuccess}
        />
      )}

      {/* Delete confirmation (from tree) */}
      {deleteDialogOpen && deletingItem && (
        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={deletingItem.type === 'area' ? 'מחיקת שטח' : 'מחיקת תת-שטח'}
          description={
            deletingItem.type === 'area'
              ? `האם אתה בטוח שברצונך למחוק את השטח "${deletingItem.data.name}"? פעולה זו תמחק גם את כל תת-השטחים הקשורים.`
              : `האם אתה בטוח שברצונך למחוק את התת-שטח "${deletingItem.data.name}"?`
          }
          confirmText="מחק"
          cancelText="ביטול"
          variant="destructive"
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
