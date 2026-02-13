'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { WorkerForm } from './WorkerForm';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { showToast } from '@/lib/toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Customer, WorkerType } from '@/types/database';

interface Worker {
  id: string;
  name: string;
  customer_id: string;
  type_id: string;
  user_id: string;
  email?: string | null;
  created_at?: string;
  worker_types?: WorkerType;
  customers?: Customer;
}

interface WorkersListProps {
  workers: Worker[];
  customers: Customer[];
  workerTypes: WorkerType[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function WorkersList({
  workers,
  customers,
  workerTypes,
  canCreate,
  canUpdate,
  canDelete,
}: WorkersListProps) {
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteWorker, setDeleteWorker] = useState<Worker | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [filterCustomerId, setFilterCustomerId] = useState<string>('all');

  const filteredWorkers = useMemo(() => {
    if (filterCustomerId === 'all') {
      return workers;
    }
    return workers.filter((worker) => worker.customer_id === filterCustomerId);
  }, [workers, filterCustomerId]);

  const handleEditWorker = (worker: Worker) => {
    setSelectedWorker(worker);
    setFormOpen(true);
  };

  const handleCreateWorker = () => {
    setSelectedWorker(null);
    setFormOpen(true);
  };

  const handleDeleteClick = (worker: Worker) => {
    setDeleteWorker(worker);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteWorker) return;

    try {
      const response = await fetch(`/api/workers?id=${deleteWorker.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast.error(errorData.error || 'שגיאה במחיקת העובד');
        return;
      }

      showToast.success('העובד נמחק בהצלחה');
      window.location.reload();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה במחיקת העובד');
    }
  };

  const handleSuccess = () => {
    window.location.reload();
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        {customers.length > 1 ? (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">סנן לפי לקוח:</label>
            <Select value={filterCustomerId} onValueChange={setFilterCustomerId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="כל הלקוחות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הלקוחות</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div />
        )}

        {canCreate && (
          <Button onClick={handleCreateWorker}>
            <Plus className="h-4 w-4 me-2" />
            הוסף עובד חדש
          </Button>
        )}
      </div>

      {filteredWorkers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{filterCustomerId === 'all' ? 'אין עובדים במערכת' : 'אין עובדים ללקוח זה'}</p>
          {canCreate && (
            <Button onClick={handleCreateWorker} variant="link" className="mt-2">
              הוסף עובד ראשון
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>אימייל</TableHead>
                <TableHead>לקוח</TableHead>
                <TableHead>סוג עובד</TableHead>
                <TableHead>נוצר</TableHead>
                <TableHead className="w-[100px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkers.map((worker) => (
                <TableRow key={worker.id}>
                  <TableCell className="font-medium">{worker.name}</TableCell>
                  <TableCell dir="ltr" className="text-left">
                    {worker.email || '-'}
                  </TableCell>
                  <TableCell>{worker.customers?.name || '-'}</TableCell>
                  <TableCell>{worker.worker_types?.display_name || '-'}</TableCell>
                  <TableCell>
                    {worker.created_at
                      ? new Date(worker.created_at).toLocaleDateString('he-IL')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditWorker(worker)}
                          title="ערוך"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(worker)}
                          title="מחק"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(canCreate || canUpdate) && (
        <WorkerForm
          worker={selectedWorker}
          customers={customers}
          workerTypes={workerTypes}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={handleSuccess}
        />
      )}

      {deleteWorker && (
        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="מחיקת עובד"
          description={`האם אתה בטוח שברצונך למחוק את העובד "${deleteWorker.name}"? פעולה זו תמחק גם את המשתמש המשויך.`}
          confirmText="מחק"
          cancelText="ביטול"
          variant="destructive"
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
