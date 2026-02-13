'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { CustomerForm } from './CustomerForm';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { showToast } from '@/lib/toast';

interface Customer {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
}

interface CustomersListProps {
  customers: Customer[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function CustomersList({
  customers,
  canCreate,
  canUpdate,
  canDelete,
}: CustomersListProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormOpen(true);
  };

  const handleCreateCustomer = () => {
    setSelectedCustomer(null);
    setFormOpen(true);
  };

  const handleDeleteClick = (customer: Customer) => {
    setDeleteCustomer(customer);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCustomer) return;

    try {
      const response = await fetch(`/api/customers?id=${deleteCustomer.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast.error(errorData.error || 'שגיאה במחיקת הלקוח');
        return;
      }

      showToast.success('הלקוח נמחק בהצלחה');
      window.location.reload();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה במחיקת הלקוח');
    }
  };

  const handleSuccess = () => {
    window.location.reload();
  };

  return (
    <>
      <div className="mb-6 flex justify-end">
        {canCreate && (
          <Button onClick={handleCreateCustomer}>
            <Plus className="h-4 w-4 me-2" />
            הוסף לקוח חדש
          </Button>
        )}
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>אין לקוחות במערכת</p>
          {canCreate && (
            <Button onClick={handleCreateCustomer} variant="link" className="mt-2">
              הוסף לקוח ראשון
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <Card key={customer.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{customer.name}</CardTitle>
                  <div className="flex items-center gap-1">
                    {canUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCustomer(customer)}
                        title="ערוך"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(customer)}
                        title="מחק"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {customer.description && (
                  <p className="text-sm text-muted-foreground">
                    {customer.description}
                  </p>
                )}
                {customer.created_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    נוצר: {new Date(customer.created_at).toLocaleDateString('he-IL')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(canCreate || canUpdate) && (
        <CustomerForm
          customer={selectedCustomer}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={handleSuccess}
        />
      )}

      {deleteCustomer && (
        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="מחיקת לקוח"
          description={`האם אתה בטוח שברצונך למחוק את הלקוח "${deleteCustomer.name}"? פעולה זו תמחק גם את כל העובדים והשטחים הקשורים.`}
          confirmText="מחק"
          cancelText="ביטול"
          variant="destructive"
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
