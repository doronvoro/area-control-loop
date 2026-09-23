import { NextResponse } from 'next/server';
import {
  checkPermission,
  getApiContext,
  requireWorkerAdminOrCustomer,
  resolveCustomerId,
} from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { MAX_TAKT_COUNT } from '@/lib/olive/constants';
import { getAccessibleAreaIds } from '@/lib/services/customer-area.service';
import {
  createOlivePlot,
  getOliveCropId,
  getOlivePlot,
  getOlivePlots,
  upsertOlivePlotDetails,
  getOliveAreaIds,
} from '@/lib/services/olive-plot.service';

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const customerId = resolveCustomerId(ctx, searchParams.get('customerId'));
    const areaIds = await getAccessibleAreaIds(ctx.supabase, ctx.isAdmin, customerId);

    const plots = await getOlivePlots(ctx.supabase, areaIds);
    return NextResponse.json(plots);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Create an olive plot.
 *
 * Separate from POST /api/areas, which also creates an area and links a
 * customer, for two reasons. This route forces crop_id to the זית crop —
 * non-negotiable, because getOlivePlots filters on `crops!inner` and a plot
 * created without it is invisible in the grid that created it. And customer_id
 * is MANDATORY here, where /api/areas legitimately creates unlinked areas for
 * /admin/areas-management.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    // A plot IS an area, so creating one is create_area — not a new permission.
    if (!(await checkPermission(ctx, 'create_area'))) {
      return NextResponse.json({ error: 'אין הרשאה ליצור חלקה' }, { status: 403 });
    }

    const body = await request.json();

    // The body's customer_id is an admin-only override by construction:
    // resolveCustomerId ignores it for everyone else and falls back to the
    // caller's own tenancy.
    const customerId = resolveCustomerId(ctx, body.customer_id ?? null);
    if (!customerId) {
      return NextResponse.json({ error: 'נדרש לבחור לקוח' }, { status: 400 });
    }

    // Only the admin override is attacker-supplied, and an admin may
    // legitimately target any tenant — so this check's whole job is "does it
    // exist", turning a typo'd id into a Hebrew 404 rather than a raw FK 500.
    if (ctx.isAdmin && body.customer_id) {
      const { data: customer } = await (ctx.supabase.from('customers') as any)
        .select('id')
        .eq('id', customerId)
        .maybeSingle();
      if (!customer) {
        return NextResponse.json({ error: 'הלקוח לא נמצא' }, { status: 404 });
      }
    }

    const name = String(body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ error: 'נדרש שם חלקה' }, { status: 400 });
    }

    // Duplicate name inside the tenant. areas.name carries no unique constraint
    // and cannot get one — the scope is "within a customer", which lives across
    // the customer_areas junction. It matters because the importer matches plots
    // by name within a customer, so two plots sharing one would silently merge
    // on the next import.
    const { data: clashes } = await (ctx.supabase.from('customer_areas') as any)
      .select('area_id, areas!inner(name)')
      .eq('customer_id', customerId)
      .eq('areas.name', name);

    if (clashes && clashes.length > 0) {
      return NextResponse.json(
        { error: 'חלקה בשם זה כבר קיימת אצל לקוח זה' },
        { status: 409 }
      );
    }

    const taktCount = Number(body.takt_count);
    const takts =
      Number.isInteger(taktCount) && taktCount >= 1 && taktCount <= MAX_TAKT_COUNT
        ? taktCount
        : null;

    const cropId = await getOliveCropId(ctx.supabase);

    // adminClient: areas INSERT is admin-only at the RLS level
    // (20260206000000_add_admin_areas_policies.sql), which is why the checks
    // above are the boundary rather than the policies.
    const { areaId, warnings } = await createOlivePlot(ctx.adminClient, {
      customerId,
      cropId,
      name,
      description: body.description ?? null,
      variety: body.variety ?? null,
      size: body.size === null || body.size === undefined || body.size === '' ? null : Number(body.size),
      plantingTime: body.planting_time || null,
      taktCount: takts,
      details: {
        grower_id: body.grower_id ?? null,
        grower_name: body.grower_name ?? null,
        region: body.region ?? null,
        plot_type: body.plot_type ?? null,
        harvester: body.harvester ?? null,
        water_type: body.water_type ?? null,
        takt_count: takts,
        plant_year_label: body.plant_year_label ?? null,
      },
    });

    const plot = await getOlivePlot(ctx.supabase, areaId);
    return NextResponse.json({ plot, warnings }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Update the olive-specific fields of a plot.
 *
 * The plot's own columns (name, variety, planting_time, size) live on `areas`
 * and are edited through /api/areas — this endpoint owns olive_plot_details only.
 */
export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const { area_id, ...details } = body;

    if (!area_id) {
      return NextResponse.json({ error: 'נדרש מזהה חלקה' }, { status: 400 });
    }

    const customerId = resolveCustomerId(ctx, null);
    const accessible = await getAccessibleAreaIds(ctx.supabase, ctx.isAdmin, customerId);
    const areaIds = await getOliveAreaIds(ctx.supabase, accessible);
    if (!areaIds.includes(area_id)) {
      return NextResponse.json({ error: 'אין הרשאה לחלקה זו' }, { status: 403 });
    }

    const saved = await upsertOlivePlotDetails(ctx.adminClient, area_id, details);
    return NextResponse.json(saved);
  } catch (error) {
    return handleApiError(error);
  }
}
