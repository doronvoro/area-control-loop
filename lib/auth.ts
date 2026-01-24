import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getCurrentCustomer() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
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

  const supabase = await createClient();
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
    redirect('/login');
  }
  return user;
}
