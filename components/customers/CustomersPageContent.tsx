'use client';

import { CustomersList } from './CustomersList';
import { Customer } from '@/types/database';
import { Loader2 } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';

interface CustomersPageContentProps {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function CustomersPageContent({
  canCreate,
  canUpdate,
  canDelete,
}: CustomersPageContentProps) {
  const { data: customers, loading, error } = useApiData<Customer[]>('/api/customers');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <CustomersList
      customers={customers || []}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}
