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
import { NIR_DIRECTIONS, ParameterStatus, type Season } from '@/types/database';
import { countActiveNirFilters, type NirFilters } from '@/lib/olive/nir-rows';
import { FilterField, OliveFilterPanel } from './OliveFilterPanel';

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
  defaultExpanded?: boolean;
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
  defaultExpanded,
}: NirLogToolbarProps) {
  const set = <K extends keyof NirFilters>(key: K, value: NirFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  return (
    <OliveFilterPanel
      // Five fields now; the default grid suits four. Same override PlotsToolbar
      // uses for its five.
      gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      activeCount={countActiveNirFilters(filters)}
      shown={shown}
      total={total}
      itemLabel="בדיקות"
      onClear={onClear}
      defaultExpanded={defaultExpanded}
      scope={
        // The season sits in the header, not the grid: it is the fetch scope
        // rather than a row filter, and a labelled cell inside a box whose
        // footer says "נקה סינון" would promise a reset that never comes. It
        // also decides what `total` means, so it must survive the collapse.
        <div className="flex items-center gap-2">
          <Label htmlFor="nir-filter-season" className="olive-muted text-xs">
            עונה
          </Label>
          <Select value={seasonId} onValueChange={onSeasonChange}>
            <SelectTrigger id="nir-filter-season" size="sm" className="w-[170px]">
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
        htmlFor="nir-filter-search"
        className="sm:col-span-2 lg:col-span-1"
      >
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2" />
          <Input
            id="nir-filter-search"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="חלקה, זן, דוגם או הערה..."
            className="pr-9"
          />
        </div>
      </FilterField>

      <FilterField label="חלקה" htmlFor="nir-filter-plot">
        <SearchableSelect
          id="nir-filter-plot"
          options={plotOptions}
          value={filters.areaId}
          onValueChange={(value) => set('areaId', value)}
          placeholder="כל החלקות"
          searchPlaceholder="חיפוש חלקה..."
        />
      </FilterField>

      <FilterField label="סטטוס" htmlFor="nir-filter-status">
        <Select value={filters.status} onValueChange={(value) => set('status', value)}>
          <SelectTrigger id="nir-filter-status" className="w-full">
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
      </FilterField>

      <FilterField label="כיוון דגימה" htmlFor="nir-filter-direction">
        <Select value={filters.direction} onValueChange={(value) => set('direction', value)}>
          <SelectTrigger id="nir-filter-direction" className="w-full">
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
      </FilterField>

      <FilterField label="שליחה ללקוח" htmlFor="nir-filter-sent">
        <Select value={filters.sent} onValueChange={(value) => set('sent', value)}>
          <SelectTrigger id="nir-filter-sent" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">כל הבדיקות</SelectItem>
            <SelectItem value="sent">נשלח ללקוח</SelectItem>
            <SelectItem value="unsent">טרם נשלח</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
    </OliveFilterPanel>
  );
}
