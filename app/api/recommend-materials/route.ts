import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

// GET - Fetch recommendations
// Query params: cropId, actionTypeId, materialId
export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const cropId = searchParams.get('cropId');
    const actionTypeId = searchParams.get('actionTypeId');
    const materialId = searchParams.get('materialId');

    const supabase = await createClient();
    let query = supabase
      .from('recommend_material')
      .select('*, crops(*), action_types(*), materials(*), unit_types(*)');

    if (cropId) query = query.eq('crop_id', cropId);
    if (actionTypeId) query = query.eq('action_type_id', actionTypeId);
    if (materialId) query = query.eq('material_id', materialId);

    const { data, error } = await query.order('crop_id').order('action_type_id').order('material_id');

    if (error) throw error;

    // Group by key (crop_id, action_type_id, material_id)
    const grouped: Record<string, any[]> = {};
    (data || []).forEach((item: any) => {
      const key = `${item.crop_id}_${item.action_type_id}_${item.material_id}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push({
        id: item.id,
        unit_type_id: item.unit_type_id,
        unit_type: item.unit_types,
        dosage: item.dosage,
        crop: item.crops,
        action_type: item.action_types,
        material: item.materials,
      });
    });

    // Format response - need to get the actual data from the first item
    const result = Object.entries(grouped).map(([key, values]) => {
      const [cropId, actionTypeId, materialId] = key.split('_');
      // Get the full item data from the original data array
      const firstItem = (data || []).find(
        (item: any) =>
          item.crop_id === cropId &&
          item.action_type_id === actionTypeId &&
          item.material_id === materialId
      ) as any;
      return {
        key: {
          crop_id: cropId,
          action_type_id: actionTypeId,
          material_id: materialId,
          crop: firstItem?.crops || null,
          action_type: firstItem?.action_types || null,
          material: firstItem?.materials || null,
        },
        values: values.map((v) => ({
          id: v.id,
          unit_type_id: v.unit_type_id,
          unit_type: v.unit_type,
          dosage: parseFloat(v.dosage),
        })),
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Create recommendation
export async function POST(request: Request) {
  try {
    await requireAuth();
    
    const canManage = await hasPermission('create_area'); // Using create_area as proxy for admin
    if (!canManage) {
      return NextResponse.json(
        { error: 'אין הרשאה ליצור המלצות' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { crop_id, action_type_id, material_id, dosages } = body;

    if (!crop_id || !action_type_id || !material_id || !dosages || !Array.isArray(dosages)) {
      return NextResponse.json(
        { error: 'crop_id, action_type_id, material_id ו-dosages נדרשים' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const recommendations = dosages.map((d: any) => ({
      crop_id,
      action_type_id,
      material_id,
      unit_type_id: d.unit_type_id,
      dosage: d.dosage,
    }));

    const { data, error } = await (supabase
      .from('recommend_material') as any)
      .insert(recommendations)
      .select();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update recommendation
export async function PUT(request: Request) {
  try {
    await requireAuth();
    
    const canManage = await hasPermission('update_area');
    if (!canManage) {
      return NextResponse.json(
        { error: 'אין הרשאה לעדכן המלצות' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, unit_type_id, dosage } = body;

    if (!id || !unit_type_id || dosage === undefined) {
      return NextResponse.json(
        { error: 'id, unit_type_id ו-dosage נדרשים' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const query = supabase.from('recommend_material') as any;
    const { data, error } = await query
      .update({
        unit_type_id,
        dosage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Delete recommendation
export async function DELETE(request: Request) {
  try {
    await requireAuth();
    
    const canManage = await hasPermission('delete_area');
    if (!canManage) {
      return NextResponse.json(
        { error: 'אין הרשאה למחוק המלצות' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const key = searchParams.get('key'); // Delete all for a key: crop_id_action_type_id_material_id

    if (!id && !key) {
      return NextResponse.json(
        { error: 'id או key נדרש' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const query = supabase.from('recommend_material') as any;

    if (id) {
      const { error } = await query.delete().eq('id', id);
      if (error) throw error;
    } else if (key) {
      const [crop_id, action_type_id, material_id] = key.split('_');
      const { error } = await query
        .delete()
        .eq('crop_id', crop_id)
        .eq('action_type_id', action_type_id)
        .eq('material_id', material_id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
