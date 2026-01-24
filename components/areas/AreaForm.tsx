'use client';

import { useState } from 'react';
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

const areaSchema = z.object({
  name: z.string().min(1, 'שם השטח נדרש'),
  description: z.string().optional(),
});

type AreaFormData = z.infer<typeof areaSchema>;

interface AreaFormProps {
  area?: {
    id: string;
    name: string;
    description?: string | null;
  } | null;
  customerId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AreaForm({ area, customerId, open, onOpenChange, onSuccess }: AreaFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AreaFormData>({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      name: area?.name || '',
      description: area?.description || '',
    },
  });

  const onSubmit = async (data: AreaFormData) => {
    setLoading(true);
    setError(null);

    try {
      const method = area ? 'PUT' : 'POST';
      const response = await fetch('/api/areas', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(area ? { id: area.id } : {}),
          ...data,
          ...(customerId && !area ? { customer_id: customerId } : {}),
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
