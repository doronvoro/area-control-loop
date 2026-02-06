import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { ActionsPageContent } from '@/components/actions/ActionsPageContent';

export default async function ActionsPage() {
  await requireAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">טופס פעולה</h1>
        <ActionsPageContent />
      </main>
    </div>
  );
}
