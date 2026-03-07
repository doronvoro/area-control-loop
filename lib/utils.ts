import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Build a display label for a sub-area dropdown item.
 * Shows crop/variety info only when it differs from the parent area.
 */
export function getSubAreaLabel(
  subArea: { display?: string | null; name: string; crops?: { name: string } | null; variety?: string | null; area_crop_name?: string | null; area_variety?: string | null },
  areaCropName?: string | null,
  areaVariety?: string | null,
): string {
  const baseName = subArea.display || subArea.name;
  const resolvedAreaCrop = areaCropName ?? subArea.area_crop_name ?? null;
  const resolvedAreaVariety = areaVariety ?? subArea.area_variety ?? null;
  const subCrop = subArea.crops?.name || null;
  const subVariety = subArea.variety || null;

  const cropDiffers = subCrop && subCrop !== resolvedAreaCrop;
  const varietyDiffers = subVariety && subVariety !== resolvedAreaVariety;

  if (cropDiffers) {
    return subVariety ? `${baseName} (${subCrop}, ${subVariety})` : `${baseName} (${subCrop})`;
  }
  if (varietyDiffers) {
    return `${baseName} (${subVariety})`;
  }
  return baseName;
}
