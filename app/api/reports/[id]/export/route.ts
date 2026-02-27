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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const supabase = await createClient();

    const report = await fetchReportDetail(supabase, id);

    if (!report) {
      return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 });
    }

    const isMonitoring = report.area_type_id === 'monitoring';
    const entries = isMonitoring
      ? report.monitoringEntries || []
      : report.actionEntries || [];

    // Build workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Area Control Loop';
    workbook.created = new Date();

    const sheetName = `דוח ${report.report_number}`;
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 3 }],
    });

    // Define columns
    const columns: Partial<ExcelJS.Column>[] = [
      { key: 'sub_area', width: 20 },
      { key: 'finding', width: 25 },
      { key: 'finding_desc', width: 30 },
      { key: 'severity', width: 12 },
      { key: 'action_type', width: 18 },
      { key: 'material', width: 18 },
      { key: 'dosage', width: 10 },
      { key: 'unit_type', width: 12 },
      { key: 'treatment_status', width: 14 },
      { key: 'notes', width: 30 },
    ];

    if (!isMonitoring) {
      columns.push({ key: 'action_time', width: 18 });
    }

    worksheet.columns = columns;

    // Row 1: Report title (merged)
    const totalCols = columns.length;
    const typeName = report.area_type?.display_name || (isMonitoring ? 'ניטור' : 'פעולה');
    const titleRow = worksheet.addRow([`דוח מס׳ ${report.report_number} - ${typeName}`]);
    worksheet.mergeCells(1, 1, 1, totalCols);
    titleRow.getCell(1).font = { name: 'Arial', bold: true, size: 14 };
    titleRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' };

    // Row 2: Report metadata (merged)
    const dateStr = new Date(report.created_at).toLocaleDateString('he-IL');
    const timeStr = new Date(report.created_at).toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const statusHebrew = STATUS_LABELS[report.status] || report.status;
    const metaText = `שטח: ${report.area?.name || '-'}  |  עובד: ${report.worker?.name || '-'}  |  תאריך: ${dateStr} ${timeStr}  |  סטטוס: ${statusHebrew}`;
    const metaRow = worksheet.addRow([metaText]);
    worksheet.mergeCells(2, 1, 2, totalCols);
    metaRow.getCell(1).font = { name: 'Arial', size: 11 };
    metaRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle', readingOrder: 'rtl' };

    // Row 3: Column headers
    const headerLabels = [
      'תת-שטח',
      'ממצא',
      'תיאור ממצא',
      'חומרה',
      'סוג פעולה',
      'חומר',
      'מינון',
      'יחידה',
      'סטטוס טיפול',
      'הערות',
    ];
    if (!isMonitoring) {
      headerLabels.push('זמן ביצוע');
    }

    const headerRow = worksheet.addRow(headerLabels);
    headerRow.eachCell((cell) => {
      cell.font = HEADER_FONT;
      cell.fill = HEADER_FILL;
      cell.alignment = RTL_ALIGNMENT;
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });

    // Data rows
    for (const entry of entries) {
      const subAreaName = entry.sub_area?.display || entry.sub_area?.name || '-';
      const findingName = entry.finding?.name || '-';
      const findingDesc = entry.finding?.description || '';
      const severity = entry.severity
        ? SEVERITY_LABELS[entry.severity as ReportSeverity] || entry.severity
        : '-';

      const treatments = entry.treatments || [];

      if (treatments.length === 0) {
        // Entry with no treatments: one row with empty treatment columns
        const rowData = [
          subAreaName,
          findingName,
          findingDesc,
          severity,
          '-', '-', '', '-', '-', '',
        ];
        if (!isMonitoring) rowData.push('');
        const row = worksheet.addRow(rowData);
        applyDataRowStyle(row, entry.severity, totalCols);
      } else {
        for (const treatment of treatments) {
          const rowData = [
            subAreaName,
            findingName,
            findingDesc,
            severity,
            treatment.action_type?.name || '-',
            treatment.material?.name || '-',
            treatment.dosage != null ? treatment.dosage : '',
            treatment.unit_type?.name || '-',
            TREATMENT_STATUS_LABELS[treatment.status] || treatment.status,
            treatment.notes || '',
          ];
          if (!isMonitoring) {
            rowData.push(
              treatment.action_time
                ? new Date(treatment.action_time).toLocaleString('he-IL')
                : ''
            );
          }
          const row = worksheet.addRow(rowData);
          applyDataRowStyle(row, entry.severity, totalCols);
        }
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    const exportDate = new Date().toISOString().split('T')[0];
    const filename = `report-${report.report_number}-${exportDate}.xlsx`;

    return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function applyDataRowStyle(
  row: ExcelJS.Row,
  severity: string | null | undefined,
  totalCols: number
) {
  for (let col = 1; col <= totalCols; col++) {
    const cell = row.getCell(col);
    cell.font = DATA_FONT;
    cell.alignment = RTL_ALIGNMENT;
  }

  // Apply severity color to the severity cell (column 4)
  if (severity && SEVERITY_FILLS[severity]) {
    row.getCell(4).fill = SEVERITY_FILLS[severity];
  }
}
