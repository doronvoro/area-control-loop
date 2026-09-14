import { requireAuth } from '@/lib/auth';
import { NirPageContent } from '@/components/olive/NirPageContent';
import '../olive.css';

/**
 * The NIR log, and the entry form that opens over it.
 *
 * Spec §3.1 asks for fast entry from a phone in the grove, so an `areaId` from
 * the plots page opens the form straight away with that plot already chosen —
 * the sampler never hunts for it. Arriving without one lands on the log, which
 * is what everyone else came for.
 */
export default async function NirPage({
  searchParams,
}: {
  searchParams: Promise<{ areaId?: string }>;
}) {
  await requireAuth();
  const { areaId } = await searchParams;

  return <NirPageContent initialAreaId={areaId ?? null} />;
}
