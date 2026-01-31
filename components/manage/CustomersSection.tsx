'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Pencil,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Building2,
  Link2,
} from 'lucide-react';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { AreaAssignmentDialog } from './AreaAssignmentDialog';
import { showToast } from '@/lib/toast';

interface CustomerArea {
  id: string;
  name: string;
  description: string | null;
}

interface CustomerWithAreas {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  areas: CustomerArea[];
}

interface AreaWithOwner {
  id: string;
  name: string;
  description: string | null;
  customer?: {
    id: string;
    name: string;
  } | null;
}

interface Permissions {
  canCreateCustomer: boolean;
  canUpdateCustomer: boolean;
  canDeleteCustomer: boolean;
  canAddAreaToCustomer: boolean;
  canRemoveAreaFromCustomer: boolean;
}

interface CustomersSectionProps {
  customers: CustomerWithAreas[];
  unassignedAreas: AreaWithOwner[];
  permissions: Permissions;
}

export function CustomersSection({
  customers,
  unassignedAreas,
  permissions,
}: CustomersSectionProps) {
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithAreas | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteCustomer, setDeleteCustomer] = useState<CustomerWithAreas | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignDialogCustomer, setAssignDialogCustomer] = useState<CustomerWithAreas | null>(null);

  const toggleExpand = (customerId: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId);
    } else {
      newExpanded.add(customerId);
    }
    setExpandedCustomers(newExpanded);
  };

  const handleCreateCustomer = () => {
    setSelectedCustomer(null);
    setFormOpen(true);
  };

  const handleEditCustomer = (customer: CustomerWithAreas) => {
    setSelectedCustomer(customer);
    setFormOpen(true);
  };

  const handleDeleteClick = (customer: CustomerWithAreas) => {
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

  const handleAssignArea = (customer: CustomerWithAreas) => {
    setAssignDialogCustomer(customer);
  };

  const handleRemoveArea = async (customerId: string, areaId: string, areaName: string) => {
    try {
      const response = await fetch('/api/customer-areas', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId, area_id: areaId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast.error(errorData.error || 'שגיאה בהסרת השטח');
        return;
      }

      showToast.success(`השטח "${areaName}" הוסר מהלקוח`);
      window.location.reload();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה בהסרת השטח');
    }
  };

  const handleSuccess = () => {
    window.location.reload();
  };

  return (
    <>
      <div className="mb-6 flex justify-end">
        {permissions.canCreateCustomer && (
          <Button onClick={handleCreateCustomer}>
            <Plus className="h-4 w-4 ml-2" />
            הוסף לקוח חדש
          </Button>
        )}
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>אין לקוחות במערכת</p>
          {permissions.canCreateCustomer && (
            <Button onClick={handleCreateCustomer} variant="link" className="mt-2">
              הוסף לקוח ראשון
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => {
            const isExpanded = expandedCustomers.has(customer.id);
            return (
              <Card key={customer.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{customer.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      {permissions.canUpdateCustomer && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCustomer(customer)}
                          title="ערוך"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {permissions.canDeleteCustomer && (
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
                <CardContent className="flex-1 flex flex-col">
                  {customer.description && (
                    <p className="text-sm text-muted-foreground mb-3">{customer.description}</p>
                  )}

                  {/* Areas section */}
                  <div className="mt-auto">
                    <button
                      onClick={() => toggleExpand(customer.id)}
                      className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <MapPin className="h-4 w-4" />
                      <span>שטחים ({customer.areas.length})</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 pr-6 space-y-1">
                        {customer.areas.length > 0 ? (
                          customer.areas.map((area) => (
                            <div
                              key={area.id}
                              className="flex items-center justify-between text-sm p-1.5 rounded hover:bg-muted group"
                            >
                              <span>{area.name}</span>
                              {permissions.canRemoveAreaFromCustomer && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                  onClick={() => handleRemoveArea(customer.id, area.id, area.name)}
                                  title="הסר שטח"
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">אין שטחים משויכים</p>
                        )}

                        {permissions.canAddAreaToCustomer && unassignedAreas.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => handleAssignArea(customer)}
                          >
                            <Link2 className="h-3 w-3 ml-1" />
                            הקצה שטח
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">
                    נוצר: {new Date(customer.created_at).toLocaleDateString('he-IL')}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(permissions.canCreateCustomer || permissions.canUpdateCustomer) && (
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

      {assignDialogCustomer && (
        <AreaAssignmentDialog
          customer={assignDialogCustomer}
          unassignedAreas={unassignedAreas}
          open={!!assignDialogCustomer}
          onOpenChange={(open) => !open && setAssignDialogCustomer(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
