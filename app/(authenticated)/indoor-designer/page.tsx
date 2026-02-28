import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { IndoorDesignerPageContent } from '@/components/indoor-designer/IndoorDesignerPageContent';
import { Warehouse } from 'lucide-react';

export default async function IndoorDesignerPage() {
  await requireAuth();

  return (
    <>
      <PageHeader
        icon={Warehouse}
        title="מעצב שטחים פנימיים"
        description="עיצוב תוכנית שטח פנימי - חממות, מחסנים ומבנים"
      />
      <Suspense
        fallback={
          <div className="text-center py-12 text-muted-foreground">
            טוען מעצב...
          </div>
        }
      >
        <IndoorDesignerPageContent />
      </Suspense>
    </>
  );
}
