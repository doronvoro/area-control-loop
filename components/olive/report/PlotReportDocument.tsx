/**
 * The printable plot status report (דוח סטטוס חלקה).
 *
 * Laid out after the client's sample report of 2026-09-29, which trimmed the
 * prototype's buildReportHTML (docs/code.html:5926): three large tiles plus a
 * smaller acidity/green row, a per-measurement recommendations list, one shared
 * trend chart with a legend, a five-column history of the last checks, and the
 * company's details in the footer. What the sample gives up by that is listed
 * in docs/OLIVE_PLOT_REPORT_SAMPLE_ISSUES.md.
 *
 * MUST STAY PURE. No hooks, no 'use client', no context. The PDF endpoint runs
 * this through renderToStaticMarkup with no React runtime and no provider tree
 * above it, so anything stateful breaks that path silently — the page would keep
 * working and only the PDF would come out wrong.
 *
 * It carries its own <style> so the page and the PDF are styled by one source;
 * see components/olive/report/report-styles.ts for why that is a string. The
 * look specific to this report is scoped under .rpt-plot there.
 */

import { NirTrendChart } from './NirTrendChart';
import { ReportStyles } from './ReportStyles';
import { COMPANY } from '@/lib/olive/report/company';
import {
  HISTORY_TABLE_ROWS,
  type PlotReportData,
  type ReportKpi,
} from '@/lib/olive/report/fetch-plot-report';

function num(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  // Round, then drop trailing zeros: 12.0 → "12", 21.00 → "21", 18.90 → "18.9".
  return String(Number(value.toFixed(digits)));
}

function text(value: string | null | undefined): string {
  return value === null || value === undefined || value === '' ? '—' : value;
}

export interface PlotReportDocumentProps {
  data: PlotReportData;
  /**
   * `/olive/gashur-logo.png` from the page; a data: URI from the PDF route,
   * which hands Chromium a standalone document with no base URL to resolve
   * a relative path against.
   */
  logoSrc: string;
}

function KpiTile({ kpi }: { kpi: ReportKpi }) {
  return (
    <div className={`rpt-kpi ${kpi.flagClass}`}>
      <div className="rpt-lbl">{kpi.label}</div>
      <div className="rpt-val">
        {kpi.value}
        {kpi.unit && kpi.value !== '—' && <small>{kpi.unit}</small>}
      </div>
    </div>
  );
}

export function PlotReportDocument({ data, logoSrc }: PlotReportDocumentProps) {
  const {
    generatedAt,
    plotName,
    growerName,
    variety,
    region,
    plantYear,
    maturityLabel,
    sizeDunam,
    inspectorName,
    tags,
    status,
    recommendations,
    weatherLines,
    latestDateLabel,
    primaryKpis,
    secondaryKpis,
    history,
  } = data;

  // Oldest-first is what the chart wants; the table reads newest-first and
  // shows only the latest few.
  const recentDesc = [...history].reverse().slice(0, HISTORY_TABLE_ROWS);

  return (
    <>
      <ReportStyles />

      <div className="rpt-page rpt-plot">
        <header className="rpt-header">
          <div className="rpt-logo">
            {/* eslint-disable-next-line @next/next/no-img-element -- must also render
                under renderToStaticMarkup for the PDF, where next/image does not run. */}
            <img src={logoSrc} alt="ארץ גשור" />
          </div>
          <div className="rpt-h-title">
            <h1>מסיק — ארץ גשור</h1>
            <p>דוח סטטוס חלקה</p>
          </div>
          <div className="rpt-h-meta">
            {/* bdi keeps the date/time pair in its own direction, so the comma
                stays between them instead of jumping to the line's start. */}
            תאריך הפקת הדוח: <bdi>{generatedAt}</bdi>
          </div>
        </header>

        <main className="rpt-main">
          <div className="rpt-plot-title">
            <div>
              <h2>{text(growerName)}</h2>
              {variety && <div className="rpt-variety-line">{variety}</div>}
            </div>
            <div className="rpt-status-block">
              <span className="rpt-status-caption">סטטוס מסיק צפוי</span>
              <span className={`rpt-status-badge ${status.level}`}>{status.headline}</span>
            </div>
          </div>

          <div className="rpt-subline">
            {plotName ? `כינוי: ${plotName} · ` : ''}
            {region ? `גוש ${region} · ` : ''}
            {`${text(plantYear)} (${maturityLabel}) · ${num(sizeDunam)} דונם`}
          </div>
          <div className="rpt-inspector">
            {inspectorName ? `נבדק על ידי: ${inspectorName}` : ''}
          </div>

          {tags.length > 0 && (
            <div className="rpt-tags">
              {tags.map((tag) => (
                <span className="rpt-tag" key={tag.label}>
                  {tag.label}: <b>{tag.value}</b>
                </span>
              ))}
            </div>
          )}

          <section className="rpt-section">
            <h3>
              {latestDateLabel ? `בדיקת NIR אחרונה — ${latestDateLabel}` : 'בדיקת NIR אחרונה'}
            </h3>
            <div className="rpt-kpi-grid">
              {primaryKpis.map((kpi) => (
                <KpiTile kpi={kpi} key={kpi.label} />
              ))}
            </div>
            <div className="rpt-kpi-grid cols-2">
              {secondaryKpis.map((kpi) => (
                <KpiTile kpi={kpi} key={kpi.label} />
              ))}
            </div>
          </section>

          <section className="rpt-section">
            {weatherLines.map((line) => (
              <div className="rpt-weather-line warn" key={line}>
                <span className="rpt-icon">⚠</span> {line}
              </div>
            ))}
            <div className="rpt-rec-box">
              <div className="rpt-rec-head">המלצות</div>
              {recommendations.length > 0 ? (
                recommendations.map((line) => <p key={line}>{line}</p>)
              ) : (
                <p>אין המלצות מיוחדות.</p>
              )}
            </div>
          </section>

          <section className="rpt-section">
            <h3>מגמת בדיקות — שמן / מים / שמן בחומר יבש</h3>
            <NirTrendChart rows={history} />
            {history.length < 2 && (
              <p className="rpt-note">נדרשות לפחות 2 בדיקות NIR כדי להציג גרף מגמה.</p>
            )}
          </section>

          <section className="rpt-section">
            <h3>היסטוריית בדיקות אחרונות</h3>
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>שמן%</th>
                  <th>מים%</th>
                  <th>שמן בחו&quot;י%</th>
                  <th>אחוז צבע ירוק%</th>
                </tr>
              </thead>
              <tbody>
                {recentDesc.length > 0 ? (
                  recentDesc.map((row) => (
                    <tr key={row.id}>
                      <td>{text(row.reportDate)}</td>
                      <td className="num">{num(row.oil)}</td>
                      <td className="num">{num(row.water)}</td>
                      <td className="num">{num(row.dry, 2)}</td>
                      <td className="num">{num(row.green)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="rpt-empty-cell" colSpan={5}>
                      אין בדיקות עדיין
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </main>

        <footer className="rpt-company-footer">
          <b>{COMPANY.name}</b>
          {COMPANY.line}
        </footer>
      </div>
    </>
  );
}
