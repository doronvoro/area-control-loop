'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Pencil, Trash2, Plus, Building2, MapPin, Folder } from 'lucide-react';
import type { Customer, Area, SubArea, Permissions } from './AreaManagementLayout';

interface ItemDetailViewProps {
  type: 'customer' | 'area' | 'sub_area';
  data: Customer | Area | SubArea;
  permissions: Permissions;
  onEdit?: () => void;
  onDelete?: () => void;
  onCreateChild?: () => void;
  createChildLabel?: string;
}

export function ItemDetailView({
  type,
  data,
  permissions,
  onEdit,
  onDelete,
  onCreateChild,
  createChildLabel,
}: ItemDetailViewProps) {
  const getIcon = () => {
    switch (type) {
      case 'customer':
        return <Building2 className="h-6 w-6 text-blue-500" />;
      case 'area':
        return <MapPin className="h-6 w-6 text-green-500" />;
      case 'sub_area':
        return <Folder className="h-6 w-6 text-amber-500" />;
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'customer':
        return 'לקוח';
      case 'area':
        return 'שטח';
      case 'sub_area':
        return 'תת-שטח';
    }
  };

  const renderCustomerDetails = (customer: Customer) => (
    <>
      <div className="space-y-4">
        <div>
          <Label className="text-muted-foreground">שם</Label>
          <p className="font-medium text-lg">{customer.name}</p>
        </div>
        {customer.description && (
          <div>
            <Label className="text-muted-foreground">תיאור</Label>
            <p className="font-medium">{customer.description}</p>
          </div>
        )}
      </div>
      <Separator className="my-4" />
      <div>
        <Label className="text-muted-foreground">מזהה</Label>
        <p className="font-mono text-sm text-muted-foreground">{customer.id}</p>
      </div>
    </>
  );

  const renderAreaDetails = (area: Area) => (
    <>
      <div className="space-y-4">
        <div>
          <Label className="text-muted-foreground">שם</Label>
          <p className="font-medium text-lg">{area.name}</p>
        </div>
        {area.description && (
          <div>
            <Label className="text-muted-foreground">תיאור</Label>
            <p className="font-medium">{area.description}</p>
          </div>
        )}
        {area.crop_id && (
          <div>
            <Label className="text-muted-foreground">גידול</Label>
            <p className="font-medium">{area.crop_id}</p>
          </div>
        )}
      </div>
      <Separator className="my-4" />
      <div>
        <Label className="text-muted-foreground">מזהה</Label>
        <p className="font-mono text-sm text-muted-foreground">{area.id}</p>
      </div>
    </>
  );

  const renderSubAreaDetails = (subArea: SubArea) => (
    <>
      <div className="space-y-4">
        <div>
          <Label className="text-muted-foreground">שם</Label>
          <p className="font-medium text-lg">{subArea.name}</p>
        </div>
        {subArea.display && (
          <div>
            <Label className="text-muted-foreground">נתיב מלא</Label>
            <p className="font-medium">{subArea.display}</p>
          </div>
        )}
        {subArea.variety && (
          <div>
            <Label className="text-muted-foreground">זן</Label>
            <p className="font-medium">{subArea.variety}</p>
          </div>
        )}
        {subArea.rows && (
          <div>
            <Label className="text-muted-foreground">שורות</Label>
            <p className="font-medium">{subArea.rows}</p>
          </div>
        )}
        <div>
          <Label className="text-muted-foreground">רמה</Label>
          <p className="font-medium">{subArea.level}</p>
        </div>
        {subArea.crop_id && (
          <div>
            <Label className="text-muted-foreground">גידול</Label>
            <p className="font-medium">{subArea.crop_id}</p>
          </div>
        )}
      </div>
      <Separator className="my-4" />
      <div className="space-y-2">
        <div>
          <Label className="text-muted-foreground">מזהה</Label>
          <p className="font-mono text-sm text-muted-foreground">{subArea.id}</p>
        </div>
        <div>
          <Label className="text-muted-foreground">מזהה שטח</Label>
          <p className="font-mono text-sm text-muted-foreground">{subArea.area_id}</p>
        </div>
        {subArea.parent_sub_area_id && (
          <div>
            <Label className="text-muted-foreground">תת-שטח אב</Label>
            <p className="font-mono text-sm text-muted-foreground">{subArea.parent_sub_area_id}</p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getIcon()}
            <div>
              <p className="text-sm text-muted-foreground">{getTypeLabel()}</p>
              <CardTitle className="text-2xl">{data.name}</CardTitle>
            </div>
          </div>
          <div className="flex gap-2">
            {onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-4 w-4 ml-2" />
                ערוך
              </Button>
            )}
            {onDelete && (
              <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4 ml-2" />
                מחק
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {type === 'customer' && renderCustomerDetails(data as Customer)}
        {type === 'area' && renderAreaDetails(data as Area)}
        {type === 'sub_area' && renderSubAreaDetails(data as SubArea)}

        {onCreateChild && createChildLabel && (
          <>
            <Separator className="my-4" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">אין פריטים משויכים</p>
              <Button onClick={onCreateChild}>
                <Plus className="h-4 w-4 ml-2" />
                {createChildLabel}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
