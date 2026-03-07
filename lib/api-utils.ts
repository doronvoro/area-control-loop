import { AuthError } from '@/lib/auth';
import { DuplicateEmailError } from '@/lib/api/utils';
import { NextResponse } from 'next/server';

/**
 * Handle API route errors with proper status codes.
 * - AuthError → 401
 * - DuplicateEmailError → 400
 * - Everything else → 500
 */
export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof DuplicateEmailError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json({ error: message }, { status: 500 });
}
