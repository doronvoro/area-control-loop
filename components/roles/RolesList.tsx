'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Plus, Trash2, Shield, Settings } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Role, Permission } from '@/types/database';

interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  permissions: Permission;
}

interface RolesListProps {
  roles: Role[];
  permissions: Permission[];
  onRefresh: () => void;
}

export function RolesList({ roles, permissions, onRefresh }: RolesListProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
  });

  const handleCreate = () => {
    setSelectedRole(null);
    setFormData({ name: '', display_name: '', description: '' });
    setFormOpen(true);
  };

  const handleEdit = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
    });
    setFormOpen(true);
  };

  const handleManagePermissions = async (role: Role) => {
    setSelectedRole(role);
    try {
      const res = await fetch(`/api/role-permissions?roleId=${role.id}`);
      if (res.ok) {
        const data = await res.json();
        setRolePermissions(data);
        setSelectedPermissions(new Set(data.map((rp: RolePermission) => rp.permission_id)));
      }
    } catch (error) {
      console.error('Failed to fetch role permissions:', error);
    }
    setPermissionsDialogOpen(true);
  };

  const handleDeleteClick = (role: Role) => {
    setDeleteRole(role);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const method = selectedRole ? 'PUT' : 'POST';
      const body = selectedRole
        ? { id: selectedRole.id, ...formData }
        : formData;

      const response = await fetch('/api/roles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בשמירת התפקיד');
      }

      showToast.success(selectedRole ? 'התפקיד עודכן בהצלחה' : 'התפקיד נוצר בהצלחה');
      setFormOpen(false);
      onRefresh();
    } catch (err: any) {
      showToast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteRole) return;

    try {
      const response = await fetch(`/api/roles?id=${deleteRole.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast.error(errorData.error || 'שגיאה במחיקת התפקיד');
        return;
      }

      showToast.success('התפקיד נמחק בהצלחה');
      onRefresh();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה במחיקת התפקיד');
    }
  };

  const handlePermissionToggle = async (permissionId: string) => {
    if (!selectedRole) return;

    const existingRolePermission = rolePermissions.find(
      (rp) => rp.permission_id === permissionId
    );

    try {
      if (existingRolePermission) {
        // Remove permission
        const response = await fetch(`/api/role-permissions?id=${existingRolePermission.id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('שגיאה בהסרת ההרשאה');

        setRolePermissions(rolePermissions.filter((rp) => rp.id !== existingRolePermission.id));
        setSelectedPermissions((prev) => {
          const next = new Set(prev);
          next.delete(permissionId);
          return next;
        });
        showToast.success('ההרשאה הוסרה');
      } else {
        // Add permission
        const response = await fetch('/api/role-permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role_id: selectedRole.id,
            permission_id: permissionId,
          }),
        });
        if (!response.ok) throw new Error('שגיאה בהוספת ההרשאה');

        const data = await response.json();
        setRolePermissions([...rolePermissions, data]);
        setSelectedPermissions((prev) => new Set([...prev, permissionId]));
        showToast.success('ההרשאה נוספה');
      }
    } catch (err: any) {
      showToast.error(err.message);
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
          הוסף תפקיד חדש
        </Button>
      </div>

      {roles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>אין תפקידים במערכת</p>
          <Button onClick={handleCreate} variant="link" className="mt-2">
            הוסף תפקיד ראשון
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>שם תצוגה</TableHead>
                <TableHead>תיאור</TableHead>
                <TableHead>נוצר</TableHead>
                <TableHead className="w-[150px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-mono text-sm" dir="ltr">
                    {role.name}
                  </TableCell>
                  <TableCell className="font-medium">{role.display_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {role.description || '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(role.created_at).toLocaleDateString('he-IL')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleManagePermissions(role)}
                        title="ניהול הרשאות"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(role)}
                        title="ערוך"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(role)}
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
      )}

      {/* Role Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRole ? 'עריכת תפקיד' : 'יצירת תפקיד חדש'}</DialogTitle>
            <DialogDescription>
              {selectedRole ? 'עדכן את פרטי התפקיד' : 'הזן פרטי תפקיד חדש'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם (באנגלית)</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="admin"
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
                placeholder="מנהל מערכת"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">תיאור</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="תיאור התפקיד..."
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
                {loading ? 'שומר...' : selectedRole ? 'שמור שינויים' : 'צור תפקיד'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Permissions Management Dialog */}
      <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ניהול הרשאות לתפקיד: {selectedRole?.display_name}</DialogTitle>
            <DialogDescription>
              סמן את ההרשאות שברצונך להעניק לתפקיד זה
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {Object.entries(permissionsByResource).map(([resource, perms]) => (
              <div key={resource} className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground uppercase">
                  {resource}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {perms.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-center space-x-2 space-x-reverse"
                    >
                      <Checkbox
                        id={perm.id}
                        checked={selectedPermissions.has(perm.id)}
                        onCheckedChange={() => handlePermissionToggle(perm.id)}
                      />
                      <label
                        htmlFor={perm.id}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {perm.display_name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button onClick={() => setPermissionsDialogOpen(false)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      {deleteRole && (
        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="מחיקת תפקיד"
          description={`האם אתה בטוח שברצונך למחוק את התפקיד "${deleteRole.display_name}"? פעולה זו תסיר את התפקיד מכל המשתמשים.`}
          confirmText="מחק"
          cancelText="ביטול"
          variant="destructive"
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
