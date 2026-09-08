import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { YieldPageContent } from '@/components/olive/YieldPageContent';
import { Scale } from 'lucide-react';
import '../olive.css';

export default async function OliveYieldPage() {
  await requireAuth();

  return (
    <>
      <PageHeader
        icon={Scale}
        title="הערכת יבול"
        description="ק״ג לדונם לעונה הפעילה, מול מה שנמסק בפועל"
      />
      <YieldPageContent />
    </>
  );
}
