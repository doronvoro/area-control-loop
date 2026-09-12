import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { assertAreaVisible } from '@/lib/api/utils';
import { handleApiError } from '@/lib/api-utils';

interface SubArea {
  id: string;
  area_id: string;
  parent_sub_area_id: string | null;
  level: number;
  name: string;
  variety: string | null;
  rows: string | null;
  display: string | null;
  children?: SubArea[];
}

async function buildTree(
  items: SubArea[],
  parentId: string | null = null
): Promise<SubArea[]> {
  const filtered = items.filter((item) => item.parent_sub_area_id === parentId);
  const result: SubArea[] = [];

  for (const item of filtered) {
    const children = await buildTree(items, item.id);
    result.push({
      ...item,
      children,
    });
  }

  return result;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId');

    if (!areaId) {
      return NextResponse.json(
        { error: 'areaId is required' },
        { status: 400 }
      );
    }

    // Tenancy check first: this handler read through adminClient with no
    // authorization at all, so any logged-in user could fetch any area's
    // sub-area tree by id.
    const ctx = await getApiContext();
    await assertAreaVisible(ctx.supabase, areaId);

    // adminClient is retained for the tree read itself — buildTree needs every
    // row in the area to resolve parent chains, and a partial result would
    // silently drop branches rather than fail.
    const adminClient = createAdminClient();

    const { data, error } = await (adminClient.from('sub_areas') as any)
      .select('*')
      .eq('area_id', areaId)
      .order('level')
      .order('name');

    if (error) throw error;

    const tree = await buildTree(data || []);

    return NextResponse.json(tree);
  } catch (error) {
    return handleApiError(error);
  }
}
