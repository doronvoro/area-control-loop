'use client';

import { useState, useEffect } from 'react';
import { AdminMonitoringForm } from './AdminMonitoringForm';
import { Loader2 } from 'lucide-react';

export function AdminMonitoringPageContent() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [unitTypes, setUnitTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [customersRes, unitTypesRes] = await Promise.all([
          fetch('/api/customers'),
          fetch('/api/unit-types'),
        ]);

        if (!customersRes.ok) {
          const errorData = await customersRes.json();
          throw new Error(errorData.error || 'שגיאה בטעינת הלקוחות');
        }

        if (!unitTypesRes.ok) {
          const errorData = await unitTypesRes.json();
          throw new Error(errorData.error || 'שגיאה בטעינת סוגי היחידות');
        }

        const [customersData, unitTypesData] = await Promise.all([
          customersRes.json(),
          unitTypesRes.json(),
        ]);

        setCustomers(customersData);
        setUnitTypes(unitTypesData);
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

  return (
    <AdminMonitoringForm
      customers={customers}
      unitTypes={unitTypes}
    />
  );
}
