import { useMemo } from 'react';
import type {
  DesignerState,
  GeneratedSubArea,
  TreeNode,
  BreadcrumbSegment,
  SelectionContext,
} from '../types';
import { getBounds } from '../geometry/geometry-utils';

/**
 * Build a tree structure from the flat generatedSubAreas array.
 */
function buildTree(subAreas: GeneratedSubArea[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes
  for (const sa of subAreas) {
    nodeMap.set(sa.tempId, {
      id: sa.tempId,
      name: sa.name,
      level: sa.level,
      geometry: sa.geometry,
      children: [],
      parentId: sa.parentTempId,
    });
  }

  // Link children to parents
  for (const sa of subAreas) {
    const node = nodeMap.get(sa.tempId)!;
    if (sa.parentTempId) {
      const parent = nodeMap.get(sa.parentTempId);
      if (parent) {
        parent.children.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  return roots;
}

/**
 * Compute the breadcrumb path from root to the selected node.
 */
function computeBreadcrumb(
  selectedNodeId: string | null,
  areaName: string,
  subAreas: GeneratedSubArea[]
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [
    { id: 'root', name: areaName || 'שטח חדש', level: 0 },
  ];

  if (!selectedNodeId || selectedNodeId === 'root') return segments;

  // Build path from selected node up to root
  const path: BreadcrumbSegment[] = [];
  let currentId: string | null = selectedNodeId;

  while (currentId) {
    const sa = subAreas.find((s) => s.tempId === currentId);
    if (!sa) break;
    path.unshift({ id: sa.tempId, name: sa.name, level: sa.level });
    currentId = sa.parentTempId;
  }

  return [...segments, ...path];
}

/**
 * Compute the selection context for the canvas: which nodes are highlighted,
 * which are dimmed, and what geometry to zoom to.
 */
function computeSelectionContext(
  selectedNodeId: string | null,
  subAreas: GeneratedSubArea[]
): SelectionContext {
  if (!selectedNodeId || selectedNodeId === 'root') {
    return {
      selectedId: selectedNodeId,
      highlightedIds: new Set(),
      zoomTarget: null,
    };
  }

  const highlighted = new Set<string>();
  const selected = subAreas.find((sa) => sa.tempId === selectedNodeId);

  if (!selected) {
    return { selectedId: null, highlightedIds: new Set(), zoomTarget: null };
  }

  // Add selected
  highlighted.add(selected.tempId);

  // Add all ancestors
  let current: GeneratedSubArea | undefined = selected;
  while (current?.parentTempId) {
    highlighted.add(current.parentTempId);
    current = subAreas.find((sa) => sa.tempId === current!.parentTempId);
  }

  // Add all descendants recursively
  function addDescendants(parentId: string) {
    for (const sa of subAreas) {
      if (sa.parentTempId === parentId) {
        highlighted.add(sa.tempId);
        addDescendants(sa.tempId);
      }
    }
  }
  addDescendants(selectedNodeId);

  return {
    selectedId: selectedNodeId,
    highlightedIds: highlighted,
    zoomTarget: selected.geometry,
  };
}

/**
 * Pure computation hook that derives tree structure, breadcrumb, and
 * selection context from the designer state.
 */
export function useTreeData(state: DesignerState) {
  const tree = useMemo(
    () => buildTree(state.generatedSubAreas),
    [state.generatedSubAreas]
  );

  const breadcrumb = useMemo(
    () =>
      computeBreadcrumb(
        state.selectedNodeId,
        state.areaName,
        state.generatedSubAreas
      ),
    [state.selectedNodeId, state.areaName, state.generatedSubAreas]
  );

  const selectionContext = useMemo(
    () =>
      computeSelectionContext(state.selectedNodeId, state.generatedSubAreas),
    [state.selectedNodeId, state.generatedSubAreas]
  );

  const selectedNodeDimensions = useMemo(() => {
    if (!state.selectedNodeId || state.selectedNodeId === 'root') {
      return state.width > 0 && state.height > 0
        ? { width: state.width, height: state.height }
        : null;
    }
    const sa = state.generatedSubAreas.find(
      (s) => s.tempId === state.selectedNodeId
    );
    if (!sa) return null;
    const bounds = getBounds(sa.geometry);
    return {
      width: Math.round((bounds.maxX - bounds.minX) * 10) / 10,
      height: Math.round((bounds.maxY - bounds.minY) * 10) / 10,
    };
  }, [state.selectedNodeId, state.generatedSubAreas, state.width, state.height]);

  return { tree, breadcrumb, selectionContext, selectedNodeDimensions };
}
