/**
 * RTL utilities for Hebrew support
 */

export function isRTL(locale?: string): boolean {
  // For now, default to RTL for Hebrew customers
  // In the future, this can check customer locale from database
  return true; // First customer requires Hebrew RTL support
}

export function getDirection(locale?: string): 'rtl' | 'ltr' {
  return isRTL(locale) ? 'rtl' : 'ltr';
}

export function getLanguage(locale?: string): string {
  return isRTL(locale) ? 'he' : 'en';
}

/**
 * Mirror class names for RTL
 */
export function rtlClass(className: string, isRtl: boolean = true): string {
  if (!isRtl) return className;
  
  // Mirror common directional classes
  const mirrorMap: Record<string, string> = {
    'left': 'right',
    'right': 'left',
    'ml-': 'mr-',
    'mr-': 'ml-',
    'pl-': 'pr-',
    'pr-': 'pl-',
    'text-left': 'text-right',
    'text-right': 'text-left',
    'float-left': 'float-right',
    'float-right': 'float-left',
  };
  
  let mirrored = className;
  Object.entries(mirrorMap).forEach(([from, to]) => {
    mirrored = mirrored.replace(new RegExp(from, 'g'), to);
  });
  
  return mirrored;
}
