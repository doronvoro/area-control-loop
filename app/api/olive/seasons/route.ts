import { NextResponse } from 'next/server';
import {
  getApiContext,
  requireWorkerAdminOrCustomer,
  requireAdminOrCustomerOwner,
} from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getSeasons, upsertSeason } from '@/lib/services/olive-config.service';

export async function GET() {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const seasons = await getSeasons(ctx.supabase);
    return NextResponse.json(seasons);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Opening or renaming a season is an ops-manager action, not a field action. */
export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    const forbidden = await requireAdminOrCustomerOwner(ctx);
    if (forbidden) return forbidden;

    const body = await request.json();
    const { id, name, year_type, starts_on, ends_on, is_active } = body;

    if (!name || !starts_on || !ends_on) {
      return NextResponse.json({ error: 'נדרשים שם, תאריך התחלה ותאריך סיום' }, { status: 400 });
    }

    const saved = await upsertSeason(ctx.adminClient, {
      id,
      name,
      yearType: year_type ?? null,
      startsOn: starts_on,
      endsOn: ends_on,
      isActive: Boolean(is_active),
    });

    return NextResponse.json(saved, { status: id ? 200 : 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
