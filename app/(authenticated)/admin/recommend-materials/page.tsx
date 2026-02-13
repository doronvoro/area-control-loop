import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { RecommendMaterialsManager } from '@/components/admin/RecommendMaterialsManager';

export default async function RecommendMaterialsPage() {
  await requireAuth();

  // Admins and customer owners can access this page
  const [isAdmin, isCustomerOwner] = await Promise.all([
    hasRole('admin'),
    hasRole('customer_owner'),
  ]);
  if (!isAdmin && !isCustomerOwner) {
    redirect('/dashboard');
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">ניהול המלצות חומרים</h1>
      <p className="text-muted-foreground mb-6">
        ניהול המלצות חומרים לפי גידול, סוג פעולה וחומר. לכל שילוב ניתן להגדיר מספר המלצות מינון.
      </p>
      <RecommendMaterialsManager />
    </>
  );
}
