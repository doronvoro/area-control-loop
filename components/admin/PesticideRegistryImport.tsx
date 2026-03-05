'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  Search,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sprout,
  Bug,
  FlaskConical,
  Beaker,
  Link2,
  RotateCcw,
} from 'lucide-react';

type Stage = 'upload' | 'select' | 'impact' | 'results';

interface CropInfo {
  name: string;
  nameEn: string;
  rowCount: number;
}

interface ImpactData {
  selectedCrops: string[];
  filteredRows: number;
  impact: {
    newCrops: number;
    existingCrops: number;
    newFindings: number;
    existingFindings: number;
    newMaterials: number;
    existingMaterials: number;
    newUnitTypes: number;
    existingUnitTypes: number;
    cropFindingPairs: number;
    parsableRecommendations: number;
    unparsableDosages: number;
    registryRows: number;
  };
}

interface ImportResult {
  success: boolean;
  batchId: string;
  summary: {
    crops: number;
    findings: number;
    materials: number;
    unitTypes: number;
    cropFindings: number;
    recommendations: number;
    skipped: number;
    registryRows: number;
    errors: Array<{ row: number; error: string }>;
  };
}

export function PesticideRegistryImport() {
  const [stage, setStage] = useState<Stage>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stage 2: crop selection
  const [crops, setCrops] = useState<CropInfo[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [selectedCrops, setSelectedCrops] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Stage 3: impact
  const [impactData, setImpactData] = useState<ImpactData | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Stage 4: results
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const filteredCrops = useMemo(() => {
    if (!searchQuery) return crops;
    const q = searchQuery.toLowerCase();
    return crops.filter(
      (c) => c.name.includes(q) || c.nameEn.toLowerCase().includes(q)
    );
  }, [crops, searchQuery]);

  const selectedCount = selectedCrops.size;
  const selectedRowCount = crops
    .filter((c) => selectedCrops.has(c.name))
    .reduce((sum, c) => sum + c.rowCount, 0);

  // Stage 1: Upload and parse
  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/pesticide-registry/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'שגיאה בניתוח הקובץ');
      }

      const data = await res.json();
      setCrops(data.crops);
      setTotalRows(data.totalRows);
      setSelectedCrops(new Set());
      setStage('select');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Stage 2: Analyze impact
  const handleAnalyze = async () => {
    if (!file || selectedCrops.size === 0) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('crops', [...selectedCrops].join(','));

      const res = await fetch('/api/pesticide-registry/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'שגיאה בניתוח');
      }

      const data = await res.json();
      setImpactData(data);
      setStage('impact');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Stage 3: Execute import
  const handleImport = async () => {
    if (!file || selectedCrops.size === 0) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('crops', [...selectedCrops].join(','));
      formData.append('replace', replaceExisting.toString());

      const res = await fetch('/api/pesticide-registry/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'שגיאה בייבוא');
      }

      const data = await res.json();
      setImportResult(data);
      setStage('results');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStage('upload');
    setFile(null);
    setCrops([]);
    setTotalRows(0);
    setSelectedCrops(new Set());
    setSearchQuery('');
    setImpactData(null);
    setReplaceExisting(false);
    setImportResult(null);
    setError(null);
  };

  const toggleCrop = (name: string) => {
    setSelectedCrops((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCrops.size === filteredCrops.length) {
      setSelectedCrops(new Set());
    } else {
      setSelectedCrops(new Set(filteredCrops.map((c) => c.name)));
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stage 1: Upload */}
      {stage === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              העלאת קובץ CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              העלה קובץ CSV של מרשם ההדברה ממשרד החקלאות. הקובץ צריך להיות בקידוד UTF-8.
            </p>
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="flex-1"
              />
              <Button onClick={handleUpload} disabled={!file || loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 ml-2" />
                )}
                {loading ? 'מנתח...' : 'העלה ונתח'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stage 2: Crop Selection */}
      {stage === 'select' && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              נמצאו <strong>{crops.length}</strong> גידולים ב-<strong>{totalRows.toLocaleString()}</strong> שורות
            </div>
            <div className="flex items-center gap-2">
              {selectedCount > 0 && (
                <Badge variant="secondary">
                  {selectedCount} גידולים נבחרו ({selectedRowCount.toLocaleString()} שורות)
                </Badge>
              )}
              <Button
                onClick={handleAnalyze}
                disabled={selectedCount === 0 || loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <ArrowLeft className="h-4 w-4 ml-2" />
                )}
                {loading ? 'מנתח...' : 'ניתוח השפעה'}
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="חיפוש גידול..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedCrops.size === filteredCrops.length ? 'בטל הכל' : 'בחר הכל'}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 ml-1" />
                  התחל מחדש
                </Button>
              </div>

              <div className="rounded-md border max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>גידול</TableHead>
                      <TableHead>שם באנגלית</TableHead>
                      <TableHead className="text-left">שורות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCrops.map((crop) => (
                      <TableRow
                        key={crop.name}
                        className="cursor-pointer"
                        onClick={() => toggleCrop(crop.name)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedCrops.has(crop.name)}
                            onCheckedChange={() => toggleCrop(crop.name)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{crop.name}</TableCell>
                        <TableCell className="text-muted-foreground">{crop.nameEn}</TableCell>
                        <TableCell className="text-left">
                          <Badge variant="outline">{crop.rowCount.toLocaleString()}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Stage 3: Impact Analysis */}
      {stage === 'impact' && impactData && (
        <>
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStage('select')}>
              <ArrowRight className="h-4 w-4 ml-2" />
              חזור לבחירת גידולים
            </Button>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={replaceExisting}
                  onCheckedChange={(checked) => setReplaceExisting(checked === true)}
                />
                החלף נתונים קיימים מהמרשם
              </label>
              <Button onClick={handleImport} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 ml-2" />
                )}
                {loading ? 'מייבא...' : 'בצע ייבוא'}
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            ניתוח השפעה עבור <strong>{impactData.selectedCrops.join(', ')}</strong> ({impactData.filteredRows.toLocaleString()} שורות)
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <ImpactCard
              icon={Sprout}
              title="גידולים"
              newCount={impactData.impact.newCrops}
              existingCount={impactData.impact.existingCrops}
            />
            <ImpactCard
              icon={Bug}
              title="ממצאים (נגעים)"
              newCount={impactData.impact.newFindings}
              existingCount={impactData.impact.existingFindings}
            />
            <ImpactCard
              icon={FlaskConical}
              title="חומרים"
              newCount={impactData.impact.newMaterials}
              existingCount={impactData.impact.existingMaterials}
            />
            <ImpactCard
              icon={Beaker}
              title="יחידות מידה"
              newCount={impactData.impact.newUnitTypes}
              existingCount={impactData.impact.existingUnitTypes}
            />
            <ImpactCard
              icon={Link2}
              title="קישורי גידול-ממצא"
              newCount={impactData.impact.cropFindingPairs}
              existingCount={0}
              hideExisting
            />
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">המלצות</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ניתנות לייבוא</span>
                    <Badge variant="default">{impactData.impact.parsableRecommendations.toLocaleString()}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">לא ניתנות לניתוח</span>
                    <Badge variant="outline">{impactData.impact.unparsableDosages.toLocaleString()}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Stage 4: Results */}
      {stage === 'results' && importResult && (
        <>
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              הייבוא הושלם בהצלחה!
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ResultCard label="שורות במרשם" value={importResult.summary.registryRows} />
            <ResultCard label="גידולים" value={importResult.summary.crops} />
            <ResultCard label="ממצאים" value={importResult.summary.findings} />
            <ResultCard label="חומרים" value={importResult.summary.materials} />
            <ResultCard label="יחידות מידה" value={importResult.summary.unitTypes} />
            <ResultCard label="קישורי גידול-ממצא" value={importResult.summary.cropFindings} />
            <ResultCard label="המלצות חדשות" value={importResult.summary.recommendations} />
            <ResultCard label="דילוגים" value={importResult.summary.skipped} />
          </div>

          {importResult.summary.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {importResult.summary.errors.length} שגיאות במהלך הייבוא
              </AlertDescription>
            </Alert>
          )}

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

function ImpactCard({
  icon: Icon,
  title,
  newCount,
  existingCount,
  hideExisting = false,
}: {
  icon: any;
  title: string;
  newCount: number;
  existingCount: number;
  hideExisting?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">חדשים</span>
            <Badge variant="default">{newCount}</Badge>
          </div>
          {!hideExisting && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">קיימים</span>
              <Badge variant="outline">{existingCount}</Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ResultCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 text-center">
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
