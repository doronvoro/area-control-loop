'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SubAreaRow } from './SubAreaRow';
import type {
  AreaStatusData,
  SubAreaTreeNode,
  FlatSubArea,
  ActionTask,
  CompletedTaskData,
  RefItem,
  STATUS_CONFIG as StatusConfigType,
} from './types';
import { STATUS_CONFIG } from './types';

interface AreaMapCardProps {
  area: AreaStatusData;
  subAreas: FlatSubArea[];
  tasksBySubAreaId: Record<string, ActionTask[]>;
  expandedSubAreas: Set<string>;
  onToggleSubArea: (subAreaId: string) => void;
  onTaskComplete: (data: CompletedTaskData) => void;
  disabled: boolean;
  actionTypes: RefItem[];
  materials: RefItem[];
  unitTypes: RefItem[];
}

export function flattenTree(
  nodes: SubAreaTreeNode[],
  depth: number,
  tasksBySubAreaId: Record<string, ActionTask[]>,
): FlatSubArea[] {
  const result: FlatSubArea[] = [];
  for (const node of nodes) {
    const hasChildren = (node.children?.length ?? 0) > 0;
    const taskCount = tasksBySubAreaId[node.id]?.length ?? 0;
    result.push({
      id: node.id,
      name: node.name,
      display: node.display,
      variety: node.variety,
      rows: node.rows,
      depth,
      hasChildren,
      taskCount,
    });
    if (hasChildren) {
      result.push(...flattenTree(node.children, depth + 1, tasksBySubAreaId));
    }
  }
  return result;
}

export function AreaMapCard({
  area,
  subAreas,
  tasksBySubAreaId,
  expandedSubAreas,
  onToggleSubArea,
  onTaskComplete,
  disabled,
  actionTypes,
  materials,
  unitTypes,
}: AreaMapCardProps) {
  const config = STATUS_CONFIG[area.status];
  const completionPercent = area.total_treatments > 0
    ? Math.round((area.completed_treatments / area.total_treatments) * 100)
    : 0;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {/* Area header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold">{area.name}</h3>
          <Badge
            variant="outline"
            className={cn('shrink-0 gap-1.5', config.badgeClass)}
          >
            <span className={cn('size-2 rounded-full', config.dotColor)} />
            {config.label}
          </Badge>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Search className="size-3.5" />
            {area.total_findings} ממצאים
          </span>
          {area.total_treatments > 0 && (
            <span className="flex items-center gap-1">
              <Zap className="size-3.5" />
              {area.completed_treatments}/{area.total_treatments} טיפולים
            </span>
          )}
        </div>

        {/* Progress bar */}
        {area.total_treatments > 0 && (
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={cn('h-2 rounded-full transition-all', config.progressColor)}
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-end">{completionPercent}%</p>
          </div>
        )}

        {/* Sub-areas list */}
        {subAreas.length > 0 && (
          <div className="border-t pt-3 -mx-2">
            {subAreas.map((sa) => (
              <SubAreaRow
                key={sa.id}
                subArea={sa}
                tasks={tasksBySubAreaId[sa.id] || []}
                isExpanded={expandedSubAreas.has(sa.id)}
                onToggle={() => onToggleSubArea(sa.id)}
                onTaskComplete={onTaskComplete}
                disabled={disabled}
                actionTypes={actionTypes}
                materials={materials}
                unitTypes={unitTypes}
              />
            ))}
          </div>
        )}

        {subAreas.length === 0 && area.status === 'no_monitoring' && (
          <p className="text-sm text-muted-foreground">אין תתי-שטחים או נתוני ניטור</p>
        )}
      </CardContent>
    </Card>
  );
}
