'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, MapPin, Folder, Layers } from 'lucide-react';
import type { Area, SubArea, Permissions } from './AreaManagementLayout';

interface CardGridProps {
  title: string;
  items: (Area | SubArea)[];
  itemType: 'area' | 'sub_area';
  permissions: Permissions;
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
  onCreate?: () => void;
  createLabel?: string;
}

export function CardGrid({
  title,
  items,
  itemType,
  permissions,
  onEdit,
  onDelete,
  onCreate,
  createLabel = 'הוסף חדש',
}: CardGridProps) {
  const canEdit = itemType === 'area' ? permissions.canUpdateArea : permissions.canUpdateSubArea;
  const canDelete = itemType === 'area' ? permissions.canDeleteArea : permissions.canDeleteSubArea;

  const getIcon = () => {
    return itemType === 'area' ? (
      <MapPin className="h-5 w-5 text-green-500" />
    ) : (
      <Folder className="h-5 w-5 text-amber-500" />
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">{title}</CardTitle>
          {onCreate && (
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4 ml-2" />
              {createLabel}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>אין פריטים להצגה</p>
            {onCreate && (
              <Button onClick={onCreate} variant="link" className="mt-2">
                {createLabel}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getIcon()}
                      <CardTitle className="text-base">{item.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(item);
                          }}
                          title="ערוך"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item);
                          }}
                          title="מחק"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {'description' in item && item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  {'variety' in item && item.variety && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">זן:</span> {item.variety}
                    </p>
                  )}
                  {'rows' in item && item.rows && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">שורות:</span> {item.rows}
                    </p>
                  )}
                  {'children' in item && item.children && item.children.length > 0 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      <span className="font-medium">{item.children.length}</span> תת-שטחים
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
