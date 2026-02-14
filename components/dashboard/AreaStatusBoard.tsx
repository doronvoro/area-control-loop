'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Search, Zap, CalendarDays } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type AreaStatus = 'all_done' | 'partial' | 'needs_action' | 'no_monitoring';

interface AreaStatusData {
  id: string;
  name: string;
  status: AreaStatus;
  total_findings: number;
  total_treatments: number;
  completed_treatments: number;
  pending_treatments: number;
  last_monitoring: string | null;
  last_action: string | null;
}

const STATUS_CONFIG: Record<AreaStatus, {
  label: string;
  badgeClass: string;
  dotColor: string;
  progressColor: string;
}> = {
  all_done: {
    label: 'טופל',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500',
    progressColor: 'bg-emerald-500',
  },
  partial: {
    label: 'בטיפול',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-500',
    progressColor: 'bg-amber-500',
  },
  needs_action: {
    label: 'דורש טיפול',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    dotColor: 'bg-red-500',
    progressColor: 'bg-red-500',
  },
  no_monitoring: {
    label: 'לא נבדק',
    badgeClass: 'bg-gray-50 text-gray-500 border-gray-200',
    dotColor: 'bg-gray-400',
    progressColor: 'bg-gray-400',
  },
};

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return 'אין';
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: he,
    });
  } catch {
    return 'לא ידוע';
  }
}

export function AreaStatusBoard() {
  const [areas, setAreas] = useState<AreaStatusData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchAreaStatus() {
      try {
        setLoading(true);
        const response = await fetch('/api/areas/status');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'שגיאה בטעינת סטטוס שטחים');
        }
        const data = await response.json();
        setAreas(data.areas || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'שגיאה בטעינת סטטוס שטחים');
      } finally {
        setLoading(false);
      }
    }
    fetchAreaStatus();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary me-2" />
        <span className="text-muted-foreground">טוען סטטוס שטחים...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <div className="text-center py-12">
        <MapPin className="size-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-lg">אין שטחים להצגה</p>
        <p className="text-sm text-muted-foreground mt-1">
          לא נמצאו שטחים משויכים לחשבון שלך
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {areas.map((area) => {
        const config = STATUS_CONFIG[area.status];
        const completionPercent = area.total_treatments > 0
          ? Math.round((area.completed_treatments / area.total_treatments) * 100)
          : 0;

        return (
          <Card
            key={area.id}
            className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20"
            onClick={() => router.push(`/actions?areaId=${area.id}`)}
          >
            <CardContent className="p-5 space-y-3">
              {/* Header: area name + status badge */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-base truncate">
                  {area.name}
                </h3>
                <Badge
                  variant="outline"
                  className={cn('shrink-0 gap-1.5', config.badgeClass)}
                >
                  <span className={cn('size-2 rounded-full', config.dotColor)} />
                  {config.label}
                </Badge>
              </div>

              {/* Findings + treatments count */}
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
                      className={cn(
                        'h-2 rounded-full transition-all',
                        config.progressColor
                      )}
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-end">
                    {completionPercent}%
                  </p>
                </div>
              )}

              {/* Dates */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t">
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3" />
                  ניטור: {formatRelativeDate(area.last_monitoring)}
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="size-3" />
                  פעולה: {formatRelativeDate(area.last_action)}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
