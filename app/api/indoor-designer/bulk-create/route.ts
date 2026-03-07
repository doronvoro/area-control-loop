import { NextResponse } from 'next/server';
import { getApiContext, checkPermission, resolveCustomerId } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

interface SubAreaInput {
  temp_id: string;
  parent_temp_id: string | null;
  level: number;
  name: string;
  geometry: any;
  variety?: string;
  rows?: string;
  crop_id?: string;
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();

    // Check permissions
    const [canCreateArea, canCreateSubArea] = await Promise.all([
      checkPermission(ctx, 'create_area'),
      checkPermission(ctx, 'create_sub_area'),
    ]);

    if (!canCreateArea) {
      return NextResponse.json(
        { error: 'אין הרשאה ליצור שטח' },
        { status: 403 }
      );
    }

    if (!canCreateSubArea) {
      return NextResponse.json(
        { error: 'אין הרשאה ליצור תתי-שטחים' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { area, sub_areas } = body as {
      area: {
        id?: string; // If provided, update existing area
        name: string;
        description?: string | null;
        area_type: string;
        geometry: any;
        crop_id?: string;
        size?: number;
        size_unit_type?: string;
      };
      sub_areas: SubAreaInput[];
    };

    // Validate
    if (!area?.name) {
      return NextResponse.json(
        { error: 'שם שטח נדרש' },
        { status: 400 }
      );
    }

    if (!area?.geometry) {
      return NextResponse.json(
        { error: 'גיאומטריה נדרשת' },
        { status: 400 }
      );
    }

    if (!sub_areas || sub_areas.length === 0) {
      return NextResponse.json(
        { error: 'יש להגדיר לפחות תת-שטח אחד' },
        { status: 400 }
      );
    }

    // Get current customer
    const customerId = resolveCustomerId(ctx);

    if (!customerId) {
      return NextResponse.json(
        { error: 'לא נמצא לקוח' },
        { status: 401 }
      );
    }

    // Stream progress back to client
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const send = async (event: Record<string, unknown>) => {
      await writer.write(encoder.encode(JSON.stringify(event) + '\n'));
    };

    // Run the inserts in the background, writing progress to the stream
    (async () => {
      try {
        const adminClient = ctx.adminClient;
        const isUpdate = !!area.id;

        let areaId: string;
        let areaName: string;

        if (isUpdate) {
          // Update existing area
          await send({ step: 'area', message: 'מעדכן שטח...', progress: 5 });

          const { data: areaData, error: areaError } = await (
            adminClient.from('areas') as any
          )
            .update({
              name: area.name,
              description: area.description || null,
              area_type: area.area_type || 'indoor',
              geometry: area.geometry,
            })
            .eq('id', area.id)
            .select()
            .single();

          if (areaError) throw areaError;

          areaId = areaData.id;
          areaName = areaData.name;

          // Delete existing sub-areas for this area
          await send({ step: 'cleanup', message: 'מנקה תתי-שטחים ישנים...', progress: 10 });

          const { error: deleteError } = await (
            adminClient.from('sub_areas') as any
          )
            .delete()
            .eq('area_id', areaId);

          if (deleteError) {
            console.error('Error deleting old sub-areas:', deleteError);
          }
        } else {
          // Create new area
          await send({ step: 'area', message: 'יוצר שטח...', progress: 5 });

          const { data: areaData, error: areaError } = await (
            adminClient.from('areas') as any
          )
            .insert({
              name: area.name,
              description: area.description || null,
              area_type: area.area_type || 'indoor',
              geometry: area.geometry,
              crop_id: area.crop_id || null,
              size: area.size ?? null,
              size_unit_type: area.size_unit_type || null,
            })
            .select()
            .single();

          if (areaError) throw areaError;

          areaId = areaData.id;
          areaName = areaData.name;

          // Link area to customer
          await send({ step: 'link', message: 'מקשר ללקוח...', progress: 10 });

          const { error: linkError } = await (
            adminClient.from('customer_areas') as any
          ).insert({
            customer_id: customerId,
            area_id: areaId,
          });

          if (linkError) {
            console.error('Error linking area to customer:', linkError);
          }
        }

        // 3. Create sub-areas level by level (batch insert per level)
        const byLevel = new Map<number, SubAreaInput[]>();
        for (const sa of sub_areas) {
          const group = byLevel.get(sa.level) || [];
          group.push(sa);
          byLevel.set(sa.level, group);
        }
        const levels = [...byLevel.keys()].sort((a, b) => a - b);

        const tempIdToRealId = new Map<string, string>();
        const tempIdToDisplay = new Map<string, string>();
        const createdSubAreas: any[] = [];

        // Progress: levels span from 15% to 95%
        const progressPerLevel = 80 / levels.length;

        for (let li = 0; li < levels.length; li++) {
          const level = levels[li];
          const group = byLevel.get(level)!;
          const levelProgress = Math.round(15 + (li + 1) * progressPerLevel);

          await send({
            step: 'level',
            level,
            count: group.length,
            message: `יוצר רמה ${level} (${group.length} תתי-שטחים)...`,
            progress: Math.round(15 + li * progressPerLevel),
          });

          const rows = group.map((sa) => {
            const parentSubAreaId = sa.parent_temp_id
              ? tempIdToRealId.get(sa.parent_temp_id) || null
              : null;

            let display = `${areaName} | ${sa.name}`;
            if (sa.parent_temp_id) {
              const parentDisplay = tempIdToDisplay.get(sa.parent_temp_id);
              if (parentDisplay) {
                display = `${parentDisplay} | ${sa.name}`;
              }
            }

            return {
              _temp_id: sa.temp_id,
              area_id: areaId,
              parent_sub_area_id: parentSubAreaId,
              level: sa.level,
              name: sa.name,
              display,
              geometry: sa.geometry,
              variety: sa.variety || null,
              rows: sa.rows || null,
              crop_id: sa.crop_id || null,
            };
          });

          const insertData = rows.map(({ _temp_id, ...rest }) => rest);
          const { data: inserted, error: insertError } = await (
            adminClient.from('sub_areas') as any
          )
            .insert(insertData)
            .select();

          if (insertError) {
            console.error(`Error batch-inserting level ${level}:`, insertError);
            continue;
          }

          for (let i = 0; i < inserted.length; i++) {
            const tempId = rows[i]._temp_id;
            tempIdToRealId.set(tempId, inserted[i].id);
            tempIdToDisplay.set(tempId, inserted[i].display);
            createdSubAreas.push(inserted[i]);
          }

          await send({
            step: 'level_done',
            level,
            progress: levelProgress,
          });
        }

        // Done
        await send({
          step: 'done',
          progress: 100,
          message: 'הושלם!',
          data: {
            area: { id: areaId, name: areaName },
            sub_areas: createdSubAreas,
            total_created: createdSubAreas.length,
          },
        });
      } catch (error) {
        console.error('Bulk create error:', error);
        await send({
          step: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : 'שגיאה בשמירת השטח',
        });
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Bulk create error:', error);
    return handleApiError(error);
  }
}
