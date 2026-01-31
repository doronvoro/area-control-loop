'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Building2, MapPin, Calendar } from 'lucide-react';
import { CustomerForm } from '@/components/customers/CustomerForm';

interface CustomerArea {
  id: string;
  name: string;
  description: string | null;
}

interface CustomerWithAreas {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  areas: CustomerArea[];
}

interface Permissions {
  canUpdateCustomer: boolean;
}

interface MyBusinessSectionProps {
  customer: CustomerWithAreas | null;
  permissions: Permissions;
}

export function MyBusinessSection({ customer, permissions }: MyBusinessSectionProps) {
  const [formOpen, setFormOpen] = useState(false);

  const handleSuccess = () => {
    window.location.reload();
  };

  if (!customer) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>לא נמצא מידע על העסק</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Business info card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{customer.name}</CardTitle>
                  <CardDescription>פרטי העסק</CardDescription>
                </div>
              </div>
              {permissions.canUpdateCustomer && (
                <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
                  <Pencil className="h-4 w-4 ml-2" />
                  ערוך
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">תיאור</p>
                <p className="text-sm">{customer.description}</p>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>נוצר: {new Date(customer.created_at).toLocaleDateString('he-IL')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Areas summary card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MapPin className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle>שטחים</CardTitle>
                <CardDescription>סיכום השטחים שלך</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">סה&quot;כ שטחים</span>
              <Badge variant="secondary" className="text-lg px-3">
                {customer.areas.length}
              </Badge>
            </div>

            {customer.areas.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground mb-2">רשימת שטחים:</p>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {customer.areas.map((area) => (
                    <div
                      key={area.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                    >
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{area.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                אין שטחים משויכים לעסק
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {permissions.canUpdateCustomer && (
        <CustomerForm
          customer={customer}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
