'use client';

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, FlaskConical, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SortableTableHead, type SortState } from '@/components/ui/sortable-table-head';
import { PARAMETER_STATUS_CONFIG, PLOT_TYPE_LABELS } from '@/types/database';
import type { RowFlash } from '@/hooks/useRowFlash';
import { categoryLabel, type PlotRow, type PlotSortField } from '@/lib/olive/plot-rows';
import { parseYieldDraft, type PlotCategory } from '@/lib/olive/logic';
import { showToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

/**
 * The plot list.
 *
 * On numbers and RTL: ui/table hardcodes `text-right` on every head and cell,
 * which is correct here. Units live in the HEADER and the cells hold a bare
 * figure — a run of digits is an LTR run under the bidi algorithm whatever the
 * paragraph direction, but "48 דונם" can reorder, and globals.css carries
 * `[dir="rtl"] * { direction: rtl }` so a per-element dir="ltr" cannot save it.
 */

/**
 * Category tint. The old list rendered every category in the same grey pill,
 * so the classification it computed was effectively invisible.
 */
const CATEGORY_PILL: Record<PlotCategory, string> = {
  testing: 'olive-pill-idle',
  normal: 'olive-pill-ok',
  anomaly: 'olive-pill-urgent',
  ready: 'olive-pill-plan',
};

interface PlotsTableProps {
  /** Already filtered, sorted and paged. */
  rows: PlotRow[];
  sort: SortState<PlotSortField>;
  onSort: (field: PlotSortField) => void;
  onEdit: (row: PlotRow) => void;
  /** Steps the merged שמן/מים header through its four sort states. */
  onCycleOilWater: () => void;
  /** Opens the NIR form for this plot, over the table. */
  onAddNir: (row: PlotRow) => void;
  /** The active season. Null means the yield cell cannot be written to. */
  seasonId: string | null;
  /** Saves one plot's yield estimate. Resolves false when the write failed. */
  onYieldSave: (areaId: string, kgPerDunam: number | null) => Promise<boolean>;
  activeId?: string | null;
  /** The row to highlight briefly, and why. */
  flash?: RowFlash | null;
}

function num(value: number | null, digits = 0): string {
  return value === null ? '—' : value.toFixed(digits);
}

export function PlotsTable({
  rows,
  sort,
  onSort,
  onEdit,
  onCycleOilWater,
  onAddNir,
  seasonId,
  onYieldSave,
  activeId,
  flash,
}: PlotsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="text-xs">
          <SortableTableHead field="name" sort={sort} onSort={onSort}>
            חלקה
          </SortableTableHead>
          <SortableTableHead
            field="growerName"
            sort={sort}
            onSort={onSort}
            className="hidden lg:table-cell"
          >
            מגדל
          </SortableTableHead>
          <SortableTableHead
            field="region"
            sort={sort}
            onSort={onSort}
            className="hidden xl:table-cell"
          >
            אזור
          </SortableTableHead>
          <SortableTableHead
            field="size"
            sort={sort}
            onSort={onSort}
            className="hidden md:table-cell"
          >
            גודל (דונם)
          </SortableTableHead>
          <SortableTableHead field="category" sort={sort} onSort={onSort}>
            קטגוריה
          </SortableTableHead>
          <SortableTableHead field="daysSinceNir" sort={sort} onSort={onSort}>
            בדיקה אחרונה
          </SortableTableHead>
          {/* The oil breakpoint, the earlier of the two this replaces: the
              pair is read together, so it must not arrive in halves. */}
          <OilWaterHead sort={sort} onCycle={onCycleOilWater} className="hidden sm:table-cell" />
          <SortableTableHead
            field="yieldKgPerDunam"
            sort={sort}
            onSort={onSort}
            className="hidden md:table-cell"
          >
            יבול (ק״ג/דונם)
          </SortableTableHead>
          {/* Not sortable, deliberately: it is a band of the very number the
              column before it sorts, and two headers driving one field would
              light up together and flip each other's direction. */}
          <TableHead className="hidden md:table-cell">עומס יבול</TableHead>
          <TableHead className="w-px" />
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            onClick={() => onEdit(row)}
            className={cn(
              'cursor-pointer hover:bg-muted/50',
              activeId === row.id && 'bg-primary/10 hover:bg-primary/15',
              // A running animation outranks the hover rule, so moving the
              // mouse over the row mid-highlight does not cut it short.
              flash?.id === row.id &&
                (flash.kind === 'saved' ? 'olive-row-flash' : 'olive-row-release')
            )}
          >
            <TableCell>
              <span className="font-medium">{row.name || '—'}</span>
              <span className="olive-muted block text-xs">
                {[row.variety, row.plotType ? PLOT_TYPE_LABELS[row.plotType as never] : null]
                  .filter(Boolean)
                  .join(' · ') || ' '}
                {row.harvested && <span className="text-primary font-semibold"> · נמסק</span>}
              </span>
            </TableCell>
            <TableCell className="olive-muted hidden text-xs lg:table-cell">
              {row.growerName ?? '—'}
            </TableCell>
            <TableCell className="olive-muted hidden text-xs xl:table-cell">
              {row.region ?? '—'}
            </TableCell>
            <TableCell className="hidden tabular-nums md:table-cell">{num(row.size, 1)}</TableCell>
            <TableCell>
              <span className={`olive-pill ${CATEGORY_PILL[row.category]}`}>
                {categoryLabel(row.category)}
              </span>
            </TableCell>
            <TableCell>
              {row.lastMeasuredLabel ? (
                <span className="text-xs">{row.lastMeasuredLabel}</span>
              ) : (
                <span className="olive-muted text-xs">טרם נבדקה</span>
              )}
            </TableCell>
            <TableCell className="hidden tabular-nums sm:table-cell">
              {row.oil === null && row.water === null ? (
                <span className="olive-muted">—</span>
              ) : (
                // Three elements, not the one "8.0 / 60.7" text node it looks
                // like. That node is two digit runs around a bidi-neutral
                // slash, so in this RTL page it paints as "60.7 / 8.0" — oil
                // and water silently swapped. `olive-ltr-num` would unswap the
                // digits but not the header, leaving שמן over the water; as
                // flex children in an RTL row the parts cannot reorder at all,
                // and the first one lands rightmost, under שמן.
                <span className="inline-flex items-center gap-1">
                  <span>{num(row.oil, 1)}</span>
                  <span className="olive-muted" aria-hidden>
                    /
                  </span>
                  <span>{num(row.water, 1)}</span>
                </span>
              )}
            </TableCell>
            <YieldCell
              value={row.yieldKgPerDunam}
              plotName={row.name}
              editable={seasonId !== null}
              onSave={(next) => onYieldSave(row.id, next)}
            />
            <TableCell className="hidden md:table-cell">
              {row.yieldLoad ? (
                <span
                  className={`olive-pill ${PARAMETER_STATUS_CONFIG[row.yieldLoad.status].pillClass}`}
                >
                  {row.yieldLoad.label}
                </span>
              ) : (
                <span className="olive-muted">—</span>
              )}
            </TableCell>
            <TableCell className="p-1">
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  // The row itself opens the editor; keep the click from
                  // firing twice.
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(row);
                  }}
                  aria-label={`ערוך פרטי חלקה ${row.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  // Was a link to /olive/nir?areaId=…, which threw away the
                  // filters, the sort and the scroll position to record one
                  // reading. The form opens over the table instead.
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddNir(row);
                  }}
                  aria-label={`הוסף בדיקת NIR בחלקה ${row.name}`}
                >
                  <FlaskConical className="size-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * The merged שמן/מים header.
 *
 * Local rather than a prop on SortableTableHead: that component is scalar by
 * construction — `active = sort.field === field` drives both the highlight and
 * the arrow — and it is shared with the NIR and harvest logs. It also builds
 * its aria-label as `מיין לפי ${children}`, which degrades to the raw English
 * field name the moment the label stops being a plain string, which a two-part
 * emphasised label is. Promote this if a second two-field column ever appears.
 */
function OilWaterHead({
  sort,
  onCycle,
  className,
}: {
  sort: SortState<PlotSortField>;
  onCycle: () => void;
  className?: string;
}) {
  const active = sort.field === 'oil' || sort.field === 'water';
  const next = sort.field === 'oil' ? 'מים' : 'שמן';

  return (
    <TableHead className={className}>
      <button
        // Not a submit: the NIR drawer portals a form over this table.
        type="button"
        onClick={onCycle}
        className={cn(
          'flex items-center font-medium transition-colors hover:text-foreground',
          !active && 'text-muted-foreground'
        )}
        // Two clauses, because the active field is otherwise carried by weight
        // alone and a screen reader would hear the same label in every state.
        aria-label={
          active
            ? `ממוין לפי ${sort.field === 'oil' ? 'שמן' : 'מים'}. מיין לפי ${next}`
            : 'מיין לפי שמן'
        }
      >
        {!active ? (
          <ArrowUpDown className="me-1 h-3.5 w-3.5 opacity-50" />
        ) : sort.direction === 'asc' ? (
          <ArrowUp className="me-1 h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="me-1 h-3.5 w-3.5" />
        )}
        <span className={cn(sort.field === 'oil' && 'text-foreground font-semibold')}>שמן</span>
        <span aria-hidden className="mx-0.5 opacity-60">
          /
        </span>
        <span className={cn(sort.field === 'water' && 'text-foreground font-semibold')}>מים</span>
      </button>
    </TableHead>
  );
}

/**
 * The yield estimate, edited where it is read.
 *
 * Each cell keeps its own draft rather than the table holding a map keyed by
 * plot: a refetch re-derives every row from the payload, and a map would need
 * reconciling against it on each one. Owning the draft here means the only
 * cell with state is the one being typed in, and it reads `value` straight
 * from props again the moment it stops.
 */
function YieldCell({
  value,
  plotName,
  editable,
  onSave,
}: {
  value: number | null;
  plotName: string;
  /** False when there is no active season — the write has nowhere to go. */
  editable: boolean;
  onSave: (kgPerDunam: number | null) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  // Escape reverts and keeps focus, so the blur that follows must not save
  // what was just discarded. A ref, not state: blur fires before a setState
  // from the same keydown has flushed.
  const cancelled = useRef(false);

  const stored = value != null ? String(value) : '';

  const open = () => {
    setDraft(stored);
    cancelled.current = false;
    setEditing(true);
  };

  const commit = async () => {
    if (saving) return;
    if (cancelled.current) {
      cancelled.current = false;
      setEditing(false);
      return;
    }
    if (draft.trim() === stored) {
      setEditing(false); // untouched, or typed back to what it was
      return;
    }

    const parsed = parseYieldDraft(draft);
    if (!parsed.ok) {
      // Stay in edit mode: the number is still wrong and still theirs to fix.
      showToast.error(parsed.message);
      return;
    }

    setSaving(true);
    // onSave awaits the refetch, so by the time this resolves the row already
    // carries the saved number — dropping the draft cannot flash the old one.
    const ok = await onSave(parsed.value);
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <TableCell
      // On the cell, not the input, so the padding around it is inert too —
      // the row itself opens the plot drawer.
      onClick={(e) => e.stopPropagation()}
      className="hidden cursor-auto p-1 md:table-cell"
    >
      {!editable ? (
        <span className="olive-muted tabular-nums" title="אין עונה פעילה">
          {num(value, 0)}
        </span>
      ) : editing ? (
        <Input
          autoFocus
          type="number"
          // step="any" and no min, as in the plot drawer: native constraint
          // validation would otherwise reject the value silently, in English,
          // before parseYieldDraft got to say anything about it.
          step="any"
          inputMode="decimal"
          disabled={saving}
          className="h-8 w-24 tabular-nums"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              // Blur is the single commit path, so Enter goes through it
              // rather than saving a second time alongside it.
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              cancelled.current = true;
              setDraft(stored);
              setEditing(false);
            }
          }}
          aria-label={`יבול צפוי בחלקה ${plotName}`}
        />
      ) : (
        <button
          type="button"
          onClick={open}
          className="rounded-md px-2 py-1 tabular-nums transition-colors hover:bg-accent"
          aria-label={`ערוך יבול צפוי בחלקה ${plotName}`}
        >
          {num(value, 0)}
        </button>
      )}
    </TableCell>
  );
}
