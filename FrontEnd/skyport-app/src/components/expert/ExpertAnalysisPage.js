import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  Modal,
  Paper,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CropFreeIcon from '@mui/icons-material/CropFree';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import FmdGoodIcon from '@mui/icons-material/FmdGood';
import LogoutIcon from '@mui/icons-material/Logout';
import MapIcon from '@mui/icons-material/Map';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import RouteIcon from '@mui/icons-material/AltRoute';
import ScienceIcon from '@mui/icons-material/Science';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { getMapStyle, hasMapboxToken } from '../../utils/mapStyle';

const ISTANBUL_CENTER = [28.9784, 41.0082];
const ISTANBUL_ZOOM = 9.35;
const ISTANBUL_AIRSPACE_BOUNDS = {
  west: 28.45,
  east: 29.55,
  south: 40.75,
  north: 41.48,
};
const DEFAULT_WEIGHTS = { obstacle: 0.35, transport: 0.25, land_use: 0.2, nfz: 0.2 };
const criteriaLabels = { obstacle: 'Obstacles', transport: 'Transport', land_use: 'Land Use', nfz: 'NFZ' };
const emptyCollection = { type: 'FeatureCollection', features: [] };
const DEFAULT_EXPERT_ROUTE = {
  fromName: 'Taksim Central Vertiport',
  toName: 'Uskudar Ferry Vertiport',
  maxWindKmh: 35,
};
const DEFAULT_ROUTE_POINTS = {
  from: { lat: 41.0369, lng: 28.985, name: 'Taksim Central Vertiport' },
  to: { lat: 41.022, lng: 29.0151, name: 'Uskudar Ferry Vertiport' },
};

const panelSx = {
  background: 'rgba(9, 14, 26, 0.92)',
  backdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  boxShadow: '0 10px 32px rgba(0,0,0,0.35)',
};

const scrollPanelSx = {
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(148,163,184,0.42) rgba(15,23,42,0.28)',
  '&::-webkit-scrollbar': {
    width: 7,
  },
  '&::-webkit-scrollbar-track': {
    background: 'rgba(15,23,42,0.28)',
    borderRadius: '8px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(148,163,184,0.42)',
    borderRadius: '8px',
    border: '2px solid rgba(15,23,42,0.28)',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    background: 'rgba(203,213,225,0.58)',
  },
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: '#e2e8f0',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '8px',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.24)' },
    '&.Mui-focused fieldset': { borderColor: '#38bdf8' },
  },
  '& .MuiInputLabel-root': { color: '#94a3b8' },
};

const statusColor = (status) => {
  if (status === 'completed' || status === 'success') return '#22c55e';
  if (status === 'partial_success' || status === 'running') return '#f59e0b';
  if (status === 'failed' || status === 'unsafe' || status === 'weather_risk') return '#ef4444';
  if (status === 'warning') return '#f97316';
  if (status === 'safe') return '#22c55e';
  return '#94a3b8';
};

const statusChipSx = (status) => {
  if (status === 'unsafe' || status === 'failed' || status === 'weather_risk') {
    return {
      bgcolor: 'rgba(239,68,68,0.24)',
      color: '#fecaca',
      border: '1px solid rgba(248,113,113,0.6)',
      height: 24,
      fontWeight: 900,
      textTransform: 'uppercase',
    };
  }
  return {
    bgcolor: `${statusColor(status)}22`,
    color: statusColor(status),
    height: 22,
    fontWeight: 800,
  };
};

const scoreColor = (score) => {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
};

const bboxToFeature = (bbox) => ({
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [bbox.west, bbox.south],
      [bbox.east, bbox.south],
      [bbox.east, bbox.north],
      [bbox.west, bbox.north],
      [bbox.west, bbox.south],
    ]],
  },
  properties: {},
});

