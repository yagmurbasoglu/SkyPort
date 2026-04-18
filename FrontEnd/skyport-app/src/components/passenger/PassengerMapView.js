import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box, Paper, Typography, Divider } from '@mui/material';
import { getMapStyle, hasMapboxToken } from '../../utils/mapStyle';

const ISTANBUL_CENTER = [28.9784, 41.0082];
const ISTANBUL_ZOOM = 10.5;

const scoreColor = (score) => {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#eab308';
  return '#ef4444';
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

  const [coords, setCoords] = useState({ lng: ISTANBUL_CENTER[0].toFixed(4), lat: ISTANBUL_CENTER[1].toFixed(4) });
  const [zoom, setZoom] = useState(ISTANBUL_ZOOM.toFixed(1));
  const [mapLoaded, setMapLoaded] = useState(false);

  // ── Initialize map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (map.current) return;

    const token = process.env.REACT_APP_MAPBOX_TOKEN;
    if (hasMapboxToken()) {
      mapboxgl.accessToken = token;
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
      // Add route source/layer stubs (empty initially)
      map.current.addSource('route-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-source',
        paint: {
          'line-color': '#8b5cf6',
          'line-width': 3,
          'line-opacity': 0.9,
          'line-dasharray': [3, 2],
        },
      });

      // From / To endpoint markers as a separate source
      map.current.addSource('route-endpoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
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
      if (map.current) { map.current.remove(); map.current = null; }
    };
  }, []);

  // ── Update vertiport markers when filteredVertiports changes ─────────────
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
        width: ${isSelected ? 18 : 14}px;
        height: ${isSelected ? 18 : 14}px;
        border-radius: 50%;
        background: ${scoreColor(vp.suitabilityScore)};
        border: ${isSelected ? '3px' : '2px'} solid #ffffff;
        cursor: pointer;
        box-shadow: 0 0 ${isSelected ? '14px' : '6px'} ${scoreColor(vp.suitabilityScore)}99;
        transition: all 0.2s;
      `;

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.25)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
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
    } else {
      // Clear route
      routeSrc.setData({ type: 'FeatureCollection', features: [] });
      epSrc.setData({ type: 'FeatureCollection', features: [] });
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
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Coordinate bar — bottom center */}
      <Paper
        sx={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, px: 2, py: 0.8,
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'rgba(10, 18, 35, 0.88)',
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
        background: 'rgba(10, 18, 35, 0.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '10px',
      }}>
        <Typography sx={{ fontSize: '0.6rem', color: '#334155', fontWeight: 700, letterSpacing: '0.07em', mb: 0.8, textTransform: 'uppercase' }}>
          Suitability
        </Typography>
        {[
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
