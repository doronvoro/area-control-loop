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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CUSTOMER_TYPE_OPTIONS } from '@/types/database';

/**
 * Validation depends on the mode, so the schema is built per mode rather than
 * shared.
 *
 * The previous version ended in `.refine(() => true, {})` — a no-op whose
 * comment said requiredness "will be handled in the component". It was: by an
 * imperative check in onSubmit that wrote to a local `error` string. So a
 * missing email rendered as a banner above the form rather than a message under
 * the email field, and the field itself never showed as invalid.
 *
 * superRefine puts the errors on the fields, where react-hook-form's FormMessage
 * already knows how to render them.
 */
const makeCustomerSchema = (isEditMode: boolean) =>
  z
    .object({
      name: z.string().min(1, 'שם הלקוח נדרש'),
      description: z.string().optional(),
      // Create-only, like the credentials below.
      //
      // This dialog's `customer` prop carries only id/name/description, so in
      // edit mode it does not know the current type — offering a select would
      // mean overwriting a classification with whatever happened to be
      // preselected. Editing a type belongs on /admin/customers, whose drawer
      // has the whole row. PUT /api/customers omits keys absent from the body,
      // so not sending it here leaves the stored value alone.
      customer_type: z.string().optional(),
      // Optional at the field level because editing does not resubmit
      // credentials; superRefine below makes them required on create.
      email: z.string().optional().or(z.literal('')),
      password: z.string().optional().or(z.literal('')),
    })
    .superRefine((data, ctx) => {
      if (isEditMode) return;

      if (!data.customer_type) {
        ctx.addIssue({
          code: 'custom',
          path: ['customer_type'],
          message: 'נדרש לבחור סוג לקוח',
        });
      }

      if (!data.email) {
        ctx.addIssue({
          code: 'custom',
          path: ['email'],
          message: 'אימייל נדרש ליצירת לקוח חדש',
        });
      } else if (!z.string().email().safeParse(data.email).success) {
        ctx.addIssue({ code: 'custom', path: ['email'], message: 'אימייל לא תקין' });
      }

      if (!data.password || data.password.length < 6) {
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message: 'סיסמה חייבת להכיל לפחות 6 תווים',
        });
      }
    });

type CustomerFormData = z.infer<ReturnType<typeof makeCustomerSchema>>;

interface CustomerFormProps {
  customer?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CustomerForm({ customer, open, onOpenChange, onSuccess }: CustomerFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!customer;

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(makeCustomerSchema(isEditMode)),
    defaultValues: {
      name: customer?.name || '',
      description: customer?.description || '',
      customer_type: '',
      email: '',
      password: '',
    },
  });

  // Reset form when dialog opens/closes or customer changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: customer?.name || '',
        description: customer?.description || '',
        customer_type: '',
        email: '',
        password: '',
      });
      setError(null);
    }
  }, [open, customer, form]);

  const onSubmit = async (data: CustomerFormData) => {
    // Requiredness is enforced by makeCustomerSchema, so onSubmit only runs on
    // valid input. `error` below is for server-side failures only.
    setLoading(true);
    setError(null);

    try {
      const method = isEditMode ? 'PUT' : 'POST';
      const body: any = {
        name: data.name,
        description: data.description,
      };

      if (isEditMode) {
        body.id = customer.id;
      } else {
        body.customer_type = data.customer_type;
        body.email = data.email?.trim();
        body.password = data.password;
      }

      const response = await fetch('/api/customers', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || (isEditMode ? 'שגיאה בעדכון הלקוח' : 'שגיאה ביצירת הלקוח'));
      }

      form.reset();
      showToast.success(isEditMode ? 'הלקוח עודכן בהצלחה' : 'הלקוח נוצר בהצלחה');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      const errorMessage = err.message || (isEditMode ? 'שגיאה בעדכון הלקוח' : 'שגיאה ביצירת הלקוח');
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
          <DialogTitle>{isEditMode ? 'עריכת לקוח' : 'יצירת לקוח חדש'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'עדכן את פרטי הלקוח' : 'הזן פרטי לקוח חדש. המשתמש יקבל גישה למערכת עם הפרטים שתזין.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם הלקוח</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="שם הלקוח / החברה" />
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
                      placeholder="תיאור הלקוח (אופציונלי)"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditMode && (
              <>
                <FormField
                  control={form.control}
                  name="customer_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>סוג לקוח</FormLabel>
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="בחר סוג לקוח" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CUSTOMER_TYPE_OPTIONS.map((o) => (
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

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>אימייל</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="email@example.com"
                          dir="ltr"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>סיסמה</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="סיסמה (לפחות 6 תווים)"
                          dir="ltr"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
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
                {loading ? (isEditMode ? 'שומר...' : 'יוצר...') : (isEditMode ? 'שמור שינויים' : 'צור לקוח')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