const createAircraftElement = (blocked = false) => {
  const shell = document.createElement('div');
  shell.style.cssText = `
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    pointer-events: none;
    filter: drop-shadow(0 0 12px ${blocked ? 'rgba(239,68,68,0.95)' : 'rgba(56,189,248,0.95)'});
  `;
  shell.innerHTML = `
    <svg width="38" height="38" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="20" fill="${blocked ? 'rgba(239,68,68,0.22)' : 'rgba(14,165,233,0.22)'}" stroke="${blocked ? '#fca5a5' : '#7dd3fc'}" stroke-width="2"/>
      <path d="M31 9 L39 31 L56 38 L55 44 L37 40 L32 55 L27 55 L27 40 L9 44 L8 38 L25 31 Z" fill="${blocked ? '#ef4444' : '#38bdf8'}" stroke="#f8fafc" stroke-width="2" stroke-linejoin="round"/>
      <path d="M26 31 H38" stroke="#0f172a" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
    </svg>
  `;
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

const ExpertAnalysisPage = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const mapContainer = useRef(null);
  const map = useRef(null);
  const drawOverlay = useRef(null);
  const startPoint = useRef(null);
  const selectionRectRef = useRef(null);
  const isDrawing = useRef(false);
  const aircraftMarkerRef = useRef(null);
  const aircraftFrameRef = useRef(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapNotice, setMapNotice] = useState('');
  const [drawMode, setDrawMode] = useState(false);
  const [selectionRect, setSelectionRect] = useState(null);
  const [bbox, setBbox] = useState(null);
  const [coords, setCoords] = useState({ lng: ISTANBUL_CENTER[0], lat: ISTANBUL_CENTER[1] });
  const [regionName, setRegionName] = useState('Istanbul Expert Analysis');
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [ingestJob, setIngestJob] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [routeForm, setRouteForm] = useState(DEFAULT_EXPERT_ROUTE);
  const [routePickMode, setRoutePickMode] = useState(null);
  const [routePoints, setRoutePoints] = useState(DEFAULT_ROUTE_POINTS);
  const [routeResult, setRouteResult] = useState(null);
  const [airspaceSummary, setAirspaceSummary] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [jobProgress, setJobProgress] = useState({
    open: false,
    phase: '',
    percent: 0,
    message: '',
  });

  const weightTotal = useMemo(() => Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0), [weights]);
  const canRunAnalysis = ingestJob?.status === 'success' || ingestJob?.status === 'partial_success';

  const fetchAirspace = useCallback(async (bounds) => {
    if (!map.current) return;
    const source = map.current.getSource('airspace-overlay');
    if (!source) return;
    try {
      const response = await axios.get('/api/geodata/airspace', { params: bounds });
      source.setData(response.data);
      setAirspaceSummary(response.data.summary);
    } catch (err) {
      source.setData(emptyCollection);
      setAirspaceSummary(null);
    }
  }, []);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    const token = process.env.REACT_APP_MAPBOX_TOKEN;
    if (hasMapboxToken()) {
      mapboxgl.accessToken = token;
    } else {
      mapboxgl.accessToken = 'not-required-for-osm-raster-style';
      setMapNotice('OpenStreetMap mode is active. Add a Mapbox token later if you want the dark Mapbox basemap.');
    }

    const instance = new mapboxgl.Map({
      container: mapContainer.current,
      style: getMapStyle(),
      center: ISTANBUL_CENTER,
      zoom: ISTANBUL_ZOOM,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });
    map.current = instance;

    instance.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    instance.on('error', (event) => {
      const message = event?.error?.message || 'Map could not load.';
      setMapNotice(`Map service warning: ${message}`);
    });
      instance.on('mousemove', (event) => setCoords({ lng: event.lngLat.lng, lat: event.lngLat.lat }));
      instance.on('load', () => {
        setMapReady(true);
      instance.resize();
      instance.addSource('bbox-source', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'bbox-fill',
        type: 'fill',
        source: 'bbox-source',
        paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.12 },
      });
      instance.addLayer({
        id: 'bbox-outline',
        type: 'line',
        source: 'bbox-source',
        paint: { 'line-color': '#7dd3fc', 'line-width': 2, 'line-dasharray': [3, 2] },
      });
      instance.addSource('analysis-heatmap', { type: 'geojson', data: emptyCollection });
      instance.addSource('airspace-overlay', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'airspace-nfz-fill',
        type: 'fill',
        source: 'airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'nfz'],
        paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.24 },
      });
      instance.addLayer({
        id: 'airspace-nfz-line',
        type: 'line',
        source: 'airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'nfz'],
        paint: { 'line-color': '#f87171', 'line-width': 2 },
      });
      instance.addLayer({
        id: 'airspace-controlled-fill',
        type: 'fill',
        source: 'airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'controlled_airspace'],
        paint: { 'fill-color': '#38bdf8', 'fill-opacity': 0.18 },
      });
      instance.addLayer({
        id: 'airspace-controlled-line',
        type: 'line',
        source: 'airspace-overlay',
        filter: ['==', ['get', 'zone_category'], 'controlled_airspace'],
        paint: { 'line-color': '#7dd3fc', 'line-width': 2 },
      });
      instance.addLayer({
        id: 'analysis-heatmap-fill',
        type: 'fill',
        source: 'analysis-heatmap',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'suitability_score'],
            0, '#ef4444',
            50, '#f59e0b',
            75, '#22c55e',
            100, '#06b6d4',
          ],
          'fill-opacity': 0.46,
        },
      });
      instance.addLayer({
        id: 'analysis-heatmap-line',
        type: 'line',
        source: 'analysis-heatmap',
        paint: { 'line-color': 'rgba(255,255,255,0.45)', 'line-width': 0.7 },
      });
      instance.addSource('expert-route', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'expert-route-line',
        type: 'line',
        source: 'expert-route',
        paint: { 'line-color': '#f97316', 'line-width': 6, 'line-opacity': 1, 'line-dasharray': [1.4, 0.8] },
      });
      instance.addSource('expert-route-points', { type: 'geojson', data: emptyCollection });
      instance.addLayer({
        id: 'expert-route-point-circles',
        type: 'circle',
        source: 'expert-route-points',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      fetchAirspace(ISTANBUL_AIRSPACE_BOUNDS);
    });
    return () => {
      if (aircraftFrameRef.current) cancelAnimationFrame(aircraftFrameRef.current);
      if (aircraftMarkerRef.current) aircraftMarkerRef.current.remove();
      if (instance) {
        instance.remove();
        if (map.current === instance) {
          map.current = null;
        }
      }
    };
  }, [fetchAirspace]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    map.current.getSource('bbox-source')?.setData(bbox ? bboxToFeature(bbox) : emptyCollection);
  }, [bbox, mapReady]);

  const updateProgress = useCallback((patch) => {
    setJobProgress((prev) => ({ ...prev, open: true, ...patch }));
  }, []);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    fetchAirspace(ISTANBUL_AIRSPACE_BOUNDS);
  }, [fetchAirspace, mapReady]);

  useEffect(() => {
    if (!mapReady || !map.current) return;
    const source = map.current.getSource('expert-route-points');
    if (!source) return;
    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [routePoints.from.lng, routePoints.from.lat] },
          properties: { role: 'from', color: '#22c55e' },
        },
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [routePoints.to.lng, routePoints.to.lat] },
          properties: { role: 'to', color: '#ef4444' },
        },
      ],
    });
  }, [mapReady, routePoints]);

  const setHeatmap = useCallback((geojson) => {
    const source = map.current?.getSource('analysis-heatmap');
    if (!source) return;
    source.setData(geojson || emptyCollection);
    if (geojson?.features?.length) {
      const bounds = new mapboxgl.LngLatBounds();
      geojson.features.forEach((feature) => feature.geometry.coordinates[0].forEach((coord) => bounds.extend(coord)));
      map.current.fitBounds(bounds, { padding: 72, duration: 900 });
    }
  }, []);

  const setRouteLayer = useCallback((route) => {
    const source = map.current?.getSource('expert-route');
    if (!source) return;
    if (!route?.coordinates?.length) {
      source.setData(emptyCollection);
      if (aircraftFrameRef.current) cancelAnimationFrame(aircraftFrameRef.current);
      if (aircraftMarkerRef.current) {
        aircraftMarkerRef.current.remove();
        aircraftMarkerRef.current = null;
      }
      return;
    }
    source.setData({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: route.coordinates },
      properties: { route_id: route.route_id, safety_status: route.safety_status },
    });
    const bounds = new mapboxgl.LngLatBounds();
    route.coordinates.forEach((coord) => bounds.extend(coord));
    map.current.fitBounds(bounds, { padding: 82, duration: 900 });

    if (aircraftFrameRef.current) cancelAnimationFrame(aircraftFrameRef.current);
    if (aircraftMarkerRef.current) aircraftMarkerRef.current.remove();
    const isBlocked = route.is_safe === false || route.safety_status === 'unsafe' || route.safety_status === 'weather_risk';
    aircraftMarkerRef.current = new mapboxgl.Marker({ element: createAircraftElement(isBlocked) })
      .setLngLat(route.coordinates[0])
      .addTo(map.current);
    const endProgress = isBlocked ? routeStopProgress(route) : 1;
    const stopPoint = isBlocked ? routeStopPoint(route) : null;
    const durationMs = isBlocked ? 2400 : 4200;
    const startTime = performance.now();
    const animate = (now) => {
      const raw = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - ((1 - raw) ** 3);
      const point = raw >= 1 && stopPoint ? stopPoint : routePointAt(route.coordinates, eased * endProgress);
      if (point && aircraftMarkerRef.current) aircraftMarkerRef.current.setLngLat(point);
      if (raw < 1) aircraftFrameRef.current = requestAnimationFrame(animate);
    };
    aircraftFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (!mapReady || !map.current || !routePickMode) return undefined;
    const instance = map.current;
    const handleClick = (event) => {
      const nextPoint = {
        lat: Number(event.lngLat.lat.toFixed(6)),
        lng: Number(event.lngLat.lng.toFixed(6)),
        name: routePickMode === 'from' ? 'Expert selected origin' : 'Expert selected destination',
      };
      setRoutePoints((prev) => ({ ...prev, [routePickMode]: nextPoint }));
      setRouteResult(null);
      setRouteLayer(null);
      setRoutePickMode(routePickMode === 'from' ? 'to' : null);
    };
    instance.getCanvas().style.cursor = 'crosshair';
    instance.on('click', handleClick);
    return () => {
      instance.off('click', handleClick);
      instance.getCanvas().style.cursor = '';
    };
  }, [mapReady, routePickMode, setRouteLayer]);

  const resetExpertRoute = useCallback(() => {
    setRoutePickMode(null);
    setRoutePoints(DEFAULT_ROUTE_POINTS);
    setRouteForm(DEFAULT_EXPERT_ROUTE);
    setRouteResult(null);
    setRouteLayer(null);
  }, [setRouteLayer]);

  const swapExpertRoute = useCallback(() => {
    setRoutePickMode(null);
    setRoutePoints((prev) => ({ from: prev.to, to: prev.from }));
    setRouteResult(null);
    setRouteLayer(null);
  }, [setRouteLayer]);

  const clearSelection = useCallback(() => {
    setBbox(null);
    setSelectionRect(null);
    selectionRectRef.current = null;
    setIngestJob(null);
    setAnalysis(null);
    setAnalysisResult(null);
    setCompareResult(null);
    setAirspaceSummary(null);
    setHeatmap(emptyCollection);
    setRouteResult(null);
    setRouteLayer(null);
  }, [setHeatmap, setRouteLayer]);

  const handleMouseDown = useCallback((event) => {
    if (!drawOverlay.current) return;
    isDrawing.current = true;
    const rect = drawOverlay.current.getBoundingClientRect();
    startPoint.current = { x: event.clientX - rect.left, y: event.clientY - rect.top, clientX: event.clientX, clientY: event.clientY };
    selectionRectRef.current = null;
    setSelectionRect(null);
  }, []);

  const handleMouseMove = useCallback((event) => {
    if (!isDrawing.current || !startPoint.current || !drawOverlay.current) return;
    const rect = drawOverlay.current.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const next = {
      left: Math.min(startPoint.current.x, cx),
      top: Math.min(startPoint.current.y, cy),
      width: Math.abs(cx - startPoint.current.x),
      height: Math.abs(cy - startPoint.current.y),
    };
    selectionRectRef.current = next;
    setSelectionRect(next);
  }, []);

  const handleMouseUp = useCallback((event) => {
    if (!isDrawing.current || !map.current || !mapContainer.current) return;
    isDrawing.current = false;
    const currentRect = selectionRectRef.current;
    if (!currentRect || currentRect.width < 12 || currentRect.height < 12) {
      setSelectionRect(null);
      selectionRectRef.current = null;
      startPoint.current = null;
      return;
    }
    const rect = mapContainer.current.getBoundingClientRect();
    const p1 = map.current.unproject([startPoint.current.clientX - rect.left, startPoint.current.clientY - rect.top]);
    const p2 = map.current.unproject([event.clientX - rect.left, event.clientY - rect.top]);
    setBbox({
      west: Number(Math.min(p1.lng, p2.lng).toFixed(6)),
      east: Number(Math.max(p1.lng, p2.lng).toFixed(6)),
      south: Number(Math.min(p1.lat, p2.lat).toFixed(6)),
      north: Number(Math.max(p1.lat, p2.lat).toFixed(6)),
    });
    setSelectionRect(null);
    selectionRectRef.current = null;
    startPoint.current = null;
    setDrawMode(false);
    setIngestJob(null);
    setAnalysis(null);
    setAnalysisResult(null);
    setCompareResult(null);
    setAirspaceSummary(null);
    setHeatmap(emptyCollection);
  }, [setHeatmap]);

  const pollIngest = async (jobId) => {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const response = await axios.get(`/api/geodata/ingest/${jobId}`);
      setIngestJob(response.data);
      const percent = response.data.status === 'running'
        ? Math.min(15 + Math.round((attempt / 180) * 70), 92)
        : 100;
      updateProgress({
        phase: 'Geodata Ingest',
        percent,
        message: response.data.status === 'running'
          ? 'OSM, H3, NFZ and controlled airspace layers are being prepared.'
          : `Geodata ingest ${response.data.status}.`,
      });
      if (['success', 'partial_success', 'failed'].includes(response.data.status)) return response.data;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Geodata ingest is still running. Keep the page open and try status again shortly.');
  };

  const pollAnalysis = async (analysisId) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await axios.get(`/api/analysis/${analysisId}/status`);
      setAnalysis(response.data);
      const percent = response.data.status === 'running'
        ? Math.min(72 + Math.round((attempt / 120) * 22), 96)
        : 100;
      updateProgress({
        phase: 'AHP/TOPSIS Analysis',
        percent,
        message: response.data.status === 'running'
          ? 'Suitability scores and heatmap polygons are being calculated.'
          : `Analysis ${response.data.status}.`,
      });
      if (['completed', 'failed'].includes(response.data.status)) return response.data;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Analysis did not finish in time.');
  };

  const runAnalysis = async (jobOverride = null) => {
    const job = jobOverride || ingestJob;
    const isReady = job?.status === 'success' || job?.status === 'partial_success';
    if (!isReady) {
      setError('Run geodata ingest first.');
      return;
    }
    if (Math.abs(weightTotal - 1) > 0.001) {
      setError('Criteria weights must sum to 1.0.');
      return;
    }
    setError('');
    setBusy('analysis');
    setCompareResult(null);
    updateProgress({
      phase: 'AHP/TOPSIS Analysis',
      percent: 70,
      message: 'Analysis job is starting.',
    });
    try {
      const created = await axios.post('/api/analysis', {
        geodata_job_id: job.job_id,
        region_name: `${regionName} AHP TOPSIS`,
        criteria_weights: weights,
      });
      setAnalysis(created.data);
      const finalStatus = await pollAnalysis(created.data.analysis_id);
      if (finalStatus.status === 'failed') {
        setError('Analysis failed.');
        return;
      }
      const [resultResponse, heatmapResponse] = await Promise.all([
        axios.get(`/api/analysis/${created.data.analysis_id}/result`),
        axios.get(`/api/analysis/${created.data.analysis_id}/heatmap`),
      ]);
      setAnalysisResult(resultResponse.data);
      setHeatmap(heatmapResponse.data);
      updateProgress({
        phase: 'Completed',
        percent: 100,
        message: 'Geodata ingest and AHP/TOPSIS analysis completed.',
      });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || err.message);
    } finally {
      setBusy('');
    }
  };

  const runGeodataIngest = async () => {
    if (!bbox) {
      setError('Select an analysis area on the map.');
      return;
    }
    setError('');
    setBusy('ingest');
    setAnalysis(null);
    setAnalysisResult(null);
    setCompareResult(null);
    setHeatmap(emptyCollection);
    updateProgress({
      phase: 'Geodata Ingest',
      percent: 5,
      message: 'Geodata ingest job is starting.',
    });
    try {
      const created = await axios.post('/api/geodata/ingest', {
        region_name: regionName,
        h3_resolution: 8,
        bounding_box: bbox,
      });
      setIngestJob(created.data);
      const finalJob = await pollIngest(created.data.job_id);
      if (finalJob.status === 'failed') setError('Geodata ingest failed. Select a smaller Istanbul area and try again.');
      if (finalJob.status === 'success' || finalJob.status === 'partial_success') {
        await runAnalysis(finalJob);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || err.message);
    } finally {
      if (busy !== 'analysis') setBusy('');
    }
  };

  const compareTopCandidates = async () => {
    if (!analysisResult?.top_candidates?.length || !analysisResult?.analysis_id) return;
    setBusy('compare');
    setError('');
    try {
      const cellIndexes = analysisResult.top_candidates.slice(0, 3).map((candidate) => candidate.cell_index);
      const response = await axios.post('/api/analysis/compare', { analysis_id: analysisResult.analysis_id, cell_indexes: cellIndexes });
      setCompareResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || err.message);
    } finally {
      setBusy('');
    }
  };

  const runExpertRouteSafety = async () => {
    setBusy('route');
    setError('');
    setRouteResult(null);
    setRouteLayer(null);
    try {
      const response = await axios.post('/api/route', {
        from_point: {
          lat: routePoints.from.lat,
          lng: routePoints.from.lng,
          name: routePoints.from.name || routeForm.fromName || 'Expert route origin',
        },
        to_point: {
          lat: routePoints.to.lat,
          lng: routePoints.to.lng,
          name: routePoints.to.name || routeForm.toName || 'Expert route destination',
        },
        constraints: {
          avoid_nfz: true,
          avoid_obstacles: true,
          max_wind_kmh: Number(routeForm.maxWindKmh),
        },
      });
      setRouteResult(response.data);
      setRouteLayer(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || err.message);
    } finally {
      setBusy('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Box sx={{ height: '100vh', width: '100%', bgcolor: '#090e1a', overflow: 'hidden', position: 'relative' }}>
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {mapNotice && (
        <Alert severity="info" sx={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 21, maxWidth: 440, fontSize: '0.76rem', py: 0.5 }}>
          {mapNotice}
        </Alert>
      )}
      {!mapReady && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 5, pointerEvents: 'none' }}>
          <CircularProgress sx={{ color: '#38bdf8' }} />
        </Box>
      )}
      {drawMode && (
        <Box ref={drawOverlay} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} sx={{ position: 'absolute', inset: 0, zIndex: 12, cursor: 'crosshair', userSelect: 'none' }} />
      )}
      {selectionRect && (
        <Box sx={{ position: 'absolute', zIndex: 13, left: selectionRect.left, top: selectionRect.top, width: selectionRect.width, height: selectionRect.height, border: '2px dashed #7dd3fc', background: 'rgba(56,189,248,0.12)', pointerEvents: 'none' }} />
      )}

      <Paper sx={{ ...panelSx, position: 'absolute', top: 16, left: 16, right: 16, zIndex: 20, px: 2, py: 1.3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(56,189,248,0.14)', color: '#7dd3fc' }}>
            <FlightTakeoffIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1rem' }}>SkyPort Expert Analysis</Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>{user?.full_name || 'Expert'} · AHP/TOPSIS suitability workflow</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Reset to Istanbul">
            <IconButton onClick={() => map.current?.flyTo({ center: ISTANBUL_CENTER, zoom: ISTANBUL_ZOOM, duration: 900 })} sx={{ color: '#94a3b8' }}>
              <MyLocationIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button startIcon={<LogoutIcon />} onClick={handleLogout} sx={{ color: '#fca5a5', borderRadius: '8px', textTransform: 'none' }}>
            Logout
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ ...panelSx, ...scrollPanelSx, position: 'absolute', top: 92, left: 16, zIndex: 20, width: { xs: 'calc(100% - 32px)', md: 390 }, maxHeight: 'calc(100vh - 124px)', overflow: 'auto', p: 2 }}>
        <Stack spacing={2}>
          <Box>
            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <MapIcon fontSize="small" /> Region Selection
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.76rem', mt: 0.5 }}>
              Draw a bounded Istanbul area, ingest geodata, then run AHP/TOPSIS scoring.
            </Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Region Name" size="small" value={regionName} onChange={(event) => setRegionName(event.target.value)} sx={fieldSx} />
          <Stack direction="row" spacing={1}>
            <Button fullWidth startIcon={<CropFreeIcon />} variant={drawMode ? 'contained' : 'outlined'} onClick={() => { setDrawMode((prev) => !prev); setError(''); }} sx={{ borderRadius: '8px', textTransform: 'none' }}>
              {drawMode ? 'Selecting' : 'Select Area'}
            </Button>
            <Button startIcon={<DeleteOutlineIcon />} onClick={clearSelection} sx={{ color: '#fca5a5', borderRadius: '8px', textTransform: 'none' }}>
              Clear
            </Button>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {['north', 'south', 'west', 'east'].map((key) => (
              <Box key={key} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1 }}>
                <Typography sx={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 800 }}>{key.toUpperCase()}</Typography>
                <Typography sx={{ color: '#cbd5e1', fontSize: '0.76rem', fontFamily: 'monospace' }}>{bbox ? Number(bbox[key]).toFixed(6) : 'not set'}</Typography>
              </Box>
            ))}
          </Box>
          <Button fullWidth variant="contained" onClick={runGeodataIngest} disabled={!bbox || Boolean(busy)} sx={{ bgcolor: '#0891b2', borderRadius: '8px', textTransform: 'none', fontWeight: 800, '&:hover': { bgcolor: '#0e7490' } }}>
            {busy === 'ingest' || busy === 'analysis' ? <CircularProgress size={22} color="inherit" /> : 'Run Geodata + Analysis'}
          </Button>
          {ingestJob && (
            <StatusPanel
              title="Geodata Job"
              status={ingestJob.status}
              rows={[
                ['Job ID', ingestJob.job_id],
                ['Buildings', ingestJob.layer_counts?.buildings ?? 0],
                ['Roads', ingestJob.layer_counts?.roads ?? 0],
                ['Land Use', ingestJob.layer_counts?.land_use ?? 0],
                ['H3 Cells', ingestJob.layer_counts?.h3_cells ?? 0],
              ]}
              warnings={ingestJob.warnings}
            />
          )}
          {Number(ingestJob?.layer_counts?.h3_cells ?? 0) < 3 && ingestJob && (
            <Alert severity="info" sx={{ fontSize: '0.76rem' }}>
              Select a larger area for a more sensitive TOPSIS comparison. Single-cell results use a weighted MCDM fallback.
            </Alert>
          )}
          {airspaceSummary && (
            <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
              <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, mb: 0.8 }}>Istanbul Airspace Overlay</Typography>
              <Stack direction="row" spacing={1}>
                <Chip label={`NFZ ${airspaceSummary.nfz ?? 0}`} size="small" sx={{ bgcolor: 'rgba(239,68,68,0.18)', color: '#fca5a5', fontWeight: 800 }} />
                <Chip label={`Controlled ${airspaceSummary.controlled_airspace ?? 0}`} size="small" sx={{ bgcolor: 'rgba(56,189,248,0.18)', color: '#7dd3fc', fontWeight: 800 }} />
              </Stack>
            </Box>
          )}
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <Box>
            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScienceIcon fontSize="small" /> AHP/TOPSIS Weights
            </Typography>
            <Typography sx={{ color: Math.abs(weightTotal - 1) <= 0.001 ? '#86efac' : '#fca5a5', fontSize: '0.76rem', mt: 0.5 }}>
              Total weight: {weightTotal.toFixed(2)}
            </Typography>
          </Box>
          {Object.entries(weights).map(([key, value]) => (
            <Box key={key}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem' }}>{criteriaLabels[key]}</Typography>
                <Typography sx={{ color: '#94a3b8', fontSize: '0.78rem' }}>{Number(value).toFixed(2)}</Typography>
              </Box>
              <Slider min={0} max={1} step={0.05} value={Number(value)} onChange={(_, nextValue) => setWeights((prev) => ({ ...prev, [key]: Number(nextValue) }))} sx={{ color: '#38bdf8', py: 0 }} />
            </Box>
          ))}
          <Button fullWidth variant="contained" startIcon={<AnalyticsIcon />} onClick={() => runAnalysis()} disabled={!canRunAnalysis || Boolean(busy)} sx={{ bgcolor: '#16a34a', borderRadius: '8px', textTransform: 'none', fontWeight: 800, '&:hover': { bgcolor: '#15803d' } }}>
            {busy === 'analysis' ? <CircularProgress size={22} color="inherit" /> : 'Run AHP/TOPSIS Analysis'}
          </Button>
          {analysis && (
            <StatusPanel
              title="Analysis Job"
              status={analysis.status}
              rows={[
                ['Analysis ID', analysis.analysis_id],
                ['Started', analysis.started_at ? new Date(analysis.started_at).toLocaleTimeString() : 'pending'],
                ['Completed', analysis.completed_at ? new Date(analysis.completed_at).toLocaleTimeString() : 'pending'],
              ]}
            />
          )}
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          <Box>
            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <RouteIcon fontSize="small" /> Route Safety
            </Typography>
            <Typography sx={{ color: '#94a3b8', fontSize: '0.76rem', mt: 0.5 }}>
              Pick two map points to validate an operational corridor against NFZ, controlled airspace, and Open-Meteo wind.
            </Typography>
          </Box>
          {routePickMode && (
            <Alert severity="info" sx={{ fontSize: '0.74rem' }}>
              Click the map to set the {routePickMode === 'from' ? 'origin' : 'destination'} point.
              {routePickMode === 'from' ? ' Destination selection starts after that.' : ''}
            </Alert>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <RoutePointCard label="Origin" point={routePoints.from} color="#22c55e" />
            <RoutePointCard label="Destination" point={routePoints.to} color="#ef4444" />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <Button
              variant={routePickMode === 'from' ? 'contained' : 'outlined'}
              startIcon={<FmdGoodIcon />}
              onClick={() => {
                setDrawMode(false);
                setRoutePickMode('from');
                setError('');
              }}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 800 }}
            >
              Pick Origin
            </Button>
            <Button
              variant={routePickMode === 'to' ? 'contained' : 'outlined'}
              startIcon={<FmdGoodIcon />}
              onClick={() => {
                setDrawMode(false);
                setRoutePickMode('to');
                setError('');
              }}
              sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 800 }}
            >
              Pick Destination
            </Button>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button fullWidth startIcon={<SwapHorizIcon />} onClick={swapExpertRoute} sx={{ color: '#cbd5e1', borderRadius: '8px', textTransform: 'none' }}>
              Swap
            </Button>
            <Button fullWidth startIcon={<MyLocationIcon />} onClick={resetExpertRoute} sx={{ color: '#7dd3fc', borderRadius: '8px', textTransform: 'none' }}>
              Defaults
            </Button>
          </Stack>
          <TextField label="Max Wind km/h" size="small" type="number" value={routeForm.maxWindKmh} onChange={(event) => setRouteForm((prev) => ({ ...prev, maxWindKmh: event.target.value }))} sx={fieldSx} />
          <Button fullWidth variant="contained" startIcon={<RouteIcon />} onClick={runExpertRouteSafety} disabled={Boolean(busy)} sx={{ bgcolor: '#7c3aed', borderRadius: '8px', textTransform: 'none', fontWeight: 800, '&:hover': { bgcolor: '#6d28d9' } }}>
            {busy === 'route' ? <CircularProgress size={22} color="inherit" /> : 'Run Route Safety Check'}
          </Button>
          {routeResult && (
            <StatusPanel
              title="Route Safety"
              status={routeResult.safety_status}
              rows={[
                ['Route ID', routeResult.route_id],
                ['Distance', `${Number(routeResult.distance_km).toFixed(2)} km`],
                ['Duration', `${routeResult.duration_min} min`],
                ['Weather', routeResult.weather?.source === 'open_meteo' ? 'Open-Meteo' : 'Fallback'],
                ['10m Wind', routeResult.weather?.wind_kmh !== undefined && routeResult.weather?.wind_kmh !== null ? `${Number(routeResult.weather.wind_kmh).toFixed(1)} km/h` : 'n/a'],
                ['80m Wind', routeResult.weather?.wind_80m_kmh !== undefined && routeResult.weather?.wind_80m_kmh !== null ? `${Number(routeResult.weather.wind_80m_kmh).toFixed(1)} km/h` : 'n/a'],
                ['120m Wind', routeResult.weather?.wind_120m_kmh !== undefined && routeResult.weather?.wind_120m_kmh !== null ? `${Number(routeResult.weather.wind_120m_kmh).toFixed(1)} km/h` : 'n/a'],
              ]}
            />
          )}
          {routeResult?.warnings?.length > 0 && <CompactWarning title="Warnings" items={routeResult.warnings} />}
          {routeResult?.conflicts?.length > 0 && <CompactWarning title="Conflicts" items={routeResult.conflicts.map((conflict) => `${conflict.type.toUpperCase()}: ${conflict.zone_name || conflict.message}`)} tone="danger" />}
        </Stack>
      </Paper>

      <Paper sx={{ ...panelSx, ...scrollPanelSx, position: 'absolute', top: 92, right: 16, zIndex: 20, width: { xs: 'calc(100% - 32px)', md: 380 }, maxHeight: 'calc(100vh - 124px)', overflow: 'auto', p: 2 }}>
        <Stack spacing={2}>
          <Typography sx={{ color: '#e2e8f0', fontWeight: 800 }}>Analysis Results</Typography>
          {!analysisResult && <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem' }}>Results appear after the heatmap is generated.</Typography>}
          {analysisResult && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                <Metric label="Cells" value={analysisResult.summary.cell_count} />
                <Metric label="Average" value={Number(analysisResult.summary.average_score).toFixed(1)} />
                <Metric label="Max" value={Number(analysisResult.summary.max_score).toFixed(1)} />
              </Box>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
                <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, mb: 0.7 }}>AHP Consistency</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={analysisResult.mcdm?.is_consistent ? 'Consistent' : 'Review'} size="small" sx={{ bgcolor: analysisResult.mcdm?.is_consistent ? 'rgba(34,197,94,0.16)' : 'rgba(245,158,11,0.16)', color: analysisResult.mcdm?.is_consistent ? '#86efac' : '#fbbf24' }} />
                  <Typography sx={{ color: '#94a3b8', fontSize: '0.76rem' }}>CR {Number(analysisResult.mcdm?.consistency_ratio ?? 0).toFixed(3)}</Typography>
                </Stack>
              </Box>
              <Typography sx={{ color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 800 }}>Top Candidate Cells</Typography>
              <Stack spacing={1}>
                {analysisResult.top_candidates.map((candidate) => (
                  <Box key={candidate.cell_index} sx={{ display: 'grid', gridTemplateColumns: '42px 1fr auto', gap: 1, alignItems: 'center', bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1 }}>
                    <Box sx={{ width: 34, height: 34, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: `${scoreColor(candidate.suitability_score)}22`, color: scoreColor(candidate.suitability_score), fontWeight: 900 }}>{candidate.rank}</Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: '#e2e8f0', fontSize: '0.78rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{candidate.cell_index}</Typography>
                      <LinearProgress variant="determinate" value={candidate.suitability_score} sx={{ mt: 0.6, height: 6, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: scoreColor(candidate.suitability_score) } }} />
                    </Box>
                    <Typography sx={{ color: scoreColor(candidate.suitability_score), fontWeight: 900, fontSize: '0.86rem' }}>{candidate.suitability_score.toFixed(1)}</Typography>
                  </Box>
                ))}
              </Stack>
              <Button variant="outlined" onClick={compareTopCandidates} disabled={busy === 'compare' || analysisResult.top_candidates.length < 2} sx={{ color: '#7dd3fc', borderColor: 'rgba(125,211,252,0.4)', borderRadius: '8px', textTransform: 'none' }}>
                Compare Top Candidates
              </Button>
              {compareResult && (
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
                  <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800, mb: 0.7 }}>Comparison Ranking</Typography>
                  {compareResult.ranked_candidates.map((candidate) => (
                    <Typography key={candidate.cell_index} sx={{ color: '#94a3b8', fontSize: '0.76rem', mb: 0.4 }}>
                      #{candidate.rank} · {candidate.cell_index} · {candidate.suitability_score.toFixed(1)}
                    </Typography>
                  ))}
                </Box>
              )}
            </>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ ...panelSx, position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 20, px: 2, py: 0.8, display: 'flex', gap: 2 }}>
        <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', fontFamily: 'monospace' }}>LNG {coords.lng.toFixed(4)}</Typography>
        <Typography sx={{ color: '#94a3b8', fontSize: '0.72rem', fontFamily: 'monospace' }}>LAT {coords.lat.toFixed(4)}</Typography>
      </Paper>

      <Paper sx={{ ...panelSx, position: 'absolute', bottom: 16, right: 16, zIndex: 20, p: 1.2, minWidth: 170 }}>
        <Typography sx={{ color: '#cbd5e1', fontSize: '0.7rem', fontWeight: 800, mb: 0.8 }}>Map Layers</Typography>
        {[
          ['NFZ', '#ef4444'],
          ['Controlled', '#38bdf8'],
          ['Suitability', '#22c55e'],
        ].map(([label, color]) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: color, borderRadius: '50%' }} />
            <Typography sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>{label}</Typography>
          </Box>
        ))}
      </Paper>
      <Modal open={jobProgress.open && (busy === 'ingest' || busy === 'analysis')} disableAutoFocus>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 420, maxWidth: 'calc(100% - 32px)', ...panelSx, p: 2.4 }}>
          <Typography sx={{ color: '#e2e8f0', fontWeight: 900, fontSize: '1rem', mb: 0.8 }}>{jobProgress.phase}</Typography>
          <Typography sx={{ color: '#94a3b8', fontSize: '0.82rem', mb: 2 }}>{jobProgress.message}</Typography>
          <LinearProgress
            variant="determinate"
            value={jobProgress.percent}
            sx={{ height: 8, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.08)', '& .MuiLinearProgress-bar': { bgcolor: '#38bdf8' } }}
          />
          <Typography sx={{ color: '#7dd3fc', fontWeight: 900, fontSize: '0.86rem', mt: 1, textAlign: 'right' }}>{jobProgress.percent}%</Typography>
        </Box>
      </Modal>
    </Box>
  );
};

