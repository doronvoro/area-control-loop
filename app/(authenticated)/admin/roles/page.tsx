import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { RolesPageContent } from '@/components/roles/RolesPageContent';

export default async function RolesPage() {
  await requireAuth();

  // Only admins can access this page
  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  return (
    <>
      <h1 className="text-3xl font-bold mb-8">ניהול תפקידים והרשאות</h1>
      <RolesPageContent />
    </>
  );
}
