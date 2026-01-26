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
import { Textarea } from '@/components/ui/textarea';

const customerSchema = z.object({
  name: z.string().min(1, 'שם הלקוח נדרש'),
  description: z.string().optional(),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים').optional().or(z.literal('')),
}).refine((data) => {
  // For new customers, email and password are required
  // This will be handled in the component based on whether it's edit or create
  return true;
}, {});

type CustomerFormData = z.infer<typeof customerSchema>;

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
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name || '',
      description: customer?.description || '',
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
        email: '',
        password: '',
      });
      setError(null);
    }
  }, [open, customer, form]);

  const onSubmit = async (data: CustomerFormData) => {
    // Validate email and password for new customers
    if (!isEditMode) {
      if (!data.email) {
        setError('אימייל נדרש ליצירת לקוח חדש');
        return;
      }
      if (!data.password || data.password.length < 6) {
        setError('סיסמה חייבת להכיל לפחות 6 תווים');
        return;
      }
    }

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
        body.email = data.email;
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
