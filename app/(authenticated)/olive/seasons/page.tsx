import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { SeasonsPageContent } from '@/components/olive/SeasonsPageContent';
import { CalendarRange } from 'lucide-react';
import '../olive.css';

export default async function OliveSeasonsPage() {
  await requireAuth();

  return (
    <>
      <PageHeader
        icon={CalendarRange}
        title="עונות מסיק"
        description="הגדרת מחזור העונה וסוג השנה (ON/OFF)"
      />
      <SeasonsPageContent />
    </>
  );
}
