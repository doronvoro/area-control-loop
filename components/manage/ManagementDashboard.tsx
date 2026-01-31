'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomersSection } from './CustomersSection';
import { AreasSection } from './AreasSection';
import { ReadOnlyAreasView } from './ReadOnlyAreasView';
import { MyBusinessSection } from './MyBusinessSection';

interface CustomerWithAreas {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  areas: Array<{
    id: string;
    name: string;
    description: string | null;
  }>;
}

interface AreaWithOwner {
  id: string;
  name: string;
  description: string | null;
  customer?: {
    id: string;
    name: string;
  } | null;
}

interface Permissions {
  canCreateCustomer: boolean;
  canUpdateCustomer: boolean;
  canDeleteCustomer: boolean;
  canCreateArea: boolean;
  canUpdateArea: boolean;
  canDeleteArea: boolean;
  canCreateSubArea: boolean;
  canUpdateSubArea: boolean;
  canDeleteSubArea: boolean;
  canAddAreaToCustomer: boolean;
  canRemoveAreaFromCustomer: boolean;
}

interface ManagementDashboardProps {
  isAdmin: boolean;
  isCustomerOwner: boolean;
  isWorker: boolean;
  permissions: Permissions;
  customersWithAreas: CustomerWithAreas[];
  areasWithOwners: AreaWithOwner[];
  unassignedAreas: AreaWithOwner[];
  ownCustomer: CustomerWithAreas | null;
  ownAreas: AreaWithOwner[];
  allCustomers: { id: string; name: string }[];
}

export function ManagementDashboard({
  isAdmin,
  isCustomerOwner,
  isWorker,
  permissions,
  customersWithAreas,
  areasWithOwners,
  unassignedAreas,
  ownCustomer,
  ownAreas,
  allCustomers,
}: ManagementDashboardProps) {
  // Determine default tab based on role
  const getDefaultTab = () => {
    if (isAdmin) return 'customers';
    if (isCustomerOwner) return 'my-business';
    return 'areas';
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab());

  // Worker view - read-only
  if (isWorker && !isAdmin && !isCustomerOwner) {
    return <ReadOnlyAreasView areas={ownAreas} />;
  }

  // Build tabs based on role
  const tabs = [];
  if (isAdmin) {
    tabs.push({ id: 'customers', label: 'לקוחות' });
    tabs.push({ id: 'areas', label: 'שטחים' });
  } else if (isCustomerOwner) {
    tabs.push({ id: 'my-business', label: 'העסק שלי' });
    tabs.push({ id: 'areas', label: 'השטחים שלי' });
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="mb-6">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {isAdmin && (
        <>
          <TabsContent value="customers">
            <CustomersSection
              customers={customersWithAreas}
              unassignedAreas={unassignedAreas}
              permissions={permissions}
            />
          </TabsContent>
          <TabsContent value="areas">
            <AreasSection
              areas={areasWithOwners}
              customers={allCustomers}
              isAdmin={isAdmin}
              permissions={permissions}
            />
          </TabsContent>
        </>
      )}

      {isCustomerOwner && !isAdmin && (
        <>
          <TabsContent value="my-business">
            <MyBusinessSection customer={ownCustomer} permissions={permissions} />
          </TabsContent>
          <TabsContent value="areas">
            <AreasSection
              areas={ownAreas}
              customers={[]}
              isAdmin={false}
              customerId={ownCustomer?.id || null}
              permissions={permissions}
            />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}
