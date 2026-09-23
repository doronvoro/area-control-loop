import { NextResponse } from 'next/server';
import {
  checkPermission,
  getApiContext,
  requireWorkerAdminOrCustomer,
  resolveCustomerId,
} from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getCustomerAreaIds } from '@/lib/services/customer-area.service';
import { getOlivePlots } from '@/lib/services/olive-plot.service';
import {
  buildGrowerWrite,
  diffAliases,
  normaliseAliases,
  summarisePlotsByGrower,
} from '@/lib/services/grower.service';

/**
 * Growers (מגדלים) of the scoped tenant.
 *
 * Scoped by `resolveCustomerId`, like every other olive route, rather than by a
 * customer id in the query: growers belong to a tenant, and the sidebar switcher
 * already says which tenant an admin is acting as.
 *
 * The plot count and area come from the tenant's OWN olive plots, not from every
 * plot pointing at the grower. 11 areas in this database sit in customer_areas
 * for two tenants at once — a legacy artifact of the old create-admin script —
 * so counting by grower_id alone would attribute another tenant's plots here.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const customerId = resolveCustomerId(ctx, searchParams.get('customerId'));

    // An admin with no tenant selected is scoped to nothing. 200 with an empty
    // list, not a 401: it is the normal resting state after login, and the shell
    // already explains it with a "choose a customer" banner.
    if (!customerId) return NextResponse.json([]);

    const [{ data: growers, error }, areaIds] = await Promise.all([
      ctx.supabase
        .from('growers')
        // The embed is one round trip and at most a handful of rows per grower.
        // It has to be here rather than fetched on demand because the search box
        // spans aliases — looking up "קיבוץ גשור דרום" has to find the grower
        // that absorbed it.
        .select('*, grower_aliases(alias)')
        .eq('customer_id', customerId)
        .order('name'),
      getCustomerAreaIds(ctx.supabase, customerId),
    ]);
    if (error) throw error;

    // getOlivePlots applies the זית crop filter, so a grower's count is its
    // OLIVE plots — which is the only kind this screen is about.
    const plots = await getOlivePlots(ctx.supabase, areaIds);
    const summary = summarisePlotsByGrower(plots);

    return NextResponse.json(
      (growers || []).map((grower) => {
        const row = grower as { id: string; grower_aliases?: { alias: string }[] };
        const stats = summary.get(row.id);
        const { grower_aliases, ...rest } = row;
        return {
          ...rest,
          // Flattened to a plain string list so the client never has to know
          // the embed's shape, and sorted so the chips do not reorder between
          // loads on PostgREST's row order.
          aliases: (grower_aliases || [])
            .map((a) => a.alias)
            .sort((a, b) => a.localeCompare(b, 'he')),
          plot_count: stats?.count ?? 0,
          total_dunam: stats?.dunam ?? 0,
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
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    // A grower is olive reference data for a tenant, so it rides the area
    // permissions: admin and customer_owner hold them, worker does not.
    if (!(await checkPermission(ctx, 'create_area'))) {
      return NextResponse.json({ error: 'אין הרשאה ליצור מגדל' }, { status: 403 });
    }

    const customerId = resolveCustomerId(ctx, null);
    if (!customerId) {
      return NextResponse.json({ error: 'נדרש לבחור לקוח' }, { status: 400 });
    }

    const body = await request.json();
    const name = String(body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'נדרש שם מגדל' }, { status: 400 });

    const aliases = normaliseAliases(body.aliases);
    const rejected = await rejectBadAliases(ctx, customerId, name, aliases, null);
    if (rejected) return rejected;

    const { data, error } = await ctx.supabase
      .from('growers')
      .insert({ ...buildGrowerWrite(body), customer_id: customerId, name })
      .select()
      .single();

    // 23505 is unique_violation on (customer_id, name). Caught rather than
    // pre-checked: the constraint is the one that actually decides, and a
    // pre-check would still race with a second tab.
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'מגדל בשם זה כבר קיים' }, { status: 409 });
      }
      throw error;
    }

    const growerId = (data as { id: string }).id;
    if (aliases.length > 0) {
      const failed = await addAliases(ctx, growerId, aliases);
      if (failed) return failed;
    }

    return NextResponse.json({ ...data, aliases, plot_count: 0, total_dunam: 0 }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    if (!(await checkPermission(ctx, 'update_area'))) {
      return NextResponse.json({ error: 'אין הרשאה לעדכן מגדל' }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id נדרש' }, { status: 400 });

    const name = 'name' in body ? String(body.name ?? '').trim() : null;
    if (name !== null && !name) {
      return NextResponse.json({ error: 'נדרש שם מגדל' }, { status: 400 });
    }

    // Read before write, unlike the rest of this route, because the alias rules
    // are cross-row: a new alias is checked against every grower NAME of the
    // tenant, and a rename against every ALIAS. Validating after the update
    // would leave the name applied and the aliases rejected.
    const { data: existing, error: readError } = await ctx.supabase
      .from('growers')
      .select('id, customer_id, name, grower_aliases(alias)')
      .eq('id', id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) return NextResponse.json({ error: 'המגדל לא נמצא' }, { status: 404 });

    const current = existing as {
      customer_id: string;
      name: string;
      grower_aliases?: { alias: string }[];
    };
    const currentAliases = (current.grower_aliases || []).map((a) => a.alias);
    const nextAliases = 'aliases' in body ? normaliseAliases(body.aliases) : currentAliases;
    const { added, removed } = diffAliases(currentAliases, nextAliases);

    const rejected = await rejectBadAliases(
      ctx,
      current.customer_id,
      name ?? current.name,
      added,
      id
    );
    if (rejected) return rejected;

    // A rename into a spelling some other grower was merged under would be
    // refused by trg_growers_no_alias_collision as a raw 500. Caught here so it
    // reads as a sentence in the drawer's banner instead.
    if (name !== null && name !== current.name) {
      const { data: shadowed, error: shadowError } = await ctx.supabase
        .from('grower_aliases')
        .select('alias, growers(name)')
        .eq('customer_id', current.customer_id)
        .eq('alias', name)
        .neq('grower_id', id)
        .maybeSingle();
      if (shadowError) throw shadowError;
      if (shadowed) {
        const owner = (shadowed as { growers?: { name?: string } }).growers?.name ?? '';
        return NextResponse.json(
          {
            error: `השם "${name}" רשום כשם נוסף של המגדל "${owner}". יש להסיר אותו משם תחילה.`,
          },
          { status: 409 }
        );
      }
    }

    // RLS is the tenancy boundary here, not an explicit filter: the growers
    // policy is can_access_customer(customer_id, auth.uid()), so a row belonging
    // to another tenant simply does not match and the update touches nothing.
    // Unlike /api/customers this runs on the RLS-scoped client precisely so that
    // stays true.
    const patch: Record<string, unknown> = buildGrowerWrite(body);
    if (name !== null) patch.name = name;
    patch.updated_at = new Date().toISOString();

    const { data, error } = await ctx.supabase
      .from('growers')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'מגדל בשם זה כבר קיים' }, { status: 409 });
      }
      throw error;
    }
    if (!data) return NextResponse.json({ error: 'המגדל לא נמצא' }, { status: 404 });

    if (removed.length > 0) {
      const { error: removeError } = await ctx.supabase
        .from('grower_aliases')
        .delete()
        .eq('grower_id', id)
        .in('alias', removed);
      if (removeError) throw removeError;
    }
    if (added.length > 0) {
      const failed = await addAliases(ctx, id, added);
      if (failed) return failed;
    }

    // The plots carry grower_name as their display value, so a rename has to
    // reach them or the plots table would keep showing the old one. adminClient
    // because olive_plot_details is guarded per-AREA (can_access_area) while the
    // caller's right to do this was just established per-GROWER.
    if (name !== null) {
      const { error: renameError } = await ctx.adminClient
        .from('olive_plot_details')
        .update({ grower_name: name, updated_at: new Date().toISOString() })
        .eq('grower_id', id);
      if (renameError) throw renameError;
    }

    return NextResponse.json({ ...data, aliases: nextAliases });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    if (!(await checkPermission(ctx, 'delete_area'))) {
      return NextResponse.json({ error: 'אין הרשאה למחוק מגדל' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id נדרש' }, { status: 400 });

    // Refused while plots still point here. The FK is ON DELETE SET NULL, so the
    // delete would otherwise succeed and quietly strip the grower off every one
    // of its plots — the kind of loss that is only noticed a season later.
    const { count, error: countError } = await ctx.supabase
      .from('olive_plot_details')
      .select('area_id', { count: 'exact', head: true })
      .eq('grower_id', id);
    if (countError) throw countError;

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `לא ניתן למחוק מגדל המשויך ל-${count} חלקות. יש לשייך אותן למגדל אחר תחילה, או למזג אותו לתוכו.`,
        },
        { status: 409 }
      );
    }

    const { error } = await ctx.supabase.from('growers').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// --- Aliases ---

type Ctx = Awaited<ReturnType<typeof getApiContext>>;

/**
 * 409 if any of `aliases` cannot be recorded, otherwise null.
 *
 * Two rules, both of which the database also enforces (20260923120000). They
 * are repeated here for the message: a trigger's RAISE arrives as a 500 with an
 * English sentence, and this is a Hebrew RTL drawer.
 */
