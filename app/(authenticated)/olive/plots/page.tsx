import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { OlivePlotsContent } from '@/components/olive/OlivePlotsContent';
import { MapPin } from 'lucide-react';
import '../olive.css';

export default async function OlivePlotsPage() {
  await requireAuth();

  return (
    <>
      <PageHeader icon={MapPin} title="חלקות זית" description="פרטי חלקות, זנים ועומס יבול" />
      <OlivePlotsContent />
    </>
  );
}
