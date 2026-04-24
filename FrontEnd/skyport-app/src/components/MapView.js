import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Box, Paper, IconButton, Tooltip, Typography,
  Divider, Chip, Button, Fade,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CropFreeIcon from '@mui/icons-material/CropFree';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import LayersIcon from '@mui/icons-material/Layers';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { getMapStyle, hasMapboxToken } from '../utils/mapStyle';

const ISTANBUL_CENTER = [28.9784, 41.0082];
const ISTANBUL_ZOOM = 10.5;

const MAP_STYLES = [
  { id: 'mapbox://styles/mapbox/dark-v11', label: 'Dark' },
  { id: 'mapbox://styles/mapbox/satellite-streets-v12', label: 'Satellite' },
  { id: 'mapbox://styles/mapbox/light-v11', label: 'Light' },
];

const glassPanel = {
  background: 'rgba(2, 6, 23, 0.88)',
  backdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px',
};

const MapView = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  const [coords, setCoords] = useState({ lng: ISTANBUL_CENTER[0].toFixed(4), lat: ISTANBUL_CENTER[1].toFixed(4) });
  const [zoom, setZoom] = useState(ISTANBUL_ZOOM.toFixed(1));
  const [mapLoaded, setMapLoaded] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [bbox, setBbox] = useState(null);
  const [selectionRect, setSelectionRect] = useState(null);
  const [activeStyle, setActiveStyle] = useState(MAP_STYLES[0].id);
  const [showLayers, setShowLayers] = useState(false);

  const overlayRef = useRef(null);
  const isDrawing = useRef(false);
  const startPoint = useRef(null);
  const selectionRectRef = useRef(null);

  // ── Initialize map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (map.current) return;

    const token = process.env.REACT_APP_MAPBOX_TOKEN;
    if (hasMapboxToken()) {
      mapboxgl.accessToken = token;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: hasMapboxToken() ? activeStyle : getMapStyle(),
      center: ISTANBUL_CENTER,
      zoom: ISTANBUL_ZOOM,
      attributionControl: false,
      logoPosition: 'bottom-right',
    });

    map.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    map.current.on('load', () => setMapLoaded(true));

    map.current.on('move', () => {
      const c = map.current.getCenter();
      setCoords({ lng: c.lng.toFixed(4), lat: c.lat.toFixed(4) });
      setZoom(map.current.getZoom().toFixed(1));
    });

    map.current.on('mousemove', (e) => {
      setCoords({ lng: e.lngLat.lng.toFixed(4), lat: e.lngLat.lat.toFixed(4) });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draw bbox on map as GeoJSON layer ───────────────────────────────────────
  useEffect(() => {
    if (!map.current || !bbox || !mapLoaded) return;

    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [parseFloat(bbox.west), parseFloat(bbox.south)],
          [parseFloat(bbox.east), parseFloat(bbox.south)],
          [parseFloat(bbox.east), parseFloat(bbox.north)],
          [parseFloat(bbox.west), parseFloat(bbox.north)],
          [parseFloat(bbox.west), parseFloat(bbox.south)],
        ]],
      },
    };

    if (map.current.getSource('bbox-source')) {
      map.current.getSource('bbox-source').setData(geojson);
    } else {
      map.current.addSource('bbox-source', { type: 'geojson', data: geojson });
      map.current.addLayer({
        id: 'bbox-fill',
        type: 'fill',
        source: 'bbox-source',
        paint: { 'fill-color': '#b65f70', 'fill-opacity': 0.12 },
      });
      map.current.addLayer({
        id: 'bbox-outline',
        type: 'line',
        source: 'bbox-source',
        paint: { 'line-color': '#60a5fa', 'line-width': 2, 'line-dasharray': [4, 2] },
      });
    }
  }, [bbox, mapLoaded]);

  // ── Map controls ─────────────────────────────────────────────────────────────
  const zoomIn = () => map.current?.zoomIn({ duration: 300 });
  const zoomOut = () => map.current?.zoomOut({ duration: 300 });
  const resetView = () => map.current?.flyTo({ center: ISTANBUL_CENTER, zoom: ISTANBUL_ZOOM, duration: 1200 });

  const switchStyle = (styleId) => {
    if (!map.current) return;
    if (!hasMapboxToken()) {
      setShowLayers(false);
      return;
    }
    setActiveStyle(styleId);
    map.current.setStyle(styleId);
    // Re-add bbox layer after style change
    map.current.once('styledata', () => {
      setMapLoaded(false);
      setTimeout(() => setMapLoaded(true), 100);
    });
    setShowLayers(false);
  };

  const clearBbox = useCallback(() => {
    setBbox(null);
    setSelectionRect(null);
    selectionRectRef.current = null;
    if (map.current) {
      ['bbox-fill', 'bbox-outline'].forEach(id => {
        if (map.current.getLayer(id)) map.current.removeLayer(id);
      });
      if (map.current.getSource('bbox-source')) map.current.removeSource('bbox-source');
    }
  }, []);

  // ── Bounding box draw handlers ───────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (!overlayRef.current) return;
    isDrawing.current = true;
    const rect = overlayRef.current.getBoundingClientRect();
    startPoint.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      clientX: e.clientX,
      clientY: e.clientY,
    };
    setSelectionRect(null);
    selectionRectRef.current = null;
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDrawing.current || !startPoint.current || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const newRect = {
      left: Math.min(startPoint.current.x, cx),
      top: Math.min(startPoint.current.y, cy),
      width: Math.abs(cx - startPoint.current.x),
      height: Math.abs(cy - startPoint.current.y),
    };
    selectionRectRef.current = newRect;
    setSelectionRect(newRect);
  }, []);

  const handleMouseUp = useCallback((e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const currentRect = selectionRectRef.current;
    if (!currentRect || currentRect.width < 10 || currentRect.height < 10) {
      setSelectionRect(null);
      selectionRectRef.current = null;
      startPoint.current = null;
      return;
    }

    // Convert screen px → geographic coordinates
    const mapRect = mapContainer.current.getBoundingClientRect();
    const p1 = map.current.unproject([
      startPoint.current.clientX - mapRect.left,
      startPoint.current.clientY - mapRect.top,
    ]);
    const p2 = map.current.unproject([
      e.clientX - mapRect.left,
      e.clientY - mapRect.top,
    ]);

    const newBbox = {
      west: Math.min(p1.lng, p2.lng).toFixed(6),
      east: Math.max(p1.lng, p2.lng).toFixed(6),
      south: Math.min(p1.lat, p2.lat).toFixed(6),
      north: Math.max(p1.lat, p2.lat).toFixed(6),
    };

    clearBbox(); // remove any previous bbox
    setSelectionRect(null);
    selectionRectRef.current = null;
    startPoint.current = null;
    setBbox(newBbox);
    setDrawMode(false);
  }, [clearBbox]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* Map canvas */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Draw overlay (active when drawMode is on) */}
      {drawMode && (
        <Box
          ref={overlayRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          sx={{
            position: 'absolute', inset: 0,
            cursor: 'crosshair',
            zIndex: 5,
            userSelect: 'none',
          }}
        />
      )}

      {/* Live selection rectangle */}
      {selectionRect && (
        <Box
          sx={{
            position: 'absolute',
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
            border: '2px dashed #60a5fa',
            background: 'rgba(182, 95, 112, 0.1)',
            pointerEvents: 'none',
            zIndex: 6,
            boxShadow: '0 0 0 1px rgba(182,95,112,0.2)',
          }}
        />
      )}

      {/* ── TOP LEFT: Tool Panel ── */}
      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Paper sx={{ ...glassPanel, p: 1.5, minWidth: 180 }}>
          <Typography variant="subtitle2" sx={{ color: '#94a3b8', mb: 1.5, px: 0.5 }}>
            Analysis Tools
          </Typography>

          <Tooltip title={drawMode ? 'Cancel selection' : 'Draw bounding box'}>
            <Button
              id="draw-bbox-btn"
              fullWidth
              startIcon={<CropFreeIcon sx={{ fontSize: 16 }} />}
              onClick={() => { setDrawMode(prev => !prev); clearBbox(); }}
              size="small"
              variant={drawMode ? 'contained' : 'outlined'}
              sx={{
                justifyContent: 'flex-start',
                textTransform: 'none',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderColor: drawMode ? 'transparent' : 'rgba(182,95,112,0.4)',
                color: drawMode ? '#fff' : '#60a5fa',
                background: drawMode
                  ? 'linear-gradient(135deg, #b65f70, #2563eb)'
                  : 'rgba(182,95,112,0.07)',
                '&:hover': {
                  background: drawMode
                    ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                    : 'rgba(182,95,112,0.14)',
                },
              }}
            >
              {drawMode ? 'Drawing...' : 'Bounding Box'}
            </Button>
          </Tooltip>

          {bbox && (
            <>
              <Divider sx={{ my: 1 }} />
              <Tooltip title="Clear selection">
                <Button
                  id="clear-bbox-btn"
                  fullWidth
                  startIcon={<DeleteOutlineIcon sx={{ fontSize: 16 }} />}
                  onClick={clearBbox}
                  size="small"
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    color: '#f87171',
                    borderColor: 'rgba(248,113,113,0.4)',
                    background: 'rgba(248,113,113,0.07)',
                    '&:hover': { background: 'rgba(248,113,113,0.14)' },
                  }}
                >
                  Clear Selection
                </Button>
              </Tooltip>
            </>
          )}
        </Paper>
      </Box>

      {/* ── TOP RIGHT: Layers Panel ── */}
      <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
        <Tooltip title="Switch base map">
          <IconButton
            id="layers-btn"
            onClick={() => setShowLayers(prev => !prev)}
            sx={{
              ...glassPanel,
              width: 40, height: 40,
              color: showLayers ? '#60a5fa' : '#94a3b8',
            }}
          >
            <LayersIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Fade in={showLayers}>
          <Paper sx={{ ...glassPanel, position: 'absolute', top: 48, right: 0, p: 1, minWidth: 130 }}>
            {MAP_STYLES.map(style => (
              <Box
                key={style.id}
                onClick={() => switchStyle(style.id)}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  px: 1.5, py: 0.8, borderRadius: 1, cursor: 'pointer',
                  transition: 'all 0.15s',
                  background: activeStyle === style.id ? 'rgba(182,95,112,0.15)' : 'transparent',
                  '&:hover': { background: 'rgba(255,255,255,0.06)' },
                }}
              >
                <Typography variant="body2" sx={{ color: activeStyle === style.id ? '#60a5fa' : '#cbd5e1' }}>
                  {style.label}
                </Typography>
                {activeStyle === style.id && <CheckIcon sx={{ fontSize: 14, color: '#60a5fa' }} />}
              </Box>
            ))}
          </Paper>
        </Fade>
      </Box>

      {/* ── RIGHT CENTER: Zoom Controls ── */}
      <Paper
        sx={{
          ...glassPanel,
          position: 'absolute',
          right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 0.5,
        }}
      >
        <Tooltip title="Zoom in">
          <IconButton id="zoom-in-btn" onClick={zoomIn} size="small" sx={{ color: '#94a3b8', '&:hover': { color: '#e2e8f0' } }}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Divider flexItem />
        <Tooltip title="Zoom out">
          <IconButton id="zoom-out-btn" onClick={zoomOut} size="small" sx={{ color: '#94a3b8', '&:hover': { color: '#e2e8f0' } }}>
            <RemoveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Divider flexItem />
        <Tooltip title="Reset to Istanbul">
          <IconButton id="reset-view-btn" onClick={resetView} size="small" sx={{ color: '#94a3b8', '&:hover': { color: '#60a5fa' } }}>
            <MyLocationIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>

      {/* ── BOTTOM CENTER: Coordinate Bar ── */}
      <Paper
        sx={{
          ...glassPanel,
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          px: 2,
          py: 0.8,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, letterSpacing: '0.06em' }}>LNG</Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: '"Roboto Mono", monospace', minWidth: 72 }}>
            {coords.lng}
          </Typography>
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, letterSpacing: '0.06em' }}>LAT</Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: '"Roboto Mono", monospace', minWidth: 72 }}>
            {coords.lat}
          </Typography>
        </Box>
        <Divider orientation="vertical" flexItem />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600, letterSpacing: '0.06em' }}>ZOOM</Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: '"Roboto Mono", monospace', minWidth: 36 }}>
            {zoom}
          </Typography>
        </Box>
      </Paper>

      {/* ── BOTTOM LEFT: BBox Info Panel ── */}
      <Fade in={!!bbox}>
        <Paper
          sx={{
            ...glassPanel,
            position: 'absolute',
            bottom: 16,
            left: 16,
            zIndex: 10,
            p: 1.5,
            minWidth: 220,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
            <InfoOutlinedIcon sx={{ fontSize: 14, color: '#b65f70' }} />
            <Typography variant="subtitle2" sx={{ color: '#94a3b8' }}>
              Selected Area
            </Typography>
            <Chip
              label="Active"
              size="small"
              sx={{
                ml: 'auto', height: 18, fontSize: '0.6rem',
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.3)',
                color: '#4ade80',
              }}
            />
          </Box>
          {bbox && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
              {[
                { label: 'North', val: bbox.north },
                { label: 'South', val: bbox.south },
                { label: 'West', val: bbox.west },
                { label: 'East', val: bbox.east },
              ].map(({ label, val }) => (
                <Box key={label} sx={{ background: 'rgba(255,255,255,0.04)', borderRadius: 1, p: 0.8 }}>
                  <Typography sx={{ fontSize: '0.6rem', color: '#475569', fontWeight: 700, letterSpacing: '0.07em', mb: 0.2 }}>
                    {label.toUpperCase()}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: '"Roboto Mono", monospace' }}>
                    {val}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Fade>

      {/* ── DRAW MODE Hint ── */}
      <Fade in={drawMode}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 4,
            pointerEvents: 'none',
          }}
        >
          <Paper
            sx={{
              ...glassPanel,
              px: 3, py: 1.5,
              border: '1px solid rgba(182,95,112,0.3)',
              background: 'rgba(2, 6, 23, 0.75)',
            }}
          >
            <Typography sx={{ fontSize: '0.82rem', color: '#94a3b8', textAlign: 'center' }}>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>Click and drag</span> to select the analysis area
            </Typography>
          </Paper>
        </Box>
      </Fade>
    </Box>
  );
};

export default MapView;
