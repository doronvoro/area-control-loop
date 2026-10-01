import { NextResponse } from 'next/server';
import {
  getApiContext,
  requireAdminOrCustomerOwner,
  requireWorkerAdminOrCustomer,
  resolveCustomerId,
} from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { OLIVE_CROP_NAME } from '@/lib/olive/constants';
import { normalizeVarietyName } from '@/lib/olive/variety';
import { getCustomerAreaIds } from '@/lib/services/customer-area.service';
import { getOlivePlots } from '@/lib/services/olive-plot.service';
import {
  diffAliases,
  normaliseVarietyAliases,
  summarisePlotsByVariety,
} from '@/lib/services/variety.service';

/**
 * Olive varieties (זנים).
 *
 * WHY GLOBAL, UNLIKE /api/growers
 * A variety is an agronomic fact shared by every tenant (20261001100000), so
 * the list is not scoped by customer. Writes are therefore held to admin and
 * customer_owner and go through adminClient — the same rule, and the same
 * reasoning, as the other global olive tables in
 * app/api/olive/category-thresholds/route.ts.
 *
 * WHAT IS PER TENANT
 * plot_count / total_dunam count only the scoped tenant's own olive plots, so
 * one customer never learns how many plots another has of a variety.
 *
 * Limited to the olive crop: the table also holds other crops' varieties (the
 * trigger resolves every area), but this screen and its callers are olive-only.
 */

type Ctx = Awaited<ReturnType<typeof getApiContext>>;

