'use client';

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import type {
  AreaWithGeometry,
  SubAreaWithGeometry,
  MonitoringReportForMap,
  GeoJSONPolygon,
  DrawingState,
} from './types';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  AREA_STYLE,
  SUB_AREA_STYLE,
  AREA_PENDING_STYLE,
  SUB_AREA_PENDING_STYLE,
  SELECTED_STYLE,
  SEVERITY_CONFIG,
} from './types';

function buildSeverityBadge(severity: string | null): string {
  if (!severity) return '';
  const config = SEVERITY_CONFIG[severity];
  if (!config) return '';
  return `<span style="background: ${config.color}; color: white; padding: 1px 6px; border-radius: 9999px; font-size: 10px; font-weight: 600;">${config.label}</span>`;
}

function buildTreatmentHtml(t: MonitoringReportForMap['treatments'][0]): string {
  const parts: string[] = [];
  if (t.action_type_name) parts.push(t.action_type_name);
  if (t.material_name) parts.push(t.material_name);
  if (t.dosage && t.unit_type_name) parts.push(`${t.dosage} ${t.unit_type_name}`);
  else if (t.dosage) parts.push(`${t.dosage}`);

  const statusIcon = t.status === 'completed' ? '&#10003;' : '&#9202;';
  const statusLabel = t.status === 'completed' ? 'בוצע' : 'ממתין';
  const statusColor = t.status === 'completed' ? '#16a34a' : '#d97706';

  let html = `<div style="padding: 2px 0; font-size: 11px; color: #555;">`;
  if (parts.length > 0) {
    html += `${parts.join(' &middot; ')} `;
  }
  html += `<span style="color: ${statusColor}; font-weight: 500;">${statusIcon} ${statusLabel}</span>`;
  if (t.notes) {
    html += `<div style="color: #888; font-size: 10px; margin-top: 1px;">${t.notes}</div>`;
  }
  html += `</div>`;
  return html;
}

function buildSubAreaPopup(subArea: SubAreaWithGeometry): string {
  const title = subArea.display || subArea.name;
  const variety = subArea.variety ? ` (${subArea.variety})` : '';

  let html = `<div style="direction: rtl; min-width: 200px; max-width: 300px;">`;
  html += `<div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${title}${variety}</div>`;

  const reports = subArea.monitoring_reports || [];
  if (reports.length === 0) {
    html += `<div style="color: #888; font-size: 12px;">אין נתוני ניטור</div>`;
  } else {
    reports.forEach((report: MonitoringReportForMap, i: number) => {
      if (i > 0) html += `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 6px 0;">`;
      html += `<div style="margin-bottom: 2px;">`;
      html += `<span style="font-weight: 500; font-size: 12px;">${report.finding_name}</span> `;
      html += buildSeverityBadge(report.severity);
      html += `</div>`;

      if (report.treatments.length > 0) {
        report.treatments.forEach((t) => {
          html += buildTreatmentHtml(t);
        });
      }
    });
  }

  html += `</div>`;
  return html;
}

