import { SlidersHorizontal } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { OliveThresholdsPageContent } from '@/components/olive/OliveThresholdsPageContent';
import '../olive.css';

export default async function OliveThresholdsPage() {
  await requireAuth();

  return (
    <>
      <PageHeader
        icon={SlidersHorizontal}
        title="ספים"
        description="הספים שמחליטים את סטטוס החלקות. הם משותפים לכל הלקוחות במערכת."
      />
      <OliveThresholdsPageContent />
    </>
  );
}
