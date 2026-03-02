'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/lib/toast';
import { SIZE_UNIT_TYPES } from '@/types/database';
import { DimensionInput } from '@/components/indoor-designer/shared/DimensionInput';
import { createRectangleGeometry, getBounds } from '@/components/indoor-designer/geometry/geometry-utils';
import type { GeoJSONPolygon } from '@/components/map/types';

const subAreaSchema = z.object({
  name: z.string().min(1, 'שם התת-שטח נדרש'),
  variety: z.string().optional(),
  rows: z.string().optional(),
  parent_sub_area_id: z.string().optional(),
  level: z.number().min(1).optional(),
  crop_id: z.string().optional(),
  size: z.string().optional(),
  size_unit_type: z.string().optional(),
});

type SubAreaFormData = z.infer<typeof subAreaSchema>;

interface Crop {
  id: string;
  name: string;
  description?: string | null;
}

interface SubAreaFormProps {
  subArea?: {
    id: string;
    name: string;
    variety?: string | null;
    rows?: string | null;
    parent_sub_area_id?: string | null;
    level?: number;
    area_id: string;
    crop_id?: string | null;
    size?: number | null;
    size_unit_type?: string | null;
    geometry?: GeoJSONPolygon | null;
  } | null;
  areaId: string;
  subAreas?: Array<{ id: string; name: string; display?: string }>;
  crops?: Crop[];
  areaType?: 'indoor' | 'outdoor';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  createSubArea?: { parentId?: string };
}

export function SubAreaForm({
  subArea,
  areaId,
  subAreas = [],
  crops = [],
  areaType,
  open,
  onOpenChange,
  onSuccess,
  createSubArea,
}: SubAreaFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isIndoor = areaType === 'indoor';

  // Extract width/height from existing geometry for editing
  const getExistingDimensions = (): { width: number; height: number } => {
    const geom = subArea?.geometry as GeoJSONPolygon | null;
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

  const form = useForm<SubAreaFormData>({
    resolver: zodResolver(subAreaSchema),
    defaultValues: {
      name: subArea?.name || '',
      variety: subArea?.variety || '',
      rows: subArea?.rows || '',
      parent_sub_area_id: subArea?.parent_sub_area_id || createSubArea?.parentId || '',
      level: subArea?.level || 1,
      crop_id: subArea?.crop_id || '',
      size: subArea?.size?.toString() || '',
      size_unit_type: subArea?.size_unit_type || 'dunam',
    },
  });

  // Reset dimensions when dialog opens
  useEffect(() => {
    if (open) {
      const dims = subArea ? getExistingDimensions() : { width: 0, height: 0 };
      setDimWidth(dims.width);
      setDimHeight(dims.height);
    }
  }, [open, subArea]);

  // Filter out current sub-area and its children from parent options
  const parentOptions = subAreas.filter(
    (sa) => sa.id !== subArea?.id && sa.id !== subArea?.parent_sub_area_id
  );

  const onSubmit = async (data: SubAreaFormData) => {
    setLoading(true);
    setError(null);

    try {
      const method = subArea ? 'PUT' : 'POST';

      // For indoor sub-areas, compute geometry and size from dimensions
      const geometry = isIndoor && dimWidth > 0 && dimHeight > 0
        ? createRectangleGeometry(0, 0, dimWidth, dimHeight)
        : undefined;

      const size = isIndoor
        ? (dimWidth > 0 && dimHeight > 0 ? Math.round((dimWidth * dimHeight) / 1000 * 100) / 100 : null)
        : (data.size ? parseFloat(data.size) : null);
      const sizeUnitType = isIndoor ? 'dunam' : (data.size_unit_type || null);

      const response = await fetch('/api/sub-areas', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(subArea ? { id: subArea.id } : { area_id: areaId }),
          ...data,
          parent_sub_area_id: data.parent_sub_area_id || null,
          crop_id: data.crop_id || null,
          size,
          size_unit_type: sizeUnitType,
          ...(geometry ? { geometry } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || (subArea ? 'שגיאה בעדכון התת-שטח' : 'שגיאה ביצירת התת-שטח'));
      }

      form.reset();
      showToast.success(subArea ? 'התת-שטח עודכן בהצלחה' : 'התת-שטח נוצר בהצלחה');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      const errorMessage = err.message || (subArea ? 'שגיאה בעדכון התת-שטח' : 'שגיאה ביצירת התת-שטח');
      setError(errorMessage);
      showToast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{subArea ? 'עריכת תת-שטח' : 'יצירת תת-שטח חדש'}</DialogTitle>
          <DialogDescription>{subArea ? 'עדכן את פרטי התת-שטח' : 'הזן פרטי תת-שטח חדש'}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם התת-שטח</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="שם התת-שטח" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="variety"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>זן</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="זן (אופציונלי)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rows"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שורות</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="שורות (אופציונלי)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                          placeholder="גודל התת-שטח (אופציונלי)"
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

            {parentOptions.length > 0 && (
              <FormField
                control={form.control}
                name="parent_sub_area_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תת-שטח אב</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value === '__none__' ? '' : value);
                      }}
                      value={field.value || '__none__'}
                      disabled={!!subArea} // Disable when editing
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר תת-שטח אב (אופציונלי)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">ללא תת-שטח אב</SelectItem>
                        {parentOptions.map((sa) => (
                          <SelectItem key={sa.id} value={sa.id}>
                            {sa.display || sa.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {crops.length > 0 && (
              <FormField
                control={form.control}
                name="crop_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>גידול (דורס את גידול השטח)</FormLabel>
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
                        <SelectItem value="__none__">ללא (יורש מהשטח)</SelectItem>
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
                {loading ? (subArea ? 'שומר...' : 'יוצר...') : (subArea ? 'שמור שינויים' : 'צור תת-שטח')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
