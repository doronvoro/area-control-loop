import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { OliveDashboardContent } from '@/components/olive/OliveDashboardContent';
import { Sprout } from 'lucide-react';
import './olive.css';

export default async function OlivePage() {
  await requireAuth();

  return (
    <>
      <PageHeader icon={Sprout} title="מסיק" description="סטטוס הבשלה ודחיפות מסיק לכל החלקות" />
      <OliveDashboardContent />
    </>
  );
}
