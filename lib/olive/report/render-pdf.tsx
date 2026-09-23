/**
 * HTML → PDF, via headless Chromium.
 *
 * The one host-specific file in the report. Everything else runs the same
 * wherever the app is deployed; this has to know where a browser binary lives.
 *
 * WHY setContent AND NOT page.goto(reportUrl)
 * Navigating a headless browser to the report page would mean giving it a
 * session — forwarding the caller's cookies into a browser process, or minting a
 * token for it. Both are real attack surface for something that only needs to
 * lay out HTML we already have in memory. The route renders the same React tree
 * with renderToStaticMarkup and hands over the string, so there is no second
 * request, no auth to smuggle, and no way for the PDF to disagree with the page.
 *
 * WHY puppeteer-core + @sparticuz/chromium
 * puppeteer-core ships no browser, so the install stays small and the binary is
 * chosen at run time: @sparticuz/chromium on a serverless host (where a normal
 * Chromium exceeds the bundle limit), or a locally installed Chrome in
 * development. Set PUPPETEER_EXECUTABLE_PATH to pin one explicitly.
 */

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

import { PlotReportDocument } from '@/components/olive/report/PlotReportDocument';
import type { PlotReportData } from '@/lib/olive/report/fetch-plot-report';

/** How long to wait for webfonts before printing in the fallback instead. */
const FONT_TIMEOUT_MS = 5000;

/**
 * Desktop Chrome locations, for development.
 *
 * These are tried BEFORE @sparticuz/chromium on anything that is not Linux.
 * That package ships a Linux x64 build for serverless hosts; asking it for an
 * executable on macOS hands back a path that exists and then dies on spawn with
 * "Unknown system error -8", because the binary is for the wrong platform. The
 * path has to be chosen by platform, not by whether a file happens to be there.
 */
const LOCAL_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

async function findLocalChrome(): Promise<string | null> {
  const { existsSync } = await import('node:fs');
  return LOCAL_CHROME_PATHS.find((path) => existsSync(path)) ?? null;
}

async function resolveExecutablePath(): Promise<string> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;

  // Off Linux, the bundled build cannot run at all — go straight to a real one.
  if (process.platform !== 'linux') {
    const local = await findLocalChrome();
    if (local) return local;
  }

  const bundled = await chromium.executablePath();
  if (bundled) return bundled;

  const local = await findLocalChrome();
  if (local) return local;

  throw new Error(
    'לא נמצא דפדפן להפקת PDF. Set PUPPETEER_EXECUTABLE_PATH to a Chrome/Chromium binary.'
  );
}

/**
 * Wrap a rendered body in a standalone document.
 *
 * The fonts come from a Google Fonts <link> rather than next/font: next/font
 * rewrites CSS at build time for pages Next serves, and this document is not one
 * — Chromium fetches it as-is. The document.fonts.ready wait below is what gives
 * that request time to land. With no network the document still renders, in the
 * system Hebrew fallback.
 *
 * Frank Ruhl Libre is requested at wght@400 and slanted by the browser. It has
 * no italic face, so asking for `ital@1` makes the whole request 400 and drops
 * every family in it. The tagline is the only italic on the page.
 */
function wrapDocument(body: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700;800&family=Assistant:wght@400;600&family=Frank+Ruhl+Libre:wght@400&display=swap" rel="stylesheet">
<style>
  html,body{ margin:0; padding:0; background:#fff; }
</style>
</head>
<body>${body}</body>
</html>`;
}

/**
 * The report as an A4 PDF.
 *
 * WHY react-dom/server IS IMPORTED AT RUN TIME
 * Next refuses a static `import ... from 'react-dom/server'` anywhere in the app
 * router's module graph — it assumes you are about to nest an SSR pass inside a
 * Server Component, which would be both slow and unsafe. That is not what
 * happens here: this is a leaf that renders a self-contained document to a
 * string for a browser that is not Next's. Deferring the import to call time
 * keeps it out of that graph, and the cost is one lazy require per PDF.
 */
export async function renderPlotReportPdf(
  data: PlotReportData,
  logoSrc: string
): Promise<Uint8Array> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const body = renderToStaticMarkup(<PlotReportDocument data={data} logoSrc={logoSrc} />);

  const browser = await puppeteer.launch({
    // chromium.args belongs to the Lambda build and carries flags such as
    // --single-process that make a desktop Chrome crash on launch. Pair the
    // args with the binary, not with the package.
    args:
      process.platform === 'linux' ? chromium.args : ['--no-sandbox', '--disable-dev-shm-usage'],
    executablePath: await resolveExecutablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(wrapDocument(body), { waitUntil: 'load' });

    // setContent resolves on `load`, which fires before a webfont has been
    // applied — print too early and the Hebrew comes out in the fallback with
    // different metrics. document.fonts.ready is the actual signal. Bounded,
    // because with no network it never settles and a PDF in the fallback font
    // beats no PDF at all.
    await Promise.race([
      page.evaluate(() => document.fonts.ready.then(() => undefined)),
      new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS)),
    ]);

    return await page.pdf({
      format: 'A4',
      // The report is colour-coded — flag bars, status badge, the gold header
      // rule. Without this Chromium drops every background and the urgency
      // signalling goes with it.
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
}
