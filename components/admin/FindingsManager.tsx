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

const findingSchema = z.object({
  name: z.string().min(1, 'שם ממצא נדרש'),
  description: z.string().optional(),
});

type FindingFormData = z.infer<typeof findingSchema>;

interface Finding {
  id: string;
  name: string;
  description: string | null;
  severity: string | null;
  created_at: string;
  updated_at: string;
}

type SortField = 'name' | 'description';
type SortDirection = 'asc' | 'desc';

export function FindingsManager() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const form = useForm<FindingFormData>({
    resolver: zodResolver(findingSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    fetchFindings();
  }, []);

  const sortedFindings = useMemo(() => {
    return [...findings].sort((a, b) => {
      const aValue = (a[sortField] || '').toLowerCase();
      const bValue = (b[sortField] || '').toLowerCase();

      if (sortDirection === 'asc') {
        return aValue.localeCompare(bValue, 'he');
      }
      return bValue.localeCompare(aValue, 'he');
    });
  }, [findings, sortField, sortDirection]);

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

  const fetchFindings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/findings');
      if (response.ok) {
        const data = await response.json();
        setFindings(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (finding?: Finding) => {
    if (finding) {
      setEditingFinding(finding);
      form.reset({
        name: finding.name,
        description: finding.description || '',
      });
    } else {
      setEditingFinding(null);
      form.reset({
        name: '',
        description: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingFinding(null);
    form.reset();
  };

  const onSubmit = async (data: FindingFormData) => {
    setError(null);
    try {
      const url = '/api/findings';
      const method = editingFinding ? 'PUT' : 'POST';
      const body = editingFinding
        ? { id: editingFinding.id, ...data }
        : data;

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
      fetchFindings();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את הממצא?')) return;

    try {
      const response = await fetch(`/api/findings?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה במחיקה');
      }

      fetchFindings();
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
          הוסף ממצא חדש
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
                  שם
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('description')}
                  className="h-8 p-0 font-semibold hover:bg-transparent"
                >
                  {getSortIcon('description')}
                  תיאור
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedFindings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  אין ממצאים. לחץ על &quot;הוסף ממצא חדש&quot; כדי להתחיל.
                </TableCell>
              </TableRow>
            ) : (
              sortedFindings.map((finding) => (
                <TableRow key={finding.id}>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(finding)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(finding.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{finding.name}</TableCell>
                  <TableCell>{finding.description || '-'}</TableCell>
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
              {editingFinding ? 'עריכת ממצא' : 'ממצא חדש'}
            </DialogTitle>
            <DialogDescription>
              {editingFinding ? 'ערוך את פרטי הממצא' : 'הוסף ממצא חדש למערכת'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">שם ממצא</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="לדוגמה: כנימות"
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
                placeholder="תיאור הממצא..."
                rows={3}
              />
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
