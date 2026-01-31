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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

const monitoringSchema = z.object({
  customer_id: z.string().min(1, 'נדרש לבחור לקוח'),
  inspector_id: z.string().min(1, 'נדרש לבחור פקח'),
  area_id: z.string().min(1, 'נדרש לבחור אזור'),
  sub_area_id: z.string().min(1, 'נדרש לבחור תת-שטח'),
  finding_id: z.string().min(1, 'נדרש לבחור ממצא'),
  recommend_action_type_id: z.string().optional(),
  recommend_material_id: z.string().optional(),
  recommend_dosage: z.string().optional(),
  recommend_unit_type_id: z.string().optional(),
});

type MonitoringFormData = z.infer<typeof monitoringSchema>;

interface MonitoringFormProps {
  customers: any[];
  findings: any[];
  unitTypes: any[];
}

export function MonitoringForm({
  customers,
  findings,
  unitTypes,
}: MonitoringFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Dynamic data states
  const [inspectors, setInspectors] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [subAreas, setSubAreas] = useState<any[]>([]);
  const [actionTypes, setActionTypes] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);

  // Loading states
  const [loadingInspectors, setLoadingInspectors] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingSubAreas, setLoadingSubAreas] = useState(false);
  const [loadingActionTypes, setLoadingActionTypes] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);

  // Selected crop (from area/sub-area)
  const [selectedCropId, setSelectedCropId] = useState<string | null>(null);

  // Auto-filled recommendation data
  const [recommendedDosage, setRecommendedDosage] = useState<string>('');
  const [recommendedUnitTypeId, setRecommendedUnitTypeId] = useState<string>('');

  const form = useForm<MonitoringFormData>({
    resolver: zodResolver(monitoringSchema),
    defaultValues: {
      customer_id: '',
      inspector_id: '',
      area_id: '',
      sub_area_id: '',
      finding_id: '',
      recommend_action_type_id: '',
      recommend_material_id: '',
      recommend_dosage: '',
      recommend_unit_type_id: '',
    },
  });

  const watchedCustomerId = form.watch('customer_id');
  const watchedAreaId = form.watch('area_id');
  const watchedSubAreaId = form.watch('sub_area_id');
  const watchedFindingId = form.watch('finding_id');
  const watchedActionTypeId = form.watch('recommend_action_type_id');
  const watchedMaterialId = form.watch('recommend_material_id');

  // Fetch inspectors and areas when customer changes
  useEffect(() => {
    if (watchedCustomerId) {
      fetchInspectorsAndAreas(watchedCustomerId);
      // Reset dependent fields
      form.setValue('inspector_id', '');
      form.setValue('area_id', '');
      form.setValue('sub_area_id', '');
      setSubAreas([]);
      setSelectedCropId(null);
    } else {
      setInspectors([]);
      setAreas([]);
    }
  }, [watchedCustomerId]);

  // Fetch sub-areas when area changes
  useEffect(() => {
    if (watchedAreaId) {
      fetchSubAreas(watchedAreaId);
      // Reset dependent fields
      form.setValue('sub_area_id', '');

      // Get crop from area
      const selectedArea = areas.find(a => a.id === watchedAreaId);
      if (selectedArea?.crop_id) {
        setSelectedCropId(selectedArea.crop_id);
      }
    } else {
      setSubAreas([]);
      setSelectedCropId(null);
    }
  }, [watchedAreaId, areas]);

  // Update crop when sub-area changes (sub-area can override area's crop)
  useEffect(() => {
    if (watchedSubAreaId) {
      const selectedSubArea = subAreas.find(sa => sa.id === watchedSubAreaId);
      if (selectedSubArea?.crop_id) {
        setSelectedCropId(selectedSubArea.crop_id);
      } else {
        // Fall back to area's crop
        const selectedArea = areas.find(a => a.id === watchedAreaId);
        if (selectedArea?.crop_id) {
          setSelectedCropId(selectedArea.crop_id);
        }
      }
    }
  }, [watchedSubAreaId, subAreas, watchedAreaId, areas]);

  // Fetch action types when finding and crop are selected
  useEffect(() => {
    if (watchedFindingId && selectedCropId) {
      fetchActionTypes(selectedCropId);
      // Reset dependent fields
      form.setValue('recommend_action_type_id', '');
      form.setValue('recommend_material_id', '');
      form.setValue('recommend_dosage', '');
      form.setValue('recommend_unit_type_id', '');
      setMaterials([]);
      setRecommendedDosage('');
      setRecommendedUnitTypeId('');
    } else {
      setActionTypes([]);
    }
  }, [watchedFindingId, selectedCropId]);

  // Fetch materials when action type changes
  useEffect(() => {
    if (selectedCropId && watchedActionTypeId) {
      fetchMaterials(selectedCropId, watchedActionTypeId);
      // Reset dependent fields
      form.setValue('recommend_material_id', '');
      form.setValue('recommend_dosage', '');
      form.setValue('recommend_unit_type_id', '');
      setRecommendedDosage('');
      setRecommendedUnitTypeId('');
    } else {
      setMaterials([]);
    }
  }, [watchedActionTypeId, selectedCropId]);

  // Fetch dosage when material changes
  useEffect(() => {
    if (selectedCropId && watchedActionTypeId && watchedMaterialId) {
      fetchDosage(selectedCropId, watchedActionTypeId, watchedMaterialId);
    }
  }, [watchedMaterialId, selectedCropId, watchedActionTypeId]);

  const fetchInspectorsAndAreas = async (customerId: string) => {
    setLoadingInspectors(true);
    setLoadingAreas(true);
    try {
      const [inspectorsRes, areasRes] = await Promise.all([
        fetch(`/api/workers?customerId=${customerId}&type=inspector`),
        fetch(`/api/customer-areas?customerId=${customerId}`),
      ]);

      if (inspectorsRes.ok) {
        const data = await inspectorsRes.json();
        setInspectors(data);
      }
      if (areasRes.ok) {
        const data = await areasRes.json();
        // customer-areas returns { customer_id, area_id, areas: {...} }
        const areasList = data.map((ca: any) => ca.areas || ca).filter(Boolean);
        setAreas(areasList);
      }
    } catch (err) {
      console.error('Error fetching inspectors/areas:', err);
    } finally {
      setLoadingInspectors(false);
      setLoadingAreas(false);
    }
  };

  const fetchSubAreas = async (areaId: string) => {
    setLoadingSubAreas(true);
    try {
      const res = await fetch(`/api/sub-areas?areaId=${areaId}`);
      if (res.ok) {
        const data = await res.json();
        setSubAreas(data);
      }
    } catch (err) {
      console.error('Error fetching sub-areas:', err);
    } finally {
      setLoadingSubAreas(false);
    }
  };

  const fetchActionTypes = async (cropId: string) => {
    setLoadingActionTypes(true);
    try {
      const res = await fetch(`/api/cascade?type=action_types&cropId=${cropId}`);
      if (res.ok) {
        const data = await res.json();
        setActionTypes(data);
      }
    } catch (err) {
      console.error('Error fetching action types:', err);
    } finally {
      setLoadingActionTypes(false);
    }
  };

  const fetchMaterials = async (cropId: string, actionTypeId: string) => {
    setLoadingMaterials(true);
    try {
      const res = await fetch(`/api/cascade?type=materials&cropId=${cropId}&actionTypeId=${actionTypeId}`);
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
      }
    } catch (err) {
      console.error('Error fetching materials:', err);
    } finally {
      setLoadingMaterials(false);
    }
  };

  const fetchDosage = async (cropId: string, actionTypeId: string, materialId: string) => {
    try {
      const res = await fetch(`/api/cascade?type=dosage&cropId=${cropId}&actionTypeId=${actionTypeId}&materialId=${materialId}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setRecommendedDosage(data.dosage?.toString() || '');
          setRecommendedUnitTypeId(data.unit_type_id || '');
          form.setValue('recommend_dosage', data.dosage?.toString() || '');
          form.setValue('recommend_unit_type_id', data.unit_type_id || '');
        }
      }
    } catch (err) {
      console.error('Error fetching dosage:', err);
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
      setInspectors([]);
      setAreas([]);
      setSubAreas([]);
      setActionTypes([]);
      setMaterials([]);
      setSelectedCropId(null);
      setRecommendedDosage('');
      setRecommendedUnitTypeId('');

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

  const LoadingSpinner = () => <Loader2 className="h-4 w-4 animate-spin inline ms-2" />;

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader className="border-b bg-muted/50">
        <CardTitle className="text-2xl">טופס ניטור חדש</CardTitle>
        <CardDescription>מלא את פרטי הניטור עבור האזור הנבחר</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="border-green-500 bg-green-50 text-green-700">
                <AlertDescription>הדוח נשמר בהצלחה!</AlertDescription>
              </Alert>
            )}

            {/* Section 1: Customer & Inspector Selection */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-semibold text-lg border-b pb-2">פרטי לקוח ופקח</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">לקוח *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="בחר לקוח" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
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
                  name="inspector_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        פקח *
                        {loadingInspectors && <LoadingSpinner />}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedCustomerId || loadingInspectors}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={
                              !watchedCustomerId ? 'בחר לקוח תחילה' : 'בחר פקח'
                            } />
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
              </div>
            </div>

            {/* Section 2: Location Selection */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-semibold text-lg border-b pb-2">מיקום</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="area_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        אזור *
                        {loadingAreas && <LoadingSpinner />}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedCustomerId || loadingAreas}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={
                              !watchedCustomerId ? 'בחר לקוח תחילה' : 'בחר אזור'
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {areas.map((area) => (
                            <SelectItem key={area.id} value={area.id}>
                              {area.name}
                              {area.crops?.name && ` (${area.crops.description || area.crops.name})`}
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
                      <FormLabel className="font-medium">
                        תת-שטח *
                        {loadingSubAreas && <LoadingSpinner />}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedAreaId || loadingSubAreas}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={
                              !watchedAreaId ? 'בחר אזור תחילה' : 'בחר תת-שטח'
                            } />
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
              </div>
            </div>

            {/* Section 3: Finding */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-semibold text-lg border-b pb-2">ממצא</h3>
              <FormField
                control={form.control}
                name="finding_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">ממצא *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
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
            </div>

            {/* Section 4: Recommendations (cascading) */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <h3 className="font-semibold text-lg border-b pb-2">המלצות טיפול</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recommend_action_type_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        סוג פעולה
                        {loadingActionTypes && <LoadingSpinner />}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedFindingId || !selectedCropId || loadingActionTypes}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={
                              !watchedFindingId
                                ? 'בחר ממצא תחילה'
                                : !selectedCropId
                                ? 'אין גידול מוגדר לאזור'
                                : 'בחר סוג פעולה'
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {actionTypes.map((actionType) => (
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

                <FormField
                  control={form.control}
                  name="recommend_material_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        חומר מומלץ
                        {loadingMaterials && <LoadingSpinner />}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedActionTypeId || loadingMaterials}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder={
                              !watchedActionTypeId ? 'בחר סוג פעולה תחילה' : 'בחר חומר'
                            } />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {materials.map((material) => (
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
                      <FormLabel className="font-medium">מינון</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ''}
                          placeholder={recommendedDosage ? `מומלץ: ${recommendedDosage}` : 'הזן מינון'}
                          className="h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recommend_unit_type_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">יחידת מידה</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="בחר יחידת מידה" />
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
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-lg font-medium"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin me-2" />
                  שומר...
                </>
              ) : (
                'שמור דוח ניטור'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
