'use client';

import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { HARVESTER_OPTIONS, type Season } from '@/types/database';
import { countActiveHarvestFilters, type HarvestFilters } from '@/lib/olive/harvest-rows';
import { FilterField, OliveFilterPanel } from './OliveFilterPanel';

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
  defaultExpanded?: boolean;
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
  defaultExpanded,
}: HarvestLogToolbarProps) {
  const set = <K extends keyof HarvestFilters>(key: K, value: HarvestFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  return (
    <OliveFilterPanel
      activeCount={countActiveHarvestFilters(filters)}
      shown={shown}
      total={total}
      itemLabel="מעברים"
      onClear={onClear}
      defaultExpanded={defaultExpanded}
      scope={
        // The season sits in the header, not the grid: it is the fetch scope
        // rather than a row filter, and a labelled cell inside a box whose
        // footer says "נקה סינון" would promise a reset that never comes. It
        // also decides what `total` means, so it must survive the collapse.
        <div className="flex items-center gap-2">
          <Label htmlFor="harvest-filter-season" className="olive-muted text-xs">
            עונה
          </Label>
          <Select value={seasonId} onValueChange={onSeasonChange}>
            <SelectTrigger id="harvest-filter-season" size="sm" className="w-[170px]">
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
      }
    >
      <FilterField
        label="חיפוש"
        htmlFor="harvest-filter-search"
        className="sm:col-span-2 lg:col-span-1"
      >
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2" />
          <Input
            id="harvest-filter-search"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="חלקה, מפעיל, מוסקת או הערה..."
            className="pr-9"
          />
        </div>
      </FilterField>

      <FilterField label="חלקה" htmlFor="harvest-filter-plot">
        <SearchableSelect
          id="harvest-filter-plot"
          options={plotOptions}
          value={filters.areaId}
          onValueChange={(value) => set('areaId', value)}
          placeholder="כל החלקות"
          searchPlaceholder="חיפוש חלקה..."
        />
      </FilterField>

      <FilterField label="סוג מוסקת" htmlFor="harvest-filter-harvester">
        <Select value={filters.harvester} onValueChange={(value) => set('harvester', value)}>
          <SelectTrigger id="harvest-filter-harvester" className="w-full">
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
      </FilterField>

      <FilterField label="סיום מסיק" htmlFor="harvest-filter-finality">
        <Select value={filters.finality} onValueChange={(value) => set('finality', value)}>
          <SelectTrigger id="harvest-filter-finality" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">כל המעברים</SelectItem>
            <SelectItem value="final">מעבר אחרון</SelectItem>
            <SelectItem value="partial">מעבר ביניים</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
    </OliveFilterPanel>
  );
}
