'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { PLOT_TYPE_OPTIONS } from '@/types/database';
import { PLOT_CATEGORY_CARDS } from '@/lib/olive/constants';
import { countActivePlotFilters, type PlotFilters } from '@/lib/olive/plot-rows';
import { FilterChips, FilterField, OliveFilterPanel } from './OliveFilterPanel';

interface PlotsToolbarProps {
  filters: PlotFilters;
  onFiltersChange: (next: PlotFilters) => void;
  onClear: () => void;
  /** Every grower of the tenant, plus the "no grower" entry. */
  growerOptions: SearchableSelectOption[];
  /** Keyed by PlotType value, plus 'all'. From plotTypeCounts. */
  typeCounts: Record<string, number>;
  shown: number;
  total: number;
  defaultExpanded?: boolean;
}

export function PlotsToolbar({
  filters,
  onFiltersChange,
  onClear,
  growerOptions,
  typeCounts,
  shown,
  total,
  defaultExpanded,
}: PlotsToolbarProps) {
  const set = <K extends keyof PlotFilters>(key: K, value: PlotFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  return (
    <OliveFilterPanel
      activeCount={countActivePlotFilters(filters)}
      shown={shown}
      total={total}
      itemLabel="חלקות"
      onClear={onClear}
      defaultExpanded={defaultExpanded}
      gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      chips={
        // Grower type is the list's primary axis, so it lives in the header
        // rather than the grid: it stays readable and clickable while the panel
        // is collapsed, which is how the page opens.
        <FilterChips
          ariaLabel="סינון לפי סוג מגדל"
          value={filters.plotType}
          onChange={(value) => set('plotType', value)}
          chips={[
            { value: 'all', label: 'הכל', count: typeCounts.all ?? 0 },
            ...PLOT_TYPE_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              count: typeCounts[o.value] ?? 0,
            })),
          ]}
        />
      }
    >
      <FilterField
        label="חיפוש"
        htmlFor="plots-filter-search"
        className="sm:col-span-2 lg:col-span-1"
      >
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2" />
          <Input
            id="plots-filter-search"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="שם, גוש, זן — או ראשי תיבות"
            className="pr-9"
          />
        </div>
      </FilterField>

      {/* Matches on grower_id, not the name kept beside it, so a rename or an
          absorbed alias does not drop the plot out of its own grower's list. */}
      <FilterField label="מגדל" htmlFor="plots-filter-grower">
        <SearchableSelect
          id="plots-filter-grower"
          options={growerOptions}
          value={filters.growerId}
          onValueChange={(value) => set('growerId', value)}
          placeholder="כל המגדלים"
          searchPlaceholder="חיפוש מגדל..."
          emptyMessage="לא נמצאו מגדלים"
        />
      </FilterField>

      {/* Categories come from the same definitions the dashboard's status
          cards use, so the two screens cannot drift apart. */}
      <FilterField label="קטגוריה" htmlFor="plots-filter-category">
        <Select value={filters.category} onValueChange={(value) => set('category', value)}>
          <SelectTrigger id="plots-filter-category" className="w-full">
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
      </FilterField>

      <FilterField label="סטטוס מסיק" htmlFor="plots-filter-harvest">
        <Select value={filters.harvest} onValueChange={(value) => set('harvest', value)}>
          <SelectTrigger id="plots-filter-harvest" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">נמסק ולא נמסק</SelectItem>
            <SelectItem value="active">טרם נמסק</SelectItem>
            <SelectItem value="harvested">נמסק</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="בדיקת NIR" htmlFor="plots-filter-nir">
        <Select value={filters.nir} onValueChange={(value) => set('nir', value)}>
          <SelectTrigger id="plots-filter-nir" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">כל החלקות</SelectItem>
            <SelectItem value="measured">נבדקו</SelectItem>
            <SelectItem value="never">טרם נבדקו</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>
    </OliveFilterPanel>
  );
}
