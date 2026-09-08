import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { HarvestPageContent } from '@/components/olive/HarvestPageContent';
import { Tractor } from 'lucide-react';
import '../olive.css';

export default async function OliveHarvestPage({
  searchParams,
}: {
  searchParams: Promise<{ areaId?: string }>;
}) {
  await requireAuth();
  const { areaId } = await searchParams;

  return (
    <>
      <PageHeader
        icon={Tractor}
        title="מסיק"
        description="רישום מעברי מסיק ותוצאות בפועל"
      />
      <HarvestPageContent initialAreaId={areaId ?? null} />
    </>
  );
}
