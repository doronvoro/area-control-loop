import { requireAuth } from '@/lib/auth';
import { HarvestPageContent } from '@/components/olive/HarvestPageContent';
import '../olive.css';

/**
 * The harvest log, and the entry form that opens over it.
 *
 * An `areaId` opens the form straight away with that plot already chosen, for
 * anyone arriving from a plot. Arriving without one lands on the log, which is
 * where the season's totals are. Matches /olive/nir.
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
