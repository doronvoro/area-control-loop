import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { AreaMapView } from '@/components/area-map/AreaMapView';
import { Map } from 'lucide-react';

export default async function AreaMapPage() {
  await requireAuth();

  return (
    <>
      <PageHeader
        icon={Map}
        title="מפת שטחים"
        description="סקירת שטחים ותתי-שטחים עם סטטוס ניטור ופעולות"
      />
      <Suspense fallback={
        <div className="text-center py-12 text-muted-foreground">טוען מפת שטחים...</div>
      }>
        <AreaMapView />
      </Suspense>
    </>
  );
}
