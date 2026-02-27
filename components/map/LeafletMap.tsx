'use client';

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import type {
  AreaWithGeometry,
  SubAreaWithGeometry,
  GeoJSONPolygon,
  DrawingState,
} from './types';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  AREA_STYLE,
  SUB_AREA_STYLE,
  SELECTED_STYLE,
} from './types';

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
    } else if (drawingState.mode === 'edit' && drawingState.targetEntityId) {
      // Find the layer to edit
      polygonLayersRef.current.eachLayer((layer: any) => {
        if (layer.options?.entityId === drawingState.targetEntityId) {
          layer.pm.enable({
            allowSelfIntersection: false,
          });
          editableLayerRef.current = layer;
        }
      });
    }
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

    areas.forEach((area) => {
      // Render area polygon
      if (area.geometry) {
        const isSelected = selectedEntityId === area.id;
        const style = isSelected
          ? { ...AREA_STYLE, ...SELECTED_STYLE }
          : AREA_STYLE;

        const polygon = L.geoJSON(area.geometry as any, {
          style: () => style,
        });

        polygon.eachLayer((layer: any) => {
          layer.options.entityId = area.id;
          layer.options.entityType = 'area';

          layer.bindTooltip(area.name, {
            permanent: false,
            direction: 'center',
            className: 'area-tooltip',
          });

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
          const style = isSelected
            ? { ...SUB_AREA_STYLE, ...SELECTED_STYLE }
            : SUB_AREA_STYLE;

          const polygon = L.geoJSON(subArea.geometry as any, {
            style: () => style,
          });

          polygon.eachLayer((layer: any) => {
            layer.options.entityId = subArea.id;
            layer.options.entityType = 'sub_area';

            layer.bindTooltip(subArea.display || subArea.name, {
              permanent: false,
              direction: 'center',
              className: 'sub-area-tooltip',
            });

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
  }, [areas, selectedEntityId, onEntitySelect, handleEditEnd]);

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
