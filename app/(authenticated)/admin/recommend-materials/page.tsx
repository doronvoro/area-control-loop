import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { RecommendMaterialsManager } from '@/components/admin/RecommendMaterialsManager';
import { FlaskConical } from 'lucide-react';

export default async function RecommendMaterialsPage() {
  await requireAuth();

  const [isAdmin, isCustomerOwner] = await Promise.all([
    hasRole('admin'),
    hasRole('customer_owner'),
  ]);
  if (!isAdmin && !isCustomerOwner) {
    redirect('/dashboard');
  }

  return (
    <>
      <PageHeader
        icon={FlaskConical}
        title="ניהול המלצות חומרים"
        description="ניהול המלצות חומרים לפי גידול, סוג פעולה וחומר. לכל שילוב ניתן להגדיר מספר המלצות מינון."
      />
      <RecommendMaterialsManager />
    </>
  );
}
