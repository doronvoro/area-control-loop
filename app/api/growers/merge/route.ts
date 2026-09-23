import { NextResponse } from 'next/server';
import {
  checkPermission,
  getApiContext,
  requireWorkerAdminOrCustomer,
} from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

/**
 * Merge one grower into another.
 *
 * WHY THIS IS AN ENDPOINT AND NOT FOUR CALLS FROM THE CLIENT
 * A merge is four writes that are only correct together and only in this order:
 * move the source's aliases, repoint its plots, delete it, then record its name
 * as an alias of the survivor. Stopping half way leaves either a grower with no
 * plots that the next import refills, or plots whose display name no longer
 * matches any grower. Postgres has no transaction across PostgREST calls, so
 * the ordering is the mitigation: every prefix of it is a state the screen can
 * explain, and the last step is the one that is safe to retry.
 *
 * WHY THE ALIAS IS THE POINT
 * Without it the merge lasts until the next backup import.
 * trg_olive_plot_details_resolve_grower recreates any grower name it has not
 * seen, and the importer writes plot.grower verbatim — which is how גשור ended
 * up with "קיבוץ גשור", "קיבוץ גשור דרום" and "קיבוץ גשור מנחת צפון" as three
 * growers over 46 plots. See 20260923120000.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    // Both permissions, because the operation is both: it reassigns plots and it
    // deletes a grower. Anyone allowed to do it by hand holds both anyway, so
    // this grants nothing new — it only stops the merge being a way around the
    // stricter of the two.
    if (!(await checkPermission(ctx, 'update_area'))) {
      return NextResponse.json({ error: 'אין הרשאה לעדכן מגדל' }, { status: 403 });
    }
    if (!(await checkPermission(ctx, 'delete_area'))) {
      return NextResponse.json({ error: 'אין הרשאה למחוק מגדל' }, { status: 403 });
    }

    const body = await request.json();
    const sourceId = String(body.sourceId ?? '');
    const targetId = String(body.targetId ?? '');

    if (!sourceId || !targetId) {
      return NextResponse.json({ error: 'נדרשים מגדל מקור ומגדל יעד' }, { status: 400 });
    }
    if (sourceId === targetId) {
      return NextResponse.json({ error: 'לא ניתן למזג מגדל לתוך עצמו' }, { status: 400 });
    }

    // RLS is the tenancy boundary: a grower of another tenant does not come
    // back, so the 404 below covers "not yours" as well as "not there".
    const { data: rows, error: readError } = await ctx.supabase
      .from('growers')
      .select('id, customer_id, name')
      .in('id', [sourceId, targetId]);
    if (readError) throw readError;

    const growers = (rows || []) as { id: string; customer_id: string; name: string }[];
    const source = growers.find((g) => g.id === sourceId);
    const target = growers.find((g) => g.id === targetId);
    if (!source || !target) {
      return NextResponse.json({ error: 'אחד המגדלים לא נמצא' }, { status: 404 });
    }

    // Belt and braces over RLS: both rows came back, so both are visible to this
    // caller, but "visible" is per tenant and an admin sees more than one.
    // Merging across tenants would move plots between them.
    if (source.customer_id !== target.customer_id) {
      return NextResponse.json({ error: 'לא ניתן למזג מגדלים של לקוחות שונים' }, { status: 400 });
    }

    // 1. The source's own aliases move first. They would otherwise CASCADE away
    //    with it in step 3 — losing the memory of a previous merge, and letting
    //    those spellings come back as new growers on the next import.
    const { error: aliasMoveError } = await ctx.supabase
      .from('grower_aliases')
      .update({ grower_id: targetId })
      .eq('grower_id', sourceId);
    if (aliasMoveError) throw aliasMoveError;

    // 2. The plots. adminClient because olive_plot_details is guarded per AREA
    //    (can_access_area) while this caller's right was established per GROWER
    //    — the same reason PUT /api/growers renames through it.
    //    trg_olive_plot_details_resolve_grower sees grower_id change and rewrites
    //    grower_name to the target's, so the plots screen follows without a
    //    second statement.
    const { count: movedPlots, error: plotError } = await ctx.adminClient
      .from('olive_plot_details')
      .update({ grower_id: targetId, updated_at: new Date().toISOString() }, { count: 'exact' })
      .eq('grower_id', sourceId);
    if (plotError) throw plotError;

    // 3. The source is now unreferenced, so the FK's ON DELETE SET NULL has
    //    nothing to strip. This also frees its name, which step 4 needs: an
    //    alias may not be a live grower's name.
    const { error: deleteError } = await ctx.supabase.from('growers').delete().eq('id', sourceId);
    if (deleteError) throw deleteError;

    // 4. What makes it stick. Retryable on its own: if this is the statement
    //    that fails, the merge has already happened and the operator can add the
    //    name by hand in the drawer, which is the same write.
    const { error: aliasError } = await ctx.supabase
      .from('grower_aliases')
      .insert({ grower_id: targetId, alias: source.name });
    if (aliasError && aliasError.code !== '23505') throw aliasError;

    return NextResponse.json({
      movedPlots: movedPlots ?? 0,
      alias: source.name,
      target: target.name,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
