'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Search, Zap, Clock } from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  monitoringCount: number;
  actionsCount: number;
  pendingMonitoring: number;
}

const statCards = [
  {
    key: 'monitoringCount' as const,
    title: 'דוחות ניטור',
    description: 'סה"כ דוחות ניטור',
    icon: Search,
    href: '/reports',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    key: 'actionsCount' as const,
    title: 'דוחות פעולה',
    description: 'סה"כ דוחות פעולה',
    icon: Zap,
    href: '/reports',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    key: 'pendingMonitoring' as const,
    title: 'ניטור ממתין',
    description: 'ממתינים לפעולה',
    icon: Clock,
    href: '/actions',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
];

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
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-primary me-2" />
        <span className="text-muted-foreground">טוען נתונים...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {statCards.map((card) => {
        const Icon = card.icon;
        const value = stats?.[card.key] || 0;

        return (
          <Link key={card.key} href={card.href}>
            <Card className="group relative overflow-hidden transition-all hover:shadow-md hover:border-primary/20">
              <CardContent className="flex items-start gap-4 p-5">
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${card.bg} ${card.color} transition-transform group-hover:scale-105`}>
                  <Icon className="size-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </p>
                  <p className="text-3xl font-bold tracking-tight mt-0.5">
                    {value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
