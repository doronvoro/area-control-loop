import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardContent } from '@/components/dashboard/DashboardContent';

export default async function DashboardPage() {
  await requireAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">דשבורד</h1>
        <DashboardContent />
      </main>
    </div>
  );
}
