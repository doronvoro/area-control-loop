'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronDown,
  ChevronLeft,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { InlineTemplateForm } from './InlineTemplateForm';
import { getStyleForLevel } from '../canvas/indoor-canvas-styles';
import type { TreeNode, InlineTemplateFormData } from '../types';

interface TreeNodeItemProps {
  node: TreeNode;
  siblingCount: number;
  selectedNodeId: string | null;
  activeTemplateNodeId: string | null;
  renamingNodeId: string | null;
  depth: number;
  onSelectNode: (nodeId: string) => void;
  onAddChildren: (parentId: string, config: InlineTemplateFormData) => void;
  onAddChildrenToSiblings: (parentId: string, config: InlineTemplateFormData) => void;
  onAddSingleChild: (parentId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string, newName: string) => void;
  onOpenTemplate: (nodeId: string | null) => void;
  onStartRename: (nodeId: string | null) => void;
}

export function TreeNodeItem({
  node,
  siblingCount,
  selectedNodeId,
  activeTemplateNodeId,
  renamingNodeId,
  depth,
  onSelectNode,
  onAddChildren,
  onAddChildrenToSiblings,
  onAddSingleChild,
  onDeleteNode,
  onRenameNode,
  onOpenTemplate,
  onStartRename,
}: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(node.level === 0);
  const [renameValue, setRenameValue] = useState(node.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const hasChildren = node.children.length > 0;
  const isSelected = selectedNodeId === node.id;
  const isRenaming = renamingNodeId === node.id;
  const showTemplate = activeTemplateNodeId === node.id;
  const style = getStyleForLevel(node.level);
  const isRoot = node.id === 'root';

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  // Sync rename value when node name changes externally
  useEffect(() => {
    setRenameValue(node.name);
  }, [node.name]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== node.name) {
      onRenameNode(node.id, trimmed);
    } else {
      onStartRename(null);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setRenameValue(node.name);
      onStartRename(null);
    }
  };

  return (
    <div>
      {/* Node row */}
      <div
        className={`group flex items-center gap-1 py-1 px-1.5 rounded cursor-pointer transition-colors ${
          isSelected
            ? 'bg-primary/10 ring-1 ring-primary/30'
            : 'hover:bg-muted/50'
        }`}
        style={{ paddingInlineStart: `${depth * 16 + 4}px` }}
        onClick={() => onSelectNode(node.id)}
      >
        {/* Expand/collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="shrink-0 p-0.5 rounded hover:bg-muted"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-[18px] shrink-0" />
        )}

        {/* Color swatch */}
        <span
          className="w-2.5 h-2.5 rounded-sm shrink-0 border"
          style={{
            backgroundColor: style.fillColor,
            borderColor: style.color,
            opacity: 0.8,
          }}
        />

        {/* Name or rename input */}
        {isRenaming && !isRoot ? (
          <Input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="h-6 text-xs flex-1 min-w-0 px-1"
          />
        ) : (
          <span className="text-sm truncate flex-1 min-w-0">{node.name}</span>
        )}

        {/* Action buttons */}
        <div
          className={`flex items-center gap-0.5 shrink-0 ${
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } transition-opacity`}
        >
          {/* Add children */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onOpenTemplate(showTemplate ? null : node.id);
            }}
            title="הוסף תתי-שטחים"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>

          {/* Rename (not on root) */}
          {!isRoot && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onStartRename(isRenaming ? null : node.id);
              }}
              title="שנה שם"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}

          {/* Delete (not on root) */}
          {!isRoot && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNode(node.id);
              }}
              title="מחק"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Inline template form */}
      {showTemplate && (
        <InlineTemplateForm
          parentNode={node}
          hasExistingChildren={hasChildren}
          siblingCount={siblingCount}
          onGenerate={(config) => onAddChildren(node.id, config)}
          onGenerateForAll={(config) => onAddChildrenToSiblings(node.id, config)}
          onCancel={() => onOpenTemplate(null)}
        />
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              siblingCount={node.children.length}
              selectedNodeId={selectedNodeId}
              activeTemplateNodeId={activeTemplateNodeId}
              renamingNodeId={renamingNodeId}
              depth={depth + 1}
              onSelectNode={onSelectNode}
              onAddChildren={onAddChildren}
              onAddChildrenToSiblings={onAddChildrenToSiblings}
              onAddSingleChild={onAddSingleChild}
              onDeleteNode={onDeleteNode}
              onRenameNode={onRenameNode}
              onOpenTemplate={onOpenTemplate}
              onStartRename={onStartRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}
