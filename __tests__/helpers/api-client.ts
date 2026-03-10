/**
 * HTTP API client for integration tests.
 * Authenticates via Bearer token against the running Next.js server.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

let cachedToken: string | null = null;

/**
 * Login to Supabase and return an access token for API calls.
 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error || !data.session) {
    throw new Error(
      `Failed to login as ${TEST_EMAIL}. Ensure the user exists (npm run create-admin).\nError: ${error?.message}`
    );
  }

  cachedToken = data.session.access_token;
  return cachedToken;
}

/**
 * Make an authenticated GET request to the API.
 */
export async function apiGet(path: string, params?: Record<string, string>): Promise<Response> {
  const token = await getAccessToken();
  const url = new URL(path, API_BASE);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  return fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Upload a CSV file to the import API via multipart form.
 */
export async function apiImportCsv(
  csvContent: string,
  crops: string[],
  replace: boolean = false,
  filename: string = 'test-registry.csv'
): Promise<Response> {
  const token = await getAccessToken();
  const url = new URL('/api/pesticide-registry/import', API_BASE);

  const formData = new FormData();
  const blob = new Blob([csvContent], { type: 'text/csv' });
  formData.append('file', blob, filename);
  formData.append('crops', crops.join(','));
  formData.append('replace', String(replace));

  return fetch(url.toString(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}
