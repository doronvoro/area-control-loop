import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

/**
 * Generate a password-recovery link for a customer's owner, without sending an
 * email.
 *
 * Exists because the project uses Supabase's built-in email service, which is
 * capped at a couple of messages an hour and is not intended for production. A
 * new owner who cannot receive that email has no way in at all, and the
 * alternative — the admin choosing a password and passing it along — means the
 * admin knows a credential they should not.
 *
 * This is a stop-gap for missing SMTP, not a replacement for it: the owner
 * still cannot recover on their own, they have to reach an admin. Configuring
 * a real SMTP provider is what actually fixes that.
 *
 * The returned link IS a credential — it signs the holder in as that user as
 * well as letting them set a password. Single use, one hour.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();

    // Admin-only, and deliberately not scoped to the selected customer:
    // generating a link is part of onboarding a tenant, which happens on
    // /admin/customers before anyone would sensibly have selected them.
    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'רק מנהל מערכת יכול ליצור קישור' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const customerId = body?.customerId;

    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json({ error: 'customerId נדרש' }, { status: 400 });
    }

    const { data: customer, error: customerError } = await ctx.adminClient
      .from('customers')
      .select('id, name, user_id')
      .eq('id', customerId)
      .maybeSingle();

    if (customerError) throw customerError;

    const found = customer as { id: string; name: string; user_id: string | null } | null;
    if (!found) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }
    if (!found.user_id) {
      // A customers row with no auth user. Recoverable, but not from here.
      return NextResponse.json(
        { error: 'ללקוח זה אין משתמש מקושר — צור אותו מחדש עם אימייל וסיסמה' },
        { status: 400 }
      );
    }

    const { data: userData, error: userError } = await ctx.adminClient.auth.admin.getUserById(
      found.user_id
    );
    if (userError) throw userError;

    const email = userData?.user?.email;
    if (!email) {
      return NextResponse.json({ error: 'למשתמש אין כתובת אימייל' }, { status: 400 });
    }

    const origin = new URL(request.url).origin;

    // generateLink returns the link WITHOUT sending mail, which is the whole
    // point — it sidesteps the email rate limit entirely.
    const { data: linkData, error: linkError } = await ctx.adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${origin}/reset-password` },
    });
    if (linkError) throw linkError;

    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) {
      throw new Error('Supabase returned no action_link');
    }

    return NextResponse.json({
      link: actionLink,
      email,
      customerName: found.name,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
