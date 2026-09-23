import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { getRequestScope } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { fetchPlotReport } from '@/lib/olive/report/fetch-plot-report';
import { renderReportPdf } from '@/lib/olive/report/render-pdf';
import { PlotReportDocument } from '@/components/olive/report/PlotReportDocument';

/**
 * The plot status report as a downloadable PDF.
 *
 * Renders the very same component the page at /olive/report/plot/[id] renders,
 * then prints that markup with headless Chromium. No browser is ever pointed at
 * the page URL, so nothing here needs to carry a session into a subprocess —
 * see lib/olive/report/render-pdf.tsx.
 *
 * Chromium needs a real Node runtime and takes seconds, not milliseconds.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Chromium resolves relative URLs against nothing here, so the logo is inlined. */
async function logoDataUri(): Promise<string> {
  const file = path.join(process.cwd(), 'public', 'olive', 'gashur-logo.png');
  const bytes = await readFile(file);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

/** Latin-1 safe, for a header that cannot carry raw Hebrew. */
function asciiFilename(areaId: string): string {
  return `olive-plot-report-${areaId.slice(0, 8)}.pdf`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const scope = await getRequestScope();

    const data = await fetchPlotReport(scope.supabase, id, new Date());
    // Same 404-not-403 reasoning as the page: whether this plot exists in some
    // other tenant is not something to disclose.
    if (!data) {
      return NextResponse.json({ error: 'חלקה לא נמצאה' }, { status: 404 });
    }

    const pdf = await renderReportPdf(
      <PlotReportDocument data={data} logoSrc={await logoDataUri()} />
    );

    // The Hebrew name goes in filename*, per RFC 5987; filename= keeps a plain
    // ASCII fallback for clients that ignore it.
    const hebrew = encodeURIComponent(`דוח חלקה - ${data.plotName || data.growerName}.pdf`);

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiFilename(id)}"; filename*=UTF-8''${hebrew}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
