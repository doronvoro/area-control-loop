import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { Database } from '@/types/database';
import { createClientWithToken } from './server-with-token';

// Enable debug logging for Supabase queries
const DEBUG_SUPABASE = process.env.DEBUG_SUPABASE === 'true';

// Custom fetch that logs all Supabase requests
const debugFetch: typeof fetch = async (input, init) => {
  if (DEBUG_SUPABASE) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';
    const body = init?.body;

    // Parse the URL to extract query info
    const urlObj = new URL(url);
    const table = urlObj.pathname.split('/rest/v1/')[1]?.split('?')[0];
    const params = Object.fromEntries(urlObj.searchParams.entries());

    console.log('\n🔍 SUPABASE QUERY:');
    console.log(`   Method: ${method}`);
    console.log(`   Table: ${table}`);
    if (Object.keys(params).length > 0) {
      console.log(`   Params:`, JSON.stringify(params, null, 2));
    }
    if (body) {
      try {
        const bodyData = JSON.parse(body as string);
        console.log(`   Body:`, JSON.stringify(bodyData, null, 2));
      } catch {
        console.log(`   Body: ${body}`);
      }
    }
    console.log('');
  }

  return fetch(input, init);
};

/**
 * Create a Supabase client that works for both web (cookies) and mobile (Bearer token).
 * Checks the Authorization header first; falls back to cookie-based client.
 */
export async function createClient() {
  // Check for Bearer token (mobile requests)
  const headersList = await headers();
  const authHeader = headersList.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return createClientWithToken(token);
  }

  // Fall back to cookie-based client (web requests)
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.'
    );
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
      global: {
        fetch: DEBUG_SUPABASE ? debugFetch : fetch,
      },
    }
  );
}

/** @deprecated Use createClient() instead - it's now token-aware */
export const createClientFromRequest = createClient;

/**
 * Create a Supabase admin client with service role key.
 * Use this for admin operations like creating/deleting users.
 * IMPORTANT: Only use in server-side code, never expose to client.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase admin environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: DEBUG_SUPABASE ? debugFetch : fetch,
    },
  });
}
