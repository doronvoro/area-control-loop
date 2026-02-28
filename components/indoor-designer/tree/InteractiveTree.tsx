'use client';

import { useMemo } from 'react';
import { TreeNodeItem } from './TreeNodeItem';
import type {
  GeneratedSubArea,
  TreeNode,
  InlineTemplateFormData,
} from '../types';
import type { GeoJSONPolygon } from '@/components/map/types';

interface InteractiveTreeProps {
  areaName: string;
  areaGeometry: GeoJSONPolygon | null;
  subAreas: GeneratedSubArea[];
  tree: TreeNode[];
  selectedNodeId: string | null;
  activeTemplateNodeId: string | null;
  renamingNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onAddChildren: (parentId: string, config: InlineTemplateFormData) => void;
  onAddChildrenToSiblings: (parentId: string, config: InlineTemplateFormData) => void;
  onAddSingleChild: (parentId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
  onOpenTemplate: (nodeId: string | null) => void;
  onStartRename: (nodeId: string | null) => void;
}

export function InteractiveTree({
  areaName,
  areaGeometry,
  subAreas,
  tree,
  selectedNodeId,
  activeTemplateNodeId,
  renamingNodeId,
  onSelectNode,
  onAddChildren,
  onAddChildrenToSiblings,
  onAddSingleChild,
  onDeleteNode,
  onRenameNode,
  onOpenTemplate,
  onStartRename,
}: InteractiveTreeProps) {
  // Create virtual root node for the area
  const rootNode: TreeNode = useMemo(
    () => ({
      id: 'root',
      name: areaName || 'שטח חדש',
      level: 0,
      geometry: areaGeometry,
      children: tree,
      parentId: null,
    }),
    [areaName, areaGeometry, tree]
  );

  return (
    <div className="py-1">
      {subAreas.length === 0 && !activeTemplateNodeId ? (
        // Show root node + empty state prompt
        <div>
          <TreeNodeItem
            node={{ ...rootNode, children: [] }}
            siblingCount={1}
            selectedNodeId={selectedNodeId}
            activeTemplateNodeId={activeTemplateNodeId}
            renamingNodeId={renamingNodeId}
            depth={0}
            onSelectNode={onSelectNode}
            onAddChildren={onAddChildren}
            onAddChildrenToSiblings={onAddChildrenToSiblings}
            onAddSingleChild={onAddSingleChild}
            onDeleteNode={onDeleteNode}
            onRenameNode={onRenameNode}
            onOpenTemplate={onOpenTemplate}
            onStartRename={onStartRename}
          />
          {areaGeometry && (
            <div className="text-center py-6 px-4">
              <p className="text-sm text-muted-foreground">
                לחץ על <strong>+</strong> כדי להוסיף תתי-שטחים
              </p>
            </div>
          )}
          {!areaGeometry && (
            <div className="text-center py-6 px-4">
              <p className="text-sm text-muted-foreground">
                הגדר שם ומימדים כדי להתחיל
              </p>
            </div>
          )}
        </div>
      ) : (
        <TreeNodeItem
          node={rootNode}
          siblingCount={1}
          selectedNodeId={selectedNodeId}
          activeTemplateNodeId={activeTemplateNodeId}
          renamingNodeId={renamingNodeId}
          depth={0}
          onSelectNode={onSelectNode}
          onAddChildren={onAddChildren}
          onAddChildrenToSiblings={onAddChildrenToSiblings}
          onAddSingleChild={onAddSingleChild}
          onDeleteNode={onDeleteNode}
          onRenameNode={onRenameNode}
          onOpenTemplate={onOpenTemplate}
          onStartRename={onStartRename}
        />
      )}
    </div>
  );
}
