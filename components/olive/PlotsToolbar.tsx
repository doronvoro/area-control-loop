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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PLOT_TYPE_OPTIONS } from '@/types/database';
import { PLOT_CATEGORY_CARDS, PLOT_CATEGORY_ICONS, URGENCY_OPTIONS } from '@/lib/olive/constants';
import type { CategoryThresholds } from '@/lib/olive/logic';
import { categoryRuleText, countActivePlotFilters, type PlotFilters } from '@/lib/olive/plot-rows';
import { FilterChips, FilterField, OliveFilterPanel } from './OliveFilterPanel';

interface PlotsToolbarProps {
  filters: PlotFilters;
  onFiltersChange: (next: PlotFilters) => void;
  onClear: () => void;
  /** Every grower of the tenant, plus the "no grower" entry. */
  growerOptions: SearchableSelectOption[];
  /** The varieties the tenant's plots use, by varieties.id, plus "no variety". */
  varietyOptions: SearchableSelectOption[];
  /** Keyed by PlotType value, plus 'all'. From plotTypeCounts. */
  typeCounts: Record<string, number>;
  /** Keyed by PlotCategory. From categoryCounts. */
  categoryCounts: Record<string, number>;
  /** Keyed by UrgencyLevel. From urgencyCounts. */
  urgencyCounts: Record<string, number>;
  /** The live category bands, quoted in each tile's tooltip. */
  bands: CategoryThresholds;
  shown: number;
  total: number;
  defaultExpanded?: boolean;
}

export function PlotsToolbar({
  filters,
  onFiltersChange,
  onClear,
  growerOptions,
  varietyOptions,
  typeCounts,
  categoryCounts,
  urgencyCounts,
  bands,
  shown,
  total,
  defaultExpanded,
}: PlotsToolbarProps) {
  const set = <K extends keyof PlotFilters>(key: K, value: PlotFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  return (
    <>
      {/* The dashboard's four category cards, as the category filter. They
          replace the קטגוריה dropdown rather than sit beside it: one control per
          filter, and this one also reads as the page's summary. A click toggles. */}
      <section aria-label="סינון לפי קטגוריה" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {PLOT_CATEGORY_CARDS.map((card) => {
          const Icon = PLOT_CATEGORY_ICONS[card.key];
          const active = filters.category === card.key;
          return (
            <Tooltip key={card.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => set('category', active ? 'all' : card.key)}
                  className="olive-status-card olive-sc-neutral"
                >
                  <div className="olive-status-count">{categoryCounts[card.key] ?? 0}</div>
                  <div className="olive-status-label flex items-center justify-center gap-1">
                    <Icon className="size-3.5 opacity-60" aria-hidden />
                    {card.label}
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64 text-center">
                {categoryRuleText(card.key, bands)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </section>

      <OliveFilterPanel
        activeCount={countActivePlotFilters(filters)}
        shown={shown}
        total={total}
        itemLabel="חלקות"
        onClear={onClear}
        defaultExpanded={defaultExpanded}
        chips={
          // The two axes a reader narrows by most live in the header rather
          // than the grid: they stay readable and clickable while the panel is
          // collapsed, which is how the page opens.
          <>
            {/* No "הכל" chip: none picked is all, and clicking the picked one
                again lets go — the dashboard's urgency chips work the same way. */}
            <FilterChips
              ariaLabel="סינון לפי דחיפות מסיק"
              value={filters.urgency}
              onChange={(value) => set('urgency', value === filters.urgency ? 'all' : value)}
              chips={URGENCY_OPTIONS.map((o) => ({
                value: o.level,
                label: o.label,
                count: urgencyCounts[o.level] ?? 0,
                dot: o.level,
              }))}
            />
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
          </>
        }
      >
        <FilterField label="חיפוש" htmlFor="plots-filter-search">
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

        {/* Matches on variety_id, so a plot saved under an alias such as
          "ארבקינה צעיר" is listed under ארבקינה with the rest. */}
        <FilterField label="זן" htmlFor="plots-filter-variety">
          <SearchableSelect
            id="plots-filter-variety"
            options={varietyOptions}
            value={filters.varietyId}
            onValueChange={(value) => set('varietyId', value)}
            placeholder="כל הזנים"
            searchPlaceholder="חיפוש זן..."
            emptyMessage="לא נמצאו זנים"
          />
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
    </>
  );
}
