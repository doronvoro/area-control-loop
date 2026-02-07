'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Plus, Trash2, Key } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Permission } from '@/types/database';

interface PermissionsListProps {
  permissions: Permission[];
  onRefresh: () => void;
}

const RESOURCES = [
  'customer',
  'worker',
  'area',
  'sub_area',
  'customer_area',
  'monitoring_report',
  'action_report',
  'role',
  'permission',
];

const ACTIONS = ['create', 'read', 'update', 'delete'];

export function PermissionsList({ permissions, onRefresh }: PermissionsListProps) {
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletePermission, setDeletePermission] = useState<Permission | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    resource: '',
    action: '',
  });

  const handleCreate = () => {
    setSelectedPermission(null);
    setFormData({ name: '', display_name: '', description: '', resource: '', action: '' });
    setFormOpen(true);
  };

  const handleEdit = (permission: Permission) => {
    setSelectedPermission(permission);
    setFormData({
      name: permission.name,
      display_name: permission.display_name,
      description: permission.description || '',
      resource: permission.resource,
      action: permission.action,
    });
    setFormOpen(true);
  };

  const handleDeleteClick = (permission: Permission) => {
    setDeletePermission(permission);
    setDeleteDialogOpen(true);
  };

  const handleResourceActionChange = (resource: string, action: string) => {
    const name = `${action}_${resource}`;
    const displayName = generateDisplayName(action, resource);
    setFormData((prev) => ({
      ...prev,
      resource,
      action,
      name,
      display_name: prev.display_name || displayName,
    }));
  };

  const generateDisplayName = (action: string, resource: string) => {
    const actionMap: Record<string, string> = {
      create: 'יצירת',
      read: 'צפייה ב',
      update: 'עדכון',
      delete: 'מחיקת',
    };
    const resourceMap: Record<string, string> = {
      customer: 'לקוח',
      worker: 'עובד',
      area: 'אזור',
      sub_area: 'תת-אזור',
      customer_area: 'אזור לקוח',
      monitoring_report: 'דוח ניטור',
      action_report: 'דוח פעולה',
      role: 'תפקיד',
      permission: 'הרשאה',
    };
    return `${actionMap[action] || action} ${resourceMap[resource] || resource}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const method = selectedPermission ? 'PUT' : 'POST';
      const body = selectedPermission
        ? { id: selectedPermission.id, ...formData }
        : formData;

      const response = await fetch('/api/permissions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בשמירת ההרשאה');
      }

      showToast.success(selectedPermission ? 'ההרשאה עודכנה בהצלחה' : 'ההרשאה נוצרה בהצלחה');
      setFormOpen(false);
      onRefresh();
    } catch (err: any) {
      showToast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletePermission) return;

    try {
      const response = await fetch(`/api/permissions?id=${deletePermission.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast.error(errorData.error || 'שגיאה במחיקת ההרשאה');
        return;
      }

      showToast.success('ההרשאה נמחקה בהצלחה');
      onRefresh();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה במחיקת ההרשאה');
    }
  };

  // Group permissions by resource
  const permissionsByResource = permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 ml-2" />
          הוסף הרשאה חדשה
        </Button>
      </div>

      {permissions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>אין הרשאות במערכת</p>
          <Button onClick={handleCreate} variant="link" className="mt-2">
            הוסף הרשאה ראשונה
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(permissionsByResource).map(([resource, perms]) => (
            <div key={resource}>
              <h3 className="font-medium text-lg mb-3 capitalize">{resource.replace('_', ' ')}</h3>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>שם תצוגה</TableHead>
                      <TableHead>פעולה</TableHead>
                      <TableHead>תיאור</TableHead>
                      <TableHead className="w-[100px]">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perms.map((perm) => (
                      <TableRow key={perm.id}>
                        <TableCell className="font-mono text-sm" dir="ltr">
                          {perm.name}
                        </TableCell>
                        <TableCell className="font-medium">{perm.display_name}</TableCell>
                        <TableCell className="capitalize">{perm.action}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {perm.description || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(perm)}
                              title="ערוך"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(perm)}
                              title="מחק"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Permission Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPermission ? 'עריכת הרשאה' : 'יצירת הרשאה חדשה'}</DialogTitle>
            <DialogDescription>
              {selectedPermission ? 'עדכן את פרטי ההרשאה' : 'הזן פרטי הרשאה חדשה'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="resource">משאב</Label>
                <Select
                  value={formData.resource}
                  onValueChange={(value) =>
                    handleResourceActionChange(value, formData.action)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר משאב" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCES.map((resource) => (
                      <SelectItem key={resource} value={resource}>
                        {resource.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="action">פעולה</Label>
                <Select
                  value={formData.action}
                  onValueChange={(value) =>
                    handleResourceActionChange(formData.resource, value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר פעולה" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">שם (באנגלית)</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="create_customer"
                dir="ltr"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">שם תצוגה</Label>
              <Input
                id="display_name"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="יצירת לקוח"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">תיאור</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="תיאור ההרשאה..."
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={loading}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'שומר...' : selectedPermission ? 'שמור שינויים' : 'צור הרשאה'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      {deletePermission && (
        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="מחיקת הרשאה"
          description={`האם אתה בטוח שברצונך למחוק את ההרשאה "${deletePermission.display_name}"? פעולה זו תסיר את ההרשאה מכל התפקידים.`}
          confirmText="מחק"
          cancelText="ביטול"
          variant="destructive"
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
