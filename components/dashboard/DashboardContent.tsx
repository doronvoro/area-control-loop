'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface DashboardStats {
  monitoringCount: number;
  actionsCount: number;
  pendingMonitoring: number;
}

export function DashboardContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const response = await fetch('/api/dashboard/stats');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'שגיאה בטעינת הנתונים');
        }
        const data = await response.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message || 'שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
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
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>דוחות ניטור</CardTitle>
          <CardDescription>סה"כ דוחות ניטור</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats?.monitoringCount || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>דוחות פעולה</CardTitle>
          <CardDescription>סה"כ דוחות פעולה</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats?.actionsCount || 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ניטור ממתין</CardTitle>
          <CardDescription>דוחות ניטור הממתינים לפעולה</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats?.pendingMonitoring || 0}</div>
        </CardContent>
      </Card>
    </div>
  );
}
