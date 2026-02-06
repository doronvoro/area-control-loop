import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { hasPermission, hasRole } from '@/lib/permissions';
import { WorkersList } from '@/components/workers/WorkersList';

export default async function WorkersPage() {
  await requireAuth();

  // Only admins can access this page
  const isAdmin = await hasRole('admin');
  if (!isAdmin) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Check permissions
  const canCreateWorker = await hasPermission('create_worker');
  const canUpdateWorker = await hasPermission('update_worker');
  const canDeleteWorker = await hasPermission('delete_worker');

  // Get all workers with related data
  const { data: workersData } = await supabase
    .from('workers')
    .select('*, worker_types(*), customers(*)')
    .order('name');

  // Get emails from auth.users using admin client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workers: any[] = [];
  try {
    const adminClient = createAdminClient();
    workers = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (workersData || []).map(async (worker: any) => {
        const { data: userData } = await adminClient.auth.admin.getUserById(worker.user_id);
        return {
          ...worker,
          email: userData?.user?.email || null,
        };
      })
    );
  } catch {
    // Fallback without emails if admin client fails
    workers = workersData || [];
  }

  // Get all customers for the filter
  const { data: customers } = await supabase.from('customers').select('*').order('name');

  // Get all worker types
  const { data: workerTypes } = await supabase.from('worker_types').select('*').order('name');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">ניהול עובדים</h1>

        <WorkersList
          workers={workers}
          customers={customers || []}
          workerTypes={workerTypes || []}
          canCreate={canCreateWorker}
          canUpdate={canUpdateWorker}
          canDelete={canDeleteWorker}
        />
      </main>
    </div>
  );
}
