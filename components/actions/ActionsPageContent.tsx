'use client';

import { useState, useEffect } from 'react';
import { ActionForm } from './ActionForm';
import { Loader2 } from 'lucide-react';

export function ActionsPageContent() {
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/actions/form-data');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'שגיאה בטעינת הנתונים');
        }

        const data = await response.json();
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

  if (!formData) {
    return null;
  }

  return (
    <ActionForm
      isAdmin={formData.isAdmin}
      customers={formData.customers}
      initialAreas={formData.initialAreas}
      initialWorkers={formData.initialWorkers}
      findings={formData.findings}
      unitTypes={formData.unitTypes}
      currentWorkerId={formData.currentWorkerId}
    />
  );
}
