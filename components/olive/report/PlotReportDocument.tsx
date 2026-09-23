/**
 * The printable plot status report (דוח סטטוס חלקה).
 *
 * A port of the client prototype's buildReportHTML (docs/code.html:5926) — the
 * layout, section order and wording the client already uses and signed off on.
 *
 * MUST STAY PURE. No hooks, no 'use client', no context. The PDF endpoint runs
 * this through renderToStaticMarkup with no React runtime and no provider tree
 * above it, so anything stateful breaks that path silently — the page would keep
 * working and only the PDF would come out wrong.
 *
 * It carries its own <style> so the page and the PDF are styled by one source;
 * see components/olive/report/report-styles.ts for why that is a string.
 *
 * Deviation from the prototype, deliberate: it prints every measurement taken,
 * not just oil/water/dry. Acidity gets a tile, and green, maturity, irrigation,
 * direction, takt and the inspector all appear. The readings exist; a report
 * that drops them makes the grower ask for them by mail.
 */

import { NirTrendChart } from './NirTrendChart';
import { ReportStyles } from './ReportStyles';
import type { PlotReportData } from '@/lib/olive/report/fetch-plot-report';

function num(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const fixed = value.toFixed(digits);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
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

export function PlotReportDocument({ data, logoSrc }: PlotReportDocumentProps) {
  const {
    generatedAt,
    seasonLabel,
    plotName,
    growerName,
    variety,
    region,
    plantYear,
    maturityLabel,
    sizeDunam,
    tags,
    status,
    recommendation,
    weatherLines,
    latest,
    latestDateLabel,
    kpis,
    subValues,
    history,
    harvest,
  } = data;

  // Oldest-first is what the chart wants; the table reads better newest-first.
  const historyDesc = [...history].reverse();

  return (
    <>
      <ReportStyles />

      <div className="rpt-page">
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
            <div>
              נכון לתאריך: <b>{generatedAt}</b>
            </div>
            {seasonLabel && (
              <div>
                עונת מסיק: <b>{seasonLabel}</b>
              </div>
            )}
          </div>
        </header>

        <main className="rpt-main">
          <div className="rpt-plot-title">
            <div>
              <h2>{text(growerName)}</h2>
              {variety && <div className="rpt-variety-line">{variety}</div>}
            </div>
            <span className={`rpt-status-badge ${status.level}`}>{status.headline}</span>
          </div>

          <div className="rpt-subline">
            {plotName ? `כינוי: ${plotName} · ` : ''}
            {region ? `גוש ${region} · ` : ''}
            {`נטוע ${text(plantYear)} (${maturityLabel}) · ${num(sizeDunam)} דונם`}
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
              {kpis.map((kpi) => (
                <div className={`rpt-kpi ${kpi.flagClass}`} key={kpi.label}>
                  <div className="rpt-val">
                    {kpi.value}
                    {kpi.unit && <small>{kpi.unit}</small>}
                  </div>
                  <div className="rpt-lbl">{kpi.label}</div>
                </div>
              ))}
            </div>
            {subValues.length > 0 && (
              <div className="rpt-subvals">
                {subValues.map((item) => (
                  <span key={item.label}>
                    {item.label}: <b>{item.value}</b>
                  </span>
                ))}
              </div>
            )}
            {latest?.notes && <p className="rpt-subvals">הערות: {latest.notes}</p>}
          </section>

          <section className="rpt-section">
            <h3>תחזית מזג אוויר — ימים קרובים</h3>
            {weatherLines.length > 0 ? (
              weatherLines.map((line) => (
                <div className="rpt-weather-line warn" key={line}>
                  <span className="rpt-icon">⚠</span> {line}
                </div>
              ))
            ) : (
              <div className="rpt-weather-line">
                <span className="rpt-icon">✓</span> אין התראות מזג אוויר צפויות
              </div>
            )}
          </section>

          {harvest && (
            <section className="rpt-section">
              <h3>יבול בפועל</h3>
              <div className="rpt-kpi-grid cols-5">
                <div className="rpt-kpi">
                  <div className="rpt-val">
                    {num(harvest.fruitKg, 0)}
                    <small>ק&quot;ג</small>
                  </div>
                  <div className="rpt-lbl">סה&quot;כ פרי</div>
                </div>
                <div className="rpt-kpi">
                  <div className="rpt-val">
                    {num(harvest.oilKg, 0)}
                    <small>ק&quot;ג</small>
                  </div>
                  <div className="rpt-lbl">סה&quot;כ שמן</div>
                </div>
                <div className="rpt-kpi">
                  <div className="rpt-val">{num(harvest.fruitPerDunam)}</div>
                  <div className="rpt-lbl">פרי לדונם</div>
                </div>
                <div className="rpt-kpi">
                  <div className="rpt-val">{num(harvest.oilPerDunam)}</div>
                  <div className="rpt-lbl">שמן לדונם</div>
                </div>
                <div className="rpt-kpi">
                  <div className="rpt-val">
                    {num(harvest.oilPercent)}
                    {harvest.oilPercent !== null && <small>%</small>}
                  </div>
                  <div className="rpt-lbl">אחוז שמן מפרי</div>
                </div>
              </div>
              <div className="rpt-subvals">
                <span>
                  מספר מסיקים: <b>{harvest.passes}</b>
                </span>
                <span>
                  דונם שנמסקו: <b>{num(harvest.areaDoneDunam)}</b>
                </span>
              </div>
            </section>
          )}

          <section className="rpt-section">
            <div className="rpt-rec-box">
              <div className="rpt-rec-head">המלצה</div>
              <p>{recommendation}</p>
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
            <h3>היסטוריית בדיקות</h3>
            <table className="rpt-table wide">
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>טאקט</th>
                  <th>כיוון</th>
                  <th>שמן%</th>
                  <th>מים%</th>
                  <th>שמן בחו&quot;י%</th>
                  <th>ירוק%</th>
                  <th>חומציות</th>
                  <th>הבשלה</th>
                  <th>השקיה</th>
                  <th>נבדק ע&quot;י</th>
                  <th>הערות</th>
                </tr>
              </thead>
              <tbody>
                {historyDesc.length > 0 ? (
                  historyDesc.map((row) => (
                    <tr key={row.id}>
                      <td>{text(row.reportDate)}</td>
                      <td>{text(row.subAreaName)}</td>
                      <td>{text(row.direction)}</td>
                      <td className="num">{num(row.oil)}</td>
                      <td className="num">{num(row.water)}</td>
                      <td className="num">{num(row.dry, 2)}</td>
                      <td className="num">{num(row.green)}</td>
                      <td className="num">{num(row.acid, 2)}</td>
                      <td className="num">{num(row.maturity, 2)}</td>
                      <td className="num">{num(row.irrigAmount)}</td>
                      <td>{text(row.workerName)}</td>
                      <td>{text(row.notes)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="rpt-empty-cell" colSpan={12}>
                      אין בדיקות עדיין
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </main>

        <footer className="rpt-footer">
          <span className="rpt-tagline">כל זן והטבע שלו</span>
          <span>הופק אוטומטית מדשבורד מסיק — ארץ גשור</span>
        </footer>
      </div>
    </>
  );
}
