'use client';

import { useState, useEffect, useCallback } from 'react';
import { ReportsTable } from './ReportsTable';
import { Loader2 } from 'lucide-react';

export function ReportsPageContent() {
  const [reportAreas, setReportAreas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The API caps at 50 rows before the client sees them, so the type filter
  // has to reach the server rather than only filtering what already arrived.
  const [type, setType] = useState<string>('default');

  const fetchData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError(null);

      const query = type === 'default' ? '' : `?types=${type}`;
      const response = await fetch(`/api/reports${query}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בטעינת הדוחות');
      }

      const data = await response.json();
      setReportAreas(data);
    } catch (err: any) {
      setError(err.message || 'שגיאה בטעינת הנתונים');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    <ReportsTable
      reportAreas={reportAreas}
      onReportDeleted={() => fetchData(false)}
      onTypeChange={setType}
    />
  );
}
