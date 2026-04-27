import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Box,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import PolicyIcon from '@mui/icons-material/Policy';
import RadarIcon from '@mui/icons-material/Radar';
import SatelliteAltIcon from '@mui/icons-material/SatelliteAlt';
import MapIcon from '@mui/icons-material/Map';
import axios from 'axios';
import { getMapStyle, hasMapboxToken } from '../../utils/mapStyle';

// Adjusted to push the city slightly down, centering it better.
const ISTANBUL_CENTER = [28.9850, 41.0250];
const ISTANBUL_ZOOM = 10.5;
const ISTANBUL_AIRSPACE_BOUNDS = {
  west: 28.45,
  east: 29.95,
  south: 40.75,
  north: 41.65,
};
const emptyCollection = { type: 'FeatureCollection', features: [] };

const scoreColor = (score) => {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#eab308';
  return '#ef4444';
};

const createAircraftElement = (blocked = false) => {
  const shell = document.createElement('div');
  shell.style.cssText = `
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    pointer-events: none;
  `;
  const aircraftColor = blocked ? '#ef4444' : '#e17b8f';
  const aircraftGlow = blocked ? 'rgba(239,68,68,0.22)' : 'rgba(225,123,143,0.22)';

  shell.innerHTML = `
    <svg width="38" height="38" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="20" fill="${aircraftGlow}" stroke="${aircraftColor}" stroke-width="2"/>
      <path d="M31 9 L39 31 L56 38 L55 44 L37 40 L32 55 L27 55 L27 40 L9 44 L8 38 L25 31 Z" fill="${aircraftColor}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `;
  shell.style.filter = `drop-shadow(0 0 12px ${blocked ? 'rgba(239,68,68,0.95)' : 'rgba(225,123,143,0.95)'})`;
  return shell;
};

const routePointAt = (coordinates, progress) => {
  if (!coordinates?.length) return null;
  const maxIndex = coordinates.length - 1;
  const exactIndex = Math.max(0, Math.min(maxIndex, progress * maxIndex));
  const low = Math.floor(exactIndex);
  const high = Math.min(maxIndex, low + 1);
  const local = exactIndex - low;
  const start = coordinates[low];
  const end = coordinates[high];
  return [
    start[0] + (end[0] - start[0]) * local,
    start[1] + (end[1] - start[1]) * local,
  ];
};

const routeStopProgress = (route) => {
  if (route?.stop_progress !== null && route?.stop_progress !== undefined) {
    return Math.max(0.04, Math.min(0.998, Number(route.stop_progress)));
  }
  const blocker = route?.conflicts?.find((conflict) => conflict.severity === 'blocker' && conflict.route_progress !== null && conflict.route_progress !== undefined);
  if (!blocker) return route?.is_safe === false ? 0.58 : 1;
  return Math.max(0.04, Math.min(0.998, Number(blocker.route_progress)));
};

const routeStopPoint = (route) => {
  if (Array.isArray(route?.stop_point)) return route.stop_point;
  const blocker = route?.conflicts?.find((conflict) => conflict.severity === 'blocker' && Array.isArray(conflict.block_point));
  return blocker?.block_point || null;
};

const routeVisualStyle = (route) => {
  if (!route) {
    return { color: '#e17b8f', dash: [1.4, 0.8] };
  }
  if (route.safety_status === 'safe') {
    return { color: '#e17b8f', dash: [1, 0.01] };
  }
  if (route.safety_status === 'warning') {
    return { color: '#f59e0b', dash: [1.2, 0.7] };
  }
  if (route.safety_status === 'blocked' || route.is_safe === false) {
    return { color: '#ef4444', dash: [0.9, 0.65] };
  }
  return { color: '#e17b8f', dash: [1.4, 0.8] };
};

const applyRasterBasemapMode = (instance, mode) => {
  if (!instance?.getLayer('osm') || !instance?.getLayer('satellite')) return;
  const showSatellite = mode === 'satellite';
  instance.setLayoutProperty('osm', 'visibility', showSatellite ? 'none' : 'visible');
  instance.setLayoutProperty('satellite', 'visibility', showSatellite ? 'visible' : 'none');
  if (showSatellite) {
    instance.setPaintProperty('satellite', 'raster-opacity', 1);
    instance.setPaintProperty('satellite', 'raster-saturation', 0);
    instance.setPaintProperty('satellite', 'raster-contrast', 0);
    return;
  }
  if (mode === 'light') {
    instance.setPaintProperty('osm', 'raster-opacity', 1);
    instance.setPaintProperty('osm', 'raster-brightness-min', 0);
    instance.setPaintProperty('osm', 'raster-brightness-max', 1);
    instance.setPaintProperty('osm', 'raster-saturation', 0);
    instance.setPaintProperty('osm', 'raster-contrast', 0);
    return;
  }
  instance.setPaintProperty('osm', 'raster-opacity', 1);
  instance.setPaintProperty('osm', 'raster-brightness-min', 0.02);
  instance.setPaintProperty('osm', 'raster-brightness-max', 0.42);
  instance.setPaintProperty('osm', 'raster-saturation', -0.35);
  instance.setPaintProperty('osm', 'raster-contrast', 0.18);
};

