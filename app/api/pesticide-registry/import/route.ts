import { NextRequest, NextResponse } from 'next/server';
import { getApiContext, checkRole } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { importRegistry } from '@/lib/services/registry-import.service';

export async function POST(request: NextRequest) {
  try {
    const ctx = await getApiContext();
    const isCustomerOwner = await checkRole(ctx, 'customer_owner');
    if (!ctx.isAdmin && !isCustomerOwner) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cropsParam = formData.get('crops') as string | null;
    const replaceParam = formData.get('replace') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'נדרש קובץ CSV' }, { status: 400 });
    }
    if (!cropsParam) {
      return NextResponse.json({ error: 'נדרש לבחור גידולים' }, { status: 400 });
    }

    const selectedCrops = cropsParam.split(',').map((c) => c.trim()).filter(Boolean);
    const replace = replaceParam === 'true';
    const content = await file.text();

    const result = await importRegistry(
      ctx.adminClient,
      content,
      selectedCrops,
      file.name,
      replace
    );

    return NextResponse.json({
      success: result.success,
      batchId: result.batchId,
      summary: result.summary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
