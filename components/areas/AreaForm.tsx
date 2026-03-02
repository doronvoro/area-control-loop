'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { showToast } from '@/lib/toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SIZE_UNIT_TYPES } from '@/types/database';
import { createRectangleGeometry, getBounds } from '@/components/indoor-designer/geometry/geometry-utils';
import { DimensionInput } from '@/components/indoor-designer/shared/DimensionInput';
import type { GeoJSONPolygon } from '@/components/map/types';

const areaSchema = z.object({
  name: z.string().min(1, 'שם השטח נדרש'),
  description: z.string().optional(),
  customer_id: z.string().optional(),
  crop_id: z.string().optional(),
  size: z.string().optional(),
  size_unit_type: z.string().optional(),
});

type AreaFormData = z.infer<typeof areaSchema>;

interface Customer {
  id: string;
  name: string;
}

interface Crop {
  id: string;
  name: string;
  description?: string | null;
}

interface AreaFormProps {
  area?: {
    id: string;
    name: string;
    description?: string | null;
    crop_id?: string | null;
    size?: number | null;
    size_unit_type?: string | null;
    geometry?: GeoJSONPolygon | null;
  } | null;
  customerId?: string | null;
  customers?: Customer[];
  crops?: Crop[];
  isAdmin?: boolean;
  areaType?: 'indoor' | 'outdoor';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AreaForm({ area, customerId, customers = [], crops = [], isAdmin = false, areaType, open, onOpenChange, onSuccess }: AreaFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isIndoor = areaType === 'indoor';

  // Show customer selector for admins when creating new area
  const showCustomerSelector = isAdmin && !area && customers.length > 0;

  // Extract width/height from existing geometry for editing
  const getExistingDimensions = (): { width: number; height: number } => {
    const geom = (area as any)?.geometry as GeoJSONPolygon | null;
    if (!geom) return { width: 0, height: 0 };
    const bounds = getBounds(geom);
    const w = Math.round((bounds.maxX - bounds.minX) * 10) / 10;
    const h = Math.round((bounds.maxY - bounds.minY) * 10) / 10;
    return { width: w > 0 ? w : 0, height: h > 0 ? h : 0 };
  };

  // Numeric dimension state for DimensionInput
  const [dimWidth, setDimWidth] = useState(0);
  const [dimHeight, setDimHeight] = useState(0);

  const handleDimensionsChange = (w: number, h: number) => {
    setDimWidth(w);
    setDimHeight(h);
  };

  const form = useForm<AreaFormData>({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      name: area?.name || '',
      description: area?.description || '',
      customer_id: customerId || '',
      crop_id: area?.crop_id || '',
      size: area?.size?.toString() || '',
      size_unit_type: area?.size_unit_type || 'dunam',
    },
  });

  // Reset form when dialog opens/closes or area changes
  useEffect(() => {
    if (open) {
      // Default 10 dunam (100m × 100m) for new indoor areas
      const dims = area ? getExistingDimensions() : (isIndoor ? { width: 100, height: 100 } : { width: 0, height: 0 });
      setDimWidth(dims.width);
      setDimHeight(dims.height);
      form.reset({
        name: area?.name || '',
        description: area?.description || '',
        customer_id: customerId || '',
        crop_id: area?.crop_id || '',
        size: area?.size?.toString() || '',
        size_unit_type: area?.size_unit_type || 'dunam',
      });
    }
  }, [open, area, customerId, form]);

  const onSubmit = async (data: AreaFormData) => {
    setLoading(true);
    setError(null);

    // For admins creating new areas, require customer selection
    if (showCustomerSelector && !data.customer_id) {
      setError('יש לבחור לקוח');
      setLoading(false);
      return;
    }

    try {
      const method = area ? 'PUT' : 'POST';
      const selectedCustomerId = data.customer_id || customerId;

      // For indoor areas, compute geometry and size from dimensions
      const geometry = isIndoor && dimWidth > 0 && dimHeight > 0
        ? createRectangleGeometry(0, 0, dimWidth, dimHeight)
        : undefined;

      const size = isIndoor
        ? (dimWidth > 0 && dimHeight > 0 ? Math.round((dimWidth * dimHeight) / 1000 * 100) / 100 : null)
        : (data.size ? parseFloat(data.size) : null);
      const sizeUnitType = isIndoor ? 'dunam' : (data.size_unit_type || null);

      const response = await fetch('/api/areas', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(area ? { id: area.id } : {}),
          name: data.name,
          description: data.description,
          crop_id: data.crop_id || null,
          size: size || null,
          size_unit_type: sizeUnitType,
          ...(selectedCustomerId && !area ? { customer_id: selectedCustomerId } : {}),
          ...(areaType ? { area_type: areaType } : {}),
          ...(geometry ? { geometry } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || (area ? 'שגיאה בעדכון השטח' : 'שגיאה ביצירת השטח'));
      }

      form.reset();
      showToast.success(area ? 'השטח עודכן בהצלחה' : 'השטח נוצר בהצלחה');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      const errorMessage = err.message || (area ? 'שגיאה בעדכון השטח' : 'שגיאה ביצירת השטח');
      setError(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{area ? 'עריכת שטח' : 'יצירת שטח חדש'}</DialogTitle>
          <DialogDescription>{area ? 'עדכן את פרטי השטח' : 'הזן פרטי שטח חדש'}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {showCustomerSelector && (
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>לקוח</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
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
            )}

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם השטח</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="שם השטח" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תיאור</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="תיאור השטח (אופציונלי)"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isIndoor ? (
              <DimensionInput
                width={dimWidth}
                height={dimHeight}
                onDimensionsChange={handleDimensionsChange}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>גודל</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="גודל השטח (אופציונלי)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="size_unit_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>יחידת מידה</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || 'dunam'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר יחידה" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SIZE_UNIT_TYPES.map((unitType) => (
                            <SelectItem key={unitType.name} value={unitType.name}>
                              {unitType.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {crops.length > 0 && (
              <FormField
                control={form.control}
                name="crop_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>גידול</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === '__none__' ? '' : value)}
                      value={field.value || '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר גידול (אופציונלי)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">ללא גידול</SelectItem>
                        {crops.map((crop) => (
                          <SelectItem key={crop.id} value={crop.id}>
                            {crop.description || crop.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (area ? 'שומר...' : 'יוצר...') : (area ? 'שמור שינויים' : 'צור שטח')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
