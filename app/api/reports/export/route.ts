import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { fetchReportDetail } from '@/lib/reports/fetch-report-detail';
import { STATUS_LABELS, TREATMENT_STATUS_LABELS } from '@/lib/reports/labels';
import { SEVERITY_LABELS, ReportSeverity } from '@/types/database';
import ExcelJS from 'exceljs';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFEEEEEE' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: 'Arial',
  bold: true,
  size: 11,
};

const DATA_FONT: Partial<ExcelJS.Font> = {
  name: 'Arial',
  size: 10,
};

const RTL_ALIGNMENT: Partial<ExcelJS.Alignment> = {
  horizontal: 'right',
  vertical: 'middle',
  readingOrder: 'rtl',
};

const SEVERITY_FILLS: Record<string, ExcelJS.Fill> = {
  critical: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } },
  high: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } },
  medium: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } },
  low: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } },
};

const TOTAL_COLS = 13;

export async function GET() {
  try {
    await requireAuth();

    const supabase = await createClient();

    // Fetch all report IDs
    const { data: reportAreas, error } = await supabase
      .from('report_areas')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    if (!reportAreas || reportAreas.length === 0) {
      return NextResponse.json({ error: 'אין דוחות לייצוא' }, { status: 404 });
    }

    // Build workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Area Control Loop';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('דוחות', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });

    worksheet.columns = [
      { key: 'report_number', width: 12 },
      { key: 'report_type', width: 12 },
      { key: 'worker', width: 18 },
      { key: 'area', width: 20 },
      { key: 'sub_area', width: 20 },
      { key: 'finding', width: 25 },
      { key: 'severity', width: 12 },
      { key: 'action_type', width: 18 },
      { key: 'material', width: 18 },
      { key: 'dosage', width: 10 },
      { key: 'unit_type', width: 12 },
      { key: 'status', width: 14 },
      { key: 'notes', width: 30 },
    ];

    // Row 1: Column headers
    const headerRow = worksheet.addRow([
      'מס׳ דוח',
      'סוג דוח',
      'עובד',
      'שטח',
      'תת-שטח',
      'ממצא',
      'חומרה',
      'סוג פעולה',
      'חומר',
      'מינון',
      'יחידה',
      'סטטוס',
      'הערות',
    ]);
    headerRow.eachCell((cell) => {
      cell.font = HEADER_FONT;
      cell.fill = HEADER_FILL;
      cell.alignment = RTL_ALIGNMENT;
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });

    // Fetch full details for each report and flatten
    for (const { id } of reportAreas) {
      const report = await fetchReportDetail(supabase, id);
      if (!report) continue;

      const isMonitoring = report.area_type_id === 'monitoring';
      const entries = isMonitoring
        ? report.monitoringEntries || []
        : report.actionEntries || [];

      const reportNumber = report.report_number || '-';
      const reportType = report.area_type?.display_name || (isMonitoring ? 'ניטור' : 'פעולה');
      const workerName = report.worker?.name || '-';
      const areaName = report.area?.name || '-';

      // For action reports, fetch linked monitoring treatments as fallback
      let monitoringTreatmentMap: Map<string, any[]> | null = null;
      if (!isMonitoring && entries.length > 0) {
        const actionEntryIds = entries.map((e: any) => e.id);
        const { data: linkedMonitoring } = await (supabase
          .from('monitoring_area_report') as any)
          .select(
            `actions_area_report_id,
            treatments:monitoring_treatments(
              id, dosage, notes, status,
              material:materials(id, name),
              unit_type:unit_types(id, name),
              action_type:action_types(id, name)
            )`
          )
          .in('actions_area_report_id', actionEntryIds);

        if (linkedMonitoring) {
          monitoringTreatmentMap = new Map();
          for (const m of linkedMonitoring as any[]) {
            const key = m.actions_area_report_id as string;
            const existing = monitoringTreatmentMap.get(key) || [];
            existing.push(...((m as any).treatments || []));
            monitoringTreatmentMap.set(key, existing);
          }
        }
      }

      if (entries.length === 0) {
        const row = worksheet.addRow([
          reportNumber, reportType, workerName, areaName,
          '-', '-', '-', '-', '-', '', '-',
          STATUS_LABELS[report.status] || report.status,
          '',
        ]);
        applyDataRowStyle(row, null);
        continue;
      }

      for (const entry of entries) {
        const subAreaName = entry.sub_area?.display || entry.sub_area?.name || '-';
        const findingName = entry.finding?.name || '-';
        const severityLabel = entry.severity
          ? SEVERITY_LABELS[entry.severity as ReportSeverity] || entry.severity
          : '-';

        // Use action treatments if available, otherwise fall back to linked monitoring treatments
        let treatments = entry.treatments || [];
        if (treatments.length === 0 && monitoringTreatmentMap) {
          treatments = monitoringTreatmentMap.get(entry.id) || [];
        }

        if (treatments.length === 0) {
          const row = worksheet.addRow([
            reportNumber, reportType, workerName, areaName,
            subAreaName, findingName, severityLabel,
            '-', '-', '', '-',
            STATUS_LABELS[report.status] || report.status,
            '',
          ]);
          applyDataRowStyle(row, entry.severity);
        } else {
          for (const treatment of treatments) {
            const row = worksheet.addRow([
              reportNumber, reportType, workerName, areaName,
              subAreaName, findingName, severityLabel,
              treatment.action_type?.name || '-',
              treatment.material?.name || '-',
              treatment.dosage != null ? treatment.dosage : '',
              treatment.unit_type?.name || '-',
              TREATMENT_STATUS_LABELS[treatment.status] || treatment.status,
              treatment.notes || '',
            ]);
            applyDataRowStyle(row, entry.severity);
          }
        }
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const exportDate = new Date().toISOString().split('T')[0];

    return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reports-${exportDate}.xlsx"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function applyDataRowStyle(row: ExcelJS.Row, severity: string | null | undefined) {
  for (let col = 1; col <= TOTAL_COLS; col++) {
    const cell = row.getCell(col);
    cell.font = DATA_FONT;
    cell.alignment = RTL_ALIGNMENT;
  }

  // Apply severity color to the severity cell (column 7)
  if (severity && SEVERITY_FILLS[severity]) {
    row.getCell(7).fill = SEVERITY_FILLS[severity];
  }
}
