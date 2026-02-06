'use client';

import { useState, useEffect } from 'react';
import { AdminActionForm } from './AdminActionForm';
import { Loader2 } from 'lucide-react';

export function AdminActionPageContent() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [actionTypes, setActionTypes] = useState<any[]>([]);
  const [unitTypes, setUnitTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [customersRes, findingsRes, actionTypesRes, unitTypesRes] = await Promise.all([
          fetch('/api/customers'),
          fetch('/api/findings'),
          fetch('/api/action-types'),
          fetch('/api/unit-types'),
        ]);

        if (!customersRes.ok) {
          const errorData = await customersRes.json();
          throw new Error(errorData.error || 'שגיאה בטעינת הלקוחות');
        }

        if (!findingsRes.ok) {
          const errorData = await findingsRes.json();
          throw new Error(errorData.error || 'שגיאה בטעינת הממצאים');
        }

        if (!actionTypesRes.ok) {
          const errorData = await actionTypesRes.json();
          throw new Error(errorData.error || 'שגיאה בטעינת סוגי הפעולות');
        }

        if (!unitTypesRes.ok) {
          const errorData = await unitTypesRes.json();
          throw new Error(errorData.error || 'שגיאה בטעינת סוגי היחידות');
        }

        const [customersData, findingsData, actionTypesData, unitTypesData] = await Promise.all([
          customersRes.json(),
          findingsRes.json(),
          actionTypesRes.json(),
          unitTypesRes.json(),
        ]);

        setCustomers(customersData);
        setFindings(findingsData);
        setActionTypes(actionTypesData);
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
    <AdminActionForm
      customers={customers}
      findings={findings}
      actionTypes={actionTypes}
      unitTypes={unitTypes}
    />
  );
}
