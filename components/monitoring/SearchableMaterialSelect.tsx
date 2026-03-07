'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { ChevronDown, X, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Material {
  id: string;
  name: string;
  description?: string;
  recommended_dosage?: number | null;
  recommended_unit_type?: string | null;
}

interface SearchableMaterialSelectProps {
  materials: Material[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function getMaterialLabel(material: Material): string {
  const name = material.description || material.name;
  if (material.recommended_dosage && material.recommended_unit_type) {
    return `${name} (${material.recommended_dosage} ${material.recommended_unit_type})`;
  }
  return name;
}

export function SearchableMaterialSelect({
  materials,
  value,
  onValueChange,
  placeholder = 'בחר חומר',
  disabled = false,
  className,
}: SearchableMaterialSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const sortedMaterials = useMemo(
    () =>
      [...materials].sort((a, b) =>
        (a.description || a.name || '').localeCompare(b.description || b.name || '', 'he')
      ),
    [materials]
  );

  const filteredMaterials = useMemo(() => {
    if (!search.trim()) return sortedMaterials;
    const term = search.trim().toLowerCase();
    return sortedMaterials.filter((m) => {
      const label = getMaterialLabel(m).toLowerCase();
      return label.includes(term);
    });
  }, [sortedMaterials, search]);

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === value),
    [materials, value]
  );

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSelect = (materialId: string) => {
    onValueChange(materialId);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange('');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'monitoring-select-trigger',
            className
          )}
        >
          <span className={cn('truncate', !selectedMaterial && 'text-muted-foreground')}>
            {selectedMaterial ? getMaterialLabel(selectedMaterial) : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {value && (
              <span
                role="button"
                tabIndex={-1}
                onClick={handleClear}
                className="rounded-sm p-0.5 hover:bg-accent cursor-pointer"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        sideOffset={4}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש חומר..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="shrink-0">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="max-h-[250px] overflow-y-auto p-1">
          {filteredMaterials.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              לא נמצאו תוצאות
            </div>
          ) : (
            filteredMaterials.map((material) => (
              <button
                key={material.id}
                type="button"
                onClick={() => handleSelect(material.id)}
                className={cn(
                  'relative flex w-full cursor-pointer items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none',
                  'hover:bg-accent hover:text-accent-foreground',
                  material.id === value && 'bg-accent text-accent-foreground'
                )}
              >
                {material.id === value && (
                  <span className="absolute right-2 flex size-3.5 items-center justify-center">
                    <Check className="size-4" />
                  </span>
                )}
                {getMaterialLabel(material)}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
