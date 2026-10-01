import { requireAuth } from '@/lib/auth';
import { OlivePlotsContent } from '@/components/olive/OlivePlotsContent';
import '../olive.css';

/**
 * The PageHeader lives in the client component rather than here: its `children`
 * slot holds the "חלקה חדשה" button, which needs the drawer state and the
 * selected tenant.
 *
 * `?grower=` arrives from the growers screen and lands in the search box, the
 * same deep-link shape /olive/nir already accepts as `?areaId=`. The plot search
 * already matches on grower name, so no new filter is needed.
 *
 * `?variety=` arrives from the varieties screen as a variety id and presets the
 * זן filter — an id rather than a search term, so plots saved under an alias
 * are included.
 */
export default async function OlivePlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ grower?: string; variety?: string }>;
}) {
  await requireAuth();
  const { grower, variety } = await searchParams;

  return <OlivePlotsContent initialSearch={grower ?? null} initialVarietyId={variety ?? null} />;
}
