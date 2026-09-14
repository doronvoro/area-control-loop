import { NextRequest, NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { importBackup, parseBackup } from '@/lib/olive/import-backup';
import { wipeCustomerOliveData } from '@/lib/olive/wipe-olive-data';

/**
 * Import an olive prototype backup for one tenant, replacing what is there.
 *
 * apply=false previews: it counts what the wipe would remove and runs the
 * importer's dry run, writing nothing. apply=true wipes then imports.
 *
 * ADMIN ONLY. This is deliberately cross-tenant — the operator picks the target
 * from a dropdown — so it gates on ctx.isAdmin rather than going through
 * assertCustomerInScope(), which refuses an admin who has no customer selected
 * in the sidebar and would therefore block the page outright.
 */

/**
 * A 45-plot import is well over 100 sequential Supabase round-trips. The
 * platform default would cut a real import in half and leave a tenant with
 * some of their plots, so this is raised deliberately.
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const ctx = await getApiContext();
    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'רק מנהל מערכת יכול לייבא נתוני מסיק' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const customerId = formData.get('customerId') as string | null;
    const apply = formData.get('apply') === 'true';
    const taktsRaw = formData.get('taktsPerPlot') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'נדרש קובץ גיבוי' }, { status: 400 });
    }
    if (!customerId) {
      return NextResponse.json({ error: 'נדרש לבחור לקוח' }, { status: 400 });
    }

    // Optional. Blank means "whatever the file says", which for the גשור export
    // is nothing at all.
    let defaultTaktCount: number | null = null;
    if (taktsRaw !== null && taktsRaw.trim() !== '') {
      const parsed = Number(taktsRaw);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
        return NextResponse.json(
          { error: 'מספר הטאקטים לחלקה חייב להיות מספר שלם בין 1 ל-10' },
          { status: 400 }
        );
      }
      defaultTaktCount = parsed;
    }

    // Read through adminClient: production is missing the admin SELECT policy
    // on customers, so the RLS-scoped client cannot confirm the row exists.
    const { data: customer } = await ctx.adminClient
      .from('customers')
      .select('id, name')
      .eq('id', customerId)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ error: 'הלקוח לא נמצא' }, { status: 404 });
    }

    let backup;
    try {
      backup = parseBackup(await file.text());
    } catch (parseError) {
      // A bad file is the operator's mistake, not a server fault.
      const message = parseError instanceof Error ? parseError.message : 'קובץ לא תקין';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const wipe = await wipeCustomerOliveData(ctx.adminClient, customerId, { apply });

    const result = await importBackup(ctx.adminClient, backup, {
      customerId,
      apply,
      // The wipe either just ran, or is about to. Either way the importer must
      // plan against an empty tenant, or a preview would promise "45 matched"
      // for an apply that actually creates 45 new rows.
      assumeEmpty: true,
      defaultTaktCount,
    });

    return NextResponse.json({
      applied: apply,
      customer: { id: (customer as any).id, name: (customer as any).name },
      exportedAt: backup.exportedAt ?? null,
      source: {
        plots: backup.plots?.length ?? 0,
        nirTests: backup.nirTests?.length ?? 0,
        varietyWindows: backup.varietyWindows?.length ?? 0,
        yieldRows: backup.ownYieldData?.length ?? 0,
      },
      wipe,
      result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
