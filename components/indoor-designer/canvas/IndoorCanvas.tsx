'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import type { GeoJSONPolygon } from '@/components/map/types';
import type { GeneratedSubArea, IndoorDrawingState, SelectionContext } from '../types';
import {
  AREA_OUTLINE_STYLE,
  getStyleForLevel,
  SELECTED_STYLE,
  DIMMED_STYLE,
  LEGEND_ITEMS,
} from './indoor-canvas-styles';

interface IndoorCanvasProps {
  areaGeometry: GeoJSONPolygon | null;
  subAreas: GeneratedSubArea[];
  width: number;
  height: number;
  drawingState: IndoorDrawingState;
  selectedTempId: string | null;
  selectionContext?: SelectionContext;
  onPolygonCreated?: (geometry: GeoJSONPolygon) => void;
  onSubAreaEdited?: (tempId: string, geometry: GeoJSONPolygon) => void;
  onSubAreaSelect?: (tempId: string) => void;
  showLabels?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
}

export function IndoorCanvas({
  areaGeometry,
  subAreas,
  width,
  height,
  drawingState,
  selectedTempId,
  selectionContext,
  onPolygonCreated,
  onSubAreaEdited,
  onSubAreaSelect,
  showLabels = true,
  showLegend = true,
  showGrid = true,
}: IndoorCanvasProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonLayersRef = useRef<L.LayerGroup>(L.layerGroup());
  const gridLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const labelLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const initializedRef = useRef(false);

  // Initialize map with CRS.Simple
  useEffect(() => {
    if (!mapContainerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 5,
      zoomControl: true,
      attributionControl: false,
    });

    const padding = Math.max(width, height) * 0.1;
    const bounds: L.LatLngBoundsExpression = [
      [-padding, -padding],
      [height + padding, width + padding],
    ];
    map.fitBounds(bounds);

    polygonLayersRef.current.addTo(map);
    gridLayerRef.current.addTo(map);
    labelLayerRef.current.addTo(map);

    // Legend
    if (showLegend) {
      const LegendControl = L.Control.extend({
        onAdd: function () {
          const div = L.DomUtil.create('div', 'indoor-legend');
          div.style.cssText =
            'background: white; padding: 8px 12px; border-radius: 6px; box-shadow: 0 1px 5px rgba(0,0,0,0.3); font-size: 12px; direction: rtl;';
          let html = '<div style="font-weight: 600; margin-bottom: 4px;">מקרא</div>';
          LEGEND_ITEMS.forEach((item) => {
            const borderStyle = item.dashed ? 'dashed' : 'solid';
            html += `<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
              <span style="width: 14px; height: 14px; background: ${item.style.fillColor}; opacity: 0.6; border: 2px ${borderStyle} ${item.style.color}; display: inline-block; border-radius: 2px;"></span>
              <span>${item.label}</span>
            </div>`;
          });
          div.innerHTML = html;
          return div;
        },
      });
      new LegendControl({ position: 'bottomright' }).addTo(map);
    }

    // Coordinate display
    const CoordControl = L.Control.extend({
      onAdd: function () {
        const div = L.DomUtil.create('div', 'coord-display');
        div.style.cssText =
          'background: white; padding: 4px 8px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); font-size: 11px; font-family: monospace; direction: ltr;';
        div.innerHTML = 'X: 0m, Y: 0m';
        return div;
      },
    });
    const coordControl = new CoordControl({ position: 'bottomleft' });
    coordControl.addTo(map);

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const container = coordControl.getContainer();
      if (container) {
        container.innerHTML = `X: ${e.latlng.lng.toFixed(1)}m, Y: ${e.latlng.lat.toFixed(1)}m`;
      }
    });

    // Geoman
    map.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawText: false,
      drawPolygon: false,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: false,
    });
    (map.pm as any).setLang('he');

    mapRef.current = map;

    return () => {
      map.remove();
      initializedRef.current = false;
    };
  }, []);

  // Update bounds when dimensions change (only when no selection to zoom to)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (selectionContext?.zoomTarget) return; // zoom-to-selection handles this
    const padding = Math.max(width, height) * 0.1;
    const bounds: L.LatLngBoundsExpression = [
      [-padding, -padding],
      [height + padding, width + padding],
    ];
    map.fitBounds(bounds);
  }, [width, height]);

  // Zoom to selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectionContext?.zoomTarget) {
      const geoJson = L.geoJSON(selectionContext.zoomTarget as any);
      const bounds = geoJson.getBounds();
      map.flyToBounds(bounds, {
        padding: [40, 40],
        duration: 0.4,
        maxZoom: 4,
      });
    } else if (selectionContext?.selectedId === 'root' || !selectionContext?.selectedId) {
      // Zoom to full area
      const padding = Math.max(width, height) * 0.1;
      const bounds: L.LatLngBoundsExpression = [
        [-padding, -padding],
        [height + padding, width + padding],
      ];
      map.flyToBounds(bounds, { duration: 0.4 });
    }
  }, [selectionContext?.zoomTarget, selectionContext?.selectedId, width, height]);

  // Draw grid
  useEffect(() => {
    const gridGroup = gridLayerRef.current;
    gridGroup.clearLayers();

    if (!showGrid || width <= 0 || height <= 0) return;

    const maxDim = Math.max(width, height);
    let gridStep = 1;
    if (maxDim > 200) gridStep = 50;
    else if (maxDim > 100) gridStep = 20;
    else if (maxDim > 50) gridStep = 10;
    else if (maxDim > 20) gridStep = 5;
    else if (maxDim > 10) gridStep = 2;

    const gridStyle: L.PolylineOptions = {
      color: '#e5e7eb',
      weight: 0.5,
      opacity: 0.6,
    };

    for (let x = 0; x <= width; x += gridStep) {
      gridGroup.addLayer(
        L.polyline([[0, x], [height, x]], gridStyle)
      );
    }
    for (let y = 0; y <= height; y += gridStep) {
      gridGroup.addLayer(
        L.polyline([[y, 0], [y, width]], gridStyle)
      );
    }
  }, [width, height, showGrid]);

  // Drawing state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.pm.globalDrawModeEnabled()) map.pm.disableDraw();
    if (map.pm.globalEditModeEnabled()) map.pm.disableGlobalEditMode();

    if (drawingState.mode === 'draw-area') {
      map.pm.enableDraw('Polygon', {
        snappable: true,
        snapDistance: 15,
        templineStyle: { color: '#1e40af' },
        hintlineStyle: { color: '#1e40af', dashArray: '5, 5' },
        pathOptions: { color: '#1e40af', fillColor: '#dbeafe', fillOpacity: 0.2 },
      });
    }
  }, [drawingState]);

  // Geoman create event
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleCreate = (e: any) => {
      const layer = e.layer;
      const geojson = layer.toGeoJSON();
      map.removeLayer(layer);
      map.pm.disableDraw();
      onPolygonCreated?.(geojson.geometry);
    };

    map.on('pm:create', handleCreate);
    return () => { map.off('pm:create', handleCreate); };
  }, [onPolygonCreated]);

  // Render polygons with selection context (dimming + highlighting)
  useEffect(() => {
    const layerGroup = polygonLayersRef.current;
    const labelGroup = labelLayerRef.current;
    layerGroup.clearLayers();
    labelGroup.clearLayers();

    const hasSelection = selectionContext?.selectedId && selectionContext.selectedId !== 'root';

    // Area outline
    if (areaGeometry) {
      const polygon = L.geoJSON(areaGeometry as any, {
        style: () => AREA_OUTLINE_STYLE,
      });
      layerGroup.addLayer(polygon);
    }

    // Sub-areas
    subAreas.forEach((sa) => {
      const isSelected = selectionContext?.selectedId === sa.tempId;
      const isHighlighted = hasSelection
        ? selectionContext!.highlightedIds.has(sa.tempId)
        : true;

      const baseStyle = getStyleForLevel(sa.level);
      let style;
      if (isSelected) {
        style = { ...baseStyle, ...SELECTED_STYLE };
      } else if (isHighlighted) {
        style = baseStyle;
      } else {
        style = { ...baseStyle, ...DIMMED_STYLE };
      }

      const polygon = L.geoJSON(sa.geometry as any, {
        style: () => style,
      });

      polygon.eachLayer((layer: any) => {
        layer.options.tempId = sa.tempId;

        // Show tooltip: permanent for level 2+ when highlighted or no selection
        const showPermanent = showLabels && sa.level >= 2 && (isHighlighted || !hasSelection);
        layer.bindTooltip(sa.name, {
          permanent: showPermanent,
          direction: 'center',
          className: 'indoor-tooltip',
          opacity: isHighlighted || !hasSelection ? 0.9 : 0.3,
        });

        layer.on('click', () => {
          onSubAreaSelect?.(sa.tempId);
        });
      });

      layerGroup.addLayer(polygon);

      // Centered label for level 1
      if (showLabels && sa.level === 1 && (isHighlighted || !hasSelection)) {
        const bounds = L.geoJSON(sa.geometry as any).getBounds();
        const center = bounds.getCenter();
        const opacity = isHighlighted || !hasSelection ? 1 : 0.3;
        const marker = L.marker(center, {
          icon: L.divIcon({
            className: 'indoor-level-label',
            html: `<div style="font-weight: 600; font-size: 13px; color: ${baseStyle.color}; text-align: center; white-space: nowrap; text-shadow: 0 0 3px white, 0 0 3px white; opacity: ${opacity};">${sa.name}</div>`,
            iconSize: [100, 20],
            iconAnchor: [50, 10],
          }),
        });
        labelGroup.addLayer(marker);
      }
    });
  }, [areaGeometry, subAreas, selectionContext, showLabels, onSubAreaSelect]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full rounded-lg border bg-white"
      style={{ minHeight: '350px' }}
    />
  );
}
