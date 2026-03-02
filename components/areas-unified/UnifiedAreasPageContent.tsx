'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { UnifiedAreasLayout } from './UnifiedAreasLayout';
import type { AreaWithType, Customer, Crop, Permissions } from './types';

interface AreasManagementData {
  customers: Customer[];
  customerAreasMap: Record<string, AreaWithType[]>;
  crops: Crop[];
  permissions: Permissions;
}

export function UnifiedAreasPageContent() {
  const [data, setData] = useState<AreasManagementData | null>(null);
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

  if (!data) return null;

  return (
    <UnifiedAreasLayout
      customers={data.customers}
      initialCustomerAreasMap={data.customerAreasMap}
      crops={data.crops}
      permissions={data.permissions}
    />
  );
}
