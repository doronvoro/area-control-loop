'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Building2,
  MapPin,
  Folder,
  FolderOpen,
  Loader2,
} from 'lucide-react';

interface HierarchyTreeNodeProps {
  nodeType: 'customer' | 'area' | 'sub_area';
  id: string;
  name: string;
  hasChildren: boolean;
  isExpanded: boolean;
  isSelected: boolean;
  isLoading?: boolean;
  depth: number;
  onToggleExpand: () => void;
  onSelect: () => void;
}

export function HierarchyTreeNode({
  nodeType,
  id,
  name,
  hasChildren,
  isExpanded,
  isSelected,
  isLoading,
  depth,
  onToggleExpand,
  onSelect,
}: HierarchyTreeNodeProps) {
  const getIcon = () => {
    switch (nodeType) {
      case 'customer':
        return <Building2 className="h-4 w-4 text-blue-500" />;
      case 'area':
        return <MapPin className="h-4 w-4 text-green-500" />;
      case 'sub_area':
        return isExpanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500" />
        );
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors',
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
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      ) : (
        <div className="w-6" />
      )}
      {getIcon()}
      <span className="text-sm font-medium truncate flex-1">{name}</span>
    </div>
  );
}
