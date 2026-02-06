'use client';

import { useState, useEffect } from 'react';
import { WorkersList } from './WorkersList';
import { Customer, WorkerType } from '@/types/database';
import { Loader2 } from 'lucide-react';

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
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workerTypes, setWorkerTypes] = useState<WorkerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [workersRes, customersRes, workerTypesRes] = await Promise.all([
          fetch('/api/workers?all=true'),
          fetch('/api/customers'),
          fetch('/api/worker-types'),
        ]);

        if (!workersRes.ok) {
          const errorData = await workersRes.json();
          throw new Error(errorData.error || 'שגיאה בטעינת העובדים');
        }

        if (!customersRes.ok) {
          const errorData = await customersRes.json();
          throw new Error(errorData.error || 'שגיאה בטעינת הלקוחות');
        }

        if (!workerTypesRes.ok) {
          const errorData = await workerTypesRes.json();
          throw new Error(errorData.error || 'שגיאה בטעינת סוגי העובדים');
        }

        const [workersData, customersData, workerTypesData] = await Promise.all([
          workersRes.json(),
          customersRes.json(),
          workerTypesRes.json(),
        ]);

        setWorkers(workersData);
        setCustomers(customersData);
        setWorkerTypes(workerTypesData);
      } catch (err: any) {
        setError(err.message || 'שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

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
      workers={workers}
      customers={customers}
      workerTypes={workerTypes}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}
