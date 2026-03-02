'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronLeft,
  Building2,
  Folder,
  FolderOpen,
  Loader2,
  Warehouse,
  MapPinned,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';

interface HierarchyTreeNodeProps {
  nodeType: 'customer' | 'area' | 'sub_area';
  id: string;
  name: string;
  hasChildren: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  isLoading?: boolean;
  areaType?: 'indoor' | 'outdoor';
  depth: number;
  onToggleExpand: () => void;
  onSelect: () => void;
  onCreateChild?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function HierarchyTreeNode({
  nodeType,
  name,
  hasChildren,
  isExpanded,
  isSelected,
  isLoading,
  areaType,
  depth,
  onToggleExpand,
  onSelect,
  onCreateChild,
  onEdit,
  onDelete,
}: HierarchyTreeNodeProps) {
  const getIcon = () => {
    switch (nodeType) {
      case 'customer':
        return <Building2 className="h-4 w-4 text-blue-500" />;
      case 'area':
        if (areaType === 'indoor') {
          return <Warehouse className="h-4 w-4 text-purple-500" />;
        }
        return <MapPinned className="h-4 w-4 text-green-500" />;
      case 'sub_area':
        return isExpanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500" />
        );
    }
  };

  const hasActions = onCreateChild || onEdit || onDelete;

  return (
    <div
      className={cn(
        'group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
        'hover:bg-muted',
        isSelected && 'bg-accent'
      )}
      style={{ paddingRight: `${depth * 1.5 + 0.5}rem` }}
      onClick={onSelect}
    >
      {hasChildren ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-transparent"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      ) : (
        <div className="w-6" />
      )}
      {getIcon()}
      <span className="text-sm font-medium truncate flex-1">{name}</span>

      {/* Action buttons — visible on hover */}
      {hasActions && (
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
          {onCreateChild && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              title={nodeType === 'customer' ? 'הוסף שטח' : 'הוסף תת-שטח'}
              onClick={(e) => {
                e.stopPropagation();
                onCreateChild();
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              title="ערוך"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-destructive"
              title="מחק"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
