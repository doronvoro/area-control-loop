import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/server';
import {
  parseCsvContent,
  extractCropList,
  filterRowsByCrops,
  parseDosage,
} from '@/lib/pesticide-registry';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const [isAdmin, isCustomerOwner] = await Promise.all([
      hasRole('admin'),
      hasRole('customer_owner'),
    ]);
    if (!isAdmin && !isCustomerOwner) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const cropsParam = formData.get('crops') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'נדרש קובץ CSV' }, { status: 400 });
    }

    const content = await file.text();
    const allRows = parseCsvContent(content);

    // Mode 1: No crops → return crop list
    if (!cropsParam) {
      const crops = extractCropList(allRows);
      return NextResponse.json({
        totalRows: allRows.length,
        crops,
      });
    }

    // Mode 2: With crops → return impact analysis
    const selectedCrops = cropsParam.split(',').map((c) => c.trim()).filter(Boolean);
    const filteredRows = filterRowsByCrops(allRows, selectedCrops);

    if (filteredRows.length === 0) {
      return NextResponse.json({
        error: 'לא נמצאו שורות עבור הגידולים שנבחרו',
      }, { status: 400 });
    }

    // Extract unique names from CSV
    const csvCropNames = [...new Set(filteredRows.map((r) => r.crop_name).filter(Boolean))];
    const csvPestNames = [...new Set(filteredRows.map((r) => r.pest_name).filter(Boolean))];
    const csvMaterialNames = [...new Set(filteredRows.map((r) => r.material_name).filter(Boolean))];

    const csvUnitNames = new Set<string>();
    let unparsableDosages = 0;
    let parsableDosages = 0;
    for (const row of filteredRows) {
      const parsed = parseDosage(row.dosage_text || '');
      if (parsed.value !== null && parsed.unit_name !== null) {
        csvUnitNames.add(parsed.unit_name);
        parsableDosages++;
      } else {
        unparsableDosages++;
      }
    }

    // Query existing data from DB
    const supabase = await createClient();

    const [
      { data: existingCrops },
      { data: existingFindings },
      { data: existingMaterials },
      { data: existingUnitTypes },
    ] = await Promise.all([
      supabase.from('crops').select('name').in('name', csvCropNames),
      supabase.from('findings').select('name').in('name', csvPestNames.length > 0 ? csvPestNames : ['']),
      supabase.from('materials').select('name').in('name', csvMaterialNames),
      supabase.from('unit_types').select('name').in('name', [...csvUnitNames]),
    ]);

    const existingCropNames = new Set((existingCrops || []).map((c: any) => c.name as string));
    const existingFindingNames = new Set((existingFindings || []).map((f: any) => f.name as string));
    const existingMaterialNames = new Set((existingMaterials || []).map((m: any) => m.name as string));
    const existingUnitTypeNames = new Set((existingUnitTypes || []).map((u: any) => u.name as string));

    // Crop-finding pairs
    const csvCropFindingPairs = new Set<string>();
    for (const row of filteredRows) {
      if (row.crop_name && row.pest_name) {
        csvCropFindingPairs.add(`${row.crop_name}|||${row.pest_name}`);
      }
    }

    return NextResponse.json({
      selectedCrops,
      filteredRows: filteredRows.length,
      impact: {
        newCrops: csvCropNames.filter((n) => !existingCropNames.has(n)).length,
        existingCrops: csvCropNames.filter((n) => existingCropNames.has(n)).length,
        newFindings: csvPestNames.filter((n) => !existingFindingNames.has(n)).length,
        existingFindings: csvPestNames.filter((n) => existingFindingNames.has(n)).length,
        newMaterials: csvMaterialNames.filter((n) => !existingMaterialNames.has(n)).length,
        existingMaterials: csvMaterialNames.filter((n) => existingMaterialNames.has(n)).length,
        newUnitTypes: [...csvUnitNames].filter((n) => !existingUnitTypeNames.has(n)).length,
        existingUnitTypes: [...csvUnitNames].filter((n) => existingUnitTypeNames.has(n)).length,
        cropFindingPairs: csvCropFindingPairs.size,
        parsableRecommendations: parsableDosages,
        unparsableDosages,
        registryRows: filteredRows.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
