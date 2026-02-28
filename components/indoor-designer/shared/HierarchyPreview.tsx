'use client';

import { useState } from 'react';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import type { GeneratedSubArea } from '../types';
import { getStyleForLevel } from '../canvas/indoor-canvas-styles';

interface HierarchyPreviewProps {
  areaName: string;
  subAreas: GeneratedSubArea[];
  selectedTempId?: string | null;
  onSelect?: (tempId: string) => void;
}

interface TreeNode {
  subArea: GeneratedSubArea;
  children: TreeNode[];
}

function buildTree(subAreas: GeneratedSubArea[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create nodes
  subAreas.forEach((sa) => {
    nodeMap.set(sa.tempId, { subArea: sa, children: [] });
  });

  // Link children to parents
  subAreas.forEach((sa) => {
    const node = nodeMap.get(sa.tempId)!;
    if (sa.parentTempId) {
      const parent = nodeMap.get(sa.parentTempId);
      if (parent) {
        parent.children.push(node);
        return;
      }
    }
    roots.push(node);
  });

  return roots;
}

function TreeNodeItem({
  node,
  selectedTempId,
  onSelect,
  depth = 0,
}: {
  node: TreeNode;
  selectedTempId?: string | null;
  onSelect?: (tempId: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedTempId === node.subArea.tempId;
  const style = getStyleForLevel(node.subArea.level);

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer hover:bg-muted/50 transition-colors ${
          isSelected ? 'bg-muted ring-1 ring-primary/30' : ''
        }`}
        style={{ paddingInlineStart: `${depth * 16 + 8}px` }}
        onClick={() => {
          onSelect?.(node.subArea.tempId);
          if (hasChildren) setExpanded(!expanded);
        }}
      >
        {hasChildren && (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )
        )}
        {!hasChildren && <span className="w-3.5 shrink-0" />}

        <span
          className="w-2.5 h-2.5 rounded-sm shrink-0 border"
          style={{
            backgroundColor: style.fillColor,
            borderColor: style.color,
            opacity: 0.8,
          }}
        />

        <span className="text-sm truncate">{node.subArea.name}</span>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.subArea.tempId}
              node={child}
              selectedTempId={selectedTempId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function HierarchyPreview({
  areaName,
  subAreas,
  selectedTempId,
  onSelect,
}: HierarchyPreviewProps) {
  const tree = buildTree(subAreas);
  const totalCount = subAreas.length;
  const level1Count = subAreas.filter((sa) => sa.level === 1).length;
  const level2Count = subAreas.filter((sa) => sa.level === 2).length;
  const level3Count = subAreas.filter((sa) => sa.level === 3).length;

  return (
    <div className="border rounded-lg bg-card">
      <div className="p-3 border-b bg-muted/30">
        <div className="font-semibold text-sm">{areaName || 'שטח חדש'}</div>
        <div className="text-xs text-muted-foreground mt-1">
          סה&quot;כ {totalCount} תתי-שטחים
          {level1Count > 0 && ` · ${level1Count} אזורים`}
          {level2Count > 0 && ` · ${level2Count} אשנבים`}
          {level3Count > 0 && ` · ${level3Count} שורות`}
        </div>
      </div>

      <div className="p-1 max-h-80 overflow-y-auto">
        {tree.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            לא הוגדרו חלוקות עדיין
          </div>
        ) : (
          tree.map((node) => (
            <TreeNodeItem
              key={node.subArea.tempId}
              node={node}
              selectedTempId={selectedTempId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
