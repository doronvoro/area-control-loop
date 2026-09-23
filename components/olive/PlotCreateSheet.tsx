'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertTriangle, Building2, Loader2, MapPin, Sprout, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { showToast } from '@/lib/toast';
import { NONE, fromFormValue } from '@/lib/forms/none-sentinel';
import {
  GrowerPicker,
  growerPayload,
  type GrowerOption,
  type GrowerSelection,
} from './GrowerPicker';
import { MAX_TAKT_COUNT } from '@/lib/olive/constants';
import { HARVESTER_OPTIONS, PLOT_TYPE_OPTIONS, WATER_TYPE_OPTIONS } from '@/types/database';

/**
 * A new olive plot, in a drawer.
 *
 * Separate from PlotDetailSheet rather than a mode of it: that component is
 * keyed on an existing PlotRow, loads NIR and harvest history on open, and
 * stacks two child drawers over itself. A create form has none of those, and
 * threading a null row through all of it would make every one of those features
 * test for "does this plot exist yet".
 *
 * THIS IS THE ONE PLACE IN THE OLIVE MODULE THAT WRITES `areas`' OWN COLUMNS.
 * PlotDetailSheet's footnote — that name, variety, planting year and size are
 * edited on the areas screen — stays true for EDITING. It cannot be true for
 * creating: a plot with no name is not a row anyone can go and fix later.
 *
 * The customer is not a field. It comes from the tenant selected in the sidebar,
 * shown read-only, because a plot created for any customer other than the scoped
 * one vanishes from this grid the moment the drawer closes — the list is fed by
 * getAccessibleAreaIds(scopedCustomerId). The server re-derives it either way.
 */

const SELECTS: {
  name: 'plot_type' | 'harvester' | 'water_type';
  label: string;
  options: { value: string; label: string }[];
}[] = [
  { name: 'plot_type', label: 'סוג מגדל', options: PLOT_TYPE_OPTIONS },
  { name: 'harvester', label: 'סוג מוסקת', options: HARVESTER_OPTIONS },
  { name: 'water_type', label: 'סוג מים', options: WATER_TYPE_OPTIONS },
];

const plotSchema = z.object({
  name: z.string().min(1, 'נדרש שם חלקה'),
  variety: z.string().optional(),
  // areas.size is DECIMAL(10,2) with no CHECK, so a typo'd negative would be
  // stored silently. This is the only guard there is.
  size: z
    .string()
    .optional()
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
      message: 'נדרש ערך חיובי',
    }),
  planting_time: z.string().optional(),
  description: z.string().optional(),
  region: z.string().optional(),
  plant_year_label: z.string().optional(),
  plot_type: z.string().optional(),
  harvester: z.string().optional(),
  water_type: z.string().optional(),
  takt_count: z
    .string()
    .optional()
    .refine(
      (v) =>
        !v || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= MAX_TAKT_COUNT),
      { message: `מספר בין 1 ל-${MAX_TAKT_COUNT}` }
    ),
});

type PlotFormData = z.infer<typeof plotSchema>;

interface PlotCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tenant the plot will belong to. Null for a customer_owner's own. */
  customerName: string | null;
  /** The tenant's growers, for the picker. */
  growers: GrowerOption[];
  /** Called with the new plot's area id, so the table can flash its row. */
  onSaved: (areaId: string) => void;
}

