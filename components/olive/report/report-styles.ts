/**
 * The plot report's stylesheet, as a string.
 *
 * WHY A TS CONSTANT AND NOT A .css FILE
 * Two renderers consume this. The page imports it into a <style> tag; the PDF
 * route hands it to Chromium inside a standalone HTML document that Next never
 * builds (see lib/olive/report/render-pdf.tsx). A .css file would reach the first
 * and not the second, and the two outputs would drift the first time anyone
 * edited one. A string is the only form both paths read identically.
 *
 * WHY NOT olive.css
 * That sheet styles the app shell: screen widths, hover states, sticky footers.
 * This is a paged A4 document. They share a palette and nothing else, and
 * olive.css deliberately softened two of those colours for screen use — its
 * `--line` equivalent is much lighter and its cream is near-white, both of which
 * wash out on paper. Ported verbatim from the client prototype's `.rpt-*` rules
 * (docs/code.html:549-611) so the printed page matches what the client signed
 * off on.
 *
 * The palette is scoped to `.rpt-page` under an `--rpt-` prefix rather than
 * living on :root, so it cannot collide with the app's own custom properties.
 */

export const REPORT_CSS = `
.rpt-page{
  --rpt-cream:#E8CD7A;
  --rpt-cream-deep:#DCBD5C;
  --rpt-ink:#2B2620;
  --rpt-ink-soft:#7A5F1E;
  --rpt-charcoal:#211E1B;
  --rpt-charcoal-soft:#38332C;
  --rpt-gold:#C9982E;
  --rpt-gold-deep:#A87A1E;
  --rpt-sage:#6E8154;
  --rpt-sage-deep:#47542F;
  --rpt-terracotta:#BD5A3F;
  --rpt-line:#B8912C;

  width:794px; max-width:100%; min-height:1123px; margin:0 auto; background:#fff;
  box-shadow:0 2px 8px rgba(33,30,27,.06), 0 12px 32px rgba(33,30,27,.08);
  position:relative; overflow:hidden; color:var(--rpt-ink);
  font-family:var(--font-assistant,'Assistant'),sans-serif; border-radius:6px;
}

/* --- surrounding chrome (screen only) --- */
.rpt-shell{ background:#EDE7D6; min-height:100vh; padding:20px 12px 60px; }
.rpt-toolbar{
  width:794px; max-width:100%; margin:0 auto 12px; display:flex; justify-content:space-between; gap:8px;
}
.rpt-toolbar-actions{ display:flex; gap:8px; }
.rpt-toolbar button{
  border:none; border-radius:999px; padding:9px 18px;
  font-family:var(--font-heebo,'Heebo'),sans-serif; font-weight:700; font-size:.85rem; cursor:pointer;
}
.rpt-btn-print{ background:var(--rpt-charcoal,#211E1B); color:#F5F1E6; }
.rpt-btn-pdf{ background:#A87A1E; color:#FBF7EC; }
.rpt-btn-close{ background:#fff; color:#2B2620; border:1px solid #B8912C !important; }

/* --- header --- */
.rpt-header{
  background:linear-gradient(155deg, var(--rpt-charcoal) 0%, var(--rpt-charcoal-soft) 100%);
  color:#F5F1E6; padding:26px 40px 20px; display:flex; align-items:center; gap:16px; position:relative;
}
.rpt-header::after{
  content:""; position:absolute; inset:auto 0 0 0; height:3px;
  background:linear-gradient(90deg, var(--rpt-gold) 0%, #E4C877 50%, var(--rpt-gold) 100%); opacity:.85;
}
.rpt-logo{ width:52px; height:52px; border-radius:50%; flex:none; box-shadow:0 0 0 2px rgba(201,152,46,.3); }
.rpt-logo img{ width:100%; height:100%; border-radius:50%; object-fit:cover; display:block; }
.rpt-h-title{ flex:1; }
.rpt-h-title h1{
  font-family:var(--font-heebo,'Heebo'),sans-serif; font-weight:700; font-size:1.2rem;
  margin:0; color:#FBF7EC; letter-spacing:-.01em;
}
.rpt-h-title p{ margin:2px 0 0; font-size:.78rem; color:#B5AC96; font-weight:400; }
.rpt-h-meta{ text-align:left; font-size:.74rem; color:#B5AC96; line-height:1.7; }
.rpt-h-meta b{ color:#F5F1E6; font-weight:600; }

/* --- body --- */
.rpt-main{ padding:30px 42px 34px; }
.rpt-plot-title{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px; flex-wrap:wrap; gap:10px; }
.rpt-plot-title h2{
  font-family:var(--font-heebo,'Heebo'),sans-serif; font-weight:700; font-size:1.3rem;
  color:var(--rpt-charcoal); margin:0; letter-spacing:-.01em;
}
.rpt-variety-line{
  font-family:var(--font-heebo,'Heebo'),sans-serif; font-weight:700; font-size:.95rem;
  color:var(--rpt-charcoal-soft); margin-top:2px;
}
.rpt-status-badge{
  display:inline-flex; align-items:center; gap:7px; padding:5px 14px; border-radius:999px;
  font-family:var(--font-heebo,'Heebo'),sans-serif; font-weight:600; font-size:.82rem; white-space:nowrap;
  background:var(--rpt-cream-deep); border:1px solid var(--rpt-line); color:var(--rpt-ink-soft);
}
.rpt-status-badge::before{ content:""; width:7px; height:7px; border-radius:50%; background:currentColor; flex:none; }
.rpt-status-badge.plan{ color:var(--rpt-gold-deep); }
.rpt-status-badge.urgent{ color:var(--rpt-terracotta); }
.rpt-status-badge.ok{ color:var(--rpt-sage-deep); }
.rpt-subline{ color:var(--rpt-ink-soft); font-size:.82rem; margin-bottom:26px; }
.rpt-tags{ display:flex; flex-wrap:wrap; gap:7px; margin-bottom:28px; }
.rpt-tag{
  background:transparent; border:1px solid var(--rpt-line); border-radius:8px; padding:5px 12px;
  font-size:.78rem; color:var(--rpt-ink-soft); font-weight:500;
}
.rpt-tag b{ color:var(--rpt-ink); font-weight:600; }

.rpt-section{ margin-bottom:26px; }
.rpt-section h3{
  font-family:var(--font-heebo,'Heebo'),sans-serif; font-weight:600; font-size:.78rem;
  color:var(--rpt-ink-soft); margin:0 0 12px; text-transform:uppercase; letter-spacing:.06em;
  padding-bottom:8px; border-bottom:1px solid var(--rpt-line);
}

/* --- KPI tiles --- */
.rpt-kpi-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
.rpt-kpi-grid.cols-3{ grid-template-columns:repeat(3,1fr); }
.rpt-kpi-grid.cols-5{ grid-template-columns:repeat(5,1fr); }
.rpt-kpi{
  background:var(--rpt-cream); border:1px solid var(--rpt-line); border-inline-start:2px solid var(--rpt-line);
  border-radius:10px; padding:13px 12px; text-align:center;
}
.rpt-val{ font-family:var(--font-heebo,'Heebo'),sans-serif; font-weight:700; font-size:1.2rem; color:var(--rpt-charcoal); }
.rpt-val small{ font-size:.62rem; font-weight:500; color:var(--rpt-ink-soft); }
.rpt-lbl{ font-size:.7rem; color:var(--rpt-ink-soft); margin-top:3px; }
.rpt-kpi.flag-urgent{ border-inline-start-color:var(--rpt-terracotta); }
.rpt-kpi.flag-urgent .rpt-val{ color:var(--rpt-terracotta); }
.rpt-kpi.flag-plan{ border-inline-start-color:var(--rpt-gold); }
.rpt-kpi.flag-plan .rpt-val{ color:var(--rpt-gold-deep); }
.rpt-kpi.flag-ok{ border-inline-start-color:var(--rpt-sage); }
.rpt-kpi.flag-ok .rpt-val{ color:var(--rpt-sage-deep); }

/* Secondary measurements, the ones with no threshold band of their own. */
.rpt-subvals{ display:flex; flex-wrap:wrap; gap:6px 18px; margin-top:12px; font-size:.78rem; color:var(--rpt-ink-soft); }
.rpt-subvals b{ color:var(--rpt-ink); font-weight:600; }

/* --- recommendation --- */
.rpt-rec-box{
  background:var(--rpt-cream); border:1px solid var(--rpt-line); border-inline-start:3px solid var(--rpt-gold);
  border-radius:10px; padding:16px 18px;
}
.rpt-rec-head{
  display:flex; align-items:center; gap:7px; font-family:var(--font-heebo,'Heebo'),sans-serif;
  font-weight:600; color:var(--rpt-gold-deep); font-size:.8rem; margin-bottom:6px;
  text-transform:uppercase; letter-spacing:.05em;
}
.rpt-rec-box p{ margin:4px 0; font-size:.88rem; line-height:1.65; color:var(--rpt-ink); }

/* --- tables --- */
.rpt-table{ width:100%; border-collapse:collapse; font-size:.82rem; }
.rpt-table th,.rpt-table td{ padding:9px 10px; border-bottom:1px solid var(--rpt-line); text-align:right; }
.rpt-table th{ color:var(--rpt-ink-soft); font-weight:600; font-size:.72rem; text-transform:uppercase; letter-spacing:.03em; }
/* The full-measurement history runs to twelve columns; it needs the room. */
.rpt-table.wide{ font-size:.7rem; }
.rpt-table.wide th,.rpt-table.wide td{ padding:6px 4px; white-space:nowrap; }
.rpt-table .num{ font-variant-numeric:tabular-nums; }
.rpt-empty-cell{ text-align:center; color:var(--rpt-ink-soft); }

/* --- weather --- */
.rpt-weather-line{ display:flex; align-items:center; gap:8px; font-size:.85rem; padding:7px 0; color:var(--rpt-ink-soft); }
.rpt-icon{ font-size:1rem; }
.rpt-weather-line.warn{ color:var(--rpt-terracotta); font-weight:600; }

/* --- chart --- */
.rpt-chart-panel{ margin-bottom:10px; }
.rpt-chart-title{
  display:flex; align-items:center; gap:6px;
  font-size:.72rem; color:var(--rpt-ink-soft); margin:0 0 2px; font-weight:600;
}
.rpt-chart-swatch{ display:inline-block; width:9px; height:9px; border-radius:50%; flex:none; }
.rpt-note{ font-size:.8rem; color:var(--rpt-ink-soft); margin:0; }

/* --- footer --- */
.rpt-footer{
  padding:16px 42px; border-top:1px solid var(--rpt-line); display:flex;
  justify-content:space-between; align-items:center; font-size:.68rem; color:var(--rpt-ink-soft);
}
.rpt-tagline{
  font-family:var(--font-frank-ruhl,'Frank Ruhl Libre'),serif; font-style:italic;
  color:var(--rpt-gold-deep); font-size:.85rem;
}

/*
 * Print. The prototype hid everything but its overlay
 * (\`body > *:not(.report-overlay){display:none}\`); this page has no overlay and
 * no app chrome around it, so it only has to drop the toolbar and let the page
 * surface fill the sheet.
 */
@page{ size:A4; margin:0; }

@media print{
  .rpt-shell{ background:#fff; padding:0; min-height:auto; }
  .rpt-toolbar{ display:none !important; }
  .rpt-page{ box-shadow:none; width:auto; max-width:none; min-height:auto; border-radius:0; }
  .rpt-section{ break-inside:avoid; }
  .rpt-table{ break-inside:auto; }
  .rpt-table tr{ break-inside:avoid; }
  .rpt-header{ break-after:avoid; }
}
`;
