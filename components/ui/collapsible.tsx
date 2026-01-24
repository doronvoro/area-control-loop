'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface CollapsibleContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | undefined>(undefined);

interface CollapsibleProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Collapsible({ open: controlledOpen, onOpenChange, children }: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const handleOpenChange = onOpenChange ?? setInternalOpen;

  return (
    <CollapsibleContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </CollapsibleContext.Provider>
  );
}

interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ asChild, className, children, ...props }, ref) => {
    const context = React.useContext(CollapsibleContext);
    if (!context) throw new Error('CollapsibleTrigger must be used within Collapsible');

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        ...props,
        onClick: () => context.onOpenChange(!context.open),
      } as any);
    }

    return (
      <button
        ref={ref}
        type="button"
        className={cn(className)}
        onClick={() => context.onOpenChange(!context.open)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
CollapsibleTrigger.displayName = 'CollapsibleTrigger';

interface CollapsibleContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ className, children, ...props }, ref) => {
    const context = React.useContext(CollapsibleContext);
    if (!context) throw new Error('CollapsibleContent must be used within Collapsible');

    if (!context.open) return null;

    return (
      <div
        ref={ref}
        className={cn('overflow-hidden transition-all', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
