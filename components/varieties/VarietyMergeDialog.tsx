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
import type { VarietyRow } from '@/lib/varieties/variety-rows';

/**
 * Fold one variety into another — the fix for a duplicate spelling someone
 * spotted in the list. Like GrowerMergeDialog, the merged name is kept as an
 * alias so the next import does not bring it back as its own variety.
 */
interface VarietyMergeDialogProps {
  source: VarietyRow | null;
  varieties: VarietyRow[];
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}

export function VarietyMergeDialog({
  source,
  varieties,
  onOpenChange,
  onMerged,
}: VarietyMergeDialogProps) {
  return (
    <Dialog open={source !== null} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        {source && (
          <MergeBody
            key={source.id}
            source={source}
            varieties={varieties}
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
  varieties,
  onMerged,
  onClose,
}: {
  source: VarietyRow;
  varieties: VarietyRow[];
  onMerged: () => void;
  onClose: () => void;
}) {
  const [targetId, setTargetId] = useState('');
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      varieties
        .filter((v) => v.id !== source.id)
        .map((v) => ({
          value: v.id,
          label: v.plotCount > 0 ? `${v.name} (${v.plotCount} חלקות)` : v.name,
        })),
    [varieties, source.id]
  );

  const target = varieties.find((v) => v.id === targetId) ?? null;

  const merge = async () => {
    if (!target) return;
    try {
      setMerging(true);
      setError(null);

      const response = await fetch('/api/varieties/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: source.id, targetId: target.id }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'שגיאה במיזוג הזנים');

      showToast.success(`"${source.name}" מוזג אל "${target.name}"`);
      onMerged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה במיזוג הזנים');
    } finally {
      setMerging(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Merge className="size-5" />
          מיזוג זנים
        </DialogTitle>
        <DialogDescription>
          {`"${source.name}" יימחק, וכל החלקות וחלונות הקטיף שלו יעברו לזן שייבחר.`}
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
            placeholder="בחר זן"
            searchPlaceholder="חיפוש זן..."
            emptyMessage="אין זן אחר"
          />
        </div>

        {target && (
          <ul className="olive-muted list-disc space-y-1 pr-5 text-xs">
            <li>{`החלקות וחלונות הקטיף של כל הלקוחות יעברו אל "${target.name}".`}</li>
            <li>
              {`השם "${source.name}" יישמר כשם נוסף של "${target.name}", כך שייבוא עתידי לא ייצור אותו מחדש.`}
            </li>
            {source.aliases.length > 0 && (
              <li>{`גם ${source.aliases.length} השמות הנוספים שלו יעברו אליו.`}</li>
            )}
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
