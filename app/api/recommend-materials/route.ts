import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

// GET - Fetch recommendations
// Query params: cropId, findingId, actionTypeId, materialId
export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const cropId = searchParams.get('cropId');
    const findingId = searchParams.get('findingId');
    const actionTypeId = searchParams.get('actionTypeId');
    const materialId = searchParams.get('materialId');

    const supabase = await createClient();
    let query = supabase
      .from('recommend_material')
      .select('*, crops(*), findings(*), action_types(*), materials(*), unit_types(*)');

    if (cropId) query = query.eq('crop_id', cropId);
    if (findingId) {
      if (findingId === 'null') {
        query = query.is('finding_id', null);
      } else {
        query = query.eq('finding_id', findingId);
      }
    }
    if (actionTypeId) query = query.eq('action_type_id', actionTypeId);
    if (materialId) query = query.eq('material_id', materialId);

    const { data, error } = await query.order('crop_id').order('finding_id').order('action_type_id').order('material_id');

    if (error) throw error;

    // Group by composite key (crop_id, finding_id, action_type_id, material_id)
    const grouped: Record<string, any[]> = {};
    (data || []).forEach((item: any) => {
      const key = `${item.crop_id}_${item.finding_id || 'null'}_${item.action_type_id || 'null'}_${item.material_id}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    });

    // Format response using the first item in each group for relation data
    const result = Object.values(grouped).map((items) => {
      const first = items[0];
      return {
        key: {
          crop_id: first.crop_id,
          finding_id: first.finding_id || null,
          action_type_id: first.action_type_id,
          material_id: first.material_id,
          crop: first.crops || null,
          finding: first.findings || null,
          action_type: first.action_types || null,
          material: first.materials || null,
        },
        values: items.map((item) => ({
          id: item.id,
          unit_type_id: item.unit_type_id,
          unit_type: item.unit_types || null,
          dosage: parseFloat(item.dosage),
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
    const { crop_id, finding_id, action_type_id, material_id, dosages } = body;

    if (!crop_id || !material_id || !dosages || !Array.isArray(dosages)) {
      return NextResponse.json(
        { error: 'crop_id, material_id ו-dosages נדרשים' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const recommendations = dosages.map((d: any) => ({
      crop_id,
      finding_id: finding_id || null,
      action_type_id: action_type_id || null,
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
    const key = searchParams.get('key'); // Delete all for a key: crop_id_finding_id_action_type_id_material_id

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
      const [crop_id, finding_id, action_type_id, material_id] = key.split('_');
      let deleteQuery = query
        .delete()
        .eq('crop_id', crop_id)
        .eq('material_id', material_id);

      // Handle finding_id (can be 'null' string for NULL values)
      if (finding_id === 'null') {
        deleteQuery = deleteQuery.is('finding_id', null);
      } else {
        deleteQuery = deleteQuery.eq('finding_id', finding_id);
      }

      // Handle action_type_id (can be 'null' string for NULL values)
      if (action_type_id === 'null') {
        deleteQuery = deleteQuery.is('action_type_id', null);
      } else {
        deleteQuery = deleteQuery.eq('action_type_id', action_type_id);
      }

      const { error } = await deleteQuery;
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
