import { NextResponse } from 'next/server';
import { ACTION_TYPE_OPTIONS } from '@/types/database';

export async function GET() {
  return NextResponse.json(ACTION_TYPE_OPTIONS);
}
