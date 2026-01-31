'use client';

import { Badge } from '@/components/ui/badge';
import { Building2, AlertTriangle } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
}

interface AreaOwnerBadgeProps {
  customer?: Customer | null;
}

export function AreaOwnerBadge({ customer }: AreaOwnerBadgeProps) {
  if (customer) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Building2 className="h-3 w-3" />
        {customer.name}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300 bg-amber-50">
      <AlertTriangle className="h-3 w-3" />
      לא משויך
    </Badge>
  );
}
