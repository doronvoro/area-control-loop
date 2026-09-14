'use client';

import { Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { NIR_DIRECTIONS, ParameterStatus, type Season } from '@/types/database';
import { hasActiveNirFilters, type NirFilters } from '@/lib/olive/nir-rows';

const ALL_SEASONS = 'all';

/** Labels for the oil verdict, which is what the status filter reads. */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'כל הסטטוסים' },
  { value: ParameterStatus.URGENT, label: 'מסיק מיידי' },
  { value: ParameterStatus.PLAN, label: 'מתוכנן למסיק' },
  { value: ParameterStatus.OK, label: 'תקין' },
  { value: ParameterStatus.IDLE, label: 'לא מוכן למסיק' },
  { value: 'none', label: 'ללא הערכה' },
];

interface NirLogToolbarProps {
  filters: NirFilters;
  onFiltersChange: (next: NirFilters) => void;
  onClear: () => void;
  plotOptions: SearchableSelectOption[];
  seasons: Season[];
  seasonId: string;
  onSeasonChange: (seasonId: string) => void;
  seasonLoading: boolean;
  shown: number;
  total: number;
}

export function NirLogToolbar({
  filters,
  onFiltersChange,
  onClear,
  plotOptions,
  seasons,
  seasonId,
  onSeasonChange,
  seasonLoading,
  shown,
  total,
}: NirLogToolbarProps) {
  const set = <K extends keyof NirFilters>(key: K, value: NirFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  const active = hasActiveNirFilters(filters);

  return (
    <div className="space-y-2 p-4 pb-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2" />
          <Input
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="חיפוש לפי חלקה, זן, דוגם או הערה..."
            className="h-9 pr-9"
            aria-label="חיפוש בדיקות"
          />
        </div>

        <div className="w-[200px]">
          <SearchableSelect
            options={plotOptions}
            value={filters.areaId}
            onValueChange={(value) => set('areaId', value)}
            placeholder="כל החלקות"
            searchPlaceholder="חיפוש חלקה..."
            className="h-9"
          />
        </div>

        {/* The one control here that goes back to the server — it changes what
            is fetched, not how the fetched rows are filtered. */}
        <div className="flex items-center gap-2">
          <Select value={seasonId} onValueChange={onSeasonChange}>
            <SelectTrigger className="h-9 w-[170px]" aria-label="עונה">
              <SelectValue placeholder="עונה" />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4}>
              {seasons.map((season) => (
                <SelectItem key={season.id} value={season.id}>
                  {season.name}
                </SelectItem>
              ))}
              <SelectItem value={ALL_SEASONS}>כל העונות</SelectItem>
            </SelectContent>
          </Select>
          {seasonLoading && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
        </div>

        <Select value={filters.status} onValueChange={(value) => set('status', value)}>
          <SelectTrigger className="h-9 w-[150px]" aria-label="סטטוס">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.direction} onValueChange={(value) => set('direction', value)}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="כיוון דגימה">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">כל הכיוונים</SelectItem>
            {NIR_DIRECTIONS.map((dir) => (
              <SelectItem key={dir} value={dir}>
                {dir}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {active && (
        <div className="flex items-center gap-3">
          <span className="olive-muted text-xs">
            מציג {shown} מתוך {total} בדיקות
          </span>
          {/* Deliberately does not reset the season: that is the fetch scope,
              and clearing it would fire a request nobody asked for. */}
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
            <X className="ml-1 size-3.5" />
            נקה סינון
          </Button>
        </div>
      )}
    </div>
  );
}
