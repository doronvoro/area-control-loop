import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { UnifiedAreasPageContent } from '@/components/areas-unified/UnifiedAreasPageContent';
import { MapPin } from 'lucide-react';

export default async function AreasPage() {
  await requireAuth();

  const [canCreateArea, canUpdateArea, canCreateSubArea, canUpdateSubArea] =
    await Promise.all([
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
        title="שטחים"
        description="ניהול שטחים, עיצוב ומפה חיה"
      />
      <UnifiedAreasPageContent />
    </>
  );
}
