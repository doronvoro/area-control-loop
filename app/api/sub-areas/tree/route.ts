import { createAdminClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
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

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Use admin client to bypass RLS
    const { data, error } = await (adminClient.from('sub_areas') as any)
      .select('*')
      .eq('area_id', areaId)
      .order('level')
      .order('name');

    // Debug: check auth status
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[sub-areas/tree] user id:', user?.id);

    // Check if user is admin via user_roles
    const { data: adminCheck } = await supabase
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', user?.id || '');
    console.log('[sub-areas/tree] user roles:', JSON.stringify(adminCheck, null, 2));

    console.log('[sub-areas/tree] areaId:', areaId);
    console.log('[sub-areas/tree] data:', JSON.stringify(data, null, 2));
    console.log('[sub-areas/tree] error:', error);

    if (error) throw error;

    const tree = await buildTree(data || []);

    return NextResponse.json(tree);
  } catch (error) {
    return handleApiError(error);
  }
}
