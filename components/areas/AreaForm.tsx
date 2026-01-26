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

const areaSchema = z.object({
  name: z.string().min(1, 'שם השטח נדרש'),
  description: z.string().optional(),
  customer_id: z.string().optional(),
});

type AreaFormData = z.infer<typeof areaSchema>;

interface Customer {
  id: string;
  name: string;
}

interface AreaFormProps {
  area?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  customerId?: string | null;
  customers?: Customer[];
  isAdmin?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AreaForm({ area, customerId, customers = [], isAdmin = false, open, onOpenChange, onSuccess }: AreaFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show customer selector for admins when creating new area
  const showCustomerSelector = isAdmin && !area && customers.length > 0;

  const form = useForm<AreaFormData>({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      name: area?.name || '',
      description: area?.description || '',
      customer_id: customerId || '',
    },
  });

  // Reset form when dialog opens/closes or area changes
  useEffect(() => {
    if (open) {
      form.reset({
        name: area?.name || '',
        description: area?.description || '',
        customer_id: customerId || '',
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

      const response = await fetch('/api/areas', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(area ? { id: area.id } : {}),
          name: data.name,
          description: data.description,
          ...(selectedCustomerId && !area ? { customer_id: selectedCustomerId } : {}),
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

  const handleDelete = async () => {
    if (!area) return;
    
    // Delete will be handled by parent component with confirmation dialog
    // This function is kept for consistency but won't be called directly
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
