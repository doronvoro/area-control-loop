import { REPORT_CSS } from './report-styles';

/**
 * The report stylesheet, emitted exactly once per document.
 *
 * Both report documents need REPORT_CSS inline — the PDF route hands Chromium a
 * standalone string that Next never builds, so a linked .css file would reach
 * the page and not the PDF (see report-styles.ts).
 *
 * It lives in its own component rather than inline in each document to make the
 * "once" explicit. Rendering a document that carries its own <style> N times in
 * one page — the obvious way to build a multi-plot report — emits the whole
 * sheet N times, which a reviewer would not notice and a 50-plot PDF would.
 */
export function ReportStyles() {
  return <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />;
}
