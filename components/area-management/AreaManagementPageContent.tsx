'use client';

import { useState, useEffect } from 'react';
import { AreaManagementLayout } from './AreaManagementLayout';
import { Loader2 } from 'lucide-react';

export function AreaManagementPageContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/areas-management');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'שגיאה בטעינת הנתונים');
        }

        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message || 'שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
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

  if (!data) {
    return null;
  }

  return (
    <AreaManagementLayout
      customers={data.customers}
      initialCustomerAreasMap={data.customerAreasMap}
      crops={data.crops}
      permissions={data.permissions}
    />
  );
}
