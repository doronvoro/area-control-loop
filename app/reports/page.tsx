import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { ReportsPageContent } from '@/components/reports/ReportsPageContent';

export default async function ReportsPage() {
  await requireAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">דוחות</h1>
        <ReportsPageContent />
      </main>
    </div>
  );
}
