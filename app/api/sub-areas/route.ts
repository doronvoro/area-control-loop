import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getApiContext, checkPermission } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId');

    if (!areaId) {
      return NextResponse.json({ error: 'areaId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('sub_areas')
      .select('*, crops(*)')
      .eq('area_id', areaId)
      .order('level')
      .order('name');

    if (error) throw error;

    const { data: area } = await supabase
      .from('areas')
      .select('name, crop_id, crops(*)')
      .eq('id', areaId)
      .single();

    const areaName = (area as any)?.name || '';
    const areaCropId = (area as any)?.crop_id || null;
    const areaCrop = (area as any)?.crops || null;

    const subAreasWithDisplay = (data || []).map((subArea: any) => {
      const effectiveCropId = subArea.crop_id || areaCropId;
      const effectiveCrop = subArea.crops || areaCrop;

      let display = subArea.display;
      if (!display || !display.includes(areaName)) {
        const buildPath = (sa: any, allSubAreas: any[]): string[] => {
          if (!sa.parent_sub_area_id) return [sa.name];
          const parent = allSubAreas.find((s: any) => s.id === sa.parent_sub_area_id);
          if (parent) return [...buildPath(parent, allSubAreas), sa.name];
          return [sa.name];
        };

        const fullPath = buildPath(subArea, data || []);
        display = `${areaName} | ${fullPath.join(' | ')}`;
      }

      return { ...subArea, display, effective_crop_id: effectiveCropId, effective_crop: effectiveCrop };
    });

    return NextResponse.json(subAreasWithDisplay);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!(await checkPermission(ctx, 'update_sub_area'))) {
      return NextResponse.json({ error: 'אין הרשאה לעדכן תת-שטח' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, variety, planting_time, rows, parent_sub_area_id, level, crop_id, size, size_unit_type } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'id ו-name נדרשים' }, { status: 400 });
    }

    const { data: currentSubArea } = await ctx.supabase
      .from('sub_areas')
      .select('area_id')
      .eq('id', id)
      .single();

    if (!currentSubArea) {
      return NextResponse.json({ error: 'תת-שטח לא נמצא' }, { status: 404 });
    }

    const updateData: any = {
      name,
      variety: variety || null,
      planting_time: planting_time || null,
      rows: rows || null,
      updated_at: new Date().toISOString(),
    };

    if (parent_sub_area_id !== undefined) updateData.parent_sub_area_id = parent_sub_area_id || null;
    if (level !== undefined) updateData.level = level;
    if (crop_id !== undefined) updateData.crop_id = crop_id || null;
    if (size !== undefined) updateData.size = size ?? null;
    if (size_unit_type !== undefined) updateData.size_unit_type = size_unit_type || null;

    const { data, error } = await (ctx.adminClient.from('sub_areas') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!(await checkPermission(ctx, 'create_sub_area'))) {
      return NextResponse.json({ error: 'אין הרשאה ליצור תת-שטח' }, { status: 403 });
    }

    const body = await request.json();
    const { area_id, name, variety, planting_time, rows, parent_sub_area_id, level, crop_id, size, size_unit_type, geometry } = body;

    if (!area_id || !name) {
      return NextResponse.json({ error: 'area_id ו-name נדרשים' }, { status: 400 });
    }

    let calculatedLevel = level || 1;
    if (parent_sub_area_id) {
      const { data: parent } = await ctx.supabase
        .from('sub_areas')
        .select('level')
        .eq('id', parent_sub_area_id)
        .single();
      if (parent) calculatedLevel = (parent as any).level + 1;
    }

    const { data: area } = await ctx.supabase
      .from('areas')
      .select('name')
      .eq('id', area_id)
      .single();

    const areaName = (area as any)?.name || '';
    let display = `${areaName} | ${name}`;

    if (parent_sub_area_id) {
      const { data: parent } = await ctx.supabase
        .from('sub_areas')
        .select('display, name')
        .eq('id', parent_sub_area_id)
        .single();
      if (parent) {
        const parentDisplay = (parent as any).display || (parent as any).name;
        display = `${parentDisplay} | ${name}`;
      }
    }

    const insertData: any = {
      area_id,
      name,
      variety: variety || null,
      planting_time: planting_time || null,
      rows: rows || null,
      parent_sub_area_id: parent_sub_area_id || null,
      level: calculatedLevel,
      display,
      crop_id: crop_id || null,
      size: size ?? null,
      size_unit_type: size_unit_type || null,
      ...(geometry !== undefined ? { geometry: geometry || null } : {}),
    };

    const { data, error } = await (ctx.adminClient.from('sub_areas') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!(await checkPermission(ctx, 'delete_sub_area'))) {
      return NextResponse.json({ error: 'אין הרשאה למחוק תת-שטח' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'id נדרש' }, { status: 400 });

    const { error } = await (ctx.adminClient.from('sub_areas') as any).delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
