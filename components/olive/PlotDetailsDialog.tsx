'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { showToast } from '@/lib/toast';
import {
  PLOT_TYPE_OPTIONS,
  HARVESTER_OPTIONS,
  WATER_TYPE_OPTIONS,
} from '@/types/database';
import type { ApiPlot } from '@/lib/olive/adapt';

/**
 * Edit the olive-specific attributes of a plot.
 *
 * Only olive_plot_details is editable here. The plot's own columns — name,
 * variety, planting date, size — live on `areas` and are managed on /areas,
 * so there is exactly one place that owns each field.
 */

const NONE = '__none__'; // Radix Select rejects '' as an item value

const detailsSchema = z.object({
  grower_name: z.string().optional(),
  region: z.string().optional(),
  plant_year_label: z.string().optional(),
  plot_type: z.string().optional(),
  harvester: z.string().optional(),
  water_type: z.string().optional(),
  takt_count: z
    .string()
    .optional()
    .refine((v) => !v || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 10), {
      message: 'מספר בין 1 ל-10',
    }),
});

type DetailsFormData = z.infer<typeof detailsSchema>;

function toFormValue(value: string | null | undefined): string {
  return value ?? NONE;
}

function fromFormValue(value: string | undefined): string | null {
  return !value || value === NONE ? null : value;
}

export function PlotDetailsDialog({
  plot,
  open,
  onOpenChange,
  onSaved,
}: {
  plot: ApiPlot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<DetailsFormData>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      grower_name: '',
      region: '',
      plant_year_label: '',
      plot_type: NONE,
      harvester: NONE,
      water_type: NONE,
      takt_count: '',
    },
  });

  // Refill whenever a different plot is opened.
  useEffect(() => {
    if (!plot || !open) return;
    const d = plot.details;
    form.reset({
      grower_name: d?.grower_name ?? '',
      region: d?.region ?? '',
      plant_year_label: d?.plant_year_label ?? '',
      plot_type: toFormValue(d?.plot_type),
      harvester: toFormValue(d?.harvester),
      water_type: toFormValue(d?.water_type),
      takt_count: d?.takt_count != null ? String(d.takt_count) : '',
    });
    setError(null);
  }, [plot, open, form]);

  const onSubmit = async (values: DetailsFormData) => {
    if (!plot) return;
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/olive/plots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_id: plot.id,
          grower_name: values.grower_name || null,
          region: values.region || null,
          plant_year_label: values.plant_year_label || null,
          plot_type: fromFormValue(values.plot_type),
          harvester: fromFormValue(values.harvester),
          water_type: fromFormValue(values.water_type),
          takt_count: values.takt_count ? Number(values.takt_count) : null,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה בשמירת פרטי החלקה');
      }

      showToast.success('פרטי החלקה נשמרו');
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const selects: {
    name: 'plot_type' | 'harvester' | 'water_type';
    label: string;
    options: { value: string; label: string }[];
  }[] = [
    { name: 'plot_type', label: 'סוג מגדל', options: PLOT_TYPE_OPTIONS },
    { name: 'harvester', label: 'סוג מוסקת', options: HARVESTER_OPTIONS },
    { name: 'water_type', label: 'סוג מים', options: WATER_TYPE_OPTIONS },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>עריכת פרטי חלקה</DialogTitle>
          <DialogDescription>
            {plot?.name}
            {' — '}שם, זן, שנת נטיעה וגודל נערכים במסך השטחים.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="grower_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם מגדל</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>גוש</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selects.map((s) => (
                <FormField
                  key={s.name}
                  control={form.control}
                  name={s.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{s.label}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || NONE}>
                        <FormControl>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value={NONE}>—</SelectItem>
                          {s.options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}

              <FormField
                control={form.control}
                name="plant_year_label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שנת נטיעה (תווית)</FormLabel>
                    <FormControl>
                      <Input placeholder="2006/7" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="takt_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מספר טאקטים</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                ביטול
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="ml-2 size-4 animate-spin" />}
                שמור
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
