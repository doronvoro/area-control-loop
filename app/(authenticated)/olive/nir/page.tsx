import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { NirPageContent } from '@/components/olive/NirPageContent';
import { FlaskConical } from 'lucide-react';
import '../olive.css';

/**
 * The fruit sampler's main screen — spec §3.1 asks for fast entry from a phone
 * in the grove, so the plot arrives as a query param from the dashboard link
 * rather than making the sampler hunt for it again.
 */
export default async function NirPage({
  searchParams,
}: {
  searchParams: Promise<{ areaId?: string }>;
}) {
  await requireAuth();
  const { areaId } = await searchParams;

  return (
    <>
      <PageHeader
        icon={FlaskConical}
        title="בדיקות NIR"
        description="רישום בדיקות בשלות ומעקב לאורך העונה"
      />
      <NirPageContent initialAreaId={areaId ?? null} />
    </>
  );
}
