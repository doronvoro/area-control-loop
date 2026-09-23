'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Filter, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * The shared "סינון וחיפוש" panel behind the three olive logs.
 *
 * It deliberately knows nothing about any filter shape: the fields arrive as
 * children, so PlotFilters, NirFilters and HarvestFilters stay three unrelated
 * flat objects. What it does own is the chrome the three screens had been
 * copying by hand — the collapse, the "מסונן (n)" badge, and the footer's count
 * and clear button.
 *
 * One DOM tree, not a collapsed-branch / expanded-branch pair: the header
 * renders once, so `chips` and `scope` cannot drift between the two states and
 * nothing inside them remounts on a toggle.
 */
interface OliveFilterPanelProps {
  /**
   * How many filters are set. One number rather than a boolean plus a count,
   * because it drives both the badge and the clear button's `disabled` — two
   * props could disagree, and the visible failure is a badge reading (2) beside
   * a greyed-out "נקה סינון".
   */
  activeCount: number;
  /**
   * A segmented control shown in the header, so it survives the collapse. The
   * plots panel puts its grower-type chips here.
   */
  chips?: ReactNode;
  /**
   * A control that is NOT a filter — it changes what is fetched. Kept out of the
   * grid on purpose: "נקה סינון" resets the grid and must not touch this, and
   * separating them is the only cheap way to make that rule visible. Clearing
   * the season would fire a request nobody asked for. The NIR and harvest logs
   * put their season picker here.
   */
  scope?: ReactNode;
  /** The labeled fields. One <FilterField> per filter. */
  children: ReactNode;
  /** Override for the field grid. The default suits four fields. */
  gridClassName?: string;
  shown: number;
  total: number;
  /** 'חלקות' | 'בדיקות' | 'מעברים' — the footer's noun. */
  itemLabel: string;
  onClear: () => void;
  /**
   * Read ONCE, by a useState initialiser. A deep link (`?grower=`, `?areaId=`)
   * arrives with a filter already set and must open the panel so the short list
   * has a visible cause — but the link is consumed on mount, so re-syncing this
   * later would reopen a panel the reader had closed. Do not "fix" it with an
   * effect.
   */
  defaultExpanded?: boolean;
}

export function OliveFilterPanel({
  activeCount,
  chips,
  scope,
  children,
  gridClassName = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  shown,
  total,
  itemLabel,
  onClear,
  defaultExpanded = false,
}: OliveFilterPanelProps) {
  const [open, setOpen] = useState(defaultExpanded);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="olive-card">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <Filter className="size-4 shrink-0" aria-hidden="true" />
          {/* The title toggles, as well as the chevron. Two triggers on one
              state, not two controls. */}
          <CollapsibleTrigger className="focus-visible:ring-ring cursor-pointer rounded-sm text-base font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none">
            סינון וחיפוש
          </CollapsibleTrigger>
          {activeCount > 0 && <Badge variant="secondary">מסונן ({activeCount})</Badge>}
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={open ? 'סגור סינון' : 'פתח סינון'}
            >
              {/* Vertical only — a rotated down-chevron reads the same in RTL
                  and LTR, so it needs no direction handling. */}
              <ChevronDown
                className={cn('size-4 transition-transform duration-200', open && 'rotate-180')}
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>

          {(scope || chips) && (
            <div className="ms-auto flex flex-wrap items-center gap-3">
              {scope}
              {chips}
            </div>
          )}
        </div>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="px-4 pb-4">
            <div className={cn('grid gap-4', gridClassName)}>{children}</div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
              <span className="olive-muted text-sm">
                מציג {shown} מתוך {total} {itemLabel}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClear}
                disabled={activeCount === 0}
              >
                <X className="ml-1 size-3.5" />
                נקה סינון
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

/** One labeled cell of the grid. `htmlFor` must match the control's id. */
export function FilterField({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export interface FilterChip {
  value: string;
  label: string;
  count: number;
}

/**
 * A segmented count control, hand-rolled from buttons: there is no toggle-group
 * in this repo and radix's would be a new dependency for one control.
 *
 * `aria-pressed` rather than a radiogroup — a radiogroup owes the reader
 * arrow-key navigation and roving tabindex, which is real code, while pressed
 * buttons are already keyboard-complete. Same shape as the dashboard's
 * status cards.
 */
export function FilterChips({
  ariaLabel,
  chips,
  value,
  onChange,
}: {
  ariaLabel: string;
  chips: FilterChip[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      // rounded-md + overflow-hidden on the wrapper clips the end caps, so the
      // children need no rounded-s/rounded-e and the control is
      // direction-agnostic for free.
      className="border-input inline-flex items-center overflow-hidden rounded-md border"
    >
      {chips.map((chip, i) => {
        const active = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.value)}
            className={cn(
              'h-8 px-2.5 text-xs font-medium whitespace-nowrap transition-colors',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              // Logical, not border-l: the divider sits on each chip's leading
              // edge, which is its right side in RTL and its left in LTR.
              i > 0 && 'border-input border-s',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50'
            )}
          >
            {chip.label} ({chip.count})
          </button>
        );
      })}
    </div>
  );
}