function buildAreaPopup(area: AreaWithGeometry): string {
  let html = `<div style="direction: rtl; min-width: 180px;">`;
  html += `<div style="font-weight: 600; font-size: 13px; margin-bottom: 4px;">${area.name}</div>`;

  const totalReports = area.sub_areas.reduce(
    (sum, sa) => sum + (sa.monitoring_reports?.length || 0),
    0
  );
  const pendingReports = area.sub_areas.reduce(
    (sum, sa) =>
      sum +
      (sa.monitoring_reports?.filter((r) => r.status !== 'completed').length || 0),
    0
  );
  const completedReports = totalReports - pendingReports;

  if (totalReports === 0) {
    html += `<div style="color: #888; font-size: 12px;">אין נתוני ניטור</div>`;
  } else {
    html += `<div style="font-size: 12px; color: #555;">`;
    html += `סה"כ ממצאים: <strong>${totalReports}</strong>`;
    if (pendingReports > 0)
      html += ` &middot; <span style="color: #d97706;">ממתינים: ${pendingReports}</span>`;
    if (completedReports > 0)
      html += ` &middot; <span style="color: #16a34a;">בוצעו: ${completedReports}</span>`;
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function buildAreaTooltipContent(area: AreaWithGeometry): string {
  if (area.pending_monitoring === 0) return area.name;
  return `<div style="direction: rtl; text-align: center;">
    <div style="font-weight: 600;">${area.name}</div>
    <div style="font-size: 11px; color: #dc2626;">&#9888; ${area.pending_monitoring} ממתינים</div>
  </div>`;
}

function buildSubAreaTooltipContent(subArea: SubAreaWithGeometry): string {
  const name = subArea.display || subArea.name;
  if (subArea.pending_monitoring === 0) return name;
  return `<div style="direction: rtl; text-align: center;">
    <div style="font-weight: 600;">${name}</div>
    <div style="font-size: 11px; color: #dc2626;">&#9888; ${subArea.pending_monitoring} ממתינים</div>
  </div>`;
}

// Fix Leaflet default marker icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface LeafletMapProps {
  areas: AreaWithGeometry[];
  drawingState: DrawingState;
  selectedEntityId: string | null;
  onPolygonCreated: (geometry: GeoJSONPolygon) => void;
  onPolygonEdited: (entityId: string, entityType: 'area' | 'sub_area', geometry: GeoJSONPolygon) => void;
  onEntitySelect: (entityId: string, entityType: 'area' | 'sub_area') => void;
  fitToEntityId?: string | null;
}

export function LeafletMap({
  areas,
  drawingState,
  selectedEntityId,
  onPolygonCreated,
  onPolygonEdited,
  onEntitySelect,
  fitToEntityId,
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonLayersRef = useRef<L.LayerGroup>(L.layerGroup());
  const editableLayerRef = useRef<L.Layer | null>(null);
  const initializedRef = useRef(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const map = L.map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    // Tile layers
    const osmLayer = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }
    );

    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
      }
    );

    // Add default layer
    satelliteLayer.addTo(map);

    // Layer control
    const baseLayers: Record<string, L.TileLayer> = {
      'לוויין': satelliteLayer,
      'רחוב': osmLayer,
    };
    L.control.layers(baseLayers, {}, { position: 'topright' }).addTo(map);

    // Add polygon layer group
    polygonLayersRef.current.addTo(map);

    // Add legend control
    const LegendControl = L.Control.extend({
      onAdd: function () {
        const div = L.DomUtil.create('div', 'leaflet-legend');
        div.style.cssText =
          'background: white; padding: 8px 12px; border-radius: 6px; box-shadow: 0 1px 5px rgba(0,0,0,0.3); font-size: 12px; direction: rtl;';
        div.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 4px;">מקרא</div>
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="width: 14px; height: 14px; background: #3b82f6; opacity: 0.5; border: 2px solid #2563eb; display: inline-block; border-radius: 2px;"></span>
            <span>שטח</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
            <span style="width: 14px; height: 14px; background: #22c55e; opacity: 0.5; border: 2px dashed #16a34a; display: inline-block; border-radius: 2px;"></span>
            <span>תת-שטח</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 14px; height: 14px; background: #ef4444; opacity: 0.5; border: 2px solid #dc2626; display: inline-block; border-radius: 2px;"></span>
            <span>ממתין לטיפול</span>
          </div>
        `;
        return div;
      },
    });
    new LegendControl({ position: 'bottomright' }).addTo(map);

    // Initialize Geoman controls (hidden by default)
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

    // Set Hebrew language
    (map.pm as any).setLang('he');

    mapRef.current = map;

    return () => {
      map.remove();
      initializedRef.current = false;
    };
  }, []);

  // Handle drawing state changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Close all open popups when entering draw/edit mode
    if (drawingState.mode !== 'view') {
      map.closePopup();
    }

    // Clean up any ongoing drawing
    if (map.pm.globalDrawModeEnabled()) {
      map.pm.disableDraw();
    }
    if (map.pm.globalEditModeEnabled()) {
      map.pm.disableGlobalEditMode();
    }

    // Remove previous editable layer
    if (editableLayerRef.current) {
      (editableLayerRef.current as any).pm?.disable();
      editableLayerRef.current = null;
    }

    if (drawingState.mode === 'draw') {
      map.pm.enableDraw('Polygon', {
        snappable: true,
        snapDistance: 20,
        templineStyle: { color: '#2563eb' },
        hintlineStyle: { color: '#2563eb', dashArray: '5, 5' },
        pathOptions: {
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
        },
      });
    }
    // Note: 'edit' mode enablement is handled in the polygon render effect
    // to avoid a race condition where this effect enables edit on a layer
    // that the render effect then destroys and recreates.
  }, [drawingState]);

  // Handle Geoman create event
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleCreate = (e: any) => {
      const layer = e.layer;
      const geojson = layer.toGeoJSON();
      // Remove the drawn layer (we'll re-render via React state)
      map.removeLayer(layer);
      map.pm.disableDraw();
      onPolygonCreated(geojson.geometry);
    };

    map.on('pm:create', handleCreate);

    return () => {
      map.off('pm:create', handleCreate);
    };
  }, [onPolygonCreated]);

  // Handle edit completion
  const handleEditEnd = useCallback(
    (entityId: string, entityType: 'area' | 'sub_area', layer: L.Layer) => {
      const geojson = (layer as any).toGeoJSON();
      onPolygonEdited(entityId, entityType, geojson.geometry);
    },
    [onPolygonEdited]
  );

  // Render polygons when areas data changes
  useEffect(() => {
    const layerGroup = polygonLayersRef.current;
    layerGroup.clearLayers();

    const isViewMode = drawingState.mode === 'view';
    const isEditMode = drawingState.mode === 'edit';

    areas.forEach((area) => {
      // Render area polygon
      if (area.geometry) {
        const isSelected = selectedEntityId === area.id;
        const baseStyle =
          area.pending_monitoring > 0 ? AREA_PENDING_STYLE : AREA_STYLE;
        const style = isSelected
          ? { ...baseStyle, ...SELECTED_STYLE }
          : baseStyle;

        const polygon = L.geoJSON(area.geometry as any, {
          style: () => style,
        });

        polygon.eachLayer((layer: any) => {
          layer.options.entityId = area.id;
          layer.options.entityType = 'area';

          // Don't bind tooltip/popup in edit mode — they interfere with vertex dragging
          if (!isEditMode) {
            layer.bindTooltip(buildAreaTooltipContent(area), {
              permanent: false,
              direction: 'center',
              className: 'area-tooltip',
            });
          }

          if (isViewMode) {
            layer.bindPopup(buildAreaPopup(area), {
              maxWidth: 320,
              className: 'map-popup',
            });
          }

          layer.on('click', () => {
            onEntitySelect(area.id, 'area');
          });

          layer.on('pm:edit', () => {
            handleEditEnd(area.id, 'area', layer);
          });
        });

        layerGroup.addLayer(polygon);
      }

      // Render sub-area polygons
      area.sub_areas.forEach((subArea) => {
        if (subArea.geometry) {
          const isSelected = selectedEntityId === subArea.id;
          const baseStyle =
            subArea.pending_monitoring > 0
              ? SUB_AREA_PENDING_STYLE
              : SUB_AREA_STYLE;
          const style = isSelected
            ? { ...baseStyle, ...SELECTED_STYLE }
            : baseStyle;

          const polygon = L.geoJSON(subArea.geometry as any, {
            style: () => style,
          });

          polygon.eachLayer((layer: any) => {
            layer.options.entityId = subArea.id;
            layer.options.entityType = 'sub_area';

            // Don't bind tooltip/popup in edit mode — they interfere with vertex dragging
            if (!isEditMode) {
              layer.bindTooltip(buildSubAreaTooltipContent(subArea), {
                permanent: false,
                direction: 'center',
                className: 'sub-area-tooltip',
              });
            }

            if (isViewMode) {
              layer.bindPopup(buildSubAreaPopup(subArea), {
                maxWidth: 320,
                className: 'map-popup',
              });
            }

            layer.on('click', () => {
              onEntitySelect(subArea.id, 'sub_area');
            });

            layer.on('pm:edit', () => {
              handleEditEnd(subArea.id, 'sub_area', layer);
            });
          });

          layerGroup.addLayer(polygon);
        }
      });
    });

    // Enable edit mode on target layer AFTER layers are created
    if (isEditMode && drawingState.targetEntityId) {
      // Clean up previous editable layer ref
      if (editableLayerRef.current) {
        (editableLayerRef.current as any).pm?.disable();
        editableLayerRef.current = null;
      }

      // L.geoJSON creates wrapper layer groups — entityId is on the inner polygon layers.
      // We need to iterate into nested layers to find the actual path layer.
      layerGroup.eachLayer((outerLayer: any) => {
        if (outerLayer.eachLayer) {
          outerLayer.eachLayer((innerLayer: any) => {
            if (innerLayer.options?.entityId === drawingState.targetEntityId) {
              innerLayer.pm.enable({
                allowSelfIntersection: false,
              });
              editableLayerRef.current = innerLayer;
            }
          });
        }
      });
    }
  }, [areas, selectedEntityId, drawingState, onEntitySelect, handleEditEnd]);

  // Fit map to entity bounds
  useEffect(() => {
    if (!fitToEntityId || !mapRef.current) return;

    let targetGeometry: GeoJSONPolygon | null = null;

    for (const area of areas) {
      if (area.id === fitToEntityId && area.geometry) {
        targetGeometry = area.geometry;
        break;
      }
      for (const subArea of area.sub_areas) {
        if (subArea.id === fitToEntityId && subArea.geometry) {
          targetGeometry = subArea.geometry;
          break;
        }
      }
      if (targetGeometry) break;
    }

    if (targetGeometry) {
      const geoJsonLayer = L.geoJSON(targetGeometry as any);
      mapRef.current.fitBounds(geoJsonLayer.getBounds(), { padding: [50, 50] });
    }
  }, [fitToEntityId, areas]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full rounded-lg"
      style={{ minHeight: '400px' }}
    />
  );
}
