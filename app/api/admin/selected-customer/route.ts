import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { SELECTED_CUSTOMER_COOKIE, serializeSelectionCookie } from '@/lib/api/customer-selection';
import { handleApiError } from '@/lib/api-utils';

/**
 * The admin's selected customer.
 *
 * POST { customerId } to scope the app to one tenant; DELETE to clear it.
 *
 * Only admins have a selection. A customer owner or worker has exactly one
 * tenancy and their scope is derived from it, so this route refuses them rather
 * than storing a value that would be ignored — a silently ignored cookie is
 * harder to debug than a 403.
 *
 * The full validation lives here, on the write, because it happens once per
 * switch. Reads do string work only; see lib/api/customer-selection.ts for why
 * that is sufficient.
 */

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'רק מנהל מערכת יכול להחליף לקוח' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const customerId = body?.customerId;

    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json({ error: 'customerId נדרש' }, { status: 400 });
    }

    // Confirm the customer exists before storing it. Done on adminClient rather
    // than ctx.supabase deliberately: whether an admin can SELECT `customers`
    // through RLS varies between databases (production is missing several of
    // the "Admins can view all X" policies), and a switcher that refuses valid
    // customers because of a missing policy would be baffling to debug.
    const { data: customer, error } = await ctx.adminClient
      .from('customers')
      .select('id, name')
      .eq('id', customerId)
      .maybeSingle();

    if (error) throw error;
    if (!customer) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    const found = customer as { id: string; name: string };

    const response = NextResponse.json({ customer: found });
    response.cookies.set({
      name: SELECTED_CUSTOMER_COOKIE,
      value: serializeSelectionCookie(ctx.user.id, found.id),
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      // No maxAge: a session cookie. The selection is a working context, not a
      // preference, and it should not outlive the browser session.
    });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const ctx = await getApiContext();

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'רק מנהל מערכת יכול להחליף לקוח' }, { status: 403 });
    }

    const response = NextResponse.json({ customer: null });
    response.cookies.set({
      name: SELECTED_CUSTOMER_COOKIE,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
