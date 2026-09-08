import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { WeatherPageContent } from '@/components/olive/WeatherPageContent';
import { CloudSun } from 'lucide-react';
import '../olive.css';

export default async function OliveWeatherPage() {
  await requireAuth();

  return (
    <>
      <PageHeader
        icon={CloudSun}
        title="מזג אוויר"
        description="תחזית 7 ימים לדרום רמת הגולן ועדכונים ידניים"
      />
      <WeatherPageContent />
    </>
  );
}
