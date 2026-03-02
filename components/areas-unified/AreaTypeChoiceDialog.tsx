'use client';

import { Warehouse, MapPinned } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { AreaType } from './types';

interface AreaTypeChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (type: AreaType) => void;
}

export function AreaTypeChoiceDialog({
  open,
  onOpenChange,
  onChoose,
}: AreaTypeChoiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>יצירת שטח חדש</DialogTitle>
          <DialogDescription>בחר את סוג השטח שברצונך ליצור</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <button
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
            onClick={() => {
              onChoose('indoor');
              onOpenChange(false);
            }}
          >
            <Warehouse className="h-10 w-10 text-purple-500" />
            <div className="text-center">
              <div className="font-semibold text-sm">שטח פנימי</div>
              <div className="text-xs text-muted-foreground mt-1">
                חממות, מחסנים, בתי גידול
              </div>
            </div>
          </button>

          <button
            className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
            onClick={() => {
              onChoose('outdoor');
              onOpenChange(false);
            }}
          >
            <MapPinned className="h-10 w-10 text-green-500" />
            <div className="text-center">
              <div className="font-semibold text-sm">שטח חיצוני</div>
              <div className="text-xs text-muted-foreground mt-1">
                שדות, מטעים, שטחים פתוחים
              </div>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
