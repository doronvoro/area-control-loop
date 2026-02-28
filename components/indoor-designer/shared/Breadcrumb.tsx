'use client';

import { ChevronLeft } from 'lucide-react';
import type { BreadcrumbSegment } from '../types';

interface DesignerBreadcrumbProps {
  segments: BreadcrumbSegment[];
  onNavigate: (nodeId: string) => void;
}

export function DesignerBreadcrumb({
  segments,
  onNavigate,
}: DesignerBreadcrumbProps) {
  if (segments.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-sm min-h-[24px] flex-wrap">
      {segments.map((seg, i) => (
        <span key={seg.id} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          {i < segments.length - 1 ? (
            <button
              onClick={() => onNavigate(seg.id)}
              className="text-muted-foreground hover:text-foreground transition-colors hover:underline"
            >
              {seg.name}
            </button>
          ) : (
            <span className="font-semibold text-foreground">{seg.name}</span>
          )}
        </span>
      ))}
    </div>
  );
}
