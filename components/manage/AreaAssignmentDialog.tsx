'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { showToast } from '@/lib/toast';
import { MapPin } from 'lucide-react';

interface AreaWithOwner {
  id: string;
  name: string;
  description: string | null;
  customer?: {
    id: string;
    name: string;
  } | null;
}

interface Customer {
  id: string;
  name: string;
}

interface AreaAssignmentDialogProps {
  customer: Customer;
  unassignedAreas: AreaWithOwner[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AreaAssignmentDialog({
  customer,
  unassignedAreas,
  open,
  onOpenChange,
  onSuccess,
}: AreaAssignmentDialogProps) {
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const toggleArea = (areaId: string) => {
    const newSelected = new Set(selectedAreaIds);
    if (newSelected.has(areaId)) {
      newSelected.delete(areaId);
    } else {
      newSelected.add(areaId);
    }
    setSelectedAreaIds(newSelected);
  };

  const handleAssign = async () => {
    if (selectedAreaIds.size === 0) {
      showToast.error('יש לבחור לפחות שטח אחד');
      return;
    }

    setLoading(true);
    try {
      // Assign all selected areas
      const promises = Array.from(selectedAreaIds).map((areaId) =>
        fetch('/api/customer-areas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: customer.id,
            area_id: areaId,
          }),
        })
      );

      const results = await Promise.all(promises);
      const failedCount = results.filter((r) => !r.ok).length;

      if (failedCount > 0) {
        showToast.error(`נכשלה הקצאת ${failedCount} שטחים`);
      } else {
        showToast.success(`${selectedAreaIds.size} שטחים הוקצו בהצלחה`);
        onSuccess();
        onOpenChange(false);
      }
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה בהקצאת השטחים');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedAreaIds(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>הקצאת שטחים ללקוח</DialogTitle>
          <DialogDescription>בחר שטחים להקצות ל-{customer.name}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {unassignedAreas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>אין שטחים זמינים להקצאה</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {unassignedAreas.map((area) => (
                <label
                  key={area.id}
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                >
                  <Checkbox
                    checked={selectedAreaIds.has(area.id)}
                    onCheckedChange={() => toggleArea(area.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{area.name}</p>
                    {area.description && (
                      <p className="text-xs text-muted-foreground">{area.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            ביטול
          </Button>
          <Button onClick={handleAssign} disabled={loading || selectedAreaIds.size === 0}>
            {loading
              ? 'מקצה...'
              : `הקצה ${selectedAreaIds.size > 0 ? `(${selectedAreaIds.size})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