/**
 * PassengerMapView
 * Props:
 *   - filteredVertiports: Vertiport[] — which vertiports to show as markers
 *   - selectedVertiport: Vertiport | null — currently highlighted vertiport
 *   - route: RouteResult | null — draw flight path if present
 *   - onVertiportSelect: (vp) => void — called when user clicks a marker
 *   - flyToTarget: Vertiport | null — fly map to this location when set
 */
const PassengerMapView = ({
  filteredVertiports = [],
  selectedVertiport = null,
  route = null,
  onVertiportSelect,
  flyToTarget,
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]); // custom HTML markers
  const aircraftMarkerRef = useRef(null);
  const aircraftFrameRef = useRef(null);

  const [coords, setCoords] = useState({ lng: ISTANBUL_CENTER[0].toFixed(4), lat: ISTANBUL_CENTER[1].toFixed(4) });
  const [zoom, setZoom] = useState(ISTANBUL_ZOOM.toFixed(1));
  const [mapLoaded, setMapLoaded] = useState(false);
  const [airspaceSummary, setAirspaceSummary] = useState(null);
  const [baseTone, setBaseTone] = useState('light');
  const [showNfz, setShowNfz] = useState(true);
  const [showControlled, setShowControlled] = useState(true);
  const [mapControlsOpen, setMapControlsOpen] = useState(false);

  // ── Initialize map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (map.current) return;

    const token = process.env.REACT_APP_MAPBOX_TOKEN;
    if (hasMapboxToken()) {
      mapboxgl.accessToken = token;
    } else {
      mapboxgl.accessToken = 'not-required-for-osm-raster-style';
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: getMapStyle(),
      center: ISTANBUL_CENTER,
      zoom: ISTANBUL_ZOOM,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    map.current.on('load', () => {
      setMapLoaded(true);
      map.current.resize();
      applyRasterBasemapMode(map.current, 'light');
      map.current.addSource('passenger-airspace-overlay', {
        type: 'geojson',
        data: emptyCollection,
      });
      map.current.addLayer({
        id: 'passenger-airspace-nfz-fill',
        type: 'fill',
        source: 'passenger-airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'nfz'],
        paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.24 },
      });
      map.current.addLayer({
        id: 'passenger-airspace-nfz-line',
        type: 'line',
        source: 'passenger-airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'nfz'],
        paint: { 'line-color': '#f87171', 'line-width': 2 },
      });
      map.current.addLayer({
        id: 'passenger-airspace-controlled-fill',
        type: 'fill',
        source: 'passenger-airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'controlled_airspace'],
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.16 },
      });
      map.current.addLayer({
        id: 'passenger-airspace-controlled-line',
        type: 'line',
        source: 'passenger-airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'controlled_airspace'],
        paint: { 'line-color': '#60a5fa', 'line-width': 2 },
      });
      // Add route source/layer stubs (empty initially)
      map.current.addSource('route-source', {
        type: 'geojson',
        data: emptyCollection,
      });
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-source',
        paint: {
          'line-color': '#f97316',
          'line-width': 6,
          'line-opacity': 1,
          'line-dasharray': [1.4, 0.8],
        },
      });

      // From / To endpoint markers as a separate source
      map.current.addSource('route-endpoints', {
        type: 'geojson',
        data: emptyCollection,
      });
      map.current.addLayer({
        id: 'route-endpoint-circles',
        type: 'circle',
        source: 'route-endpoints',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.current.addSource('route-blocker', {
        type: 'geojson',
        data: emptyCollection,
      });
      map.current.addLayer({
        id: 'route-blocker-circle',
        type: 'circle',
        source: 'route-blocker',
        paint: {
          'circle-radius': 9,
          'circle-color': '#ef4444',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });
    });

    map.current.on('move', () => {
      const c = map.current.getCenter();
      setCoords({ lng: c.lng.toFixed(4), lat: c.lat.toFixed(4) });
      setZoom(map.current.getZoom().toFixed(1));
    });

    map.current.on('mousemove', (e) => {
      setCoords({ lng: e.lngLat.lng.toFixed(4), lat: e.lngLat.lat.toFixed(4) });
    });

    return () => {
      if (aircraftFrameRef.current) cancelAnimationFrame(aircraftFrameRef.current);
      if (aircraftMarkerRef.current) aircraftMarkerRef.current.remove();
      if (map.current) { map.current.remove(); map.current = null; }
    };
  }, []);

  // ── Update vertiport markers when filteredVertiports changes ─────────────
  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    const source = map.current.getSource('passenger-airspace-overlay');
    if (!source) return;

    axios.get('/api/geodata/airspace', { params: ISTANBUL_AIRSPACE_BOUNDS })
      .then((response) => {
        source.setData(response.data);
        setAirspaceSummary(response.data.summary || null);
      })
      .catch(() => {
        source.setData(emptyCollection);
        setAirspaceSummary(null);
      });
  }, [mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    applyRasterBasemapMode(map.current, baseTone);
  }, [baseTone, mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    ['passenger-airspace-nfz-fill', 'passenger-airspace-nfz-line'].forEach((layerId) => {
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(layerId, 'visibility', showNfz ? 'visible' : 'none');
      }
    });
  }, [showNfz, mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    ['passenger-airspace-controlled-fill', 'passenger-airspace-controlled-line'].forEach((layerId) => {
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(layerId, 'visibility', showControlled ? 'visible' : 'none');
      }
    });
  }, [showControlled, mapLoaded]);

  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    // Remove existing custom markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredVertiports.forEach((vp) => {
      // Create custom HTML marker element
      const el = document.createElement('div');
      el.className = 'vp-marker';
      const isSelected = selectedVertiport?.id === vp.id;
      el.style.cssText = `
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      `;
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: ${isSelected ? 18 : 14}px;
        height: ${isSelected ? 18 : 14}px;
        border-radius: 50%;
        background: ${scoreColor(vp.suitabilityScore)};
        border: ${isSelected ? '3px' : '2px'} solid #ffffff;
        box-shadow: 0 0 ${isSelected ? '14px' : '6px'} ${scoreColor(vp.suitabilityScore)}99;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      `;
      el.appendChild(dot);

      // Create a sleek Mapbox popup for hover
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 15,
        className: 'vp-hover-popup'
      }).setHTML(`
        <div style="font-family: 'Inter', sans-serif; padding: 2px; min-width: 140px;">
          <div style="font-size: 0.75rem; font-weight: 700; color: #e17b8f; margin-bottom: 4px; border-bottom: 1px solid rgba(225,123,143,0.2); padding-bottom: 4px;">${vp.name}</div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.65rem; color: #94a3b8;">Score: <b style="color: ${scoreColor(vp.suitabilityScore)}">${vp.suitabilityScore}</b></span>
            <span style="font-size: 0.65rem; font-weight: 700; color: #cbd5e1;">${vp.pricePerKm} ₺/km</span>
          </div>
        </div>
      `);

      el.addEventListener('mouseenter', () => {
        dot.style.transform = 'scale(1.25)';
        popup.setLngLat([vp.lng, vp.lat]).addTo(map.current);
      });
      el.addEventListener('mouseleave', () => {
        dot.style.transform = 'scale(1)';
        popup.remove();
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.remove(); // hide hover on click to let bottom card take focus
        if (onVertiportSelect) onVertiportSelect(vp);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([vp.lng, vp.lat])
        .addTo(map.current);

      markersRef.current.push(marker);
    });
  }, [filteredVertiports, selectedVertiport, mapLoaded, onVertiportSelect]);

  // ── Draw / clear route on map ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded || !map.current) return;
    const routeSrc = map.current.getSource('route-source');
    const epSrc = map.current.getSource('route-endpoints');
    const blockerSrc = map.current.getSource('route-blocker');
    if (!routeSrc || !epSrc || !blockerSrc) return;

    if (route) {
      const style = routeVisualStyle(route);
      map.current.setPaintProperty('route-line', 'line-color', style.color);
      map.current.setPaintProperty('route-line', 'line-dasharray', style.dash);

      // Draw flight path
      routeSrc.setData({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: route.coordinates },
      });

      // From / To endpoint markers
      epSrc.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [route.fromVertiport.lng, route.fromVertiport.lat] },
            properties: { color: '#22c55e', label: 'From' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [route.toVertiport.lng, route.toVertiport.lat] },
            properties: { color: '#ef4444', label: 'To' },
          },
        ],
      });
      const stopPoint = routeStopPoint(route);
      blockerSrc.setData(
        stopPoint
          ? {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: stopPoint },
            properties: {},
          }
          : emptyCollection
      );

      // Fit map to route bounds
      const bounds = new mapboxgl.LngLatBounds();
      route.coordinates.forEach(([lng, lat]) => bounds.extend([lng, lat]));
      map.current.fitBounds(bounds, { padding: 80, duration: 1200 });

      if (aircraftFrameRef.current) cancelAnimationFrame(aircraftFrameRef.current);
      if (aircraftMarkerRef.current) aircraftMarkerRef.current.remove();
      // DIAGNOSTIC: Force aircraft to go to the end regardless of backend flags
      const isBlocked = route.safety_status === 'blocked' || route.safety_status === 'unsafe' || route.is_safe === false;
      const endProgress = 1.0;

      const aircraft = createAircraftElement(isBlocked);
      aircraftMarkerRef.current = new mapboxgl.Marker({ element: aircraft })
        .setLngLat(route.coordinates[0])
        .addTo(map.current);

      const durationMs = isBlocked ? 3000 : 5000; // Slower animation to see the end clearly
      const startTime = performance.now();

      const animate = (now) => {
        if (!aircraftMarkerRef.current) return;

        const elapsed = now - startTime;
        const raw = Math.min(1, elapsed / durationMs);
        // Linear-to-Cubic blend for better visibility at the end
        const eased = raw === 1 ? 1 : 1 - Math.pow(1 - raw, 2.5);

        const currentProgress = eased * endProgress;

        // Final frame: Snap to target
        if (raw >= 1) {
          const finalPoint = (endProgress >= 0.99 && !stopPoint)
            ? route.coordinates[route.coordinates.length - 1]
            : (stopPoint || routePointAt(route.coordinates, endProgress));

          aircraftMarkerRef.current.setLngLat(finalPoint);
          return;
        }

        const point = routePointAt(route.coordinates, currentProgress);
        if (point) {
          aircraftMarkerRef.current.setLngLat(point);
          aircraftFrameRef.current = requestAnimationFrame(animate);
        }
      };
      aircraftFrameRef.current = requestAnimationFrame(animate);
    } else {
      // Clear route
      const style = routeVisualStyle(null);
      map.current.setPaintProperty('route-line', 'line-color', style.color);
      map.current.setPaintProperty('route-line', 'line-dasharray', style.dash);
      routeSrc.setData({ type: 'FeatureCollection', features: [] });
      epSrc.setData({ type: 'FeatureCollection', features: [] });
      blockerSrc.setData({ type: 'FeatureCollection', features: [] });
      if (aircraftFrameRef.current) cancelAnimationFrame(aircraftFrameRef.current);
      if (aircraftMarkerRef.current) {
        aircraftMarkerRef.current.remove();
        aircraftMarkerRef.current = null;
      }
    }
  }, [route, mapLoaded]);

  // ── Fly to target ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!flyToTarget || !map.current) return;
    map.current.flyTo({ center: [flyToTarget.lng, flyToTarget.lat], zoom: 14, duration: 1200 });
  }, [flyToTarget]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Map canvas */}
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Coordinate bar — bottom center */}
      <Paper
        sx={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, px: 2, py: 0.8,
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'rgba(2, 6, 23, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '10px',
        }}
      >
        {[
          { label: 'LNG', val: coords.lng },
          { label: 'LAT', val: coords.lat },
          { label: 'ZOOM', val: zoom },
        ].map(({ label, val }, i) => (
          <React.Fragment key={label}>
            {i > 0 && <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.07)' }} />}
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'baseline' }}>
              <Typography sx={{ fontSize: '0.6rem', color: '#334155', fontWeight: 700, letterSpacing: '0.07em' }}>{label}</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: '"Roboto Mono", monospace', minWidth: label === 'ZOOM' ? 32 : 72 }}>
                {val}
              </Typography>
            </Box>
          </React.Fragment>
        ))}
      </Paper>

      <Stack sx={{ position: 'absolute', right: 28, top: 108, zIndex: 12, alignItems: 'center' }} spacing={0.9}>
        <Tooltip title={mapControlsOpen ? 'Close map layers' : 'Open map layers'} placement="left">
          <IconButton
            onClick={() => setMapControlsOpen((prev) => !prev)}
            sx={{
              width: 38,
              height: 38,
              bgcolor: '#1d4ed8',
              color: '#eff6ff',
              border: '3px solid rgba(255,255,255,0.92)',
              boxShadow: '0 12px 24px rgba(29,78,216,0.28)',
              '&:hover': { bgcolor: '#1e40af' },
            }}
          >
            <MapIcon />
          </IconButton>
        </Tooltip>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.9,
            maxHeight: mapControlsOpen ? 320 : 0,
            opacity: mapControlsOpen ? 1 : 0,
            transform: `translateY(${mapControlsOpen ? 0 : -8}px)`,
            overflow: 'hidden',
            pointerEvents: mapControlsOpen ? 'auto' : 'none',
            transition: 'max-height 220ms ease, opacity 180ms ease, transform 220ms ease',
          }}
        >
          {[
            { key: 'light', icon: <LightModeIcon fontSize="small" />, label: 'Light mode' },
            { key: 'dark', icon: <DarkModeIcon fontSize="small" />, label: 'Dark mode' },
            { key: 'satellite', icon: <SatelliteAltIcon fontSize="small" />, label: 'Satellite view' },
          ].map((option) => (
            <Tooltip key={option.key} title={option.label} placement="left">
              <IconButton
                onClick={() => {
                  setBaseTone(option.key);
                  setMapControlsOpen(false);
                }}
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: baseTone === option.key ? '#dbeafe' : 'rgba(255,255,255,0.92)',
                  color: baseTone === option.key ? '#1d4ed8' : '#475569',
                  border: '1px solid rgba(148,163,184,0.18)',
                  boxShadow: '0 8px 18px rgba(15,23,42,0.12)',
                  '&:hover': { bgcolor: '#eff6ff' },
                }}
              >
                {option.icon}
              </IconButton>
            </Tooltip>
          ))}
          <Tooltip title={showNfz ? `Hide NFZ (${airspaceSummary?.nfz ?? 0})` : `Show NFZ (${airspaceSummary?.nfz ?? 0})`} placement="left">
            <IconButton
              onClick={() => {
                setShowNfz((prev) => !prev);
                setMapControlsOpen(false);
              }}
              sx={{
                width: 34,
                height: 34,
                bgcolor: showNfz ? '#dbeafe' : 'rgba(255,255,255,0.92)',
                color: showNfz ? '#1d4ed8' : '#475569',
                border: '1px solid rgba(148,163,184,0.18)',
                boxShadow: '0 8px 18px rgba(15,23,42,0.12)',
                '&:hover': { bgcolor: '#eff6ff' },
              }}
            >
              <PolicyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={showControlled ? `Hide controlled (${airspaceSummary?.controlled_airspace ?? 0})` : `Show controlled (${airspaceSummary?.controlled_airspace ?? 0})`} placement="left">
            <IconButton
              onClick={() => {
                setShowControlled((prev) => !prev);
                setMapControlsOpen(false);
              }}
              sx={{
                width: 34,
                height: 34,
                bgcolor: showControlled ? '#dbeafe' : 'rgba(255,255,255,0.92)',
                color: showControlled ? '#1d4ed8' : '#475569',
                border: '1px solid rgba(148,163,184,0.18)',
                boxShadow: '0 8px 18px rgba(15,23,42,0.12)',
                '&:hover': { bgcolor: '#eff6ff' },
              }}
            >
              <RadarIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Stack>

      {/* Legend — bottom right */}
      <Paper sx={{
        position: 'absolute', bottom: 78, right: 16, zIndex: 10,
        px: 1.5, py: 1,
        background: 'rgba(2, 6, 23, 0.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '10px',
      }}>
        <Typography sx={{ fontSize: '0.6rem', color: '#334155', fontWeight: 700, letterSpacing: '0.07em', mb: 0.8, textTransform: 'uppercase' }}>
          Map Layers
        </Typography>
        {[
          { label: `NFZ ${airspaceSummary?.nfz ?? 0}`, color: '#ef4444' },
          { label: `Controlled ${airspaceSummary?.controlled_airspace ?? 0}`, color: '#3b82f6' },
          { label: 'High  ≥85', color: '#22c55e' },
          { label: 'Mid   ≥70', color: '#eab308' },
          { label: 'Low   <70', color: '#ef4444' },
        ].map(({ label, color }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.65rem', color: '#475569' }}>{label}</Typography>
          </Box>
        ))}
      </Paper>
    </Box>
  );
};

export default PassengerMapView;
