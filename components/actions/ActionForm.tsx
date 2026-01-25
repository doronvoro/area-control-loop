'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const actionSchema = z.object({
  worker_id: z.string().min(1, 'נדרש לבחור עובד'),
  area_id: z.string().min(1, 'נדרש לבחור שטח'),
  monitoring_report_id: z.string().optional(),
  sub_area_id: z.string().min(1, 'נדרש לבחור תת-שטח'),
  finding_id: z.string().min(1, 'נדרש לבחור ממצא'),
  material: z.string().min(1, 'נדרש להזין חומר'),
  dosage: z.string().min(1, 'נדרש להזין מינון'),
  unit_type_id: z.string().min(1, 'נדרש לבחור יחידת מידה'),
  action_type_id: z.string().min(1, 'נדרש לבחור סוג פעולה'),
  action_time: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  update_monitoring_status: z.string().optional(),
});

type ActionFormData = z.infer<typeof actionSchema>;

interface ActionFormProps {
  actionWorkers: any[];
  areas: any[];
  findings: any[];
  actionTypes: any[];
  unitTypes: any[];
}

interface MonitoringOption {
  id: string;
  key: string;
  display: string;
  sub_area_id: string;
  finding_id: string;
  finding_name: string;
  status: string;
}

export function ActionForm({
  actionWorkers,
  areas,
  findings,
  actionTypes,
  unitTypes,
}: ActionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [monitoringOptions, setMonitoringOptions] = useState<MonitoringOption[]>([]);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [selectedMonitoring, setSelectedMonitoring] = useState<MonitoringOption | null>(null);
  const [linkToMonitoring, setLinkToMonitoring] = useState(false);
  const [subAreas, setSubAreas] = useState<any[]>([]);
  const [loadingSubAreas, setLoadingSubAreas] = useState(false);
  const [filteredActionTypes, setFilteredActionTypes] = useState<any[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<any[]>([]);
  const [loadingActionTypes, setLoadingActionTypes] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [selectedMaterialData, setSelectedMaterialData] = useState<{ dosage: string; unit_type_id: string } | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const router = useRouter();

  const form = useForm<ActionFormData>({
    resolver: zodResolver(actionSchema),
    defaultValues: {
      worker_id: '',
      area_id: '',
      monitoring_report_id: '',
      sub_area_id: '',
      finding_id: '',
      material: '',
      dosage: '',
      unit_type_id: '',
      action_type_id: '',
      action_time: '',
      status: 'planned',
      notes: '',
      update_monitoring_status: '',
    },
  });

  // Fetch monitoring reports and sub-areas when area is selected
  useEffect(() => {
    const areaId = form.watch('area_id');
    if (areaId && areaId !== selectedAreaId) {
      setSelectedAreaId(areaId);
      fetchMonitoringReports(areaId);
      fetchSubAreas(areaId);
    }
  }, [form.watch('area_id')]);

  // Fetch action types when finding is selected
  useEffect(() => {
    const findingId = form.watch('finding_id');
    if (findingId && !linkToMonitoring) {
      fetchActionTypes(findingId);
    } else if (!findingId) {
      setFilteredActionTypes([]);
      form.setValue('action_type_id', '');
    }
  }, [form.watch('finding_id'), linkToMonitoring]);

  // Fetch materials when action type is selected
  useEffect(() => {
    const findingId = form.watch('finding_id');
    const actionTypeId = form.watch('action_type_id');
    if (findingId && actionTypeId && !linkToMonitoring) {
      fetchMaterials(findingId, actionTypeId);
    } else {
      setFilteredMaterials([]);
      setSelectedMaterialId('');
      form.setValue('material', '');
      form.setValue('dosage', '');
      form.setValue('unit_type_id', '');
      setSelectedMaterialData(null);
    }
  }, [form.watch('action_type_id'), linkToMonitoring]);

  // Fetch dosage and unit type when material is selected
  useEffect(() => {
    const findingId = form.watch('finding_id');
    const actionTypeId = form.watch('action_type_id');
    if (findingId && actionTypeId && selectedMaterialId && !linkToMonitoring) {
      fetchDosageAndUnit(findingId, actionTypeId, selectedMaterialId);
    } else {
      setSelectedMaterialData(null);
    }
  }, [selectedMaterialId, linkToMonitoring]);

  const fetchSubAreas = async (areaId: string) => {
    setLoadingSubAreas(true);
    try {
      const response = await fetch(`/api/sub-areas?areaId=${areaId}`);
      if (response.ok) {
        const data = await response.json();
        setSubAreas(data);
      }
    } catch (err) {
      console.error('Error fetching sub-areas:', err);
    } finally {
      setLoadingSubAreas(false);
    }
  };

  const fetchMonitoringReports = async (areaId: string) => {
    setLoadingMonitoring(true);
    try {
      const response = await fetch(`/api/monitoring/by-area?areaId=${areaId}`);
      if (response.ok) {
        const data = await response.json();
        setMonitoringOptions(data);
      }
    } catch (err) {
      console.error('Error fetching monitoring reports:', err);
    } finally {
      setLoadingMonitoring(false);
    }
  };

  const handleMonitoringSelect = (monitoringId: string) => {
    const monitoring = monitoringOptions.find((m) => m.id === monitoringId);
    if (monitoring) {
      setSelectedMonitoring(monitoring);
      setLinkToMonitoring(true);
      form.setValue('sub_area_id', monitoring.sub_area_id);
      form.setValue('finding_id', monitoring.finding_id);
      // Reset cascading fields when linking to monitoring
      setFilteredActionTypes([]);
      setFilteredMaterials([]);
      setSelectedMaterialId('');
      form.setValue('action_type_id', '');
      form.setValue('material', '');
      form.setValue('dosage', '');
      form.setValue('unit_type_id', '');
      setSelectedMaterialData(null);
    } else {
      setSelectedMonitoring(null);
      setLinkToMonitoring(false);
      // When unlinking, fetch action types for the selected finding
      const findingId = form.watch('finding_id');
      if (findingId) {
        fetchActionTypes(findingId);
      }
    }
  };

  const fetchActionTypes = async (findingId: string) => {
    setLoadingActionTypes(true);
    try {
      const response = await fetch(`/api/recommend-materials?findingId=${findingId}&getActionTypes=true`);
      if (response.ok) {
        const data = await response.json();
        setFilteredActionTypes(data);
      }
    } catch (err) {
      console.error('Error fetching action types:', err);
    } finally {
      setLoadingActionTypes(false);
    }
  };

  const fetchMaterials = async (findingId: string, actionTypeId: string) => {
    setLoadingMaterials(true);
    try {
      const response = await fetch(`/api/recommend-materials?findingId=${findingId}&actionTypeId=${actionTypeId}&getMaterials=true`);
      if (response.ok) {
        const data = await response.json();
        setFilteredMaterials(data);
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
    } finally {
      setLoadingMaterials(false);
    }
  };

  const fetchDosageAndUnit = async (findingId: string, actionTypeId: string, materialId: string) => {
    try {
      const response = await fetch(`/api/recommend-materials?findingId=${findingId}&actionTypeId=${actionTypeId}&materialId=${materialId}&getDosage=true`);
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setSelectedMaterialData(data);
          // Pre-fill dosage and unit type, but allow user to edit
          form.setValue('dosage', data.dosage || '');
          form.setValue('unit_type_id', data.unit_type_id || '');
          // Store material name (not ID) since material is TEXT field
          const selectedMaterial = filteredMaterials.find(m => m.id === materialId);
          if (selectedMaterial) {
            form.setValue('material', selectedMaterial.description || selectedMaterial.name);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching dosage and unit:', err);
    }
  };

  const handleMaterialSelect = (materialId: string) => {
    setSelectedMaterialId(materialId);
    const findingId = form.watch('finding_id');
    const actionTypeId = form.watch('action_type_id');
    if (findingId && actionTypeId && materialId) {
      fetchDosageAndUnit(findingId, actionTypeId, materialId);
    }
  };

  const onSubmit = async (data: ActionFormData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Get area_report_id from area_id (simplified - in real app, you'd need to get report_areas)
      const areaReportResponse = await fetch(`/api/report-areas?areaId=${data.area_id}`);
      const areaReports = await areaReportResponse.json();
      const area_report_id = areaReports[0]?.id;

      if (!area_report_id) {
        throw new Error('לא נמצא שטח דוח עבור השטח שנבחר');
      }

      const payload = {
        ...data,
        area_report_id,
        monitoring_report_id: linkToMonitoring && selectedMonitoring ? selectedMonitoring.id : undefined,
        update_monitoring_status: linkToMonitoring && form.watch('update_monitoring_status') ? form.watch('update_monitoring_status') : undefined,
      };

      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בשמירת הדוח');
      }

      setSuccess(true);
      form.reset();
      setSelectedAreaId('');
      setMonitoringOptions([]);
      setSelectedMonitoring(null);
      setLinkToMonitoring(false);
      setTimeout(() => {
        setSuccess(false);
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>טופס פעולה חדש</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <AlertDescription>הדוח נשמר בהצלחה!</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="worker_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>עובד פעולה</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר עובד פעולה" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {actionWorkers.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id}>
                          {worker.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="area_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שטח</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedMonitoring(null);
                      setLinkToMonitoring(false);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר שטח" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {areas.map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedAreaId && (
              <div className="space-y-4 p-4 border rounded-lg">
                <FormField
                  control={form.control}
                  name="monitoring_report_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>קישור לדוח ניטור קיים (אופציונלי)</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const actualValue = value === '__new__' ? '' : value;
                          field.onChange(actualValue);
                          handleMonitoringSelect(actualValue);
                        }}
                        value={field.value || '__new__'}
                        disabled={loadingMonitoring}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={loadingMonitoring ? 'טוען...' : 'בחר דוח ניטור או צור פעולה חדשה'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__new__">צור פעולה חדשה (ללא קישור)</SelectItem>
                          {monitoringOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {linkToMonitoring && selectedMonitoring && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">דוח ניטור נבחר:</p>
                    <p className="text-sm">{selectedMonitoring.display}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      סטטוס נוכחי: {selectedMonitoring.status}
                    </p>
                  </div>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="sub_area_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תת-שטח</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={(!selectedAreaId || loadingSubAreas) || (linkToMonitoring && selectedMonitoring !== null)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue 
                          placeholder={
                            linkToMonitoring && selectedMonitoring 
                              ? 'נבחר מתוך דוח ניטור' 
                              : loadingSubAreas 
                              ? 'טוען תת-שטחים...' 
                              : selectedAreaId 
                              ? 'בחר תת-שטח' 
                              : 'בחר תחילה שטח'
                          } 
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subAreas.map((subArea) => (
                        <SelectItem key={subArea.id} value={subArea.id}>
                          {subArea.display || subArea.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="finding_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ממצא</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={linkToMonitoring && selectedMonitoring !== null}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר ממצא" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {findings.map((finding) => (
                        <SelectItem key={finding.id} value={finding.id}>
                          {finding.description || finding.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="material"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>חומר</FormLabel>
                  {filteredMaterials.length > 0 && !linkToMonitoring ? (
                    <Select 
                      onValueChange={(value) => {
                        handleMaterialSelect(value);
                      }} 
                      value={selectedMaterialId}
                      disabled={!form.watch('action_type_id') || loadingMaterials || linkToMonitoring}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !form.watch('action_type_id') 
                              ? 'בחר תחילה סוג פעולה' 
                              : loadingMaterials 
                              ? 'טוען...' 
                              : 'בחר חומר'
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredMaterials.map((material) => (
                          <SelectItem key={material.id} value={material.id}>
                            {material.description || material.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      {...field} 
                      placeholder="חומר שבו נעשה שימוש" 
                      disabled={linkToMonitoring}
                    />
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dosage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מינון</FormLabel>
                  <Input 
                    {...field} 
                    placeholder={selectedMaterialData?.dosage ? `מומלץ: ${selectedMaterialData.dosage}` : "מינון"} 
                    disabled={linkToMonitoring}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>יחידת מידה</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={linkToMonitoring}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          selectedMaterialData?.unit_type_id 
                            ? 'יחידת מידה מומלצת נבחרה' 
                            : 'בחר יחידת מידה'
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {unitTypes.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.description || unit.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="action_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג פעולה</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Reset material and dosage when action type changes
                      setSelectedMaterialId('');
                      form.setValue('material', '');
                      form.setValue('dosage', '');
                      form.setValue('unit_type_id', '');
                      setSelectedMaterialData(null);
                    }} 
                    value={field.value}
                    disabled={!form.watch('finding_id') || loadingActionTypes || linkToMonitoring}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          linkToMonitoring
                            ? 'נבחר מתוך דוח ניטור'
                            : !form.watch('finding_id') 
                            ? 'בחר תחילה ממצא' 
                            : loadingActionTypes 
                            ? 'טוען...' 
                            : filteredActionTypes.length > 0
                            ? 'בחר סוג פעולה'
                            : 'אין סוגי פעולה זמינים'
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredActionTypes.length > 0 ? (
                        filteredActionTypes.map((actionType) => (
                          <SelectItem key={actionType.id} value={actionType.id}>
                            {actionType.description || actionType.name}
                          </SelectItem>
                        ))
                      ) : (
                        actionTypes.map((actionType) => (
                          <SelectItem key={actionType.id} value={actionType.id}>
                            {actionType.description || actionType.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="action_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>זמן ביצוע הפעולה</FormLabel>
                  <Input
                    {...field}
                    type="datetime-local"
                    placeholder="זמן ביצוע"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סטטוס</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || 'planned'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סטטוס" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="planned">מתוכנן</SelectItem>
                      <SelectItem value="in_progress">בביצוע</SelectItem>
                      <SelectItem value="completed">הושלם</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {linkToMonitoring && selectedMonitoring && (
              <FormField
                control={form.control}
                name="update_monitoring_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>עדכן סטטוס דוח ניטור</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value === '__none__' ? '' : value);
                      }}
                      value={field.value || '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר סטטוס (אופציונלי)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">אל תעדכן</SelectItem>
                        <SelectItem value="reviewed">נבדק</SelectItem>
                        <SelectItem value="action-required">נדרשת פעולה</SelectItem>
                        <SelectItem value="completed">הושלם</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>הערות</FormLabel>
                  <Textarea {...field} placeholder="הערות נוספות" />
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'שומר...' : 'שמור דוח פעולה'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
