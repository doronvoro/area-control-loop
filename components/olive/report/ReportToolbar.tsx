'use client';

/**
 * The report's on-screen controls. The only client component in the report —
 * everything below it renders on the server so the PDF path can reuse it.
 *
 * Hidden in print by `.rpt-toolbar { display: none }` in report-styles.ts.
 */

export function ReportToolbar({ areaId }: { areaId: string }) {
  return (
    <div className="rpt-toolbar">
      <div className="rpt-toolbar-actions">
        <button type="button" className="rpt-btn-print" onClick={() => window.print()}>
          הדפס / שמור כ-PDF
        </button>
        <a
          className="rpt-btn-pdf"
          href={`/api/olive/report/plot/${areaId}/pdf`}
          style={{
            borderRadius: 999,
            padding: '9px 18px',
            fontWeight: 700,
            fontSize: '.85rem',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          הורד PDF
        </a>
      </div>
      <button type="button" className="rpt-btn-close" onClick={() => window.close()}>
        סגור
      </button>
    </div>
  );
}
