// Polygon styles per hierarchy level for the indoor canvas

export const AREA_OUTLINE_STYLE = {
  color: '#1e40af',
  fillColor: '#dbeafe',
  fillOpacity: 0.08,
  weight: 3,
};

export const LEVEL_1_STYLE = {
  color: '#7c3aed',
  fillColor: '#ede9fe',
  fillOpacity: 0.15,
  weight: 2,
};

export const LEVEL_2_STYLE = {
  color: '#059669',
  fillColor: '#d1fae5',
  fillOpacity: 0.2,
  weight: 1.5,
  dashArray: '4, 4',
};

export const LEVEL_3_STYLE = {
  color: '#d97706',
  fillColor: '#fef3c7',
  fillOpacity: 0.25,
  weight: 1,
  dashArray: '2, 2',
};

export const SELECTED_STYLE = {
  color: '#f59e0b',
  weight: 3,
};

export const DIMMED_STYLE = {
  fillOpacity: 0.05,
  opacity: 0.3,
  weight: 0.5,
};

export function getStyleForLevel(level: number) {
  switch (level) {
    case 0:
      return AREA_OUTLINE_STYLE;
    case 1:
      return LEVEL_1_STYLE;
    case 2:
      return LEVEL_2_STYLE;
    case 3:
      return LEVEL_3_STYLE;
    default:
      return LEVEL_3_STYLE;
  }
}

// Legend items for the indoor canvas
export const LEGEND_ITEMS = [
  { label: 'שטח', style: AREA_OUTLINE_STYLE, dashed: false },
  { label: 'רמה 1 (אזורים)', style: LEVEL_1_STYLE, dashed: false },
  { label: 'רמה 2 (אשנבים)', style: LEVEL_2_STYLE, dashed: true },
  { label: 'רמה 3 (שורות)', style: LEVEL_3_STYLE, dashed: true },
];
