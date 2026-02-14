'use client';

import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { TaskCard } from '@/components/actions/TaskCard';
import { ChevronLeft, Folder, FolderOpen, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FlatSubArea, ActionTask, CompletedTaskData, RefItem } from './types';

interface SubAreaRowProps {
  subArea: FlatSubArea;
  tasks: ActionTask[];
  isExpanded: boolean;
  onToggle: () => void;
  onTaskComplete: (data: CompletedTaskData) => void;
  disabled: boolean;
  actionTypes: RefItem[];
  materials: RefItem[];
  unitTypes: RefItem[];
}

export function SubAreaRow({
  subArea,
  tasks,
  isExpanded,
  onToggle,
  onTaskComplete,
  disabled,
  actionTypes,
  materials,
  unitTypes,
}: SubAreaRowProps) {
  const hasTasks = subArea.taskCount > 0;
  const indentPx = (subArea.depth + 1) * 16;

  return (
    <Collapsible open={isExpanded} onOpenChange={hasTasks ? onToggle : undefined}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            'flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors',
            hasTasks ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default',
          )}
          style={{ paddingInlineStart: `${indentPx}px` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasTasks ? (
              <ChevronLeft
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform',
                  isExpanded && '-rotate-90',
                )}
              />
            ) : (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
            )}
            {isExpanded ? (
              <FolderOpen className="size-4 shrink-0 text-amber-500" />
            ) : (
              <Folder className="size-4 shrink-0 text-amber-500" />
            )}
            <span className="font-medium text-sm truncate">
              {subArea.display || subArea.name}
            </span>
            {subArea.variety && (
              <span className="text-xs text-muted-foreground truncate">
                ({subArea.variety})
              </span>
            )}
            {subArea.rows && (
              <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                שורות: {subArea.rows}
              </span>
            )}
          </div>

          <div className="shrink-0 ms-2">
            {hasTasks ? (
              <Badge variant="destructive" className="text-xs">
                {subArea.taskCount} {subArea.taskCount === 1 ? 'משימה' : 'משימות'}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
              >
                הושלם
              </Badge>
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div
          className="space-y-2 py-2"
          style={{ paddingInlineStart: `${indentPx + 32}px`, paddingInlineEnd: '12px' }}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.monitoring_treatment_id}
              task={task}
              onComplete={onTaskComplete}
              disabled={disabled}
              actionTypes={actionTypes}
              materials={materials}
              unitTypes={unitTypes}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
