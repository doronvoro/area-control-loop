import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { Navbar } from '@/components/layout/Navbar';
import { RecommendMaterialsManager } from '@/components/admin/RecommendMaterialsManager';

export default async function RecommendMaterialsPage() {
  await requireAuth();
  
  // Check if user is admin
  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">ניהול המלצות חומרים</h1>
        <p className="text-muted-foreground mb-6">
          ניהול המלצות חומרים לפי גידול, סוג פעולה וחומר. לכל שילוב ניתן להגדיר מספר המלצות מינון.
        </p>
        <RecommendMaterialsManager />
      </main>
    </div>
  );
}
