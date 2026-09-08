import { requireAuth } from '@/lib/auth';
import { HarvestPageContent } from '@/components/olive/HarvestPageContent';
import '../olive.css';

/**
 * No PageHeader: the form carries its own hero, matching /monitoring and
 * /olive/nir.
 */
export default async function OliveHarvestPage({
  searchParams,
}: {
  searchParams: Promise<{ areaId?: string }>;
}) {
  await requireAuth();
  const { areaId } = await searchParams;

  return <HarvestPageContent initialAreaId={areaId ?? null} />;
}
