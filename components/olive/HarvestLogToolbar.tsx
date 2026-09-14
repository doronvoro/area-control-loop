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
import { HARVESTER_OPTIONS, type Season } from '@/types/database';
import { hasActiveHarvestFilters, type HarvestFilters } from '@/lib/olive/harvest-rows';

const ALL_SEASONS = 'all';

interface HarvestLogToolbarProps {
  filters: HarvestFilters;
  onFiltersChange: (next: HarvestFilters) => void;
  onClear: () => void;
  plotOptions: SearchableSelectOption[];
  seasons: Season[];
  seasonId: string;
  onSeasonChange: (seasonId: string) => void;
  seasonLoading: boolean;
  shown: number;
  total: number;
}

export function HarvestLogToolbar({
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
}: HarvestLogToolbarProps) {
  const set = <K extends keyof HarvestFilters>(key: K, value: HarvestFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  const active = hasActiveHarvestFilters(filters);

  return (
    <div className="space-y-2 p-4 pb-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2" />
          <Input
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="חיפוש לפי חלקה, מפעיל, מוסקת או הערה..."
            className="h-9 pr-9"
            aria-label="חיפוש מעברים"
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

        <Select value={filters.harvester} onValueChange={(value) => set('harvester', value)}>
          <SelectTrigger className="h-9 w-[190px]" aria-label="סוג מוסקת">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">כל המוסקות</SelectItem>
            {HARVESTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
            <SelectItem value="none">ללא ציוד רשום</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.finality} onValueChange={(value) => set('finality', value)}>
          <SelectTrigger className="h-9 w-[150px]" aria-label="סיום מסיק">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">כל המעברים</SelectItem>
            <SelectItem value="final">מעבר אחרון</SelectItem>
            <SelectItem value="partial">מעבר ביניים</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {active && (
        <div className="flex items-center gap-3">
          <span className="olive-muted text-xs">
            מציג {shown} מתוך {total} מעברים
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
