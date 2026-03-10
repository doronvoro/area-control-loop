'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────

interface Crop { id: string; name: string }
interface Finding { id: string; name: string }
interface Material {
  id: string;
  name: string;
  recommended_dosage: number | null;
  recommended_unit_type: string | null;
}
interface DosageResult {
  dosage: number | null;
  unit_type_id: string | null;
  unit_type: { id: string; name: string } | null;
}

interface ApiCall {
  url: string;
  status: number | null;
  data: unknown;
  error: string | null;
  loading: boolean;
}

interface ComboCheckRow {
  crop: string;
  finding: string;
  material: string;
  dosage: number | null;
  unit: string | null;
  status: 'ok' | 'missing' | 'no-dosage';
}

// ── helpers ──────────────────────────────────────────────────────────

function buildUrl(path: string, params: Record<string, string>) {
  const u = new URL(path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.pathname + u.search;
}

async function apiFetch(url: string): Promise<{ status: number; data: unknown }> {
  const res = await fetch(url);
  const data = await res.json();
  return { status: res.status, data };
}

// ── JsonBlock ────────────────────────────────────────────────────────

function JsonBlock({ call, label }: { call: ApiCall; label: string }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(JSON.stringify(call.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const ok = call.status === 200;

  return (
    <div className="rounded-lg border bg-card overflow-hidden text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors text-right"
      >
        {call.loading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
        ) : call.status ? (
          ok ? (
            <CheckCircle2 className="size-4 text-green-500 shrink-0" />
          ) : (
            <XCircle className="size-4 text-red-500 shrink-0" />
          )
        ) : (
          <div className="size-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
        )}

        <span className="font-medium flex-1 text-start">{label}</span>

        {call.status && (
          <Badge
            variant="outline"
            className={cn(
              'text-xs font-mono',
              ok ? 'border-green-500/50 text-green-600' : 'border-red-500/50 text-red-600'
            )}
          >
            {call.status}
          </Badge>
        )}

        {call.url && (
          <span className="hidden md:block text-xs text-muted-foreground font-mono truncate max-w-xs">
            {call.url}
          </span>
        )}

        {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
      </button>

      {open && (call.data !== null || call.error) && (
        <div className="relative border-t bg-muted/30">
          <button
            onClick={copy}
            className="absolute top-2 left-2 p-1.5 rounded hover:bg-muted transition-colors"
            title="העתק"
          >
            {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5 text-muted-foreground" />}
          </button>
          <pre className="px-4 pt-3 pb-3 overflow-x-auto text-xs leading-relaxed max-h-64">
            {call.error
              ? call.error
              : JSON.stringify(call.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── ComboTable ───────────────────────────────────────────────────────

function ComboTable({ rows, loading }: { rows: ComboCheckRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span>בודק שילובים...</span>
      </div>
    );
  }
  if (rows.length === 0) return null;

  const ok = rows.filter((r) => r.status === 'ok').length;
  const missing = rows.filter((r) => r.status === 'missing').length;
  const noDosage = rows.filter((r) => r.status === 'no-dosage').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="border-green-500/50 text-green-600 gap-1">
          <CheckCircle2 className="size-3" /> {ok} תקין
        </Badge>
        <Badge variant="outline" className="border-amber-500/50 text-amber-600 gap-1">
          {noDosage} ללא מינון
        </Badge>
        <Badge variant="outline" className="border-red-500/50 text-red-600 gap-1">
          <XCircle className="size-3" /> {missing} חסר
        </Badge>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-right font-medium">גידול</th>
              <th className="px-4 py-2 text-right font-medium">נגע</th>
              <th className="px-4 py-2 text-right font-medium">חומר</th>
              <th className="px-4 py-2 text-right font-medium">מינון</th>
              <th className="px-4 py-2 text-right font-medium">יחידה</th>
              <th className="px-4 py-2 text-center font-medium">סטטוס</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={i} className={cn('hover:bg-muted/30', r.status === 'missing' && 'bg-red-50/50 dark:bg-red-950/20')}>
                <td className="px-4 py-2">{r.crop}</td>
                <td className="px-4 py-2">{r.finding || '—'}</td>
                <td className="px-4 py-2">{r.material}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.dosage ?? '—'}</td>
                <td className="px-4 py-2 text-xs">{r.unit ?? '—'}</td>
                <td className="px-4 py-2 text-center">
                  {r.status === 'ok' ? (
                    <CheckCircle2 className="size-4 text-green-500 mx-auto" />
                  ) : r.status === 'no-dosage' ? (
                    <span className="text-amber-500 text-xs">ללא מינון</span>
                  ) : (
                    <XCircle className="size-4 text-red-500 mx-auto" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── StatsBar ─────────────────────────────────────────────────────────

function StatsBar({ crops, findings, materials }: { crops: number; findings: number; materials: number }) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {[
        { label: 'גידולים ב-DB', value: crops },
        { label: 'נגעים ב-DB', value: findings },
        { label: 'חומרים ב-DB', value: materials },
      ].map(({ label, value }) => (
        <div key={label} className="rounded-lg border bg-card px-4 py-3 text-center">
          <div className="text-2xl font-bold tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Select ───────────────────────────────────────────────────────────

function Select({
  label,
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; name: string }[];
  placeholder: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[direction:rtl]'
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}

// ── ApiChecker (main) ────────────────────────────────────────────────

export function ApiChecker() {
  // ── reference data
  const [allCrops, setAllCrops] = useState<Crop[]>([]);
  const [allFindings, setAllFindings] = useState<Finding[]>([]);
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);

  // ── cascade selections
  const [cropId, setCropId] = useState('');
  const [findingId, setFindingId] = useState('');
  const [materialId, setMaterialId] = useState('');

  // ── cascade results
  const [cascadeFindings, setCascadeFindings] = useState<Finding[]>([]);
  const [cascadeMaterials, setCascadeMaterials] = useState<Material[]>([]);
  const [dosage, setDosage] = useState<DosageResult | null | undefined>(undefined);

  // ── api call logs
  const [calls, setCalls] = useState<Record<string, ApiCall>>({});

  // ── bulk check
  const [bulkRows, setBulkRows] = useState<ComboCheckRow[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const setCall = useCallback((key: string, update: Partial<ApiCall>) => {
    setCalls((prev) => ({ ...prev, [key]: { ...emptyCall, ...prev[key], ...update } }));
  }, []);

  const emptyCall: ApiCall = { url: '', status: null, data: null, error: null, loading: false };

  // ── load all reference data on mount
  useEffect(() => {
    (async () => {
      const [cropsRes, findingsRes, materialsRes] = await Promise.all([
        fetch('/api/crops'),
        fetch('/api/findings'),
        fetch('/api/materials'),
      ]);
      if (cropsRes.ok) setAllCrops(await cropsRes.json());
      if (findingsRes.ok) setAllFindings(await findingsRes.json());
      if (materialsRes.ok) setAllMaterials(await materialsRes.json());
    })();
  }, []);

  // ── cascade: findings when crop changes
  useEffect(() => {
    if (!cropId) {
      setCascadeFindings([]);
      setFindingId('');
      setMaterialId('');
      setCascadeMaterials([]);
      setDosage(undefined);
      setCalls({});
      return;
    }

    const url = buildUrl('/api/cascade', { type: 'findings', cropId });
    setCall('findings', { url, loading: true, data: null, error: null, status: null });
    setFindingId('');
    setMaterialId('');
    setCascadeMaterials([]);
    setDosage(undefined);

    apiFetch(url).then(({ status, data }) => {
      setCascadeFindings(status === 200 ? (data as Finding[]) : []);
      setCall('findings', { status, data, loading: false });
    }).catch((e) => {
      setCall('findings', { loading: false, error: String(e), status: 0 });
    });
  }, [cropId]); // eslint-disable-line

  // ── cascade: materials when crop + finding change
  useEffect(() => {
    if (!cropId) return;

    const params: Record<string, string> = { type: 'materials', cropId };
    if (findingId) params.findingId = findingId;

    const url = buildUrl('/api/cascade', params);
    setCall('materials', { url, loading: true, data: null, error: null, status: null });
    setMaterialId('');
    setDosage(undefined);

    apiFetch(url).then(({ status, data }) => {
      setCascadeMaterials(status === 200 ? (data as Material[]) : []);
      setCall('materials', { status, data, loading: false });
    }).catch((e) => {
      setCall('materials', { loading: false, error: String(e), status: 0 });
    });
  }, [cropId, findingId]); // eslint-disable-line

  // ── cascade: dosage when material changes
  useEffect(() => {
    if (!cropId || !materialId) {
      setDosage(undefined);
      return;
    }

    const params: Record<string, string> = { type: 'dosage', cropId, materialId };
    if (findingId) params.findingId = findingId;

    const url = buildUrl('/api/cascade', params);
    setCall('dosage', { url, loading: true, data: null, error: null, status: null });

    apiFetch(url).then(({ status, data }) => {
      setDosage(status === 200 ? (data as DosageResult | null) : undefined);
      setCall('dosage', { status, data, loading: false });
    }).catch((e) => {
      setCall('dosage', { loading: false, error: String(e), status: 0 });
      setDosage(undefined);
    });
  }, [cropId, findingId, materialId]); // eslint-disable-line

  // ── bulk check: all findings × materials for selected crop
  const runBulkCheck = useCallback(async () => {
    if (!cropId) return;
    setBulkLoading(true);
    setBulkRows([]);

    const cropName = allCrops.find((c) => c.id === cropId)?.name ?? cropId;

    // Get findings for crop
    const fRes = await fetch(`/api/cascade?type=findings&cropId=${cropId}`);
    const findings: Finding[] = fRes.ok ? await fRes.json() : [];

    const rows: ComboCheckRow[] = [];

    // For each finding, get materials, then for each material get dosage
    for (const f of findings) {
      const mRes = await fetch(`/api/cascade?type=materials&cropId=${cropId}&findingId=${f.id}`);
      const materials: Material[] = mRes.ok ? await mRes.json() : [];

      for (const m of materials) {
        const dRes = await fetch(`/api/cascade?type=dosage&cropId=${cropId}&findingId=${f.id}&materialId=${m.id}`);
        const d: DosageResult | null = dRes.ok ? await dRes.json() : null;

        rows.push({
          crop: cropName,
          finding: f.name,
          material: m.name,
          dosage: d?.dosage ?? null,
          unit: d?.unit_type?.name ?? null,
          status: !d ? 'missing' : d.dosage === null ? 'no-dosage' : 'ok',
        });
      }
    }

    // Also check materials with no finding (generic)
    const mGenRes = await fetch(`/api/cascade?type=materials&cropId=${cropId}`);
    const genericMats: Material[] = mGenRes.ok ? await mGenRes.json() : [];
    const alreadySeen = new Set(rows.map((r) => r.material));

    for (const m of genericMats) {
      if (alreadySeen.has(m.name)) continue;
      const dRes = await fetch(`/api/cascade?type=dosage&cropId=${cropId}&materialId=${m.id}`);
      const d: DosageResult | null = dRes.ok ? await dRes.json() : null;

      rows.push({
        crop: cropName,
        finding: '',
        material: m.name,
        dosage: d?.dosage ?? null,
        unit: d?.unit_type?.name ?? null,
        status: !d ? 'missing' : d.dosage === null ? 'no-dosage' : 'ok',
      });
    }

    setBulkRows(rows);
    setBulkLoading(false);
  }, [cropId, allCrops]);

  const selectedCrop = allCrops.find((c) => c.id === cropId);
  const selectedFinding = allFindings.find((f) => f.id === findingId);
  const selectedMaterial = (cascadeMaterials.find((m) => m.id === materialId) ?? allMaterials.find((m) => m.id === materialId));

  return (
    <div className="space-y-6" dir="rtl">
      {/* Stats */}
      <StatsBar crops={allCrops.length} findings={allFindings.length} materials={allMaterials.length} />

      {/* Cascade Selectors */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <h2 className="text-base font-semibold">שרשרת Cascade</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select
            label="גידול"
            value={cropId}
            options={allCrops}
            placeholder="בחר גידול..."
            onChange={setCropId}
          />
          <Select
            label="נגע"
            value={findingId}
            options={cascadeFindings}
            placeholder={cropId ? 'בחר נגע (אופציונלי)...' : 'בחר גידול תחילה'}
            disabled={!cropId}
            onChange={setFindingId}
          />
          <Select
            label="חומר"
            value={materialId}
            options={cascadeMaterials}
            placeholder={cropId ? 'בחר חומר...' : 'בחר גידול תחילה'}
            disabled={!cropId}
            onChange={setMaterialId}
          />
        </div>

        {/* Dosage Result */}
        {materialId && (
          <div className={cn(
            'rounded-lg border p-4 transition-colors',
            dosage === undefined ? 'bg-muted/30' :
            dosage === null ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800' :
            'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
          )}>
            <div className="text-sm font-medium mb-2">שילוב: {selectedCrop?.name} → {selectedFinding?.name ?? '(ללא נגע)'} → {selectedMaterial?.name}</div>

            {calls.dosage?.loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" /> טוען מינון...
              </div>
            ) : dosage === undefined ? (
              <span className="text-muted-foreground text-sm">ממתין...</span>
            ) : dosage === null ? (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <XCircle className="size-4" /> לא נמצאה המלצה עבור שילוב זה
              </div>
            ) : (
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <span className="text-xs text-muted-foreground">מינון</span>
                  <div className="text-2xl font-bold tabular-nums">{dosage.dosage ?? '—'}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">יחידה</span>
                  <div className="text-lg font-medium">{dosage.unit_type?.name ?? '—'}</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">מזהה יחידה</span>
                  <div className="text-xs font-mono text-muted-foreground">{dosage.unit_type_id ?? '—'}</div>
                </div>
                <CheckCircle2 className="size-6 text-green-500 mr-auto" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* API Response Inspector */}
      {Object.keys(calls).length > 0 && (
        <div className="rounded-xl border bg-card p-6 space-y-3">
          <h2 className="text-base font-semibold">תגובות API</h2>
          {calls.findings && (
            <JsonBlock
              call={calls.findings}
              label={`GET /api/cascade?type=findings — ${cascadeFindings.length} נגעים`}
            />
          )}
          {calls.materials && (
            <JsonBlock
              call={calls.materials}
              label={`GET /api/cascade?type=materials — ${cascadeMaterials.length} חומרים`}
            />
          )}
          {calls.dosage && (
            <JsonBlock
              call={calls.dosage}
              label="GET /api/cascade?type=dosage — מינון"
            />
          )}
        </div>
      )}

      {/* Bulk Check */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">בדיקת שילובים מלאה</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              בדוק את כל השילובים גידול → נגע → חומר → מינון + יחידה עבור הגידול שנבחר
            </p>
          </div>
          <Button
            onClick={runBulkCheck}
            disabled={!cropId || bulkLoading}
            className="gap-2 shrink-0"
          >
            {bulkLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            הרץ בדיקה
          </Button>
        </div>

        {!cropId && (
          <p className="text-sm text-muted-foreground">בחר גידול כדי להריץ בדיקת שילובים.</p>
        )}

        <ComboTable rows={bulkRows} loading={bulkLoading} />
      </div>
    </div>
  );
}
