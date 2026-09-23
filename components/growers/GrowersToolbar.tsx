'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PLOT_TYPE_OPTIONS } from '@/types/database';
import {
  hasActiveGrowerFilters,
  UNCLASSIFIED_LABEL,
  type GrowerFilters,
} from '@/lib/growers/grower-rows';

interface GrowersToolbarProps {
  filters: GrowerFilters;
  onFiltersChange: (next: GrowerFilters) => void;
  onClear: () => void;
  shown: number;
  total: number;
}

export function GrowersToolbar({
  filters,
  onFiltersChange,
  onClear,
  shown,
  total,
}: GrowersToolbarProps) {
  const set = <K extends keyof GrowerFilters>(key: K, value: GrowerFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  const active = hasActiveGrowerFilters(filters);

  return (
    <div className="space-y-2 p-4 pb-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2" />
          <Input
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="חיפוש לפי שם, איש קשר, טלפון או עיר"
            className="h-9 pr-9"
            aria-label="חיפוש מגדלים"
          />
        </div>

        <Select value={filters.growerType} onValueChange={(value) => set('growerType', value)}>
          <SelectTrigger className="h-9 w-[150px]" aria-label="סוג מגדל">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">כל הסוגים</SelectItem>
            {PLOT_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
            <SelectItem value="none">{UNCLASSIFIED_LABEL}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.plots} onValueChange={(value) => set('plots', value)}>
          <SelectTrigger className="h-9 w-[150px]" aria-label="חלקות">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">כל המגדלים</SelectItem>
            <SelectItem value="with">עם חלקות</SelectItem>
            <SelectItem value="without">ללא חלקות</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={(value) => set('status', value)}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="סטטוס">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">פעילים ולא פעילים</SelectItem>
            <SelectItem value="active">פעילים</SelectItem>
            <SelectItem value="inactive">לא פעילים</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {active && (
        <div className="flex items-center gap-3">
          <span className="olive-muted text-xs">
            מציג {shown} מתוך {total} מגדלים
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
            <X className="ml-1 size-3.5" />
            נקה סינון
          </Button>
        </div>
      )}
    </div>
  );
}
