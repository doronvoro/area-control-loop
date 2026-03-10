'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SEVERITY_CONFIG } from './types';
import type { MonitoringReportForMap } from './types';

interface PendingTasksPopoverProps {
  count: number;
  reports: MonitoringReportForMap[];
  size?: 'sm' | 'md';
}

export function PendingTasksPopover({
  count,
  reports,
  size = 'md',
}: PendingTasksPopoverProps) {
  const pending = reports.filter((r) => r.status !== 'completed');

  const badgeSize =
    size === 'sm'
      ? 'min-w-[16px] h-[16px] text-[10px] px-0.5'
      : 'min-w-[18px] h-[18px] text-[10px] px-1';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={`bg-red-500 text-white font-bold rounded-full flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors ${badgeSize}`}
        >
          {count}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-72 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div dir="rtl">
          <div className="px-3 py-2 border-b bg-red-50">
            <span className="text-xs font-semibold text-red-700">
              ממתין לטיפול ({pending.length})
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y">
            {pending.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                אין משימות ממתינות
              </div>
            ) : (
              pending.map((report) => {
                const severity = report.severity
                  ? SEVERITY_CONFIG[report.severity]
                  : null;
                const date = new Date(report.created_at).toLocaleDateString(
                  'he-IL',
                  { day: 'numeric', month: 'short' }
                );

                return (
                  <div
                    key={report.id}
                    className="px-3 py-2 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {severity && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: severity.color }}
                        />
                      )}
                      <span className="text-xs font-medium flex-1 truncate">
                        {report.finding_name}
                      </span>
                      {severity && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white shrink-0"
                          style={{ backgroundColor: severity.color }}
                        >
                          {severity.label}
                        </span>
                      )}
                    </div>

                    {report.treatments.length > 0 && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {report.treatments
                          .map((t) =>
                            [t.action_type_name, t.material_name]
                              .filter(Boolean)
                              .join(' · ')
                          )
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    )}

                    <div className="mt-0.5 text-[10px] text-muted-foreground/70">
                      {date}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
