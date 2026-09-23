/**
 * The grower's season report (דוח עונתי — מגדל).
 *
 * A summary, not fifty per-plot reports stapled together. One grower can hold
 * twenty plots; the full per-plot section repeated that many times is a document
 * nobody opens and a PDF Chromium spends a minute laying out. So: the estate in
 * one table, ordered so the plots that need picking are the first thing read.
 *
 * Pure and hook-free — it renders under renderToStaticMarkup for the PDF, same
 * as PlotReportDocument.
 */

import { Fragment } from 'react';

import { ReportStyles } from './ReportStyles';
import type { GrowerReportData } from '@/lib/olive/report/fetch-grower-report';

function num(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const fixed = value.toFixed(digits);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

function text(value: string | null | undefined): string {
  return value === null || value === undefined || value === '' ? '—' : value;
}

export interface GrowerReportDocumentProps {
  data: GrowerReportData;
  logoSrc: string;
}

export function GrowerReportDocument({ data, logoSrc }: GrowerReportDocumentProps) {
  const {
    generatedAt,
    seasonLabel,
    growerName,
    growerTypeLabel,
    customerName,
    contactLines,
    plotCount,
    totalDunam,
    categories,
    weatherLines,
    glance,
    groups,
    harvest,
    truncated,
  } = data;

  return (
    <>
      <ReportStyles />

      <div className="rpt-page">
        <header className="rpt-header">
          <div className="rpt-logo">
            {/* eslint-disable-next-line @next/next/no-img-element -- also renders
                under renderToStaticMarkup, where next/image does not run. */}
            <img src={logoSrc} alt="ארץ גשור" />
          </div>
          <div className="rpt-h-title">
            <h1>מסיק — ארץ גשור</h1>
            <p>דוח עונתי — מגדל</p>
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
              {customerName && <div className="rpt-variety-line">{customerName}</div>}
            </div>
            {growerTypeLabel && <span className="rpt-status-badge ok">{growerTypeLabel}</span>}
          </div>

          <div className="rpt-subline">
            {`${plotCount} חלקות · ${num(totalDunam)} דונם`}
            {contactLines.length > 0 ? ` · ${contactLines.join(' · ')}` : ''}
          </div>

          <section className="rpt-section">
            <h3>סטטוס חלקות</h3>
            <div className="rpt-kpi-grid">
              {categories.map((category) => (
                <div className="rpt-kpi" key={category.key}>
                  <div className="rpt-val">{category.count}</div>
                  <div className="rpt-lbl">{category.label}</div>
                </div>
              ))}
            </div>
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

          {glance.length > 0 && (
            <section className="rpt-section">
              <h3>מבט על — הכי דחוף עכשיו</h3>
              {glance.map((reason) => (
                <div className={`rpt-glance level-${reason.level}`} key={reason.headline}>
                  <span className="rpt-glance-headline">
                    <span className={`rpt-dot dot-${reason.level}`} />
                    {reason.headline} · {reason.names.length}
                  </span>
                  <span className="rpt-glance-names">{reason.names.join(' · ')}</span>
                </div>
              ))}
            </section>
          )}

          {/*
            Not .rpt-section: that class carries break-inside:avoid, and a table
            longer than a page under it is broken by the UA wherever it likes.
            This one is allowed to paginate, with its header repeating.
          */}
          <section className="rpt-section-flow">
            <h3>חלקות המגדל</h3>
            <table className="rpt-table wide">
              <thead>
                <tr>
                  <th>חלקה</th>
                  <th>זן</th>
                  <th>גוש</th>
                  <th>דונם</th>
                  <th>בדיקה אחרונה</th>
                  <th>שמן%</th>
                  <th>מים%</th>
                  <th>שמן בחו&quot;י%</th>
                  <th>חומציות</th>
                </tr>
              </thead>
              <tbody>
                {groups.length > 0 ? (
                  groups.map((group) => (
                    <Fragment key={group.level}>
                      <tr className="rpt-group-head">
                        <td colSpan={9}>
                          <span className={`rpt-dot dot-${group.level}`} />
                          {group.title} · {group.entries.length}
                        </td>
                      </tr>
                      {group.entries.map((entry) => (
                        <tr key={entry.row.id}>
                          <td>{text(entry.row.name)}</td>
                          <td>{text(entry.row.variety)}</td>
                          <td>{text(entry.row.region)}</td>
                          <td className="num">{num(entry.row.size)}</td>
                          <td>{text(entry.row.lastMeasuredLabel)}</td>
                          <td className="num">{num(entry.row.oil)}</td>
                          <td className="num">{num(entry.row.water)}</td>
                          <td className="num">{num(entry.row.dry, 2)}</td>
                          <td className="num">{num(entry.acid, 2)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))
                ) : (
                  <tr>
                    <td className="rpt-empty-cell" colSpan={9}>
                      אין חלקות משויכות למגדל זה
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {truncated && (
              <p className="rpt-note">
                הוצג חלק מהבדיקות בלבד — מספר הבדיקות בעונה חרג מהמכסה. ההיסטוריה המלאה זמינה בדוח
                החלקה.
              </p>
            )}
          </section>

          {harvest && (
            <section className="rpt-section">
              <h3>יבול בפועל — סיכום עונה</h3>
              <div className="rpt-kpi-grid">
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
                  <div className="rpt-val">{num(harvest.areaDoneDunam)}</div>
                  <div className="rpt-lbl">דונם שנמסקו</div>
                </div>
                <div className="rpt-kpi">
                  <div className="rpt-val">{harvest.passes}</div>
                  <div className="rpt-lbl">מספר מסיקים</div>
                </div>
              </div>
            </section>
          )}
        </main>

        <footer className="rpt-footer">
          <span className="rpt-tagline">כל זן והטבע שלו</span>
          <span>הופק אוטומטית מדשבורד מסיק — ארץ גשור</span>
        </footer>
      </div>
    </>
  );
}
