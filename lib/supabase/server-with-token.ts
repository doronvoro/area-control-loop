import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

/**
 * Create a Supabase client authenticated with a user's access token (Bearer token).
 * Used for mobile API requests that send Authorization: Bearer headers.
 * The access_token is a Supabase JWT, so RLS policies evaluate against it.
 */
export function createClientWithToken(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
