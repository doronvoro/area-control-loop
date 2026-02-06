import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { MonitoringPageContent } from '@/components/monitoring/MonitoringPageContent';

export default async function MonitoringPage() {
  await requireAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">טופס ניטור</h1>
        <MonitoringPageContent />
      </main>
    </div>
  );
}
