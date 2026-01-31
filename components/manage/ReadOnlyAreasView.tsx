'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, MapPin, FileText, Folder, FolderOpen } from 'lucide-react';
import Link from 'next/link';

interface SubArea {
  id: string;
  name: string;
  variety?: string | null;
  rows?: string | null;
  parent_sub_area_id?: string | null;
  level?: number;
  area_id: string;
  display?: string;
  children?: SubArea[];
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

interface ReadOnlyAreasViewProps {
  areas: AreaWithOwner[];
}

export function ReadOnlyAreasView({ areas }: ReadOnlyAreasViewProps) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [areaSubAreas, setAreaSubAreas] = useState<Map<string, SubArea[]>>(new Map());
  const [loadingAreas, setLoadingAreas] = useState<Set<string>>(new Set());

  const toggleExpand = async (areaId: string) => {
    const newExpanded = new Set(expandedAreas);
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId);
    } else {
      newExpanded.add(areaId);
      // Load sub-areas if not already loaded
      if (!areaSubAreas.has(areaId)) {
        await fetchSubAreas(areaId);
      }
    }
    setExpandedAreas(newExpanded);
  };

  const fetchSubAreas = async (areaId: string) => {
    setLoadingAreas((prev) => new Set(prev).add(areaId));
    try {
      const response = await fetch(`/api/sub-areas/tree?areaId=${areaId}`);
      if (response.ok) {
        const data = await response.json();
        setAreaSubAreas((prev) => new Map(prev).set(areaId, data));
      }
    } catch (err) {
      console.error('Error fetching sub-areas:', err);
    } finally {
      setLoadingAreas((prev) => {
        const next = new Set(prev);
        next.delete(areaId);
        return next;
      });
    }
  };

  const renderSubArea = (subArea: SubArea, depth: number = 0) => {
    const hasChildren = subArea.children && subArea.children.length > 0;

    return (
      <div key={subArea.id} className="select-none">
        <div
          className="flex items-center gap-2 p-2 hover:bg-muted rounded-md"
          style={{ paddingRight: `${depth * 1.5 + 0.5}rem` }}
        >
          <div className="flex items-center gap-1 flex-1">
            {hasChildren ? (
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            ) : (
              <div className="w-4" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{subArea.display || subArea.name}</p>
              {(subArea.variety || subArea.rows) && (
                <p className="text-xs text-muted-foreground">
                  {[subArea.variety, subArea.rows].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>
          </div>
        </div>
        {hasChildren && (
          <div className="mr-4">
            {subArea.children!.map((child) => renderSubArea(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (areas.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>אין שטחים זמינים</p>
        <p className="text-sm mt-2">פנה למנהל להקצאת שטחים</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">השטחים שלי</h2>
        <Badge variant="secondary">{areas.length} שטחים</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) => {
          const isExpanded = expandedAreas.has(area.id);
          const isLoading = loadingAreas.has(area.id);
          const subAreas = areaSubAreas.get(area.id) || [];

          return (
            <Card key={area.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{area.name}</CardTitle>
              </CardHeader>
              <CardContent>
                {area.description && (
                  <p className="text-sm text-muted-foreground mb-4">{area.description}</p>
                )}

                {/* Sub-areas toggle */}
                <button
                  onClick={() => toggleExpand(area.id)}
                  className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors w-full mb-3"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Folder className="h-4 w-4" />
                  <span>תת-שטחים</span>
                </button>

                {isExpanded && (
                  <div className="mb-4 border rounded-lg p-2 max-h-[200px] overflow-y-auto">
                    {isLoading ? (
                      <p className="text-sm text-muted-foreground text-center py-4">טוען...</p>
                    ) : subAreas.length > 0 ? (
                      subAreas.map((subArea) => renderSubArea(subArea))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">אין תת-שטחים</p>
                    )}
                  </div>
                )}

                {/* Create report button */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" asChild>
                    <Link href={`/monitoring?areaId=${area.id}`}>
                      <FileText className="h-4 w-4 ml-2" />
                      דוח ניטור
                    </Link>
                  </Button>
                  <Button variant="outline" className="flex-1" asChild>
                    <Link href={`/actions?areaId=${area.id}`}>
                      <FileText className="h-4 w-4 ml-2" />
                      דוח פעולות
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
