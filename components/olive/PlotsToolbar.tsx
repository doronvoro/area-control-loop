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
import { PLOT_CATEGORY_CARDS } from '@/lib/olive/constants';
import { hasActivePlotFilters, type PlotFilters } from '@/lib/olive/plot-rows';

interface PlotsToolbarProps {
  filters: PlotFilters;
  onFiltersChange: (next: PlotFilters) => void;
  onClear: () => void;
  shown: number;
  total: number;
}

export function PlotsToolbar({
  filters,
  onFiltersChange,
  onClear,
  shown,
  total,
}: PlotsToolbarProps) {
  const set = <K extends keyof PlotFilters>(key: K, value: PlotFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  const active = hasActivePlotFilters(filters);

  return (
    <div className="space-y-2 p-4 pb-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2" />
          <Input
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="חיפוש לפי שם, גוש, זן, מגדל — או ראשי תיבות"
            className="h-9 pr-9"
            aria-label="חיפוש חלקות"
          />
        </div>

        <Select value={filters.plotType} onValueChange={(value) => set('plotType', value)}>
          <SelectTrigger className="h-9 w-[150px]" aria-label="סוג מגדל">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">כל המגדלים</SelectItem>
            {PLOT_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Categories come from the same definitions the dashboard's status
            cards use, so the two screens cannot drift apart. */}
        <Select value={filters.category} onValueChange={(value) => set('category', value)}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="קטגוריה">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">כל הקטגוריות</SelectItem>
            {PLOT_CATEGORY_CARDS.map((card) => (
              <SelectItem key={card.key} value={card.key}>
                {card.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.harvest} onValueChange={(value) => set('harvest', value)}>
          <SelectTrigger className="h-9 w-[150px]" aria-label="סטטוס מסיק">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">נמסק ולא נמסק</SelectItem>
            <SelectItem value="active">טרם נמסק</SelectItem>
            <SelectItem value="harvested">נמסק</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.nir} onValueChange={(value) => set('nir', value)}>
          <SelectTrigger className="h-9 w-[160px]" aria-label="בדיקת NIR">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">כל החלקות</SelectItem>
            <SelectItem value="measured">נבדקו</SelectItem>
            <SelectItem value="never">טרם נבדקו</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {active && (
        <div className="flex items-center gap-3">
          <span className="olive-muted text-xs">
            מציג {shown} מתוך {total} חלקות
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
