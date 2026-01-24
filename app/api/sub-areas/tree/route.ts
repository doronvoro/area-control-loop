import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

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
    const { data, error } = await supabase
      .from('sub_areas')
      .select('*')
      .eq('area_id', areaId)
      .order('level')
      .order('name');

    if (error) throw error;

    const tree = await buildTree(data || []);

    return NextResponse.json(tree);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
