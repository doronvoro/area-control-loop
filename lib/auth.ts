import { createClientFromRequest } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

async function isBearerRequest(): Promise<boolean> {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  return !!authHeader?.startsWith('Bearer ');
}

export async function getCurrentUser() {
  const supabase = await createClientFromRequest();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getCurrentCustomer() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClientFromRequest();
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return customer;
}

export async function getCurrentWorker() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClientFromRequest();
  const { data: worker } = await supabase
    .from('workers')
    .select('*, worker_types(*), customers(*)')
    .eq('user_id', user.id)
    .single();

  return worker;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    if (await isBearerRequest()) {
      throw new AuthError('Unauthorized', 401);
    }
    redirect('/login');
  }
  return user;
}
