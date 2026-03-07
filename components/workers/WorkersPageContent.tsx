'use client';

import { WorkersList } from './WorkersList';
import { Customer, WorkerType } from '@/types/database';
import { Loader2 } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';

interface Worker {
  id: string;
  name: string;
  customer_id: string;
  type_id: string;
  user_id: string;
  email?: string | null;
  created_at?: string;
  worker_types?: WorkerType;
  customers?: Customer;
}

interface WorkersPageContentProps {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function WorkersPageContent({
  canCreate,
  canUpdate,
  canDelete,
}: WorkersPageContentProps) {
  const { data: workers, loading: wLoading, error: wError } = useApiData<Worker[]>('/api/workers?all=true');
  const { data: customers, loading: cLoading, error: cError } = useApiData<Customer[]>('/api/customers');
  const { data: workerTypes, loading: wtLoading, error: wtError } = useApiData<WorkerType[]>('/api/worker-types');

  const loading = wLoading || cLoading || wtLoading;
  const error = wError || cError || wtError;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <WorkersList
      workers={workers || []}
      customers={customers || []}
      workerTypes={workerTypes || []}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}
