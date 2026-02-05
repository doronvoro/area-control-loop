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
import { Customer, WorkerType } from '@/types/database';

const workerSchema = z.object({
  name: z.string().min(1, 'שם העובד נדרש'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים').optional().or(z.literal('')),
  customer_id: z.string().min(1, 'נדרש לבחור לקוח'),
  worker_type_id: z.string().min(1, 'נדרש לבחור סוג עובד'),
});

type WorkerFormData = z.infer<typeof workerSchema>;

interface WorkerFormProps {
  worker?: {
    id: string;
    name: string;
    customer_id: string;
    type_id: string;
    email?: string | null;
  } | null;
  customers: Customer[];
  workerTypes: WorkerType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function WorkerForm({ worker, customers, workerTypes, open, onOpenChange, onSuccess }: WorkerFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!worker;

  const form = useForm<WorkerFormData>({
    resolver: zodResolver(workerSchema),
    defaultValues: {
      name: worker?.name || '',
      email: '',
      password: '',
      customer_id: worker?.customer_id || '',
      worker_type_id: worker?.type_id || '',
    },
  });

  // Reset form when dialog opens/closes or worker changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: worker?.name || '',
        email: '',
        password: '',
        customer_id: worker?.customer_id || '',
        worker_type_id: worker?.type_id || '',
      });
      setError(null);
    }
  }, [open, worker, form]);

  const onSubmit = async (data: WorkerFormData) => {
    // Validate email and password for new workers
    if (!isEditMode) {
      if (!data.email) {
        setError('אימייל נדרש ליצירת עובד חדש');
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
        worker_type_id: data.worker_type_id,
      };

      if (isEditMode) {
        body.id = worker.id;
      } else {
        body.email = data.email;
        body.password = data.password;
        body.customer_id = data.customer_id;
      }

      const response = await fetch('/api/workers', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || (isEditMode ? 'שגיאה בעדכון העובד' : 'שגיאה ביצירת העובד'));
      }

      form.reset();
      showToast.success(isEditMode ? 'העובד עודכן בהצלחה' : 'העובד נוצר בהצלחה');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      const errorMessage = err.message || (isEditMode ? 'שגיאה בעדכון העובד' : 'שגיאה ביצירת העובד');
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
          <DialogTitle>{isEditMode ? 'עריכת עובד' : 'יצירת עובד חדש'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'עדכן את פרטי העובד' : 'הזן פרטי עובד חדש. העובד יקבל גישה למערכת עם הפרטים שתזין.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם העובד</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="שם מלא" />
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

                <FormField
                  control={form.control}
                  name="customer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>לקוח</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
              </>
            )}

            <FormField
              control={form.control}
              name="worker_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג עובד</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוג עובד" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {workerTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {loading ? (isEditMode ? 'שומר...' : 'יוצר...') : (isEditMode ? 'שמור שינויים' : 'צור עובד')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
