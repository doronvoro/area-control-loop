'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AreaMapSubmitBarProps {
  count: number;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
}

export function AreaMapSubmitBar({ count, onSubmit, onCancel, submitting }: AreaMapSubmitBarProps) {
  return (
    <Card className="border-primary/50 bg-primary/5 py-3 sticky bottom-4">
      <CardContent className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge>{count}</Badge>
          <span className="text-sm font-medium">פעולות מוכנות לשמירה</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSubmit} disabled={submitting}>
            {submitting ? 'שומר...' : 'שמור הכל'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>
            ביטול
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
