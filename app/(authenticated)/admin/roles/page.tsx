import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { PageHeader } from '@/components/layout/PageHeader';
import { RolesPageContent } from '@/components/roles/RolesPageContent';
import { Shield } from 'lucide-react';

export default async function RolesPage() {
  await requireAuth();

  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  return (
    <>
      <PageHeader
        icon={Shield}
        title="ניהול תפקידים והרשאות"
        description="הגדרת תפקידים, הרשאות והקצאתם למשתמשים"
      />
      <RolesPageContent />
    </>
  );
}