const StatusPanel = ({ title, status, rows, warnings = [] }) => (
  <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1.2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography sx={{ color: '#cbd5e1', fontSize: '0.78rem', fontWeight: 800 }}>{title}</Typography>
      <Chip label={status} size="small" sx={statusChipSx(status)} />
    </Box>
    {rows.map(([label, value]) => (
      <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
        <Typography sx={{ color: '#64748b', fontSize: '0.7rem' }}>{label}</Typography>
        <Typography sx={{ color: '#cbd5e1', fontSize: '0.7rem', fontFamily: typeof value === 'string' && value.length > 12 ? 'monospace' : 'inherit', textAlign: 'right', overflowWrap: 'anywhere' }}>{String(value)}</Typography>
      </Box>
    ))}
    {warnings?.length > 0 && <Alert severity="warning" sx={{ mt: 1, fontSize: '0.72rem' }}>{warnings.slice(0, 2).join(' ')}</Alert>}
  </Box>
);

const CompactWarning = ({ title, items, tone = 'warning' }) => (
  <Box sx={{ bgcolor: tone === 'danger' ? 'rgba(127,29,29,0.28)' : 'rgba(120,53,15,0.28)', border: `1px solid ${tone === 'danger' ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.25)'}`, borderRadius: '8px', p: 1 }}>
    <Typography sx={{ color: tone === 'danger' ? '#fca5a5' : '#facc15', fontSize: '0.7rem', fontWeight: 900, mb: 0.6 }}>{title}</Typography>
    {items.slice(0, 3).map((item, index) => (
      <Typography key={`${title}-${index}`} sx={{ color: '#e2e8f0', fontSize: '0.68rem', lineHeight: 1.35, overflowWrap: 'anywhere', mb: 0.35 }}>
        {item}
      </Typography>
    ))}
  </Box>
);

const formatCoord = (value) => Number(value).toFixed(5);

const RoutePointCard = ({ label, point, color }) => (
  <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', p: 1, minWidth: 0 }}>
    <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mb: 0.6 }}>
      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 0 4px ${color}22` }} />
      <Typography sx={{ color: '#cbd5e1', fontSize: '0.72rem', fontWeight: 900 }}>{label}</Typography>
    </Stack>
    <Typography sx={{ color: '#e2e8f0', fontSize: '0.72rem', fontWeight: 800, overflowWrap: 'anywhere' }}>{point.name}</Typography>
    <Typography sx={{ color: '#94a3b8', fontSize: '0.64rem', fontFamily: 'monospace', mt: 0.45 }}>
      {formatCoord(point.lat)}, {formatCoord(point.lng)}
    </Typography>
  </Box>
);

const Metric = ({ label, value }) => (
  <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '8px', p: 1, minWidth: 0 }}>
    <Typography sx={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 800 }}>{label.toUpperCase()}</Typography>
    <Typography sx={{ color: '#e2e8f0', fontWeight: 900, fontSize: '1rem' }}>{value}</Typography>
  </Box>
);

export default ExpertAnalysisPage;
