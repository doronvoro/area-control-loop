import { notFound } from 'next/navigation';

import { requireAuth } from '@/lib/auth';
import { getRequestScope, resolveCustomerId } from '@/lib/api/auth-context';
import { fetchGrowerReport } from '@/lib/olive/report/fetch-grower-report';
import { GrowerReportDocument } from '@/components/olive/report/GrowerReportDocument';
import { ReportToolbar } from '@/components/olive/report/ReportToolbar';

/**
 * The grower's season report, opened from the grower drawer.
 *
 * Sibling of the per-plot report and built the same way: a server component end
 * to end apart from the toolbar, so app/api/olive/report/grower/[id]/pdf can
 * render the identical tree under renderToStaticMarkup.
 *
 * resolveCustomerId(scope) takes no override — the ?customerId= form is the
 * admin/Bearer channel and has no business being reachable from a page URL. An
 * admin with no customer selected resolves to null, which 404s: the drawer this
 * is opened from always has one selected, so arriving here without one means the
 * URL was typed, not clicked.
 */

export const metadata = {
  title: 'דוח עונתי — מגדל',
};

export default async function GrowerReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();

  const { id } = await params;
  const scope = await getRequestScope();
  const customerId = resolveCustomerId(scope);
  if (!customerId) notFound();

  const data = await fetchGrowerReport(scope.supabase, id, customerId, new Date());
  if (!data) notFound();

  return (
    <div className="rpt-shell">
      <ReportToolbar pdfHref={`/api/olive/report/grower/${id}/pdf`} />
      <GrowerReportDocument data={data} logoSrc="/olive/gashur-logo.png" />
    </div>
  );
}
