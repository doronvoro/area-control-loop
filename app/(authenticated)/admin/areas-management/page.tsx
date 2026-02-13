import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { AreaManagementPageContent } from '@/components/area-management/AreaManagementPageContent';

export default async function AreasManagementPage() {
  await requireAuth();

  // Check permissions - allow access if user has any area management permission
  const [canCreateArea, canUpdateArea, canCreateSubArea, canUpdateSubArea] = await Promise.all([
    hasPermission('create_area'),
    hasPermission('update_area'),
    hasPermission('create_sub_area'),
    hasPermission('update_sub_area'),
  ]);

  const hasAnyAreaPermission =
    canCreateArea || canUpdateArea || canCreateSubArea || canUpdateSubArea;
  if (!hasAnyAreaPermission) {
    redirect('/dashboard');
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">ניהול שטחים</h1>
      <AreaManagementPageContent />
    </>
  );
}
