'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RolesList } from './RolesList';
import { PermissionsList } from './PermissionsList';
import { UserRolesList } from './UserRolesList';
import { Role, Permission } from '@/types/database';

interface User {
  id: string;
  email: string;
  name: string;
}

export function RolesPageContent() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permissionsRes, usersRes] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/permissions'),
        fetch('/api/users'),
      ]);

      if (rolesRes.ok) {
        setRoles(await rolesRes.json());
      }
      if (permissionsRes.ok) {
        setPermissions(await permissionsRes.json());
      }
      if (usersRes.ok) {
        setUsers(await usersRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="roles" dir="rtl">
      <TabsList className="mb-6">
        <TabsTrigger value="roles">תפקידים</TabsTrigger>
        <TabsTrigger value="permissions">הרשאות</TabsTrigger>
        <TabsTrigger value="user-roles">הקצאת תפקידים למשתמשים</TabsTrigger>
      </TabsList>

      <TabsContent value="roles">
        <RolesList
          roles={roles}
          permissions={permissions}
          onRefresh={fetchData}
        />
      </TabsContent>

      <TabsContent value="permissions">
        <PermissionsList
          permissions={permissions}
          onRefresh={fetchData}
        />
      </TabsContent>

      <TabsContent value="user-roles">
        <UserRolesList
          roles={roles}
          users={users}
          onRefresh={fetchData}
        />
      </TabsContent>
    </Tabs>
  );
}
