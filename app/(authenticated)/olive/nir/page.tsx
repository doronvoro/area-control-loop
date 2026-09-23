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
 *
 * `sent=unsent` comes from the dashboard's season counter and lands in the
 * filter panel instead, which opens so the shortened list has a visible cause.
 */
export default async function NirPage({
  searchParams,
}: {
  searchParams: Promise<{ areaId?: string; sent?: string }>;
}) {
  await requireAuth();
  const { areaId, sent } = await searchParams;

  return (
    <NirPageContent
      initialAreaId={areaId ?? null}
      // `?sent=unsent` arrives from the dashboard's season counter. Whitelisted
      // rather than passed through, so a typed URL cannot seed a filter value
      // the Select has no option for and leave the control showing blank.
      initialSent={sent === 'sent' || sent === 'unsent' ? sent : null}
    />
  );
}
