import { createClient } from '@/lib/supabase/server';
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
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
