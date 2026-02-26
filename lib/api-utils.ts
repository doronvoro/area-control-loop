import { AuthError } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Handle API route errors with proper status codes.
 * Returns 401 for auth errors (mobile Bearer token), 500 for other errors.
 */
export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json({ error: message }, { status: 500 });
}
