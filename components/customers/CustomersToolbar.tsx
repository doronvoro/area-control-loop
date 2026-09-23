'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CUSTOMER_TYPE_OPTIONS } from '@/types/database';
import {
  hasActiveCustomerFilters,
  UNCLASSIFIED_LABEL,
  type CustomerFilters,
} from '@/lib/customers/customer-rows';

interface CustomersToolbarProps {
  filters: CustomerFilters;
  onFiltersChange: (next: CustomerFilters) => void;
  onClear: () => void;
  shown: number;
  total: number;
}

export function CustomersToolbar({
  filters,
  onFiltersChange,
  onClear,
  shown,
  total,
}: CustomersToolbarProps) {
  const set = <K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value });

  const active = hasActiveCustomerFilters(filters);

  return (
    <div className="space-y-2 p-4 pb-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2" />
          <Input
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="חיפוש לפי שם, איש קשר, טלפון, אימייל או ח.פ"
            className="h-9 pr-9"
            aria-label="חיפוש לקוחות"
          />
        </div>

        <Select value={filters.customerType} onValueChange={(value) => set('customerType', value)}>
          <SelectTrigger className="h-9 w-[150px]" aria-label="סוג לקוח">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">כל הסוגים</SelectItem>
            {CUSTOMER_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
            {/* Rows predating the column. Findable rather than only visible, so
                classifying the backlog is a filter away. */}
            <SelectItem value="none">{UNCLASSIFIED_LABEL}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={(value) => set('status', value)}>
          <SelectTrigger className="h-9 w-[140px]" aria-label="סטטוס">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">פעילים ולא פעילים</SelectItem>
            <SelectItem value="active">פעילים</SelectItem>
            <SelectItem value="inactive">לא פעילים</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {active && (
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs">
            מציג {shown} מתוך {total} לקוחות
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
            <X className="ml-1 size-3.5" />
            נקה סינון
          </Button>
        </div>
      )}
    </div>
  );
}
