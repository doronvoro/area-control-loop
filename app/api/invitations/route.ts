import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth, getCurrentCustomer } from '@/lib/auth';
import { generateInvitationEmail, sendEmail } from '@/lib/email';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    await requireAuth();
    const supabase = await createClient();
    const body = await request.json();
    const { invitation_type, email, name, customer_id, worker_type_id } = body;

    // Generate token and expiration
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const query = supabase.from('invitations') as any;
    const { data, error } = await query
      .insert({
        invitation_type,
        invited_by_user_id: (await requireAuth()).id,
        email,
        name,
        customer_id: invitation_type === 'worker' ? customer_id : null,
        worker_type_id: invitation_type === 'worker' ? worker_type_id : null,
        token,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Send invitation email
    const { subject, html } = generateInvitationEmail(
      name,
      token,
      invitation_type,
      expiresAt
    );

    await sendEmail({
      to: email,
      subject,
      html,
    });

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await requireAuth();
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');

    let query = supabase.from('invitations').select('*');

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
