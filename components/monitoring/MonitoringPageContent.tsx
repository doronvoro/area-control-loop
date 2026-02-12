'use client';

import { useState, useEffect } from 'react';
import { MonitoringForm } from './MonitoringForm';
import { Loader2 } from 'lucide-react';

export function MonitoringPageContent() {
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/monitoring/form-data');

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'שגיאה בטעינת הנתונים');
        }

        const data = await res.json();
        setFormData(data);
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
    <MonitoringForm
      isAdmin={formData.isAdmin}
      customers={formData.customers}
      initialInspectors={formData.initialInspectors}
      initialAreas={formData.initialAreas}
      findings={formData.findings}
      unitTypes={formData.unitTypes}
      customerIdForData={formData.customerIdForData}
    />
  );
}
