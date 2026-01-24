'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const monitoringSchema = z.object({
  inspector_id: z.string().min(1, 'נדרש לבחור פקח'),
  area_report_id: z.string().min(1, 'נדרש לבחור שטח דוח'),
  sub_area_id: z.string().min(1, 'נדרש לבחור תת-שטח'),
  finding_id: z.string().min(1, 'נדרש לבחור ממצא'),
  recommend_material: z.string().optional(),
  recommend_dosage: z.string().optional(),
  recommend_unit_type_id: z.string().optional(),
  recommend_action_type_id: z.string().optional(),
  status: z.string().optional(),
});

type MonitoringFormData = z.infer<typeof monitoringSchema>;

interface MonitoringFormProps {
  inspectors: any[];
  areas: any[];
  reportAreas: any[];
  findings: any[];
  actionTypes: any[];
  unitTypes: any[];
}

export function MonitoringForm({
  inspectors,
  areas,
  reportAreas,
  findings,
  actionTypes,
  unitTypes,
}: MonitoringFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedAreaReportId, setSelectedAreaReportId] = useState<string>('');
  const [subAreas, setSubAreas] = useState<any[]>([]);
  const [loadingSubAreas, setLoadingSubAreas] = useState(false);
  const [filteredActionTypes, setFilteredActionTypes] = useState<any[]>([]);
  const [filteredMaterials, setFilteredMaterials] = useState<any[]>([]);
  const [loadingActionTypes, setLoadingActionTypes] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [selectedMaterialData, setSelectedMaterialData] = useState<{ dosage: string; unit_type_id: string } | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const router = useRouter();

  const form = useForm<MonitoringFormData>({
    resolver: zodResolver(monitoringSchema),
    defaultValues: {
      inspector_id: '',
      area_report_id: '',
      sub_area_id: '',
      finding_id: '',
      recommend_material: '',
      recommend_dosage: '',
      recommend_unit_type_id: '',
      recommend_action_type_id: '',
      status: 'pending',
    },
  });

  // Fetch sub-areas when area_report is selected
  useEffect(() => {
    const areaReportId = form.watch('area_report_id');
    if (areaReportId && areaReportId !== selectedAreaReportId) {
      setSelectedAreaReportId(areaReportId);
      fetchSubAreas(areaReportId);
    }
  }, [form.watch('area_report_id')]);

  // Fetch action types when finding is selected
  useEffect(() => {
    const findingId = form.watch('finding_id');
    if (findingId) {
      fetchActionTypes(findingId);
    } else {
      setFilteredActionTypes([]);
      form.setValue('recommend_action_type_id', '');
      setSelectedMaterialId('');
      form.setValue('recommend_material', '');
      form.setValue('recommend_dosage', '');
      form.setValue('recommend_unit_type_id', '');
      setSelectedMaterialData(null);
    }
  }, [form.watch('finding_id')]);

  // Fetch materials when action type is selected
  useEffect(() => {
    const findingId = form.watch('finding_id');
    const actionTypeId = form.watch('recommend_action_type_id');
    if (findingId && actionTypeId) {
      fetchMaterials(findingId, actionTypeId);
    } else {
      setFilteredMaterials([]);
      setSelectedMaterialId('');
      form.setValue('recommend_material', '');
      form.setValue('recommend_dosage', '');
      form.setValue('recommend_unit_type_id', '');
      setSelectedMaterialData(null);
    }
  }, [form.watch('recommend_action_type_id')]);

  // Fetch dosage and unit type when material is selected
  useEffect(() => {
    const findingId = form.watch('finding_id');
    const actionTypeId = form.watch('recommend_action_type_id');
    if (findingId && actionTypeId && selectedMaterialId) {
      fetchDosageAndUnit(findingId, actionTypeId, selectedMaterialId);
    } else {
      setSelectedMaterialData(null);
    }
  }, [selectedMaterialId]);

  const fetchSubAreas = async (areaReportId: string) => {
    setLoadingSubAreas(true);
    try {
      // Get area_id from report_area
      const reportAreaRes = await fetch(`/api/report-areas?id=${areaReportId}`);
      if (reportAreaRes.ok) {
        const reportAreaData = await reportAreaRes.json();
        const reportArea = Array.isArray(reportAreaData) ? reportAreaData[0] : reportAreaData;
        if (reportArea?.area_id) {
          const subAreasRes = await fetch(`/api/sub-areas?areaId=${reportArea.area_id}`);
          if (subAreasRes.ok) {
            const data = await subAreasRes.json();
            setSubAreas(data);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching sub-areas:', err);
    } finally {
      setLoadingSubAreas(false);
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
          form.setValue('recommend_dosage', data.dosage || '');
          form.setValue('recommend_unit_type_id', data.unit_type_id || '');
          // Store material name (not ID) since recommend_material is TEXT field
          const selectedMaterial = filteredMaterials.find(m => m.id === materialId);
          if (selectedMaterial) {
            form.setValue('recommend_material', selectedMaterial.description || selectedMaterial.name);
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
    const actionTypeId = form.watch('recommend_action_type_id');
    if (findingId && actionTypeId && materialId) {
      fetchDosageAndUnit(findingId, actionTypeId, materialId);
    }
  };

  const onSubmit = async (data: MonitoringFormData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בשמירת הדוח');
      }

      setSuccess(true);
      form.reset();
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
        <CardTitle>טופס ניטור חדש</CardTitle>
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
              name="inspector_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>פקח</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר פקח" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {inspectors.map((inspector) => (
                        <SelectItem key={inspector.id} value={inspector.id}>
                          {inspector.name}
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
              name="area_report_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>אזור דוח</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר אזור דוח" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(reportAreas as any[]).map((reportArea: any) => (
                        <SelectItem key={reportArea.id} value={reportArea.id}>
                          {reportArea.name}
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
              name="sub_area_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תת-שטח</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!selectedAreaReportId || loadingSubAreas}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingSubAreas ? 'טוען תת-שטחים...' : selectedAreaReportId ? 'בחר תת-שטח' : 'בחר תחילה שטח דוח'} />
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
              name="recommend_material"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>חומר מומלץ</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      handleMaterialSelect(value);
                    }} 
                    value={selectedMaterialId}
                    disabled={!form.watch('recommend_action_type_id') || loadingMaterials}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !form.watch('recommend_action_type_id') 
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recommend_dosage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מינון מומלץ</FormLabel>
                  <Input 
                    {...field}
                    value={field.value || ''}
                    placeholder={selectedMaterialData?.dosage ? `מומלץ: ${selectedMaterialData.dosage}` : "מינון מומלץ"} 
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recommend_unit_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>יחידת מידה</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
              name="recommend_action_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג פעולה מומלץ</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Reset material and dosage when action type changes
                      setSelectedMaterialId('');
                      form.setValue('recommend_material', '');
                      form.setValue('recommend_dosage', '');
                      form.setValue('recommend_unit_type_id', '');
                      setSelectedMaterialData(null);
                    }} 
                    value={field.value}
                    disabled={!form.watch('finding_id') || loadingActionTypes}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={
                          !form.watch('finding_id') 
                            ? 'בחר תחילה ממצא' 
                            : loadingActionTypes 
                            ? 'טוען...' 
                            : 'בחר סוג פעולה'
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredActionTypes.map((actionType) => (
                        <SelectItem key={actionType.id} value={actionType.id}>
                          {actionType.description || actionType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'שומר...' : 'שמור דוח ניטור'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
