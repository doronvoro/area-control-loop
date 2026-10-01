'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * The plot report as a PDF, previewed in place.
 *
 * Fetched as a blob rather than pointing the iframe at the route: the render
 * takes seconds, and an iframe gives no way to show progress or to tell a
 * failed render (a JSON error body) from a PDF.
 */

type State =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error'; message: string };

const LOADING: State = { status: 'loading' };

interface PlotReportDialogProps {
  /** The plot to report on; null keeps the dialog closed. */
  plotId: string | null;
  plotName: string;
  onClose: () => void;
}

export function PlotReportDialog({ plotId, plotName, onClose }: PlotReportDialogProps) {
  // Tagged with the plot it belongs to, so a result for the previous plot
  // reads as loading without resetting state inside the effect.
  const [result, setResult] = useState<{ id: string; state: State } | null>(null);
  const state = result && result.id === plotId ? result.state : LOADING;

  useEffect(() => {
    if (!plotId) return;
    const controller = new AbortController();
    let url: string | null = null;

    fetch(`/api/olive/report/plot/${plotId}/pdf`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || 'הפקת הדוח נכשלה');
        }
        url = URL.createObjectURL(await res.blob());
        setResult({ id: plotId, state: { status: 'ready', url } });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setResult({
          id: plotId,
          state: { status: 'error', message: error.message || 'הפקת הדוח נכשלה' },
        });
      });

    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [plotId]);

  return (
    <Dialog
      open={plotId !== null}
      onOpenChange={(open) => {
        if (open) return;
        // The effect's cleanup revokes the blob URL, so reopening the same
        // plot must fetch again rather than show the dead one.
        setResult(null);
        onClose();
      }}
    >
      {/* Nothing but the PDF: the browser's viewer already carries zoom,
          print and download. Framed like the sidebar's active item: its accent fill, its bright bar. The close button sits above the frame's corner
          rather than on it, where it would cover the viewer's own toolbar. */}
      <DialogContent
        showCloseButton={false}
        className="bg-sidebar-accent border-sidebar-primary h-[85vh] gap-0 border-[3px] p-1.5 sm:max-w-5xl"
      >
        <DialogTitle className="sr-only">דוח חלקה {plotName}</DialogTitle>
        <DialogDescription className="sr-only">תצוגה מקדימה של דוח החלקה</DialogDescription>
        <DialogClose
          aria-label="סגור"
          className="bg-sidebar-accent text-sidebar-primary border-sidebar-primary hover:bg-sidebar hover:text-sidebar-primary-foreground focus-visible:ring-sidebar-ring absolute -top-11 left-0 flex size-9 items-center justify-center rounded-full border-2 shadow-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <X className="size-4" />
        </DialogClose>
        <div className="bg-sidebar-accent text-sidebar-foreground flex size-full items-center justify-center overflow-hidden rounded-md">
          {state.status === 'loading' && (
            <div className="flex flex-col items-center gap-3 text-sm">
              <Loader2 className="size-8 animate-spin" />
              מפיק דוח…
            </div>
          )}
          {state.status === 'error' && (
            <div className="text-destructive p-6 text-center text-sm">{state.message}</div>
          )}
          {state.status === 'ready' && (
            <iframe src={state.url} title={`דוח חלקה ${plotName}`} className="size-full" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
