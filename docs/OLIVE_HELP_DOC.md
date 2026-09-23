# The olive help document

`public/docs/olive-features.html` is the user-facing guide to the olive module —
one screen per section, each with a screenshot and a description of what it does.
It is reached from **עזרה ומדריך**, the last item in the olive nav group
(`OLIVE_HELP_HREF` in `lib/navigation.ts`).

## Why it is a single 4.5 MB file

Every screenshot is inlined as a `data:` URI rather than sitting beside the page
as a `.png`. That is not a size optimisation — it is the access control.

The middleware matcher excludes image extensions from the session check:

```
'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
```

So a screenshot served from `public/` would be readable by anyone who knows the
URL, with no login. These screenshots are of **live tenant data** — grower names,
plot names, NIR readings. `.html` is *not* in that exclusion list, so the document
itself goes through `updateSession` and redirects to `/login` like every screen.
Inlining the images means there is no second URL to leak.

Verify both halves after any change to the matcher:

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' \
  http://localhost:3000/docs/olive-features.html   # want: 307 -> /login
```

The same single file is what the **הורד עותק** button downloads, which is why it
has to stand alone anyway.

## Regenerating it

The document is generated, not hand-edited — editing the HTML in `public/`
directly will be overwritten next time. The pipeline is manual because the
screenshots come from a seeded tenant:

1. Run the app against a database with representative olive data. The current
   document was built from the **גשור** tenant: 51 חלקות, 3 מגדלים, 889 דונם,
   43 בדיקות NIR, עונת מסיק 2026.
2. Drive each screen with Playwright and capture it — the eight `/olive/*`
   screens, their drawers and filter panels, and both print reports under
   `/olive/report/*`. Viewport-height shots read better than full-page ones for
   the long tables.
3. Downscale to 1500px and convert to JPEG (~q88); PNG at this count is roughly
   double the bytes for no visible gain on UI screenshots.
4. Inline each image as a `data:` URI into the page source and wrap it in a full
   HTML document with the print/download toolbar.

Keep the copy grounded in what is actually on screen — the document's value is
that it describes the real UI, including its empty states, rather than an
idealised one.

## Print

`@media print` drops the toolbar and the section index and collapses the layout
to one column, so **הדפס / שמור כ-PDF** produces a sane PDF. This matches how the
olive reports already print (`components/olive/report/report-styles.ts`).
