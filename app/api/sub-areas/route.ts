import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

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

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('sub_areas')
      .select('*, crops(*)')
      .eq('area_id', areaId)
      .order('level')
      .order('name');

    if (error) throw error;

    // Build display names with area name and get area's crop for inheritance
    const { data: area } = await supabase
      .from('areas')
      .select('name, crop_id, crops(*)')
      .eq('id', areaId)
      .single();

    const areaName = (area as any)?.name || '';
    const areaCropId = (area as any)?.crop_id || null;
    const areaCrop = (area as any)?.crops || null;

    // Build hierarchical paths for display and add effective crop
    const subAreasWithDisplay = (data || []).map((subArea: any) => {
      // Determine effective crop (sub-area's own crop or inherited from area)
      const effectiveCropId = subArea.crop_id || areaCropId;
      const effectiveCrop = subArea.crops || areaCrop;

      // Build display if needed
      let display = subArea.display;
      if (!display || !display.includes(areaName)) {
        // Traverse up the hierarchy to build full path
        const buildPath = (sa: any, allSubAreas: any[]): string[] => {
          if (!sa.parent_sub_area_id) {
            return [sa.name];
          }
          const parent = allSubAreas.find((s: any) => s.id === sa.parent_sub_area_id);
          if (parent) {
            return [...buildPath(parent, allSubAreas), sa.name];
          }
          return [sa.name];
        };

        const fullPath = buildPath(subArea, data || []);
        display = `${areaName} | ${fullPath.join(' | ')}`;
      }

      return {
        ...subArea,
        display,
        effective_crop_id: effectiveCropId,
        effective_crop: effectiveCrop,
      };
    });

    return NextResponse.json(subAreasWithDisplay);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuth();
    
    // Check permission
    const canUpdate = await hasPermission('update_sub_area');
    if (!canUpdate) {
      return NextResponse.json(
        { error: 'אין הרשאה לעדכן תת-שטח' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, variety, rows, parent_sub_area_id, level, crop_id } = body;

    if (!id || !name) {
      return NextResponse.json(
        { error: 'id ו-name נדרשים' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Get current sub-area to check area_id
    const { data: currentSubArea } = await supabase
      .from('sub_areas')
      .select('area_id')
      .eq('id', id)
      .single();

    if (!currentSubArea) {
      return NextResponse.json(
        { error: 'תת-שטח לא נמצא' },
        { status: 404 }
      );
    }

    const updateData: any = {
      name,
      variety: variety || null,
      rows: rows || null,
      updated_at: new Date().toISOString(),
    };

    if (parent_sub_area_id !== undefined) {
      updateData.parent_sub_area_id = parent_sub_area_id || null;
    }

    if (level !== undefined) {
      updateData.level = level;
    }

    if (crop_id !== undefined) {
      updateData.crop_id = crop_id || null;
    }

    // Use admin client to bypass RLS
    const { data, error } = await (adminClient.from('sub_areas') as any)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    
    // Check permission
    const canCreate = await hasPermission('create_sub_area');
    if (!canCreate) {
      return NextResponse.json(
        { error: 'אין הרשאה ליצור תת-שטח' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { area_id, name, variety, rows, parent_sub_area_id, level, crop_id } = body;

    if (!area_id || !name) {
      return NextResponse.json(
        { error: 'area_id ו-name נדרשים' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Calculate level if not provided
    let calculatedLevel = level || 1;
    if (parent_sub_area_id) {
      const { data: parent } = await supabase
        .from('sub_areas')
        .select('level')
        .eq('id', parent_sub_area_id)
        .single();
      if (parent) {
        calculatedLevel = (parent as any).level + 1;
      }
    }

    // Build display name
    const { data: area } = await supabase
      .from('areas')
      .select('name')
      .eq('id', area_id)
      .single();

    const areaName = (area as any)?.name || '';
    let display = `${areaName} | ${name}`;

    if (parent_sub_area_id) {
      const { data: parent } = await supabase
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
      rows: rows || null,
      parent_sub_area_id: parent_sub_area_id || null,
      level: calculatedLevel,
      display,
      crop_id: crop_id || null,
    };

    // Use admin client to bypass RLS
    const { data, error } = await (adminClient.from('sub_areas') as any)
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();
    
    // Check permission
    const canDelete = await hasPermission('delete_sub_area');
    if (!canDelete) {
      return NextResponse.json(
        { error: 'אין הרשאה למחוק תת-שטח' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id נדרש' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    // Use admin client to bypass RLS
    const { error } = await (adminClient.from('sub_areas') as any).delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
