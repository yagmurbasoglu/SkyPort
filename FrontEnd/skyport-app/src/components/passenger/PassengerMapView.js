import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box, Paper, Typography, Divider } from '@mui/material';
import axios from 'axios';
import { getMapStyle, hasMapboxToken } from '../../utils/mapStyle';

const ISTANBUL_CENTER = [28.9784, 41.0082];
const ISTANBUL_ZOOM = 10.5;
const ISTANBUL_AIRSPACE_BOUNDS = {
  west: 28.45,
  east: 29.55,
  south: 40.75,
  north: 41.48,
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
  shell.innerHTML = `
    <svg width="38" height="38" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="20" fill="${blocked ? 'rgba(239,68,68,0.22)' : 'rgba(182,95,112,0.22)'}" stroke="${blocked ? '#fca5a5' : '#e17b8f'}" stroke-width="2"/>
      <path d="M31 9 L39 31 L56 38 L55 44 L37 40 L32 55 L27 55 L27 40 L9 44 L8 38 L25 31 Z" fill="${blocked ? '#ef4444' : '#b65f70'}" stroke="#f8fafc" stroke-width="2" stroke-linejoin="round"/>
      <path d="M26 31 H38" stroke="#0f172a" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
    </svg>
  `;
  shell.style.filter = `drop-shadow(0 0 12px ${blocked ? 'rgba(239,68,68,0.95)' : 'rgba(182,95,112,0.95)'})`;
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
  const blocker = route?.conflicts?.find((conflict) => conflict.severity === 'blocker' && conflict.route_progress !== null && conflict.route_progress !== undefined);
  if (!blocker) return route?.is_safe === false ? 0.58 : 1;
  return Math.max(0.04, Math.min(0.98, Number(blocker.route_progress)));
};

const routeStopPoint = (route) => {
  const blocker = route?.conflicts?.find((conflict) => conflict.severity === 'blocker' && Array.isArray(conflict.block_point));
  return blocker?.block_point || null;
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
        paint: { 'fill-color': '#b65f70', 'fill-opacity': 0.18 },
      });
      map.current.addLayer({
        id: 'passenger-airspace-controlled-line',
        type: 'line',
        source: 'passenger-airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'controlled_airspace'],
        paint: { 'line-color': '#e17b8f', 'line-width': 2 },
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

      el.addEventListener('mouseenter', () => {
        dot.style.transform = 'scale(1.25)';
      });
      el.addEventListener('mouseleave', () => {
        dot.style.transform = 'scale(1)';
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
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
    if (!routeSrc || !epSrc) return;

    if (route) {
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

      // Fit map to route bounds
      const bounds = new mapboxgl.LngLatBounds();
      route.coordinates.forEach(([lng, lat]) => bounds.extend([lng, lat]));
      map.current.fitBounds(bounds, { padding: 80, duration: 1200 });

      if (aircraftFrameRef.current) cancelAnimationFrame(aircraftFrameRef.current);
      if (aircraftMarkerRef.current) aircraftMarkerRef.current.remove();
      const isBlocked = route.is_safe === false || route.safety_status === 'unsafe' || route.safety_status === 'weather_risk';
      const aircraft = createAircraftElement(isBlocked);
      aircraftMarkerRef.current = new mapboxgl.Marker({ element: aircraft })
        .setLngLat(route.coordinates[0])
        .addTo(map.current);
      const endProgress = isBlocked ? routeStopProgress(route) : 1;
      const stopPoint = isBlocked ? routeStopPoint(route) : null;
      const durationMs = isBlocked ? 2400 : 4200;
      const startTime = performance.now();
      const animate = (now) => {
        const elapsed = now - startTime;
        const raw = Math.min(1, elapsed / durationMs);
        const eased = 1 - ((1 - raw) ** 3);
        const point = raw >= 1 && stopPoint ? stopPoint : routePointAt(route.coordinates, eased * endProgress);
        if (point && aircraftMarkerRef.current) aircraftMarkerRef.current.setLngLat(point);
        if (raw < 1) {
          aircraftFrameRef.current = requestAnimationFrame(animate);
        }
      };
      aircraftFrameRef.current = requestAnimationFrame(animate);
    } else {
      // Clear route
      routeSrc.setData({ type: 'FeatureCollection', features: [] });
      epSrc.setData({ type: 'FeatureCollection', features: [] });
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

      {/* Legend — bottom right */}
      <Paper sx={{
        position: 'absolute', bottom: 16, right: 16, zIndex: 10,
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
          { label: `Controlled ${airspaceSummary?.controlled_airspace ?? 0}`, color: '#b65f70' },
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
