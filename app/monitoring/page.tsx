import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { MonitoringPageContent } from '@/components/monitoring/MonitoringPageContent';
import './monitoring.css';

export default async function MonitoringPage() {
  await requireAuth();

  return (
    <div className="min-h-screen monitoring-page">
      <Navbar />
      <main className="container mx-auto px-4 py-8 md:py-10">
        <MonitoringPageContent />
      </main>
    </div>
  );
}