export function PlotCreateSheet({
  open,
  onOpenChange,
  customerName,
  growers,
  onSaved,
}: PlotCreateSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        dir="rtl"
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
        aria-describedby={undefined}
      >
        {open && (
          <PlotCreateBody
            // Keyed so a second create starts from empty defaults rather than
            // whatever the last one left behind.
            key="create"
            customerName={customerName}
            growers={growers}
            onSaved={onSaved}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PlotCreateBody({
  customerName,
  growers,
  onSaved,
  onClose,
}: {
  customerName: string | null;
  growers: GrowerOption[];
  onSaved: (areaId: string) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Outside the zod form: it is two coupled values with a sentinel, which
  // react-hook-form would model as two fields needing a cross-field refine for
  // no gain — nothing here is required.
  const [grower, setGrower] = useState<GrowerSelection>({ growerId: NONE, growerName: '' });

  const form = useForm<PlotFormData>({
    resolver: zodResolver(plotSchema),
    defaultValues: {
      name: '',
      variety: '',
      size: '',
      planting_time: '',
      description: '',
      region: '',
      plant_year_label: '',
      plot_type: NONE,
      harvester: NONE,
      water_type: NONE,
      takt_count: '',
    },
  });

  const onSubmit = async (values: PlotFormData) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/olive/plots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          variety: values.variety || null,
          size: values.size ? Number(values.size) : null,
          planting_time: values.planting_time || null,
          description: values.description || null,
          ...growerPayload(grower),
          region: values.region || null,
          plant_year_label: values.plant_year_label || null,
          plot_type: fromFormValue(values.plot_type),
          harvester: fromFormValue(values.harvester),
          water_type: fromFormValue(values.water_type),
          takt_count: values.takt_count ? Number(values.takt_count) : null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        // This is where the 409 duplicate-name message lands: in the banner,
        // beside the name field it is about, rather than in a toast that
        // disappears.
        throw new Error(payload.error || 'שגיאה ביצירת החלקה');
      }

      const created = await response.json();

      showToast.success('החלקה נוצרה');
      // Partial writes the server could not complete. Not thrown: the plot
      // exists and is usable, and every field involved is editable in its card.
      for (const warning of created.warnings ?? []) {
        showToast.error(warning);
      }

      onSaved(created.plot?.id ?? '');
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'שגיאה ביצירת החלקה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="olive-form-hero shrink-0 px-6 py-5 md:px-8 md:py-6">
        <div className="olive-hero-pattern" />
        <div className="relative z-10 flex items-center justify-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <MapPin className="size-5 text-white" />
          </div>
          <SheetTitle className="olive-hero-title text-2xl tracking-tight md:text-3xl">
            חלקה חדשה
          </SheetTitle>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="absolute top-4 left-4 z-10 rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          {/* min-h-0 is load-bearing: a flex item defaults to min-height:auto,
              so without it overflow-y-auto never shrinks and the footer below
              gets pushed off a phone screen. */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
            {error && (
              <div className="olive-error-banner flex items-center gap-3 p-4">
                <AlertTriangle className="size-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <section className="olive-section">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <Building2 className="text-primary size-4" />
                לקוח
              </h3>
              {customerName ? (
                <>
                  <span className="olive-pill olive-pill-idle">{customerName}</span>
                  <p className="olive-muted mt-2 text-xs">
                    החלקה תשויך ללקוח שנבחר בתפריט הצדדי. לשיוך ללקוח אחר — החלף לקוח ואז צור את
                    החלקה.
                  </p>
                </>
              ) : (
                <p className="olive-muted text-xs">החלקה תשויך לחשבון שלך.</p>
              )}
            </section>

            <section className="olive-section">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <MapPin className="text-primary size-4" />
                פרטי החלקה
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-sm font-semibold">שם החלקה *</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} className="h-9" placeholder="מיצר 2003" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="variety"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">זן</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} className="h-9" placeholder="ארבקינה" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">גודל (דונם)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          type="number"
                          // step="any" and no min, as in the plot drawer: native
                          // constraint validation would otherwise reject the
                          // value silently, in English, before zod said anything.
                          step="any"
                          inputMode="decimal"
                          className="h-9 tabular-nums"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="planting_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">תאריך נטיעה</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} type="date" className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel className="text-sm font-semibold">תיאור</FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ''} rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="olive-section">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold">
                <Sprout className="text-primary size-4" />
                פרטי זית
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold" id="plot-create-grower">
                    מגדל
                  </label>
                  <div className="mt-2" aria-labelledby="plot-create-grower">
                    <GrowerPicker growers={growers} value={grower} onChange={setGrower} />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">גוש</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} className="h-9" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {SELECTS.map((s) => (
                  <FormField
                    key={s.name}
                    control={form.control}
                    name={s.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">{s.label}</FormLabel>
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
                      <FormLabel className="text-sm font-semibold">שנת נטיעה (תווית)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} className="h-9" placeholder="2006/7" />
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
                      <FormLabel className="text-sm font-semibold">מספר טאקטים</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          type="number"
                          step="any"
                          inputMode="numeric"
                          className="h-9 tabular-nums"
                        />
                      </FormControl>
                      <p className="olive-muted text-xs">
                        ייווצרו הטאקטים 1 עד N, כדי שניתן יהיה לרשום עליהם בדיקות ומעברי מסיק.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <p className="olive-muted mt-4 text-xs">
                יבול צפוי נקבע לפי עונה ונערך בכרטיס החלקה לאחר היצירה.
              </p>
            </section>
          </div>

          <div className="olive-sticky-footer olive-sticky-footer--flush shrink-0">
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                <X className="ml-1 size-4" />
                ביטול
              </Button>
              <button type="submit" className="olive-submit px-6 py-2.5" disabled={saving}>
                {saving && <Loader2 className="ml-2 inline size-4 animate-spin" />}
                צור חלקה
              </button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}
