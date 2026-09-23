'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Merge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { showToast } from '@/lib/toast';
import type { GrowerRow } from '@/lib/growers/grower-rows';

/**
 * Fold one grower into another.
 *
 * WHY THIS EXISTS RATHER THAN "REASSIGN THE PLOTS, THEN DELETE"
 * That sequence is available today — the plot drawer picks a grower, and delete
 * refuses until nothing points at the row — and it comes undone on the next
 * backup import, which recreates the absorbed name as its own grower again.
 * Merging records the old name as an alias, which is what the import resolver
 * reads. The wording below says so, because "the name will keep working" is the
 * part an operator cannot see and the only reason to use this instead.
 *
 * The source is the row the operator acted on and the target is chosen here,
 * not the other way round: the action starts from a duplicate someone spotted
 * in the list, and it is the duplicate that disappears.
 */
interface GrowerMergeDialogProps {
  /** The grower being absorbed. `null` closes the dialog. */
  source: GrowerRow | null;
  /** Every grower of the tenant, source included — filtered out below. */
  growers: GrowerRow[];
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}

export function GrowerMergeDialog({
  source,
  growers,
  onOpenChange,
  onMerged,
}: GrowerMergeDialogProps) {
  return (
    <Dialog open={source !== null} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        {source && (
          // Remounts per source, so a target picked for one grower is not still
          // selected when the dialog opens for another.
          <MergeBody
            key={source.id}
            source={source}
            growers={growers}
            onMerged={onMerged}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MergeBody({
  source,
  growers,
  onMerged,
  onClose,
}: {
  source: GrowerRow;
  growers: GrowerRow[];
  onMerged: () => void;
  onClose: () => void;
}) {
  const [targetId, setTargetId] = useState('');
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      growers
        .filter((g) => g.id !== source.id)
        .map((g) => ({
          value: g.id,
          // The plot count is in the label because the usual target is the row
          // that already holds most of them — 44 of 46, in the case this was
          // built for.
          label: g.plotCount > 0 ? `${g.name} (${g.plotCount} חלקות)` : g.name,
        })),
    [growers, source.id]
  );

  const target = growers.find((g) => g.id === targetId) ?? null;

  const merge = async () => {
    if (!target) return;
    try {
      setMerging(true);
      setError(null);

      const response = await fetch('/api/growers/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: source.id, targetId: target.id }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'שגיאה במיזוג המגדלים');

      showToast.success(
        payload.movedPlots > 0
          ? `${payload.movedPlots} חלקות הועברו אל "${target.name}"`
          : `"${source.name}" מוזג אל "${target.name}"`
      );
      onMerged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה במיזוג המגדלים');
    } finally {
      setMerging(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Merge className="size-5" />
          מיזוג מגדלים
        </DialogTitle>
        <DialogDescription>
          {`"${source.name}" יימחק, וכל מה שמשויך אליו יעבור למגדל שייבחר.`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {error && (
          <div className="olive-error-banner flex items-center gap-3 p-3">
            <AlertTriangle className="size-4 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-semibold">מיזוג אל</label>
          <SearchableSelect
            options={options}
            value={targetId}
            onValueChange={setTargetId}
            placeholder="בחר מגדל"
            searchPlaceholder="חיפוש מגדל..."
            emptyMessage="אין מגדל אחר ללקוח זה"
          />
        </div>

        {target && (
          <ul className="olive-muted list-disc space-y-1 pr-5 text-xs">
            <li>
              {source.plotCount > 0
                ? `${source.plotCount} חלקות יעברו אל "${target.name}" ויוצגו תחת שמו.`
                : 'למגדל זה אין חלקות משויכות.'}
            </li>
            <li>
              {`השם "${source.name}" יישמר כשם נוסף של "${target.name}", כך שייבוא עתידי שימצא אותו ישייך את החלקה אל "${target.name}" ולא ייצור מגדל חדש.`}
            </li>
            {source.aliases.length > 0 && (
              <li>{`גם ${source.aliases.length} השמות הנוספים שלו יעברו אליו.`}</li>
            )}
            <li>פרטי הקשר וההערות של המגדל הנמחק אינם מועתקים.</li>
          </ul>
        )}
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={merging}>
          ביטול
        </Button>
        <Button type="button" onClick={merge} disabled={!target || merging}>
          {merging && <Loader2 className="ml-1 size-4 animate-spin" />}
          מזג
        </Button>
      </DialogFooter>
    </>
  );
}
