import { notFound } from 'next/navigation';

import { requireAuth } from '@/lib/auth';
import { getRequestScope } from '@/lib/api/auth-context';
import { fetchPlotReport } from '@/lib/olive/report/fetch-plot-report';
import { PlotReportDocument } from '@/components/olive/report/PlotReportDocument';
import { ReportToolbar } from '@/components/olive/report/ReportToolbar';

/**
 * The printable per-plot status report, opened from the plot drawer.
 *
 * A server component end to end — only the toolbar is client — so the exact
 * same tree renders in app/api/olive/report/plot/[id]/pdf/route.ts under
 * renderToStaticMarkup. Keep it that way: the moment this page needs a hook,
 * the PDF stops matching what the screen shows.
 *
 * getRequestScope() rather than getApiContext(): the latter builds a
 * service-role client and throws when SUPABASE_SERVICE_ROLE_KEY is unset, which
 * a read-only report has no use for. app/page.tsx is the existing precedent.
 *
 * Tenancy is RLS's job here — fetchPlotReport reads through the scoped client
 * and returns null for a plot in another tenant, which becomes a 404 rather
 * than a 403, so the page does not confirm that the plot exists elsewhere.
 */

export const metadata = {
  title: 'דוח סטטוס חלקה',
};

export default async function PlotReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();

  const { id } = await params;
  const scope = await getRequestScope();

  const data = await fetchPlotReport(scope.supabase, id, new Date());
  if (!data) notFound();

  return (
    <div className="rpt-shell">
      <ReportToolbar pdfHref={`/api/olive/report/plot/${id}/pdf`} />
      <PlotReportDocument data={data} logoSrc="/olive/gashur-logo.png" />
    </div>
  );
}
