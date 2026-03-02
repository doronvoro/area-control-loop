'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Download,
  Loader2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  FileText,
  ChevronDown,
  ChevronLeft,
  CornerDownLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ReportDetailSheet } from './ReportDetailSheet';
import { STATUS_LABELS, REPORT_TYPE_LABELS } from '@/lib/reports/labels';

const STATUS_BADGE_CONFIG: Record<string, { className: string; dotColor: string }> = {
  completed: {
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  in_progress: {
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-500',
  },
  pending: {
    className: 'bg-gray-50 text-gray-500 border-gray-200',
    dotColor: 'bg-gray-400',
  },
};

const TYPE_BADGE_CONFIG: Record<string, string> = {
  monitoring: 'bg-blue-50 text-blue-700 border-blue-200',
  action: 'bg-orange-50 text-orange-700 border-orange-200',
};

interface ReportAreaData {
  id: string;
  name: string;
  area_type?: { id: string; name: string; display_name: string };
  description?: string;
  status: string;
  created_at: string;
  report_number?: number;
  area?: { id: string; name: string };
  worker?: { id: string; name: string };
  linked_action_report_ids?: string[];
}

interface ReportsTableProps {
  reportAreas: ReportAreaData[];
}

export function ReportsTable({ reportAreas }: ReportsTableProps) {
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [sortField, setSortField] = useState<'date' | 'report_number'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    const monitoringWithLinks = reportAreas
      .filter((r) => r.linked_action_report_ids && r.linked_action_report_ids.length > 0)
      .map((r) => r.id);
    if (monitoringWithLinks.length > 0) {
      setExpandedRows(new Set(monitoringWithLinks));
    }
  }, [reportAreas]);

  const hasActiveFilters = searchQuery !== '' || filterType !== 'all' || filterStatus !== 'all';

  const childActionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of reportAreas) {
      if (r.linked_action_report_ids) {
        for (const id of r.linked_action_report_ids) {
          ids.add(id);
        }
      }
    }
    return ids;
  }, [reportAreas]);

  const reportMap = useMemo(() => {
    const map = new Map<string, ReportAreaData>();
    for (const r of reportAreas) {
      map.set(r.id, r);
    }
    return map;
  }, [reportAreas]);

  const filteredAndSortedReports = useMemo(() => {
    const topLevel = reportAreas.filter((r) => !childActionIds.has(r.id));
    let result = [...topLevel];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (r) =>
          (r.area?.name || '').toLowerCase().includes(query) ||
          (r.worker?.name || '').toLowerCase().includes(query)
      );
    }

    if (filterType !== 'all') {
      result = result.filter((r) => r.area_type?.name === filterType);
    }

    if (filterStatus !== 'all') {
      result = result.filter((r) => r.status === filterStatus);
    }

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else {
        comparison = (a.report_number || 0) - (b.report_number || 0);
      }
      return sortDirection === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [reportAreas, childActionIds, searchQuery, filterType, filterStatus, sortField, sortDirection]);

  function handleRowClick(reportId: string) {
    setSelectedReportId(reportId);
    setSheetOpen(true);
  }

  function toggleExpand(e: React.MouseEvent, reportId: string) {
    e.stopPropagation();
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  }

  function clearFilters() {
    setSearchQuery('');
    setFilterType('all');
    setFilterStatus('all');
  }

  function handleSort(field: 'date' | 'report_number') {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }

  function getSortIcon(field: 'date' | 'report_number') {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 me-1 opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 me-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 me-1" />
    );
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const response = await fetch('/api/reports/export');
      if (!response.ok) throw new Error('שגיאה בהורדת הקובץ');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        response.headers
          .get('Content-Disposition')
          ?.match(/filename="(.+)"/)?.[1] || 'reports.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('שגיאה בהורדת הקובץ');
    } finally {
      setDownloading(false);
    }
  }

  function renderRow(report: ReportAreaData, isChild = false) {
    const hasChildren = (report.linked_action_report_ids?.length ?? 0) > 0;
    const isExpanded = expandedRows.has(report.id);

    return (
      <TableRow
        key={report.id}
        className={cn(
          'cursor-pointer',
          isChild ? 'bg-muted/40 hover:bg-muted/60' : 'hover:bg-muted/50'
        )}
        onClick={() => handleRowClick(report.id)}
      >
        <TableCell className="w-8 p-1 text-center">
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpand(e, report.id)}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : isChild ? (
            <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground/50 mx-auto" />
          ) : null}
        </TableCell>
        <TableCell className={cn('tabular-nums', isChild ? 'text-sm' : 'font-bold text-base')}>
          {report.report_number || '-'}
        </TableCell>
        <TableCell className="text-muted-foreground tabular-nums">
          {new Date(report.created_at).toLocaleDateString('he-IL')}{' '}
          {new Date(report.created_at).toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </TableCell>
        <TableCell>{report.area?.name || '-'}</TableCell>
        <TableCell>{report.worker?.name || '-'}</TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn(TYPE_BADGE_CONFIG[report.area_type?.name || ''])}
          >
            {report.area_type?.display_name ||
              REPORT_TYPE_LABELS[report.area_type?.name || ''] ||
              report.area_type?.name}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn('gap-1.5', STATUS_BADGE_CONFIG[report.status]?.className)}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                STATUS_BADGE_CONFIG[report.status]?.dotColor
              )}
            />
            {STATUS_LABELS[report.status] || report.status}
          </Badge>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>דוחות שטחים</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {reportAreas.length}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={downloading || reportAreas.length === 0}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>הורדה לאקסל</span>
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="חיפוש לפי שטח או עובד..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]" size="sm">
                <SelectValue placeholder="סוג דוח" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוגים</SelectItem>
                <SelectItem value="monitoring">ניטור</SelectItem>
                <SelectItem value="action">פעולה</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]" size="sm">
                <SelectValue placeholder="סטטוס" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסטטוסים</SelectItem>
                <SelectItem value="pending">ממתין</SelectItem>
                <SelectItem value="in_progress">בביצוע</SelectItem>
                <SelectItem value="completed">הושלם</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-4 w-4 me-1" />
                נקה סינון
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <p className="text-sm text-muted-foreground mb-3">
              מציג {filteredAndSortedReports.length} מתוך {reportAreas.length} דוחות
            </p>
          )}

          {reportAreas.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground text-lg">אין דוחות</p>
              <p className="text-sm text-muted-foreground mt-1">
                דוחות ניטור ופעולות יופיעו כאן
              </p>
            </div>
          )}

          {reportAreas.length > 0 && filteredAndSortedReports.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground text-lg">לא נמצאו דוחות</p>
              <p className="text-sm text-muted-foreground mt-1">
                נסה לשנות את מסנני החיפוש
              </p>
              <Button variant="link" onClick={clearFilters} className="mt-2">
                נקה סינון
              </Button>
            </div>
          )}

          {filteredAndSortedReports.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>
                    <button
                      onClick={() => handleSort('report_number')}
                      className="flex items-center font-medium hover:text-foreground transition-colors"
                    >
                      {getSortIcon('report_number')}
                      מס׳ דוח
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center font-medium hover:text-foreground transition-colors"
                    >
                      {getSortIcon('date')}
                      תאריך
                    </button>
                  </TableHead>
                  <TableHead>שטח</TableHead>
                  <TableHead>עובד</TableHead>
                  <TableHead>סוג</TableHead>
                  <TableHead>סטטוס</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const rendered = new Set<string>();
                  return filteredAndSortedReports.flatMap((reportArea) => {
                    if (rendered.has(reportArea.id)) return [];
                    rendered.add(reportArea.id);
                    const rows: React.ReactNode[] = [renderRow(reportArea)];

                    if (
                      expandedRows.has(reportArea.id) &&
                      reportArea.linked_action_report_ids?.length
                    ) {
                      for (const childId of reportArea.linked_action_report_ids) {
                        if (rendered.has(childId)) continue;
                        rendered.add(childId);
                        const child = reportMap.get(childId);
                        if (child) rows.push(renderRow(child, true));
                      }
                    }

                    return rows;
                  });
                })()}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ReportDetailSheet
        reportId={selectedReportId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
