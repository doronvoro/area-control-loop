'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Users, Loader2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Role } from '@/types/database';

interface User {
  id: string;
  email: string;
  name: string;
}

interface UserRoleWithDetails {
  id: string;
  user_id: string;
  role_id: string;
  created_at: string;
  email: string | null;
  user_name: string | null;
  roles: Role;
}

interface UserRolesListProps {
  roles: Role[];
  users: User[];
  onRefresh: () => void;
}

export function UserRolesList({ roles, users, onRefresh }: UserRolesListProps) {
  const [userRoles, setUserRoles] = useState<UserRoleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteUserRole, setDeleteUserRole] = useState<UserRoleWithDetails | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    user_id: '',
    role_id: '',
  });

  const fetchUserRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user-roles');
      if (res.ok) {
        setUserRoles(await res.json());
      }
    } catch (error) {
      console.error('Failed to fetch user roles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const handleCreate = () => {
    setFormData({ user_id: '', role_id: '' });
    setFormOpen(true);
  };

  const handleDeleteClick = (userRole: UserRoleWithDetails) => {
    setDeleteUserRole(userRole);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/user-roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בהקצאת התפקיד');
      }

      showToast.success('התפקיד הוקצה בהצלחה');
      setFormOpen(false);
      fetchUserRoles();
      onRefresh();
    } catch (err: any) {
      showToast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteUserRole) return;

    try {
      const response = await fetch(`/api/user-roles?id=${deleteUserRole.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast.error(errorData.error || 'שגיאה בהסרת התפקיד');
        return;
      }

      showToast.success('התפקיד הוסר בהצלחה');
      fetchUserRoles();
      onRefresh();
    } catch (err: any) {
      showToast.error(err.message || 'שגיאה בהסרת התפקיד');
    }
  };

  // Get available users (not already assigned the selected role)
  const getAvailableUsers = () => {
    if (!formData.role_id) return users;
    const assignedUserIds = userRoles
      .filter((ur) => ur.role_id === formData.role_id)
      .map((ur) => ur.user_id);
    return users.filter((u) => !assignedUserIds.includes(u.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 ml-2" />
          הקצה תפקיד למשתמש
        </Button>
      </div>

      {userRoles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>אין הקצאות תפקידים במערכת</p>
          <Button onClick={handleCreate} variant="link" className="mt-2">
            הקצה תפקיד ראשון
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>משתמש</TableHead>
                <TableHead>אימייל</TableHead>
                <TableHead>תפקיד</TableHead>
                <TableHead>הוקצה</TableHead>
                <TableHead className="w-[80px]">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userRoles.map((userRole) => (
                <TableRow key={userRole.id}>
                  <TableCell className="font-medium">
                    {userRole.user_name || '-'}
                  </TableCell>
                  <TableCell dir="ltr" className="text-left">
                    {userRole.email || '-'}
                  </TableCell>
                  <TableCell>{userRole.roles?.display_name || '-'}</TableCell>
                  <TableCell>
                    {new Date(userRole.created_at).toLocaleDateString('he-IL')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(userRole)}
                      title="הסר תפקיד"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Assign Role Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הקצאת תפקיד למשתמש</DialogTitle>
            <DialogDescription>
              בחר משתמש ותפקיד להקצאה
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role_id">תפקיד</Label>
              <Select
                value={formData.role_id}
                onValueChange={(value) => setFormData({ ...formData, role_id: value, user_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר תפקיד" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user_id">משתמש</Label>
              <Select
                value={formData.user_id}
                onValueChange={(value) => setFormData({ ...formData, user_id: value })}
                disabled={!formData.role_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.role_id ? 'בחר משתמש' : 'בחר תפקיד קודם'} />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableUsers().map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={saving || !formData.user_id || !formData.role_id}>
                {saving ? 'מקצה...' : 'הקצה תפקיד'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      {deleteUserRole && (
        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="הסרת תפקיד ממשתמש"
          description={`האם אתה בטוח שברצונך להסיר את התפקיד "${deleteUserRole.roles?.display_name}" מהמשתמש "${deleteUserRole.user_name || deleteUserRole.email}"?`}
          confirmText="הסר"
          cancelText="ביטול"
          variant="destructive"
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
