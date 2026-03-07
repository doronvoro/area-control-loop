import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import {
  getCascadeFindings,
  getCascadeActionTypes,
  getCascadeMaterials,
  getCascadeDosage,
} from '@/lib/services/cascade.service';

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const cropId = searchParams.get('cropId');
    const findingId = searchParams.get('findingId');
    const actionTypeId = searchParams.get('actionTypeId');
    const materialId = searchParams.get('materialId');

    switch (type) {
      case 'findings': {
        if (!cropId) {
          return NextResponse.json({ error: 'cropId is required for findings' }, { status: 400 });
        }
        const findings = await getCascadeFindings(ctx.supabase, { cropId });
        return NextResponse.json(findings);
      }

      case 'action_types': {
        const actionTypes = await getCascadeActionTypes(ctx.supabase);
        return NextResponse.json(actionTypes);
      }

      case 'materials': {
        if (!cropId) {
          return NextResponse.json({ error: 'cropId is required for materials' }, { status: 400 });
        }
        const materials = await getCascadeMaterials(ctx.supabase, { cropId, findingId, actionTypeId });
        return NextResponse.json(materials);
      }

      case 'dosage': {
        if (!cropId || !materialId) {
          return NextResponse.json(
            { error: 'cropId and materialId are required for dosage' },
            { status: 400 }
          );
        }
        const dosage = await getCascadeDosage(ctx.supabase, { cropId, findingId, actionTypeId, materialId });
        return NextResponse.json(dosage);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be: findings, action_types, materials, or dosage' },
          { status: 400 }
        );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
