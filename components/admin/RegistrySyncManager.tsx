'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, ChevronDown, ChevronUp, Loader2, Trash2 } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import type { CropSyncStatus } from '@/app/api/pesticide-registry/sync-status/route';

interface SyncStatusResponse {
  crops: CropSyncStatus[];
}

export function RegistrySyncManager() {
  const [loaded, setLoaded] = useState(false);
  const { data, loading, error, refetch } = useApiData<SyncStatusResponse>(
    '/api/pesticide-registry/sync-status',
    { skip: !loaded }
  );
  const [selectedCrops, setSelectedCrops] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const crops = data?.crops || [];
  const cropsWithRegistry = crops.filter((c) => c.status !== 'no_registry_data');
  const cropsPartial = crops.filter((c) => c.status === 'partial');

  const toggleCrop = (id: string) => {
    setSelectedCrops((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCrops.size === cropsWithRegistry.length) {
      setSelectedCrops(new Set());
    } else {
      setSelectedCrops(new Set(cropsWithRegistry.map((c) => c.id)));
    }
  };

  const selectPartial = () => {
    setSelectedCrops(new Set(cropsPartial.map((c) => c.id)));
  };

  const handleSync = async () => {
    if (selectedCrops.size === 0) return;
    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch('/api/pesticide-registry/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cropIds: Array.from(selectedCrops) }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setSyncResult(result.summary);
      setSelectedCrops(new Set());
      await refetch();
    } catch (err: any) {
      setSyncResult({ error: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteDuplicateCrop = async (cropId: string, cropName: string) => {
    if (!confirm(`למחוק את הגידול הכפול "${cropName}"? (id: ${cropId})`)) return;
    try {
      const response = await fetch(`/api/crops?id=${cropId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'שגיאה במחיקה');
      }
      await refetch();
    } catch (err: any) {
      alert(`שגיאה: ${err.message}`);
    }
  };

  const statusBadge = (status: CropSyncStatus['status']) => {
    switch (status) {
      case 'synced':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">מסונכרן</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">חלקי</Badge>;
      case 'no_registry_data':
        return <Badge variant="secondary">אין נתוני מרשם</Badge>;
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Button onClick={() => setLoaded(true)} size="lg">
          <RefreshCw className="ml-2 h-5 w-5" />
          טען סטטוס סנכרון
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mr-3 text-muted-foreground">טוען סטטוס סנכרון...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-700">
        <p>שגיאה: {error}</p>
        <Button variant="outline" size="sm" onClick={refetch} className="mt-2">
          נסה שוב
        </Button>
      </div>
    );
  }

  const totalSynced = crops.filter((c) => c.status === 'synced').length;
  const totalPartial = cropsPartial.length;
  const totalNoData = crops.filter((c) => c.status === 'no_registry_data').length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">סה&quot;כ גידולים</div>
          <div className="text-2xl font-bold">{crops.length}</div>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <div className="text-sm text-green-700">מסונכרנים</div>
          <div className="text-2xl font-bold text-green-800">{totalSynced}</div>
        </div>
        <div className="rounded-lg border bg-yellow-50 p-4">
          <div className="text-sm text-yellow-700">סנכרון חלקי</div>
          <div className="text-2xl font-bold text-yellow-800">{totalPartial}</div>
        </div>
        <div className="rounded-lg border bg-gray-50 p-4">
          <div className="text-sm text-gray-500">ללא נתוני מרשם</div>
          <div className="text-2xl font-bold text-gray-600">{totalNoData}</div>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handleSync}
          disabled={syncing || selectedCrops.size === 0}
        >
          {syncing ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="ml-2 h-4 w-4" />
          )}
          סנכרן נבחרים ({selectedCrops.size})
        </Button>
        {cropsPartial.length > 0 && (
          <Button variant="outline" onClick={selectPartial}>
            בחר חלקיים ({cropsPartial.length})
          </Button>
        )}
        <Button variant="outline" onClick={toggleAll}>
          {selectedCrops.size === cropsWithRegistry.length ? 'בטל הכל' : 'בחר הכל'}
        </Button>
        <Button variant="ghost" onClick={refetch}>
          <RefreshCw className="ml-2 h-4 w-4" />
          רענן
        </Button>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div
          className={`rounded-md p-4 ${
            syncResult.error
              ? 'bg-red-50 text-red-700'
              : 'bg-green-50 text-green-800'
          }`}
        >
          {syncResult.error ? (
            <p>שגיאה: {syncResult.error}</p>
          ) : (
            <div className="space-y-1">
              <p className="font-medium">סנכרון הושלם בהצלחה!</p>
              <p>ממצאים חדשים: {syncResult.findingsCreated} | חומרים חדשים: {syncResult.materialsCreated} | קשרי גידול-ממצא: {syncResult.cropFindingsCreated} | המלצות: {syncResult.recommendationsCreated}</p>
              {(syncResult.duplicatesRemoved?.cropFindings > 0 || syncResult.duplicatesRemoved?.recommendations > 0) && (
                <p className="text-orange-700">כפילויות שהוסרו: קשרי גידול-ממצא: {syncResult.duplicatesRemoved.cropFindings} | המלצות: {syncResult.duplicatesRemoved.recommendations}</p>
              )}
              {syncResult.errors?.length > 0 && (
                <p className="text-yellow-700">
                  שגיאות: {syncResult.errors.map((e: any) => `${e.crop}: ${e.error}`).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Crops table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedCrops.size === cropsWithRegistry.length && cropsWithRegistry.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>גידול</TableHead>
              <TableHead className="text-center">שורות מרשם</TableHead>
              <TableHead className="text-center">ממצאים</TableHead>
              <TableHead className="text-center">חומרים</TableHead>
              <TableHead className="text-center">קשרי גידול-ממצא</TableHead>
              <TableHead className="text-center">המלצות</TableHead>
              <TableHead className="text-center">סטטוס</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {crops.map((crop) => (
              <CropRow
                key={crop.id}
                crop={crop}
                selected={selectedCrops.has(crop.id)}
                onToggle={() => toggleCrop(crop.id)}
                statusBadge={statusBadge}
                onDeleteDuplicate={handleDeleteDuplicateCrop}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CropRow({
  crop,
  selected,
  onToggle,
  statusBadge,
  onDeleteDuplicate,
}: {
  crop: CropSyncStatus;
  selected: boolean;
  onToggle: () => void;
  statusBadge: (status: CropSyncStatus['status']) => React.ReactNode;
  onDeleteDuplicate: (cropId: string, cropName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDuplicates =
    (crop.synced.duplicateCropFindings || 0) > 0 ||
    (crop.synced.duplicateRecommendations || 0) > 0;
  const hasDetails =
    crop.synced.missingFindings.length > 0 ||
    crop.synced.missingMaterials.length > 0 ||
    crop.isDuplicate ||
    hasDuplicates;

  const isNoData = crop.status === 'no_registry_data';

  return (
    <>
      <TableRow className={selected ? 'bg-muted/50' : undefined}>
        <TableCell>
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            disabled={isNoData}
          />
        </TableCell>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {crop.name}
            {crop.isDuplicate && crop.canDeleteDuplicate && (
              <Button
                variant="destructive"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => onDeleteDuplicate(crop.id, crop.name)}
              >
                <Trash2 className="ml-1 h-3 w-3" />
                מחק כפילות
              </Button>
            )}
            {crop.isDuplicate && !crop.canDeleteDuplicate && (
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">כפול</Badge>
            )}
            {hasDetails && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </TableCell>
        <TableCell className="text-center">{crop.registry.totalRows}</TableCell>
        <TableCell className="text-center">
          {isNoData ? (
            '-'
          ) : (
            <span>
              {crop.synced.findings}/{crop.registry.uniqueFindings.length}
              {crop.synced.missingFindings.length > 0 && (
                <span className="text-red-500 mr-1">
                  ({crop.synced.missingFindings.length} חסרים)
                </span>
              )}
            </span>
          )}
        </TableCell>
        <TableCell className="text-center">
          {isNoData ? (
            '-'
          ) : (
            <span>
              {crop.synced.materials}/{crop.registry.uniqueMaterials.length}
              {crop.synced.missingMaterials.length > 0 && (
                <span className="text-red-500 mr-1">
                  ({crop.synced.missingMaterials.length} חסרים)
                </span>
              )}
            </span>
          )}
        </TableCell>
        <TableCell className="text-center">
          {isNoData ? (
            '-'
          ) : (
            <span>
              {crop.synced.cropFindings}/{crop.registry.uniqueFindings.length}
              {crop.synced.missingCropFindings > 0 && (
                <span className="text-red-500 mr-1">
                  ({crop.synced.missingCropFindings} חסרים)
                </span>
              )}
              {(crop.synced.duplicateCropFindings || 0) > 0 && (
                <span className="text-orange-500 mr-1">
                  ({crop.synced.duplicateCropFindings} כפולים)
                </span>
              )}
            </span>
          )}
        </TableCell>
        <TableCell className="text-center">
          {isNoData ? (
            '-'
          ) : (
            <span>
              {crop.synced.recommendations}
              {crop.synced.missingRecommendations > 0 && (
                <span className="text-red-500 mr-1">
                  ({crop.synced.missingRecommendations} חסרים)
                </span>
              )}
              {(crop.synced.duplicateRecommendations || 0) > 0 && (
                <span className="text-orange-500 mr-1">
                  ({crop.synced.duplicateRecommendations} כפולים)
                </span>
              )}
            </span>
          )}
        </TableCell>
        <TableCell className="text-center">{statusBadge(crop.status)}</TableCell>
      </TableRow>
      {hasDetails && expanded && (
        <TableRow>
          <TableCell colSpan={8} className="bg-muted/30 px-8 py-3">
            <div className="space-y-2 text-sm">
              {crop.synced.missingFindings.length > 0 && (
                <div>
                  <span className="font-medium text-red-600">ממצאים חסרים: </span>
                  {crop.synced.missingFindings.join(', ')}
                </div>
              )}
              {crop.synced.missingMaterials.length > 0 && (
                <div>
                  <span className="font-medium text-red-600">חומרים חסרים: </span>
                  {crop.synced.missingMaterials.join(', ')}
                </div>
              )}
              {crop.isDuplicate && (
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-medium text-red-600">גידול כפול: </span>
                    {crop.canDeleteDuplicate ? (
                      <span>אין הפניות לגידול זה. ניתן למחוק.</span>
                    ) : (
                      <span>
                        הפניות: שטחים={crop.duplicateRefs?.areas || 0}, קשרי ממצאים={crop.duplicateRefs?.cropFindings || 0}, המלצות={crop.duplicateRefs?.recommendations || 0}
                      </span>
                    )}
                  </div>
                  {crop.canDeleteDuplicate && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDeleteDuplicate(crop.id, crop.name)}
                    >
                      <Trash2 className="ml-1 h-3 w-3" />
                      מחק כפילות
                    </Button>
                  )}
                </div>
              )}
              {hasDuplicates && (
                <div>
                  <span className="font-medium text-orange-600">כפילויות: </span>
                  {(crop.synced.duplicateCropFindings || 0) > 0 && `קשרי גידול-ממצא: ${crop.synced.duplicateCropFindings} `}
                  {(crop.synced.duplicateRecommendations || 0) > 0 && `המלצות: ${crop.synced.duplicateRecommendations}`}
                  {' '}(יוסרו בסנכרון)
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