async function oliveCropId(ctx: Ctx): Promise<string | null> {
  const { data, error } = await ctx.supabase
    .from('crops')
    .select('id')
    .eq('name', OLIVE_CROP_NAME)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const cropId = await oliveCropId(ctx);
    if (!cropId) return NextResponse.json([]);

    const { searchParams } = new URL(request.url);
    const customerId = resolveCustomerId(ctx, searchParams.get('customerId'));

    const [{ data: varieties, error }, { data: windows, error: windowError }, areaIds] =
      await Promise.all([
        ctx.supabase
          .from('varieties')
          // Embedded for the same reason as growers': the search box spans aliases.
          .select('id, name, crop_id, created_at, updated_at, variety_aliases(alias)')
          .eq('crop_id', cropId)
          .order('name'),
        ctx.supabase.from('variety_windows').select('variety_id'),
        customerId ? getCustomerAreaIds(ctx.supabase, customerId) : Promise.resolve([]),
      ]);
    if (error) throw error;
    if (windowError) throw windowError;

    const plots = await getOlivePlots(ctx.supabase, areaIds);
    const summary = summarisePlotsByVariety(plots);

    const windowCounts = new Map<string, number>();
    for (const w of (windows || []) as { variety_id: string | null }[]) {
      if (w.variety_id) windowCounts.set(w.variety_id, (windowCounts.get(w.variety_id) ?? 0) + 1);
    }

    return NextResponse.json(
      (varieties || []).map((variety) => {
        const row = variety as { id: string; variety_aliases?: { alias: string }[] };
        const { variety_aliases, ...rest } = row;
        const stats = summary.get(row.id);
        return {
          ...rest,
          aliases: (variety_aliases || [])
            .map((a) => a.alias)
            .sort((a, b) => a.localeCompare(b, 'he')),
          plot_count: stats?.count ?? 0,
          total_dunam: stats?.dunam ?? 0,
          window_count: windowCounts.get(row.id) ?? 0,
        };
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    const forbidden = await requireAdminOrCustomerOwner(ctx);
    if (forbidden) return forbidden;

    const cropId = await oliveCropId(ctx);
    if (!cropId) {
      return NextResponse.json(
        { error: `לא קיים גידול בשם "${OLIVE_CROP_NAME}"` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const name = normalizeVarietyName(body.name);
    if (!name) return NextResponse.json({ error: 'נדרש שם זן' }, { status: 400 });

    const aliases = normaliseVarietyAliases(body.aliases);
    const nameClash = await rejectNameIsAlias(ctx, cropId, name, null);
    if (nameClash) return nameClash;
    const rejected = await rejectBadAliases(ctx, cropId, name, aliases, null);
    if (rejected) return rejected;

    const { data, error } = await ctx.adminClient
      .from('varieties')
      .insert({ crop_id: cropId, name })
      .select('id, name, crop_id, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'זן בשם זה כבר קיים' }, { status: 409 });
      }
      throw error;
    }

    const varietyId = (data as { id: string }).id;
    if (aliases.length > 0) {
      const failed = await addAliases(ctx, varietyId, aliases);
      if (failed) return failed;
    }

    return NextResponse.json(
      { ...data, aliases, plot_count: 0, total_dunam: 0, window_count: 0 },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();
    const forbidden = await requireAdminOrCustomerOwner(ctx);
    if (forbidden) return forbidden;

    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id נדרש' }, { status: 400 });

    const name = 'name' in body ? normalizeVarietyName(body.name) : null;
    if (name !== null && !name) {
      return NextResponse.json({ error: 'נדרש שם זן' }, { status: 400 });
    }

    // Read before write: the alias rules are cross-row, so they are checked
    // before anything is applied (see PUT /api/growers).
    const { data: existing, error: readError } = await ctx.adminClient
      .from('varieties')
      .select('id, crop_id, name, variety_aliases(alias)')
      .eq('id', id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) return NextResponse.json({ error: 'הזן לא נמצא' }, { status: 404 });

    const current = existing as {
      crop_id: string | null;
      name: string;
      variety_aliases?: { alias: string }[];
    };
    const currentAliases = (current.variety_aliases || []).map((a) => a.alias);
    const nextAliases = 'aliases' in body ? normaliseVarietyAliases(body.aliases) : currentAliases;
    const { added, removed } = diffAliases(currentAliases, nextAliases);

    if (name !== null && name !== current.name) {
      const nameClash = await rejectNameIsAlias(ctx, current.crop_id, name, id);
      if (nameClash) return nameClash;
    }
    const rejected = await rejectBadAliases(ctx, current.crop_id, name ?? current.name, added, id);
    if (rejected) return rejected;

    // Aliases removed FIRST: a rename to one of this variety's own aliases is
    // legitimate ("keep the other spelling"), but trg_varieties_validate refuses
    // a name that is still an alias.
    if (removed.length > 0) {
      const { error: removeError } = await ctx.adminClient
        .from('variety_aliases')
        .delete()
        .eq('variety_id', id)
        .in('alias', removed);
      if (removeError) throw removeError;
    }

    let row = { id, name: current.name, crop_id: current.crop_id } as Record<string, unknown>;
    if (name !== null && name !== current.name) {
      const { data: updated, error } = await ctx.adminClient
        .from('varieties')
        .update({ name })
        .eq('id', id)
        .select('id, name, crop_id, created_at, updated_at')
        .single();
      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ error: 'זן בשם זה כבר קיים' }, { status: 409 });
        }
        throw error;
      }
      row = updated as Record<string, unknown>;

      // areas.variety and variety_windows.variety are the display names, and the
      // resolve triggers only fire on writes to THOSE tables — renaming the
      // variety does not reach them. Writing the new name makes each trigger
      // resolve it by exact match to this same variety, so the id is unchanged.
      const [{ error: areaError }, { error: windowError }] = await Promise.all([
        ctx.adminClient.from('areas').update({ variety: name }).eq('variety_id', id),
        ctx.adminClient.from('variety_windows').update({ variety: name }).eq('variety_id', id),
      ]);
      if (areaError) throw areaError;
      if (windowError) throw windowError;
    }

    if (added.length > 0) {
      const failed = await addAliases(ctx, id, added);
      if (failed) return failed;
    }

    return NextResponse.json({ ...row, aliases: nextAliases });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getApiContext();
    const forbidden = await requireAdminOrCustomerOwner(ctx);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id נדרש' }, { status: 400 });

    // Counted across ALL tenants on purpose: the FK is ON DELETE SET NULL, so a
    // delete would strip the variety off another customer's plots too. The
    // message gives the count only, never whose.
    const [{ count: plotCount, error: plotError }, { count: windowCount, error: windowError }] =
      await Promise.all([
        ctx.adminClient
          .from('areas')
          .select('id', { count: 'exact', head: true })
          .eq('variety_id', id),
        ctx.adminClient
          .from('variety_windows')
          .select('id', { count: 'exact', head: true })
          .eq('variety_id', id),
      ]);
    if (plotError) throw plotError;
    if (windowError) throw windowError;

    if ((plotCount ?? 0) > 0 || (windowCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error: `לא ניתן למחוק זן שבשימוש (${plotCount ?? 0} חלקות, ${windowCount ?? 0} חלונות קטיף). יש למזג אותו לזן אחר.`,
        },
        { status: 409 }
      );
    }

    const { error } = await ctx.adminClient.from('varieties').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// --- Aliases ---

/**
 * 409 when `name` is already an alias of ANOTHER variety. The database refuses
 * it too (trg_varieties_validate), but as a 500 in English.
 */
async function rejectNameIsAlias(
  ctx: Ctx,
  cropId: string | null,
  name: string,
  varietyId: string | null
): Promise<NextResponse | null> {
  let query = ctx.adminClient
    .from('variety_aliases')
    .select('alias, variety_id, varieties(name)')
    .eq('alias', name);
  query = cropId ? query.eq('crop_id', cropId) : query.is('crop_id', null);
  const { data, error } = await query;
  if (error) throw error;

  const other = ((data || []) as { variety_id: string; varieties?: { name?: string } }[]).find(
    (row) => row.variety_id !== varietyId
  );
  if (!other) return null;
  return NextResponse.json(
    {
      error: `השם "${name}" רשום כשם נוסף של הזן "${other.varieties?.name ?? ''}". יש להסיר אותו משם תחילה.`,
    },
    { status: 409 }
  );
}

/** Same three rules as rejectBadAliases in /api/growers, per crop instead of per tenant. */
async function rejectBadAliases(
  ctx: Ctx,
  cropId: string | null,
  ownName: string,
  aliases: string[],
  varietyId: string | null
): Promise<NextResponse | null> {
  if (aliases.length === 0) return null;

  if (aliases.includes(ownName)) {
    return NextResponse.json(
      { error: 'שם נוסף אינו יכול להיות זהה לשם הזן עצמו' },
      { status: 409 }
    );
  }

  let clashQuery = ctx.adminClient.from('varieties').select('name').in('name', aliases);
  clashQuery = cropId ? clashQuery.eq('crop_id', cropId) : clashQuery.is('crop_id', null);
  const { data: clashes, error } = await clashQuery;
  if (error) throw error;

  if (clashes && clashes.length > 0) {
    const names = (clashes as { name: string }[]).map((c) => `"${c.name}"`).join(', ');
    return NextResponse.json(
      {
        error: `${names} — קיים כבר כזן. כדי לאחד אותם יש להשתמש במיזוג זנים, שמעביר גם את החלקות.`,
      },
      { status: 409 }
    );
  }

  let takenQuery = ctx.adminClient
    .from('variety_aliases')
    .select('alias, variety_id, varieties(name)')
    .in('alias', aliases);
  takenQuery = cropId ? takenQuery.eq('crop_id', cropId) : takenQuery.is('crop_id', null);
  const { data: taken, error: takenError } = await takenQuery;
  if (takenError) throw takenError;

  const elsewhere = (
    (taken || []) as { alias: string; variety_id: string; varieties?: { name?: string } }[]
  ).filter((row) => row.variety_id !== varietyId);
  if (elsewhere.length > 0) {
    const first = elsewhere[0];
    return NextResponse.json(
      { error: `"${first.alias}" כבר רשום כשם נוסף של הזן "${first.varieties?.name ?? ''}".` },
      { status: 409 }
    );
  }

  return null;
}

async function addAliases(
  ctx: Ctx,
  varietyId: string,
  aliases: string[]
): Promise<NextResponse | null> {
  // crop_id is filled by trg_variety_aliases_validate from the variety.
  const { error } = await ctx.adminClient
    .from('variety_aliases')
    .insert(aliases.map((alias) => ({ variety_id: varietyId, alias })));

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'אחד השמות הנוספים כבר תפוס' }, { status: 409 });
    }
    throw error;
  }
  return null;
}
