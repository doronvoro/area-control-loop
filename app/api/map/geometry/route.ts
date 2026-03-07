import { NextResponse } from 'next/server';
import { getApiContext, checkPermission } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();

    const body = await request.json();
    const { entity_type, entity_id, geometry } = body;

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { error: 'entity_type ו-entity_id נדרשים' },
        { status: 400 }
      );
    }

    if (entity_type !== 'area' && entity_type !== 'sub_area') {
      return NextResponse.json(
        { error: 'entity_type חייב להיות area או sub_area' },
        { status: 400 }
      );
    }

    // Validate geometry structure if provided
    if (geometry !== null && geometry !== undefined) {
      if (
        geometry.type !== 'Polygon' ||
        !Array.isArray(geometry.coordinates) ||
        geometry.coordinates.length === 0
      ) {
        return NextResponse.json(
          { error: 'geometry חייב להיות GeoJSON Polygon תקין' },
          { status: 400 }
        );
      }
    }

    // Check permission
    const permissionName =
      entity_type === 'area' ? 'update_area' : 'update_sub_area';
    const canUpdate = await checkPermission(ctx, permissionName);
    if (!canUpdate) {
      return NextResponse.json(
        { error: 'אין הרשאה לעדכן גיאומטריה' },
        { status: 403 }
      );
    }

    const tableName = entity_type === 'area' ? 'areas' : 'sub_areas';

    const { data, error } = await (ctx.adminClient.from(tableName) as any)
      .update({
        geometry: geometry || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entity_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
