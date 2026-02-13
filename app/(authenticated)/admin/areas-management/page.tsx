import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { AreaManagementPageContent } from '@/components/area-management/AreaManagementPageContent';
import { MapPin } from 'lucide-react';

export default async function AreasManagementPage() {
  await requireAuth();

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
      <PageHeader
        icon={MapPin}
        title="ניהול שטחים"
        description="ניהול שטחים, תתי-שטחים ומבנה היררכי"
      />
      <AreaManagementPageContent />
    </>
  );
}
