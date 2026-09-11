import { requireAuth } from '@/lib/auth';
import { NirPageContent } from '@/components/olive/NirPageContent';
import '../olive.css';

/**
 * The fruit sampler's main screen — spec §3.1 asks for fast entry from a phone
 * in the grove, so the plot arrives as a query param from the dashboard link
 * rather than making the sampler hunt for it again.
 *
 * No PageHeader: the form carries its own hero, matching /monitoring.
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
