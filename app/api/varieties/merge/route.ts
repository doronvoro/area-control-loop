import { NextResponse } from 'next/server';
import { getApiContext, requireAdminOrCustomerOwner } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

/**
 * Merge one variety into another.
 *
 * Same four steps, in the same order and for the same reasons, as
 * app/api/growers/merge/route.ts: move the source's aliases, repoint what
 * points at it (plots AND harvest windows here), delete it, then record its
 * name as an alias of the survivor. The last step is what stops the next
 * import from recreating the merged spelling.
 *
 * Varieties are global, so this is admin / customer_owner and runs on
 * adminClient — it repoints every tenant's plots of that variety.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    const forbidden = await requireAdminOrCustomerOwner(ctx);
    if (forbidden) return forbidden;

    const body = await request.json();
    const sourceId = String(body.sourceId ?? '');
    const targetId = String(body.targetId ?? '');

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'נדרשים זן מקור וזן יעד' }, { status: 400 });
    }
    if (sourceId === targetId) {
      return NextResponse.json({ error: 'לא ניתן למזג זן לתוך עצמו' }, { status: 400 });
    }

    const { data: rows, error: readError } = await ctx.adminClient
      .from('varieties')
      .select('id, crop_id, name')
      .in('id', [sourceId, targetId]);
    if (readError) throw readError;

    const varieties = (rows || []) as { id: string; crop_id: string | null; name: string }[];
    const source = varieties.find((v) => v.id === sourceId);
    const target = varieties.find((v) => v.id === targetId);
    if (!source || !target) {
      return NextResponse.json({ error: 'אחד הזנים לא נמצא' }, { status: 404 });
    }
    if (source.crop_id !== target.crop_id) {
      return NextResponse.json({ error: 'לא ניתן למזג זנים של גידולים שונים' }, { status: 400 });
    }

    // 1. Aliases first, or they CASCADE away with the source in step 3.
    const { error: aliasMoveError } = await ctx.adminClient
      .from('variety_aliases')
      .update({ variety_id: targetId })
      .eq('variety_id', sourceId);
    if (aliasMoveError) throw aliasMoveError;

    // 2. Plots and windows. The resolve triggers see variety_id change and
    //    rewrite the display text to the target's name.
    const { count: movedPlots, error: plotError } = await ctx.adminClient
      .from('areas')
      .update({ variety_id: targetId }, { count: 'exact' })
      .eq('variety_id', sourceId);
    if (plotError) throw plotError;

    const { count: movedWindows, error: windowError } = await ctx.adminClient
      .from('variety_windows')
      .update({ variety_id: targetId }, { count: 'exact' })
      .eq('variety_id', sourceId);
    if (windowError) throw windowError;

    // 3. Now unreferenced; deleting frees the name for step 4.
    const { error: deleteError } = await ctx.adminClient
      .from('varieties')
      .delete()
      .eq('id', sourceId);
    if (deleteError) throw deleteError;

    // 4. What makes it stick across imports. Retryable on its own.
    const { error: aliasError } = await ctx.adminClient
      .from('variety_aliases')
      .insert({ variety_id: targetId, alias: source.name });
    if (aliasError && aliasError.code !== '23505') throw aliasError;

    return NextResponse.json({
      movedPlots: movedPlots ?? 0,
      movedWindows: movedWindows ?? 0,
      alias: source.name,
      target: target.name,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
