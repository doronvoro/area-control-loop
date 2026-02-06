'use client';

import { useState, useEffect } from 'react';
import { CustomersList } from './CustomersList';
import { Customer } from '@/types/database';
import { Loader2 } from 'lucide-react';

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/customers');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'שגיאה בטעינת הלקוחות');
        }

        const data = await response.json();
        setCustomers(data);
      } catch (err: any) {
        setError(err.message || 'שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    }

    fetchCustomers();
  }, []);

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
      customers={customers}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}
