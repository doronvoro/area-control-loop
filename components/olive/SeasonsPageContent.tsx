'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useApiData } from '@/hooks/useApiData';
import { showToast } from '@/lib/toast';
import { SEASON_YEAR_TYPE_LABELS, SeasonYearType } from '@/types/database';

/**
 * Harvest seasons (מחזור מסיק).
 *
 * Replaces the prototype's two loose global fields. year_type is the olive's
 * natural alternate-bearing cycle — ON is a heavy year, OFF a light one — and
 * it drives what the grower expects before a single measurement is taken.
 *
 * Exactly one season is active; activating one deactivates the rest server-side.
 */

const NONE = '__none__';

const seasonSchema = z
  .object({
    name: z.string().min(1, 'נדרש שם עונה'),
    year_type: z.string().optional(),
    starts_on: z.string().min(1, 'נדרש תאריך התחלה'),
    ends_on: z.string().min(1, 'נדרש תאריך סיום'),
    is_active: z.boolean().optional(),
  })
  .refine((v) => !v.starts_on || !v.ends_on || v.ends_on >= v.starts_on, {
    message: 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה',
    path: ['ends_on'],
  });

type SeasonFormData = z.infer<typeof seasonSchema>;

interface Season {
  id: string;
  name: string;
  year_type: string | null;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
}

export function SeasonsPageContent() {
  const { data: seasons, loading, error: fetchError, refetch } = useApiData<Season[]>('/api/olive/seasons');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const error = mutationError || fetchError;

  const form = useForm<SeasonFormData>({
    resolver: zodResolver(seasonSchema),
    defaultValues: { name: '', year_type: NONE, starts_on: '', ends_on: '', is_active: false },
  });

  const openDialog = (season?: Season) => {
    setMutationError(null);
    if (season) {
      setEditing(season);
      form.reset({
        name: season.name,
        year_type: season.year_type ?? NONE,
        starts_on: String(season.starts_on).slice(0, 10),
        ends_on: String(season.ends_on).slice(0, 10),
        is_active: season.is_active,
      });
    } else {
      setEditing(null);
      form.reset({ name: '', year_type: NONE, starts_on: '', ends_on: '', is_active: false });
    }
    setDialogOpen(true);
  };

  const onSubmit = async (values: SeasonFormData) => {
    setMutationError(null);
    try {
      setSaving(true);
      const response = await fetch('/api/olive/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          name: values.name,
          year_type: values.year_type === NONE ? null : values.year_type,
          starts_on: values.starts_on,
          ends_on: values.ends_on,
          is_active: Boolean(values.is_active),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'שגיאה בשמירת העונה');
      }
      showToast.success(editing ? 'העונה עודכנה' : 'העונה נוצרה');
      setDialogOpen(false);
      setEditing(null);
      refetch();
    } catch (err: any) {
      setMutationError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="button" onClick={() => openDialog()}>
          <Plus className="ml-2 size-4" />
          עונה חדשה
        </Button>
      </div>

      <section className="olive-card overflow-hidden">
        {!seasons || seasons.length === 0 ? (
          <p className="olive-muted p-6 text-center text-sm">
            טרם הוגדרו עונות. הערכות יבול מקושרות לעונה, ולכן יש להגדיר אחת כדי להזין אותן.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="p-2 text-start">שם</th>
                  <th className="p-2 text-start">סוג שנה</th>
                  <th className="p-2 text-start">מתאריך</th>
                  <th className="p-2 text-start">עד תאריך</th>
                  <th className="p-2 text-start">פעילה</th>
                  <th className="p-2 text-start"></th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((season) => (
                  <tr key={season.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{season.name}</td>
                    <td className="p-2">
                      {season.year_type
                        ? SEASON_YEAR_TYPE_LABELS[season.year_type as SeasonYearType]
                        : '—'}
                    </td>
                    <td className="p-2 whitespace-nowrap">{String(season.starts_on).slice(0, 10)}</td>
                    <td className="p-2 whitespace-nowrap">{String(season.ends_on).slice(0, 10)}</td>
                    <td className="p-2">
                      {season.is_active && <span className="olive-pill olive-pill-ok">פעילה</span>}
                    </td>
                    <td className="p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openDialog(season)}
                        aria-label="ערוך עונה"
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'עריכת עונה' : 'עונה חדשה'}</DialogTitle>
            <DialogDescription>
              סימון עונה כפעילה מבטל את הסימון מכל עונה אחרת.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>שם העונה</FormLabel>
                    <FormControl>
                      <Input placeholder="מסיק 2026" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="year_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>סוג שנה</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || NONE}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value={NONE}>—</SelectItem>
                        <SelectItem value={SeasonYearType.ON}>
                          {SEASON_YEAR_TYPE_LABELS[SeasonYearType.ON]}
                        </SelectItem>
                        <SelectItem value={SeasonYearType.OFF}>
                          {SEASON_YEAR_TYPE_LABELS[SeasonYearType.OFF]}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="starts_on"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>מתאריך</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ends_on"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>עד תאריך</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">עונה פעילה</FormLabel>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
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
    </div>
  );
}
