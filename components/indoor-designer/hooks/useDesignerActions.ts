import { useCallback } from 'react';
import type {
  DesignerState,
  GeneratedSubArea,
  InlineTemplateFormData,
} from '../types';
import { DEFAULT_LEVEL_PREFIXES } from '../types';
import {
  createRectangleGeometry,
  subdivideRectangle,
  getBounds,
} from '../geometry/geometry-utils';
import type { GeoJSONPolygon } from '@/components/map/types';

/**
 * Hook that provides all mutation actions for the designer state.
 */
export function useDesignerActions(
  state: DesignerState,
  setState: (updates: Partial<DesignerState>) => void
) {
  const setAreaName = useCallback(
    (areaName: string) => setState({ areaName }),
    [setState]
  );

  const setAreaDescription = useCallback(
    (areaDescription: string) => setState({ areaDescription }),
    [setState]
  );

  const setDimensions = useCallback(
    (width: number, height: number) => {
      const areaGeometry =
        width > 0 && height > 0
          ? createRectangleGeometry(0, 0, width, height)
          : null;

      // If sub-areas exist, they become invalid with new dimensions
      // The caller (PageContent) should handle the confirmation dialog
      setState({ width, height, areaGeometry });
    },
    [setState]
  );

  const clearSubAreas = useCallback(() => {
    setState({
      generatedSubAreas: [],
      selectedNodeId: null,
      activeTemplateNodeId: null,
      renamingNodeId: null,
    });
  }, [setState]);

  const selectNode = useCallback(
    (nodeId: string | null) => {
      setState({ selectedNodeId: nodeId });
    },
    [setState]
  );

  const addChildren = useCallback(
    (parentId: string, config: InlineTemplateFormData) => {
      // Find parent geometry
      let parentGeometry: GeoJSONPolygon | null = null;
      let parentLevel = 0;

      if (parentId === 'root') {
        parentGeometry = state.areaGeometry;
        parentLevel = 0;
      } else {
        const parent = state.generatedSubAreas.find(
          (sa) => sa.tempId === parentId
        );
        if (parent) {
          parentGeometry = parent.geometry;
          parentLevel = parent.level;
        }
      }

      if (!parentGeometry || config.count <= 0) return;

      // Remove existing children of this parent (and their descendants)
      const toRemove = new Set<string>();
      function markDescendants(pid: string) {
        for (const sa of state.generatedSubAreas) {
          if (sa.parentTempId === pid) {
            toRemove.add(sa.tempId);
            markDescendants(sa.tempId);
          }
        }
      }
      markDescendants(parentId);

      const remaining = state.generatedSubAreas.filter(
        (sa) => !toRemove.has(sa.tempId)
      );

      // Generate new children
      const childGeometries = subdivideRectangle(
        parentGeometry,
        config.count,
        config.direction
      );

      const newLevel = parentLevel + 1;
      const timestamp = Date.now();

      const newChildren: GeneratedSubArea[] = childGeometries.map(
        (geometry, i) => {
          const name =
            config.naming.type === 'custom' && config.naming.customNames?.[i]
              ? config.naming.customNames[i]
              : `${config.naming.prefix} ${i + 1}`;

          return {
            tempId: `${parentId}_L${newLevel}_${timestamp}_${i}`,
            parentTempId: parentId === 'root' ? null : parentId,
            level: newLevel,
            name,
            geometry,
          };
        }
      );

      setState({
        generatedSubAreas: [...remaining, ...newChildren],
        activeTemplateNodeId: null,
      });
    },
    [state.areaGeometry, state.generatedSubAreas, setState]
  );

  const addChildrenToSiblings = useCallback(
    (parentId: string, config: InlineTemplateFormData) => {
      if (parentId === 'root') {
        // Root has no siblings — fall back to normal addChildren
        addChildren(parentId, config);
        return;
      }

      const target = state.generatedSubAreas.find(
        (sa) => sa.tempId === parentId
      );
      if (!target) return;

      // Find all siblings (same parent + same level), including the target itself
      const siblings = state.generatedSubAreas.filter(
        (sa) =>
          sa.parentTempId === target.parentTempId &&
          sa.level === target.level
      );

      if (siblings.length === 0) return;

      // Collect all children/descendants of ALL siblings to remove
      const toRemove = new Set<string>();
      function markDescendants(pid: string) {
        for (const sa of state.generatedSubAreas) {
          if (sa.parentTempId === pid) {
            toRemove.add(sa.tempId);
            markDescendants(sa.tempId);
          }
        }
      }
      for (const sib of siblings) {
        markDescendants(sib.tempId);
      }

      const remaining = state.generatedSubAreas.filter(
        (sa) => !toRemove.has(sa.tempId)
      );

      // Generate children for each sibling
      const newLevel = target.level + 1;
      const timestamp = Date.now();
      const allNewChildren: GeneratedSubArea[] = [];

      for (let s = 0; s < siblings.length; s++) {
        const sib = siblings[s];
        const childGeometries = subdivideRectangle(
          sib.geometry,
          config.count,
          config.direction
        );

        for (let i = 0; i < childGeometries.length; i++) {
          const name =
            config.naming.type === 'custom' && config.naming.customNames?.[i]
              ? config.naming.customNames[i]
              : `${config.naming.prefix} ${i + 1}`;

          allNewChildren.push({
            tempId: `${sib.tempId}_L${newLevel}_${timestamp}_${i}`,
            parentTempId: sib.tempId,
            level: newLevel,
            name,
            geometry: childGeometries[i],
          });
        }
      }

      setState({
        generatedSubAreas: [...remaining, ...allNewChildren],
        activeTemplateNodeId: null,
      });
    },
    [state.generatedSubAreas, addChildren, setState]
  );

  const addSingleChild = useCallback(
    (parentId: string) => {
      let parentGeometry: GeoJSONPolygon | null = null;
      let parentLevel = 0;

      if (parentId === 'root') {
        parentGeometry = state.areaGeometry;
        parentLevel = 0;
      } else {
        const parent = state.generatedSubAreas.find(
          (sa) => sa.tempId === parentId
        );
        if (parent) {
          parentGeometry = parent.geometry;
          parentLevel = parent.level;
        }
      }

      if (!parentGeometry) return;

      const newLevel = parentLevel + 1;
      const existingChildren = state.generatedSubAreas.filter(
        (sa) =>
          (parentId === 'root' && sa.parentTempId === null && sa.level === 1) ||
          sa.parentTempId === parentId
      );

      const prefix =
        DEFAULT_LEVEL_PREFIXES[newLevel] || `רמה ${newLevel}`;
      const timestamp = Date.now();

      const newChild: GeneratedSubArea = {
        tempId: `${parentId}_L${newLevel}_${timestamp}_${existingChildren.length}`,
        parentTempId: parentId === 'root' ? null : parentId,
        level: newLevel,
        name: `${prefix} ${existingChildren.length + 1}`,
        geometry: parentGeometry, // takes full parent geometry
      };

      setState({
        generatedSubAreas: [...state.generatedSubAreas, newChild],
      });
    },
    [state.areaGeometry, state.generatedSubAreas, setState]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      // Collect this node and all descendants
      const toRemove = new Set<string>([nodeId]);
      function markDescendants(pid: string) {
        for (const sa of state.generatedSubAreas) {
          if (sa.parentTempId === pid) {
            toRemove.add(sa.tempId);
            markDescendants(sa.tempId);
          }
        }
      }
      markDescendants(nodeId);

      const remaining = state.generatedSubAreas.filter(
        (sa) => !toRemove.has(sa.tempId)
      );

      const updates: Partial<DesignerState> = {
        generatedSubAreas: remaining,
      };

      // Clear selection if deleted node was selected
      if (state.selectedNodeId && toRemove.has(state.selectedNodeId)) {
        updates.selectedNodeId = null;
      }

      // Clear template/rename if on a deleted node
      if (
        state.activeTemplateNodeId &&
        toRemove.has(state.activeTemplateNodeId)
      ) {
        updates.activeTemplateNodeId = null;
      }
      if (state.renamingNodeId && toRemove.has(state.renamingNodeId)) {
        updates.renamingNodeId = null;
      }

      setState(updates);
    },
    [state, setState]
  );

  const renameNode = useCallback(
    (nodeId: string, newName: string) => {
      const updated = state.generatedSubAreas.map((sa) =>
        sa.tempId === nodeId ? { ...sa, name: newName } : sa
      );
      setState({ generatedSubAreas: updated, renamingNodeId: null });
    },
    [state.generatedSubAreas, setState]
  );

  const openTemplate = useCallback(
    (nodeId: string | null) => {
      setState({ activeTemplateNodeId: nodeId });
    },
    [setState]
  );

  const startRename = useCallback(
    (nodeId: string | null) => {
      setState({ renamingNodeId: nodeId });
    },
    [setState]
  );

  return {
    setAreaName,
    setAreaDescription,
    setDimensions,
    clearSubAreas,
    selectNode,
    addChildren,
    addChildrenToSiblings,
    addSingleChild,
    deleteNode,
    renameNode,
    openTemplate,
    startRename,
  };
}
