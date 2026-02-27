import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { MapPageContent } from '@/components/map/MapPageContent';
import { MapPinned } from 'lucide-react';

export default async function MapPage() {
  await requireAuth();

  return (
    <>
      <PageHeader
        icon={MapPinned}
        title="מפה אינטראקטיבית"
        description="הגדרת גבולות שטחים ותתי-שטחים על גבי מפה"
      />
      <Suspense
        fallback={
          <div className="text-center py-12 text-muted-foreground">
            טוען מפה...
          </div>
        }
      >
        <MapPageContent />
      </Suspense>
    </>
  );
}
