import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { getRequestScope, resolveCustomerId } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { fetchGrowerReport } from '@/lib/olive/report/fetch-grower-report';
import { renderReportPdf } from '@/lib/olive/report/render-pdf';
import { GrowerReportDocument } from '@/components/olive/report/GrowerReportDocument';

/**
 * The grower season report as a downloadable PDF.
 *
 * Renders the same component the page renders, then prints that markup with
 * headless Chromium — no browser is pointed at the page URL, so no session is
 * carried into a subprocess. See lib/olive/report/render-pdf.tsx.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

/** Chromium resolves relative URLs against nothing here, so the logo is inlined. */
async function logoDataUri(): Promise<string> {
  const file = path.join(process.cwd(), 'public', 'olive', 'gashur-logo.png');
  const bytes = await readFile(file);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const scope = await getRequestScope();
    const customerId = resolveCustomerId(scope);

    const data = customerId
      ? await fetchGrowerReport(scope.supabase, id, customerId, new Date())
      : null;

    // 404 rather than 403, matching the page: whether this grower exists in
    // another tenant is not something to disclose.
    if (!data) {
      return NextResponse.json({ error: 'מגדל לא נמצא' }, { status: 404 });
    }

    const pdf = await renderReportPdf(
      <GrowerReportDocument data={data} logoSrc={await logoDataUri()} />
    );

    const hebrew = encodeURIComponent(`דוח עונתי - ${data.growerName}.pdf`);

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="olive-grower-report-${id.slice(0, 8)}.pdf"; filename*=UTF-8''${hebrew}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
