import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentCustomer, getCurrentWorker, requireAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

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
    await requireAuth();

    // Check permissions
    const [canCreateArea, canCreateSubArea] = await Promise.all([
      hasPermission('create_area'),
      hasPermission('create_sub_area'),
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
    const customer = await getCurrentCustomer();
    const worker = await getCurrentWorker();
    const customerId = (customer as any)?.id || (worker as any)?.customer_id;

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
        const adminClient = createAdminClient();

        // 1. Create the area
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

        const areaId = areaData.id;
        const areaName = areaData.name;

        // 2. Link area to customer
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
            area: areaData,
            sub_areas: createdSubAreas,
            total_created: createdSubAreas.length,
          },
        });
      } catch (error: any) {
        console.error('Bulk create error:', error);
        await send({
          step: 'error',
          progress: 0,
          error: error.message || 'שגיאה בשמירת השטח',
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
  } catch (error: any) {
    console.error('Bulk create error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
