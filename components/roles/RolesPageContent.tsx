'use client';

import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RolesList } from './RolesList';
import { PermissionsList } from './PermissionsList';
import { UserRolesList } from './UserRolesList';
import { Role, Permission } from '@/types/database';
import { useApiData } from '@/hooks/useApiData';

interface User {
  id: string;
  email: string;
  name: string;
}

export function RolesPageContent() {
  const { data: roles, loading: rLoading, refetch: refetchRoles } = useApiData<Role[]>('/api/roles');
  const { data: permissions, loading: pLoading, refetch: refetchPermissions } = useApiData<Permission[]>('/api/permissions');
  const { data: users, loading: uLoading, refetch: refetchUsers } = useApiData<User[]>('/api/users');

  const loading = rLoading || pLoading || uLoading;

  const refetchAll = async () => {
    await Promise.all([refetchRoles(), refetchPermissions(), refetchUsers()]);
  };

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
          roles={roles || []}
          permissions={permissions || []}
          onRefresh={refetchAll}
        />
      </TabsContent>

      <TabsContent value="permissions">
        <PermissionsList
          permissions={permissions || []}
          onRefresh={refetchAll}
        />
      </TabsContent>

      <TabsContent value="user-roles">
        <UserRolesList
          roles={roles || []}
          users={users || []}
          onRefresh={refetchAll}
        />
      </TabsContent>
    </Tabs>
  );
}
