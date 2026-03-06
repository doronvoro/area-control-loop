'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Edit, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const cropSchema = z.object({
  name: z.string().min(1, 'שם גידול נדרש'),
  description: z.string().optional(),
  parent_crop_id: z.string().optional(),
});

type CropFormData = z.infer<typeof cropSchema>;

interface Crop {
  id: string;
  name: string;
  description: string | null;
  parent_crop_id: string | null;
  created_at: string;
  updated_at: string;
}

type SortField = 'name' | 'description';
type SortDirection = 'asc' | 'desc';

export function CropsManager() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCrop, setEditingCrop] = useState<Crop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const form = useForm<CropFormData>({
    resolver: zodResolver(cropSchema),
    defaultValues: {
      name: '',
      description: '',
      parent_crop_id: '',
    },
  });

  useEffect(() => {
    fetchCrops();
  }, []);

  const sortedCrops = useMemo(() => {
    return [...crops].sort((a, b) => {
      const aValue = (a[sortField] || '').toLowerCase();
      const bValue = (b[sortField] || '').toLowerCase();

      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue, 'he');
      }
      return bValue.localeCompare(aValue, 'he');
    });
  }, [crops, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 mr-2" />;
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="h-4 w-4 mr-2" />
      : <ArrowDown className="h-4 w-4 mr-2" />;
  };

  const fetchCrops = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/crops');
      if (response.ok) {
        const data = await response.json();
        setCrops(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (crop?: Crop) => {
    if (crop) {
      setEditingCrop(crop);
      form.reset({
        name: crop.name,
        description: crop.description || '',
        parent_crop_id: crop.parent_crop_id || '',
      });
    } else {
      setEditingCrop(null);
      form.reset({
        name: '',
        description: '',
        parent_crop_id: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCrop(null);
    form.reset();
  };

  const onSubmit = async (data: CropFormData) => {
    setError(null);
    try {
      const url = '/api/crops';
      const method = editingCrop ? 'PUT' : 'POST';
      const body = editingCrop
        ? { id: editingCrop.id, ...data, parent_crop_id: data.parent_crop_id || null }
        : { ...data, parent_crop_id: data.parent_crop_id || null };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בשמירה');
      }

      handleCloseDialog();
      fetchCrops();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הגידול?')) return;

    try {
      const response = await fetch(`/api/crops?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה במחיקה');
      }

      fetchCrops();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">טוען...</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 ml-2" />
          הוסף גידול חדש
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">פעולות</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('name')}
                  className="h-8 p-0 font-semibold hover:bg-transparent"
                >
                  {getSortIcon('name')}
                  שם (אנגלית)
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('description')}
                  className="h-8 p-0 font-semibold hover:bg-transparent"
                >
                  {getSortIcon('description')}
                  תיאור (עברית)
                </Button>
              </TableHead>
              <TableHead>גידול אב</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedCrops.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  אין גידולים. לחץ על &quot;הוסף גידול חדש&quot; כדי להתחיל.
                </TableCell>
              </TableRow>
            ) : (
              sortedCrops.map((crop) => (
                <TableRow key={crop.id}>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(crop)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(crop.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{crop.name}</TableCell>
                  <TableCell>{crop.description || '-'}</TableCell>
                  <TableCell>
                    {crop.parent_crop_id
                      ? crops.find((c) => c.id === crop.parent_crop_id)?.name || '-'
                      : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCrop ? 'עריכת גידול' : 'גידול חדש'}
            </DialogTitle>
            <DialogDescription>
              {editingCrop ? 'ערוך את פרטי הגידול' : 'הוסף גידול חדש למערכת'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">שם גידול</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="לדוגמה: עגבניות"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="description">תיאור (אופציונלי)</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                placeholder="תיאור הגידול..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="parent_crop_id">גידול אב (אופציונלי)</Label>
              <select
                id="parent_crop_id"
                {...form.register('parent_crop_id')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">ללא גידול אב</option>
                {crops
                  .filter((c) => c.id !== editingCrop?.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.description ? ` (${c.description})` : ''}
                    </option>
                  ))}
              </select>
              <p className="text-sm text-muted-foreground mt-1">
                גידול אב מאפשר ירושת המלצות חומרים כאשר אין המלצות ספציפיות לגידול זה
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                ביטול
              </Button>
              <Button type="submit">שמור</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
