import type { GeoJSONPolygon } from '@/components/map/types';
import type {
  GeneratedSubArea,
  LevelSplitConfig,
  SplitDirection,
} from '../types';

/**
 * Bounding box of a polygon
 */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Create a rectangle GeoJSON Polygon from origin and dimensions (in meters)
 */
export function createRectangleGeometry(
  originX: number,
  originY: number,
  width: number,
  height: number
): GeoJSONPolygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [originX, originY],
        [originX + width, originY],
        [originX + width, originY + height],
        [originX, originY + height],
        [originX, originY], // close the ring
      ],
    ],
  };
}

/**
 * Get the bounding box of a GeoJSON Polygon
 */
export function getBounds(polygon: GeoJSONPolygon): Bounds {
  const coords = polygon.coordinates[0];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Subdivide a rectangle polygon into N equal strips.
 * - 'vertical' splits along the X axis (columns, side by side)
 * - 'horizontal' splits along the Y axis (rows, stacked)
 */
export function subdivideRectangle(
  parent: GeoJSONPolygon,
  count: number,
  direction: SplitDirection
): GeoJSONPolygon[] {
  if (count <= 0) return [];
  if (count === 1) return [parent];

  const bounds = getBounds(parent);
  const results: GeoJSONPolygon[] = [];

  if (direction === 'vertical') {
    const stripWidth = (bounds.maxX - bounds.minX) / count;
    for (let i = 0; i < count; i++) {
      const x0 = bounds.minX + i * stripWidth;
      const x1 = x0 + stripWidth;
      results.push({
        type: 'Polygon',
        coordinates: [
          [
            [x0, bounds.minY],
            [x1, bounds.minY],
            [x1, bounds.maxY],
            [x0, bounds.maxY],
            [x0, bounds.minY],
          ],
        ],
      });
    }
  } else {
    const stripHeight = (bounds.maxY - bounds.minY) / count;
    for (let i = 0; i < count; i++) {
      const y0 = bounds.minY + i * stripHeight;
      const y1 = y0 + stripHeight;
      results.push({
        type: 'Polygon',
        coordinates: [
          [
            [bounds.minX, y0],
            [bounds.maxX, y0],
            [bounds.maxX, y1],
            [bounds.minX, y1],
            [bounds.minX, y0],
          ],
        ],
      });
    }
  }

  return results;
}

/**
 * Generate the full sub-area hierarchy by recursively applying
 * split configs at each level.
 *
 * @param areaGeometry The outer area polygon
 * @param levelConfigs All split configs (each specifies its parentTempId)
 * @param maxLevels Maximum depth of levels (1, 2, or 3)
 * @returns Array of GeneratedSubArea with computed geometries
 */
export function generateHierarchy(
  areaGeometry: GeoJSONPolygon,
  levelConfigs: LevelSplitConfig[],
  maxLevels: number
): GeneratedSubArea[] {
  const result: GeneratedSubArea[] = [];

  // Start with the area as the root
  let currentParents: { tempId: string; geometry: GeoJSONPolygon }[] = [
    { tempId: 'root', geometry: areaGeometry },
  ];

  for (let level = 1; level <= maxLevels; level++) {
    const nextParents: { tempId: string; geometry: GeoJSONPolygon }[] = [];

    for (const parent of currentParents) {
      // Find config for this parent
      const config = levelConfigs.find(
        (c) => c.parentTempId === parent.tempId
      );
      if (!config || config.count === 0) continue;

      const childGeometries = subdivideRectangle(
        parent.geometry,
        config.count,
        config.direction
      );

      for (let i = 0; i < childGeometries.length; i++) {
        const tempId = `${parent.tempId}_L${level}_${i}`;
        const name =
          config.naming.type === 'custom' && config.naming.customNames?.[i]
            ? config.naming.customNames[i]
            : `${config.naming.prefix} ${i + 1}`;

        const subArea: GeneratedSubArea = {
          tempId,
          parentTempId: parent.tempId === 'root' ? null : parent.tempId,
          level,
          name,
          geometry: childGeometries[i],
        };

        result.push(subArea);
        nextParents.push({ tempId, geometry: childGeometries[i] });
      }
    }

    currentParents = nextParents;
  }

  return result;
}

/**
 * Calculate the area of a polygon in square meters (for simple rectangles)
 */
export function calculateArea(polygon: GeoJSONPolygon): number {
  const bounds = getBounds(polygon);
  return (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY);
}
