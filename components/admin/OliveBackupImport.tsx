'use client';

/**
 * Import an olive prototype backup for one tenant, replacing what is there.
 *
 * Two steps on purpose. The upload previews — what the wipe removes, what the
 * import writes, and every value the importer could not carry across — and only
 * a second, explicit confirmation writes anything. The flags are the point of
 * the preview: they are what you send back to the customer when their export is
 * wrong, which is the whole reason this cycle repeats.
 *
 * The customer is picked here rather than taken from the sidebar switcher.
 * Switching there calls window.location.assign(), a full document load that
 * would throw away the uploaded file and the preview — and a destructive action
 * should name its target next to the button, not rely on an ambient selection.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { showToast } from '@/lib/toast';
import { groupIssues, type ImportIssue } from '@/lib/olive/import-issues';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileUp,
  HelpCircle,
  Loader2,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';

type Stage = 'upload' | 'preview' | 'results';

interface WipeCounts {
  areas: number;
  subAreas: number;
  reportAreas: number;
  plotDetails: number;
  yieldEstimates: number;
}

interface ImportResponse {
  applied: boolean;
  customer: { id: string; name: string };
  exportedAt: string | null;
  source: { plots: number; nirTests: number; varietyWindows: number; yieldRows: number };
  wipe: WipeCounts;
  result: {
    season: { name: string; yearType: string | null; outcome: string };
    plots: { created: number; reused: number };
    takts: { created: number; reused: number; fromDefault: number };
    yield: {
      written: number;
      unchanged: number;
      conflicts: number;
      unmatched: number;
      unestimated: string[];
    } | null;
    nir: { created: number; skipped: number; taktLinked: number; dryMismatches: number };
    varietyWindows: number;
    weatherRows: number;
    categoryThresholds: boolean;
    issues: ImportIssue[];
  };
}

export function OliveBackupImport() {
  const [stage, setStage] = useState<Stage>('upload');
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [taktsPerPlot, setTaktsPerPlot] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [outcome, setOutcome] = useState<ImportResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetch('/api/customers')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => setCustomers([]));
  }, []);

  const send = useCallback(
    async (apply: boolean): Promise<ImportResponse> => {
      const formData = new FormData();
      formData.append('file', file as File);
      formData.append('customerId', customerId);
      formData.append('apply', String(apply));
      // Sent on both calls, and from the same state, so the apply cannot
      // create a different number of takts than the preview promised.
      formData.append('taktsPerPlot', taktsPerPlot.trim());

      const res = await fetch('/api/olive/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'הייבוא נכשל');
      return data as ImportResponse;
    },
    [file, customerId, taktsPerPlot]
  );

  const handlePreview = async () => {
    if (!file || !customerId) return;
    setLoading(true);
    setError(null);
    try {
      setPreview(await send(false));
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'הייבוא נכשל');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await send(true);
      setOutcome(data);
      setStage('results');
      showToast.success('הייבוא הושלם');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'הייבוא נכשל');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStage('upload');
    setFile(null);
    setTaktsPerPlot('');
    setPreview(null);
    setOutcome(null);
    setError(null);
  };

  const customerName =
    customers.find((c) => c.id === customerId)?.name ?? preview?.customer.name ?? '';

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stage 1: pick a tenant and a file */}
      {stage === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              בחירת לקוח וקובץ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>לקוח</Label>
              <SearchableSelect
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
                value={customerId}
                onValueChange={setCustomerId}
                placeholder="בחר לקוח"
                searchPlaceholder="חיפוש לקוח..."
                emptyMessage="לא נמצא לקוח"
              />
            </div>

            <div className="space-y-2">
              <Label>קובץ גיבוי</Label>
              <Input
                type="file"
                accept=".html,.json"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <p className="text-xs text-muted-foreground">
                קובץ ה-HTML שמייצר הכפתור &quot;הורד גיבוי מלא&quot; בדשבורד המסיק, או ייצוא JSON.
              </p>
            </div>

            <div className="space-y-2">
              <Label>טאקטים לחלקה (אופציונלי)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                placeholder="לפי הקובץ"
                value={taktsPerPlot}
                onChange={(e) => setTaktsPerPlot(e.target.value)}
                className="max-w-[160px]"
              />
              <p className="text-xs text-muted-foreground">
                דשבורד המסיק יוצר חלקות עם שדה הטאקטים ריק, ולרוב הוא נשאר כך — ואז אין מה להציג
                בבחירת הטאקט ב-NIR ובמסיק. מספר שיוזן כאן ייצור טאקט 1..N לכל חלקה שהקובץ לא מציין
                עבורה מספר. חלקה שכן מציינת — גובר הקובץ.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handlePreview} disabled={!file || !customerId || loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4 ml-2" />
                )}
                בדיקה מקדימה
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stage 2: what would happen */}
      {stage === 'preview' && preview && (
        <>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              זו בדיקה מקדימה בלבד — עדיין לא נכתב דבר. אישור יימחק את נתוני המסיק הקיימים של{' '}
              <strong>{preview.customer.name}</strong> ויטען את הקובץ במקומם.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                יימחק
              </CardTitle>
            </CardHeader>
            <CardContent>
              {preview.wipe.areas === 0 ? (
                <p className="text-sm text-muted-foreground">
                  אין ללקוח זה נתוני מסיק קיימים — זהו ייבוא ראשון.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <StatCard label="חלקות" value={preview.wipe.areas} destructive />
                  <StatCard label="טאקטים" value={preview.wipe.subAreas} destructive />
                  <StatCard label="דוחות" value={preview.wipe.reportAreas} destructive />
                  <StatCard label="פרטי חלקה" value={preview.wipe.plotDetails} destructive />
                  <StatCard label="אומדני יבול" value={preview.wipe.yieldEstimates} destructive />
                </div>
              )}
            </CardContent>
          </Card>

          <ImportSummaryCard title="ייטען" data={preview} />
          <IssuesCard issues={preview.result.issues} />

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleReset} disabled={loading}>
              ביטול
            </Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 ml-2" />
              )}
              מחק וייבא
            </Button>
          </div>

          <ConfirmationDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            variant="destructive"
            title="למחוק ולייבא?"
            description={
              `כל נתוני המסיק של ${customerName} יימחקו (${preview.wipe.areas} חלקות, ` +
              `${preview.wipe.reportAreas} דוחות) ויוחלפו בנתוני הקובץ. לא ניתן לבטל.`
            }
            confirmText="מחק וייבא"
            onConfirm={handleApply}
          />
        </>
      )}

      {/* Stage 3: what happened */}
      {stage === 'results' && outcome && (
        <>
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              הייבוא הושלם עבור <strong>{outcome.customer.name}</strong>. נמחקו {outcome.wipe.areas}{' '}
              חלקות קודמות.
            </AlertDescription>
          </Alert>

          <ImportSummaryCard title="נטען" data={outcome} />
          <IssuesCard issues={outcome.result.issues} />

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              המפה ריקה עד שיורץ <code className="text-xs">npm run generate-olive-geometry</code>.
              הייבוא אינו כותב גאומטריה, והמחיקה יצרה מזהי חלקות חדשים — לכן פריסת המפה תשתנה בכל
              ייבוא.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button onClick={handleReset}>
              <RotateCcw className="h-4 w-4 ml-2" />
              ייבוא נוסף
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ImportSummaryCard({ title, data }: { title: string; data: ImportResponse }) {
  const { result, source } = data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="חלקות" value={result.plots.created} />
          <StatCard label="טאקטים" value={result.takts.created} />
          <StatCard label="בדיקות NIR" value={result.nir.created} />
          <StatCard label="אומדני יבול" value={result.yield?.written ?? 0} />
          <StatCard label="ימי מזג אוויר" value={result.weatherRows} />
        </div>
        <p className="text-sm text-muted-foreground">
          בקובץ: {source.plots} חלקות · {source.nirTests} בדיקות NIR · {source.yieldRows} שורות יבול
          {data.exportedAt
            ? ` · יוצא ב-${new Date(data.exportedAt).toLocaleDateString('he-IL')}`
            : ''}
        </p>
        {/* Which season the estimates landed on. Without this the operator
            cannot tell a successful import from one that wrote 44 estimates
            onto a season no screen reads — which is exactly what an import of
            a file with no harvestYear used to do. */}
        <p className="text-sm text-muted-foreground">
          אומדני היבול נרשמו לעונה <strong>{result.season.name}</strong>
          {result.season.outcome === 'adopted'
            ? ' — העונה הפעילה, כיוון שהקובץ אינו נוקב עונה.'
            : result.season.outcome === 'existed'
              ? ' — עונה קיימת שסומנה כפעילה.'
              : ' — עונה חדשה שנוצרה וסומנה כפעילה.'}
        </p>
        {result.categoryThresholds && (
          <p className="text-sm text-muted-foreground">
            ספי הקטגוריות של כרטיסי הסטטוס (מוכן למסיק / תקין / חריגה) נלקחו מהקובץ. אלה ספים
            גלובליים — הם חלים על כל הלקוחות, לא רק על זה.
          </p>
        )}
        {result.takts.fromDefault > 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            {result.takts.fromDefault} חלקות קיבלו את מספר הטאקטים שהוזן כאן, לא מהקובץ. זהו נתון
            שהוזן ידנית — לא נתון שיובא.
          </p>
        )}
        {result.yield && result.yield.unestimated.length > 0 && (
          <p className="text-sm text-muted-foreground">
            ללא אומדן יבול ({result.yield.unestimated.length}):{' '}
            {result.yield.unestimated.join(' · ')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The data-quality flags, grouped by what kind of problem they are.
 *
 * Shown in full, never truncated: this list is what goes back to the customer
 * when their export needs fixing, and a hidden flag is one nobody acts on.
 *
 * The label carries what a single message cannot — whether the value was
 * imported with a caveat or not imported at all — so it sits next to the count,
 * and the three-part explanation behind it opens per group rather than
 * repeating itself into every line. Closed by default: an operator who already
 * knows what "טאקט שאינו קיים" means should still be able to scan forty
 * flags in one screen.
 */
function IssuesCard({ issues }: { issues: ImportIssue[] }) {
  if (issues.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>לא נמצאו בעיות בנתונים.</AlertDescription>
      </Alert>
    );
  }

  const groups = groupIssues(issues);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
          <AlertTriangle className="h-5 w-5" />
          {issues.length} ערכים שלא נטענו כמות שהם
          <span className="text-sm font-normal text-muted-foreground">
            ב-{groups.length} קבוצות
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.map((group) => (
          <IssueGroup key={group.category} {...group} />
        ))}
        <p className="text-xs text-muted-foreground">
          אלו מדווחים ולא מנוחשים. יש להשוות אותם מול הקובץ המקורי.
        </p>
      </CardContent>
    </Card>
  );
}

/** One label: the badge, its messages, and the explanation behind it. */
function IssueGroup({ info, messages }: ReturnType<typeof groupIssues>[number]) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400">
          {info.label}
        </Badge>
        <span className="text-sm text-muted-foreground">{messages.length}</span>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle className="h-3.5 w-3.5" />
            מה זה אומר?
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform${open ? ' rotate-180' : ''}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <dl className="text-xs space-y-1.5 bg-muted/50 rounded-md p-3 max-w-prose">
              <ExplanationRow term="מדוע זה קורה" text={info.what} />
              <ExplanationRow term="מה נשמר במערכת" text={info.effect} />
              <ExplanationRow term="מה לעשות" text={info.action} />
            </dl>
          </CollapsibleContent>
        </Collapsible>
      </div>
      <ul className="space-y-2">
        {messages.map((message, i) => (
          <li key={i} className="text-sm border-s-2 border-amber-500/40 ps-3 py-0.5">
            {message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExplanationRow({ term, text }: { term: string; text: string }) {
  return (
    <div>
      <dt className="inline font-semibold text-foreground">{term}: </dt>
      <dd className="inline text-muted-foreground">{text}</dd>
    </div>
  );
}

function StatCard({
  label,
  value,
  destructive,
}: {
  label: string;
  value: number;
  destructive?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4 text-center">
        <div className={`text-2xl font-bold${destructive ? ' text-destructive' : ''}`}>
          {value.toLocaleString()}
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