async function rejectBadAliases(
  ctx: Ctx,
  customerId: string,
  ownName: string,
  aliases: string[],
  growerId: string | null
): Promise<NextResponse | null> {
  if (aliases.length === 0) return null;

  if (aliases.includes(ownName)) {
    return NextResponse.json(
      { error: 'שם נוסף אינו יכול להיות זהה לשם המגדל עצמו' },
      { status: 409 }
    );
  }

  // An alias that is some other grower's NAME is the case that matters, and the
  // answer is not "pick one" — it is the merge, which repoints that grower's
  // plots and then frees the name. The message says so because otherwise the
  // operator's next move is to delete a grower that still has plots.
  const { data: clashes, error } = await ctx.supabase
    .from('growers')
    .select('name')
    .eq('customer_id', customerId)
    .in('name', aliases);
  if (error) throw error;

  if (clashes && clashes.length > 0) {
    const names = (clashes as { name: string }[]).map((c) => `"${c.name}"`).join(', ');
    return NextResponse.json(
      {
        error: `${names} — קיים כבר כמגדל. כדי לאחד אותם יש להשתמש במיזוג מגדלים, שמעביר גם את החלקות.`,
      },
      { status: 409 }
    );
  }

  // Held by another grower of this tenant. Separate from the clash above: there
  // is nothing to merge, the alias simply belongs elsewhere.
  const { data: taken, error: takenError } = await ctx.supabase
    .from('grower_aliases')
    .select('alias, grower_id, growers(name)')
    .eq('customer_id', customerId)
    .in('alias', aliases);
  if (takenError) throw takenError;

  const elsewhere = (
    (taken || []) as { alias: string; grower_id: string; growers?: { name?: string } }[]
  ).filter((row) => row.grower_id !== growerId);
  if (elsewhere.length > 0) {
    const first = elsewhere[0];
    return NextResponse.json(
      {
        error: `"${first.alias}" כבר רשום כשם נוסף של המגדל "${first.growers?.name ?? ''}".`,
      },
      { status: 409 }
    );
  }

  return null;
}

/** Insert alias rows, mapping the unique violation onto a 409. */
async function addAliases(
  ctx: Ctx,
  growerId: string,
  aliases: string[]
): Promise<NextResponse | null> {
  // customer_id is deliberately absent: trg_grower_aliases_set_customer fills it
  // from the grower, which is what makes it impossible to plant an alias under
  // another tenant.
  const { error } = await ctx.supabase
    .from('grower_aliases')
    .insert(aliases.map((alias) => ({ grower_id: growerId, alias })));

  if (error) {
    // Lost the race with a second tab that took the same alias.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'אחד השמות הנוספים כבר תפוס' }, { status: 409 });
    }
    throw error;
  }
  return null;
}
